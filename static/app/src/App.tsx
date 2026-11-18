import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine, ChevronDown, Copy, GitBranch, GitFork, Upload,
} from 'lucide-react';
import type { ResolverDefinitions } from '../../../src/definitions';
import { FlowDiagram } from './FlowDiagram';
import { NodeDetails } from './NodeDetails';
import { conclusionLabels, type Flow } from './inspection';
import { mockInspection } from './mockInspection';

const { flows, analysis, issue } = mockInspection;
const narrowScreen = '(max-width: 1050px)';
const actions = [
  { label: 'Copy Inspection Prompt', icon: Copy },
  { label: 'Export Inspection Package', icon: ArrowDownToLine },
  { label: 'Import JSON', icon: Upload },
];

function Header({ issueKey, status }: { issueKey: string; status: string }) {
  const actionButtons = actions.map(({ icon: Icon, label }) => (
    <button key={label} className="placeholder-action" type="button" disabled>
      <Icon size={15} aria-hidden="true" /> {label}
    </button>
  ));

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark"><GitFork size={23} aria-hidden="true" /></span>
        <div>
          <h1>FlowLens</h1>
          <span className="brand-caption">Bring Your Own AI</span>
        </div>
      </div>
      <div className="issue-context">
        <span className="issue-key" title={status}>{issueKey}</span>
        <span className="sample-label">Sample data</span>
      </div>
      <div className="wide-actions" aria-label="Inspection actions, coming soon">
        {actionButtons}
      </div>
      <details className="compact-actions">
        <summary>Actions <ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="action-menu">
          <p>Coming soon</p>
          {actionButtons}
        </div>
      </details>
    </header>
  );
}

function FlowSelector({ selected, onSelect }: { selected: Flow; onSelect: (flow: Flow) => void }) {
  return (
    <nav className="flow-selector" aria-label="Execution flows">
      <h2>Execution Flows</h2>
      <ul className="flow-list">
        {flows.map((flow) => (
          <li key={flow.id}>
            <button className="flow-option" type="button" aria-current={selected.id === flow.id}
              onClick={() => onSelect(flow)}>
              <GitBranch size={16} aria-hidden="true" />
              <span className="flow-option-info">
                <strong>{flow.name}</strong>
                <span className="flow-option-meta">
                  <span className={`type-label ${flow.type}`}>{flow.type === 'original' ? 'Original' : 'Suggestion'}</span>
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
      <div className="flow-select">
        <label htmlFor="flow-choice">Execution flow</label>
        <select id="flow-choice" value={selected.id} onChange={(event) => {
          const flow = flows.find((item) => item.id === event.target.value);
          if (flow) onSelect(flow);
        }}>
          {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
        </select>
      </div>
    </nav>
  );
}

function FlowConclusion({ flow }: { flow: Flow }) {
  const { conclusion } = flow;
  if (!conclusion) return null;

  const evidence = conclusion.evidence.map(({ nodeId }) =>
    flow.nodes.find((node) => node.id === nodeId)?.title).filter(Boolean);

  return (
    <section className="flow-conclusion" aria-labelledby="conclusion-heading">
      <div className="conclusion-heading">
        <h2 id="conclusion-heading">Flow Conclusion</h2>
        <span className={`conclusion-status ${conclusion.level}`}>{conclusionLabels[conclusion.level]}</span>
      </div>
      <p>{conclusion.summary}</p>
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

function firstInspectableNode(flow: Flow) {
  return flow.nodes.find((node) => node.kind === 'operation' || node.kind === 'retry')?.id;
}

export default function App() {
  const [issueKey, setIssueKey] = useState<string>();
  const [bridgeStatus, setBridgeStatus] = useState('Connecting to Jira…');
  const [resolverStatus, setResolverStatus] = useState('Connecting to the resolver…');
  const [flow, setFlow] = useState(flows[0]);
  const [selectedId, setSelectedId] = useState(() => firstInspectableNode(flows[0]));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inspector = useRef<HTMLElement>(null);
  const lastNodeButton = useRef<HTMLElement | null>(null);
  const selectedNode = flow.nodes.find((node) => node.id === selectedId);

  useEffect(() => {
    let active = true;

    // The bridge requires its Jira host at import time. A standalone Vite
    // preview still renders the same viewer using the sample issue key.
    void import('@forge/bridge').then(({ makeInvoke, view }) => {
      if (!active) return;
      const invoke = makeInvoke<ResolverDefinitions>();

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

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (drawerOpen && window.matchMedia(narrowScreen).matches) {
      inspector.current?.querySelector<HTMLElement>('#inspector-heading')?.focus({ preventScroll: true });
    }
  }, [drawerOpen, selectedId]);

  const selectNode = useCallback((id: string, trigger: HTMLButtonElement) => {
    lastNodeButton.current = trigger;
    setSelectedId(id);
    setDrawerOpen(true);
  }, []);

  function selectFlow(next: Flow) {
    if (next.id === flow.id) return;
    setFlow(next);
    setSelectedId(firstInspectableNode(next));
    lastNodeButton.current = null;
    setDrawerOpen(false);
  }

  function closeDetails() {
    setDrawerOpen(false);
    setSelectedId(undefined);
    lastNodeButton.current?.focus({ preventScroll: true });
  }

  return (
    <main className="flowlens">
      <Header issueKey={issueKey ?? issue.key} status={bridgeStatus} />
      <span className="sr-only" aria-live="polite">{bridgeStatus} {resolverStatus}</span>
      <div className="workspace">
        <FlowSelector selected={flow} onSelect={selectFlow} />
        <section className="flow-main" aria-labelledby="flow-title">
          <div className="flow-heading">
            <div className="flow-title">
              <h2 id="flow-title">{flow.name}</h2>
              <span className={`type-label ${flow.type}`}>{flow.type === 'original' ? 'Original' : 'Proposed'}</span>
            </div>
            <p>{flow.description}</p>
            <div className="flow-provenance" title={analysis.summary}>
              <code>{analysis.repository}</code>
              <span aria-hidden="true">/</span>
              <code>{analysis.revision}</code>
            </div>
          </div>
          <FlowDiagram flow={flow} selectedId={selectedId} onSelect={selectNode} />
          <FlowConclusion flow={flow} />
        </section>
        <aside ref={inspector} className={`inspector ${drawerOpen ? 'drawer-open' : ''}`}
          aria-labelledby="inspector-heading" onKeyDown={(event) => {
            if (event.key === 'Escape' && selectedNode) closeDetails();
          }}>
          <NodeDetails node={selectedNode} proposed={flow.type === 'suggestion'} onClose={closeDetails} />
        </aside>
      </div>
    </main>
  );
}
