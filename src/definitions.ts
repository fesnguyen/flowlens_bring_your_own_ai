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

// Type-only contract shared with the frontend; no backend code enters its bundle.
export type ResolverDefinitions = {
  health: () => { message: string };
  getInspectionIssue: (args: { includeAttachments: boolean }) => IssueResult;
  getInspectionAttachment: (args: { attachmentId: string }) => AttachmentResult;
};
