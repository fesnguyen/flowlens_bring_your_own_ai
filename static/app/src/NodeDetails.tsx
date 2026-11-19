
import { AlertTriangle, Braces, FileCode2, ListOrdered, X } from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import type { Finding, InspectionNode } from './inspection';

/**
 * FindingDetails — Individual finding card inside the Code Inspector.
 *
 * Displays an issue identified during inspection, including:
 * - Finding ID, status, and title.
 * - Explanation and supporting source locations.
 * - Optional recommendation for resolving the issue.
 *
 * One FindingDetails component is rendered for each finding.
 */
function FindingDetails({ finding }: { finding: Finding }) {
  return (
    <article className="finding">
      {/* FINDING HEADER: Finding ID and current status */}
      <div className="finding-heading">
        <span className="finding-id">{finding.id}</span>
        <span className="finding-status">{finding.status}</span>
      </div>

      {/* FINDING DESCRIPTION: Title and explanation */}
      <h4>{finding.title}</h4>
      <p>{finding.explanation}</p>

      {/* EVIDENCE: Source file locations supporting this finding */}
      <dl className="finding-evidence">
        <dt>Evidence</dt>
        {finding.evidence.map(({ file, startLine, endLine }) => (
          <dd key={`${file}:${startLine}–${endLine}`}>
            <code>{file}:{startLine}–{endLine}</code>
          </dd>
        ))}
      </dl>

      {/* RECOMMENDATION: Only displayed when a suggestion exists */}
      {finding.suggestion && (
        <div className="recommendation">
          <strong>Recommendation</strong>
          <p>{finding.suggestion}</p>
        </div>
      )}
    </article>
  );
}

/**
 * NodeDetails — Right-side Code Inspector panel content.
 *
 * Receives the selected node from App and displays:
 * - Node title and description.
 * - Source file, function/symbol, and line numbers.
 * - Source code through CodeViewer.
 * - Inspection findings through FindingDetails.
 *
 * If no node is selected, displays an instructional empty state.
 *
 * Props:
 * - node: Currently selected execution node (optional).
 * - proposed: Whether the node belongs to a suggested flow.
 * - onClose: Callback to clear the selection and close the inspector.
 */
export function NodeDetails({ node, proposed, onClose }: {
  node?: InspectionNode;
  proposed: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* ===== INSPECTOR HEADER: Panel title and close button ===== */}
      <div className="inspector-header">
        <h2 id="inspector-heading" tabIndex={-1}>Node Details</h2>

        {/* CLOSE BUTTON: Calls App.closeDetails through onClose */}
        {node && (
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close node details"
          >
            <X size={17} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* ===== INSPECTOR BODY: Selected node information ===== */}
      {node ? (
        <div className="inspector-content" key={node.id}>

          {/* NODE TYPE: Identifies a proposed execution step */}
          {proposed && <span className="type-label suggestion">Proposed</span>}

          {/* NODE SUMMARY: Title and description of the selected step */}
          <h3 className="inspector-title">{node.title}</h3>
          <p className="inspector-description">{node.description}</p>

          {/* SOURCE METADATA: File, function/symbol, and line range */}
          {node.source && (
            <dl className="source-metadata">
              {/* SOURCE FILE: Path to the implementation */}
              <div>
                <dt>
                  <FileCode2 size={15} />
                  <span className="sr-only">File</span>
                </dt>
                <dd><code>{node.source.file}</code></dd>
              </div>

              {/* SYMBOL: Function, method, or other source symbol */}
              <div>
                <dt>
                  <Braces size={15} />
                  <span className="sr-only">Symbol</span>
                </dt>
                <dd><code>{node.source.symbol}</code></dd>
              </div>

              {/* LINE RANGE: Location of the implementation in the file */}
              <div>
                <dt>
                  <ListOrdered size={15} />
                  <span className="sr-only">Source</span>
                </dt>
                <dd>Lines {node.source.startLine}–{node.source.endLine}</dd>
              </div>
            </dl>
          )}

          {/* CODE VIEWER: Display source snippets associated with the node */}
          {node.code && (
            <CodeViewer blocks={node.code} proposed={proposed} />
          )}

          {/* FINDINGS SECTION: Issues discovered during inspection */}
          {Boolean(node.findings?.length) && (
            <section className="inspection-section" aria-label="Findings">
              <h3>
                <AlertTriangle size={15} aria-hidden="true" /> Findings
              </h3>

              {/* FINDING CARDS: Render one card for each inspection finding */}
              {node.findings?.map((finding) => (
                <FindingDetails key={finding.id} finding={finding} />
              ))}
            </section>
          )}
        </div>
      ) : (
        /* EMPTY STATE: Displayed when no execution node is selected */
        <p className="inspector-empty">
          Select a node to inspect its source and findings.
        </p>
      )}
    </>
  );
}
