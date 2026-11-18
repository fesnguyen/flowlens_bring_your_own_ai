# Forge API Contracts — Implementation Specification

**Status:** Proposed; endpoint names are design candidates, not implemented.  
**Parent:** `../FORGE_ARCHITECTURE.md`

## Boundary

React Custom UI communicates with the Forge resolver through `@forge/bridge`. The resolver authorizes the current Jira issue, validates untrusted analysis, and manages storage. Shared TypeScript types describe inputs and outputs. The browser does not choose a tenant identity or gain direct trusted storage access.

## Candidate operations

| Resolver operation | Request | Response |
|---|---|---|
| `getIssueInspectionContext` | Current issue context | Normalized issue metadata and available fields |
| `listIssueFlows` | Current issue context | IssueFlows directory entries: Flow IDs, names, types, conclusion summaries, Analysis provenance |
| `getIssueFlow` | Stored flow ID | Full stored flow with code evidence |
| `importIssueAnalysis` | Analysis JSON | New Flow IDs/names, rename notices; existing flows unchanged |
| `deleteIssueFlow` | Stored flow ID | Confirmation and updated list |

Issue context should come from Forge/Jira trusted context and authorization checks; do not rely on a raw `issueKey` supplied by the frontend. The client may use the issue key for display.

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

Use consistent user-facing errors and avoid exposing sensitive server internals. Prefer a small shared result type; no need for a general-purpose API framework.

## Responsibilities

- **Frontend:** copy/download, import file selection, diagram rendering, optimistic loading states.
- **Resolver:** issue authorization, authoritative validation, name allocation, additive Flow/Analysis persistence, IssueFlows maintenance, deletion, access checks.
- **Jira APIs:** issue fields and permitted attachment retrieval.
- **Shared contract:** normalized issue context, flow list summaries, import result, validation errors.

## Verification

Test authorized and unauthorized issue access, stale/deleted flow IDs, wrong issue, malformed payloads, storage errors, and browser refresh. Verify Forge permission scopes and attachment APIs against current official documentation during implementation.
