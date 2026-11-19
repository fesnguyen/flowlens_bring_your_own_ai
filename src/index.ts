
import api, { route } from '@forge/api';
import { makeResolver } from '@forge/resolver';
import type { ResolverDefinitions } from './definitions';
import {
  getInspectionAttachment,
  getInspectionIssue,
  type JiraInspectionApi,
} from './jira_inspection';

/**
 * jira — Jira REST API adapter.
 *
 * Implements JiraInspectionApi using Atlassian Forge's requestJira API.
 *
 * api.asUser() executes requests with the current user's permissions.
 * route`` safely constructs Jira API paths with dynamic parameters.
 *
 * Keeping Jira requests in this adapter separates HTTP communication
 * from the inspection business logic in jira_inspection.ts.
 */
const jira: JiraInspectionApi = {
  /**
   * Fetch a Jira issue by ID, requesting only the specified fields.
   *
   * Endpoint: GET /rest/api/3/issue/{id}
   */
  issue: (id, fields) =>
    api.asUser().requestJira(
      route`/rest/api/3/issue/${id}?fields=${fields}`,
    ),

  /**
   * Fetch Jira field definitions, including custom fields.
   *
   * Endpoint: GET /rest/api/3/field
   */
  fields: () =>
    api.asUser().requestJira(
      route`/rest/api/3/field`,
    ),

  /**
   * Retrieve an attachment's binary content.
   *
   * Endpoint: GET /rest/api/3/attachment/content/{id}
   *
   * - redirect=false: Request content without Jira's normal redirect.
   * - redirect: 'manual': Prevent automatic HTTP redirect following.
   * - Range: Optionally request only the first 'size' bytes.
   *
   * The Range header is useful when attachment retrieval needs
   * to limit the amount of downloaded data.
   */
  attachment: (id, size) =>
    api.asUser().requestJira(
      route`/rest/api/3/attachment/content/${id}?redirect=false`,
      {
        redirect: 'manual',
        headers: size
          ? { Range: `bytes=0-${size - 1}` }
          : undefined,
      },
    ),
};

/**
 * issueId — Extract and validate the Jira issue ID from Forge context.
 *
 * Forge supplies the extension context to backend resolvers.
 * We use that context instead of trusting an issue ID from the frontend.
 *
 * Validation:
 * - The issue ID must be a string.
 * - It must contain only numeric characters.
 *
 * Returns undefined when the issue ID is missing or invalid.
 *
 * @param extension - Forge extension context.
 */
function issueId(extension: unknown): string | undefined {
  // Type assertion describes the expected shape of the external context.
  // It does not validate the data at runtime.
  const id = (
    extension as { issue?: { id?: unknown } } | undefined
  )?.issue?.id;

  // Validate the actual runtime value before using it in Jira requests.
  return typeof id === 'string' && /^\d+$/.test(id)
    ? id
    : undefined;
}

/**
 * handler — Forge resolver entry point.
 *
 * Exposes backend functions that the React frontend can invoke
 * through Forge Bridge's makeInvoke().
 *
 * Available operations:
 * - health: Verify that the frontend can reach the resolver.
 * - getInspectionIssue: Load issue data for inspection.
 * - getInspectionAttachment: Retrieve attachment content.
 *
 * ResolverDefinitions provides TypeScript contracts shared
 * between the frontend and backend.
 *
 * SECURITY:
 * The Jira issue identity comes from the trusted Forge extension
 * context, not from a frontend-provided issue ID.
 *
 * Jira requests use api.asUser(), so they run under the
 * current user's Jira permissions.
 */
export const handler = makeResolver<ResolverDefinitions>({
  /**
   * HEALTH CHECK
   *
   * Triggered by the frontend during initialization to verify
   * that Forge Bridge can communicate with the backend.
   */
  health: () => ({
    message: 'Hello from the FlowLens Forge resolver.',
  }),

  /**
   * GET INSPECTION ISSUE
   *
   * Triggered by both inspection actions:
   * - Copy Inspection Prompt
   * - Export Inspection Package
   *
   * Execution:
   * 1. Read the issue ID from Forge context.
   * 2. Determine whether attachment metadata is requested.
   * 3. Delegate issue retrieval to jira_inspection.ts.
   *
   * Attachment metadata is requested only for export.
   */
  getInspectionIssue: ({ context, payload }) =>
    getInspectionIssue(
      jira,
      issueId(context.extension),
      payload?.includeAttachments === true,
    ),

  /**
   * GET INSPECTION ATTACHMENT
   *
   * Triggered during Export Inspection Package.
   *
   * Execution:
   * 1. Identify the current Jira issue from Forge context.
   * 2. Read the requested attachment ID from the payload.
   * 3. Delegate attachment retrieval to jira_inspection.ts.
   *
   * The inspection service is responsible for validating
   * the attachment request before retrieving its content.
   */
  getInspectionAttachment: ({ context, payload }) =>
    getInspectionAttachment(
      jira,
      issueId(context.extension),
      payload?.attachmentId,
    ),
});
