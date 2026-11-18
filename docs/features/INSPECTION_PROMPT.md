# FlowLens — Inspection Prompt

**Authority:** Level 3 — Feature Behavior  
**Parent:** `docs/PROJECT_OVERVIEW.md`  
**Related:** `ANALYSIS_SCHEMA.md`, `FLOW_VISUALIZATION.md`  
**Status:** Proposed Design

## 1. Purpose

Define the inspection request that FlowLens prepares from the current Jira issue for a developer's external AI assistant. The AI investigates an existing repository and returns `flowlens-analysis.json`; it does not modify code.

Both **Copy Inspection Prompt** and **Export Inspection Package** use the same core instructions. The copied prompt excludes attachments. The ZIP includes `inspection.md`, the authoritative `flowlens.schema.json`, and accessible issue attachments.

## 2. Jira Context

Include available issue key, title, type, status, priority, description, acceptance criteria, and other relevant issue context. Missing fields must be marked unavailable or omitted, never invented. The developer can add context in their external AI conversation.

## 3. Inspection Scope and Flow Selection

**The Jira issue determines which execution flows to investigate; there is no required flow count.**

The AI must first establish expected behavior, reported symptoms or requested changes, explicit requirements, assumptions, and unresolved questions. It then traces relevant actual code:

1. Primary entry-to-outcome execution path.
2. Failure and exception paths capable of explaining the issue.
3. Material alternative branches, fallbacks, retries, and loops.
4. Independently triggered background jobs, webhooks, or asynchronous processes when they affect the issue.
5. Optional suggested execution flows only when a meaningful change to execution behavior is warranted.

**Prefer one flow with multiple branches** when branches share an entry point and execution context. Use separate flows for meaningfully independent entry points or processes. Avoid unrelated, redundant, or arbitrary flows. Give each flow a self-explanatory name.

Example for a failed checkout after payment: `Checkout Processing` (with success and inventory-failure branches), `Payment Retry` if relevant, `Payment Webhook Handling` if relevant, and optionally `Checkout Processing (Suggestion)`. These are illustrative, not mandatory.

## 4. Repository Investigation

Trace actual entry points, callers/callees, functions, conditions, database operations, external APIs, asynchronous events, error handling, and exits. Distinguish statically possible execution from runtime-confirmed execution. Do not invent source code, call relationships, or line numbers.

Document meaningful operations, decisions, and outcomes as nodes, with edges representing established control flow. Include multiple entry points only when supported by the code.

## 5. Source-Code Evidence

Original-flow source-code nodes must provide relevant, exact repository snippets and source locations. Preserve indentation, original comments, and actual line numbers as `[lineNumber, content]` tuples. Prefer concise snippets (approximately 5–15 relevant lines when practical).

Noncontiguous snippets use ordered `lines` blocks and `omitted` blocks with inclusive `startLine`, `endLine`, and an AI-written `summary` explaining the omitted behavior. Never insert an AI explanation as if it were source code. Structural start/end markers need not have artificial code evidence.

Proposed code in suggested flows must be clearly labeled as proposed, never as existing implementation.

## 6. Findings, Conclusions, and Suggestions

Attach evidence-backed findings to relevant nodes. Distinguish observed code behavior from interpretation, uncertainty, and hypotheses. Include supporting references and recommended changes when justified.

Original-flow conclusion levels:

- `inconclusive` — insufficient evidence.
- `potential_issues` — suspicious behavior without a verified cause.
- `likely_root_cause` — strong evidence supports an explanation.
- `confirmed_mismatch` — code contradicts an explicit requirement; this alone does not confirm the cause of a production incident.

Keep small recommendations in original-node findings. Create a separate `suggestion` flow only for meaningful execution changes, optionally linking it through `basedOnFlowId`.

## 7. Required Output Contract

Produce a downloadable file named **`flowlens-analysis.json`**. Its top-level data includes schema `version`, Jira `issue`, `analysis` metadata (repository, revision if known, summary), and a flat `flows[]` array. Each flow describes its identity, type, purpose, entry nodes, nodes, edges, and applicable conclusion.

**The machine-readable `flowlens.schema.json` is the authoritative structural contract.** The prompt should include the complete schema inline for clipboard use; the export package should include it as a separate file. Do not maintain divergent hand-written copies of field definitions. `ANALYSIS_SCHEMA.md` explains semantics; the machine-readable schema and validator still need implementation.

The AI must follow required fields, types, enums, code tuples, omitted blocks, and finding structures. Do not invent fields or fabricate evidence to satisfy required fields. Follow the schema's permitted representation for unavailable data.

## 8. Validation Before Delivery

The AI should:

1. Produce parseable JSON and use the supported schema version.
2. Validate against the supplied JSON Schema when tooling is available.
3. Check unique flow/node IDs and valid entry/edge references.
4. Check exact source text, ordered line numbers, and accurate omitted ranges.
5. Check that conclusions and findings cite relevant evidence and suggestions are clearly labeled.
6. Correct errors before delivery, and disclose if automated validation could not run.

The AI should deliver the complete file rather than pasting a truncated JSON response. Its final chat reply should briefly state flow names/count, main findings, uncertainties, and validation status.

## 9. Import Feedback Loop

FlowLens must validate imported JSON independently; prompt compliance is not a security or correctness guarantee. Show actionable errors with paths (for example, `flows[0].nodes[2].source.file`) and a copyable validation report so the developer can request correction from their AI assistant. Never persist an invalid partial analysis.

## 10. Boundaries

No built-in AI, repository scanning, source modification, or runtime debugger is required. FlowLens prepares the request, validates the returned data, and makes evidence-backed execution flows understandable.
