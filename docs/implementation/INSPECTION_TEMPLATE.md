# Inspection Template — Implementation Specification

**Status:** Proposed; implementation pending.  
**Parent:** `../features/INSPECTION_PROMPT.md`

## Single source of truth

Maintain one versioned Markdown inspection template, with structured issue context injected into named placeholders. Do not duplicate prompt text in React, Forge resolver, and ZIP exporter. Include the **same machine-readable JSON Schema** in both output modes: inline for Copy, separate `flowlens.schema.json` in ZIP.

## Inputs

```ts
type InspectionIssueContext = {
  issueId: string;
  key: string;
  title: string;
  type?: string;
  status?: string;
  priority?: string;
  description?: string;
  acceptanceCriteria?: string;
  additionalContext?: string;
};
```

This is a proposed normalized internal type, not an existing Jira API response. Convert Jira rich-text descriptions to readable Markdown/plain text, preserving meaningful lists and links. Do not infer acceptance criteria when not explicitly available. Escape or delimit issue content so it cannot accidentally replace template instructions.

## Template sections in output order

1. Role and boundary: investigate/document, **do not modify code**.
2. Jira context and missing-field policy.
3. Scope selection: primary path, relevant failure/alternative paths, related async/retry processes; **one flow with branches** preferred where appropriate.
4. Repository tracing and no-invention rules.
5. Original source evidence: numbered tuples, omitted ranges and summaries, code comments.
6. Findings, uncertainty, conclusions, optional proposed flows.
7. JSON output filename, authoritative schema, semantic validation checklist.
8. Deliverable: complete file plus short summary/limitations.

The content contract is defined in `../features/INSPECTION_PROMPT.md`; do not independently rewrite the investigation rules here.

## Rendering API proposal

```ts
buildInspectionMarkdown(context, schemaText): string
buildInspectionPackage(context, schemaText, attachments): Promise<Blob>
```

Use a deterministic template renderer; no arbitrary JavaScript execution. Include a template/schema version marker for debugging.

## Copy action

Retrieve current Jira context, generate Markdown with inline schema, copy to clipboard, and show success/failure. Do not include attachments. Handle missing clipboard permissions with a user-selectable fallback.

## ZIP action

Generate `inspection.md` (same core instructions and context), `flowlens.schema.json`, and permitted attachments with safe filenames. Provide an attachment manifest listing included, excluded, or failed files and reasons. Enforce a package size limit before buffering large files; warn about missing or inaccessible attachments. Optimize images only when evidence remains legible.

## Template tests

Snapshot representative output for a complete issue, missing fields, multiline Jira rich text, special characters, long descriptions, and malicious-looking text embedded in an issue. Verify Copy and ZIP use identical core instructions and schema version.
