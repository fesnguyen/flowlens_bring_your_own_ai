# UI Design — Implementation Specification

**Status:** Inspection header actions implemented. Import and persistence are planned.
**Parents:** `../features/FLOW_VISUALIZATION.md`, `../features/INSPECTION_PROMPT.md`

## 1. Screen Overview

FlowLens runs inside a Jira issue panel. It allows developers to explore AI-generated execution flows, inspect source-code evidence, and understand findings related to the current Jira issue.

### 1.1 Wide Layout

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ A. HEADER                                                                                           │
│ FlowLens · SHOP-142                [Copy Prompt] [Export Package] [Import JSON]                       │
├──────────────────────┬─────────────────────────────────────────────────────┬────────────────────────┤
│                      │                                                     │                        │
│ B. EXECUTION FLOWS   │ C. EXECUTION GRAPH                                  │ D. NODE DETAILS        │
│                      │                                                     │                        │
│ Checkout Processing  │ Checkout Processing                [-] 86% [+] [Fit] │ Capture Payment        │
│  Original            │ shop-backend · a4c8f21                               │                        │
│  Potential issues    │                                                     │ payment_service.py     │
│                      │  ┌───────────┐    ┌─────────────┐    ┌──────────┐  │ PaymentService.capture │
│ Payment Retry        │  │ Capture   │───▶│ Payment     │───▶│ Create   │  │ Lines 35–64            │
│  Original            │  │ Payment   │    │ Successful? │ Yes│ Order    │  │                        │
│  Inconclusive        │  │           │    └──────┬──────┘    └──────────┘  │ SOURCE CODE            │
│                      │  │ File      │           │ No                        │ 35 # Capture payment   │
│ Payment Webhook      │  │ Function  │           ▼                           │ 36 payment = await...  │
│  Original            │  │ Purpose   │    ┌─────────────┐                  │ 37 ...                 │
│  Likely root cause   │  │ Code      │◀───│ Retry       │                  │                        │
│                      │  │ preview   │    │ Payment     │───▶ End Failure  │ ... Lines 40–59 ...    │
│ Checkout Processing  │  └───────────┘    └─────────────┘                  │                        │
│  Suggestion          │                                                     │ 60 if payment...       │
│                      │                                                     │                        │
│                      │                                                     │ FINDINGS               │
│                      │                                                     │ F-001 Timeout risk     │
│                      │                                                     │ Evidence               │
│                      │                                                     │ Recommendation         │
│                      ├─────────────────────────────────────────────────────┤                        │
│                      │ E. FLOW CONCLUSION                                  │                        │
│                      │ Potential issues                                    │                        │
│                      │ Summary · Evidence nodes · Remaining questions      │                        │
└──────────────────────┴─────────────────────────────────────────────────────┴────────────────────────┘
```

The graph above is a simplified layout illustration, not an exact execution specification. Actual edges, branch conditions, retry behavior, and outcomes must come from the imported flow data.

### 1.2 Narrow Jira Panel

```text
┌────────────────────────────────────────────┐
│ A. HEADER                                  │
│ FlowLens · SHOP-142             [Actions ▾]│
├────────────────────────────────────────────┤
│ B. FLOW SELECTOR                           │
│ [Checkout Processing                  ▾]  │
├────────────────────────────────────────────┤
│ C. EXECUTION GRAPH                         │
│ Checkout Processing        [-] [+] [Fit]   │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │                                        │ │
│ │   ┌──────────────────────┐             │ │
│ │ ◀─│ Capture Payment      │──▶          │ │
│ │   │ File · Function      │             │ │
│ │   │ Purpose              │             │ │
│ │   │ Code preview         │             │ │
│ │   └──────────────────────┘             │ │
│ │                                        │ │
│ │       ◀ Pan horizontally ▶             │ │
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│ E. FLOW CONCLUSION                         │
│ Potential issues · Summary                 │
├────────────────────────────────────────────┤
│ D. NODE DETAILS — Bottom Drawer       [×] │
│                                            │
│ Capture Payment                            │
│ payment_service.py · Lines 35–64           │
│                                            │
│ SOURCE CODE                                │
│ 35  # Capture payment                      │
│ 36  payment = await ...                    │
│                                            │
│ ... Lines 40–59 omitted ...                │
│                                            │
│ FINDINGS                                   │
│ F-001 · Payment timeout risk               │
│ Recommendation: Handle delayed responses  │
└────────────────────────────────────────────┘
```

The application uses **one responsive UI**, not two separate implementations.

On narrow screens:

- The flow sidebar becomes a dropdown.
- Header actions move into a compact menu.
- The execution graph remains left-to-right and supports panning.
- Node Details becomes a bottom drawer.
- Source code and execution cards remain readable.

---

## 2. Component Responsibilities

The labels below correspond to the screen diagrams above.

### A. Header

**Purpose:** Identify FlowLens, provide Jira issue context, and expose inspection actions.

| Element | Responsibility |
|---|---|
| FlowLens identity | Display application name and branding |
| Jira issue key | Show the issue currently being inspected |
| Copy Inspection Prompt | Copy one Markdown message combining unchanged general instruction, Jira issue context, and complete JSON Schema; no attachments |
| Export Inspection Package | ZIP containing separate `instruction.md`, `issue.md`, `flowlens.schema.json`, manifest, and permitted attachments |
| Import JSON | Import AI-generated execution-flow analysis |
| Export Flows as JSON (future) | Download saved flows as a schema-compatible JSON analysis; distinct from the inspection ZIP |
| Actions menu | Provide the same actions on narrow screens |

The issue key comes from the trusted Forge/Jira context when available.

Copy and Package share loading and accessible feedback across both layouts. When clipboard access fails, a read-only field selects the entire prompt for manual copying. Package feedback includes skipped-file counts or an attachment-list error and a download link. Import JSON is disabled.

### B. Execution Flows / Flow Selector

**Purpose:** Let the user navigate independent execution flows associated with the Jira issue.

Each flow entry displays:

- Flow name.
- Original or suggestion classification.
- Investigation conclusion when available.
- Clear selected state.

Selecting a flow:

1. Changes the active flow.
2. Updates the execution graph.
3. Updates the flow conclusion.
4. Selects an appropriate initial inspectable node.
5. Resets or closes node details as appropriate.

Flows are stored independently. Importing a new flow adds another entry; it does not merge nodes into an existing flow.

**Future behavior:** Support deleting an individual flow with explicit confirmation.

### C. Execution Graph

**Purpose:** Visualize how code executes, including decisions, calls, retries, errors, and outcomes.

The graph is the primary exploration surface.

**Graph behavior**

- Left-to-right execution direction.
- Directed connections between nodes.
- Labels on conditional branches.
- Support for multiple entry points.
- Support for loops, retries, errors, and asynchronous relationships.
- Pan, zoom, and fit-to-view.
- Click a node to inspect its details.
- Preserve the viewport when selecting a different node.

Graph relationships must be derived from the imported `nodes[]` and `edges[]`, never guessed from node titles.

#### Execution node types

| Node type | Presentation |
|---|---|
| Operation / call | Large card with title, source location, explanation, code preview, and finding indicator |
| Decision | Actual condition and clearly labeled outgoing branches |
| Error / retry / async | Trigger and consequence, visually distinct from ordinary calls |
| Start / end | Compact entry point or outcome |
| Proposed | Clearly labeled suggested behavior, distinct from verified source |

Operation nodes target approximately **300–380 CSS pixels wide**, with content-aware height.

Their code previews show roughly 3–6 original source lines. Long descriptions may be clamped, but complete evidence must remain available in Node Details.

### D. Node Details

**Purpose:** Inspect the exact evidence and AI findings associated with the selected execution node.

This is a **UI view**, not a separate database record.

#### D1. Node information

Displays the selected node's:

- Title and description.
- Source file.
- Function or symbol.
- Source line range.

#### D2. Source code

Renders the node's `code[]` blocks in their original order.

Original source lines use:

`[lineNumber, content]`

Requirements:

- Preserve line numbers, indentation, and original comments.
- Use monospace formatting.
- Support horizontal scrolling.
- Render snippets as safe, inert text.
- Never fabricate missing code.

Omitted ranges are separate metadata containing an inclusive line range and explanatory summary.

Example:

```text
35  # Capture the customer's payment.
36  payment = await gateway.capture(
37      customer_id=request.customer_id,
38      amount=amount
39  )

    ... Lines 40–59 omitted ...
    Create the order and update payment metadata.

