import {
  parseMarkdown,
  extractText,
  isHeading,
  isParagraph,
  isTable,
  isCode,
  isList,
  isText,
  isStrong,
  isEmphasis,
  isInlineCode,
  isLink,
  isTableRow,
  isTableCell,
  isListItem,
  type Content,
  type Root,
  type Heading,
  type List,
  type Table,
} from './markdownParser';

// Types for pdfmake
interface PdfContent {
  text?: string | PdfContent[];
  style?: string | string[];
  bold?: boolean;
  italics?: boolean;
  fontSize?: number;
  font?: string;
  background?: string;
  margin?: number[];
  preserveLeadingSpaces?: boolean;
  ul?: PdfContent[];
  ol?: PdfContent[];
  table?: {
    headerRows?: number;
    widths?: (string | number)[];
    body: (string | PdfContent)[][];
  };
  layout?: string | object;
}

interface PdfDocDefinition {
  content: PdfContent[];
  defaultStyle: {
    font: string;
    fontSize: number;
    lineHeight: number;
  };
  styles: Record<string, object>;
}

// Lazy load pdfmake
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfMakeModule: any = null;

async function loadPdfMake() {
  if (!pdfMakeModule) {
    const pdfMakeImport = await import('pdfmake/build/pdfmake');
    const pdfFontsImport = await import('pdfmake/build/vfs_fonts');

    const pdfMake = pdfMakeImport.default || pdfMakeImport;
    const pdfFonts = pdfFontsImport.default || pdfFontsImport;

    // Set virtual file system for fonts
    if (pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) {
      pdfMake.vfs = pdfFonts.pdfMake.vfs;
    } else if (pdfFonts.vfs) {
      pdfMake.vfs = pdfFonts.vfs;
    }

    pdfMakeModule = pdfMake;
  }
  return pdfMakeModule;
}

/**
 * Convert inline content to pdfmake text array
 */
function convertInlineContent(
  nodes: Content[],
  options: { bold?: boolean; italics?: boolean } = {},
): PdfContent[] {
  const result: PdfContent[] = [];

  for (const node of nodes) {
    if (isText(node)) {
      result.push({
        text: node.value,
        bold: options.bold,
        italics: options.italics,
      });
    } else if (isStrong(node)) {
      result.push(...convertInlineContent(node.children as Content[], {
        ...options,
        bold: true,
      }));
    } else if (isEmphasis(node)) {
      result.push(...convertInlineContent(node.children as Content[], {
        ...options,
        italics: true,
      }));
    } else if (isInlineCode(node)) {
      result.push({
        text: node.value,
        font: 'Courier',
        background: '#E8E8E8',
      });
    } else if (isLink(node)) {
      result.push(...convertInlineContent(node.children as Content[], options));
    } else if ('children' in node && Array.isArray(node.children)) {
      result.push(...convertInlineContent(node.children as Content[], options));
    }
  }

  return result;
}

/**
 * Convert heading to pdfmake content
 */
function convertHeading(node: Heading): PdfContent {
  const level = node.depth;
  const fontSizes = [24, 20, 18, 16, 14, 12];
  const fontSize = fontSizes[level - 1] || 12;

  const textContent = convertInlineContent(node.children as Content[]);

  return {
    text: textContent,
    bold: true,
    fontSize,
    margin: [0, 15, 0, 8],
  };
}

/**
 * Convert paragraph to pdfmake content
 */
function convertParagraph(node: Content): PdfContent {
  if ('children' in node && Array.isArray(node.children)) {
    return {
      text: convertInlineContent(node.children as Content[]),
      margin: [0, 0, 0, 10],
    };
  }

  return {
    text: extractText(node),
    margin: [0, 0, 0, 10],
  };
}

/**
 * Convert code block to pdfmake content
 */
function convertCodeBlock(node: Content): PdfContent[] {
  const code = 'value' in node ? (node.value as string) : '';
  const language = 'lang' in node ? (node.lang as string) : '';

  const result: PdfContent[] = [];

  // Language label
  if (language) {
    result.push({
      text: language.toUpperCase(),
      bold: true,
      fontSize: 9,
      margin: [0, 10, 0, 5],
    });
  }

  // Code content
  result.push({
    text: code,
    font: 'Courier',
    fontSize: 10,
    background: '#F5F5F5',
    margin: [10, 5, 10, 10],
    preserveLeadingSpaces: true,
  });

  return result;
}

