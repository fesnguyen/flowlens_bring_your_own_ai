
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine, ChevronDown, Copy, GitBranch, GitFork, Upload,
} from 'lucide-react';
import type { ResolverDefinitions } from '../../../src/definitions';
import { FlowDiagram } from './FlowDiagram';
import { NodeDetails } from './NodeDetails';
import { conclusionLabels, type Flow, type Inspection } from './inspection';
import { parseInspection } from './inspection/import_inspection';
import { mockInspection } from './mockInspection';
import { useInspectionActions, type InspectionAction } from './useInspectionActions';


// Screen width at which the UI switches to its compact layout.
const narrowScreen = '(max-width: 1050px)';

const actions = [
  { id: 'copy', label: 'Copy Inspection Prompt', busyLabel: 'Preparing prompt…', icon: Copy },
  { id: 'export', label: 'Export Inspection Package', busyLabel: 'Preparing package…', icon: ArrowDownToLine },
] as const;

/** Both header layouts use the same buttons and operation state. */
function Header({ issueKey, status, busy, run, onImport, sample }: {
  issueKey: string;
  status: string;
  busy?: InspectionAction;
  run: (action: InspectionAction, trigger: HTMLElement) => void;
  onImport: () => void;
  sample: boolean;
}) {
  const actionButtons = (
    <>
      {actions.map(({ id, icon: Icon, label, busyLabel }) => (
        <button key={id} className="header-action" type="button" aria-disabled={Boolean(busy)}
          onClick={(event) => {
            if (busy) return;
            const button = event.currentTarget;
            const menu = button.closest('details');
            const trigger = menu?.querySelector('summary') ?? button;
            if (menu) {
              menu.open = false;
              trigger.focus();
            }
            run(id, trigger);
          }}>
          <Icon size={15} aria-hidden="true" /> {busy === id ? busyLabel : label}
        </button>
      ))}
      <button className="header-action" type="button" disabled={Boolean(busy)} onClick={onImport}>
        <Upload size={15} aria-hidden="true" /> Import JSON
      </button>
    </>
  );

  return (
    <header className="app-header">
      {/* LEFT: FlowLens logo, product name, and subtitle */}
      <div className="brand">
        <span className="brand-mark"><GitFork size={23} aria-hidden="true" /></span>
        <div>
          <h1>FlowLens</h1>
          <span className="brand-caption">Bring Your Own AI</span>
        </div>
      </div>

      {/* CENTER: Jira issue key and sample-data indicator */}
      <div className="issue-context">
        <span className="issue-key" title={status}>{issueKey}</span>
        {sample && <span className="sample-label">Sample data</span>}
      </div>

      {/* RIGHT: Inspection action buttons on wide screens */}
      <div className="wide-actions" aria-label="Inspection actions">
        {actionButtons}
      </div>

      {/* RIGHT: Collapsible Actions menu on smaller screens */}
      <details className="compact-actions">
        <summary>Actions <ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="action-menu">
          {actionButtons}
        </div>
      </details>
    </header>
  );
}

/**
 * FlowSelector — Execution Flows navigation panel.
 *
 * Displays all available flows and highlights the selected one.
 * Selecting a flow notifies App through the onSelect callback.
 *
 * UI:
 * - Wide layout: Clickable flow list.
 * - Compact layout: Native dropdown selector.
 */
