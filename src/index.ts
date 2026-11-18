import { makeResolver } from '@forge/resolver';
import type { ResolverDefinitions } from './definitions';

// Forge resolves `index.handler` from src/index.ts and bundles the TypeScript.
export const handler = makeResolver<ResolverDefinitions>({
  // This deliberately makes no Jira API calls, so the bootstrap needs no scopes.
  health: () => ({ message: 'Hello from the FlowLens Forge resolver.' }),
});
