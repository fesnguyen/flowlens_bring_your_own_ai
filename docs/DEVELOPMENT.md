# FlowLens — Development Guide

**Authority:** Level 2 — Development Workflow  
**Parent:** `docs/PROJECT_OVERVIEW.md`  
**Related:** `FORGE_ARCHITECTURE.md`

## 1. Purpose

Provide practical instructions for setting up, developing, testing, debugging, and deploying FlowLens.

This document describes how developers work with the existing Forge application.

It should be updated whenever development tools, configuration, or operational workflows change.

## 2. Required Environment

| Component | Version |
|---|---|
| Node.js | 24.22.3 |
| pnpm | 12.21.0 |
| Atlassian Forge CLI | 15.1.0 |
| TypeScript | 5.9.3 |
| React | 18.3.1 |
| Vite | 7.3.8 |
| Forge runtime | `nodejs24.x` |

The repository's `.node-version` defines the expected Node.js version.

Use pnpm for project dependencies.

## 3. Initial Setup

Clone the repository and install dependencies.

```powershell
git clone https://github.com/fesnguyen/flowlens_bring_your_own_ai.git
cd flowlens_bring_your_own_ai

pnpm install --frozen-lockfile
```

Verify the environment:

```powershell
node --version
pnpm --version
forge --version
```

Authenticate with Atlassian:

```powershell
forge login
```

The Forge app is already registered.

Developers with access to the existing app should reuse its registered app ID rather than creating another registration.

## 4. Important Configuration

### manifest.yml

Defines:

- Jira issue panel.
- Frontend resource.
- Forge resolver.
- Backend runtime.
- Tunnel port.
- Registered Forge application ID.

### tsconfig.json

Controls backend TypeScript settings.

The root configuration must allow Forge to emit JavaScript during bundling.

Do not configure root-level `noEmit: true`, because that previously caused Forge deployment to fail.

The type-check command can still use `tsc --noEmit`.

### static/app/tsconfig.json

Controls frontend TypeScript settings.

### static/app/vite.config.ts

Configures the frontend development server and build output.

The frontend build directory is:

```text
static/app/dist
```

This must match the resource path declared in `manifest.yml`.

The development server uses port 5173.

## 5. Local Development

The recommended development workflow uses two terminals.

### Terminal 1 — Frontend

```powershell
pnpm dev
```

Starts the Vite development server at:

```text
http://localhost:5173
```

This is useful for frontend-only development.

A standalone browser preview does not provide real Jira context or Forge resolver access.

### Terminal 2 — Forge Tunnel

```powershell
pnpm tunnel
```

The tunnel connects the installed Jira development application to the local code.

Open a Jira issue and activate FlowLens to test the application.

Refresh the Jira panel when necessary.

### Development Loop

1. Start Vite.
2. Start Forge Tunnel.
3. Open the FlowLens panel inside Jira.
4. Modify source code.
5. Refresh the panel.
6. Inspect browser and tunnel logs.
7. Run relevant checks before committing.

Manifest and permission changes may require deployment and installation upgrades rather than only a tunnel refresh.

## 6. Testing

### Static Checks

```powershell
pnpm typecheck
pnpm build
pnpm lint
```

These commands validate TypeScript, frontend build output, and Forge configuration.

### End-to-End Smoke Test

On the installed Jira development site:

1. Open a Jira issue.
2. Activate FlowLens.
3. Verify the React interface loads.
4. Verify Forge Bridge obtains Jira context.
5. Verify the current issue key is available.
6. Verify the panel loads saved flows for the issue.
7. Import a v1 or v2 analysis, reload Jira, and verify the saved diagram and its impact highlights.
8. Change and save the custom instruction, open another issue as the same user, and verify the saved text. Then verify a second account starts with its own preference.
9. Remove one saved flow and reload to verify the other flows remain available.

The persistence feature adds the `storage:app` scope and the Custom Entity Store definition. After deploying to development for the first time with these changes, upgrade the existing development installation with `forge install --upgrade --environment development`.
7. Inspect logs for unexpected errors.

A successful local build does not replace testing inside Jira.

### Feature Testing

As product features are implemented, tests should cover their business rules.

**Inspection prompt**

- Correct Jira metadata.
- Proper Markdown formatting.
- Inspection instructions included by default.
- Attachments excluded from clipboard-only export.
- Attachment handling in package export.

**JSON import**

- Valid JSON.
- Invalid JSON.
- Unsupported schema versions.
- Multiple flows in one file.
- Missing or invalid node references.
- Invalid source-code segments.
- Suggested flows and optional relationships.

**Flow management**

