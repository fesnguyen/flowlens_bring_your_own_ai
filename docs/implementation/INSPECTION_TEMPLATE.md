# Inspection Template — Implementation Specification

**Status:** Copy, Package and custom instruction selection implemented
**Parent:** `../features/INSPECTION_PROMPT.md`

## 1. Implementation overview

```text
                     foundation + selected preferences
                                  │
              ┌───────────────────┼──────────────────┐
              │                   │                  │
         Jira issue fields   flowlens.schema.json   Jira attachments
              │                   │                  │
              ├──── Copy ─────────┤                  │
              │                   │                  │
              ▼                   ▼                  │
        Markdown sections → Clipboard               │
              │                   │                  │
              └──── Package ──────┴──────────────────┘
                                  ▼
                 ZIP: instruction.md, issue.md,
                 flowlens.schema.json, manifest.json,
                 attachments/
```

Copy and Package share one assembled instruction. Copy nests its headings for the clipboard document. Package preserves the assembled Markdown as a separate file. Issue fields and schema are separate inputs.

## 2. Source assets and ownership

| Asset | Source | Rule |
|---|---|---|
| General instruction | Nine versioned TypeScript sections in `static/app/src/inspection/context/` | Assembled in a fixed order by `context_builder.ts`, followed by optional custom preferences |
| Jira issue content | Forge resolver fetches permitted Jira issue fields | Normalize to a separate Markdown document |
| JSON Schema | Versioned `flowlens.schema.json` | Both outputs deliver v2. The importer validates against the schema for the version in the file. |
| Attachments | Authorized Jira attachment metadata and bytes | Package only; never clipboard |
| Manifest | Generated package metadata | Track attachments included/excluded/failed and reasons |

The feature document specifies **what** the AI must do. This implementation document specifies **how** to assemble the instruction and inputs; do not maintain a second hand-written instruction inside React or resolver source.

## 3. Jira issue context contract

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

This is a normalized internal type, **not** the raw Jira API response. Read the current issue from trusted Forge context and verify access on the resolver. Fetch summary, type, status, priority and description from Jira REST v3. Include a visible custom field named Acceptance Criteria when its name resolves to exactly one field and the current issue supplies a value. Convert Atlassian Document Format (rich text) to readable Markdown/plain text, preserving lists, links and code. Do not guess acceptance criteria or include private fields without authorization. Render missing optional values consistently as unavailable or omit them.

Treat all issue text as untrusted data. Delimit it clearly from the instruction so a malicious-looking description cannot masquerade as the instruction. Avoid HTML injection and accidental Markdown fence termination.

## 4. Shared rendering API

The assembly functions use the same instruction and schema for both actions.

```ts
buildGeneralContext(customInstruction?: string): string
renderIssueContext(context: InspectionIssueContext): string
buildInspectionMaterials(issue: InspectionIssueContext, schemaText: string, customInstruction?: string): InspectionMaterials
buildCopyContext(materials: InspectionMaterials): string
buildInspectionPackage(materials, attachments, attachmentListingError?): { archive: Blob; skipped: number }
```

Do not independently reconstruct instruction text in these functions. Prefer a shared module that can run in the chosen browser/Forge environment; avoid importing Node-only libraries into the Custom UI. Load or bundle schema text without changing its content.

**Clipboard payload order:**

```text
# FlowLens Inspection Request

## General Inspection Instruction
<foundation and custom preferences with nested headings>

## Jira Issue Context
<rendered issue.md>

## Required Output JSON Schema
<complete flowlens.schema.json in a fenced code block>
```

Copy presents Jira field values as indented code blocks and encloses the schema in a JSON fence.

## 5. Copy button — execution flow

```text
Header: Copy Inspection Prompt
  → disable/reject duplicate click while loading
  → request authorized current issue context
  → normalize Jira fields and render issue.md
  → load shared instruction + schema
  → buildCopyContext(...)
  → clipboard write during the user gesture, with writeText as a retry
  → show success or actionable failure
```

The UI must not silently fall back to sample issue content. If clipboard permission is denied or unsupported, provide a selectable/copyable text fallback. Never include attachment bytes. Include loading, success, and failure feedback in both wide and compact headers.

## 6. Export Package button — execution flow

```text
Header: Export Inspection Package
  → request same authorized issue context
  → load identical instruction + schema
  → enumerate accessible attachment metadata
  → enforce file count, per-file and total size limits
  → retrieve permitted bytes, recording failures
  → assemble ZIP and manifest
  → initiate download and report exclusions
```

**ZIP structure:**

```text
flowlens-inspection-<issue-key>.zip
├── instruction.md
├── issue.md
├── flowlens.schema.json
├── manifest.json
└── attachments/
    └── <sanitized-filename>
```

The manifest includes the issue key, instruction version, schema ID, creation time, and attachment entries with the original filename, ZIP path, status (`included`, `excluded`, `failed`), and reason when relevant. An empty attachment list is valid. If Jira does not return the list, the manifest records that separately.

The limits are 3 MiB per attachment, 50 attachment download attempts, and 25 MiB for the complete ZIP. The browser checks metadata before downloading and fetches one attachment at a time. The resolver checks issue membership and response size before returning base64. The ZIP writer keeps the original permitted bytes using ZIP STORE. The header reports skipped files and offers a manual download link.

## 7. Export Flows as JSON — separate operation

**Not part of either inspection-request button.** When implemented, load authorized saved flows, convert persisted IDs to schema-valid export IDs, preserve node references and suggestion links, attach required issue/analysis metadata, validate the export, and download a JSON file. See `IMPORT_PIPELINE.md` and `FORGE_API_CONTRACTS.md`. Do not include saved flows in the inspection ZIP.

## 8. Error handling and tests

- No issue context / unauthorized: show error; never copy a fabricated sample issue.
- Partial Jira fields: include available data and mark missing values.
- Clipboard blocked: selectable text fallback.
- Attachment failures: continue only with explicit manifest warnings; no silent omission.
- Schema unavailable: fail both actions rather than emit an incomplete contract.
- Check that Copy and ZIP share the same assembled instruction and account for heading nesting in Copy.
- Test complete/missing fields, ADF lists/links/code, multiline content, untrusted prompt-like issue text, Unicode, duplicate attachment names, oversized packages, denied attachment access, and clipboard failure.
- Verify ZIP schema bytes equal the authoritative schema and clipboard schema content parses identically.

## Current source layout

- `static/app/src/inspection/context/*.ts` — nine reusable, issue-independent investigation sections.
- `static/app/src/inspection/context_builder.ts` — ordered union, materials and clipboard assembly.
- `static/app/src/inspection/issue_context.ts` — normalized Jira fields and safe rendering.
- `static/app/src/inspection/package_builder.ts` — browser ZIP assembler with attachment manifest and size bounds.
- `src/jira_inspection.ts` and `src/jira_rich_text.ts` — authorized Jira retrieval and rich-text conversion.
- `static/app/src/useInspectionActions.ts` — shared button flow, feedback, and browser delivery.
- `shared/flowlens.schema.json` — authoritative machine-readable v1 contract.

The ZIP `instruction.md` is generated from the assembled sections; it is **not** a separate maintained source file. Import validation is tracked in [JSON Schema and Validation](JSON_SCHEMA_VALIDATION.md).