function FlowSelector({ flows, selected, onSelect }: { flows: Flow[]; selected: Flow; onSelect: (flow: Flow) => void }) {
  return (
    <nav className="flow-selector" aria-label="Execution flows">
      {/* PANEL TITLE: Execution Flows */}
      <h2>Execution Flows</h2>

      {/* FLOW LIST: Click a flow to display its graph and conclusion */}
      <ul className="flow-list">
        {flows.map((flow) => (
          <li key={flow.id}>
            <button className="flow-option" type="button" aria-current={selected.id === flow.id}
              onClick={() => onSelect(flow)}>
              <GitBranch size={16} aria-hidden="true" />

              {/* Flow name, type, and optional conclusion status */}
              <span className="flow-option-info">
                <strong>{flow.name}</strong>
                <span className="flow-option-meta">
                  <span className={`type-label ${flow.type}`}>
                    {flow.type === 'original' ? 'Original' : 'Suggestion'}
                  </span>

                  {/* Conclusion status is only shown when available */}
                  {flow.conclusion && (
                    <span className={`flow-status ${flow.conclusion.level}`}>
                      {conclusionLabels[flow.conclusion.level]}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* COMPACT FLOW SELECTOR: Alternative navigation for smaller screens */}
      <div className="flow-select">
        <label htmlFor="flow-choice">Execution flow</label>
        <select id="flow-choice" value={selected.id} onChange={(event) => {
          // Find the selected flow by ID and notify App to switch flows.
          const flow = flows.find((item) => item.id === event.target.value);
          if (flow) onSelect(flow);
        }}>
          {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
        </select>
      </div>
    </nav>
  );
}

/**
 * FlowConclusion — Summary displayed below the flow diagram.
 *
 * Shows the inspection conclusion, supporting evidence nodes,
 * and any remaining questions.
 *
 * Returns nothing when the selected flow has no conclusion.
 */
function FlowConclusion({ flow }: { flow: Flow }) {
  const { conclusion } = flow;
  if (!conclusion) return null;

  // Resolve evidence node IDs into readable node titles for the UI.
  const evidence = conclusion.evidence.map(({ nodeId }) =>
    flow.nodes.find((node) => node.id === nodeId)?.title).filter(Boolean);

  return (
    <section className="flow-conclusion" aria-labelledby="conclusion-heading">
      {/* SECTION HEADER: Conclusion title and status */}
      <div className="conclusion-heading">
        <h2 id="conclusion-heading">Flow Conclusion</h2>
        <span className={`conclusion-status ${conclusion.level}`}>
          {conclusionLabels[conclusion.level]}
        </span>
      </div>

      {/* CONCLUSION SUMMARY: Main inspection finding */}
      <p>{conclusion.summary}</p>

      {/* SUPPORTING CONTEXT: Expand to view evidence and open questions */}
      {(evidence.length > 0 || Boolean(conclusion.remainingQuestions?.length)) && (
        <details className="conclusion-evidence">
          <summary>Supporting context</summary>
          {evidence.length > 0 && <p><strong>Evidence nodes:</strong> {evidence.join(', ')}</p>}
          {conclusion.remainingQuestions?.map((question) => <p key={question}>{question}</p>)}
        </details>
      )}
    </section>
  );
}

/**
 * Returns the ID of the first inspectable node in a flow.
 *
 * Operation and retry nodes are preferred because they represent
 * execution steps with details suitable for the Code Inspector.
 *
 * Returns undefined if no matching node exists.
 */
function firstInspectableNode(flow: Flow) {
  return flow.nodes.find((node) => node.kind === 'operation' || node.kind === 'retry')?.id;
}

/**
 * App — Main FlowLens application and state coordinator.
 *
 * Responsibilities:
 * 1. Connect to Jira through Forge Bridge.
 * 2. Track the selected execution flow and graph node.
 * 3. Coordinate interactions between the graph and Code Inspector.
 * 4. Manage inspector drawer behavior on smaller screens.
 *
 * Main screen:
 * - Header: Product branding, Jira context, and actions.
 * - Left: Execution Flows selector.
 * - Center: Flow diagram and conclusion.
 * - Right: Code Inspector for the selected node.
 */
export default function App() {
  // Jira connection state, separate from the sample inspection data.
  const [issueKey, setIssueKey] = useState<string>();
  const [bridgeStatus, setBridgeStatus] = useState('Connecting to Jira…');
  const [resolverStatus, setResolverStatus] = useState('Connecting to the resolver…');
  const { busy, feedback, run, dismissFeedback } = useInspectionActions();
  const [inspection, setInspection] = useState<Inspection>(mockInspection);
  const [importFeedback, setImportFeedback] = useState<string>();
  const [importError, setImportError] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const { flows, analysis } = inspection;
  const promptField = useRef<HTMLTextAreaElement>(null);
  const actionTrigger = useRef<HTMLElement>();

  // When clipboard access fails, select the full prompt so the user can copy it immediately.
  useEffect(() => {
    if (feedback?.prompt) {
      promptField.current?.focus();
      promptField.current?.select();
    }
  }, [feedback?.prompt]);

  // Currently displayed flow and selected graph node.
  const [flow, setFlow] = useState(flows[0]);
  const [selectedId, setSelectedId] = useState(() => firstInspectableNode(flows[0]));

  // Controls whether the inspector is open as a drawer on compact screens.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // DOM references used for keyboard focus management.
  const inspector = useRef<HTMLElement>(null);
  const lastNodeButton = useRef<HTMLElement | null>(null);

  // Resolve the selected node so its details can be passed to NodeDetails.
  const selectedNode = flow.nodes.find((node) => node.id === selectedId);

  /**
   * INITIALIZATION: Connect to the Jira host and Forge resolver.
   *
   * Runs once when App mounts.
   * Dynamic import allows standalone Vite previews to continue working
   * without an available Jira host.
   */
  useEffect(() => {
    // Prevent asynchronous responses from updating state after unmount.
    let active = true;

    // Forge Bridge requires a Jira host at import time.
    // Standalone Vite previews fall back to sample issue information.
    void import('@forge/bridge').then(({ makeInvoke, view }) => {
      if (!active) return;
      const invoke = makeInvoke<ResolverDefinitions>();

      // Request the current Jira issue context from the host.
      void view.getContext().then(
        (context) => {
          if (!active) return;
          const key: unknown = context.extension.issue?.key;
          if (typeof key === 'string') {
            setIssueKey(key);
            setBridgeStatus('Connected to Jira through Forge Bridge.');
          } else {
            setBridgeStatus('Jira issue key unavailable. Showing the sample issue.');
          }
        },
        () => {
          if (active) setBridgeStatus('Jira context unavailable. Showing the sample issue.');
        },
      );

      // Verify communication with the Forge backend resolver.
      void invoke('health').then(
        (response) => {
          if (active) setResolverStatus(response.message);
        },
        () => {
          if (active) setResolverStatus('Resolver connection failed.');
        },
      );
    }).catch(() => {
      if (!active) return;
      setBridgeStatus('Jira context unavailable. Showing the sample issue.');
      setResolverStatus('Use the deployed panel or Forge tunnel to connect to the resolver.');
    });

    // Cleanup: Ignore pending bridge responses after App unmounts.
    return () => { active = false; };
  }, []);

  /**
   * ACCESSIBILITY: Focus the inspector heading when its drawer opens.
   *
   * On narrow screens, the inspector behaves like a drawer.
   * Moving keyboard focus to its heading helps users navigate its content.
   */
  useEffect(() => {
    if (drawerOpen && window.matchMedia(narrowScreen).matches) {
      inspector.current?.querySelector<HTMLElement>('#inspector-heading')?.focus({ preventScroll: true });
    }
  }, [drawerOpen, selectedId]);

  /**
   * NODE CLICK: Select a graph node and display its details.
   *
   * Triggered by FlowDiagram when the user clicks a node.
   * Saves the clicked button so focus can return to it later.
   *
   * useCallback keeps the callback reference stable between renders.
   */
  const selectNode = useCallback((id: string, trigger: HTMLButtonElement) => {
    lastNodeButton.current = trigger;
    setSelectedId(id);
    setDrawerOpen(true);
  }, []);

  /**
   * FLOW SELECTION: Switch to another execution flow.
   *
   * Triggered by FlowSelector.
   * Resets the selected node to the new flow's first inspectable node
   * and closes the inspector drawer.
   */
  function selectFlow(next: Flow) {
    if (next.id === flow.id) return;
    setFlow(next);
    setSelectedId(firstInspectableNode(next));
    lastNodeButton.current = null;
    setDrawerOpen(false);
  }

  /**
   * IMPORT: Read a local AI result, validate it, then replace sample data.
   * A failed import leaves the current inspection untouched.
   */
  async function importInspection(file?: File) {
    if (!file) return;
    setImportFeedback(undefined);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('JSON file exceeds the 5 MiB limit.');
      const next = parseInspection(await file.text(), issueKey);
      setInspection(next);
      setFlow(next.flows[0]);
      setSelectedId(firstInspectableNode(next.flows[0]));
      setDrawerOpen(false);
      lastNodeButton.current = null;
      setImportError(false);
      setImportFeedback(`Imported ${next.flows.length} flows from ${next.issue.key}.`);
    } catch (error) {
      setImportError(true);
      setImportFeedback(error instanceof Error ? error.message : 'Could not import the inspection JSON.');
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  }

  /**
   * CLOSE INSPECTOR: Dismiss node details.
   *
   * Triggered by NodeDetails or the Escape key.
   * Clears selection and restores keyboard focus to the last clicked node.
   */
  function closeDetails() {
    setDrawerOpen(false);
    setSelectedId(undefined);
    lastNodeButton.current?.focus({ preventScroll: true });
  }

  return (
    <main className="flowlens">
      {/* ===== TOP HEADER: Branding, Jira issue, and inspection actions ===== */}
      <Header issueKey={issueKey ?? inspection.issue.key} status={bridgeStatus} busy={busy} sample={inspection === mockInspection}
        run={(action, trigger) => {
          actionTrigger.current = trigger;
          void run(action);
        }}
        onImport={() => importInput.current?.click()} />
      <input ref={importInput} type="file" accept=".json,application/json"
        className="sr-only" aria-label="Import FlowLens analysis JSON"
        onChange={(event) => void importInspection(event.currentTarget.files?.[0])} />

      {importFeedback && <div role="status" className="inspection-feedback">
        <span className={importError ? 'inspection-error' : undefined}>{importFeedback}</span>
      </div>}
      <div role="status" className={feedback || busy ? 'inspection-feedback' : 'sr-only'}>
        {feedback ? (
          <>
            <span className={feedback.error ? 'inspection-error' : undefined}>{feedback.message}</span>
            {feedback.download && <a href={feedback.download.url} download={feedback.download.filename}>Download ZIP</a>}
          </>
        ) : busy === 'copy' ? 'Preparing inspection prompt…'
          : busy === 'export' ? 'Preparing inspection package…' : null}
      </div>
      {feedback?.prompt && (
        <div className="inspection-prompt-fallback">
          <label htmlFor="inspection-prompt">Inspection prompt</label>
          <textarea id="inspection-prompt" ref={promptField} readOnly rows={5} value={feedback.prompt} />
          <button type="button" className="header-action" onClick={() => {
            dismissFeedback();
            actionTrigger.current?.focus();
          }}>Dismiss</button>
        </div>
      )}

      {/* SCREEN READER STATUS: Announce Jira and resolver connection results */}
      <span className="sr-only" aria-live="polite">{bridgeStatus} {resolverStatus}</span>

      {/* ===== WORKSPACE: Three-panel application layout ===== */}
      <div className="workspace">

        {/* LEFT PANEL: Select an execution flow to inspect */}
        <FlowSelector flows={flows} selected={flow} onSelect={selectFlow} />

        {/* ===== CENTER PANEL: Selected flow visualization ===== */}
        <section className="flow-main" aria-labelledby="flow-title">

          {/* FLOW HEADER: Name, description, and source repository */}
          <div className="flow-heading">
            <div className="flow-title">
              <h2 id="flow-title">{flow.name}</h2>
              <span className={`type-label ${flow.type}`}>
                {flow.type === 'original' ? 'Original' : 'Proposed'}
              </span>
            </div>

            {/* Description of the selected execution flow */}
            <p>{flow.description}</p>

            {/* SOURCE INFORMATION: Repository and revision being inspected */}
            <div className="flow-provenance" title={analysis.summary}>
              <code>{analysis.repository}</code>
              <span aria-hidden="true">/</span>
              <code>{analysis.revision}</code>
            </div>
          </div>

          {/* FLOW GRAPH: Interactive nodes and their connections */}
          {/* Clicking a node calls selectNode and updates the inspector */}
          <FlowDiagram key={`${inspection.issue.key}-${inspection.analysis.revision}-${flow.id}`} flow={flow} selectedId={selectedId} onSelect={selectNode} />

          {/* FLOW CONCLUSION: Summary, evidence, and remaining questions */}
          <FlowConclusion flow={flow} />
        </section>

        {/* ===== RIGHT PANEL: Code Inspector / compact-screen drawer ===== */}
        <aside ref={inspector} className={`inspector ${drawerOpen ? 'drawer-open' : ''}`}
          aria-labelledby="inspector-heading" onKeyDown={(event) => {
            // Escape closes details only when a node is currently selected.
            if (event.key === 'Escape' && selectedNode) closeDetails();
          }}>
          {/* NODE DETAILS: Source references and analysis of selected node */}
          {/* Close action calls closeDetails to clear selection and restore focus */}
          <NodeDetails node={selectedNode} proposed={flow.type === 'suggestion'} onClose={closeDetails} />
        </aside>
      </div>
    </main>
  );
}
