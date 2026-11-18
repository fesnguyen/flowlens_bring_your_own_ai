# JSON Schema and Validation — Implementation Specification

**Status:** Proposed; machine-readable schema not yet implemented.  
**Parent:** `../features/ANALYSIS_SCHEMA.md`

## Contract

Create a versioned `flowlens.schema.json` (candidate: JSON Schema Draft 2020-12). It is the **only authoritative structural contract** for generated analysis files, import validation, and inspection exports. Documentation explains the contract but must not become a divergent schema.

Top level: `version: 1`, `issue`, `analysis`, and nonempty flat `flows[]`. A flow includes `id`, `name`, `type`, `description`, `entryNodeIds`, `nodes`, `edges`, optional `conclusion` and `basedOnFlowId`. Reconcile exact required/optional fields against `ANALYSIS_SCHEMA.md` before freezing v1.

## Structural constraints

- Explicit `required` fields and types; enum values for flow type and conclusion level.
- Code line tuples are **exactly** `[positiveInteger, string]` with no extra elements.
- A code block contains **either** nonempty `lines` **or** an `omitted` range (`startLine`, `endLine`, `summary`).
- Source-code nodes require source references and code; structural markers may omit them.
- Findings have stable IDs, explanations, evidence and supported severity/status values when defined.
- Proposed code must be distinguishable from original source evidence.
- Reject unknown structural properties by default where forward compatibility is not explicitly designed.

## Semantic validation (beyond JSON Schema)

- Unique flow IDs within file; unique node IDs within each flow.
- Every entry node and edge endpoint exists in its flow.
- `basedOnFlowId` resolves to an appropriate original flow when present.
- Original source line numbers strictly increase; omitted ranges are positive, inclusive, ordered, nonoverlapping, and match gaps between retained segments.
- Source ranges cover referenced snippets consistently.
- Jira issue key must match the current issue or import must stop with explicit user-facing mismatch feedback.
- Enforce bounded file size, node count, string lengths, and nesting depth.

**Important limitation:** structural validation cannot prove that imported code matches a repository. FlowLens has no repository integration; the AI and developer must verify factual accuracy. Never label schema-valid content as source-verified.

## Pipeline and errors

Parse JSON → check version/issue → JSON Schema validation → semantic validation → import planning. Return structured errors such as `{path, code, message}`, with paths like `flows[0].nodes[2].source.file`. Show a copyable report. Invalid analysis is rejected without partial persistence.

## Implementation and tests

Use a maintained TypeScript JSON Schema validator (candidate: Ajv, with appropriate draft support). Keep the schema importable by the Forge backend and exportable verbatim to the frontend/prompt builder. Fixtures: minimal valid flow, branching, omitted code, suggested flow, malformed tuples, invalid enum, missing reference, duplicate IDs, overlapping ranges, unsupported version, wrong Jira issue.
