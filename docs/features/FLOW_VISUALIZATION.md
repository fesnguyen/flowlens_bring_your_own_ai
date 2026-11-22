# FlowLens — Flow Visualization

**Authority:** Level 3 — Feature Behavior  
**Parent:** `docs/PROJECT_OVERVIEW.md`  
**Related:** `ANALYSIS_SCHEMA.md`  
**Status:** Proposed Design

## 1. Purpose

Define how FlowLens presents AI-generated execution flows inside a Jira issue.

The visualization must help developers understand actual execution paths, understand relationships and potential change impact, and inspect optional evidence without constantly switching tools.

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

A node is a meaningful investigation step, not necessarily a function. The universal presentation is:

1. **Header:** prominent title and optional sequence number/type.
2. **Subheader:** short responsibility or context.
3. **Additional information:** ordered, flexible content blocks supplied by the user's AI. Blocks may contain explanations, conditions, code, scenarios, warnings, diagnostics, findings, or impact analysis.
4. **Relationships:** explicit connections to other nodes, rendered by the diagram rather than assumed from the node's text.

Only the identifier and meaningful title are universally necessary for a displayable node. A subheader, detail blocks, source reference, warnings and impacts are optional. Never force a fixed set of AI diagnostic fields on every node.

Use left-to-right execution order where supported. Number steps when an order is established; branches, loops and async transitions must not be flattened into an invented total order. Allow details to expand without overcrowding the canvas. Selecting a node should reveal its full content.

### 4.1 Relative impact

A node may include an optional **Relative Impact** section for a proposed change. Each impact identifies a related node, relationship type, potential consequence, reason and what to verify. Highlight impacted nodes and provide navigation within the diagram. The affected set is not restricted to outgoing execution edges: callers, shared configuration and state can matter too.

Label AI-estimated impact as unverified unless there is separate evidence. Do not imply that selecting a node performs a real-time code analysis; FlowLens displays imported information.

### 4.2 Source references (deferred)

File paths, function names, line ranges and code snippets may appear as optional content. They are **not required** to display or import a node. Direct source navigation, line highlighting and a dedicated mandatory code viewer are out of scope for this direction.

### 4.3 Screen layout and interactions

Provide inspection actions, a list of imported flows, the connected diagram, and selected-node details. Keep responsive layout, pan/zoom/fit, labeled branches and flow-level context. A graph with no selected node may show flow-level context.

## 5. Evidence and uncertainty

AI-generated explanations, suspected bugs and potential impacts must be distinguishable from verified observations. Imported code snippets, if present, are untrusted content and must be rendered safely. Structural validation does not prove source accuracy. The developer verifies relevant claims.

## 6. Findings and Recommendations

Potential issues should appear alongside the relevant node.

A finding may include:

- Title and severity.
- Investigation status.
- Explanation.
- Supporting evidence when available.
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
- Inspect optional evidence and explanations.
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

The full imported analysis must remain accessible in FlowLens; external source navigation is not required.

## 11. Design Principles

- Evidence must be easy to inspect.
- Execution order must be understandable.
- Conditions must be explicit.
- Original and proposed behavior must be distinguishable.
- Findings must be attached to relevant code.
- Large flows must remain navigable.
- The UI must not invent missing execution relationships.

The goal is to help developers understand code quickly, not to reproduce the entire IDE interface.