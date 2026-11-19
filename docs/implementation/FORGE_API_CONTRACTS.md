# Forge API Contracts — Implementation Specification

**Status:** Inspection resolvers implemented. Flow storage and import operations are planned.
**Parent:** `../FORGE_ARCHITECTURE.md`

## Boundary

React Custom UI communicates with the Forge resolver through `@forge/bridge`. The resolver uses trusted context and Jira user permissions to authorize issue and attachment reads. Analysis validation and storage are planned. Shared TypeScript types describe inputs and outputs. The browser does not choose a tenant identity or gain direct trusted storage access.

## Resolver operations

| Resolver operation | Request | Response |
|---|---|---|
| `getInspectionIssue` | `{ includeAttachments }` | Normalized current issue with attachment metadata when requested |
| `getInspectionAttachment` | `{ attachmentId }` | Base64 attachment bytes after checking current issue membership and downloading with Jira user permissions |
| `listIssueFlows` | Current issue context | IssueFlows directory entries: Flow IDs, names, types, conclusion summaries, Analysis provenance |
| `getIssueFlow` | Stored flow ID | Full stored flow with code evidence |
| `importIssueAnalysis` | Analysis JSON | New Flow IDs/names, rename notices; existing flows unchanged |
| `deleteIssueFlow` | Stored flow ID | Confirmation and updated list |
| `exportIssueFlows` (future) | Selected saved flow IDs (or explicit all) | Authorized schema-compatible analysis JSON, with persistent IDs mapped to export IDs |

The inspection resolvers use `context.extension.issue.id` and `api.asUser().requestJira`. The manifest grants `read:jira-work` for issue reads, field discovery, and attachment download. The client uses Bridge issue context for display.

## Inspection assembly boundary

The versioned general instruction is a static shared asset. Copy assembles **instruction + normalized issue Markdown + exact schema** into one clipboard message. Package ZIP keeps **instruction.md**, **issue.md**, **flowlens.schema.json**, and permitted attachments as separate files with a manifest. The instruction text must remain unchanged between both actions. Neither operation requires KVS. **Export Flows as JSON** is a separate saved-flow operation and requires storage. Forge resolvers must verify issue access and attachment authorization; never trust a browser-provided tenant or issue ID.

## Error contract proposal

```ts
type OperationError = {
  code: 'UNAUTHORIZED' | 'INVALID_JSON' | 'SCHEMA_ERROR' |
        'ISSUE_MISMATCH' | 'UNSUPPORTED_VERSION' |
        'TOO_LARGE' | 'NOT_FOUND' | 'STORAGE_ERROR';
  message: string;
  details?: Array<{ path: string; code: string; message: string }>;
};
```

The implemented inspection calls return a typed success result or `{ ok: false, message }`. Use consistent user-facing errors and avoid exposing sensitive server internals. Prefer a small shared result type; no need for a general-purpose API framework.

## Responsibilities

- **Frontend:** assemble/copy/download authorized inspection materials, import file selection, graph rendering, loading and error states; do not substitute sample Jira data in production.
- **Resolver:** issue authorization, authoritative validation, name allocation, additive Flow/Analysis persistence, IssueFlows maintenance, deletion, access checks.
- **Jira APIs:** issue fields and permitted attachment retrieval.
- **Shared contract:** normalized issue context, flow list summaries, import result, validation errors.

## Verification

Test authorized and unauthorized issue access, stale/deleted flow IDs, wrong issue, malformed payloads, storage errors, and browser refresh. Verify Forge permission scopes and attachment APIs against current official documentation during implementation.
