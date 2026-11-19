type AdfNode = {
  type?: string;
  text?: string;
  attrs?: { href?: string; language?: string; order?: number; url?: string };
  marks?: { type?: string; attrs?: { href?: string } }[];
  content?: AdfNode[];
};

function link(label: string, href?: string): string {
  if (!href || !/^(https?:\/\/|mailto:)/i.test(href)) return label;
  const target = href.replace(/[\s<>\\]/g, char => encodeURIComponent(char));
  return `[${label.replace(/[\[\]\\]/g, '\\$&')}](<${target}>)`;
}

function render(node: AdfNode): string {
  const children = node.content ?? [];
  switch (node.type) {
    case 'text':
      return link(node.text ?? '', node.marks?.find(mark => mark.type === 'link')?.attrs?.href);
    case 'inlineCard':
      return link(node.attrs?.url ?? '', node.attrs?.url);
    case 'hardBreak':
      return '\n';
    case 'codeBlock': {
      const code = children.map(child => child.text ?? '').join('');
      const fence = '`'.repeat(Math.max(3, ...Array.from(code.matchAll(/`+/g), match => match[0].length + 1)));
      const language = node.attrs?.language?.replace(/[^\w+-]/g, '') ?? '';
      return `${fence}${language}\n${code}\n${fence}`;
    }
    case 'bulletList':
    case 'orderedList':
      return children.map((item, index) => {
        const marker = node.type === 'orderedList' ? `${(node.attrs?.order ?? 1) + index}. ` : '- ';
        return marker + render(item).replace(/\n/g, '\n' + ' '.repeat(marker.length));
      }).join('\n');
    case 'doc':
    case 'listItem':
    case 'blockquote':
    case 'panel':
    case 'table':
    case 'tableRow':
      return children.map(render).filter(Boolean).join(node.type === 'listItem' ? '\n' : '\n\n');
    default:
      return children.map(render).join('');
  }
}

/** Preserve Jira structure as plain Markdown. The issue renderer then quotes it as untrusted input. */
export function renderJiraText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (!value || typeof value !== 'object' || (value as AdfNode).type !== 'doc') return undefined;
  return render(value as AdfNode).trim() || undefined;
}
