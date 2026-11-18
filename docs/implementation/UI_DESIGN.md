# UI Design — Implementation Specification

**Status:** Proposed design, not implemented.  
**Parents:** `../features/FLOW_VISUALIZATION.md`, `../features/INSPECTION_PROMPT.md`

## Primary user journey

Jira issue → Copy Prompt / Export Package → external AI → Import JSON → choose flow → read execution graph → select node → inspect exact source and findings.

## Screen regions

1. **Header:** FlowLens identity, Copy Inspection Prompt, Export Inspection Package, Import JSON.
2. **Flow sidebar:** flat list; flow name, original/suggestion indicator, conclusion badge, select and delete actions. Include empty state and import CTA.
3. **Graph canvas:** left-to-right execution order, pan/zoom/fit, conditional edge labels, multiple entry points, loops, errors, async edges.
4. **Node details:** file, symbol, source range, exact numbered code, omitted-range summaries, findings and recommendations.
5. **Flow context:** repository/revision when known, investigation summary, conclusion evidence, remaining questions.

Use a wide responsive layout where possible; narrow Jira panels must stack or switch between graph and details rather than squeeze text. Preserve graph viewport when selecting a node.

## Node types and presentation

| Node | Summary content | Shape/behavior |
|---|---|---|
| Operation/call | Title, file/symbol, 1–3 sentence purpose, ~3–6 original code lines, finding indicator | Target width 300–380 CSS px; height content-aware |
| Decision | Actual condition, short source excerpt, clearly labeled branch edges | Wider as needed for readable condition |
| Error/retry/async | Trigger and consequence; type distinct from ordinary sequential call | No unsupported implication of direct invocation |
| Start/end | Entry point or outcome | Compact; no artificial code |
| Proposed | Description and clearly labeled proposed behavior | Never style as verified original code |

The code preview is **not** a substitute for the full evidence pane. Clamp long descriptions with an explicit details affordance; do not truncate source evidence in storage. Avoid displaying full functions on all nodes.

## Node details

Render `code[]` blocks in order. Number each original `[lineNumber, content]` line; preserve indentation and comments. Render `omitted` ranges as muted explanatory rows with inclusive range and summary. Use a monospace code area, horizontal scrolling where necessary, and safe text rendering (never interpret snippets as HTML).

Finding cards show title, severity/status if supplied, explanation, source evidence, and optional suggestion. Keep interpretation visually distinct from actual code. Flow-level conclusions use the four contract levels; do not imply a confirmed production cause.

## States and interactions

- **Loading:** issue context, flow list, or selected flow.
- **Empty:** no flows; show Copy/Export/Import actions.
- **Import validation error:** clear field paths and Copy Error Report action; do not save.
- **Import success:** show imported flow count and renamed flows; select newly imported flow.
- **Read failure / unauthorized:** actionable message, no stale cross-issue data.
- **Delete:** explicit confirmation for a single flow; keep others intact.
- **Complex graph:** fit view initially; pan/zoom controls, accessible node focus, no forced graph reset when switching details.

## Candidate components

`InspectionActions`, `FlowSidebar`, `FlowDiagram`, `ExecutionNode`, `NodeDetails`, `CodeViewer`, `FindingDetails`, `FlowConclusion`, `ImportDialog`.

These are responsibility boundaries, not mandatory separate files. Prefer fewer components when simpler.

## Acceptance tests

A developer can understand primary paths from the node cards alone, then verify actual code and evidence in details. Test long titles, multiple findings, nested branches, loops, async edges, disconnected entry points, omitted source ranges, proposed flows, empty states, and narrow Jira panel widths.
