import type { AnalysisProvenance, Flow, Inspection } from '../inspection';

export type ListedFlow = {
  key: number;
  flow: Flow;
  analysis: AnalysisProvenance;
  issueKey: string;
};

/** Keep each import independent. Local list keys leave AI IDs and references intact. */
export function appendFlows(existing: ListedFlow[], inspection: Inspection, nextKey: number): ListedFlow[] {
  const names = new Set(existing.map(({ flow }) => flow.name));
  const added = inspection.flows.map((flow, index) => {
    let name = flow.name;
    for (let suffix = 0; names.has(name); suffix++) name = `${flow.name} (${suffix})`;
    names.add(name);
    return {
      key: nextKey + index,
      flow: { ...flow, name },
      analysis: inspection.analysis,
      issueKey: inspection.issue.key,
    };
  });
  return [...existing, ...added];
}

/** Highlight only targets declared by the selected node's impact assessment. */
export function impactTargets(flow: Flow, selectedId?: string): Set<string> {
  const selected = flow.nodes.find(node => node.id === selectedId);
  return new Set(selected?.impacts?.map(impact => impact.nodeId));
}
