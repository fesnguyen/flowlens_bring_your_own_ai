# JSON Schema and Validation — Implementation Specification

**Status:** v1 and v2 browser validation implemented.
**Parent:** [Analysis Schema](../features/ANALYSIS_SCHEMA.md)

New inspection requests ship `shared/flowlens.schema.json` (v2). `shared/flowlens.v1.schema.json` preserves the original v1 contract. Each version has its own schema ID. The import validator supports the subset of Draft 2020-12 keywords used by the bundled schemas. The same v2 asset is bundled for validation and shipped verbatim in Copy and Package.

The panel checks the 5 MiB file limit before reading the file. `parseInspection` parses JSON, dispatches on its explicit version, validates the selected schema, and checks the current Jira issue key when available. It then verifies flow and node ID uniqueness, entry nodes, execution endpoints, conclusion evidence references, original-flow links, and v2 impact targets. When a v2 reference has an ending line, it needs a starting line at or before it.

An omitted optional field is accepted. Malformed optional content returns a focused error, such as `$.flows[0].nodes[2].content[0].text is required`. The complete analysis is rejected on an error and existing flows remain available. All content is rendered as inert text. Imported evidence still requires developer verification.

`toInspection` adapts validated files to the viewer. It wraps v2 content in its display model and converts v1 descriptions to subheaders while preserving numbered code, omission summaries, findings, source information, and existing graph identifiers. This is an in-memory adapter. It does not rewrite the original analysis file.

Trusted resolver-side validation remains planned alongside Forge persistence.
