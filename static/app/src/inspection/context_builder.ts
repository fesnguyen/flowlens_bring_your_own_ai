import { roleContext } from './context/role';
import { issueAnalysisContext } from './context/issue_analysis';
import { repositoryInvestigationContext } from './context/repository_investigation';
import { executionFlowsContext } from './context/execution_flows';
import { problemDetectionContext } from './context/problem_detection';
import { recommendationsContext } from './context/recommendations';
import { evidenceRulesContext } from './context/evidence_rules';
import { uiGuidanceContext } from './context/ui_guidance';
import { outputRulesContext } from './context/output_rules';
import { renderIssueContext, type InspectionIssueContext } from './issue_context';

/** Order matters: guide the investigation before describing the final output. */
const sections = [
  roleContext,
  issueAnalysisContext,
  repositoryInvestigationContext,
  executionFlowsContext,
  problemDetectionContext,
  recommendationsContext,
  evidenceRulesContext,
  uiGuidanceContext,
  outputRulesContext,
] as const;

/** Identical general instruction used for clipboard and ZIP. */
export function buildGeneralContext(): string {
  return sections.join('\n\n');
}

export type InspectionMaterials = {
  issueKey: string;
  instruction: string;
  issue: string;
  schema: string;
};

export function buildInspectionMaterials(
  issue: InspectionIssueContext,
  schemaText: string,
): InspectionMaterials {
  let parsed: unknown;
  try { parsed = JSON.parse(schemaText); } catch { throw new Error('Invalid FlowLens JSON Schema.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid FlowLens JSON Schema.');
  }
  return {
    issueKey: issue.key,
    instruction: buildGeneralContext(),
    issue: renderIssueContext(issue),
    schema: schemaText,
  };
}

/** Copy assembles the three independent inputs without altering any of them. */
export function buildCopyContext(materials: InspectionMaterials): string {
  return [
    '# FlowLens Inspection Request',
    '## General Inspection Instruction',
    materials.instruction,
    '## Jira Issue Context',
    materials.issue,
    '## Required Output JSON Schema',
    'The following JSON is the authoritative output contract:',
    // Indentation prevents a JSON string containing backticks from closing a fence.
    materials.schema.split('\n').map(line => `    ${line}`).join('\n'),
  ].join('\n\n');
}
