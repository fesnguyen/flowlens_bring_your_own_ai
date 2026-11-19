import api, { route } from '@forge/api';
import { makeResolver } from '@forge/resolver';
import type { ResolverDefinitions } from './definitions';
import { getInspectionAttachment, getInspectionIssue, type JiraInspectionApi } from './jira_inspection';

const jira: JiraInspectionApi = {
  issue: (id, fields) => api.asUser().requestJira(route`/rest/api/3/issue/${id}?fields=${fields}`),
  fields: () => api.asUser().requestJira(route`/rest/api/3/field`),
  attachment: (id, size) => api.asUser().requestJira(
    route`/rest/api/3/attachment/content/${id}?redirect=false`,
    { redirect: 'manual', headers: size ? { Range: `bytes=0-${size - 1}` } : undefined },
  ),
};

function issueId(extension: unknown): string | undefined {
  const id = (extension as { issue?: { id?: unknown } } | undefined)?.issue?.id;
  return typeof id === 'string' && /^\d+$/.test(id) ? id : undefined;
}

// The resolver's extension context supplies the issue identity. Browser context is display-only.
export const handler = makeResolver<ResolverDefinitions>({
  health: () => ({ message: 'Hello from the FlowLens Forge resolver.' }),
  getInspectionIssue: ({ context, payload }) =>
    getInspectionIssue(jira, issueId(context.extension), payload?.includeAttachments === true),
  getInspectionAttachment: ({ context, payload }) =>
    getInspectionAttachment(jira, issueId(context.extension), payload?.attachmentId),
});
