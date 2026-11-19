import schemaText from '../../../../shared/flowlens.schema.json?raw';
import type { Inspection } from '../inspection';

type Schema = {
  $ref?: string;
  oneOf?: Schema[];
  type?: string;
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean;
  items?: Schema;
  prefixItems?: Schema[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  minimum?: number;
};

const schema = JSON.parse(schemaText) as Schema & { $defs: Record<string, Schema> };

/**
 * Validate imported data using the same JSON Schema that the AI receives.
 * Only the keywords used by the versioned FlowLens schema are implemented.
 * Keep this validator aligned with the versioned schema when its keywords change.
 */
function validate(value: unknown, rule: Schema, path: string): string | undefined {
  if (rule.$ref) {
    const name = rule.$ref.replace('#/$defs/', '');
    const target = schema.$defs[name];
    return target ? validate(value, target, path) : `Unknown schema reference at ${path}`;
  }
  if (rule.oneOf) {
    const valid = rule.oneOf.filter(option => !validate(value, option, path));
    if (valid.length !== 1) return `${path} must match exactly one allowed shape`;
  }
  if (rule.const !== undefined && value !== rule.const) return `${path} must equal ${String(rule.const)}`;
  if (rule.enum && !rule.enum.includes(value)) return `${path} has an unsupported value`;

  if (rule.type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return `${path} must be an object`;
    const record = value as Record<string, unknown>;
    for (const key of rule.required ?? []) {
      if (!(key in record)) return `${path}.${key} is required`;
    }
    for (const [key, item] of Object.entries(record)) {
      const property = rule.properties?.[key];
      if (!property) {
        if (rule.additionalProperties === false) return `${path}.${key} is not allowed`;
      } else {
        const error = validate(item, property, `${path}.${key}`);
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
        const error = validate(value[index], itemRule, `${path}[${index}]`);
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

/** Parse and validate the analysis before replacing any visible application state. */
export function parseInspection(text: string, expectedIssueKey?: string): Inspection {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }

  const error = validate(value, schema, '$');
  if (error) throw new Error(`Invalid FlowLens analysis: ${error}`);

  const inspection = value as Inspection;
  if (expectedIssueKey && inspection.issue.key !== expectedIssueKey) {
    throw new Error(`This analysis belongs to ${inspection.issue.key}, not ${expectedIssueKey}.`);
  }

  // JSON Schema validates shapes; these cross-references must also be consistent.
  const flowIds = new Set<string>();
  for (const flow of inspection.flows) {
    if (flowIds.has(flow.id)) throw new Error(`Duplicate flow ID: ${flow.id}`);
    flowIds.add(flow.id);
    const ids = new Set<string>();
    for (const node of flow.nodes) {
      if (ids.has(node.id)) throw new Error(`Duplicate node ID in ${flow.id}: ${node.id}`);
      ids.add(node.id);
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
  return inspection;
}
