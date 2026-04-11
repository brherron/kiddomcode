interface AdfMark {
  readonly type?: string;
  readonly attrs?: Record<string, unknown>;
}

interface AdfNode {
  readonly type?: string;
  readonly text?: string;
  readonly attrs?: Record<string, unknown>;
  readonly marks?: ReadonlyArray<AdfMark>;
  readonly content?: ReadonlyArray<AdfNode>;
}

function escapeInlineCode(text: string): string {
  return text.replace(/`/g, "\\`");
}

function applyMarks(text: string, marks: ReadonlyArray<AdfMark> | undefined): string {
  if (!marks || marks.length === 0) {
    return text;
  }

  return marks.reduce((current, mark) => {
    switch (mark.type) {
      case "strong":
        return `**${current}**`;
      case "em":
        return `_${current}_`;
      case "strike":
        return `~~${current}~~`;
      case "code":
        return `\`${escapeInlineCode(current)}\``;
      case "link": {
        const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : null;
        return href ? `[${current}](${href})` : current;
      }
      default:
        return current;
    }
  }, text);
}

function renderInline(node: AdfNode | undefined): string {
  if (!node) {
    return "";
  }

  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks);
    case "hardBreak":
      return "\n";
    case "emoji":
      return typeof node.attrs?.text === "string" ? node.attrs.text : "";
    case "mention":
      return typeof node.attrs?.text === "string" ? node.attrs.text : "@mention";
    case "inlineCard":
      return typeof node.attrs?.url === "string" ? node.attrs.url : "";
    default:
      return (node.content ?? []).map(renderInline).join("");
  }
}

function renderParagraph(node: AdfNode): string {
  return (node.content ?? []).map(renderInline).join("").trim();
}

function indentLines(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line, index) =>
      index === 0 ? `${prefix}${line}` : `${" ".repeat(prefix.length)}${line}`,
    )
    .join("\n");
}

function renderList(node: AdfNode, ordered: boolean): string {
  return (node.content ?? [])
    .map((item, index) => {
      const marker = ordered ? `${index + 1}. ` : "- ";
      return renderListItem(item, marker);
    })
    .filter((entry) => entry.length > 0)
    .join("\n");
}

function renderListItem(node: AdfNode, marker: string): string {
  const rendered = (node.content ?? [])
    .map(renderBlock)
    .filter((entry) => entry.length > 0)
    .join("\n");

  if (rendered.length === 0) {
    return "";
  }

  return indentLines(rendered, marker);
}

function renderBlock(node: AdfNode | undefined): string {
  if (!node) {
    return "";
  }

  switch (node.type) {
    case "paragraph":
      return renderParagraph(node);
    case "heading": {
      const level =
        typeof node.attrs?.level === "number" && node.attrs.level >= 1 && node.attrs.level <= 6
          ? node.attrs.level
          : 2;
      const body = renderParagraph(node);
      return body.length > 0 ? `${"#".repeat(level)} ${body}` : "";
    }
    case "bulletList":
      return renderList(node, false);
    case "orderedList":
      return renderList(node, true);
    case "blockquote": {
      const body = (node.content ?? [])
        .map(renderBlock)
        .filter((entry) => entry.length > 0)
        .join("\n\n");
      return body
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }
    case "codeBlock": {
      const text = (node.content ?? []).map((child) => child.text ?? renderInline(child)).join("");
      return `\`\`\`\n${text.trimEnd()}\n\`\`\``;
    }
    case "rule":
      return "---";
    case "panel":
    case "expand":
    case "listItem":
      return (node.content ?? [])
        .map(renderBlock)
        .filter((entry) => entry.length > 0)
        .join("\n");
    default: {
      const paragraph = renderParagraph(node);
      if (paragraph.length > 0) {
        return paragraph;
      }
      return (node.content ?? [])
        .map(renderBlock)
        .filter((entry) => entry.length > 0)
        .join("\n");
    }
  }
}

export function adfToMarkdown(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const root = value as AdfNode;
  const blocks = root.type === "doc" ? (root.content ?? []) : [root];
  return blocks
    .map(renderBlock)
    .filter((entry) => entry.length > 0)
    .join("\n\n")
    .trim();
}
