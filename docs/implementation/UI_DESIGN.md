# UI Design

**Status:** Implemented in Jira Custom UI and the standalone preview.
**Parents:** [Flow Visualization](../features/FLOW_VISUALIZATION.md), [Inspection Prompt](../features/INSPECTION_PROMPT.md)

| Area | Behavior |
|---|---|
| Header | Compact FlowLens identity, issue key, Copy Inspection Prompt, Export Inspection Package, Import JSON and instruction settings |
| Settings | Collapsible header panel with one private multiline preference and Save, Cancel, and Reset to Default |
| Loading and empty states | Show progress while loading saved flows. Once an empty list is confirmed, offer Copy prompt and Import JSON with a short explanation. |
| Saved flows | Select a flow from the sidebar or the narrower layout's dropdown. Confirm before removing an individual flow. |
| Diagram | Prioritize the graph canvas and retain pan, zoom, fit, labeled branches, and distinct impact outlines |
| Details | Inspect ordered blocks, optional source evidence, warnings, findings, and AI-assessed relative impact in a distinctly marked section |
| Feedback | Announce operation status, show actionable validation and storage errors, and retain unsaved instruction edits after a failed write |

The UI uses shared color, surface, spacing and control styles. Wide issue panels show a sidebar, graph and inspector. Narrow panels put the flow selector above the graph and use a bottom drawer for details. The settings panel overlays the workspace and leaves the diagram in place. Escape or the close button dismisses settings or node details and restores focus.

Opening a Jira issue automatically retrieves its saved flows. The standalone preview displays fictional v1 flows for layout and compatibility checks and keeps preview edits in memory. Direct source navigation and saved-flow JSON export are deferred.

| Source | Responsibility |
|---|---|
| `App.tsx`, `styles.css` | Panel layout, actions, navigation and feedback |
| `useWorkspace.ts` | Resolver requests, asynchronous flow selection and confirmed write state |
| `InstructionSettings.tsx` | Private preference editor and draft handling |
| `FlowDiagram.tsx`, `NodeDetails.tsx`, `CodeViewer.tsx` | Execution graph, impact marks and node evidence |
