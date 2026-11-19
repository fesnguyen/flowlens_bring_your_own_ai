
import { NeedsAuthenticationError, ProxyRequestError } from '@forge/api';
import { MAX_ATTACHMENT_BYTES } from '../shared/inspection_limits';
import type {
  AttachmentResult,
  IssueAttachment,
  IssueResult,
  ResolverFailure,
} from './definitions';
import { renderJiraText } from './jira_rich_text';

/**
 * JiraIssue — Subset of Jira's issue response used by FlowLens.
 *
 * Includes standard issue fields, attachment metadata, and dynamic
 * custom fields such as Acceptance Criteria.
 *
 * Fields are optional because Jira responses can vary depending
 * on permissions, configuration, and requested fields.
 */
type JiraIssue = {
  id?: string;
  key?: string;
  fields?: {
    summary?: string;
    issuetype?: { name?: string };
    status?: { name?: string };
    priority?: { name?: string };
    description?: unknown;
    attachment?: { id?: string; filename?: string; size?: number }[];

    // Jira custom fields use dynamic names such as customfield_10001.
    [fieldId: string]: unknown;
  };
};

/**
 * JiraResponse — HTTP response contract required by this service.
 *
 * Represents only the response functionality used by FlowLens,
 * rather than depending on the complete HTTP Response interface.
 */
type JiraResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
};

/**
 * JiraInspectionApi — Interface for Jira operations.
 *
 * The Forge resolver supplies the real implementation using requestJira().
 * This service depends on the interface instead of importing Forge API
 * calls directly, making the business logic easier to test with mocks.
 */
export type JiraInspectionApi = {
  issue: (id: string, fields: string) => Promise<JiraResponse>;
  fields: () => Promise<JiraResponse>;
  attachment: (id: string, size: number) => Promise<JiraResponse>;
};

/**
 * Create a standardized failure response for frontend consumption.
 */
const failure = (message: string): ResolverFailure => ({
  ok: false,
  message,
});

/**
 * Translate Jira HTTP errors into user-facing messages.
 *
 * 401/403/404 indicate unavailable or inaccessible issues.
 * Other errors use a general retry message.
 *
 * Grouping these statuses avoids exposing unnecessary internal details.
 */
const issueStatus = (status: number) =>
  (status === 401 || status === 403 || status === 404)
    ? 'This Jira issue is unavailable. Reopen it and check that you have permission to view it.'
    : 'Jira could not load this issue. Try again.';

/**
 * attachmentMetadata — Extract attachment information from a Jira issue.
 *
 * Converts Jira's attachment field into FlowLens's IssueAttachment format.
 *
 * Returns undefined if Jira did not provide an attachment array.
 * This distinguishes missing metadata from an explicitly empty list.
 */
function attachmentMetadata(issue: JiraIssue): IssueAttachment[] | undefined {
  const items = issue.fields?.attachment;
  if (!Array.isArray(items)) return undefined;

  return items.map((item) => ({
    id: typeof item?.id === 'string' ? item.id : '',
    filename: item?.filename || 'Unnamed attachment',
    size: item?.size,
  }));
}

/**
 * acceptanceCriteria — Retrieve the issue's Acceptance Criteria field.
 *
 * Jira commonly stores Acceptance Criteria in a custom field,
 * whose ID varies between Jira instances.
 *
 * Execution:
 * 1. Retrieve the available Jira field definitions.
 * 2. Find exactly one custom field named "Acceptance Criteria".
 * 3. Request that field's value for the current issue.
 * 4. Convert Jira rich text into readable text.
 *
 * Returns undefined when the field is missing, ambiguous, or unavailable.
 * Acceptance Criteria is optional and must not block the core issue.
 */
