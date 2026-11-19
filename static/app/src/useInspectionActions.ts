
import { useEffect, useRef, useState } from 'react';
import schemaText from '../../../shared/flowlens.schema.json?raw';
import type { ResolverDefinitions } from '../../../src/definitions';
import { buildCopyContext, buildInspectionMaterials } from './inspection/context_builder';
import { collectAttachments, copyPrompt } from './inspection/inspection_actions';
import { buildInspectionPackage } from './inspection/package_builder';

// Supported inspection actions triggered by the header buttons.
export type InspectionAction = 'copy' | 'export';

/**
 * Feedback — Result of an inspection action, displayed in the UI.
 *
 * - message: User-facing success, progress, or error message.
 * - error: Indicates whether the action failed.
 * - prompt: Fallback text when clipboard access is blocked.
 * - download: ZIP download link and filename for manual downloading.
 */
type Feedback = {
  message: string;
  error?: boolean;
  prompt?: string;
  download?: { url: string; filename: string };
};

/**
 * useInspectionActions — Custom React hook for inspection actions.
 *
 * Responsibilities:
 * 1. Retrieve the current Jira issue through Forge Bridge.
 * 2. Build inspection materials using the shared FlowLens schema.
 * 3. Copy the inspection prompt or export an inspection ZIP.
 * 4. Manage loading state, feedback, and temporary download URLs.
 *
 * Both actions share the same preparation pipeline:
 * Jira issue → Inspection materials → Copy prompt / Export package.
 *
 * Returns:
 * - busy: Currently running action, if any.
 * - feedback: Latest action result or progress message.
 * - run: Starts an inspection action.
 * - dismissFeedback: Clears the displayed feedback.
 */
