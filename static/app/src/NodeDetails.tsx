import { AlertTriangle, Braces, FileCode2, ListOrdered, X } from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import type { Finding, InspectionNode } from './inspection';

function FindingDetails({ finding }: { finding: Finding }) {
  return (
    <article className="finding">
      <div className="finding-heading">
        <span className="finding-id">{finding.id}</span>
        <span className="finding-status">{finding.status}</span>
      </div>
      <h4>{finding.title}</h4>
      <p>{finding.explanation}</p>
      <dl className="finding-evidence">
        <dt>Evidence</dt>
        {finding.evidence.map(({ file, startLine, endLine }) => (
          <dd key={`${file}:${startLine}–${endLine}`}><code>{file}:{startLine}–{endLine}</code></dd>
        ))}
      </dl>
      {finding.suggestion && (
        <div className="recommendation">
          <strong>Recommendation</strong>
          <p>{finding.suggestion}</p>
        </div>
      )}
    </article>
  );
}

export function NodeDetails({ node, proposed, onClose }: {
  node?: InspectionNode;
  proposed: boolean;
  onClose: () => void;
}) {
  return (
    <>
      <div className="inspector-header">
        <h2 id="inspector-heading" tabIndex={-1}>Node Details</h2>
        {node && (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close node details">
            <X size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      {node ? (
        <div className="inspector-content" key={node.id}>
          {proposed && <span className="type-label suggestion">Proposed</span>}
          <h3 className="inspector-title">{node.title}</h3>
          <p className="inspector-description">{node.description}</p>
          {node.source && (
            <dl className="source-metadata">
              <div>
                <dt><FileCode2 size={15} /><span className="sr-only">File</span></dt>
                <dd><code>{node.source.file}</code></dd>
              </div>
              <div>
                <dt><Braces size={15} /><span className="sr-only">Symbol</span></dt>
                <dd><code>{node.source.symbol}</code></dd>
              </div>
              <div>
                <dt><ListOrdered size={15} /><span className="sr-only">Source</span></dt>
                <dd>Lines {node.source.startLine}–{node.source.endLine}</dd>
              </div>
            </dl>
          )}
          {node.code && <CodeViewer blocks={node.code} proposed={proposed} />}
          {Boolean(node.findings?.length) && (
            <section className="inspection-section" aria-label="Findings">
              <h3><AlertTriangle size={15} aria-hidden="true" /> Findings</h3>
              {node.findings?.map((finding) => <FindingDetails key={finding.id} finding={finding} />)}
            </section>
          )}
        </div>
      ) : (
        <p className="inspector-empty">Select a node to inspect its source and findings.</p>
      )}
    </>
  );
}
