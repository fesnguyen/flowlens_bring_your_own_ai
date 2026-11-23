# Analysis Import Pipeline

**Status:** Implemented for v1 and v2 analyses.
**Parents:** [Analysis Schema](../features/ANALYSIS_SCHEMA.md), [Data Storage](DATA_STORAGE.md)

1. The user selects an analysis with **Import JSON**. The browser checks the file and serialized request size and sends the JSON text to the resolver.
2. The resolver reads the stable issue ID and user identity from Forge context, checks Jira access as the current user, and obtains the current Jira issue key.
3. Shared validation checks the schema version, shape, current issue key, and graph references. The adapter translates v1 and v2 into the same viewer contract.
4. The storage service reads the issue directory, assigns stable UUIDs and unique display names, and commits the new directory and graphs in one transaction.
5. The panel updates the flow list and opens the first new flow after confirmation. Later panel openings load the saved directory automatically.

Each successful import adds independent flows. If a name already exists, the resolver adds the first available suffix starting at `(0)`. IDs within an imported file are retained for graph references. A suggestion that references another flow in the same file also receives the corresponding saved UUID.

Validation errors leave saved flows intact and identify the affected field or relationship. If a write result cannot be confirmed, reload the saved list before retrying. The standalone preview also accepts analysis JSON for graph testing and discards those edits when reloaded.

See [Data Storage](DATA_STORAGE.md) for limits and concurrency. Saved-flow export is a separate future operation. **Export Inspection Package** prepares inputs for an external AI.
