import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unzipSync } from 'fflate';
import schema from '../shared/flowlens.schema.json';
import type { Investigation } from '../static/app/src/inspection';
import { mockInspection } from '../static/app/src/mockInspection';
import { buildCopyContext, buildGeneralContext, buildInspectionMaterials } from '../static/app/src/inspection/context_builder';
import { appendFlows, impactTargets } from '../static/app/src/inspection/flow_collection';
import { parseInspection } from '../static/app/src/inspection/import_inspection';
import {
  activeInstruction, createInstruction, defaultInstructions, loadInstructions, removeInstruction,
} from '../static/app/src/inspection/instructions';
import { buildInspectionPackage } from '../static/app/src/inspection/package_builder';

function investigation(): Investigation {
  return {
    version: 2,
    issue: { key: 'FL-42' },
    analysis: { summary: 'Trace audio playback and cleanup.' },
    flows: [
      {
        id: 'playback',
        name: 'Audio playback',
        type: 'original',
        description: 'Follow the available and unavailable device paths.',
        entryNodeIds: ['device'],
        nodes: [
          {
            id: 'device', title: 'Check audio device', kind: 'decision', sequence: 0,
            subheader: 'Select an output device.',
            source: { file: 'audio.ts' },
            content: [
              { type: 'condition', text: 'The selected device is connected.' },
              { type: 'code', text: '  return device.isConnected();\n', source: { file: 'audio.ts', startLine: 17 } },
              { type: 'warning', title: 'Missing device', text: 'Audio will be skipped.', status: 'hypothesis' },
              { type: 'custom scenario', text: 'Switch the default device while playing.' },
            ],
            impacts: [{
              nodeId: 'cleanup', relationship: 'shared state', consequence: 'Audio handles could leak.',
              reason: 'Cleanup uses the same device state.', status: 'uncertain',
              evidence: 'Both components use the configured device.', verification: 'Switch devices, then stop playback.',
            }],
          },
          { id: 'play', title: 'Start playback' },
          { id: 'skip', title: 'Skip playback' },
          { id: 'cleanup', title: 'Release device' },
        ],
        edges: [
          { source: 'device', target: 'play', kind: 'branch', label: 'Yes' },
          { source: 'device', target: 'skip', kind: 'branch', label: 'No' },
          { source: 'play', target: 'cleanup' },
        ],
      },
      {
        id: 'cleanup-only', name: 'Cleanup', type: 'original', description: 'Standalone cleanup.',
        entryNodeIds: ['cleanup'], nodes: [{ id: 'cleanup', title: 'Release device' }], edges: [],
      },
    ],
  };
}

test('v2 imports minimal nodes and ordered content with optional source references', () => {
  const document = investigation();
  const result = parseInspection(JSON.stringify(document), 'FL-42');
  const [flow, other] = result.flows;
  assert.deepEqual(flow.nodes[1], { id: 'play', title: 'Start playback', content: [] });
  assert.deepEqual(flow.nodes[0].source, { file: 'audio.ts' });
  assert.equal(flow.nodes[0].sequence, 0);
  assert.deepEqual(flow.nodes[0].content.map(item => item.format === 'content' && item.block), document.flows[0].nodes[0].content);
  assert.equal(other.id, 'cleanup-only');
  assert.deepEqual(flow.edges, document.flows[0].edges);
});

test('impact highlights use selected-node declarations and ignore execution adjacency', () => {
  const [flow, other] = parseInspection(JSON.stringify(investigation())).flows;
  assert.deepEqual([...impactTargets(flow, 'device')], ['cleanup']);
  assert.equal(flow.edges.some(edge => edge.source === 'device' && edge.target === 'cleanup'), false);
  assert.deepEqual([...impactTargets(flow, 'play')], []);
  assert.deepEqual([...impactTargets(other, 'cleanup')], []);
  assert.deepEqual([...impactTargets(flow)], []);
});

test('v1 imports preserve node IDs, finding evidence, exact code and omission blocks', () => {
  const result = parseInspection(JSON.stringify(mockInspection), mockInspection.issue.key);
  const coded = mockInspection.flows[0].nodes.find(node => node.code?.length && node.findings?.length);
  assert.ok(coded?.code && coded.findings);
  const node = result.flows[0].nodes.find(node => node.id === coded.id);
  assert.equal(result.version, 1);
  assert.equal(node?.subheader, coded.description);
  assert.deepEqual(node?.content[0], { format: 'legacyCode', blocks: coded.code });
  assert.deepEqual(node?.content[1], { format: 'legacyFinding', finding: coded.findings[0] });
});

