import { useEffect, useRef, useState } from 'react';
import schemaText from '../../../shared/flowlens.schema.json?raw';
import type { ResolverDefinitions } from '../../../src/definitions';
import { buildCopyContext, buildInspectionMaterials } from './inspection/context_builder';
import { collectAttachments, copyPrompt } from './inspection/inspection_actions';
import { buildInspectionPackage } from './inspection/package_builder';

export type InspectionAction = 'copy' | 'export';

type Feedback = {
  message: string;
  error?: boolean;
  prompt?: string;
  download?: { url: string; filename: string };
};

export function useInspectionActions() {
  const [busy, setBusy] = useState<InspectionAction>();
  const [feedback, setFeedback] = useState<Feedback>();
  const running = useRef(false);
  const downloadUrl = useRef<string>();
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    };
  }, []);

  async function run(action: InspectionAction) {
    if (running.current) return;
    running.current = true;
    setBusy(action);
    setFeedback(undefined);
    if (downloadUrl.current) {
      URL.revokeObjectURL(downloadUrl.current);
      downloadUrl.current = undefined;
    }

    let errorMessage = 'Open FlowLens from a Jira issue and try again.';
    try {
      // Both actions use the same issue and schema pipeline. Only export requests attachment metadata.
      const preparation = import('@forge/bridge').then(async ({ makeInvoke }) => {
        const invoke = makeInvoke<ResolverDefinitions>();
        errorMessage = 'Could not load the Jira issue. Check your Jira access and try again.';
        const result = await invoke('getInspectionIssue', { includeAttachments: action === 'export' });
        if (!result.ok) {
          errorMessage = result.message;
          throw new Error(result.message);
        }
        errorMessage = 'Could not prepare the inspection materials. Try again.';
        return { invoke, result, materials: buildInspectionMaterials(result.issue, schemaText) };
      });

      if (action === 'copy') {
        const copy = await copyPrompt(preparation.then(({ materials }) => buildCopyContext(materials)),
          navigator.clipboard);
        if (active.current) setFeedback(copy.copied
          ? { message: 'Inspection prompt copied.' }
          : { message: 'Clipboard access was blocked. Copy the selected prompt below.', prompt: copy.text });
        return;
      }

      const { invoke, result, materials } = await preparation;
      errorMessage = 'Could not create the inspection ZIP. Try again.';
      if (active.current) setFeedback({ message: 'Preparing attachments…' });
      const listingError = result.attachments ? undefined : 'Jira did not return the attachment list.';
      const attachments = await collectAttachments(materials, result.attachments ?? [],
        attachmentId => invoke('getInspectionAttachment', { attachmentId }));
      if (!active.current) return;

      const { archive, skipped } = buildInspectionPackage(materials, attachments, listingError);
      const filename = `flowlens-inspection-${result.issue.key.replace(/[^a-z0-9_-]/gi, '_')}.zip`;
      const url = URL.createObjectURL(archive);
      downloadUrl.current = url;

      // Keep the visible link available when the browser requires a fresh click.
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }

      const message = listingError ? 'Package ready. Jira could not list attachments. See manifest.json.'
        : skipped ? `Package ready. ${skipped} of ${attachments.length} attachments skipped. See manifest.json.`
          : 'Inspection package ready.';
      setFeedback({ message, download: { url, filename } });
    } catch {
      if (active.current) setFeedback({ message: errorMessage, error: true });
    } finally {
      running.current = false;
      if (active.current) setBusy(undefined);
    }
  }

  return { busy, feedback, run, dismissFeedback: () => setFeedback(undefined) };
}
