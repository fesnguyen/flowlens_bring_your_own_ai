import { NeedsAuthenticationError, ProxyRequestError } from '@forge/api';
import { MAX_ATTACHMENT_BYTES } from '../shared/inspection_limits';
import type { AttachmentResult, IssueAttachment, IssueResult, ResolverFailure } from './definitions';
import { renderJiraText } from './jira_rich_text';

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
    [fieldId: string]: unknown;
  };
};

type JiraResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type JiraInspectionApi = {
  issue: (id: string, fields: string) => Promise<JiraResponse>;
  fields: () => Promise<JiraResponse>;
  attachment: (id: string, size: number) => Promise<JiraResponse>;
};

const failure = (message: string): ResolverFailure => ({ ok: false, message });
const issueStatus = (status: number) => (status === 401 || status === 403 || status === 404)
  ? 'This Jira issue is unavailable. Reopen it and check that you have permission to view it.'
  : 'Jira could not load this issue. Try again.';

function attachmentMetadata(issue: JiraIssue): IssueAttachment[] | undefined {
  const items = issue.fields?.attachment;
  if (!Array.isArray(items)) return undefined;
  return items.map((item) => ({
    id: typeof item?.id === 'string' ? item.id : '',
    filename: item?.filename || 'Unnamed attachment',
    size: item?.size,
  }));
}

async function acceptanceCriteria(api: JiraInspectionApi, issueId: string): Promise<string | undefined> {
  try {
    const response = await api.fields();
    if (!response.ok) return undefined;
    const fields = await response.json() as { id: string; name: string }[];
    const matches = fields.filter(({ id, name }) =>
      /^customfield_\d+$/.test(id) && name.trim().toLowerCase() === 'acceptance criteria');
    if (matches.length !== 1) return undefined;
    const [{ id }] = matches;
    const issue = await api.issue(issueId, id);
    if (!issue.ok) return undefined;
    return renderJiraText((await issue.json() as JiraIssue).fields?.[id]);
  } catch {
    // A missing or unavailable custom field should never block the core issue.
    return undefined;
  }
}

/** Read only the issue on which the resolver was invoked, using the user's Jira permissions. */
export async function getInspectionIssue(
  api: JiraInspectionApi,
  issueId: string | undefined,
  includeAttachments: boolean,
): Promise<IssueResult> {
  if (!issueId) return failure('Open FlowLens from a Jira issue and try again.');
  try {
    const fields = 'summary,issuetype,status,priority,description';
    const response = await api.issue(issueId, includeAttachments ? `${fields},attachment` : fields);
    if (!response.ok) return failure(issueStatus(response.status));
    const issue = await response.json() as JiraIssue;
    const { id, key, fields: values } = issue;
    if (id !== issueId || !key?.trim() || !values?.summary?.trim()) {
      return failure('Jira did not return the issue ID, key, or summary. Reopen the issue and try again.');
    }
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
        acceptanceCriteria: await acceptanceCriteria(api, issueId),
      },
      ...(includeAttachments ? { attachments: attachmentMetadata(issue) } : {}),
    };
  } catch (error) {
    // Forge uses this exception to start the user's consent flow.
    if (error instanceof NeedsAuthenticationError) throw error;
    return failure(issueStatus(error instanceof ProxyRequestError ? error.status : 500));
  }
}

/** Recheck membership before serving any client-supplied attachment ID. */
export async function getInspectionAttachment(
  api: JiraInspectionApi,
  issueId: string | undefined,
  attachmentId: string,
): Promise<AttachmentResult> {
  if (!issueId || typeof attachmentId !== 'string' || !/^\d+$/.test(attachmentId)) return failure('Attachment is unavailable for this issue.');
  try {
    const issue = await api.issue(issueId, 'attachment');
    if (!issue.ok) return failure(issueStatus(issue.status));
    const currentIssue = await issue.json() as JiraIssue;
    const item = currentIssue.id === issueId
      ? attachmentMetadata(currentIssue)?.find(({ id }) => id === attachmentId)
      : undefined;
    if (item?.size === undefined || !Number.isSafeInteger(item.size) || item.size < 0) {
      return failure('Attachment is unavailable or Jira did not report its size.');
    }
    if (item.size > MAX_ATTACHMENT_BYTES) return failure('Attachment exceeds the 3 MiB limit.');

    const response = await api.attachment(attachmentId, item.size);
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return failure('Jira denied access to the attachment or it is no longer available.');
    }
    // Jira supports ranges. Check the declared response bounds before Forge buffers the body.
    if (response.status === 206 && item.size > 0) {
      if (response.headers.get('content-range') !== `bytes 0-${item.size - 1}/${item.size}`) {
        return failure('Attachment size changed during download.');
      }
    } else if (response.status !== 200 || response.headers.get('content-length') !== String(item.size)) {
      return failure('Jira could not confirm the attachment size.');
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== item.size) return failure('Jira returned an unexpected attachment size.');
    return { ok: true, base64: bytes.toString('base64') };
  } catch (error) {
    if (error instanceof NeedsAuthenticationError) throw error;
    if (error instanceof ProxyRequestError && [401, 403, 404].includes(error.status)) {
      return failure('Jira denied access to the attachment or it is no longer available.');
    }
    return failure('Jira could not download the attachment.');
  }
}
