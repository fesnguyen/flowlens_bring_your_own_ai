import { createHash, randomUUID } from 'node:crypto';
import { parseInspection } from '../shared/import_inspection';
import {
  defaultPreference, jsonBytes, maxImportFlows, maxImportPayloadBytes, maxRecordBytes,
  summarizeFlow, validateInstruction, type FlowSummary, type InstructionPreference, type SavedFlow,
} from '../shared/workspace';

export type RecordValue<T> = { revision: string; data: T };
export type RecordChange = { key: string; value: RecordValue<object> } | { key: string; delete: true };

/** The guard and every change commit as one unit. A false result means the guard lost a race. */
export type InvestigationStore = {
  get<T extends object>(key: string): Promise<RecordValue<T> | undefined>;
  commit(key: string, expected: string | null, changes: RecordChange[]): Promise<boolean>;
};

type IssueScope = { tenant: string; issueId: string; issueKey: string };
type UserScope = { tenant: string; accountId: string };
type Directory = { flows: FlowSummary[] };
const attempts = 4;

export class WorkspaceError extends Error {}

function identity(...parts: string[]) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function issuePrefix(scope: IssueScope) {
  return `issue:${identity(scope.tenant, scope.issueId)}`;
}

function instructionKey(scope: UserScope) {
  return `instruction:${identity(scope.tenant, scope.accountId)}`;
}

function record<T extends object>(data: T): RecordValue<T> {
  const value = { revision: randomUUID(), data };
  if (jsonBytes(value) > maxRecordBytes) {
    throw new WorkspaceError('A saved record exceeds 220 KiB. Split the investigation into smaller flows or remove old flows from this issue.');
  }
  return value;
}

/** Owns issue indexes, graph records and account preferences, independently of Forge transport. */
export function investigationStorage(store: InvestigationStore) {
  return {
    async list(scope: IssueScope): Promise<FlowSummary[]> {
      const directory = await store.get<Directory>(issuePrefix(scope));
      return directory?.data.flows ?? [];
    },

    async get(scope: IssueScope, id: string): Promise<SavedFlow> {
      const saved = await store.get<SavedFlow>(`${issuePrefix(scope)}:${id}`);
      if (!saved) throw new WorkspaceError('This flow is no longer available. Reload the saved flows.');
      return saved.data;
    },

    async import(scope: IssueScope, text: unknown) {
      if (typeof text !== 'string' || jsonBytes({ text }) > maxImportPayloadBytes) {
        throw new WorkspaceError('The import exceeds the 450 KB request limit. Split the analysis into smaller files.');
      }
      let inspection;
      try {
        inspection = parseInspection(text, scope.issueKey);
      } catch (error) {
        if (error instanceof Error) throw new WorkspaceError(error.message);
        throw error;
      }
      if (inspection.flows.length > maxImportFlows) {
        throw new WorkspaceError('Import up to 24 flows per file. Split the analysis into smaller files.');
      }

      const prefix = issuePrefix(scope);
      const ids = new Map(inspection.flows.map(flow => [flow.id, randomUUID()]));
      // Plan against the latest directory after a known conflict. The transaction inserts the graphs
      // and publishes their directory entries together, so a rejected write exposes no partial import.
      for (let attempt = 0; attempt < attempts; attempt++) {
        const current = await store.get<Directory>(prefix);
        const flows = current?.data.flows ?? [];
        const used = new Set(flows.map(flow => flow.name));
        const added = inspection.flows.map((flow): SavedFlow => {
          let name = flow.name;
          for (let suffix = 0; used.has(name); suffix++) name = `${flow.name} (${suffix})`;
          used.add(name);
          return {
            id: ids.get(flow.id)!,
            flow: { ...flow, name },
            analysis: inspection.analysis,
            ...(flow.basedOnFlowId && { basedOnId: ids.get(flow.basedOnFlowId) }),
          };
        });
        const next = [...flows, ...added.map(summarizeFlow)];
        const writes = added.map(data => ({ key: `${prefix}:${data.id}`, value: record(data) }));
        if (await store.commit(prefix, current?.revision ?? null, [
          { key: prefix, value: record({ flows: next }) }, ...writes,
        ])) {
          return { flows: next, first: added[0], addedCount: added.length };
        }
      }
      throw new WorkspaceError('Saved flows changed while importing. Try the import again.');
    },

    async remove(scope: IssueScope, id: string): Promise<FlowSummary[]> {
      const prefix = issuePrefix(scope);
      for (let attempt = 0; attempt < attempts; attempt++) {
        const current = await store.get<Directory>(prefix);
        if (!current || !current.data.flows.some(flow => flow.id === id)) return current?.data.flows ?? [];
        const flows = current.data.flows.filter(flow => flow.id !== id);
        if (await store.commit(prefix, current.revision, [
          { key: prefix, value: record({ flows }) }, { key: `${prefix}:${id}`, delete: true },
        ])) return flows;
      }
      throw new WorkspaceError('Saved flows changed while removing this flow. Reload the list and try again.');
    },

    async getInstruction(scope: UserScope): Promise<InstructionPreference> {
      const saved = await store.get<{ text: string }>(instructionKey(scope));
      return saved ? { text: saved.data.text, revision: saved.revision } : defaultPreference;
    },

    async saveInstruction(scope: UserScope, input: unknown, expected: string | null): Promise<InstructionPreference> {
      let text: string;
      try {
        text = validateInstruction(input);
      } catch (error) {
        if (error instanceof Error) throw new WorkspaceError(error.message);
        throw error;
      }
      const key = instructionKey(scope);
      const value = record({ text });
      // A reset stores a new revision with empty text so stale tabs cannot restore an older setting.
      if (!await store.commit(key, expected, [{ key, value }])) {
        throw new WorkspaceError('Your saved instruction changed in another tab. Reload it before saving again.');
      }
      return { text, revision: value.revision };
    },
  };
}
