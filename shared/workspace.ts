import type { AnalysisProvenance, Flow } from './inspection';

export type FlowSummary = Pick<Flow, 'name' | 'type'> & {
  id: string;
  conclusion?: NonNullable<Flow['conclusion']>['level'];
};

export type SavedFlow = {
  id: string;
  flow: Flow;
  analysis: AnalysisProvenance;
  basedOnId?: string;
};

export type InstructionPreference = { text: string; revision: string | null };
export const defaultPreference: InstructionPreference = { text: '', revision: null };
export const maxInstructionBytes = 32 * 1024;
// Forge serializes the JSON text again inside the invocation payload.
export const maxImportPayloadBytes = 450_000;
export const maxImportFlows = 24;
export const maxRecordBytes = 220 * 1024;

export function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function summarizeFlow({ id, flow }: SavedFlow): FlowSummary {
  return { id, name: flow.name, type: flow.type, conclusion: flow.conclusion?.level };
}

export function validateInstruction(value: unknown): string {
  if (typeof value !== 'string' || value.includes('\0') || new TextEncoder().encode(value).byteLength > maxInstructionBytes) {
    throw new Error('Use plain text or Markdown of up to 32 KiB for your custom instruction.');
  }
  return value.trim();
}
