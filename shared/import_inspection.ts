import currentSchema from './flowlens.schema.json';
import legacySchema from './flowlens.v1.schema.json';
import { toInspection, type Inspection, type Investigation, type LegacyInspection, type SourceReference } from './inspection';

type Schema = {
  $ref?: string;
  oneOf?: Schema[];
  type?: string;
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema | undefined>;
  additionalProperties?: boolean;
  items?: Schema;
  prefixItems?: Schema[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  minimum?: number;
};

type AnalysisSchema = Schema & { $defs: Record<string, Schema> };

/**
 * Validate imported data using the same JSON Schema that the AI receives.
 * Only the keywords used by the versioned FlowLens schema are implemented.
 * Keep this validator aligned with the versioned schema when its keywords change.
 */
function validate(value: unknown, rule: Schema, path: string, schema: AnalysisSchema): string | undefined {
  if (rule.$ref) {
    const name = rule.$ref.replace('#/$defs/', '');
    const target = schema.$defs[name];
    return target ? validate(value, target, path, schema) : `Unknown schema reference at ${path}`;
  }
  if (rule.oneOf) {
    const valid = rule.oneOf.filter(option => !validate(value, option, path, schema));
    if (valid.length !== 1) return `${path} must match exactly one allowed shape`;
  }
  if (rule.const !== undefined && value !== rule.const) return `${path} must equal ${String(rule.const)}`;
  if (rule.enum && !rule.enum.includes(value)) return `${path} has an unsupported value`;

  if (rule.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return `${path} must be an object`;
    const record = value as Record<string, unknown>;
    for (const key of rule.required ?? []) {
      if (!Object.hasOwn(record, key)) return `${path}.${key} is required`;
    }
    for (const [key, item] of Object.entries(record)) {
      const property = rule.properties && Object.hasOwn(rule.properties, key)
        ? rule.properties[key] : undefined;
      if (!property) {
        if (rule.additionalProperties === false) return `${path}.${key} is not allowed`;
      } else {
        const error = validate(item, property, `${path}.${key}`, schema);
        if (error) return error;
      }
    }
  } else if (rule.type === 'array') {
    if (!Array.isArray(value)) return `${path} must be an array`;
    if (rule.minItems !== undefined && value.length < rule.minItems) return `${path} has too few items`;
    if (rule.maxItems !== undefined && value.length > rule.maxItems) return `${path} has too many items`;
    for (let index = 0; index < value.length; index++) {
      const itemRule = rule.prefixItems?.[index] ?? rule.items;
      if (itemRule) {
        const error = validate(value[index], itemRule, `${path}[${index}]`, schema);
        if (error) return error;
      }
    }
  } else if (rule.type === 'string') {
    if (typeof value !== 'string') return `${path} must be a string`;
    if (rule.minLength !== undefined && value.length < rule.minLength) return `${path} is too short`;
  } else if (rule.type === 'integer') {
    if (!Number.isInteger(value)) return `${path} must be an integer`;
    if (rule.minimum !== undefined && (value as number) < rule.minimum) return `${path} is below the minimum`;
  }
  return undefined;
}

function checkSource(source: SourceReference | undefined, path: string) {
  if (source?.endLine !== undefined &&
    (source.startLine === undefined || source.endLine < source.startLine)) {
    throw new Error(`Invalid FlowLens analysis: ${path}.endLine must have a startLine and be at least that line.`);
  }
}

/** Validate the version and references before exposing any flows to the viewer. */
export function parseInspection(text: string, expectedIssueKey?: string): Inspection {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid FlowLens analysis: $ must be an object.');
  }
  const version = (value as { version?: unknown }).version;
  if (version !== 1 && version !== 2) {
    throw new Error('Unsupported FlowLens analysis version. Use version 1 or 2.');
  }

  const schema: AnalysisSchema = version === 1 ? legacySchema : currentSchema;
  const error = validate(value, schema, '$', schema);
  if (error) throw new Error(`Invalid FlowLens analysis: ${error}`);

  const inspection = value as LegacyInspection | Investigation;
  if (expectedIssueKey && inspection.issue.key !== expectedIssueKey) {
    throw new Error(`This analysis belongs to ${inspection.issue.key}, not ${expectedIssueKey}.`);
  }

  // JSON Schema validates shapes; these cross-references must also be consistent.
  const flowIds = new Set<string>();
  for (const [flowIndex, flow] of inspection.flows.entries()) {
    if (flowIds.has(flow.id)) throw new Error(`Duplicate flow ID: ${flow.id}`);
    flowIds.add(flow.id);
    const ids = new Set<string>();
    for (const node of flow.nodes) {
      if (ids.has(node.id)) throw new Error(`Duplicate node ID in ${flow.id}: ${node.id}`);
      ids.add(node.id);
    }
    // Impact references resolve within this flow and are independent of execution edges.
    if (inspection.version === 2) {
      for (const [nodeIndex, node] of inspection.flows[flowIndex].nodes.entries()) {
        const path = `$.flows[${flowIndex}].nodes[${nodeIndex}]`;
        checkSource(node.source, `${path}.source`);
        node.content?.forEach((block, index) => checkSource(block.source, `${path}.content[${index}].source`));
        node.impacts?.forEach(({ nodeId }, index) => {
          if (!ids.has(nodeId)) {
            throw new Error(`Invalid FlowLens analysis: ${path}.impacts[${index}].nodeId refers to missing node "${nodeId}".`);
          }
        });
      }
    }
    for (const id of flow.entryNodeIds) {
      if (!ids.has(id)) throw new Error(`Missing entry node ${id} in ${flow.id}`);
    }
    for (const edge of flow.edges) {
      if (!ids.has(edge.source) || !ids.has(edge.target)) {
        throw new Error(`Invalid edge ${edge.source} → ${edge.target} in ${flow.id}`);
      }
    }
    for (const evidence of flow.conclusion?.evidence ?? []) {
      if (!ids.has(evidence.nodeId)) throw new Error(`Missing evidence node ${evidence.nodeId} in ${flow.id}`);
    }
  }
  for (const flow of inspection.flows) {
    if (flow.basedOnFlowId && !flowIds.has(flow.basedOnFlowId)) {
      throw new Error(`Missing original flow ${flow.basedOnFlowId}`);
    }
  }
  return toInspection(inspection);
}
