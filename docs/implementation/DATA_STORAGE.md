# Data Storage

**Status:** Implemented with Forge Custom Entity Store.
**Parents:** [Forge Architecture](../FORGE_ARCHITECTURE.md), [Analysis Schema](../features/ANALYSIS_SCHEMA.md)

## Ownership and records

Forge partitions storage by app installation and environment. The resolver also namespaces records using the trusted Jira cloud ID and either the stable Jira issue ID or Atlassian account ID.

| Record | Owner | Contents |
|---|---|---|
| Issue directory | Jira issue | Ordered flow IDs, display names, flow types, optional conclusion levels |
| Saved flow | Jira issue | Stable UUID, normalized graph, analysis provenance, optional stable ID of the original flow |
| Custom instruction | Atlassian account within the Jira site | One saved instruction, with empty text representing the built-in default |

The `investigation-record` entity stores a `revision` and `data` for each record. The directory is fetched by key and graph records load individually. An issue rename keeps the same directory. Every flow operation verifies Jira visibility using `api.asUser()` before touching storage. Preference calls derive the account separately and work across issues. Resolver payloads supply neither tenant nor account nor issue ID.

All Jira users who can access the issue can view, add, and remove its flows. Only the owning account can read or change its custom instruction.

## Atomic writes

Imports validate v1 or v2 before writing. Each import allocates new flow UUIDs, preserves analysis IDs and evidence, and resolves duplicate display names against the current directory. The transaction compares the stored directory revision and writes the directory and all new graphs together. Individual deletion compares that same revision and removes the matching directory entry and graph together. A proposal retains its trace after removal of its related original.

A rejected transaction with a changed revision can be retried against a fresh directory. Retries are bounded. A transport error may leave the outcome unknown, so the UI directs users to reload the saved list before attempting another import. A rejected transaction exposes no partial graph or index update.

Preference saves compare the revision loaded by the editor. Reset stores an empty preference with a fresh revision. A stale tab must reload before saving its retained draft.

## Limits

| Limit | Behavior |
|---|---|
| 450,000 bytes for serialized import request | Split large analysis files before importing |
| 24 flows per import | Split batches to reserve one of Forge's 25 transaction operations for the directory |
| 220 KiB per stored record | Reject the whole import when any graph or the directory exceeds the limit |
| 32 KiB UTF-8 custom instruction | Shorten the draft, which stays in the editor |

The request and record limits reserve headroom beneath Forge's 500 KB frontend request and 240 KiB record limits. Code and evidence are never truncated. See the [invocation limits](https://developer.atlassian.com/platform/forge/limits-invocation/), [storage limits](https://developer.atlassian.com/platform/forge/limits-kvs-ce/), and [transaction reference](https://developer.atlassian.com/platform/forge/storage-reference/entities-transactions/).

The standalone preview uses in-memory example flows and edits. Browser presets from the previous prototype are outside the Forge model. Saved-flow JSON export and support for larger records are deferred.