/**
 * Convert table to pdfmake table
 */
function convertTable(node: Table): PdfContent {
  const body: (string | PdfContent)[][] = [];

  for (let i = 0; i < node.children.length; i++) {
    const row = node.children[i];
    if (!isTableRow(row)) continue;

    const rowData: (string | PdfContent)[] = [];

    for (const cell of row.children) {
      if (!isTableCell(cell)) continue;

      const textContent = convertInlineContent(cell.children as Content[]);
      const isHeader = i === 0;

      rowData.push({
        text: textContent.length > 0 ? textContent : '',
        bold: isHeader,
        fillColor: isHeader ? '#E8E8E8' : undefined,
      });
    }

    body.push(rowData);
  }

  // Calculate widths based on number of columns
  const colCount = body[0]?.length || 1;
  const widths = Array(colCount).fill('*');

  return {
    table: {
      headerRows: 1,
      widths,
      body,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#CCCCCC',
      vLineColor: () => '#CCCCCC',
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 10, 0, 10],
  };
}

/**
 * Convert list item content to pdfmake
 */
function convertListItemContent(item: Content): PdfContent {
  if (!('children' in item)) {
    return { text: extractText(item) };
  }

  const children = item.children as Content[];
  const textParts: PdfContent[] = [];
  const nestedLists: PdfContent[] = [];

  for (const child of children) {
    if (isList(child)) {
      nestedLists.push(convertList(child));
    } else if (isParagraph(child)) {
      textParts.push(...convertInlineContent(child.children as Content[]));
    }
  }

  if (nestedLists.length > 0) {
    return {
      text: [
        ...textParts,
        ...nestedLists,
      ],
    };
  }

  return {
    text: textParts,
  };
}

/**
 * Convert list to pdfmake list
 */
function convertList(node: List): PdfContent {
  const isOrdered = node.ordered ?? false;
  const items: PdfContent[] = [];

  for (const item of node.children) {
    if (!isListItem(item)) continue;
    items.push(convertListItemContent(item));
  }

  if (isOrdered) {
    return {
      ol: items,
      margin: [0, 5, 0, 10],
    };
  }

  return {
    ul: items,
    margin: [0, 5, 0, 10],
  };
}

/**
 * Convert AST node to pdfmake content
 */
function convertNode(node: Content): PdfContent[] {
  if (isHeading(node)) {
    return [convertHeading(node)];
  }

  if (isParagraph(node)) {
    return [convertParagraph(node)];
  }

  if (isCode(node)) {
    return convertCodeBlock(node);
  }

  if (isTable(node)) {
    return [convertTable(node)];
  }

  if (isList(node)) {
    return [convertList(node)];
  }

  // Fallback for other node types
  const text = extractText(node);
  if (text) {
    return [{
      text,
      margin: [0, 0, 0, 10],
    }];
  }

  return [];
}

/**
 * Convert markdown to PDF and return as Blob
 */
export async function markdownToPdf(content: string, filename: string): Promise<Blob> {
  const pdfMake = await loadPdfMake();

  let pdfContent: PdfContent[];

  try {
    const ast: Root = parseMarkdown(content);
    pdfContent = [];

    for (const node of ast.children) {
      const elements = convertNode(node as Content);
      pdfContent.push(...elements);
    }
  } catch {
    // Fallback to simple text if parsing fails
    pdfContent = [{
      text: content,
      margin: [0, 0, 0, 10],
    }];
  }

  // If no content was generated, use plain text
  if (pdfContent.length === 0) {
    pdfContent = [{
      text: content || 'No content',
      margin: [0, 0, 0, 10],
    }];
  }

  const docDefinition: PdfDocDefinition = {
    content: pdfContent,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11,
      lineHeight: 1.4,
    },
    styles: {
      header: {
        fontSize: 24,
        bold: true,
        margin: [0, 0, 0, 10],
      },
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDocGenerator = pdfMake.createPdf(docDefinition);
      pdfDocGenerator.getBlob((blob: Blob) => {
        resolve(blob);
      });
    } catch (error) {
      reject(error);
    }
  });
}
