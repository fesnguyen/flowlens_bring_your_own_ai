import type { WorkspaceResult } from './definitions';
import { investigationStorage, WorkspaceError, type InvestigationStore } from './investigation_storage';
import type { JiraInspectionApi } from './jira_inspection';

type ForgeContext = { cloudId?: unknown; accountId?: unknown; extension?: unknown };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

/** Extract the stable issue ID from trusted resolver context for all Jira operations. */
export function issueId(extension: unknown): string | undefined {
  const id = (extension as { issue?: { id?: unknown } } | undefined)?.issue?.id;
  return typeof id === 'string' && /^\d+$/.test(id) ? id : undefined;
}

function userScope(context: ForgeContext) {
  const { cloudId, accountId } = context;
  if (typeof cloudId !== 'string' || !cloudId || typeof accountId !== 'string' || !accountId) {
    throw new WorkspaceError('Your Jira account is unavailable. Reopen the issue while signed in.');
  }
  return { tenant: cloudId, accountId };
}

function flowId(id: unknown): string {
  if (typeof id !== 'string' || !uuid.test(id)) throw new WorkspaceError('Select a valid saved flow.');
  return id;
}

async function result<T>(operation: () => Promise<T>, fallback: string): Promise<WorkspaceResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, message: error instanceof WorkspaceError ? error.message : fallback };
  }
}

/** Resolve scope from Forge and recheck Jira visibility before every issue storage operation. */
export function workspaceResolver(store: InvestigationStore, jira: Pick<JiraInspectionApi, 'issue'>) {
  const storage = investigationStorage(store);
  async function issueScope(context: ForgeContext) {
    const { tenant } = userScope(context);
    const id = issueId(context.extension);
    if (!id) throw new WorkspaceError('Open FlowLens from a Jira issue.');
    const response = await jira.issue(id, 'summary');
    if ([401, 403, 404].includes(response.status)) {
      throw new WorkspaceError('You do not have access to this Jira issue. Check your Jira permissions.');
    }
    if (!response.ok) throw new WorkspaceError('Jira could not load this issue. Try again.');
    const issue = await response.json() as { id?: unknown; key?: unknown } | null;
    if (issue?.id !== id || typeof issue.key !== 'string' || !issue.key) {
      throw new WorkspaceError('Jira could not verify the current issue. Reopen it and try again.');
    }
    return { tenant, issueId: id, issueKey: issue.key };
  }
  return {
    list: (context: ForgeContext) => result(async () => {
      const scope = await issueScope(context);
      return { issueKey: scope.issueKey, flows: await storage.list(scope) };
    }, 'Could not load saved flows. Check your Jira connection and retry.'),

    get: (context: ForgeContext, id: unknown) => result(async () =>
      storage.get(await issueScope(context), flowId(id)), 'Could not load this flow. Reload the saved flows and try again.'),

    import: (context: ForgeContext, text: unknown) => result(async () =>
      storage.import(await issueScope(context), text), 'Could not confirm the import. Reload saved flows before importing the file again.'),

    remove: (context: ForgeContext, id: unknown) => result(async () =>
      storage.remove(await issueScope(context), flowId(id)), 'Could not confirm removal. Reload saved flows and try again.'),

    getInstruction: (context: ForgeContext) => result(async () => storage.getInstruction(userScope(context)),
      'Could not load your custom instruction. Retry before preparing an inspection request.'),

    saveInstruction: (context: ForgeContext, text: unknown, revision: unknown) => result(async () => {
      if (revision !== null && (typeof revision !== 'string' || !uuid.test(revision))) {
        throw new WorkspaceError('Reload your custom instruction before saving.');
      }
      return storage.saveInstruction(userScope(context), text, revision);
    }, 'Could not confirm the saved instruction. Reload it before trying again.'),
  };
}
