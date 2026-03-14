import type { ReactNode } from "react";

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

interface CodeBlock {
  language: string;
  content: string;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const tokenKey = `${keyPrefix}-${match.index}`;

    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={tokenKey}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={tokenKey}>{renderInline(token.slice(2, -2), `${tokenKey}-strong`)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={tokenKey}>{renderInline(token.slice(1, -1), `${tokenKey}-em`)}</em>);
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const separatorIndex = token.indexOf("](");
      const label = token.slice(1, separatorIndex);
      const href = token.slice(separatorIndex + 2, -1);

      nodes.push(
        <a href={href} key={tokenKey} rel="noreferrer" target="_blank">
          {label}
        </a>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderParagraph(text: string, key: string) {
  const lines = text.split("\n");

  return (
    <p key={key}>
      {lines.map((line, index) => (
        <span key={`${key}-${index}`}>
          {index > 0 ? <br /> : null}
          {renderInline(line, `${key}-${index}`)}
        </span>
      ))}
    </p>
  );
}

function readCodeBlock(lines: string[], startIndex: number): { block: CodeBlock; nextIndex: number } {
  const openingLine = lines[startIndex].trim();
  const language = openingLine.slice(3).trim();
  const contentLines: string[] = [];
  let index = startIndex + 1;

  while (index < lines.length && !lines[index].trim().startsWith("```")) {
    contentLines.push(lines[index]);
    index += 1;
  }

  return {
    block: {
      language,
      content: contentLines.join("\n").trimEnd()
    },
    nextIndex: index < lines.length ? index + 1 : index
  };
}

function readList(
  lines: string[],
  startIndex: number,
  ordered: boolean
): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let index = startIndex;
  const matcher = ordered ? /^\d+\.\s+/ : /^[-*+]\s+/;

  while (index < lines.length) {
    const line = lines[index];
    if (!matcher.test(line.trim())) {
      break;
    }

    items.push(line.trim().replace(matcher, ""));
    index += 1;
  }

  return { items, nextIndex: index };
}

function readBlockquote(lines: string[], startIndex: number): { content: string; nextIndex: number } {
  const quoteLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed.startsWith(">")) {
      break;
    }

    quoteLines.push(trimmed.replace(/^>\s?/, ""));
    index += 1;
  }

  return {
    content: quoteLines.join("\n"),
    nextIndex: index
  };
}

function readParagraph(lines: string[], startIndex: number): { content: string; nextIndex: number } {
  const paragraphLines: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (
      !trimmed ||
      trimmed.startsWith("```") ||
      /^#{1,6}\s+/.test(trimmed) ||
      /^[-*+]\s+/.test(trimmed) ||
      /^\d+\.\s+/.test(trimmed) ||
      trimmed.startsWith(">") ||
      trimmed === "---"
    ) {
      break;
    }

    paragraphLines.push(lines[index]);
    index += 1;
  }

  return {
    content: paragraphLines.join("\n"),
    nextIndex: index
  };
}

function renderBlocks(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const { block, nextIndex } = readCodeBlock(lines, index);
      blocks.push(
        <pre className="chat-markdown-codeblock" key={`code-${index}`}>
          {block.language ? <span className="chat-markdown-code-label">{block.language}</span> : null}
          <code>{block.content}</code>
        </pre>
      );
      index = nextIndex;
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      const level = Math.min(trimmed.match(/^#+/)?.[0].length ?? 1, 6);
      const headingText = trimmed.replace(/^#{1,6}\s+/, "");
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;

      blocks.push(<HeadingTag key={`heading-${index}`}>{renderInline(headingText, `heading-${index}`)}</HeadingTag>);
      index += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push(<hr key={`rule-${index}`} />);
      index += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const { items, nextIndex } = readList(lines, index, false);
      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ul-${index}-${itemIndex}`}>{renderInline(item, `ul-${index}-${itemIndex}`)}</li>
          ))}
        </ul>
      );
      index = nextIndex;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const { items, nextIndex } = readList(lines, index, true);
      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`ol-${index}-${itemIndex}`}>{renderInline(item, `ol-${index}-${itemIndex}`)}</li>
          ))}
        </ol>
      );
      index = nextIndex;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const { content: quoteContent, nextIndex } = readBlockquote(lines, index);
      blocks.push(<blockquote key={`quote-${index}`}>{renderParagraph(quoteContent, `quote-${index}`)}</blockquote>);
      index = nextIndex;
      continue;
    }

    const { content: paragraphContent, nextIndex } = readParagraph(lines, index);
    blocks.push(renderParagraph(paragraphContent, `paragraph-${index}`));
    index = nextIndex;
  }

  return blocks;
}

export function ChatMarkdown(props: ChatMarkdownProps) {
  return <div className={props.className}>{renderBlocks(props.content)}</div>;
}