async function acceptanceCriteria(
  api: JiraInspectionApi,
  issueId: string,
): Promise<string | undefined> {
  try {
    // STEP 1: Load Jira's field definitions.
    const response = await api.fields();
    if (!response.ok) return undefined;

    const fields = await response.json() as {
      id: string;
      name: string;
    }[];

    // STEP 2: Find custom fields with the exact normalized name.
    // Require one match to avoid choosing an ambiguous field.
    const matches = fields.filter(({ id, name }) =>
      /^customfield_\d+$/.test(id) &&
      name.trim().toLowerCase() === 'acceptance criteria');

    if (matches.length !== 1) return undefined;

    // STEP 3: Request the matching field from the current issue.
    const [{ id }] = matches;
    const issue = await api.issue(issueId, id);
    if (!issue.ok) return undefined;

    // STEP 4: Convert Jira's rich-text field into readable text.
    return renderJiraText(
      (await issue.json() as JiraIssue).fields?.[id],
    );
  } catch {
    // A missing or unavailable custom field must not block issue retrieval.
    return undefined;
  }
}

/**
 * getInspectionIssue — Retrieve the current Jira issue for inspection.
 *
 * Called by the Forge resolver for:
 * - Copy Inspection Prompt.
 * - Export Inspection Package.
 *
 * Business rules:
 * - Only retrieve the issue identified by Forge resolver context.
 * - Use the current user's Jira permissions (handled by the API adapter).
 * - Validate the returned issue identity and required fields.
 * - Retrieve attachment metadata only when requested.
 * - Treat Acceptance Criteria as optional.
 *
 * @param api - Jira API adapter.
 * @param issueId - Issue ID extracted from Forge context.
 * @param includeAttachments - Whether to include attachment metadata.
 *
 * @returns Standardized issue data or a failure response.
 */
export async function getInspectionIssue(
  api: JiraInspectionApi,
  issueId: string | undefined,
  includeAttachments: boolean,
): Promise<IssueResult> {
  // STEP 1: Require a valid issue identity from the Forge context.
  if (!issueId) {
    return failure('Open FlowLens from a Jira issue and try again.');
  }

  try {
    // STEP 2: Request only the Jira fields needed for inspection.
    const fields = 'summary,issuetype,status,priority,description';

    const response = await api.issue(
      issueId,
      includeAttachments ? `${fields},attachment` : fields,
    );

    // Stop when Jira cannot provide the issue.
    if (!response.ok) return failure(issueStatus(response.status));

    // STEP 3: Parse and validate the returned issue.
    const issue = await response.json() as JiraIssue;
    const { id, key, fields: values } = issue;

    // Ensure Jira returned the requested issue and its required metadata.
    if (id !== issueId || !key?.trim() || !values?.summary?.trim()) {
      return failure(
        'Jira did not return the issue ID, key, or summary. Reopen the issue and try again.',
      );
    }

    /**
     * STEP 4: Build the normalized inspection issue response.
     *
     * Convert Jira field names and rich text into the format
     * expected by the FlowLens frontend.
     */
    return {
      ok: true,
      issue: {
        issueId: id,
        key,
        title: values.summary,
        type: values.issuetype?.name,
        status: values.status?.name,
        priority: values.priority?.name,
        description: renderJiraText(values.description),

        // Optional custom field, retrieved independently.
        acceptanceCriteria: await acceptanceCriteria(api, issueId),
      },

      // Include attachment metadata only for export requests.
      ...(includeAttachments
        ? { attachments: attachmentMetadata(issue) }
        : {}),
    };
  } catch (error) {
    /**
     * ERROR HANDLING
     *
     * Forge authentication errors must propagate so the platform
     * can initiate the user's consent/authentication flow.
     *
     * Other errors become standardized failures for the frontend.
     */
    if (error instanceof NeedsAuthenticationError) throw error;

    return failure(
      issueStatus(
        error instanceof ProxyRequestError ? error.status : 500,
      ),
    );
  }
}

