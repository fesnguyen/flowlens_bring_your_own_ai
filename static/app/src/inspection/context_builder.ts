
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

/**
 * General inspection instructions in execution order.
 *
 * Each section owns its content. The builder is responsible only
 * for assembling the sections into a single instruction document.
 */
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

/** Build the foundation first and append the selected preferences for either export action. */
export function buildGeneralContext(customInstruction?: string): string {
  const preferences = customInstruction?.trim();
  if (!preferences) return sections.join('\n\n');
  return [...sections, '# Custom Investigation Preferences', preferences].join('\n\n');
}

/**
 * The three independent documents required for inspection.
 *
 * Keeping them separate allows clipboard and ZIP export to
 * present the same information in different formats.
 */
export type InspectionMaterials = {
  issueKey: string;
  instruction: string;
  issue: string;
  schema: string;
};

/**
 * Prepare inspection materials from Jira issue data.
 *
 * Validate the JSON Schema before exposing it to either
 * clipboard or ZIP export. Do not modify the schema content.
 */
export function buildInspectionMaterials(
  issue: InspectionIssueContext,
  schemaText: string,
  customInstruction?: string,
): InspectionMaterials {
  let parsed: unknown;

  try {
    parsed = JSON.parse(schemaText);
  } catch {
    throw new Error('Invalid FlowLens JSON Schema.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid FlowLens JSON Schema.');
  }

  return {
    issueKey: issue.key,
    instruction: buildGeneralContext(customInstruction),
    issue: renderIssueContext(issue),
    schema: schemaText,
  };
}

/**
 * Nest Markdown headings beneath their parent section.
 *
 * Example:
 *   # Role       -> ### Role
 *   ## Details   -> #### Details
 *
 * The transformation applies only to Markdown heading lines.
 * It does not change the original inspection materials.
 */
function nestHeadings(content: string, levels = 2): string {
  return content.replace(
    /^(#{1,6})([ \t]+)/gm,
    (_, hashes: string, spacing: string) =>
      `${'#'.repeat(Math.min(hashes.length + levels, 6))}${spacing}`,
  );
}

/**
 * Remove a document's existing H1 title when embedding it
 * beneath a parent heading.
 *
 * For example, renderIssueContext() already produces:
 *   # Jira Issue Context
 *
 * The clipboard document supplies that heading itself, so
 * retaining the original would create a duplicate title.
 */
function removeDocumentTitle(content: string): string {
  return content.replace(/^# [^\r\n]+(?:\r?\n)+/, '');
}

/**
 * Wrap JSON in a safe Markdown code fence.
 *
 * A fixed triple-backtick fence can break when the JSON
 * contains backticks. Choose a fence longer than any
 * consecutive backtick sequence in the content.
 *
 * This preserves the JSON exactly and allows Markdown
 * viewers to apply JSON syntax highlighting.
 */
function formatJsonCodeBlock(json: string): string {
  const backtickRuns = json.match(/`+/g) ?? [];

  const longestRun = backtickRuns.reduce(
    (longest, run) => Math.max(longest, run.length),
    0,
  );

  const fence = '`'.repeat(Math.max(3, longestRun + 1));

  return [
    `${fence}json`,
    json,
    fence,
  ].join('\n');
}

/**
 * Build the complete Markdown document for Copy Inspection Prompt.
 *
 * Document hierarchy:
 *
 * # FlowLens Inspection Request
 *   ## General Inspection Instruction
 *      ### Individual instruction sections
 *   ## Jira Issue Context
 *      ### Issue fields
 *   ## Required Output JSON Schema
 *      JSON code block
 *
 * Only presentation changes here. The original instruction,
 * Jira issue document, and schema remain available unchanged
 * for Export Inspection Package.
 */
export function buildCopyContext(materials: InspectionMaterials): string {
  // 1. Place the reusable instructions beneath their H2 heading.
  const instruction = nestHeadings(materials.instruction);

  // 2. Remove the issue document's H1 and nest its field headings.
  const issue = nestHeadings(removeDocumentTitle(materials.issue), 1);

  // 3. Format the schema as a fenced JSON block.
  const schema = formatJsonCodeBlock(materials.schema);

  // 4. Assemble the final clipboard document in reading order.
  return [
    '# FlowLens Inspection Request',
    '## General Inspection Instruction',
    instruction,
    '## Jira Issue Context',
    issue,
    '## Required Output JSON Schema',
    'The following JSON is the authoritative output contract:',
    schema,
  ].join('\n\n');
}
