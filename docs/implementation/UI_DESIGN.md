# UI Design — Implementation Specification

**Status:** Implemented for the open panel. Forge-backed flow management is planned.
**Parents:** [Flow Visualization](../features/FLOW_VISUALIZATION.md), [Inspection Prompt](../features/INSPECTION_PROMPT.md)

| Area | Behavior |
|---|---|
| Header | Current Jira issue, Copy Inspection Prompt, Export Inspection Package and Import JSON. A compact action menu serves narrow panels. |
| Investigation instructions | Select the built-in foundation or a custom preference, add a pasted instruction, import a text or Markdown file, and remove a selected preference. |
| Execution flows | Select independent flows from the list or narrow-panel dropdown. Remove the selected imported flow from the current panel. |
| Diagram | Follow left-to-right execution, labeled branches and retry or async paths. Pan, zoom and fit controls keep larger graphs accessible. |
| Node cards | Read the title, optional type or sequence, responsibility and brief context. Investigation notes surface warnings, diagnostics or findings. |
| Node details | Expand ordered content blocks, review optional source evidence, and inspect the selected node's AI-assessed impacts. |
| Flow conclusion | Review the optional AI assessment, evidence nodes and remaining questions. |

Selecting a node shows its details in the right panel or a compact drawer. Opening the drawer places focus on its heading. Escape and the close button restore focus to the selected card when it remains available.

Potentially impacted targets are outlined and labeled without rerouting arrows, resizing cards, or changing the viewport. Impact details show the target, relationship, consequence, reasoning, and available verification or evidence. Imported source snippets remain readable as text. Direct source navigation is deferred.

The standalone preview includes fictional v1 flows for layout and compatibility checks. In Jira, the panel starts with an empty flow list and shows imported flows for the current issue. Validation feedback leaves prior imports in place. Saved flows, persistent deletion, and saved-flow JSON export are planned.

| Source | Responsibility |
|---|---|
| `App.tsx` | Jira context, import and selection state, responsive navigation, panel feedback |
| `InstructionSettings.tsx` | Instruction selection, addition, import and removal |
| `FlowDiagram.tsx` | Dagre layout, React Flow nodes, impact marks, edge and viewport interactions |
| `NodeDetails.tsx`, `CodeViewer.tsx` | Ordered content, impacts, source references and legacy v1 evidence |
| `inspection/` | Versioned import, flow list and impact selection, instruction preferences, Copy and ZIP assembly |
