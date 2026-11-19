import type { CodeBlock, CodeLine } from './inspection';

function SourceLine({ line }: { line: CodeLine }) {
  const [number, content] = line;
  const isComment = content.trimStart().startsWith('#');

  return (
    <span className="source-line">
      <span className="line-number">{number}</span>
      <code className={isComment ? 'source-comment' : undefined}>{content || ' '}</code>
    </span>
  );
}

export function CodePreview({ blocks }: { blocks: CodeBlock[] }) {
  return (
    <span className="code-preview">
      {blocks.flatMap((block) => 'lines' in block ? block.lines : []).slice(0, 5).map((line) => (
        <SourceLine key={line[0]} line={line} />
      ))}
    </span>
  );
}

export function CodeViewer({ blocks, proposed }: { blocks: CodeBlock[]; proposed: boolean }) {
  const label = proposed ? 'Proposed code' : 'Source code';
  return (
    <section className="inspection-section" aria-label={label}>
      <h3>{label}</h3>
      <div className="code-viewer">
        {blocks.map((block) => 'lines' in block ? (
          <div className="code-block" key={block.lines[0]?.[0]} tabIndex={0} aria-label="Numbered code excerpt">
            {block.lines.map((line) => <SourceLine key={line[0]} line={line} />)}
          </div>
        ) : (
          <div className="omitted-code" key={block.omitted.startLine}>
            <strong>Lines {block.omitted.startLine}–{block.omitted.endLine} omitted</strong>
            <span>{block.omitted.summary}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
