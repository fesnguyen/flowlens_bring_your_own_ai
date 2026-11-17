// Type-only contract shared with the frontend; no backend code enters its bundle.
export type ResolverDefinitions = {
  health: () => { message: string };
};
