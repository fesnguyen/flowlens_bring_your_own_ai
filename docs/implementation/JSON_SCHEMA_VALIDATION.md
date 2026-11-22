# JSON Schema and Validation — Implementation Specification

**Status:** Schema bundled for Copy and Package. Import validation is planned.
**Parent:** `../features/ANALYSIS_SCHEMA.md`

## Contract

`shared/flowlens.schema.json` defines the v1 contract in JSON Schema Draft 2020-12. It is the **only authoritative structural contract** for external AI-generated analysis files, import validation, inspection Copy/Package delivery, and later saved-flow JSON export. Versioned TypeScript context sections assemble the general inspection instruction independently of the schema. Documentation explains the contract but must not become a divergent schema.

Top level: `version: 1`, `issue`, `analysis`, and nonempty flat `flows[]`. A flow includes `id`, `name`, `type`, `description`, `entryNodeIds`, `nodes`, `edges`, optional `conclusion` and `basedOnFlowId`. Reconcile exact required/optional fields against `ANALYSIS_SCHEMA.md` before freezing v1.

## Planned contract migration (not implemented)

The new product direction requires optional source references, flexible ordered node content, and optional relative-impact relationships. The currently bundled v1 schema is still authoritative for current Copy/Package and future v1 import validation. Do **not** treat the planned flexible shape as accepted v1 JSON. Implement it through an explicit versioned schema change with updated prompt sections, validation, fixtures, migration/compatibility behavior and documentation. Preserve referential integrity and untrusted-content handling.

## Structural constraints

- Explicit `required` fields and types; enum values for flow type and conclusion level.
- Code line tuples are **exactly** `[positiveInteger, string]` with no extra elements.
- A code block contains **either** nonempty `lines` **or** an `omitted` range (`startLine`, `endLine`, `summary`).
- **Current v1 only:** source-code nodes require source references and code; structural markers may omit them. This requirement is slated for removal in the next versioned contract.
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

Use a maintained TypeScript JSON Schema validator (candidate: Ajv, with appropriate draft support). Keep one schema asset importable by the Forge backend and reusable without modification in the clipboard payload, as a separate ZIP file, and for saved-flow JSON export. Exported saved flows must validate against this schema after persistent IDs are mapped to import-compatible IDs. Fixtures: minimal valid flow, branching, omitted code, suggested flow, malformed tuples, invalid enum, missing reference, duplicate IDs, overlapping ranges, unsupported version, wrong Jira issue.
