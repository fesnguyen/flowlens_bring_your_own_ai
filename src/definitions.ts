import type { FlowSummary, InstructionPreference, SavedFlow } from '../shared/workspace';
import type { InspectionIssueContext } from '../static/app/src/inspection/issue_context';

export type IssueAttachment = { id: string; filename: string; size?: number };

export type ResolverFailure = { ok: false; message: string };

export type IssueResult = ResolverFailure | {
  ok: true;
  issue: InspectionIssueContext;
  attachments?: IssueAttachment[];
};

export type AttachmentResult = ResolverFailure | {
  ok: true;
  base64: string;
};

export type WorkspaceResult<T> = ResolverFailure | { ok: true; value: T };

// Type-only contract shared with the frontend; no backend code enters its bundle.
export type ResolverDefinitions = {
  listIssueFlows: () => WorkspaceResult<{ issueKey: string; flows: FlowSummary[] }>;
  getIssueFlow: (args: { id: string }) => WorkspaceResult<SavedFlow>;
  importIssueAnalysis: (args: { text: string }) => WorkspaceResult<{ flows: FlowSummary[]; first: SavedFlow; addedCount: number }>;
  deleteIssueFlow: (args: { id: string }) => WorkspaceResult<FlowSummary[]>;
  getCustomInstruction: () => WorkspaceResult<InstructionPreference>;
  saveCustomInstruction: (args: InstructionPreference) => WorkspaceResult<InstructionPreference>;
  getInspectionIssue: (args: { includeAttachments: boolean }) => IssueResult;
  getInspectionAttachment: (args: { attachmentId: string }) => AttachmentResult;
};
