# FlowLens — Bring Your Own AI

FlowLens helps developers investigate issues, understand relevant system behavior, and assess the potential impact of changes using their own AI. Jira Cloud is the initial integration, built with Atlassian Forge for Codegeist 2026.

The product direction is documented in [Project Overview](docs/PROJECT_OVERVIEW.md), [Flow Visualization](docs/features/FLOW_VISUALIZATION.md), and [Analysis Schema](docs/features/ANALYSIS_SCHEMA.md). The intended flexible node model and relative-impact view are planned; the bundled v1 JSON Schema still has stricter source-evidence requirements. Source references are optional in the target design and direct source navigation is deferred. See the feature and implementation documents for status and compatibility.

## Environment

| Component | Version |
| --- | --- |
| Node.js | **24.22.3** (`.node-version`: `v24.22.3`) |
| pnpm | **12.21.0** |
| Forge CLI | **15.1.0** |
| Forge runtime | `nodejs24.x` |
| React / React DOM | 18.3.1 |
| TypeScript | 5.9.3 |
| Vite | 7.3.8 |
| Forge Bridge / Resolver | 7.3.0 / 2.0.2 |

Direct dependencies are pinned; `pnpm-lock.yaml` pins the dependency graph. One root
package manages the frontend and resolver. `pnpm-workspace.yaml` records pnpm 12
settings and dependency build-script decisions; there are no workspace subpackages.
React 18 satisfies the peer requirements of Forge Bridge's Atlaskit dependencies.
Vite's built-in TSX transform keeps the build minimal; the React refresh plugin is
omitted to avoid its prerelease transitive dependencies. Refresh the panel after edits.
No Jira API requests are made, so no scopes, external egress permissions, or direct
`@forge/api` dependency are needed.

## Install and check

Select Node.js 24.22.3 with your Node version manager. Install/activate pnpm 12.21.0
(for example, `corepack enable` followed by `corepack install --global pnpm@12.21.0`
if Corepack is available), then install the CLI:

```sh
npm install --global @forge/cli@15.1.0
node --version
pnpm --version
forge --version
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

Use pnpm for all project dependencies. npm above is only for the global Forge CLI.
The project enforces the required Node/pnpm engines and strict peer dependencies.
Build output is `static/app/dist`, matching the manifest resource path. Generated
assets, `node_modules`, and local secrets are ignored by Git.

## Register, deploy, and install

**Registration is pending:** this bootstrap has no registered `app.id`. Lint and
deployment cannot complete until it is supplied. No fabricated ID is committed.

1. Run `forge login` on your machine and follow the interactive authentication
   prompts. Keep tokens out of Git and do not paste them into project files.
2. Check the [Atlassian developer console](https://developer.atlassian.com/console/myapps/)
   for an existing FlowLens registration. If one exists, copy its registered app ARI
   into `app.id` in `manifest.yml`; make sure your account has access. **Do not run
   `forge register` again for that app.**
3. Only if no registration exists, run the following once and complete any
   Developer Space/account prompts. The CLI writes the real ID into the manifest:

   ```sh
   forge register "FlowLens"
   ```

4. Commit the resulting `app.id` on this branch so collaborators reuse the same app.
   The app ID is an identifier, not a credential. Then run:

   ```sh
   pnpm build
   pnpm lint
   pnpm deploy
   forge install --environment development --product jira --site YOUR-SITE.atlassian.net
   ```

   Replace `YOUR-SITE.atlassian.net` with your Jira Cloud test site. Installation
   requires account/site permissions and may prompt for consent. `pnpm deploy`
   rebuilds before deploying to the development environment. Later, use
   `forge install --upgrade --environment development --product jira --site YOUR-SITE.atlassian.net`
   when an installed app needs a manifest/permission upgrade.

Open a Jira issue and select **FlowLens** in its Apps/action menu to show the panel.
Confirm the product heading, Bridge connected status, current issue key (when
present in the context), and **Hello from the FlowLens Forge resolver.** This is the
required end-to-end smoke check; a local build alone does not prove Jira connectivity.

## Local development

After the initial registration, deployment, and Jira installation, use two terminals
from the repository root:

```sh
# Terminal 1: Vite on localhost:5173 (fixed to match manifest.yml)
pnpm dev
```

```sh
# Terminal 2: proxy the installed Jira panel and resolver to local code
pnpm tunnel
```

Refresh the panel **inside Jira** to test Bridge and resolver calls. Opening
`http://localhost:5173` directly only previews the layout; it cannot provide Forge
context or backend communication. Tunnel requires Forge authentication and network
access. If Vite hot reload is unavailable through the tunnel, refresh the Jira panel.
Manifest changes require redeployment and sometimes an installation upgrade.

## Commands and structure

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install reproducibly |
| `pnpm dev` | Start Vite |
| `pnpm typecheck` | Check backend, frontend, and Vite configuration |
| `pnpm build` | Type-check and build the frontend |
| `pnpm lint` | Run Forge lint (requires real app registration) |
| `pnpm deploy` | Build and deploy to Forge development |
| `pnpm tunnel` | Start the development tunnel |

- `src/index.ts`: resolver definitions and the exported Forge handler.
- `src/definitions.ts`: shared type contract for the Bridge/resolver connection.
- `static/app/`: React/TypeScript UI, HTML entry, Vite configuration, and frontend TypeScript configuration.
- `manifest.yml`: Jira issue panel, resolver handler, static resource, tunnel port, and Node.js runtime.
- `package.json`, `pnpm-lock.yaml`: shared dependencies and development commands.
- `tsconfig.json`: backend TypeScript checks; Forge bundles the handler during deployment.

## License

MIT. See [LICENSE](LICENSE).