60  if payment.success:
61      order.status = "PAID"
```

Omitted explanations must be visually distinct from original source lines.

#### D3. Findings

Findings are AI-generated observations associated with the selected node.

A finding may contain:

- Finding ID and title.
- Status or severity, if provided.
- Explanation.
- Source-code evidence.
- Optional recommendation.

**Recommendations belong to findings**, not to an independent recommendation record.

The inspector must distinguish original code evidence from AI-generated interpretations.

### E. Flow Conclusion

**Purpose:** Summarize the investigation result for the selected execution flow.

The conclusion belongs to the `Flow` object, not to an individual node.

Supported levels:

| Conclusion | Meaning |
|---|---|
| `inconclusive` | Insufficient evidence to determine the issue |
| `potential_issues` | Possible problems identified |
| `likely_root_cause` | Evidence suggests a probable cause |
| `confirmed_mismatch` | Code demonstrably contradicts a stated requirement |

A confirmed mismatch does not automatically prove the cause of a production incident.

The conclusion area may display:

- Conclusion level.
- Investigation summary.
- Supporting node references.
- Remaining questions.

Any references to findings must point to existing node findings rather than duplicate analysis data.

---

## 3. Data-to-UI Mapping

FlowLens stores three logical records:

| Record | Responsibility |
|---|---|
| `IssueFlows` | Identifies the flows belonging to a Jira issue and their display order |
| `Flow` | Stores one execution graph, nodes, edges, findings, source code, and conclusion |
| `Analysis` | Stores provenance of the imported AI investigation, such as repository, revision, and summary |

The UI uses those records as follows:

```text
Jira Issue
    │
    ▼
