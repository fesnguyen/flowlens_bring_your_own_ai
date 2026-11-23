
import { X } from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import type { ContentBlock, Finding, Flow, InspectionNode, SourceReference } from '../../../shared/inspection';

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
        <span className="finding-status">AI assessment: {finding.status}</span>
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

function SourceDetails({ source }: { source: SourceReference }) {
  return (
    <dl className="source-metadata">
      <div><dt>File</dt><dd><code>{source.file}</code></dd></div>
      {source.symbol && <div><dt>Symbol</dt><dd><code>{source.symbol}</code></dd></div>}
      {source.startLine !== undefined && (
        <div><dt>Lines</dt><dd>{source.startLine}{source.endLine !== undefined && `–${source.endLine}`}</dd></div>
      )}
    </dl>
  );
}

function BlockDetails({ block }: { block: ContentBlock }) {
  return (
    <details className="node-content-block" open={block.type.toLowerCase() !== 'code'}>
      <summary>{block.title ?? block.type}</summary>
      {block.status && <p className="finding-status">AI assessment: {block.status}</p>}
      {block.type.toLowerCase() === 'code'
        ? <pre tabIndex={0}><code>{block.text}</code></pre>
        : <p className="block-text">{block.text}</p>}
      {block.source && <SourceDetails source={block.source} />}
    </details>
  );
}

/** Show ordered investigation content and separate AI change assessments for the selected node. */
export function NodeDetails({ node, flow, onClose }: { node?: InspectionNode; flow?: Flow; onClose: () => void }) {
  return (
    <>
      <div className="inspector-header">
        <h2 id="inspector-heading" tabIndex={-1}>Node Details</h2>
        {node && <button type="button" className="icon-button" onClick={onClose} aria-label="Close node details">
          <X size={17} aria-hidden="true" />
        </button>}
      </div>

      {node && flow ? (
        <div className="inspector-content" key={node.id}>
          {flow.type === 'suggestion' && <span className="type-label suggestion">Proposed</span>}
          <h3 className="inspector-title">{node.title}</h3>
          {node.subheader && <p className="inspector-description">{node.subheader}</p>}
          {node.source && <SourceDetails source={node.source} />}

          {/* Keep change assessments close to the title so they are easy to find. */}
          {Boolean(node.impacts?.length) && (
            <section className="node-impacts" aria-label="Relative impact">
              <h3>Relative impact</h3>
              <p>Potential effects of changing this node, assessed by the AI.</p>
              {node.impacts?.map((impact, index) => (
                <details className="node-content-block" key={index} open>
                  <summary>{flow.nodes.find(target => target.id === impact.nodeId)?.title ?? impact.nodeId}</summary>
                  <dl className="impact-details">
                    <div><dt>Relationship</dt><dd>{impact.relationship}</dd></div>
                    <div><dt>Potential consequence</dt><dd>{impact.consequence}</dd></div>
                    <div><dt>Why</dt><dd>{impact.reason}</dd></div>
                    <div><dt>AI assessment</dt><dd>{impact.status ?? 'Unspecified'}</dd></div>
                    {impact.evidence && <div><dt>Evidence</dt><dd>{impact.evidence}</dd></div>}
                    {impact.verification && <div><dt>How to verify</dt><dd>{impact.verification}</dd></div>}
                  </dl>
                </details>
              ))}
            </section>
          )}

          {/* V1 evidence keeps its numbered code viewer and structured findings. */}
          {node.content.map((item, index) => {
            if (item.format === 'legacyCode') {
              return <CodeViewer key={index} blocks={item.blocks} proposed={flow.type === 'suggestion'} />;
            }
            if (item.format === 'legacyFinding') return <FindingDetails key={index} finding={item.finding} />;
            return <BlockDetails key={index} block={item.block} />;
          })}
        </div>
      ) : (
        <p className="inspector-empty">Select a node to inspect its details and potential impact.</p>
      )}
    </>
  );
}
