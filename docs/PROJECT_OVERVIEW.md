# FlowLens — Bring Your Own AI

**Document:** PROJECT_OVERVIEW.md  
**Authority:** Level 1 — Highest  
**Status:** Product Source of Truth  
**Repository:** https://github.com/fesnguyen/flowlens_bring_your_own_ai

---

## 1. Project Vision

FlowLens (Bring Your Own AI) helps developers investigate an issue by mapping the relevant system behavior into an understandable, connected diagram. The objective is developer understanding and informed change decisions, not automatic bug fixing.

Jira Cloud is the initial integration and issue entry point; the investigation model is general-purpose and must not require Jira-specific concepts in every node.

The developer brings an AI assistant with access to their code. The AI investigates and returns structured analysis. FlowLens validates and visualizes it. The developer verifies assumptions, understands relationships and relative impact, and chooses a solution.

## 2. Core Philosophy

### Bring Your Own AI

Users should be able to use their preferred AI assistant to investigate their own source code.

FlowLens does not require users to connect their repositories or configure an AI provider inside the application.

The user's AI assistant is responsible for inspecting the source code.

FlowLens is responsible for preparing inspection instructions, accepting the results, and presenting them in a structured, understandable way.

### Evidence Over Assumptions

Execution flows must be grounded in actual source code.

Source references, file paths, line numbers and code snippets are optional investigation content, not universal node requirements. Source navigation is deferred. Never present an AI assertion as verified repository evidence.

AI-generated explanations must remain distinguishable from source-code evidence.

Potential issues must be identified as findings or hypotheses, not automatically treated as confirmed bugs.

### Simplicity and Speed

The primary experience should require as few steps as possible.

Avoid unnecessary configuration, manual workflow construction, and repeated data entry.

Users should spend their time understanding code rather than operating the tool.

## 3. Target Users

FlowLens is intended for developers who need to understand unfamiliar or complex codebases.

Common situations include:

- Investigating bugs reported in Jira.
- Understanding existing business logic before implementing changes.
- Reviewing execution paths across multiple files and functions.
- Identifying conditions, edge cases, and potential failure points.
- Onboarding into unfamiliar codebases.
- Communicating technical findings with other developers.

## 4. Core User Workflow

### Step 1 — Open a Jira Issue

The user opens an existing Jira issue and accesses FlowLens.

FlowLens uses the issue's available context to prepare source-code inspection instructions.

### Step 2 — Prepare the AI Inspection Request

FlowLens provides two actions.

**Copy Inspection Prompt**

Copies a structured Markdown prompt containing:

- Relevant Jira issue information.
- Issue description and available metadata.
- Instructions for investigating the source code.
- Requirements for execution-flow analysis.
- The expected structured output format.

Attachments are excluded from this action.

**Export Inspection Package**

Produces a downloadable package containing the same inspection instructions and issue context, together with available issue attachments.

The package should preserve useful evidence, including images and documents.

Large images may be optimized when appropriate without losing information necessary for investigation.

Both actions share the same core inspection instructions.

Users may provide additional context directly to their preferred AI assistant.

### Step 3 — Inspect Source Code Using External AI

The user provides the inspection request to an AI assistant with access to the relevant source-code repository.

The AI investigates the implementation and identifies relevant execution paths.

The investigation should include:

- Entry points and exit points.
- Relevant files, classes, and functions.
- Function calls and execution order.
- Conditional branches and alternative paths.
- Error handling and important edge cases.
- Potential issues and their supporting evidence.

The AI returns a structured JSON file following the FlowLens analysis contract.

A single JSON file may contain multiple named execution flows.

### Step 4 — Import the Analysis

The user imports the generated JSON into FlowLens.

FlowLens validates the analysis and presents the available execution flows for the current Jira issue.

Users can import additional flows without automatically replacing existing ones.

Each flow is independently manageable.

Users must be able to view and remove individual flows, including incorrect or outdated analyses.

### Step 5 — Explore Execution Flows

The user selects an execution flow and explores its interactive diagram.

The diagram should make execution order and relationships between code components easy to understand.

Users should be able to identify:

- Where execution begins.
- Which functions or methods are involved.
- How execution moves between nodes.
- Which conditions determine different paths.
- Where execution ends or fails.
- Which parts of the implementation may contain problems.

Each node should explain its responsibility and relevant behavior. Optional details may include code, evidence, warnings and relative impact; source navigation is deferred.

## 5. Execution Flow Requirements

