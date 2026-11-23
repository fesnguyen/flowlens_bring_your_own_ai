import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResolverDefinitions, WorkspaceResult } from '../../../src/definitions';
import {
  defaultPreference, jsonBytes, maxImportPayloadBytes, summarizeFlow, validateInstruction,
  type FlowSummary, type InstructionPreference, type SavedFlow,
} from '../../../shared/workspace';
import { toInspection } from '../../../shared/inspection';
import { parseInspection } from '../../../shared/import_inspection';
import { appendFlows } from './inspection/flow_collection';
import { mockInspection } from './mockInspection';

type WorkspaceApi = {
  [Key in Exclude<keyof ResolverDefinitions, 'getInspectionIssue' | 'getInspectionAttachment'>]:
    (...args: Parameters<ResolverDefinitions[Key]>) => Promise<ReturnType<ResolverDefinitions[Key]>>;
};

const ok = <T,>(value: T): WorkspaceResult<T> => ({ ok: true, value });

function unwrap<T>(result: WorkspaceResult<T>): T {
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

/** The standalone preview exercises the viewer using fictional data and in-memory edits. */
function previewApi(): WorkspaceApi {
  let flows = appendFlows([], toInspection(mockInspection), 0);
  let nextKey = flows.length;
  let preference = defaultPreference;
  const saved = ({ key, flow, analysis }: (typeof flows)[number]): SavedFlow => ({ id: String(key), flow, analysis });
  const list = () => flows.map(flow => summarizeFlow(saved(flow)));
  return {
    listIssueFlows: async () => ok({ issueKey: mockInspection.issue.key, flows: list() }),
    getIssueFlow: async ({ id }) => {
      const entry = flows.find(item => String(item.key) === id);
      return entry ? ok(saved(entry)) : { ok: false, message: 'This flow is no longer available.' };
    },
    importIssueAnalysis: async ({ text }) => {
      const inspection = parseInspection(text);
      const first = flows.length;
      flows = appendFlows(flows, inspection, nextKey);
      nextKey += inspection.flows.length;
      return ok({ flows: list(), first: saved(flows[first]), addedCount: inspection.flows.length });
    },
    deleteIssueFlow: async ({ id }) => {
      flows = flows.filter(item => String(item.key) !== id);
      return ok(list());
    },
    getCustomInstruction: async () => ok(preference),
    saveCustomInstruction: async ({ text }) => {
      preference = { text: validateInstruction(text), revision: null };
      return ok(preference);
    },
  };
}

async function connect(preview: boolean): Promise<WorkspaceApi> {
  if (preview) return previewApi();
  const { makeInvoke } = await import('@forge/bridge');
  const invoke = makeInvoke<ResolverDefinitions>();
  return {
    listIssueFlows: () => invoke('listIssueFlows'),
    getIssueFlow: args => invoke('getIssueFlow', args),
    importIssueAnalysis: args => invoke('importIssueAnalysis', args),
    deleteIssueFlow: args => invoke('deleteIssueFlow', args),
    getCustomInstruction: () => invoke('getCustomInstruction'),
    saveCustomInstruction: args => invoke('saveCustomInstruction', args),
  };
}

type Detail = { id: string; saved?: SavedFlow; error?: string };
type Notice = { message: string; error?: boolean; reload?: boolean };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Coordinate panel requests. Only confirmed mutations update the visible saved collection. */
export function useWorkspace(preview: boolean) {
  const [api, setApi] = useState<WorkspaceApi>();
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [issueKey, setIssueKey] = useState<string>();
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string>();
  const [detail, setDetail] = useState<Detail>();
  const detailRequest = useRef(0);
  const activeId = useRef<string>();
  const [preference, setPreference] = useState<InstructionPreference>();
  const [preferenceError, setPreferenceError] = useState<string>();
  const [preferenceLoading, setPreferenceLoading] = useState(true);
  const [mutation, setMutation] = useState<'import' | 'remove'>();
  const lock = useRef(false);
  const [notice, setNotice] = useState<Notice>();

  useEffect(() => {
    let active = true;
    void connect(preview).then(client => {
      if (active) setApi(client);
    }, () => {
      if (!active) return;
      setLoading(false);
      setPreferenceLoading(false);
      setListError('Could not connect to Jira. Reopen FlowLens or try again.');
      setPreferenceError('Could not connect to Jira.');
    });
    return () => { active = false; };
  }, [preview, connectionAttempt]);

  const openFlow = useCallback(async (id?: string, saved?: SavedFlow) => {
    const request = ++detailRequest.current;
    activeId.current = id;
    setDetail(id ? { id, saved } : undefined);
    if (!api || !id || saved) return;
    try {
      const next = unwrap(await api.getIssueFlow({ id }));
      if (detailRequest.current === request) setDetail({ id, saved: next });
    } catch (error) {
      if (detailRequest.current === request) {
        setDetail({ id, error: errorMessage(error, 'Could not load this flow.') });
      }
    }
  }, [api]);

  const reload = useCallback(async () => {
    setLoading(true);
    setListError(undefined);
    setNotice(undefined);
    if (!api) {
      setConnectionAttempt(previous => previous + 1);
      return;
    }
    try {
      const next = unwrap(await api.listIssueFlows());
      setIssueKey(next.issueKey);
      setFlows(next.flows);
      const selected = next.flows.find(item => item.id === activeId.current) ?? next.flows[0];
      void openFlow(selected?.id);
    } catch (error) {
      setIssueKey(undefined);
      setFlows([]);
      void openFlow();
      setListError(errorMessage(error, 'Could not load saved flows. Try again.'));
    } finally {
      setLoading(false);
    }
  }, [api, openFlow]);

  const reloadPreference = useCallback(async () => {
    if (!api) return;
    setPreferenceLoading(true);
    setPreferenceError(undefined);
    try {
      setPreference(unwrap(await api.getCustomInstruction()));
    } catch (error) {
      setPreference(undefined);
      setPreferenceError(errorMessage(error, 'Could not load your custom instruction. Try again.'));
    } finally {
      setPreferenceLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (api) {
      void reload();
      void reloadPreference();
    }
  }, [api, reload, reloadPreference]);

  async function savePreference(text: string) {
    if (!api || !preference) throw new Error('Reload your custom instruction before saving.');
    const next = unwrap(await api.saveCustomInstruction({
      text: validateInstruction(text), revision: preference.revision,
    }));
    setPreference(next);
  }

  async function importFile(file: File) {
    if (!api || lock.current) return;
    lock.current = true;
    setMutation('import');
    setNotice(undefined);
    try {
      if (file.size > maxImportPayloadBytes) throw new Error('The file exceeds 450 KB. Split the analysis into smaller files.');
      const text = await file.text();
      if (jsonBytes({ text }) > maxImportPayloadBytes) {
        throw new Error('The analysis exceeds the 450 KB request limit. Split it into smaller files.');
      }
      let response;
      try {
        response = await api.importIssueAnalysis({ text });
      } catch {
        setNotice({ message: 'Could not confirm the import. Reload saved flows before trying again.', error: true, reload: true });
        return;
      }
      const next = unwrap(response);
      setFlows(next.flows);
      void openFlow(next.first.id, next.first);
      setNotice({ message: `Saved ${next.addedCount} ${next.addedCount === 1 ? 'flow' : 'flows'} to this issue.` });
      return true;
    } catch (error) {
      setNotice({ message: errorMessage(error, 'Could not read this file. Try selecting it again.'), error: true, reload: true });
    } finally {
      lock.current = false;
      setMutation(undefined);
    }
  }

  async function removeFlow(id: string) {
    if (!api || lock.current) return false;
    lock.current = true;
    setMutation('remove');
    setNotice(undefined);
    try {
      const next = unwrap(await api.deleteIssueFlow({ id }));
      setFlows(next);
      if (!next.some(item => item.id === activeId.current)) void openFlow(next[0]?.id);
      setNotice({ message: 'Flow removed from this issue.' });
      return true;
    } catch (error) {
      setNotice({
        message: errorMessage(error, 'Could not confirm removal. Reload saved flows and try again.'),
        error: true, reload: true,
      });
      return false;
    } finally {
      lock.current = false;
      setMutation(undefined);
    }
  }

  return {
    issueKey, flows, detail, loading, listError, reload, openFlow, preference, preferenceError,
    preferenceLoading, savePreference, mutation, notice, importFile, removeFlow,
    retryPreference: async () => {
      if (api) await reloadPreference();
      else await reload();
    },
    dismissNotice: () => setNotice(undefined),
  };
}
