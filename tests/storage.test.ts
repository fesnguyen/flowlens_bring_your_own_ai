import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Investigation } from '../shared/inspection';
import {
  investigationStorage, type InvestigationStore, type RecordChange, type RecordValue,
} from '../src/investigation_storage';
import { workspaceResolver } from '../src/workspace_resolver';
import { mockInspection } from '../static/app/src/mockInspection';

/** Serialize on every read/write to approximate resolver invocations against persisted records. */
class TransactionStore implements InvestigationStore {
  readonly records = new Map<string, RecordValue<object>>();
  conflicts = 0;
  failures = 0;
  writes = 0;

  async get<T extends object>(key: string) {
    return structuredClone(this.records.get(key)) as RecordValue<T> | undefined;
  }

  async commit(key: string, expected: string | null, changes: RecordChange[]) {
    if ((this.records.get(key)?.revision ?? null) !== expected) {
      this.conflicts++;
      return false;
    }
    const staged = new Map(this.records);
    for (const change of changes) {
      if ('delete' in change) staged.delete(change.key);
      else staged.set(change.key, structuredClone(change.value));
    }
    if (this.failures) {
      this.failures--;
      throw new Error('mock storage write rejected after staging');
    }
    this.records.clear();
    for (const [key, record] of staged) this.records.set(key, record);
    this.writes++;
    return true;
  }
}

const issue = { tenant: 'tenant-1', issueId: '101', issueKey: 'FL-1' };
const user = { tenant: issue.tenant, accountId: 'account-1' };

function analysis(key = issue.issueKey): Investigation {
  return {
    version: 2,
    issue: { key },
    analysis: { summary: 'Check audio output' },
    flows: [
      {
        id: 'audio', name: 'Audio', type: 'original', description: 'Play audio',
        entryNodeIds: ['start'],
        nodes: [
          { id: 'start', title: 'Load device', sequence: 0,
            impacts: [{ nodeId: 'play', relationship: 'consumer', consequence: 'Sound changes', reason: 'Uses the device' }] },
          { id: 'play', title: 'Play audio', content: [{ type: 'code', text: ' device.play()\n' }] },
        ],
        edges: [{ source: 'start', target: 'play', label: 'Device available', kind: 'branch' }],
      },
    ],
  };
}

test('saved v2 flows reload by stable issue ID and preserve graph evidence and suggestion links', async () => {
  const store = new TransactionStore();
  const input = analysis();
  input.flows.push({ ...input.flows[0], id: 'proposal', type: 'suggestion', basedOnFlowId: 'audio' });
  const imported = await investigationStorage(store).import(issue, JSON.stringify(input));
  const reopened = investigationStorage(store);
  const renamedIssue = { ...issue, issueKey: 'NEW-1' };
  const flows = await reopened.list(renamedIssue);
  assert.deepEqual(flows.map(flow => flow.name), ['Audio', 'Audio (0)']);
  assert.equal(flows[0].id, imported.first.id);
  const saved = await reopened.get(renamedIssue, flows[0].id);
  assert.deepEqual(saved, imported.first);
  assert.deepEqual(saved.flow.edges, input.flows[0].edges);
  assert.deepEqual(saved.flow.nodes[0].impacts, input.flows[0].nodes[0].impacts);
  const proposed = await reopened.get(renamedIssue, flows[1].id);
  assert.equal(proposed.basedOnId, imported.first.id);
  assert.equal(proposed.flow.basedOnFlowId, 'audio');

  assert.deepEqual(await reopened.remove(renamedIssue, saved.id), [flows[1]]);
  assert.deepEqual(await reopened.remove(renamedIssue, saved.id), [flows[1]]);
  assert.deepEqual(await reopened.list(renamedIssue), [flows[1]]);
  await assert.rejects(reopened.get(renamedIssue, saved.id), /no longer available/);
  assert.deepEqual(await reopened.get(renamedIssue, proposed.id), proposed);
});

test('saved v1 flow reloads with its numbered code and findings', async () => {
  const store = new TransactionStore();
  const imported = await investigationStorage(store).import(
    { ...issue, issueKey: mockInspection.issue.key }, JSON.stringify(mockInspection),
  );
  const saved = await investigationStorage(store).get(issue, imported.first.id);
  const original = mockInspection.flows[0].nodes.find(node => node.code?.length && node.findings?.length);
  assert.ok(original);
  const node = saved.flow.nodes.find(node => node.id === original.id);
  assert.deepEqual(node?.content[0], { format: 'legacyCode', blocks: original.code });
  assert.deepEqual(node?.content[1], { format: 'legacyFinding', finding: original.findings?.[0] });
});

test('concurrent imports retry using the latest names and concurrent removal preserves additions', async () => {
  const store = new TransactionStore();
  const file = JSON.stringify(analysis());
  const first = investigationStorage(store);
  const second = investigationStorage(store);
  const [added] = await Promise.all([first.import(issue, file), second.import(issue, file)]);
  assert.ok(store.conflicts > 0);
  assert.deepEqual((await first.list(issue)).map(flow => flow.name), ['Audio', 'Audio (0)']);
  await Promise.all([first.remove(issue, added.first.id), second.import(issue, file)]);
  const remaining = await first.list(issue);
  assert.equal(remaining.length, 2);
  assert.equal(new Set(remaining.map(flow => flow.name)).size, 2);
  assert.ok(remaining.every(flow => flow.id !== added.first.id));
  for (const flow of remaining) assert.equal((await first.get(issue, flow.id)).id, flow.id);
});