- Additive imports.
- Existing flows preserved.
- Duplicate-name suffixes `(0)`, `(1)`, etc.
- Duplicate names within one import.
- Repeated imports.
- Concurrent imports.
- Individual flow deletion.
- Correct issue isolation.

**Visualization**

- Conditional branches.
- Loops and retries.
- Multiple entry points.
- Exceptions and asynchronous transitions.
- Code snippets with original line numbers.
- Correct omitted-line indicators.
- Original versus proposed code.
- Investigation findings and conclusions.

Automated tests should be introduced as implementation complexity grows.

## 7. Debugging

### Frontend

Use browser Developer Tools while the FlowLens panel is open inside Jira.

Inspect:

- Console messages.
- JavaScript errors.
- Network requests.
- React rendering behavior.
- Forge Bridge failures.

### Forge Resolver

During local development, inspect the Forge Tunnel terminal.

Use temporary logging or appropriate debugging tools to trace resolver execution.

For deployed backend logs:

```powershell
forge logs --environment development --tail 50
```

### Build and Deployment

Run:

```powershell
pnpm typecheck
pnpm build
forge lint
```

For additional deployment diagnostics:

```powershell
forge deploy --verbose
```

### Common Failure Categories

| Symptom | First area to inspect |
|---|---|
| React UI does not load | Vite build, browser console |
| Jira context unavailable | Forge Bridge, Jira panel environment |
| Resolver invocation fails | Resolver handler, tunnel, Forge logs |
| Forge bundling fails | Root TypeScript configuration |
| Panel missing in Jira | Installation, manifest module |
| Import fails | JSON validation and resolver logs |
| Saved flows missing | Issue scoping and storage operations |

## 8. Deployment

Build and deploy to the Forge development environment:

```powershell
pnpm deploy
```

The existing project script builds the frontend before deploying.

The app must be installed on the target Jira Cloud site.

If the app is not yet installed on a site:

```powershell
forge install --environment development --product jira --site YOUR-SITE.atlassian.net
```

For changes requiring an installation upgrade:

```powershell
forge install --upgrade --environment development --product jira --site YOUR-SITE.atlassian.net
```

Use the appropriate site hostname and ensure the developer has the necessary permissions.

Deployment to staging or production should follow a separate, explicitly approved process.

## 9. Git Workflow

The repository's `main` branch is the baseline for new work.

Recommended process:

1. Synchronize with `main`.
2. Create a dedicated feature or fix branch.
3. Inspect the relevant source and documentation.
4. Implement the requested change.
5. Update affected lower-level documentation.
6. Run relevant checks.
7. Review the diff for unrelated modifications.
8. Commit and push the branch.
9. Do not merge into `main` without authorization.

Example:

```powershell
git switch main
git pull origin main
git switch -c feature/analysis-import
```

Changes should remain focused and maintainable.

## 10. Coding Guidelines

Prefer straightforward solutions.

- Reuse existing files and components where appropriate.
- Avoid unnecessary abstraction layers.
- Avoid duplicating business logic.
- Keep functions focused on clear responsibilities.
- Use TypeScript contracts for important data structures.
- Validate untrusted input at authoritative boundaries.
- Preserve existing behavior unless a change is explicitly required.
- Add meaningful comments explaining non-obvious logic and execution decisions.
- Avoid comments that merely restate obvious code.

Comments should help developers follow execution from entry point through important branches to the resulting outcome.

## 11. Documentation Maintenance

Before implementation, inspect:

1. `PROJECT_OVERVIEW.md` for product requirements.
2. `FORGE_ARCHITECTURE.md` for architectural decisions.
3. Relevant feature documents for detailed contracts.
4. `DEVELOPMENT.md` for operational instructions.

Update documentation according to the scope of the change.

- Product vision or fundamental requirements → `PROJECT_OVERVIEW.md`.
- Architecture and storage decisions → `FORGE_ARCHITECTURE.md`.
- Development workflow → `DEVELOPMENT.md`.
- JSON contract → `ANALYSIS_SCHEMA.md`.
- Diagram behavior → `FLOW_VISUALIZATION.md`.
- Prompt/export behavior → `INSPECTION_PROMPT.md`.

Do not rewrite the project overview for ordinary implementation changes.

When documentation and source code disagree, inspect the implementation, identify the discrepancy, and resolve it explicitly.

## 12. Development Principles

FlowLens should remain easy to understand, develop, and maintain.

Prioritize:

- A working end-to-end user experience.
- Simple architecture.
- Clear technical contracts.
- Evidence-backed functionality.
- Reliable data management.
- Practical testing.
- Documentation that reflects actual behavior.

Avoid complexity that does not directly support the product.