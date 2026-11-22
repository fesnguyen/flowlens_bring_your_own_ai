# FlowLens — Analysis Schema

**Authority:** Level 3 — Feature Contract  
**Parent:** `docs/PROJECT_OVERVIEW.md`  
**Status:** Proposed Design

## 1. Purpose

Define the structured JSON format produced by an external AI assistant and imported into FlowLens.

The schema must support multiple independently manageable execution flows, flexible investigation content, optional evidence, findings, relative impacts, and optional AI-proposed changes.

This document defines the data contract, not the visualization or persistence implementation.

## 2. JSON Structure

An analysis file contains:

- `version` — Schema version.
- `issue` — Jira issue reference.
- `analysis` — Investigation metadata and overall summary.
- `flows[]` — One or more named execution flows.

Each flow contains:

- `id` — Unique identifier within the imported analysis.
- `name` — Human-readable flow name.
- `type` — `original` or `suggestion`.
- `description` — Purpose and scope.
- `conclusion` — Investigation result, where applicable.
- `entryNodeIds[]` — One or more entry points.
- `nodes[]` — Execution steps.
- `edges[]` — Execution relationships.
- `basedOnFlowId` — Optional reference to an original flow.

All flows remain in one flat array. There is no mandatory grouping or pairing structure.

## 3. Nodes — target contract (planned revision)

A node is an investigation step (file, function, component, operation, condition, error or outcome). The universal target structure contains:

- Required: unique node ID within the flow, meaningful header/title.
- Optional: kind/type, subheader/short responsibility, ordered flexible content blocks, findings, warnings, diagnostics, relative impacts and source references.
- Flexible blocks must preserve their order and representable content without requiring one prescribed AI investigation style.
- An optional impact item identifies a target node, relationship category, possible consequence, rationale, verification guidance and evidence status.

Do not equate an execution edge with a change-impact relationship. Impact references must resolve to known nodes when a target node ID is supplied. AI hypotheses remain labeled as such.

### Compatibility and schema status

**This is the intended next schema, not the current v1 JSON contract.** The existing `shared/flowlens.schema.json` still requires source/code for certain nodes and uses fixed fields. The example below documents **current v1**, not the flexible target. A future implementation task must version or migrate the authoritative schema, update the instruction asset and import validator together, and add compatibility tests. Do not silently loosen documentation while claiming existing imports accept the new shape.

## 4. Optional Source Evidence

File paths, symbol names, line numbers and original code snippets are optional in the target contract. When provided, preserve original code accurately and distinguish AI summaries from source text. Source navigation and line highlighting are deferred. Do not invent missing references.

## 5. Edges

Edges connect nodes and describe execution relationships.

Supported relationships should include:

- Sequential execution.
- Function calls.
- Conditional branches.
- Exceptions.
- Retries and loops.
- Asynchronous transitions.

An edge may include a human-readable condition or label.

Edges must reference valid nodes within their flow. Cross-flow relationships must be represented explicitly rather than using invalid node references.

An asynchronous event must not be presented as a direct function call unless the source code establishes that relationship.

## 6. Investigation Conclusions

Each original flow may contain an investigation conclusion.

Supported levels:

| Level | Meaning |
|---|---|
| `inconclusive` | Insufficient evidence to identify the problem |
| `potential_issues` | Suspicious behavior detected, but cause unverified |
| `likely_root_cause` | Strong evidence supports a likely explanation |
| `confirmed_mismatch` | Direct code evidence contradicts a stated requirement |

Conclusions should contain a summary, supporting evidence, and unresolved questions when applicable.

A confirmed code-level mismatch does not automatically establish the cause of a production incident.

## 7. Findings and Suggestions

Findings belong to the relevant source-code nodes.

A finding should contain:

- Identifier and title.
- Severity, when applicable.
- Evidence status.
- Explanation.
- Source-code references.
- Optional recommended change.

Small fixes should be described within the existing original flow.

A separate suggested flow should be generated only when the proposed solution meaningfully changes execution order, branching, error handling, or another important aspect of the workflow.

Suggested flows are optional.

They must not be represented as existing or verified implementation behavior.

## 8. Example

```json
{
  "version": 1,
  "issue": {
    "key": "SHOP-142"
  },
  "analysis": {
    "repository": "shop-backend",
    "revision": "a4c8f21",
    "summary": "Payment capture precedes inventory reservation."
  },
  "flows": [
    {
      "id": "payment-original",
      "name": "Payment Processing (Original)",
      "type": "original",
      "description": "Current checkout execution.",
      "entryNodeIds": ["capture"],
      "conclusion": {
        "level": "likely_root_cause",
        "summary": "Payment may be captured before stock reservation fails.",
        "evidence": [
          {
            "nodeId": "capture"
          }
        ],
        "remainingQuestions": [
          "Is payment compensation implemented elsewhere?"
        ]
      },
      "nodes": [
        {
          "id": "capture",
          "kind": "operation",
          "title": "Capture Payment",
          "description": "Captures payment before inventory reservation.",
          "source": {
            "file": "app/services/checkout.py",
            "symbol": "CheckoutService.process",
            "startLine": 35,
            "endLine": 61
          },
          "code": [
            {
              "lines": [
                [35, "# Capture the customer's payment through the gateway."],
                [36, "payment = await gateway.capture("],
                [37, "    customer_id=request.customer_id,"],
                [38, "    amount=amount"],
                [39, ")"]
              ]
            },
            {
              "omitted": {
                "startLine": 40,
                "endLine": 59,
                "summary": "Create the order, record transaction details, and update payment metadata."
              }
            },
            {
              "lines": [
                [60, "if payment.success:"],
                [61, "    order.status = 'PAID'"]
              ]
            }
          ],
          "findings": [
            {
              "id": "F-001",
              "severity": "high",
              "status": "suspected",
              "title": "Payment captured before stock reservation",
              "explanation": "A later reservation failure may leave a captured payment.",
              "evidence": [
                {
                  "file": "app/services/checkout.py",
                  "startLine": 35,
                  "endLine": 61
                }
              ],
              "suggestion": "Reserve inventory before capturing payment and define compensation for payment failures."
            }
          ]
        }
      ],
      "edges": []
    }
  ]
}
```

This is an illustrative contract example, not a finding from a real repository.

## 9. Import and Validation Rules

- A JSON file may contain multiple flows.
- Each flow is independently identifiable.
- Flow IDs and node IDs must satisfy their respective uniqueness rules.
- Every edge must reference valid nodes.
- Current v1 requires code evidence; the planned contract will make it optional only after the schema is revised.
- Each source line tuple must contain an actual positive line number and its original text, including any existing code comments.
- Line numbers must be ordered and nonduplicated; omitted ranges must match the gaps between retained lines.
- Omitted-range summaries must be clearly separated from original source-code content.
- Suggested code must be labeled as proposed.
- Invalid data must produce understandable validation errors.
- Importing must not silently overwrite existing flows.

The JSON schema defines the input contract. Storage-generated identifiers and duplicate-name resolution belong to the Forge architecture.

## 10. Evolution

Schema changes must be versioned.

Breaking changes require explicit compatibility or migration decisions.

This document may evolve independently of `PROJECT_OVERVIEW.md` provided the fundamental product requirements remain unchanged.