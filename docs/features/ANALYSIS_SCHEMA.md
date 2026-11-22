# FlowLens — Analysis Schema

**Authority:** Level 3 — Feature Behavior
**Parent:** [Project Overview](../PROJECT_OVERVIEW.md)
**Status:** v2 implemented, v1 import supported.

## Contract

Copy Inspection Prompt and Export Inspection Package deliver the exact [v2 JSON Schema](../../shared/flowlens.schema.json). The analysis contains `version: 2`, `issue.key`, `analysis.summary`, and at least one named flow. Repository and revision are optional provenance. The importer also accepts files that satisfy the original [v1 JSON Schema](../../shared/flowlens.v1.schema.json).

| Field | Meaning |
|---|---|
| `flows[].id`, `name`, `description`, `type` | File-local identity and context for an independently selectable original or suggested flow |
| `entryNodeIds`, `edges` | Execution graph with explicit entry points, endpoints and optional labels; branch, retry and async edges have a `kind` |
| `nodes[].id`, `title` | Required node identity and label |
| `kind`, `sequence`, `subheader` | Optional node type, zero-based reading order, and responsibility or context |
| `source` | Optional reference with file and optional symbol, start line and end line |
| `content[]` | Ordered blocks, each with `type` and `text`, plus optional `title`, `status` and `source` |
| `impacts[]` | Optional assessments, each with `nodeId`, `relationship`, `consequence`, `reason`, and optional `verification`, `status`, and `evidence` |
| `conclusion`, `basedOnFlowId` | Optional AI assessment and optional link to an original flow in the same file |

Content types are open-ended. The viewer displays `code` as preformatted text and calls out `warning`, `diagnostic`, and `finding` on the node card. Other types render as readable text. Source references are descriptive. Direct code navigation is deferred.

Impact targets must exist in the same flow. The target may be related through shared state, a caller, downstream behavior, or another relationship with no direct execution edge. Supported status values are `hypothesis`, `supported`, and `uncertain`. These labels reflect the AI's assessment. FlowLens checks the reference and displays the imported claims for developer verification.

## Example

```json
{
  "version": 2,
  "issue": { "key": "AUDIO-42" },
  "analysis": { "summary": "Trace the device selection and playback result." },
  "flows": [{
    "id": "playback",
    "name": "Audio playback",
    "type": "original",
    "description": "Follow the selected output device.",
    "entryNodeIds": ["select"],
    "nodes": [
      {
        "id": "select",
        "title": "Select output device",
        "kind": "decision",
        "sequence": 0,
        "subheader": "Resolve the configured device.",
        "content": [{ "type": "condition", "text": "The device must be available." }],
        "impacts": [{
          "nodeId": "play",
          "relationship": "downstream consumer",
          "consequence": "Playback could use a different device.",
          "reason": "Playback receives the device identifier selected here.",
          "verification": "Switch the configured device and start playback.",
          "status": "hypothesis"
        }]
      },
      { "id": "play", "title": "Start playback" },
      { "id": "skip", "title": "Skip playback" }
    ],
    "edges": [
      { "source": "select", "target": "play", "kind": "branch", "label": "Available" },
      { "source": "select", "target": "skip", "kind": "branch", "label": "Unavailable" }
    ]
  }]
}
```

See [JSON Schema and Validation](../implementation/JSON_SCHEMA_VALIDATION.md) for version dispatch, compatibility and error handling.