test('validation reports malformed optional fields and broken references without partially importing', () => {
  assert.throws(() => parseInspection('{'), /not valid JSON/);
  assert.throws(() => parseInspection('null'), /must be an object/);
  assert.throws(() => parseInspection('{"version":3}'), /Unsupported FlowLens analysis version/);
  assert.throws(() => parseInspection(JSON.stringify(investigation()), 'FL-99'), /belongs to FL-42/);

  const document = investigation();
  const [flow, other] = document.flows;
  flow.nodes[0].impacts![0].nodeId = other.id;
  assert.throws(() => parseInspection(JSON.stringify(document)), /impacts\[0\]\.nodeId refers to missing node/);
  flow.nodes[0].impacts = undefined;
  flow.nodes[0].source = { file: 'audio.ts', startLine: 17, endLine: 16 };
  assert.throws(() => parseInspection(JSON.stringify(document)), /source\.endLine/);
  flow.nodes[0].source = undefined;
  const missingText = JSON.stringify(document).replace('"text":"The selected device is connected."', '"unknown":true');
  assert.throws(() => parseInspection(missingText), /content\[0\]\.text is required/);
  flow.edges[0].target = 'unknown';
  assert.throws(() => parseInspection(JSON.stringify(document)), /Invalid edge/);
});

test('v1 and v2 contracts stay distinct and reject unknown structural keys', () => {
  const v1 = { ...mockInspection, version: 2 };
  assert.throws(() => parseInspection(JSON.stringify(v1)), /description is not allowed/);
  const v2 = { ...investigation(), version: 1 };
  assert.throws(() => parseInspection(JSON.stringify(v2)), /repository is required/);
  const withUnknownKey = JSON.stringify(investigation()).replace('"version":2', '"version":2,"toString":null');
  assert.throws(() => parseInspection(withUnknownKey), /toString is not allowed/);
});

test('additive imports preserve provenance and per-file IDs even when names and IDs repeat', () => {
  const first = parseInspection(JSON.stringify(investigation()));
  const existing = appendFlows([], first, 1);
  const original = investigation();
  original.flows[1].name = original.flows[0].name;
  const second = parseInspection(JSON.stringify(original));
  const flows = appendFlows(existing, second, 3);
  assert.deepEqual(flows.map(entry => entry.key), [1, 2, 3, 4]);
  assert.deepEqual(flows.map(({ flow }) => flow.name), ['Audio playback', 'Cleanup', 'Audio playback (0)', 'Audio playback (1)']);
  assert.equal(flows[0], existing[0]);
  assert.equal(flows[2].flow.id, 'playback');
  assert.deepEqual(flows[2].flow.nodes, second.flows[0].nodes);
  assert.deepEqual(flows[2].analysis, original.analysis);
});

test('custom selection is optional, persists when available, and removal restores the foundation', () => {
  const first = createInstruction('one', 'Audio focus', 'Prioritize playback devices.');
  const second = createInstruction('two', 'Test focus', 'Include device-switch scenarios.');
  const both = { custom: [first, second], selectedId: 'two' };
  assert.equal(activeInstruction(both)?.name, 'Test focus');
  assert.equal(activeInstruction({ ...both, selectedId: 'one' })?.name, 'Audio focus');
  assert.equal(activeInstruction({ ...both, selectedId: '' }), undefined);
  const loaded = loadInstructions({ getItem: () => JSON.stringify(both) }, 'test');
  assert.deepEqual(loaded, both);
  const removed = removeInstruction(loaded, 'two');
  assert.equal(activeInstruction(removed), undefined);
  assert.equal(removed.custom[0].id, 'one');
  assert.equal(buildGeneralContext(activeInstruction(removed)?.text), buildGeneralContext());
  assert.throws(() => createInstruction('bad', 'Blank', ' '), /plain text/);
  assert.throws(() => createInstruction('large', 'Large', 'é'.repeat(17000)), /32 KiB/);
  assert.deepEqual(loadInstructions({ getItem: () => '[' }, 'test'), defaultInstructions);
});

test('selected instructions extend the foundation identically for Copy and Package with the v2 schema', async () => {
  const custom = '# Playback focus\nInclude the default-device switch.';
  const materials = buildInspectionMaterials({ issueId: '42', key: 'FL-42', title: 'Audio playback' }, JSON.stringify(schema), custom);
  const zip = buildInspectionPackage(materials).archive;
  const packageFiles = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  const decoder = new TextDecoder();
  const clipboard = buildCopyContext(materials);
  assert.ok(materials.instruction.startsWith(buildGeneralContext()));
  assert.match(clipboard, /### Playback focus\nInclude the default-device switch\./);
  assert.match(clipboard, /Produce a complete downloadable flowlens-analysis\.json with version 2/);
  assert.equal(decoder.decode(packageFiles['instruction.md']), materials.instruction);
  assert.deepEqual(JSON.parse(decoder.decode(packageFiles['flowlens.schema.json'])), schema);
  assert.equal(JSON.parse(decoder.decode(packageFiles['manifest.json'])).instructionVersion, 2);
});
