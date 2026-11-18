// The subset of the documented analysis contract used by the viewer.
export type SourceRange = { file: string; startLine: number; endLine: number };
export type SourceLocation = SourceRange & { symbol: string };
export type CodeLine = [number, string];
export type CodeBlock =
  | { lines: CodeLine[] }
  | { omitted: { startLine: number; endLine: number; summary: string } };

export type Finding = {
  id: string;
  title: string;
  status: string;
  explanation: string;
  evidence: SourceRange[];
  suggestion?: string;
};

export type InspectionNode = {
  id: string;
  kind: 'start' | 'end' | 'operation' | 'decision' | 'retry' | 'error';
  title: string;
  description: string;
  source?: SourceLocation;
  code?: CodeBlock[];
  findings?: Finding[];
};

export const conclusionLabels = {
  inconclusive: 'Inconclusive',
  potential_issues: 'Potential issues',
  likely_root_cause: 'Likely root cause',
  confirmed_mismatch: 'Confirmed mismatch',
} as const;

export type Flow = {
  id: string;
  name: string;
  type: 'original' | 'suggestion';
  description: string;
  entryNodeIds: string[];
  nodes: InspectionNode[];
  edges: {
    source: string;
    target: string;
    label?: string;
    kind?: 'branch' | 'retry' | 'async';
  }[];
  basedOnFlowId?: string;
  conclusion?: {
    level: keyof typeof conclusionLabels;
    summary: string;
    evidence: { nodeId: string }[];
    remainingQuestions?: string[];
  };
};

export type Inspection = {
  version: 1;
  issue: { key: string };
  analysis: { repository: string; revision: string; summary: string };
  flows: Flow[];
};
