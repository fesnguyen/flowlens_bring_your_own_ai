# JSON Schema and Validation — Implementation Specification

**Status:** v1 and v2 resolver validation implemented.
**Parent:** [Analysis Schema](../features/ANALYSIS_SCHEMA.md)

New inspection requests ship `shared/flowlens.schema.json` (v2). `shared/flowlens.v1.schema.json` preserves the original v1 contract. Each version has its own schema ID. The import validator supports the subset of Draft 2020-12 keywords used by the bundled schemas. The same v2 asset is bundled for validation and shipped verbatim in Copy and Package.

The panel bounds the file and serialized request at 450,000 bytes. The resolver checks the serialized import size again before parsing. `parseInspection` parses JSON, dispatches on its explicit version, validates the selected schema, and checks the Jira issue key obtained by the resolver from an authorized Jira read. It then verifies flow and node ID uniqueness, entry nodes, execution endpoints, conclusion evidence references, original-flow links, and v2 impact targets. When a v2 reference has an ending line, it needs a starting line at or before it.

An omitted optional field is accepted. Malformed optional content returns a focused error, such as `$.flows[0].nodes[2].content[0].text is required`. The complete analysis is rejected on an error and existing flows remain available. All content is rendered as inert text. Imported evidence still requires developer verification.

`toInspection` adapts validated files to the viewer. It wraps v2 content in its display model and converts v1 descriptions to subheaders while preserving numbered code, omission summaries, findings, source information, and existing graph identifiers. This is an in-memory adapter. It does not rewrite the original analysis file.

The resolver validates before opening any write transaction. See [Data Storage](DATA_STORAGE.md) for additional persistence limits.
