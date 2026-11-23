# Forge API Contracts

**Status:** Inspection, issue flow storage, and account preference operations implemented.
**Parent:** [Forge Architecture](../FORGE_ARCHITECTURE.md)

The React panel calls the resolver through Forge Bridge. The resolver derives the site, issue, and account from trusted Forge context. Every issue flow operation checks Jira visibility as the current user. The account preference operations need a signed-in account and are independent of issue membership.

| Resolver | Payload | Success value |
|---|---|---|
| `getInspectionIssue` | `{ includeAttachments }` | Authorized issue Markdown source fields and optional attachment metadata |
| `getInspectionAttachment` | `{ attachmentId }` | Permitted base64 bytes after verifying the attachment belongs to the issue |
| `listIssueFlows` | None | Current Jira issue key and ordered flow summaries |
| `getIssueFlow` | `{ id }` | One graph, its provenance and optional related original |
| `importIssueAnalysis` | `{ text }` | Updated summaries, first imported flow and count |
| `deleteIssueFlow` | `{ id }` | Updated summaries |
| `getCustomInstruction` | None | Saved text and revision, or an empty default |
| `saveCustomInstruction` | `{ text, revision }` | Committed text and new revision, with empty text for reset |

The storage operations return either `{ ok: true, value }` or `{ ok: false, message }`. The manifest requires `read:jira-work` for Jira reads and `storage:app` for the Custom Entity Store. [Data Storage](DATA_STORAGE.md) describes transaction behavior and ownership.

Copy and Package use the same frontend inspection builder and the saved preference loaded from Forge. Attachment access remains limited by Jira permissions. Saved-flow JSON export is deferred.
