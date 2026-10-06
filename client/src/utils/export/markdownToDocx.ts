/**
 * Simple markdown to DOCX converter without heavy dependencies
 */

// Lazy load docx library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let docxModule: any = null;

async function loadDocx() {
  if (!docxModule) {
    docxModule = await import('docx');
  }
  return docxModule;
}

interface TextStyle {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
}

/**
 * Parse inline formatting (bold, italic, code)
 */
function parseInlineFormatting(text: string, docx: any): any[] {
  const runs: any[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      runs.push(new docx.TextRun({ text: boldMatch[2], bold: true }));
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)(.+?)\1/);
    if (italicMatch) {
      runs.push(new docx.TextRun({ text: italicMatch[2], italics: true }));
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      runs.push(new docx.TextRun({
        text: codeMatch[1],
        font: 'Courier New',
        shading: { fill: 'E8E8E8' },
      }));
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Regular text until next special char
    const nextSpecial = remaining.search(/[\*_`]/);
    if (nextSpecial === -1) {
      runs.push(new docx.TextRun({ text: remaining }));
      break;
    } else if (nextSpecial === 0) {
      // Special char that didn't match a pattern, treat as regular
      runs.push(new docx.TextRun({ text: remaining[0] }));
      remaining = remaining.slice(1);
    } else {
      runs.push(new docx.TextRun({ text: remaining.slice(0, nextSpecial) }));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return runs.length > 0 ? runs : [new docx.TextRun({ text })];
}

/**
 * Parse a table from markdown lines
 */
function parseTable(lines: string[], startIndex: number, docx: any): { table: any; endIndex: number } | null {
  const tableLines: string[] = [];
  let i = startIndex;

  // Collect all table lines
  while (i < lines.length && lines[i].includes('|')) {
    tableLines.push(lines[i]);
    i++;
  }

  if (tableLines.length < 2) return null;

  // Parse rows
  const rows: string[][] = [];
  for (let j = 0; j < tableLines.length; j++) {
    const line = tableLines[j];
    // Skip separator line (contains ---)
    if (line.match(/^\|?\s*[-:]+\s*\|/)) continue;

    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return null;

  // Create table
  const tableRows = rows.map((row, rowIndex) => {
    const cells = row.map(cellText => {
      return new docx.TableCell({
        children: [new docx.Paragraph({
          children: parseInlineFormatting(cellText, docx),
        })],
        shading: rowIndex === 0 ? { fill: 'E8E8E8' } : undefined,
        margins: { top: 50, bottom: 50, left: 100, right: 100 },
      });
    });

    return new docx.TableRow({
      children: cells,
      tableHeader: rowIndex === 0,
    });
  });

  const table = new docx.Table({
    rows: tableRows,
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
  });

  return { table, endIndex: i - 1 };
}

/**
 * Convert markdown to DOCX elements
 */
async function convertMarkdownToElements(content: string): Promise<any[]> {
  const docx = await loadDocx();
  const elements: any[] = [];
  const lines = content.split('\n');

  let i = 0;
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeLanguage = '';

  while (i < lines.length) {
    const line = lines[i];

    // Code block start/end
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
        codeBlockLines = [];
      } else {
        // End of code block
        inCodeBlock = false;

        // Add language label
        if (codeLanguage) {
          elements.push(new docx.Paragraph({
            children: [new docx.TextRun({
              text: codeLanguage.toUpperCase(),
              bold: true,
              size: 18,
              color: '666666',
            })],
            spacing: { before: 200, after: 50 },
          }));
        }

        // Add code lines
        for (const codeLine of codeBlockLines) {
          elements.push(new docx.Paragraph({
            children: [new docx.TextRun({
              text: codeLine || ' ',
              font: 'Courier New',
              size: 20,
            })],
            shading: { fill: 'F5F5F5' },
            spacing: { before: 0, after: 0 },
            indent: { left: 200 },
          }));
        }

        elements.push(new docx.Paragraph({ children: [], spacing: { after: 200 } }));
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Table detection
    if (line.includes('|') && (i + 1 < lines.length && lines[i + 1].match(/^\|?\s*[-:]+/))) {
      const tableResult = parseTable(lines, i, docx);
      if (tableResult) {
        elements.push(tableResult.table);
        elements.push(new docx.Paragraph({ children: [], spacing: { after: 200 } }));
        i = tableResult.endIndex + 1;
        continue;
      }
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingLevels = [
        docx.HeadingLevel.HEADING_1,
        docx.HeadingLevel.HEADING_2,
        docx.HeadingLevel.HEADING_3,
        docx.HeadingLevel.HEADING_4,
        docx.HeadingLevel.HEADING_5,
        docx.HeadingLevel.HEADING_6,
      ];

      elements.push(new docx.Paragraph({
        children: parseInlineFormatting(text, docx),
        heading: headingLevels[level - 1],
        spacing: { before: 240, after: 120 },
      }));
      i++;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      const indent = Math.floor(ulMatch[1].length / 2);
      elements.push(new docx.Paragraph({
        children: parseInlineFormatting(ulMatch[2], docx),
        bullet: { level: Math.min(indent, 2) },
        spacing: { after: 50 },
      }));
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      const indent = Math.floor(olMatch[1].length / 2);
      elements.push(new docx.Paragraph({
        children: parseInlineFormatting(olMatch[2], docx),
        numbering: { reference: 'default-numbering', level: Math.min(indent, 2) },
        spacing: { after: 50 },
      }));
      i++;
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s*(.*)$/);
    if (quoteMatch) {
      elements.push(new docx.Paragraph({
        children: parseInlineFormatting(quoteMatch[1], docx),
        indent: { left: 400 },
        border: {
          left: { style: docx.BorderStyle.SINGLE, size: 12, color: 'CCCCCC' },
        },
        spacing: { after: 100 },
      }));
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(new docx.Paragraph({
      children: parseInlineFormatting(line, docx),
      spacing: { after: 150 },
    }));
    i++;
  }

  return elements;
}

/**
 * Convert markdown to DOCX and return as Blob
 */
export async function markdownToDocx(content: string, filename: string): Promise<Blob> {
  const docx = await loadDocx();

  const children = await convertMarkdownToElements(content);

  // Fallback if no content
  if (children.length === 0) {
    children.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: content || 'No content' })],
    }));
  }

  const doc = new docx.Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            { level: 0, format: docx.LevelFormat.DECIMAL, text: '%1.', alignment: docx.AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: docx.LevelFormat.LOWER_LETTER, text: '%2)', alignment: docx.AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
            { level: 2, format: docx.LevelFormat.LOWER_ROMAN, text: '%3.', alignment: docx.AlignmentType.LEFT, style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  return await docx.Packer.toBlob(doc);
}
