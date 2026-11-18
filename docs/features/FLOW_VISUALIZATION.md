# FlowLens — Flow Visualization

**Authority:** Level 3 — Feature Behavior  
**Parent:** `docs/PROJECT_OVERVIEW.md`  
**Related:** `ANALYSIS_SCHEMA.md`  
**Status:** Proposed Design

## 1. Purpose

Define how FlowLens presents AI-generated execution flows inside a Jira issue.

The visualization must help developers understand actual execution paths, inspect relevant source code, and evaluate potential issues without constantly switching to an IDE.

The diagram is an investigation tool, not merely a collection of connected function names.

## 2. Flow Selection

Each Jira issue can contain multiple independently managed flows.

FlowLens displays a list of available flows with their names.

For example:

```text
Execution Flows
├── Payment Processing (Original)
├── Payment Processing (Suggestion)
├── Payment Processing (0)
├── Payment Retry
└── Webhook Handling
```

Users must be able to:

- Select and view a flow.
- Import additional flows.
- Delete an individual flow.
- Distinguish original flows from suggested flows.
- Review the investigation conclusion when available.

Flow names must remain unique within the issue.

When imported names conflict, FlowLens applies incremental suffixes according to the import rules.

No mandatory flow grouping is required.

## 3. Diagram Layout

The primary layout is left-to-right, following execution order.

Nodes represent meaningful execution steps. Edges communicate the relationships between them.

Conditional nodes must show their outgoing branches clearly.

The diagram should support:

- Sequential execution.
- Function calls.
- Conditional branches.
- Loops and retries.
- Exceptions and error paths.
- Asynchronous transitions.
- Multiple entry points.
- Multiple outcomes.

The visualization must not imply execution relationships that the analysis does not establish.

Automatic layout is preferred. AI-generated JSON should not need to specify screen coordinates.

## 4. Node Presentation

**Nodes are compact execution explanations, not merely function-name boxes.** The developer should understand most of the flow by reading the diagram, opening details only to verify evidence.

Use content-aware node variants:

- **Operation / call nodes:** prominent title; file and function; short explanation of what happens and why it matters; a small (roughly 3–6 line) original-code preview where available; finding count/indicator; source line range.
- **Decision nodes:** condition prominently displayed, with clearly labeled outgoing branches (for example Yes/No, success/failure). Show a short condition snippet when available.
- **Error / retry / async nodes:** visually communicate the transition type and its consequence without implying unverified behavior.
- **Start / end nodes:** compact, with meaningful entry or outcome labels; artificial source code is not required.
- **Suggested-flow nodes:** visibly marked as proposed rather than current repository behavior.

Operation nodes should generally be wider than conventional flowchart boxes (initial design target approximately **300–380 CSS px**, subject to responsive constraints). Node height may grow with meaningful content. Avoid rigid equal sizing that truncates important explanations. Do not render entire functions in the graph.

The initial diagram should remain readable at ordinary zoom. Full code, all findings, and evidence belong in the selected-node details area.

### 4.1 Inspection-Driven Screen Layout

The primary Jira issue-panel view contains:

1. **Header / inspection actions:** Copy Inspection Prompt, Export Inspection Package, Import JSON.
2. **Flow sidebar:** flat list of flows with original/suggestion distinctions and concise conclusion status; select and delete individual flows.
3. **Main diagram canvas:** left-to-right graph, auto-layout, labeled branches, pan/zoom/fit.
4. **Selected-node details:** original code with numbered lines and omitted summaries; node explanation, findings, recommendations, and source references.
5. **Flow-level context:** investigation summary, repository/revision when known, conclusion, evidence, and unresolved questions.

On sufficiently wide screens, the diagram and selected-node details may be visible together. On narrower Jira panels, use a responsive stacked or switchable layout rather than squeezing code into unreadable columns. Keep the graph as the main navigation surface and the code viewer as the main evidence surface.

### 4.2 Interaction

Selecting a flow updates the graph and conclusion. Selecting a node updates the details pane without losing diagram position. Finding indicators on nodes reveal relevant findings in details. Suggested flows remain separately selectable; optional links can navigate to their original flow. A graph with no selected node should show useful flow-level context.

This is a conceptual UI contract, not a requirement to reproduce a particular mockup pixel-for-pixel.

