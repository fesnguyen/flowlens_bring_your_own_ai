# Analysis Import Pipeline — Implementation Specification

**Status:** Proposed.  
**Parents:** `../features/ANALYSIS_SCHEMA.md`, `DATA_STORAGE.md`, `JSON_SCHEMA_VALIDATION.md`

## Sequence

```text
User selects flowlens-analysis.json
  → client size/type check
  → parse JSON
  → resolver verifies Jira context and access
  → structural and semantic validation
  → calculate new persistent IDs and unique names
  → remap within-batch suggested-flow references
  → persist safely (all accepted or none)
  → return imported IDs, names, renames
  → refresh sidebar and select imported flow
```

The client may prevalidate for immediate feedback, but the resolver must validate again. Never trust a client-side validation result.

## Rules

- Every successful import **adds** flows; never overwrite existing flows.
- Duplicate names, including duplicates in the same file, get the next free `(0)`, `(1)` suffix.
- Persisted IDs differ from AI-imported IDs and remain stable.
- Remap `basedOnFlowId` when its original target is in the same batch.
- Reject incompatible versions and wrong Jira issue identity.
- Existing flows remain untouched on validation/storage failure.

## Atomicity and concurrency

Name allocation and index updates must be safe under concurrent imports. Select a Forge-supported transaction/conditional-write or recovery mechanism after verifying platform capabilities. Do not assume a multi-key transaction exists. If true all-or-nothing persistence cannot be guaranteed, design an explicit staging/commit protocol and test crash recovery before release.

## Error UI

Show issue-level errors and precise schema paths. Example: `flows[0].nodes[2].code[1].lines[0] must be [number, string]`. Include a Copy Validation Report action so the user can ask their AI to regenerate the file. Avoid silently fixing broken relationships or missing evidence.

## Acceptance tests

Single/multiple flows, repeated file, duplicate names, same-batch duplicates, suggestion remapping, invalid references, wrong issue, oversized payload, concurrent imports, storage failure, and refresh/reload. Assert no existing data loss in every failure case.
