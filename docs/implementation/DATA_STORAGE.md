# Data Storage — Implementation Design

**Status:** Proposed; verify against Forge storage limits before coding.  
**Parents:** `../FORGE_ARCHITECTURE.md`, `../features/ANALYSIS_SCHEMA.md`

## Purpose and boundary

FlowLens does not need a relational database in the MVP. The planned database is **Forge Key-Value Store**. A Jira issue owns a flat list of independently managed imported flows. These are logical JSON records, not SQL tables or enforced foreign keys.

## Logical records

| Record | Fields | Responsibility |
|---|---|---|
| **IssueFlows** | `tenantId`, `issueId`, `flowIds[]`, `updatedAt`, `revision` | Small directory of flow IDs and their display order for one Jira issue |
| **Flow** | `id`, `tenantId`, `issueId`, `name`, `type`, `basedOnFlowId?`, `analysisId`, `createdAt`, `flow` | Independently retrievable execution graph, code evidence, and findings |
| **Analysis** | `id`, `tenantId`, `issueId`, `repository?`, `revision?`, `summary`, `createdAt` | Provenance of one imported AI investigation, potentially containing multiple flows |

`IssueFlows` is **an index**, not a container of full flow payloads. `Analysis` records import provenance, not a second copy of all imported flow data. `Flow.analysisId` links to the originating `Analysis` record; application logic maintains that reference.

Use stable Jira **issue ID**, not issue key, for association. Derive tenant identity from trusted Forge context; never trust browser-supplied tenant or issue identity without checking access.

## Candidate key layout

```text
issue:{tenantId}:{issueId}:flows
issue:{tenantId}:{issueId}:flow:{flowId}
issue:{tenantId}:{issueId}:analysis:{analysisId}
```

Keys are illustrative. Verify key length, query/list, and storage capabilities before implementation. If queryable storage makes the issue index unnecessary, consider removing `IssueFlows` rather than maintaining redundant data.

## Example: additive import

Before import, Jira issue SHOP-142 contains `Checkout Processing` and `Payment Retry`. A new AI analysis includes `Checkout Processing` and `Webhook Handling`.

After import, the issue contains **four independent flows**:

```text
SHOP-142
├── Checkout Processing          (existing, unchanged)
├── Payment Retry                (existing, unchanged)
├── Checkout Processing (0)      (new, renamed to avoid collision)
└── Webhook Handling             (new)
```

**Import adds new flows to the issue's list; it never appends new nodes/edges into an existing flow graph.** Matching names do not imply equivalent execution behavior, repository revision, or evidence. There is no automatic merge or replacement in the MVP. Users may delete an outdated flow explicitly.

One imported JSON file produces one `Analysis` provenance record and one `Flow` record per imported flow. Each new `Flow` points to that `Analysis`.

## Import algorithm and invariants

1. Authorize current issue and validate JSON **before** writing.
2. Read existing flow names and IDs for this issue.
3. Allocate new persistent flow IDs, independent of imported IDs, and a new analysis ID.
4. Assign unique names, suffixing collisions `(0)`, `(1)`, etc., including collisions within the same batch.
5. Remap `basedOnFlowId` when it points to another flow in the batch; reject or explicitly resolve ambiguous external references.
6. Persist the new `Analysis` and `Flow` records and update `IssueFlows` safely.
7. Return accepted flows, names, and any rename notices.

**Never silently overwrite, merge, or replace existing flows.** If any step fails, existing flows must remain intact. Determine Forge transaction/conditional-write support before choosing an atomic batch strategy; otherwise implement a recoverable import protocol and cleanup of orphaned records. Concurrent imports must not lose index updates or generate duplicate names.

## Delete

Delete only the selected `Flow` and remove its ID from `IssueFlows`. Preserve other flows. Define how suggestion references behave if the referenced original flow is deleted. An `Analysis` may be retained for provenance or removed when no flows reference it; choose and test a consistent retention policy.

## Size and performance

Estimate payload sizes with realistic code snippets and multiple flows. Confirm current Forge per-value limits, quotas, read/write cost, and request limits from official docs before implementation. Chunk large payloads or use another supported storage mechanism if needed; never silently truncate evidence.

## Security and tests

Authorize issue access on every read/write/delete. Render imported content as inert text. Tests: cross-issue isolation; additive and repeated imports; duplicate-name suffixes; concurrent imports; partial failure recovery; orphan cleanup; individual deletion; large flow roundtrip; issue rename; malformed IDs.

## Open decisions

Storage transaction strategy, whether `IssueFlows` index is needed, `Analysis` retention, and maximum supported file size require implementation-time verification.
