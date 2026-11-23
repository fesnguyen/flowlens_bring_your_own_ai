
import api, { route } from '@forge/api';
import { makeResolver } from '@forge/resolver';
import type { ResolverDefinitions } from './definitions';
import { forgeStorage } from './forge_storage';
import { issueId, workspaceResolver } from './workspace_resolver';
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

const workspace = workspaceResolver(forgeStorage, jira);

/** Bridge operations use Forge context for identity and Jira asUser for issue authorization. */
export const handler = makeResolver<ResolverDefinitions>({
  listIssueFlows: ({ context }) => workspace.list(context),
  getIssueFlow: ({ context, payload }) => workspace.get(context, payload?.id),
  importIssueAnalysis: ({ context, payload }) => workspace.import(context, payload?.text),
  deleteIssueFlow: ({ context, payload }) => workspace.remove(context, payload?.id),
  getCustomInstruction: ({ context }) => workspace.getInstruction(context),
  saveCustomInstruction: ({ context, payload }) => workspace.saveInstruction(context, payload?.text, payload?.revision),
  getInspectionIssue: ({ context, payload }) =>
    getInspectionIssue(jira, issueId(context.extension), payload?.includeAttachments === true),
  getInspectionAttachment: ({ context, payload }) =>
    getInspectionAttachment(jira, issueId(context.extension), payload?.attachmentId),
});
