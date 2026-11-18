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

Each source-code node should display enough information for quick identification:

- Node title.
- File and function name.
- Short explanation.
- Relevant source-code evidence.
- Potential issue indicators, when applicable.

Detailed information may be displayed in an expanded node or an accompanying detail panel.

The initial presentation should remain readable even for large workflows.

## 5. Source-Code Viewer

Code evidence is central to FlowLens.

The source-code viewer must:

- Preserve code indentation.
- Display original source line numbers.
- Support syntax highlighting when practical.
- Show noncontiguous source segments.
- Clearly indicate omitted line ranges.
- Distinguish original code from proposed code.

For example:

```python
36  payment = await gateway.capture(
37      customer_id=request.customer_id,
38      amount=amount
39  )

    ... Lines 40–59 omitted ...

60  if payment.success:
61      order.status = "PAID"
```

Omitted-line indicators are presentation elements, not original source-code statements.

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