import type { AttachmentResult, IssueAttachment } from '../../../../src/definitions';
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, MAX_PACKAGE_BYTES } from '../../../../shared/inspection_limits';
import type { InspectionMaterials } from './context_builder';
import type { InspectionAttachment } from './package_builder';

/** Download only files that can fit, and hold at most one encoded response at a time. */
export async function collectAttachments(
  materials: InspectionMaterials,
  attachments: IssueAttachment[],
  download: (id: string) => Promise<AttachmentResult>,
): Promise<InspectionAttachment[]> {
  const encoder = new TextEncoder();
  let remaining = MAX_PACKAGE_BYTES - [materials.instruction, materials.issue, materials.schema]
    .reduce((sum, text) => sum + encoder.encode(text).byteLength, 0);
  let attempted = 0;
  const results: InspectionAttachment[] = [];
  for (const { id, filename, size } of attachments) {
    if (!id || size === undefined || !Number.isSafeInteger(size) || size < 0) {
      results.push({ filename, status: 'failed', reason: 'Jira did not return the attachment ID or size.' });
      continue;
    }
    const reason = size > MAX_ATTACHMENT_BYTES ? 'Attachment exceeds the 3 MiB limit'
      : attempted >= MAX_ATTACHMENTS ? 'Attachment count limit exceeded'
      : size > remaining ? 'Package size limit exceeded' : undefined;
    if (reason) {
      results.push({ filename, status: 'excluded', reason });
      continue;
    }
    attempted++;
    try {
      const result = await download(id);
      if (!result.ok) {
        results.push({ filename, status: 'failed', reason: result.message });
        continue;
      }
      const decoded = atob(result.base64);
      if (decoded.length !== size) {
        results.push({ filename, status: 'failed', reason: 'Attachment size changed during export.' });
        continue;
      }
      const data = new Uint8Array(size);
      for (let index = 0; index < size; index++) data[index] = decoded.charCodeAt(index);
      results.push({ filename, status: 'included', data });
      remaining -= data.byteLength;
    } catch {
      results.push({ filename, status: 'failed', reason: 'Jira could not download the attachment.' });
    }
  }
  return results;
}

/** Start a deferred clipboard write during the click for browsers that require user activation. */
export async function copyPrompt(
  prompt: Promise<string>,
  clipboard?: Pick<Clipboard, 'write' | 'writeText'>,
): Promise<{ copied: true } | { copied: false; text: string }> {
  if (clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const content = prompt.then(text => new Blob([text], { type: 'text/plain' }));
    try {
      // Keep API failure separate from issue-loading failures, which still surface to the caller.
      await Promise.all([content, clipboard.write([new ClipboardItem({ 'text/plain': content })])]);
      return { copied: true };
    } catch {
      void content.catch(() => {});
    }
  }

  const text = await prompt;
  try {
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return { copied: true };
    }
  } catch {
    // The caller displays the exact same text for manual copying.
  }
  return { copied: false, text };
}