## 5. Source-Code Viewer

Code evidence is central to FlowLens.

The source-code viewer must:

- Preserve code indentation.
- Display original source line numbers.
- Support syntax highlighting when practical.
- Show noncontiguous source segments.
- Clearly indicate omitted line ranges, including a brief explanation of what the omitted code does.
- Display real source-code comments with their original line numbers.
- Render omitted-range explanations in a muted, distinct color that does not compete with code syntax.
- Distinguish original code from proposed code.

For example:

```python
35  # Capture the customer's payment through the gateway.
36  payment = await gateway.capture(
37      customer_id=request.customer_id,
38      amount=amount
39  )

    ... Lines 40–59 omitted (Create the order, record transaction details, and update payment metadata) ...

60  if payment.success:
61      order.status = "PAID"
```

Omitted-line indicators and their AI-generated summaries are presentation elements, not original source-code statements. They are shown inline in a muted, distinct color; real source-code comments remain numbered source lines.

Each retained line is supplied as `[lineNumber, content]` in the analysis JSON. This preserves line identity for possible future highlighting or annotations, without requiring those interactions now.

The interface should make it possible to understand important conditions and operations without displaying an entire large function.

## 6. Findings and Recommendations

Potential issues should appear alongside the relevant node.

A finding may include:

- Title and severity.
- Investigation status.
- Explanation.
- Supporting code references.
- Recommended changes.

Findings must be visually distinguishable from verified source-code behavior.

A small suggested fix should be displayed directly within the relevant original node.

For example, changing a validation limit from 25 to 30 characters does not require generating another workflow.

## 7. Original and Suggested Flows

Original and suggested flows are independent entries in the flow list.

A suggested flow is optional and should represent a meaningful proposed change in execution behavior.

Suggested flows should be clearly identified by name and type.

When a suggested flow references an original flow, the interface may offer navigation or comparison between them.

A suggested flow must never be presented as code already implemented in the repository.

## 8. Investigation Conclusions

The interface must support four investigation outcomes:

1. Inconclusive.
2. Potential issues detected.
3. Likely root cause.
4. Confirmed code-level mismatch.

The conclusion should be accessible when viewing the relevant flow.

It should explain the AI's assessment, supporting evidence, and unresolved questions.

A confirmed mismatch should not be presented as a confirmed production root cause unless that conclusion is independently supported.

## 9. Navigation and Interaction

Users should be able to:

- Navigate between connected nodes.
- Follow execution branches.
- Inspect code evidence.
- Review node-level findings.
- Move around large diagrams.
- Zoom and fit the diagram to the available space.
- Return to the flow list.

The interface should prioritize comprehension over decorative complexity.

Interaction details may evolve without changing the underlying analysis contract.

## 10. Large Workflow Handling

Larger, richer nodes make diagrams wider. Support horizontal navigation, zoom, fit-to-view, and progressive disclosure. Keep previews concise and prevent code/finding content from overwhelming branch labels.

Diagram positions are derived by the UI; analysis JSON does not need coordinates. Choose graph/layout and syntax-highlighting libraries during implementation based on representative inspection fixtures, not mockup appearance alone.

### 10.1 Representative UI Test Fixture

Use a realistic analysis containing a primary checkout flow with success and failure branches, a relevant retry or webhook flow, a source node with omitted code, node-level findings, a flow conclusion, and an optional proposed redesign. Treat it as **illustrative test data**, not a real code investigation.

Verify that users can understand the main execution path from node cards alone, then inspect the full evidence in the details pane. Test long descriptions, multiple findings, cycles, asynchronous edges, and narrow Jira issue panels.

Complex workflows may contain many nodes and branches.

FlowLens should remain usable through appropriate layout, navigation, and progressive disclosure of details.

The application should avoid rendering every long code snippet fully expanded by default.

The full analysis must remain accessible without requiring users to open external tools.

## 11. Design Principles

- Evidence must be easy to inspect.
- Execution order must be understandable.
- Conditions must be explicit.
- Original and proposed behavior must be distinguishable.
- Findings must be attached to relevant code.
- Large flows must remain navigable.
- The UI must not invent missing execution relationships.

The goal is to help developers understand code quickly, not to reproduce the entire IDE interface.