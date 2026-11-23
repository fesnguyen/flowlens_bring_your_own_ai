// Versioned analysis shapes and the shared viewer model.
export type SourceRange = { file: string; startLine: number; endLine: number };
export type SourceLocation = SourceRange & { symbol: string };
export type CodeLine = [number, string];
export type CodeBlock =
  | { lines: CodeLine[] }
  | { omitted: { startLine: number; endLine: number; summary: string } };

export type Finding = {
  id: string;
  title: string;
  status: 'suspected' | 'supported' | 'confirmed';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  explanation: string;
  evidence: SourceRange[];
  suggestion?: string;
};

export type LegacyNode = {
  id: string;
  kind: 'start' | 'end' | 'operation' | 'decision' | 'retry' | 'error';
  title: string;
  description: string;
  source?: SourceLocation;
  code?: CodeBlock[];
  findings?: Finding[];
};

export type SourceReference = { file: string; symbol?: string; startLine?: number; endLine?: number };

export type ContentBlock = {
  type: string;
  text: string;
  title?: string;
  status?: string;
  source?: SourceReference;
};

export type Impact = {
  nodeId: string;
  relationship: string;
  consequence: string;
  reason: string;
  verification?: string;
  status?: 'hypothesis' | 'supported' | 'uncertain';
  evidence?: string;
};

export type InvestigationNode = {
  id: string;
  title: string;
  kind?: string;
  sequence?: number;
  subheader?: string;
  source?: SourceReference;
  content?: ContentBlock[];
  impacts?: Impact[];
};

// Legacy blocks keep numbered snippets, omissions, and finding evidence intact.
export type DisplayBlock =
  | { format: 'content'; block: ContentBlock }
  | { format: 'legacyCode'; blocks: CodeBlock[] }
  | { format: 'legacyFinding'; finding: Finding };

export type InspectionNode = Omit<InvestigationNode, 'content'> & { content: DisplayBlock[] };

export const conclusionLabels = {
  inconclusive: 'Inconclusive',
  potential_issues: 'Potential issues',
  likely_root_cause: 'Likely root cause',
  confirmed_mismatch: 'Confirmed mismatch',
} as const;

export type Flow<Node = InspectionNode> = {
  id: string;
  name: string;
  type: 'original' | 'suggestion';
  description: string;
  entryNodeIds: string[];
  nodes: Node[];
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

type Analysis<Node, Version extends number, Provenance> = {
  version: Version;
  issue: { key: string };
  analysis: Provenance;
  flows: Flow<Node>[];
};

export type AnalysisProvenance = { repository?: string; revision?: string; summary: string };
export type LegacyInspection = Analysis<LegacyNode, 1, Required<AnalysisProvenance>>;
export type Investigation = Analysis<InvestigationNode, 2, AnalysisProvenance>;
export type Inspection = Analysis<InspectionNode, 1 | 2, AnalysisProvenance>;

/** Adapt both file versions once, keeping wire-format differences out of the viewer. */
export function toInspection(analysis: LegacyInspection | Investigation): Inspection {
  if (analysis.version === 2) {
    return {
      ...analysis,
      flows: analysis.flows.map(flow => ({
        ...flow,
        nodes: flow.nodes.map(({ content = [], ...node }) => ({
          ...node,
          content: content.map(block => ({ format: 'content', block })),
        })),
      })),
    };
  }
  return {
    ...analysis,
    flows: analysis.flows.map(flow => ({
      ...flow,
      nodes: flow.nodes.map(({ description, code, findings, ...node }) => {
        const content: DisplayBlock[] = [];
        if (code?.length) content.push({ format: 'legacyCode', blocks: code });
        findings?.forEach(finding => content.push({ format: 'legacyFinding', finding }));
        return { ...node, subheader: description, content };
      }),
    })),
  };
}
