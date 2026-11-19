# Inspection Template — Implementation Specification

**Status:** Proposed; implementation pending  
**Parent:** `../features/INSPECTION_PROMPT.md`

## 1. Implementation overview

```text
                        versioned instruction.md
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

**Critical invariant:** The bytes/text of the general instruction are **identical** for Copy and Package, independent of the Jira issue. Do not interpolate issue fields or schema into the stored instruction asset. Compose separate sections only at delivery time.

## 2. Source assets and ownership

| Asset | Source | Rule |
|---|---|---|
| General instruction | Nine versioned TypeScript sections in `static/app/src/inspection/context/` | Assembled in a fixed order by `context_builder.ts`; no issue-specific placeholders |
| Jira issue content | Forge resolver fetches permitted Jira issue fields | Normalize to a separate Markdown document |
| JSON Schema | One versioned `flowlens.schema.json` | Import and both output actions use the exact same schema |
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

This is a normalized internal type, **not** the raw Jira API response. Read the current issue from trusted Forge context and verify access on the resolver. Fetch summary, type, status, priority, description and relevant explicitly configured fields as available. Convert Atlassian Document Format (rich text) to readable Markdown/plain text, preserving lists, links and code. Do not guess acceptance criteria or include private fields without authorization. Render missing optional values consistently as unavailable or omit them.

Treat all issue text as untrusted data. Delimit it clearly from the instruction so a malicious-looking description cannot masquerade as the instruction. Avoid HTML injection and accidental Markdown fence termination.

## 4. Shared rendering API

Suggested pure functions (names are illustrative, not required):

```ts
buildGeneralContext(): string
getAnalysisSchemaText(): string
renderIssueContext(context: InspectionIssueContext): string
buildCopyContext(materials: InspectionMaterials): string
buildInspectionPackage(materials: InspectionMaterials, attachments: InspectionAttachment[]): Blob
```

Do not independently reconstruct instruction text in these functions. Prefer a shared module that can run in the chosen browser/Forge environment; avoid importing Node-only libraries into the Custom UI. Load or bundle schema text without changing its content.

**Clipboard payload order:**

```text
# FlowLens Inspection Request

## General Inspection Instruction
<exact unchanged instruction.md>

## Jira Issue Context
<rendered issue.md>

## Required Output JSON Schema
```json
<exact flowlens.schema.json>
```
```

The outer section labels are assembly formatting, **not changes to the instruction itself**. Ensure JSON code fences cannot be broken by untrusted issue text.

## 5. Copy button — execution flow

```text
Header: Copy Inspection Prompt
  → disable/reject duplicate click while loading
  → request authorized current issue context
  → normalize Jira fields and render issue.md
  → load shared instruction + schema
  → buildCopyPrompt(...)
  → clipboard writeText(...)
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

Manifest should contain issue key, instruction/schema version identifiers, creation time, attachment entries with original name, packaged name, status (`included`, `excluded`, `failed`), and reason where relevant. Sanitize path separators, traversal sequences and duplicate filenames; do not include secrets or unauthorized content. If no attachments exist, include an empty manifest list.

Avoid downloading all attachment bytes before checking sizes. Stream or bound memory usage where feasible; document limits and warn on skipped/failed files. Image optimization is optional and must not destroy readable evidence. Verify Forge scopes, Jira API limits, and attachment permissions during implementation; do not assume they are available.

## 7. Export Flows as JSON — separate operation

**Not part of either inspection-request button.** When implemented, load authorized saved flows, convert persisted IDs to schema-valid export IDs, preserve node references and suggestion links, attach required issue/analysis metadata, validate the export, and download a JSON file. See `IMPORT_PIPELINE.md` and `FORGE_API_CONTRACTS.md`. Do not include saved flows in the inspection ZIP.

## 8. Error handling and tests

- No issue context / unauthorized: show error; never copy a fabricated sample issue.
- Partial Jira fields: include available data and mark missing values.
- Clipboard blocked: selectable text fallback.
- Attachment failures: continue only with explicit manifest warnings; no silent omission.
- Schema unavailable: fail both actions rather than emit an incomplete contract.
- Snapshot the exact instruction section in Copy and ZIP and assert byte-for-byte equality.
- Test complete/missing fields, ADF lists/links/code, multiline content, untrusted prompt-like issue text, Unicode, duplicate attachment names, oversized packages, denied attachment access, and clipboard failure.
- Verify ZIP schema bytes equal the authoritative schema and clipboard schema content parses identically.

## Current source layout (initial implementation)

- `static/app/src/inspection/context/*.ts` — nine reusable, issue-independent investigation sections.
- `static/app/src/inspection/context_builder.ts` — ordered union, materials and clipboard assembly.
- `static/app/src/inspection/issue_context.ts` — normalized Jira fields and safe rendering.
- `static/app/src/inspection/package_builder.ts` — browser ZIP assembler with attachment manifest and size bounds.
- `shared/flowlens.schema.json` — initial machine-readable v1 contract.

The ZIP `instruction.md` is generated from the assembled sections; it is **not** a separate maintained source file. The context builder currently accepts already normalized issue fields and attachment bytes; Jira API retrieval and UI button wiring remain separate future integration work. The initial schema still requires structural and semantic validation implementation and review before production use.
