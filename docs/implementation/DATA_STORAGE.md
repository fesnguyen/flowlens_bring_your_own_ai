# Data Storage — Implementation Design

**Status:** Proposed; verify against Forge storage limits before coding.  
**Parents:** `../FORGE_ARCHITECTURE.md`, `../features/ANALYSIS_SCHEMA.md`

## Purpose and boundary

FlowLens does not need a relational database in the MVP. The planned database is **Forge Key-Value Store**. A Jira issue owns a flat list of independently managed imported flows. This is a logical data model, not a claim that Forge KVS supports SQL tables or transactions.

## Logical records

| Record | Fields | Purpose |
|---|---|---|
| IssueFlowIndex | `tenantId`, `issueId`, `flowIds[]`, `updatedAt`, `revision` | List and ordering of flows |
| StoredFlow | `id`, `tenantId`, `issueId`, `name`, `type`, `basedOnFlowId?`, `importId`, `createdAt`, `flow` | Independently retrievable flow and its original analysis payload |
| ImportMetadata | `id`, `tenantId`, `issueId`, `repository?`, `revision?`, `summary`, `createdAt` | Provenance for a batch |

Use stable Jira **issue ID**, not issue key, for association. Derive tenant identity from trusted Forge context; never trust browser-supplied tenant or issue identity without checking access.

## Candidate key layout

```text
issue:{tenantId}:{issueId}:index
issue:{tenantId}:{issueId}:flow:{storedFlowId}
issue:{tenantId}:{issueId}:import:{importId}
```

These are illustrative keys. Verify length, query/list, and storage capabilities before committing to the design. Consider index sharding or queryable entities if index size becomes a problem.

## Import algorithm and invariants

1. Authorize current issue and validate JSON **before** writing.
2. Read existing flow names and identifiers for this issue.
3. Allocate new storage IDs, independent of imported IDs.
4. Assign unique names, suffixing collisions `(0)`, `(1)`, etc., including collisions within the same batch.
5. Remap `basedOnFlowId` when it points to another flow in the batch; reject or explicitly resolve ambiguous external references.
6. Persist flow records and update the issue index.
7. Return the accepted flow list and any renamed names.

**Never silently overwrite existing flows.** If any step fails, existing flows must remain intact. Determine actual Forge transaction/conditional-write support before choosing an atomic batch strategy; otherwise implement a documented recoverable import protocol and cleanup of orphaned records. Concurrent imports must not generate duplicate names or lose index updates.

## Delete

Delete only the selected stored flow, update its index membership, and define how incoming suggestion references are displayed when the referenced original flow is deleted. Do not cascade-delete unrelated flows by default.

## Size and performance

Estimate realistic payload sizes with code snippets and multiple flows. Confirm current Forge per-value limits, quotas, read/write cost, and request limits from official docs before implementation. If necessary, chunk large flow payloads or choose a supported larger-object mechanism; do not silently truncate evidence.

## Security and tests

Authorize issue access on every read/write/delete. Render imported content as inert text. Tests: cross-issue isolation; repeated import; name collisions; concurrent imports; partial failure recovery; orphan cleanup; deletion; large flow roundtrip; issue rename; malformed IDs.

## Open decisions

Storage transaction strategy, issue index scaling, import provenance retention, and maximum supported file size require implementation-time verification.