IssueFlows
    │
    └── Flow IDs ────────────────────────────────┐
                                                │
                                                ▼
                                              Flow
                                                │
                  ┌─────────────────────────────┼─────────────────────┐
                  │                             │                     │
                  ▼                             ▼                     ▼
                nodes[]                       edges[]             conclusion
                  │                             │                     │
          ┌───────┴────────┐                    │                     │
          ▼                ▼                    │                     │
        code[]          findings[]              │                     │
                             │                  │                     │
                             ▼                  ▼                     ▼
                         suggestion       Graph connections    Flow Conclusion
                  │
                  ▼
             Node Details

Flow.analysisId ──────▶ Analysis (import provenance)
```

**Important:** The same node data is reused by both the execution card and the Node Details inspector.

The application must not create a second independent copy of findings or recommendations for presentation.

---

## 4. User Interaction Flows

### 4.1 Open FlowLens

1. Jira loads the FlowLens issue panel.
2. FlowLens obtains the issue context.
3. The application loads flows belonging to that issue.
4. The flow selector displays available flows.
5. A selected flow is rendered in the execution graph.
6. Its conclusion becomes visible.

**Current skeleton:** Uses mock flows rather than persisted issue-specific data.

### 4.2 Select a flow

```text
Click flow
    ↓
Update selected flow
    ↓
Update graph nodes and edges
    ↓
Update conclusion
    ↓
Set initial inspectable node
```

### 4.3 Inspect a node

```text
Click execution node
    ↓
Update selected node ID
    ↓
Highlight selected graph node
    ↓
Show Node Details
    ├── Source location
    ├── Original code
    ├── Omitted ranges
    └── Findings and recommendations
```

On narrow screens, Node Details opens as a bottom drawer.

### 4.4 Navigate the graph

- Drag to pan.
- Zoom in or out using controls.
- Use Fit to show the whole graph.
- Select a node without unnecessarily resetting the viewport.

### 4.5 Import a new analysis — Planned

1. Select a JSON file.
2. Validate its structure and relationships.
3. Preserve existing flows.
4. Create new independent flows.
5. Resolve duplicate names with suffixes `(0)`, `(1)`, etc.
6. Update the flow selector.
7. Select a newly imported flow.

No automatic graph merging or replacement.

---

## 5. UI States

| State | Expected behavior |
|---|---|
| Loading | Show progress while resolving issue context or loading flows |
| Empty | Explain that no flows exist and provide inspection/import actions |
| Flow selected | Display graph, conclusion, and relevant node selection |
| Node selected | Highlight the node and show its details |
| Import error | Display precise validation paths and a Copy Error Report action |
| Import success | Add independent flows and show any renames |
| Unauthorized / read failure | Display actionable error without showing stale cross-issue data |
| Delete confirmation | Confirm removal of one flow without affecting others |
| Complex graph | Preserve readable nodes and enable pan/zoom |
| Narrow viewport | Use compact selector, actions menu, and details drawer |

---

## 6. Visual Design Guidelines

Use a modern, high-contrast developer-tool aesthetic appropriate for Jira.

- Crisp typography and clear hierarchy.
- Neutral surfaces with restrained semantic colors.
- Subtle shadows and borders.
- Clearly visible selected states.
- Readable source-code previews.
- Consistent spacing and alignment.
- Distinct styling for findings, suggestions, and errors.
- Accessible focus indicators and interactive controls.

Avoid excessive badges, decorative gradients, unnecessary panels, and unreadably small graph nodes.

The graph should remain the visual focus.

---

## 7. Implementation Mapping

The screen labels describe user-facing responsibilities. React component names and file paths are implementation details that may change during refactoring.

Current UI skeleton responsibilities:

| File | Responsibility |
|---|---|
| `App.tsx` | Application orchestration, shared selection state, header, flow selection, and conclusion |
| `FlowDiagram.tsx` | Execution graph, node rendering, edges, layout, and viewport controls |
| `NodeDetails.tsx` | Selected node information and findings |
| `CodeViewer.tsx` | Original source lines, code previews, and omitted ranges |
| `inspection.ts` | Inspection-related TypeScript contracts |
| `mockInspection.ts` | Deterministic sample flows for UI development |
| `styles.css` | Visual styling and responsive layouts |

These are responsibility boundaries, not requirements to maintain a particular number of components or files.

Prefer simple, cohesive components and avoid unnecessary abstractions.

---

## 8. Acceptance Criteria

The UI should allow a developer to:

1. Identify the current Jira issue.
2. Select among multiple independent execution flows.
3. Understand the main execution path from the graph alone.
4. Follow branches, retries, and failure outcomes.
5. Select an execution node.
6. Inspect original source code with accurate line numbers.
7. Distinguish omitted-code summaries from original code.
8. Read findings, evidence, and recommendations.
9. Understand the selected flow's conclusion.
10. Navigate effectively in both wide and narrow Jira panels.

Test long titles, multiple findings, nested branches, loops, asynchronous edges, disconnected entry points, proposed flows, empty states, and narrow widths.

The graph and inspector display sample flows. Copy and Package use the current Jira issue. JSON import and Forge persistence are planned.