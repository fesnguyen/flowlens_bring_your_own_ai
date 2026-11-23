import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, ArrowDownToLine, Check, Copy, GitBranch, GitFork, LoaderCircle, Trash2, Upload, X,
} from 'lucide-react';
import { conclusionLabels, type Flow } from '../../../shared/inspection';
import type { FlowSummary } from '../../../shared/workspace';
import { FlowDiagram } from './FlowDiagram';
import { InstructionSettings } from './InstructionSettings';
import { NodeDetails } from './NodeDetails';
import { useInspectionActions, type InspectionAction } from './useInspectionActions';
import { useWorkspace } from './useWorkspace';

const narrowPanel = '(max-width: 1020px)';
const inspectionActions = [
  { action: 'copy', label: 'Copy Inspection Prompt', compact: 'Copy prompt', busy: 'Copying…', icon: Copy },
  { action: 'export', label: 'Export Inspection Package', compact: 'Export package', busy: 'Exporting…', icon: ArrowDownToLine },
] as const;

function FlowSelector({ flows, selected, onSelect, children }: {
  flows: FlowSummary[];
  selected?: string;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <nav className="flow-selector" aria-label="Saved flows">
      <div className="flow-sidebar-heading"><h2>Saved flows</h2><span>{flows.length}</span></div>
      <ul className="flow-list">
        {flows.map(flow => (
          <li key={flow.id}>
            <button className="flow-option" type="button" aria-current={selected === flow.id} onClick={() => onSelect(flow.id)}>
              <GitBranch size={15} aria-hidden="true" />
              <span className="flow-option-info">
                <strong>{flow.name}</strong>
                <span className={`flow-status ${flow.conclusion ?? ''}`}>
                  {flow.conclusion ? conclusionLabels[flow.conclusion] : flow.type === 'suggestion' ? 'Suggested' : 'Original'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flow-select">
        <label htmlFor="flow-choice">Saved flow</label>
        <select id="flow-choice" value={selected ?? flows[0].id} onChange={event => onSelect(event.currentTarget.value)}>
          {flows.map(flow => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
        </select>
      </div>
      {children}
    </nav>
  );
}

/** Present the AI conclusion with supporting nodes and questions in reading order. */
function FlowConclusion({ flow }: { flow: Flow }) {
  if (!flow.conclusion) return null;
  const { level, summary, evidence, remainingQuestions } = flow.conclusion;
  const evidenceNames = evidence.map(({ nodeId }) => flow.nodes.find(node => node.id === nodeId)?.title).filter(Boolean);
  return (
    <section className="flow-conclusion" aria-labelledby="conclusion-heading">
      <div className="conclusion-heading">
        <h2 id="conclusion-heading">Investigation conclusion</h2>
        <span className={`conclusion-status ${level}`}>{conclusionLabels[level]}</span>
      </div>
      <p>{summary}</p>
      {(evidenceNames.length > 0 || Boolean(remainingQuestions?.length)) && (
        <details className="conclusion-evidence">
          <summary>Supporting context</summary>
          {evidenceNames.length > 0 && <p><strong>Evidence nodes:</strong> {evidenceNames.join(', ')}</p>}
          {remainingQuestions?.map((question, index) => <p key={index}>{question}</p>)}
        </details>
      )}
    </section>
  );
}

function LoadingState({ message }: { message: string }) {
  return <div className="panel-state loading-state" role="status"><LoaderCircle size={18} aria-hidden="true" />{message}</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="panel-state" role="alert">
      <AlertCircle size={21} aria-hidden="true" />
      <p>{message}</p>
      <button className="button" type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}

/** Coordinate Jira workspace requests, inspection actions and the selected graph node. */
export default function App() {
  const preview = window.self === window.top;
  const workspace = useWorkspace(preview);
  const { loading, listError, issueKey, detail, flows, preference, mutation } = workspace;
  const { busy, feedback, run, dismissFeedback } = useInspectionActions();
  const [selection, setSelection] = useState<{ flowId: string; nodeId?: string }>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmRemoval, setConfirmRemoval] = useState<string>();
  const [removalError, setRemovalError] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const promptField = useRef<HTMLTextAreaElement>(null);
  const actionTrigger = useRef<HTMLElement>();
  const inspector = useRef<HTMLElement>(null);
  const lastNodeButton = useRef<HTMLButtonElement>();
  const flow = detail?.saved?.flow;
  const provenance = detail?.saved?.analysis;
  const basedOnId = detail?.saved?.basedOnId;
  const original = flows.find(item => item.id === basedOnId);
  const defaultNode = flow?.nodes.find(node => node.kind === 'operation' || node.kind === 'retry')?.id ?? flow?.entryNodeIds[0];
  const selectedId = selection && selection.flowId === detail?.id ? selection.nodeId : defaultNode;
  const selectedNode = flow?.nodes.find(node => node.id === selectedId);

  const canInspect = Boolean(!preview && issueKey && preference && !workspace.preferenceLoading && !loading && !busy);
  const canImport = Boolean(issueKey && !loading && !mutation);

  useEffect(() => {
    if (feedback?.prompt) {
      promptField.current?.focus();
      promptField.current?.select();
    }
  }, [feedback?.prompt]);

  useEffect(() => {
    if (drawerOpen && selectedNode && window.matchMedia(narrowPanel).matches) {
      inspector.current?.querySelector<HTMLElement>('#inspector-heading')?.focus({ preventScroll: true });
    }
  }, [drawerOpen, selectedNode]);

  const selectNode = useCallback((id: string, trigger: HTMLButtonElement) => {
    if (!detail?.id) return;
    lastNodeButton.current = trigger;
    setSelection({ flowId: detail.id, nodeId: id });
    setDrawerOpen(true);
  }, [detail?.id]);

  function closeDetails() {
    setDrawerOpen(false);
    if (detail?.id) setSelection({ flowId: detail.id });
    lastNodeButton.current?.focus({ preventScroll: true });
  }

  function resetNodeSelection() {
    setSelection(undefined);
    setDrawerOpen(false);
    setConfirmRemoval(undefined);
    setRemovalError(false);
    lastNodeButton.current = undefined;
  }

  function selectFlow(id: string) {
    if (id === detail?.id) return;
    resetNodeSelection();
    void workspace.openFlow(id);
  }

  function prepare(action: InspectionAction, button: HTMLElement) {
    actionTrigger.current = button;
    void run(action, preference?.text);
  }

  const activeNotice = workspace.notice;
  return (
    <main className="flowlens">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark"><GitFork size={19} aria-hidden="true" /></span>
          <h1>FlowLens</h1>
          {issueKey && <span className="issue-key">{issueKey}</span>}
          {preview && <span className="sample-label">Preview</span>}
        </div>
        <div className="header-actions" aria-label="Investigation actions">
          {inspectionActions.map(({ action, label, compact, busy: busyLabel, icon: Icon }) => (
            <button key={action} type="button" className="button button-quiet" aria-label={label}
              disabled={!canInspect} onClick={event => prepare(action, event.currentTarget)}>
              <Icon size={15} aria-hidden="true" />
              {busy === action ? busyLabel : <><span className="full-label">{label}</span><span className="short-label">{compact}</span></>}
            </button>
          ))}
          <button type="button" className="button button-primary" disabled={!canImport} onClick={() => importInput.current?.click()}>
            <Upload size={15} aria-hidden="true" /> {mutation === 'import' ? 'Saving…' : 'Import JSON'}
          </button>
        </div>
        <InstructionSettings preference={preference} loading={workspace.preferenceLoading} loadError={workspace.preferenceError}
          onSave={workspace.savePreference} onReload={workspace.retryPreference} />
      </header>

      <input ref={importInput} type="file" accept=".json,application/json" hidden aria-label="Import FlowLens analysis JSON"
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file && canImport) {
            void workspace.importFile(file).then(saved => { if (saved) resetNodeSelection(); });
          }
        }} />

      {workspace.preferenceError && issueKey && (
        <div className="feedback feedback-error" role="alert">
          <AlertCircle size={15} aria-hidden="true" />{workspace.preferenceError}
          <button className="button button-quiet" type="button" onClick={() => void workspace.retryPreference()}>Retry</button>
        </div>
      )}
      {activeNotice && (
        <div className={`feedback ${activeNotice.error ? 'feedback-error' : 'feedback-success'}`}
          role={activeNotice.error ? 'alert' : 'status'}>
          {activeNotice.error ? <AlertCircle size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          <span>{activeNotice.message}</span>
          {activeNotice.reload && (
            <button className="button button-quiet" type="button" disabled={Boolean(mutation)}
              onClick={() => { resetNodeSelection(); void workspace.reload(); }}>Reload saved flows</button>
          )}
          <button className="button icon-button button-quiet feedback-dismiss" type="button" aria-label="Dismiss flow message"
            onClick={workspace.dismissNotice}><X size={15} aria-hidden="true" /></button>
        </div>
      )}
      {(feedback || busy) && (
        <div className={`feedback ${feedback?.error ? 'feedback-error' : feedback ? 'feedback-success' : ''}`}
          role={feedback?.error ? 'alert' : 'status'}>
          <span>{feedback?.message ?? (busy === 'copy' ? 'Preparing inspection prompt…' : 'Preparing inspection package…')}</span>
          {feedback?.download && <a href={feedback.download.url} download={feedback.download.filename}>Download ZIP</a>}
          {feedback && <button type="button" className="button icon-button button-quiet feedback-dismiss"
            aria-label="Dismiss inspection message" onClick={() => {
              dismissFeedback();
              actionTrigger.current?.focus();
            }}><X size={15} aria-hidden="true" /></button>}
        </div>
      )}
      {feedback?.prompt && (
        <div className="inspection-prompt-fallback">
          <label htmlFor="inspection-prompt">Inspection prompt</label>
          <textarea id="inspection-prompt" ref={promptField} readOnly rows={5} value={feedback.prompt} />
        </div>
      )}

      {/* Use the empty state only after the resolver has confirmed the issue has no saved flows. */}
      {loading ? <LoadingState message="Loading saved flows…" />
        : listError ? <ErrorState message={listError} onRetry={() => void workspace.reload()} />
          : !flows.length ? (
            <section className="empty-workspace" aria-labelledby="empty-heading">
              <span className="empty-icon"><GitBranch size={24} aria-hidden="true" /></span>
              <h2 id="empty-heading">Start an investigation</h2>
              <p>Give your AI the Jira issue context, then import its analysis to explore execution paths and potential impact.</p>
              <div className="empty-actions">
                <button type="button" className="button button-primary" disabled={!canInspect}
                  onClick={event => prepare('copy', event.currentTarget)}><Copy size={15} aria-hidden="true" /> Copy prompt</button>
                <button type="button" className="button" disabled={!canImport}
                  onClick={() => importInput.current?.click()}><Upload size={15} aria-hidden="true" /> Import JSON</button>
              </div>
            </section>
          ) : (
            <div className="workspace">
              <FlowSelector flows={flows} selected={detail?.id} onSelect={selectFlow}>
                {detail?.id && (confirmRemoval === detail.id ? (
                  <div className="remove-confirmation">
                    <p>Remove this analysis flow from the issue?</p>
                    {removalError && <p className="error-text">Reload saved flows before retrying.</p>}
                    <div>
                      <button type="button" className="button" disabled={Boolean(mutation)}
                        onClick={() => setConfirmRemoval(undefined)}>Cancel</button>
                      <button type="button" className="button button-danger" disabled={Boolean(mutation) || removalError}
                        onClick={async () => {
                          if (await workspace.removeFlow(detail.id)) resetNodeSelection();
                          else setRemovalError(true);
                        }}>{mutation === 'remove' ? 'Removing…' : 'Remove'}</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="button button-quiet remove-flow" disabled={Boolean(mutation)}
                    onClick={() => { setRemovalError(false); setConfirmRemoval(detail.id); }}>
                    <Trash2 size={14} aria-hidden="true" /> Remove flow
                  </button>
                ))}
              </FlowSelector>

              {flow ? (
                <section className="flow-main" aria-labelledby="flow-title">
                  <div className="flow-heading">
                    <div className="flow-title">
                      <h2 id="flow-title">{flow.name}</h2>
                      <span className={`type-label ${flow.type}`}>{flow.type === 'original' ? 'Original' : 'Suggested'}</span>
                    </div>
                    <p>{flow.description}</p>
                    {original && <button type="button" className="button button-quiet original-link"
                      onClick={() => selectFlow(original.id)}>Original flow: {original.name}</button>}
                    {(provenance?.repository || provenance?.revision) && (
                      <div className="flow-provenance" title={provenance.summary}>
                        {provenance.repository && <code>{provenance.repository}</code>}
                        {provenance.repository && provenance.revision && <span aria-hidden="true">/</span>}
                        {provenance.revision && <code>{provenance.revision}</code>}
                      </div>
                    )}
                  </div>
                  <FlowDiagram key={detail.id} flow={flow} selectedId={selectedId} onSelect={selectNode} />
                  <FlowConclusion flow={flow} />
                </section>
              ) : (
                <section className="flow-main" aria-label="Investigation diagram">
                  {detail?.error ? <ErrorState message={detail.error} onRetry={() => void workspace.openFlow(detail.id)} />
                    : <LoadingState message="Loading investigation…" />}
                </section>
              )}

              <aside ref={inspector} className={`inspector ${drawerOpen && selectedNode ? 'drawer-open' : ''}`}
                aria-labelledby="inspector-heading" onKeyDown={event => {
                  if (event.key === 'Escape' && selectedNode) closeDetails();
                }}>
                <NodeDetails node={selectedNode} flow={flow} onClose={closeDetails} />
              </aside>
            </div>
          )}
    </main>
  );
}
