# FlowLens — Inspection Prompt

**Authority:** Level 3 — Feature Behavior  
**Parent:** `docs/PROJECT_OVERVIEW.md`  
**Related:** `ANALYSIS_SCHEMA.md`, `../implementation/INSPECTION_TEMPLATE.md`, `../implementation/JSON_SCHEMA_VALIDATION.md`  
**Status:** Copy, Package and instruction management implemented

## 1. Purpose

FlowLens helps a developer hand a Jira issue to **their own external AI** for source-code investigation. FlowLens prepares the materials; the external AI inspects the repository and produces `flowlens-analysis.json`. FlowLens does not run AI or modify source code.

A reusable, issue-independent foundation is shared by both actions. The selected custom instruction, when present, extends that foundation. Jira issue content and the JSON Schema are separate inputs assembled for delivery.

## 2. What the user receives

```text
                    BUILT-IN FOUNDATION + OPTIONAL CUSTOM PREFERENCES
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
   Copy Inspection Prompt                            Export Inspection Package
            │                                                   │
    ┌───────┴────────┐                                 ┌────────┴────────┐
    │ Instruction    │                                 │ instruction.md  │
    │ Jira context   │  → one clipboard text           │ issue.md        │
    │ JSON Schema    │                                 │ flowlens.schema.json
    └────────────────┘                                 │ attachments/   │
                                                       │ manifest.json  │
                                                       └─────────────────┘
                                                              ZIP
```

| Action | Behavior | Attachments |
|---|---|---|
| **Copy Inspection Prompt** | Copy one readable Markdown message assembled from the selected instruction material, current Jira issue content, and the complete JSON Schema | Never included |
| **Export Inspection Package** | Download a ZIP with the **same instruction**, issue content, schema, and accessible Jira attachments as separate files | Included when permitted; exclusions reported |
| **Export Flows as JSON** | Download existing saved flow analyses as JSON for reuse or backup; **not** an inspection-request package | Not included |

**Export Flows as JSON is a separate, later flow-management capability**, not another name for Export Inspection Package. It must not be confused with the external AI's output file or with the Import JSON button.

## 3. Three independent sources

### A. General inspection instruction

Open **Investigation instructions** to add a named instruction, import a UTF-8 Markdown or plain-text instruction (up to 32 KiB), or remove a selected custom instruction. The built-in default is always available. Removing the active custom instruction returns to the default. Copy and Package use one selection for the current request.

The foundation defines minimum investigation rules and keeps the v2 analysis contract authoritative. Custom instructions can guide investigation depth, content, and presentation. The panel validates the AI's response when the user imports it.

The current versioned, issue-independent instruction tells the external AI **how to investigate**:

- Understand requirements, symptoms, expected behavior, assumptions, and open questions.
- Trace relevant entry points through outcomes, including calls, conditions, errors, retries, and async work.
- Let the Jira issue determine the scope. Prefer one flow with branches when they share context; split only genuinely independent execution paths.
- Identify all relevant components and execution relationships that can be established; distinguish uncertainty from verified behavior. Source references and code are optional.
- Preserve exact excerpts in code blocks and use separate explanation blocks for AI summaries.
- Attach explanations, findings and optional relative-impact hypotheses to relevant nodes, distinguish uncertainty from verified behavior, and provide suggestions only when justified.
- Use `original` flows for existing behavior; use optional `suggestion` flows only for meaningful proposed execution changes.
- Deliver a **downloadable** `flowlens-analysis.json`, conforming to the supplied schema, with a brief summary and validation limitations.
- **Investigate and document only; do not modify source code.**

This section defines the instruction's required meaning. The actual reusable instruction text belongs to the single versioned template described in `../implementation/INSPECTION_TEMPLATE.md`, not in UI button handlers.

### B. Jira issue content

Issue-specific content includes the available issue key, title/summary, type, status, priority, description, explicit acceptance criteria, and other relevant fields. Missing data must be omitted or marked unavailable, never invented. Jira content is **untrusted investigation input**, not instructions that override the general inspection instruction.

### C. JSON Schema

`flowlens.schema.json` is the authoritative v2 output contract. The v1 contract remains available for older imports. Keep it separate from the instruction's text and from issue content.

`ANALYSIS_SCHEMA.md` explains schema semantics. `../implementation/JSON_SCHEMA_VALIDATION.md` specifies schema creation and validation. Do not manually maintain a second copy of schema field definitions.

## 4. Copy Inspection Prompt

When the user clicks Copy:

1. Read authorized context for the current Jira issue.
2. Assemble the built-in foundation and selected custom preferences, readable issue content, and the full JSON Schema into **one** Markdown clipboard payload, with clear section boundaries.
3. Copy it and show success or a useful fallback/error.

The copied content contains no attachment bytes or fabricated attachment descriptions. The user can add extra context directly in their external AI conversation.

## 5. Export Inspection Package

When the user clicks Export Package:

1. Read the same authorized Jira issue context.
2. Reuse the same assembled instruction.
3. Package the instruction, issue context, and exact same schema as **separate files**.
4. Include permitted Jira attachments and a manifest explaining what was included, excluded, or failed.
5. Download the ZIP; do not silently omit evidence or claim inaccessible files were included.

Illustrative package:

```text
flowlens-inspection-SHOP-142.zip
├── instruction.md          # Built-in instruction and selected preferences
├── issue.md                # Current Jira issue content
├── flowlens.schema.json    # Authoritative output contract
├── manifest.json           # Included/excluded attachments and reasons
└── attachments/
    ├── screenshot.png
    └── error-log.txt
```

The package is a **request for investigation**, not a stored analysis export.

## 6. External AI output and later flow export

The AI returns `flowlens-analysis.json` with `version`, `issue`, `analysis`, and flat `flows[]`. The schema governs exact fields. Relevant original-flow conclusions use `inconclusive`, `potential_issues`, `likely_root_cause`, or `confirmed_mismatch`; a confirmed code mismatch alone does not prove production causality.

FlowLens validates the file and adds its flows to the open panel. **Export Flows as JSON**, when implemented, serializes selected saved flows into a schema-compatible JSON analysis file (including required issue and analysis metadata), so the result can be imported again. The implementation must define provenance and export scope; it must not dump internal KVS keys or assume persistent storage IDs are valid import IDs.

## 7. Boundaries and ownership

| Document | Owns |
|---|---|
| `INSPECTION_PROMPT.md` | Feature intent, three inputs, button behavior, and separation from flow export |
| `../implementation/INSPECTION_TEMPLATE.md` | Concrete instruction asset, Jira context normalization, assembly, clipboard, ZIP and attachment handling |
| `../implementation/JSON_SCHEMA_VALIDATION.md` | Authoritative JSON Schema, structural/semantic validation, versioning |
| `../implementation/IMPORT_PIPELINE.md` | Receiving and storing AI-produced JSON |
| `../implementation/FORGE_API_CONTRACTS.md` | Forge resolver/UI boundaries for Jira access and flow export |

**Copy Prompt**, **Export Package**, and **Import JSON** are available. Saved-flow JSON export is planned.