test('failed transactions expose no partial graphs or deleted records and are not blindly retried', async () => {
  const store = new TransactionStore();
  const service = investigationStorage(store);
  const input = analysis();
  const baseline = await service.import(issue, JSON.stringify(input));
  input.flows.push({ ...input.flows[0], id: 'extra', name: 'Extra' });
  store.failures = 1;
  await assert.rejects(service.import(issue, JSON.stringify(input)), /rejected after staging/);
  assert.equal(store.records.size, 2);
  assert.deepEqual(await service.list(issue), baseline.flows);

  store.failures = 1;
  await assert.rejects(service.remove(issue, baseline.first.id), /rejected after staging/);
  assert.deepEqual(await service.get(issue, baseline.first.id), baseline.first);
  assert.deepEqual(await service.list(issue), baseline.flows);
  assert.equal(store.writes, 1);
});

test('invalid payloads, references, versions and storage limits fail before any write', async () => {
  const store = new TransactionStore();
  const service = investigationStorage(store);
  const input = analysis();
  await assert.rejects(service.import(issue, '{'), /not valid JSON/);
  await assert.rejects(service.import(issue, JSON.stringify({ ...input, version: 3 })), /Unsupported/);
  await assert.rejects(service.import(issue, JSON.stringify(analysis('OTHER-1'))), /belongs to OTHER-1/);
  input.flows[0].nodes[0].impacts![0].nodeId = 'missing';
  await assert.rejects(service.import(issue, JSON.stringify(input)), /refers to missing node/);
  input.flows[0].nodes[0].impacts = [];
  input.flows[0].nodes[1].content = [{ type: 'code', text: 'x'.repeat(230 * 1024) }];
  await assert.rejects(service.import(issue, JSON.stringify(input)), /220 KiB/);
  await assert.rejects(service.import(issue, 'x'.repeat(450_001)), /450 KB/);
  input.flows = Array.from({ length: 25 }, (_, index) => ({ ...analysis().flows[0], id: String(index) }));
  await assert.rejects(service.import(issue, JSON.stringify(input)), /24 flows/);
  assert.equal(store.writes, 0);
});

test('user preferences reload across issues, stay private, and protect saves and resets from stale tabs', async () => {
  const store = new TransactionStore();
  const service = investigationStorage(store);
  assert.deepEqual(await service.getInstruction(user), { text: '', revision: null });
  const preference = await service.saveInstruction(user, '  Focus on timing.  ', null);
  assert.equal(preference.text, 'Focus on timing.');
  assert.deepEqual(await investigationStorage(store).getInstruction(user), preference);
  for (const other of [{ ...user, accountId: 'account-2' }, { ...user, tenant: 'tenant-2' }]) {
    assert.deepEqual(await service.getInstruction(other), { text: '', revision: null });
  }
  await assert.rejects(service.saveInstruction(user, 'Stale tab', null), /changed in another tab/);
  await assert.rejects(service.saveInstruction(user, 'é'.repeat(17_000), preference.revision), /32 KiB/);
  store.failures = 1;
  await assert.rejects(service.saveInstruction(user, 'Failed draft', preference.revision), /rejected after staging/);
  assert.deepEqual(await service.getInstruction(user), preference);
  const reset = await service.saveInstruction(user, '', preference.revision);
  assert.equal(reset.text, '');
  await assert.rejects(service.saveInstruction(user, 'Stale after reset', preference.revision), /changed in another tab/);
  assert.deepEqual(await service.getInstruction(user), reset);
});

test('resolver derives tenant, issue and account scope and checks Jira permissions before every flow operation', async () => {
  const store = new TransactionStore();
  let status = 200;
  let jiraReads = 0;
  const resolver = workspaceResolver(store, {
    issue: async id => {
      jiraReads++;
      return {
        ok: status === 200, status, json: async () => ({ id, key: `FL-${Number(id) - 100}` }),
        headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0),
      };
    },
  });
  const context = { cloudId: issue.tenant, accountId: 'u1', extension: { issue: { id: issue.issueId } } };
  const first = await resolver.import(context, JSON.stringify(analysis()));
  assert.ok(first.ok);
  const { id } = first.value.first;
  const otherIssue = { ...context, extension: { issue: { id: '102' } } };
  const otherTenant = { ...context, cloudId: 'tenant-2' };
  for (const other of [otherIssue, otherTenant]) {
    const listed = await resolver.list(other);
    assert.ok(listed.ok);
    assert.deepEqual(listed.value.flows, []);
    assert.equal((await resolver.get(other, id)).ok, false);
    const removal = await resolver.remove(other, id);
    assert.deepEqual(removal, { ok: true, value: [] });
  }
  assert.equal((await resolver.get(context, 'forged:flow')).ok, false);
  assert.equal((await resolver.get(context, id)).ok, true);
  const saved = await resolver.saveInstruction(context, 'Trace retries.', null);
  assert.ok(saved.ok);
  const before = jiraReads;
  assert.deepEqual(await resolver.getInstruction(otherIssue), saved);
  assert.equal(jiraReads, before);
  const differentUser = await resolver.getInstruction({ ...context, accountId: 'u2' });
  assert.deepEqual(differentUser, { ok: true, value: { revision: null, text: '' } });

  status = 403;
  const requests = [resolver.list(context), resolver.get(context, id), resolver.remove(context, id),
    resolver.import(context, JSON.stringify(analysis()))];
  for (const response of await Promise.all(requests)) {
    assert.equal(response.ok, false);
    assert.ok(!response.ok && response.message.includes('permissions'));
  }
  assert.equal(store.writes, 2);
  assert.equal((await resolver.list({ ...context, extension: undefined })).ok, false);
  assert.equal((await resolver.getInstruction({ ...context, accountId: undefined })).ok, false);
});
