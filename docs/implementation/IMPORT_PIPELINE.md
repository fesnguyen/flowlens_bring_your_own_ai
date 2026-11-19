# Analysis Import Pipeline — Implementation Specification

**Status:** Proposed.  
**Parents:** `../features/ANALYSIS_SCHEMA.md`, `DATA_STORAGE.md`, `JSON_SCHEMA_VALIDATION.md`

## Scope and neighboring operations

This pipeline handles **Import JSON**: an external AI-produced `flowlens-analysis.json` becomes saved flows. It does **not** build the Copy Inspection Prompt or Export Inspection Package; those actions use `INSPECTION_TEMPLATE.md`. A separate future **Export Flows as JSON** operation reads saved flows, reconstructs a schema-compatible analysis document (including issue and analysis provenance), maps persistent IDs to export IDs, validates it, and downloads JSON. It does not produce the inspection ZIP or include attachments.

## Sequence

```text
User selects flowlens-analysis.json
  → client size/type check
  → parse JSON
  → resolver verifies Jira context and access
  → structural and semantic validation
  → read existing IssueFlows / names
  → allocate new Flow IDs and an Analysis ID
  → resolve duplicate names and remap suggested-flow references
  → persist new Analysis + Flow records and update IssueFlows safely
  → return imported IDs, names, renames
  → refresh sidebar and select a newly imported Flow
```

The client may prevalidate for immediate feedback, but the resolver must validate again. Never trust a client-side validation result.

## Additive import contract

**Every successful import adds independent flows to the Jira issue.** It does not merge imported nodes/edges into an existing diagram, and does not overwrite or replace a same-named flow. A future replacement feature would require a separate explicit user action; it is out of MVP scope.

For example, if `Checkout Processing` exists, importing another `Checkout Processing` creates `Checkout Processing (0)`. Additional collisions receive `(1)`, `(2)`, etc. The suffix allocator must choose the next free name even when the imported file itself repeats a name.

One imported file creates one `Analysis` record (investigation provenance) and one `Flow` record per imported flow; each `Flow.analysisId` points to its `Analysis`. `IssueFlows` tracks the resulting ordered flow IDs.

## Rules

- Persisted flow IDs differ from AI-imported IDs and remain stable.
- Remap `basedOnFlowId` when its original target is in the same batch.
- Reject incompatible versions and wrong Jira issue identity.
- Existing flows remain untouched on validation/storage failure.
- Never silently merge two flows, even when names match.

## Atomicity and concurrency

Name allocation and index updates must be safe under concurrent imports. Select a Forge-supported transaction/conditional-write or recovery mechanism after verifying platform capabilities. Do not assume a multi-key transaction exists. If true all-or-nothing persistence cannot be guaranteed, design an explicit staging/commit protocol and test crash recovery before release.

## Error UI

Show issue-level errors and precise schema paths. Example: `flows[0].nodes[2].code[1].lines[0] must be [number, string]`. Include a Copy Validation Report action so the user can ask their AI to regenerate the file. Avoid silently fixing broken relationships or missing evidence.

## Acceptance tests

Single/multiple flows, repeated file, same-name import, same-batch duplicates, suggestion remapping, invalid references, wrong issue, oversized payload, concurrent imports, storage failure, and refresh/reload. Assert existing flows and their nodes/edges are unchanged after every import.
