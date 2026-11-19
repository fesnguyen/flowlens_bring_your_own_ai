
/**
 * AdfNode — Represents a node in Atlassian Document Format (ADF).
 *
 * Jira stores rich-text fields, such as issue descriptions,
 * as nested JSON objects rather than plain strings.
 *
 * An ADF document is a tree:
 * - type: Identifies the node (text, paragraph, list, codeBlock, etc.).
 * - text: Text content for text nodes.
 * - attrs: Optional attributes such as URL, language, or list numbering.
 * - marks: Inline formatting metadata, such as hyperlinks.
 * - content: Child nodes containing nested document elements.
 *
 * This is a simplified type covering the fields used by FlowLens,
 * not the complete ADF specification.
 */
type AdfNode = {
  type?: string;
  text?: string;
  attrs?: {
    href?: string;
    language?: string;
    order?: number;
    url?: string;
  };
  marks?: {
    type?: string;
    attrs?: { href?: string };
  }[];
  content?: AdfNode[];
};

/**
 * link — Convert a text label and URL into a Markdown hyperlink.
 *
 * Example:
 *   link('Documentation', 'https://example.com')
 *   → [Documentation](<https://example.com>)
 *
 * Rules:
 * - Only allow HTTP, HTTPS, and mailto links.
 * - Return the original label when the URL is missing or unsupported.
 * - Encode problematic URL characters.
 * - Escape Markdown-sensitive characters in the link label.
 *
 * Jira content is external input, so links must not be trusted blindly.
 */
function link(label: string, href?: string): string {
  // Reject missing URLs and unsupported schemes such as javascript:.
  if (!href || !/^(https?:\/\/|mailto:)/i.test(href)) {
    return label;
  }

  // Encode whitespace, angle brackets, and backslashes in the URL.
  const target = href.replace(/[\s<>\\]/g, char => encodeURIComponent(char));

  // Escape Markdown syntax in the label before constructing the link.
  return `[${label.replace(/[\[\]\\]/g, '\\$&')}](<${target}>)`;
}

/**
 * render — Recursively convert an ADF node into Markdown text.
 *
 * Each node's type determines how its content should be formatted.
 * Nested nodes are processed recursively through render().
 *
 * Supported conversions:
 * - Text and hyperlinks.
 * - Inline cards.
 * - Line breaks.
 * - Fenced code blocks.
 * - Ordered and unordered lists.
 * - Document and container nodes.
 *
 * Unknown node types fall back to rendering their children.
 */
function render(node: AdfNode): string {
  // ADF nodes may contain nested children; use an empty array if absent.
  const children = node.content ?? [];

  switch (node.type) {
    /**
     * TEXT: Render text and preserve hyperlink marks when present.
     *
     * ADF represents links as formatting marks attached to text nodes.
     */
    case 'text':
      return link(
        node.text ?? '',
        node.marks?.find(mark => mark.type === 'link')?.attrs?.href,
      );

    /**
     * INLINE CARD: Render an embedded URL as a Markdown hyperlink.
     */
    case 'inlineCard':
      return link(node.attrs?.url ?? '', node.attrs?.url);

    /**
     * HARD BREAK: Preserve an explicit line break.
     */
    case 'hardBreak':
      return '\n';

    /**
     * CODE BLOCK: Convert source code into a fenced Markdown block.
     *
     * Use a fence longer than any backtick sequence in the code.
     * This prevents embedded backticks from accidentally closing it.
     *
     * Sanitize the language identifier before appending it to the fence.
     */
    case 'codeBlock': {
      // Combine the text of all code-block children.
      const code = children.map(child => child.text ?? '').join('');

      // Choose at least three backticks, increasing when code contains
      // longer backtick sequences.
      const fence = '`'.repeat(
        Math.max(
          3,
          ...Array.from(code.matchAll(/`+/g), match => match[0].length + 1),
        ),
      );

      // Keep only safe characters in the Markdown language identifier.
      const language = node.attrs?.language?.replace(/[^\w+-]/g, '') ?? '';

      return `${fence}${language}\n${code}\n${fence}`;
    }

    /**
     * LISTS: Convert ADF list items into Markdown list entries.
     *
     * Ordered lists use their configured starting number.
     * Bullet lists use a dash.
     *
     * Continuation lines are indented to align with the list content.
     */
    case 'bulletList':
    case 'orderedList':
      return children.map((item, index) => {
        const marker = node.type === 'orderedList'
          ? `${(node.attrs?.order ?? 1) + index}. `
          : '- ';

        // Indent multiline list-item content beneath its marker.
        return marker + render(item).replace(
          /\n/g,
          '\n' + ' '.repeat(marker.length),
        );
      }).join('\n');

    /**
     * CONTAINERS: Render their child nodes in document order.
     *
     * Most containers separate children with blank lines.
     * List items use single line breaks to keep their contents together.
     *
     * This is a simplified Markdown representation of ADF tables,
     * panels, and blockquotes rather than a full formatting conversion.
     */
    case 'doc':
    case 'listItem':
    case 'blockquote':
    case 'panel':
    case 'table':
    case 'tableRow':
      return children
        .map(render)
        .filter(Boolean)
        .join(node.type === 'listItem' ? '\n' : '\n\n');

    /**
     * FALLBACK: Preserve readable child content for unsupported node types.
     *
     * This prevents unknown ADF structures from being discarded entirely.
     */
    default:
      return children.map(render).join('');
  }
}

/**
 * renderJiraText — Public entry point for Jira rich-text conversion.
 *
 * Accepts either:
 * - A plain string.
 * - An ADF document object with type 'doc'.
 *
 * Execution:
 * 1. Return trimmed text when the input is already a string.
 * 2. Reject missing, invalid, or non-document values.
 * 3. Recursively convert the ADF document into Markdown.
 * 4. Remove surrounding whitespace.
 *
 * Returns undefined when no usable text exists.
 *
 * SECURITY:
 * The resulting Markdown represents external Jira content.
 * It must still be treated as untrusted input when inserted into
 * an AI inspection prompt. This function is not a security sanitizer.
 */
export function renderJiraText(value: unknown): string | undefined {
  // Plain-text Jira fields need no ADF conversion.
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  // Only accept an object whose root node is an ADF document.
  if (
    !value ||
    typeof value !== 'object' ||
    (value as AdfNode).type !== 'doc'
  ) {
    return undefined;
  }

  // Convert the document and return undefined if the result is empty.
  return render(value as AdfNode).trim() || undefined;
}