### Multiple Named Flows

One Jira issue may contain multiple execution flows.

Each flow must have a meaningful name describing the behavior or scenario it represents.

For example, an authentication issue might contain:

- User Login
- Token Validation
- Token Refresh
- Authentication Error Handling

A single imported JSON file may contain several flows.

Additional imports may contribute new flows to the same issue.

### Nodes and Connections

An execution flow consists of connected nodes.

Nodes represent meaningful execution steps, such as function calls, conditions, important operations, and outcomes.

Connections represent execution relationships, including conditional branches.

The diagram must communicate actual execution logic rather than merely listing related functions.

### Flexible Investigation Nodes

Each node has an identifier, a header/title, an optional subheader/short responsibility, and optional ordered additional-information blocks. The AI may supply explanations, conditions, code, diagnostics, warnings, scenarios, and change considerations. The format must accommodate diverse user AI instructions without requiring every possible content type.

Nodes can represent files, functions, components, decisions, operations, or outcomes. Relationships and execution order are explicit; do not confuse an execution edge with proof of change impact. A diagram should cover all identifiable relevant parts of the investigated behavior, while distinguishing confirmed relationships from hypotheses.

Source references and code navigation are optional and deferred; do not require them to import or display a node.

### Relative Impact

When a developer considers changing a node, optional impact analysis identifies potentially affected nodes, relationship types (such as caller, dependency, shared state or downstream behavior), reasons, and recommended verification. An impact can exist without a direct execution edge. Impacts are AI assessments unless independently verified.

### Potential Issues

Potential problems should be associated with the relevant execution nodes.

Each finding should explain the suspected problem and identify supporting source-code evidence.

FlowLens must distinguish between verified implementation behavior and AI-generated interpretations or hypotheses.

The user remains responsible for evaluating whether a potential issue is valid.

## 6. Analysis Management

Execution flows belong to the Jira issue being investigated.

Users should be able to:

- View all saved flows for an issue.
- Select and explore individual flows.
- Import additional analyses.
- Remove individual flows.
- Preserve existing flows unless replacement or deletion is explicitly requested.

FlowLens should support analyses evolving over time without forcing users to regenerate or replace everything.

The application should avoid unnecessary duplication and provide clear handling of invalid or incompatible analysis data.

## 7. Product Boundaries

FlowLens is primarily a visualization and investigation tool.

The initial product does not require:

- Built-in AI model execution.
- AI provider API keys.
- Direct source-code repository integration.
- Automatic repository scanning.
- Source-code modification.
- Runtime debugging.
- Full IDE functionality.
- Manual construction of execution diagrams.

These capabilities may be reconsidered in the future, but they are not necessary to deliver the core product value.

## 8. Product Success Criteria

FlowLens succeeds when a developer can:

1. Open a Jira issue.
2. Prepare an AI inspection request with minimal effort.
3. Use their preferred AI assistant to investigate the actual source code.
4. Import a structured analysis containing one or more execution flows.
5. Understand the relevant execution paths through interactive diagrams.
6. Review responsibilities, relationships, potential issues, and optional supporting evidence without constantly switching tools.
7. Manage multiple analyses independently within the same issue.

The experience should be straightforward, trustworthy, and useful even when the developer is unfamiliar with the codebase.

## 9. Documentation Authority

This document is the highest-level source of truth for FlowLens.

It defines:

- Product vision.
- Core philosophy.
- Target users.
- Fundamental workflows.
- Product requirements.
- Product boundaries.

Changes to implementation details must not automatically change this document.

Update `PROJECT_OVERVIEW.md` only when the product vision, fundamental behavior, or scope changes.

Lower-level documents define how these requirements are implemented.

The documentation hierarchy is:

1. **PROJECT_OVERVIEW.md** — Product vision and fundamental requirements.
2. **FORGE_ARCHITECTURE.md** — Application architecture and technical responsibilities.
3. **DEVELOPMENT.md** — Development environment, testing, debugging, and deployment.
4. **Feature documentation** — Detailed feature contracts, behaviors, and implementation decisions.

Lower-level documents must remain consistent with this overview.

When documentation conflicts, the higher-level product requirements take precedence. Actual source code must still be inspected to establish current implementation behavior, and discrepancies must be resolved explicitly.

## 10. Guiding Principle

**FlowLens exists to help developers understand issues, relevant system behavior, and the potential impact of changes using their own AI.**

Every product decision should support that goal.