export function useInspectionActions() {
  // UI STATE: Tracks the active action and its user-facing feedback.
  const [busy, setBusy] = useState<InspectionAction>();
  const [feedback, setFeedback] = useState<Feedback>();

  // Prevent concurrent actions, including rapid clicks before React re-renders.
  const running = useRef(false);

  // Keep the current ZIP object URL for cleanup or manual downloading.
  const downloadUrl = useRef<string>();

  // Track whether the component using this hook is still mounted.
  // Async operations must not update its state after unmounting.
  const active = useRef(false);

  /**
   * LIFECYCLE: Initialize the hook and clean up temporary resources.
   *
   * Runs after mounting. Cleanup runs when the component unmounts.
   *
   * URL.revokeObjectURL releases the browser-managed URL created
   * for the exported ZIP, preventing unnecessary resource retention.
   */
  useEffect(() => {
    active.current = true;

    return () => {
      active.current = false;

      // Release the temporary ZIP download URL on unmount.
      if (downloadUrl.current) {
        URL.revokeObjectURL(downloadUrl.current);
      }
    };
  }, []);

  /**
   * run — Execute the selected inspection action.
   *
   * Triggered by the Copy Inspection Prompt or Export Inspection Package
   * button in the UI.
   *
   * Execution flow:
   * 1. Lock the action and reset previous feedback.
   * 2. Retrieve the Jira issue and build inspection materials.
   * 3. Execute the requested copy or export operation.
   * 4. Report success or failure to the UI.
   * 5. Release the action lock.
   *
   * @param action - 'copy' or 'export'.
   */
  async function run(action: InspectionAction) {
    // STEP 1: Ignore additional clicks while an action is already running.
    if (running.current) return;

    running.current = true;
    setBusy(action);
    setFeedback(undefined);

    // Revoke any previous ZIP URL before creating another export.
    if (downloadUrl.current) {
      URL.revokeObjectURL(downloadUrl.current);
      downloadUrl.current = undefined;
    }

    // Default error message, replaced as execution reaches each stage.
    let errorMessage = 'Open FlowLens from a Jira issue and try again.';

    try {
      /**
       * STEP 2: Prepare inspection materials from the current Jira issue.
       *
       * Both actions use this shared pipeline.
       * Only export requests attachment metadata because copying
       * the prompt does not require downloading attachments.
       *
       * Dynamic import loads Forge Bridge when the action is triggered.
       */
      const preparation = import('@forge/bridge').then(async ({ makeInvoke }) => {
        // Create a typed client for invoking Forge backend resolvers.
        const invoke = makeInvoke<ResolverDefinitions>();

        // Request Jira issue data through the backend resolver.
        errorMessage = 'Could not load the Jira issue. Check your Jira access and try again.';

        const result = await invoke('getInspectionIssue', {
          includeAttachments: action === 'export',
        });

        // Stop when the resolver reports a failed request.
        if (!result.ok) {
          errorMessage = result.message;
          throw new Error(result.message);
        }

        // Convert Jira issue data into the standardized inspection materials.
        errorMessage = 'Could not prepare the inspection materials. Try again.';

        return {
          invoke,
          result,
          materials: buildInspectionMaterials(result.issue, schemaText),
        };
      });

      /**
       * STEP 3A: COPY INSPECTION PROMPT
       *
       * Generate the AI inspection prompt from the prepared materials,
       * then attempt to copy it using the browser Clipboard API.
       */
      if (action === 'copy') {
        const copy = await copyPrompt(
          preparation.then(({ materials }) => buildCopyContext(materials)),
          navigator.clipboard,
        );

        if (active.current) {
          setFeedback(copy.copied
            ? {
                // SUCCESS: Clipboard contains the inspection prompt.
                message: 'Inspection prompt copied.',
              }
            : {
                // FALLBACK: Show the prompt for manual copying.
                message: 'Clipboard access was blocked. Copy the selected prompt below.',
                prompt: copy.text,
              });
        }

        // Copy is complete; skip the export pipeline.
        // The finally block still runs to release the action lock.
        return;
      }

      /**
       * STEP 3B: EXPORT INSPECTION PACKAGE
       *
       * Wait for Jira issue preparation, retrieve attachments,
       * generate a ZIP archive, and initiate its download.
       */
      const { invoke, result, materials } = await preparation;

      errorMessage = 'Could not create the inspection ZIP. Try again.';

      // PROGRESS FEEDBACK: Inform the user while attachments are retrieved.
      if (active.current) {
        setFeedback({ message: 'Preparing attachments…' });
      }

      // Missing attachment metadata is recorded in the package manifest.
      // The export can still proceed without the attachment list.
      const listingError = result.attachments
        ? undefined
        : 'Jira did not return the attachment list.';

      // Retrieve attachment contents through the Forge backend resolver.
      // collectAttachments handles the attachment collection process.
      const attachments = await collectAttachments(
        materials,
        result.attachments ?? [],
        attachmentId => invoke('getInspectionAttachment', { attachmentId }),
      );

      // Do not create a download after the owning component has unmounted.
      if (!active.current) return;

      /**
       * STEP 4: Build the ZIP archive.
       *
       * The package builder combines inspection materials and attachments,
       * recording skipped files or listing errors in the manifest.
       */
      const { archive, skipped } = buildInspectionPackage(
        materials,
        attachments,
        listingError,
      );

      // Generate a filename based on the Jira issue key.
      // Replace unsupported characters to keep the filename safe.
      const filename =
        `flowlens-inspection-${result.issue.key.replace(/[^a-z0-9_-]/gi, '_')}.zip`;

      // Create a temporary browser URL pointing to the generated ZIP.
      const url = URL.createObjectURL(archive);
      downloadUrl.current = url;

      /**
       * STEP 5: Trigger the browser download.
       *
       * A temporary anchor element is used to initiate the download.
       * The URL remains valid afterward so the user can retry manually.
       */
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);

      try {
        link.click();
      } finally {
        // Remove the temporary HTML element, not the download URL.
        link.remove();
      }

      /**
       * STEP 6: Report export results.
       *
       * Distinguish between:
       * - Missing Jira attachment metadata.
       * - Attachments that were skipped.
       * - A package built without reported attachment problems.
       */
      const message = listingError
        ? 'Package ready. Jira could not list attachments. See manifest.json.'
        : skipped
          ? `Package ready. ${skipped} of ${attachments.length} attachments skipped. See manifest.json.`
          : 'Inspection package ready.';

      // Provide a manual download link if the automatic download is blocked.
      setFeedback({
        message,
        download: { url, filename },
      });

    } catch {
      /**
       * ERROR HANDLING:
       *
       * Display the message associated with the failed execution stage.
       * Avoid updating React state after the component has unmounted.
       */
      if (active.current) {
        setFeedback({
          message: errorMessage,
          error: true,
        });
      }

    } finally {
      /**
       * CLEANUP:
       *
       * Always release the execution lock, whether the operation
       * succeeds, fails, or returns early.
       */
      running.current = false;

      if (active.current) {
        setBusy(undefined);
      }
    }
  }

  // Public API consumed by the component rendering the inspection actions.
  return {
    busy,
    feedback,
    run,
    dismissFeedback: () => setFeedback(undefined),
  };
}
