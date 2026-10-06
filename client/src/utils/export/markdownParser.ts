import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root, Content, Table, TableRow, TableCell, Code, List, ListItem, Heading, Paragraph, Text, Strong, Emphasis, InlineCode, Link } from 'mdast';

export type MarkdownNode = Content;

export interface ParsedMarkdown {
  ast: Root;
}

/**
 * Parse markdown string to AST using remark with GFM support
 */
export function parseMarkdown(content: string): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  return processor.parse(content);
}

/**
 * Extract plain text from AST node (recursive)
 */
export function extractText(node: Content | Root): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }

  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map((child) => extractText(child as Content)).join('');
  }

  return '';
}

/**
 * Check if node is a specific type
 */
export function isHeading(node: Content): node is Heading {
  return node.type === 'heading';
}

export function isParagraph(node: Content): node is Paragraph {
  return node.type === 'paragraph';
}

export function isTable(node: Content): node is Table {
  return node.type === 'table';
}

export function isCode(node: Content): node is Code {
  return node.type === 'code';
}

export function isList(node: Content): node is List {
  return node.type === 'list';
}

export function isListItem(node: Content): node is ListItem {
  return node.type === 'listItem';
}

export function isText(node: Content): node is Text {
  return node.type === 'text';
}

export function isStrong(node: Content): node is Strong {
  return node.type === 'strong';
}

export function isEmphasis(node: Content): node is Emphasis {
  return node.type === 'emphasis';
}

export function isInlineCode(node: Content): node is InlineCode {
  return node.type === 'inlineCode';
}

export function isLink(node: Content): node is Link {
  return node.type === 'link';
}

export function isTableRow(node: Content): node is TableRow {
  return node.type === 'tableRow';
}

export function isTableCell(node: Content): node is TableCell {
  return node.type === 'tableCell';
}

export type {
  Root,
  Content,
  Table,
  TableRow,
  TableCell,
  Code,
  List,
  ListItem,
  Heading,
  Paragraph,
  Text,
  Strong,
  Emphasis,
  InlineCode,
  Link,
};