/**
 * getInspectionAttachment — Download an attachment from the current issue.
 *
 * Called during Export Inspection Package.
 *
 * Security and validation:
 * 1. Validate the requested attachment ID.
 * 2. Confirm the attachment belongs to the current Jira issue.
 * 3. Enforce the maximum attachment size.
 * 4. Validate HTTP response status and declared content size.
 * 5. Verify the actual downloaded byte count.
 *
 * Attachment IDs originate from the frontend, so membership must be
 * rechecked against Jira rather than trusting the supplied ID.
 *
 * @returns Base64-encoded attachment content or a failure response.
 */
export async function getInspectionAttachment(
  api: JiraInspectionApi,
  issueId: string | undefined,
  attachmentId: string,
): Promise<AttachmentResult> {
  // STEP 1: Validate the issue context and client-supplied attachment ID.
  if (!issueId || typeof attachmentId !== 'string' || !/^\d+$/.test(attachmentId)) {
    return failure('Attachment is unavailable for this issue.');
  }

  try {
    /**
     * STEP 2: Verify attachment membership.
     *
     * Re-fetch the current issue's attachment list from Jira.
     * Never assume that a client-provided attachment ID belongs
     * to the issue being inspected.
     */
    const issue = await api.issue(issueId, 'attachment');
    if (!issue.ok) return failure(issueStatus(issue.status));

    const currentIssue = await issue.json() as JiraIssue;

    // Only accept attachments listed on the expected Jira issue.
    const item = currentIssue.id === issueId
      ? attachmentMetadata(currentIssue)?.find(({ id }) => id === attachmentId)
      : undefined;

    /**
     * STEP 3: Validate attachment size.
     *
     * Jira must report a safe, non-negative integer size.
     * Unknown or invalid sizes are rejected.
     */
    if (
      item?.size === undefined ||
      !Number.isSafeInteger(item.size) ||
      item.size < 0
    ) {
      return failure(
        'Attachment is unavailable or Jira did not report its size.',
      );
    }

    // Reject files exceeding the configured attachment size limit.
    if (item.size > MAX_ATTACHMENT_BYTES) {
      return failure('Attachment exceeds the 3 MiB limit.');
    }

    /**
     * STEP 4: Request attachment content.
     *
     * The API adapter may use HTTP Range to limit the response.
     * Validate response headers before buffering the body.
     */
    const response = await api.attachment(attachmentId, item.size);

    // Handle missing attachments and permission failures explicitly.
    if ([401, 403, 404].includes(response.status)) {
      return failure(
        'Jira denied access to the attachment or it is no longer available.',
      );
    }

    /**
     * STEP 5: Verify the declared response size.
     *
     * 206 Partial Content:
     * Require a Content-Range matching the expected complete file.
     *
     * 200 OK:
     * Require Content-Length to match the attachment metadata.
     *
     * This reduces the risk of buffering unexpected content.
     */
    if (response.status === 206 && item.size > 0) {
      if (
        response.headers.get('content-range') !==
        `bytes 0-${item.size - 1}/${item.size}`
      ) {
        return failure('Attachment size changed during download.');
      }
    } else if (
      response.status !== 200 ||
      response.headers.get('content-length') !== String(item.size)
    ) {
      return failure('Jira could not confirm the attachment size.');
    }

    /**
     * STEP 6: Read and verify the attachment bytes.
     *
     * Confirm that the actual downloaded content matches Jira's
     * declared size before returning it to the frontend.
     */
    const bytes = Buffer.from(await response.arrayBuffer());

    if (bytes.length !== item.size) {
      return failure('Jira returned an unexpected attachment size.');
    }

    // Base64 allows binary content to be transported in the resolver response.
    return {
      ok: true,
      base64: bytes.toString('base64'),
    };
  } catch (error) {
    /**
     * ERROR HANDLING
     *
     * Preserve Forge authentication exceptions for consent handling.
     * Convert other Jira failures into user-facing messages.
     */
    if (error instanceof NeedsAuthenticationError) throw error;

    if (
      error instanceof ProxyRequestError &&
      [401, 403, 404].includes(error.status)
    ) {
      return failure(
        'Jira denied access to the attachment or it is no longer available.',
      );
    }

    return failure('Jira could not download the attachment.');
  }
}
