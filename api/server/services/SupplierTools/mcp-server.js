const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const ExcelJS = require('exceljs');
const {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} = require('docx');

const ARTIFACT_DIR = process.env.SUPPLIER_ARTIFACTS_DIR || '/app/uploads/supplier-artifacts';
const PUBLIC_BASE = (process.env.DOMAIN_CLIENT || 'http://localhost:3080').replace(/\/$/, '');
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const server = new McpServer({ name: 'corp-supplier-tools', version: '1.0.0' });

function normalizeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
  return text || fallback;
}

function safeFilename(value, extension) {
  const base = normalizeText(value, 'document')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 100) || 'document';
  return `${base}.${extension}`;
}

function escapeXml(value) {
  return normalizeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function excelColumnName(index) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function xlsxCell(row, column, value, style = 0) {
  const ref = `${excelColumnName(column)}${row}`;
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

async function cleanupArtifacts() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const now = Date.now();
  const entries = await fs.readdir(ARTIFACT_DIR, { withFileTypes: true });
  await Promise.all(
    entries.filter((entry) => entry.isFile()).map(async (entry) => {
      const filePath = path.join(ARTIFACT_DIR, entry.name);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > MAX_AGE_MS) await fs.unlink(filePath);
      } catch (_) {
        // A concurrent cleanup/download can remove the file first.
      }
    }),
  );
}

async function saveArtifact(buffer, filename, mimeType) {
  await cleanupArtifacts();
  const token = crypto.randomUUID();
  const extension = path.extname(filename).replace(/^\./, '').toLowerCase();
  const storageName = `${token}.${extension}`;
  const filePath = path.join(ARTIFACT_DIR, storageName);
  const tempPath = `${filePath}.tmp`;
  const metadataPath = path.join(ARTIFACT_DIR, `${token}.json`);
  const expiresAt = new Date(Date.now() + MAX_AGE_MS).toISOString();

  await fs.writeFile(tempPath, buffer, { mode: 0o600 });
  await fs.rename(tempPath, filePath);
  await fs.writeFile(
    metadataPath,
    JSON.stringify({ token, storageName, filename, mimeType, expiresAt }, null, 2),
    { mode: 0o600 },
  );

  return {
    token,
    filename,
    mimeType,
    expiresAt,
    downloadUrl: `${PUBLIC_BASE}/api/files/supplier-artifacts/${token}`,
  };
}

function workbookStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FF1F1F1F"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFB7B7B7"/></left><right style="thin"><color rgb="FFB7B7B7"/></right><top style="thin"><color rgb="FFB7B7B7"/></top><bottom style="thin"><color rgb="FFB7B7B7"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

async function createComparisonWorkbook({ title, suppliers, rows, sourceFiles, conclusion }) {
  const hasNotes = rows.some((row) => normalizeText(row.note));
  const columns = ['Критерий', ...suppliers, 'Источники / ссылки', ...(hasNotes ? ['Комментарий'] : [])];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI Corp Chat';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet('Сравнение', {
    views: [{ state: 'frozen', ySplit: 4, topLeftCell: 'A5', showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    properties: { defaultRowHeight: 18 },
  });

  sheet.columns = [
    { width: 34 },
    ...suppliers.map(() => ({ width: 28 })),
    { width: 52 },
    ...(hasNotes ? [{ width: 40 }] : []),
  ];

  const lastColumn = excelColumnName(columns.length - 1);
  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getCell('A1').value = normalizeText(title, 'Сравнение коммерческих предложений');
  sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF000000' } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(`A2:${lastColumn}2`);
  sheet.getCell('A2').value = `Дата формирования: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;
  sheet.mergeCells(`A3:${lastColumn}3`);
  sheet.getCell('A3').value = `Исходные файлы: ${sourceFiles?.length ? sourceFiles.join('; ') : 'не указаны'}`;
  for (const address of ['A2', 'A3']) {
    sheet.getCell(address).font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    sheet.getCell(address).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  }

  const headerRow = sheet.getRow(4);
  headerRow.values = columns;
  headerRow.height = 34;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    };
  });

  rows.forEach((item, index) => {
    const values = Array.from({ length: suppliers.length }, (_, supplierIndex) =>
      normalizeText(item.values?.[supplierIndex], 'Не указано'),
    );
    const sources = Array.from({ length: suppliers.length }, (_, supplierIndex) => {
      const source = normalizeText(item.sources?.[supplierIndex]);
      return source ? `${suppliers[supplierIndex]}: ${source}` : '';
    }).filter(Boolean).join('\n');
    const row = sheet.addRow([
      normalizeText(item.criterion, 'Без названия'),
      ...values,
      sources || 'Источник не указан',
      ...(hasNotes ? [normalizeText(item.note)] : []),
    ]);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? 'FFFFFFFF' : 'FFF2F7FB' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    });
  });

  const lastDataRow = sheet.rowCount;
  sheet.autoFilter = { from: 'A4', to: `${lastColumn}${lastDataRow}` };
  sheet.pageSetup.printTitlesRow = '1:4';
  sheet.pageSetup.printArea = `A1:${lastColumn}${conclusion ? lastDataRow + 2 : lastDataRow}`;

  if (conclusion) {
    const conclusionRow = lastDataRow + 2;
    sheet.mergeCells(`A${conclusionRow}:${lastColumn}${conclusionRow}`);
    const cell = sheet.getCell(`A${conclusionRow}`);
    cell.value = `Вывод: ${normalizeText(conclusion)}`;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2F8' } };
    cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'B7B7B7' },
};

function textParagraphs(value, options = {}) {
  const lines = normalizeText(value, '—').split('\n');
  return lines.map((line) => new Paragraph({
    spacing: { after: 80, line: 276 },
    alignment: options.alignment,
    children: [new TextRun({ text: line || ' ', bold: options.bold, color: options.color, size: options.size || 20 })],
  }));
}

function headerCell(text, width = 50) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, fill: '1F4E78', color: 'auto' },
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children: textParagraphs(text, { bold: true, color: 'FFFFFF', alignment: AlignmentType.CENTER, size: 22 }),
  });
}

function bodyCell(text, width = 50) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: textParagraphs(text),
  });
}

function reputationStatusLabel(status) {
  const labels = {
    checked_exact_match: 'Проверено: точное совпадение',
    checked_possible_match: 'Проверено: возможное совпадение',
    checked_no_match: 'Проверено: совпадение не найдено',
    checked_via_web_index: 'Найдены релевантные публикации',
    checked_via_web_index_no_relevant_results: 'Релевантные публикации не найдены',
    manual_check_required: 'Требуется ручная проверка',
    unavailable: 'Источник временно недоступен',
  };
  return labels[status] || normalizeText(status, 'Статус не указан');
}

function reputationLinkCell(value, width = 20) {
  const url = normalizeText(value);
  if (!/^https?:\/\//i.test(url)) return bodyCell('—', width);
  let label = 'Открыть источник';
  try {
    label = `Открыть: ${new URL(url).hostname.replace(/^www\./, '')}`;
  } catch (_) {}
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { after: 80, line: 276 },
      children: [new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text: label, color: '0563C1', underline: { type: UnderlineType.SINGLE }, size: 19 })],
      })],
    })],
  });
}

function formatRussianDateTime(value) {
  const text = normalizeText(value);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-');
    return `${day}.${month}.${year}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

function bilingualHeaderCell(text) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, fill: 'E7E6E6', color: 'auto' },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0, line: 240 },
      children: [new TextRun({ text, bold: true, color: '000000', size: 19, font: 'Arial' })],
    })],
  });
}

function bilingualBodyCell(reference, text) {
  const children = [];
  const normalizedReference = normalizeText(reference);
  if (normalizedReference) {
    children.push(new Paragraph({
      spacing: { after: 60, line: 240 },
      children: [new TextRun({ text: normalizedReference, bold: true, size: 19, font: 'Arial' })],
    }));
  }
  for (const line of normalizeText(text, '—').split('\n')) {
    children.push(new Paragraph({
      spacing: { after: 80, line: 264 },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: line || ' ', size: 19, font: 'Arial' })],
    }));
  }
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children,
  });
}

function commonFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'AI Corp Chat · стр. ', size: 18, color: '666666' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '666666' })],
    })],
  });
}

function pageNumberFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Стр. ', size: 18, color: '666666' }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '666666' })],
    })],
  });
}

async function createBilingualDocument({ title, sourceFile, sections, notes }) {
  const rows = [
    new TableRow({ tableHeader: true, cantSplit: true, children: [bilingualHeaderCell('English'), bilingualHeaderCell('Русский')] }),
    ...sections.map((section) => new TableRow({
      children: [
        bilingualBodyCell(section.reference, section.source),
        bilingualBodyCell(section.reference, section.translation),
      ],
    })),
  ];

  const document = new Document({
    creator: 'AI Corp Chat',
    title,
    description: 'Параллельный двуязычный документ на английском и русском языках',
    styles: { default: { document: { run: { font: 'Arial', size: 19 }, paragraph: { spacing: { after: 80, line: 264 } } } } },
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      footers: { default: pageNumberFooter() },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: title, bold: true, size: 28, color: '000000', font: 'Arial' })] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: tableBorders, rows }),
        ...(notes ? [new Paragraph({ text: '' }), new Paragraph({ children: [new TextRun({ text: `Примечания: ${notes}`, italics: true, size: 18 })] })] : []),
      ],
    }],
  });
  return Packer.toBuffer(document);
}

async function createReputationDocument({ companyName, inn, checkedAt, overallRisk, summary, checks, limitations }) {
  const rows = [
    new TableRow({ tableHeader: true, cantSplit: true, children: [headerCell('Источник', 20), headerCell('Статус', 15), headerCell('Установленные факты', 45), headerCell('Ссылка', 20)] }),
    ...checks.map((check) => new TableRow({ children: [
      bodyCell(check.source, 20), bodyCell(reputationStatusLabel(check.status), 15), bodyCell((check.facts || []).join('\n') || 'Сведения не получены', 45), reputationLinkCell(check.url, 20),
    ] })),
  ];
  const document = new Document({
    creator: 'AI Corp Chat',
    title: `Проверка поставщика ${companyName}`,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: { page: { margin: { top: 850, right: 700, bottom: 850, left: 700 } } },
      footers: { default: commonFooter() },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ОТЧЁТ О ПРОВЕРКЕ ПОСТАВЩИКА', bold: true, size: 32, color: '1F4E78' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Организация: ', bold: true }), new TextRun(companyName)] }),
        new Paragraph({ children: [new TextRun({ text: 'ИНН: ', bold: true }), new TextRun(inn)] }),
        new Paragraph({ children: [new TextRun({ text: 'Дата проверки: ', bold: true }), new TextRun(formatRussianDateTime(checkedAt))] }),
        new Paragraph({ children: [new TextRun({ text: 'Предварительный уровень риска: ', bold: true }), new TextRun(overallRisk)] }),
        new Paragraph({ text: '' }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Резюме', bold: true, color: '1F4E78' })] }),
        ...textParagraphs(summary),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Результаты по источникам', bold: true, color: '1F4E78' })] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: tableBorders, rows }),
        new Paragraph({ text: '' }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Ограничения проверки', bold: true, color: '1F4E78' })] }),
        ...textParagraphs(limitations || 'Открытые источники могут быть неполными или временно недоступными.'),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: 'Отчёт носит информационно-аналитический характер и не заменяет юридическую или финансовую экспертизу.', italics: true, size: 18, color: '666666' })] }),
      ],
    }],
  });
  return Packer.toBuffer(document);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 AI Corp Chat/1.0', ...(options.headers || {}) } });
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtml(value) {
  return normalizeText(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeJsString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch (_) {
    return value;
  }
}

function decodeBingUrl(value) {
  try {
    const parsed = new URL(value);
    if (!/(^|\.)bing\.com$/i.test(parsed.hostname) || parsed.pathname !== '/ck/a') return value;
    const encoded = parsed.searchParams.get('u');
    if (!encoded || !encoded.startsWith('a1')) return value;
    const decoded = Buffer.from(encoded.slice(2), 'base64url').toString('utf8');
    return /^https?:\/\//i.test(decoded) ? decoded : value;
  } catch (_) {
    return value;
  }
}

function relevantCompanyTokens(companyName) {
  const stopWords = new Set(['ооо', 'пао', 'ао', 'зао', 'оао', 'ип', 'нко', 'банк', 'россия', 'россии']);
  return normalizeText(companyName)
    .toLowerCase()
    .replace(/[«»"'()]/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 4 && !stopWords.has(token));
}

function filterSearchResults(results, { allowedDomains = [], companyName, inn, limit }) {
  const companyTokens = relevantCompanyTokens(companyName);
  const seen = new Set();
  const accepted = [];
  for (const rawItem of results || []) {
    const url = decodeBingUrl(rawItem.url);
    let hostname = '';
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch (_) {
      continue;
    }
    if (allowedDomains.length && !allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) continue;
    const title = decodeHtml(rawItem.title);
    const snippet = decodeHtml(rawItem.snippet);
    const haystack = `${title} ${snippet} ${url}`.toLowerCase();
    const identityMatch = haystack.includes(inn) || companyTokens.some((token) => haystack.includes(token));
    if (!identityMatch) continue;
    const key = url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push({ title, url, snippet });
    if (accepted.length >= limit) break;
  }
  return accepted;
}

async function duckDuckGoSearch(query, limit = 5) {
  try {
    const response = await fetchWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {}, 10000);
    if (!response.ok) return { status: 'unavailable', error: `HTTP ${response.status}`, results: [] };
    const html = await response.text();
    const results = [];
    const regex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) && results.length < limit) {
      let url = match[1].replace(/&amp;/g, '&');
      try {
        const parsed = new URL(url, 'https://duckduckgo.com');
        url = parsed.searchParams.get('uddg') || parsed.href;
      } catch (_) {}
      results.push({ title: decodeHtml(match[2]), url, snippet: decodeHtml(match[3]) });
    }
    return { status: 'checked_via_web_index', results };
  } catch (error) {
    return { status: 'unavailable', error: error.name === 'AbortError' ? 'timeout' : error.message, results: [] };
  }
}

async function bingSearch(query, limit = 5) {
  try {
    const response = await fetchWithTimeout(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=ru-RU`, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    }, 10000);
    if (!response.ok) return { status: 'unavailable', error: `HTTP ${response.status}`, results: [] };
    const html = await response.text();
    const results = [];
    const regex = /<li[^>]+class="[^"]*b_algo[^"]*"[^>]*>[\s\S]*?<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>|<div[^>]+class="[^"]*b_caption[^"]*"[^>]*>([\s\S]*?)<\/div>)/gi;
    let match;
    while ((match = regex.exec(html)) && results.length < limit) {
      const url = match[1].replace(/&amp;/g, '&');
      if (!/^https?:\/\//i.test(url)) continue;
      results.push({ title: decodeHtml(match[2]), url, snippet: decodeHtml(match[3] || match[4] || '') });
    }
    return { status: 'checked_via_web_index', results };
  } catch (error) {
    return { status: 'unavailable', error: error.name === 'AbortError' ? 'timeout' : error.message, results: [] };
  }
}

async function braveSearch(query, limit = 5) {
  try {
    const response = await fetchWithTimeout(`https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`, {
      headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.5' },
    }, 10000);
    if (!response.ok) return { status: 'unavailable', error: `HTTP ${response.status}`, results: [] };
    const html = await response.text();
    const results = [];
    const regex = /\{title:"((?:\\.|[^"\\])*)",url:"((?:\\.|[^"\\])*)",full_title:(?:void 0|"(?:\\.|[^"\\])*")?,description:"((?:\\.|[^"\\])*)",page_age:/g;
    let match;
    while ((match = regex.exec(html)) && results.length < limit) {
      const title = decodeJsString(match[1]);
      const url = decodeJsString(match[2]);
      const snippet = decodeJsString(match[3]);
      if (!/^https?:\/\//i.test(url)) continue;
      results.push({ title, url, snippet });
    }
    return { status: 'checked_via_web_index', results };
  } catch (error) {
    return { status: 'unavailable', error: error.name === 'AbortError' ? 'timeout' : error.message, results: [] };
  }
}

async function openWebSearch(query, { limit = 6, allowedDomains = [], companyName, inn }) {
  const engines = await Promise.all([
    duckDuckGoSearch(query, limit),
    braveSearch(query, limit),
    bingSearch(query, limit),
  ]);
  const seen = new Set();
  const results = [];
  const engineDetails = engines.map((engine, index) => {
    const accepted = filterSearchResults(engine.results, { allowedDomains, companyName, inn, limit });
    return {
      name: index === 0 ? 'DuckDuckGo' : index === 1 ? 'Brave Search' : 'Bing',
      status: engine.status,
      error: engine.error,
      rawResultCount: (engine.results || []).length,
      acceptedResultCount: accepted.length,
      accepted,
    };
  });
  for (const engine of engineDetails) {
    for (const item of engine.accepted) {
      const key = normalizeText(item.url).replace(/\/$/, '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      results.push(item);
      if (results.length >= limit) break;
    }
    if (results.length >= limit) break;
  }
  const availableCount = engines.filter((engine) => engine.status !== 'unavailable').length;
  return {
    status: availableCount === 0 ? 'unavailable' : results.length > 0 ? 'checked_via_web_index' : 'checked_via_web_index_no_relevant_results',
    query,
    engines: engineDetails.map((engine) => ({
      name: engine.name,
      status: engine.status,
      error: engine.error,
      rawResultCount: engine.rawResultCount,
      acceptedResultCount: engine.acceptedResultCount,
    })),
    results,
    ...(availableCount === 0 ? { error: 'Все бесплатные поисковые индексы недоступны' } : {}),
  };
}

async function checkFNS(companyName, inn) {
  const body = new URLSearchParams({ query: inn });
  const first = await fetchWithTimeout('https://egrul.nalog.ru/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json' },
    body,
  });
  if (!first.ok) throw new Error(`ФНС HTTP ${first.status}`);
  const tokenData = await first.json();
  if (tokenData.captchaRequired || !tokenData.t) throw new Error('ФНС потребовала CAPTCHA');
  const second = await fetchWithTimeout(`https://egrul.nalog.ru/search-result/${encodeURIComponent(tokenData.t)}`, { headers: { Accept: 'application/json' } });
  if (!second.ok) throw new Error(`ФНС search HTTP ${second.status}`);
  const data = await second.json();
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const exact = rows.find((row) => String(row.i) === inn) || rows[0];
  if (!exact) return { status: 'checked_no_match', queryName: companyName, inn, facts: [] };
  return {
    status: String(exact.i) === inn ? 'checked_exact_match' : 'checked_possible_match',
    facts: [
      `Полное наименование: ${normalizeText(exact.n, 'не указано')}`,
      `Краткое наименование: ${normalizeText(exact.c, 'не указано')}`,
      `ИНН: ${normalizeText(exact.i, 'не указано')}`,
      `ОГРН: ${normalizeText(exact.o, 'не указано')}`,
      `КПП: ${normalizeText(exact.p, 'не указано')}`,
      `Дата регистрации: ${normalizeText(exact.r, 'не указано')}`,
      `Регион: ${normalizeText(exact.rn, 'не указано')}`,
      `Руководитель: ${normalizeText(exact.g, 'не указано')}`,
    ],
    raw: { fullName: exact.n, shortName: exact.c, inn: exact.i, ogrn: exact.o, kpp: exact.p, registrationDate: exact.r, region: exact.rn, manager: exact.g },
  };
}

server.registerTool('check_supplier_reputation', {
  title: 'Проверить поставщика по открытым источникам',
  description: 'Бесплатно проверяет юридическое лицо по названию и ИНН: ФНС ЕГРЮЛ, РНП ЕИС, КАД, Федресурс, ФССП, суды общей юрисдикции, ФНС Прозрачный бизнес, ФАС, открытые карточки компаний, новости и отзывы. Использует официальные сайты и бесплатные поисковые индексы, фильтрует результаты по домену и совпадению названия/ИНН, возвращает прямые ссылки и отдельно отмечает недоступные источники. Платная подписка не требуется; отсутствие результатов не означает отсутствие риска.',
  inputSchema: {
    company_name: z.string().min(2).max(500).describe('Полное или известное наименование организации'),
    inn: z.string().regex(/^\d{10}$/, 'Для российского юридического лица требуется ИНН из 10 цифр'),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
}, async ({ company_name: companyName, inn }) => {
  const checkedAt = new Date().toISOString();
  let fns;
  try {
    fns = await checkFNS(companyName, inn);
  } catch (error) {
    fns = { status: 'unavailable', error: error.message, facts: [] };
  }

  const searchDefinitions = [
    {
      source: 'РНП ЕИС закупок',
      officialUrl: `https://zakupki.gov.ru/epz/dishonestsupplier/search/results.html?searchString=${inn}`,
      query: `site:zakupki.gov.ru/epz/dishonestsupplier "${inn}"`,
      allowedDomains: ['zakupki.gov.ru'],
    },
    {
      source: 'Картотека арбитражных дел',
      officialUrl: `https://kad.arbitr.ru/?query=${encodeURIComponent(inn)}`,
      query: `site:kad.arbitr.ru "${inn}" "${companyName}"`,
      allowedDomains: ['kad.arbitr.ru'],
    },
    {
      source: 'Федресурс и сообщения о банкротстве',
      officialUrl: `https://fedresurs.ru/search/entity?searchString=${encodeURIComponent(inn)}`,
      query: `site:fedresurs.ru "${inn}" "${companyName}"`,
      allowedDomains: ['fedresurs.ru'],
    },
    {
      source: 'ФССП и исполнительные производства',
      officialUrl: 'https://fssp.gov.ru/iss/ip',
      query: `site:fssp.gov.ru "${inn}" "${companyName}" исполнительное производство`,
      allowedDomains: ['fssp.gov.ru'],
    },
    {
      source: 'Суды общей юрисдикции и судебные акты',
      officialUrl: 'https://sudrf.ru/',
      query: `(site:sudrf.ru OR site:sudact.ru) "${inn}" "${companyName}"`,
      allowedDomains: ['sudrf.ru', 'sudact.ru'],
    },
    {
      source: 'ФНС Прозрачный бизнес и ограничения',
      officialUrl: `https://pb.nalog.ru/search.html#t=0&mode=search-all&queryAll=${encodeURIComponent(inn)}`,
      query: `(site:pb.nalog.ru OR site:service.nalog.ru) "${inn}" "${companyName}"`,
      allowedDomains: ['pb.nalog.ru', 'service.nalog.ru'],
    },
    {
      source: 'ФАС России и антимонопольные дела',
      officialUrl: 'https://br.fas.gov.ru/',
      query: `(site:fas.gov.ru OR site:br.fas.gov.ru) "${inn}" "${companyName}"`,
      allowedDomains: ['fas.gov.ru', 'br.fas.gov.ru'],
    },
    {
      source: 'Открытые карточки юридических лиц',
      officialUrl: null,
      query: `(site:checko.ru OR site:rusprofile.ru OR site:list-org.com) "${inn}"`,
      allowedDomains: ['checko.ru', 'rusprofile.ru', 'list-org.com'],
    },
    {
      source: 'Новости, отзывы и иные открытые публикации',
      officialUrl: null,
      query: `"${companyName}" "${inn}" (отзывы OR претензии OR суд OR долг OR банкротство OR мошенничество)`,
    },
  ];
  const searches = await Promise.all(searchDefinitions.map((definition) => openWebSearch(definition.query, {
    allowedDomains: definition.allowedDomains || [],
    companyName,
    inn,
  })));

  const result = {
    checkedAt,
    companyName,
    inn,
    identity: { source: 'ФНС России — ЕГРЮЛ/ЕГРИП', url: `https://egrul.nalog.ru/index.html?query=${encodeURIComponent(inn)}`, ...fns },
    sourceChecks: searchDefinitions.map((definition, index) => ({
      source: definition.source,
      officialUrl: definition.officialUrl,
      ...searches[index],
      ...(definition.source.startsWith('ФССП') ? {
        officialVerification: 'manual_check_required',
        reason: 'Официальный поиск ФССП использует интерактивную защиту; веб-индекс даёт только упоминания и не подтверждает отсутствие производств.',
      } : {}),
    })),
    coverage: {
      paidServicesRequired: false,
      searchEngines: ['DuckDuckGo', 'Brave Search', 'Bing'],
      officialSources: ['ФНС ЕГРЮЛ', 'ЕИС РНП', 'КАД', 'Федресурс', 'ФССП', 'ГАС Правосудие', 'ФНС Прозрачный бизнес', 'ФАС России'],
      additionalOpenSources: ['Checko', 'Rusprofile', 'List-Org', 'новости и отзывы'],
    },
    interpretationRules: [
      'Использовать только факты, присутствующие в результатах, и приводить ссылку на каждый факт.',
      'Результат веб-индекса является сигналом для перепроверки, а не официальным подтверждением.',
      'Пустой результат или недоступность источника нельзя формулировать как отсутствие нарушений.',
      'До итогового решения ответственный сотрудник должен вручную открыть официальные ссылки источников со статусом manual_check_required или unavailable.',
      'Платные сервисы не требуются: проверка использует официальные сайты и бесплатные поисковые индексы. При необходимости углублённой финансовой проверки её следует назначить отдельно.',
    ],
  };
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

server.registerTool('create_comparison_xlsx', {
  title: 'Создать сравнительную таблицу коммерческих предложений',
  description: 'ОБЯЗАТЕЛЬНЫЙ финальный инструмент режима сравнения коммерческих предложений. Вызывай его после чтения всех приложенных КП и до финального ответа пользователю. Нельзя заменять вызов Markdown-таблицей или советом скопировать данные в Excel. Создаёт оформленный XLSX; массивы values и sources должны строго соответствовать порядку suppliers, для отсутствующих данных передавай «Не указано».',
  inputSchema: {
    title: z.string().min(2).max(500).default('Сравнение коммерческих предложений'),
    suppliers: z.array(z.string().min(1).max(500)).min(2).max(30),
    source_files: z.array(z.string().max(500)).max(50).optional(),
    rows: z.array(z.object({ criterion: z.string().min(1).max(1000), values: z.array(z.string().max(20000)).max(30), sources: z.array(z.union([z.string().max(5000), z.array(z.string().max(5000)).max(5)])).max(30).optional(), note: z.string().max(10000).optional() })).min(1).max(500),
    conclusion: z.string().max(20000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
}, async ({ title, suppliers, source_files: sourceFiles, rows, conclusion }) => {
  const normalizedRows = rows.map((row) => ({
    ...row,
    sources: row.sources?.map((source) => Array.isArray(source) ? source.join('; ') : source),
  }));
  const buffer = await createComparisonWorkbook({ title, suppliers, rows: normalizedRows, sourceFiles, conclusion });
  const artifact = await saveArtifact(buffer, safeFilename(title, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return { content: [{ type: 'text', text: `Сравнительная таблица создана. Передайте пользователю эту ссылку без изменений: [Скачать XLSX](${artifact.downloadUrl})\nСсылка действует до ${artifact.expiresAt}.` }] };
});

server.registerTool('create_bilingual_docx', {
  title: 'Создать двуязычный перевод DOCX',
  description: 'ОБЯЗАТЕЛЬНЫЙ финальный инструмент режима перевода. Создаёт единый параллельный документ по правилам двуязычных договоров: английский оригинал слева, соответствующий русский перевод справа, один пункт или абзац на строку, одинаковая нумерация и порядок. Вызывай после перевода всех доступных частей и до финального ответа. Нельзя заменять документ переводом только в чате.',
  inputSchema: {
    title: z.string().min(2).max(500).default('Двуязычный перевод документа'),
    source_file: z.string().max(500).optional(),
    sections: z.array(z.object({ reference: z.string().max(500).optional(), source: z.string().min(1).max(100000), translation: z.string().min(1).max(100000) })).min(1).max(400),
    notes: z.string().max(20000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
}, async ({ title, source_file: sourceFile, sections, notes }) => {
  const totalSize = sections.reduce((sum, section) => sum + section.source.length + section.translation.length, 0);
  if (totalSize > 1500000) throw new Error('Документ слишком велик для одной операции. Разделите его на части.');
  const buffer = await createBilingualDocument({ title, sourceFile, sections, notes });
  const artifact = await saveArtifact(buffer, safeFilename(title, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  return { content: [{ type: 'text', text: `Двуязычный документ создан. Передайте пользователю эту ссылку без изменений: [Скачать DOCX](${artifact.downloadUrl})\nСсылка действует до ${artifact.expiresAt}.` }] };
});

server.registerTool('create_reputation_report_docx', {
  title: 'Создать отчёт о проверке поставщика',
  description: 'Формирует DOCX-отчёт после вызова check_supplier_reputation. Нельзя включать факты, не подтверждённые полученными результатами и ссылками.',
  inputSchema: {
    company_name: z.string().min(2).max(500),
    inn: z.string().regex(/^\d{10}$/),
    checked_at: z.string().max(100),
    overall_risk: z.enum(['Низкий', 'Средний', 'Высокий', 'Не определён']),
    summary: z.string().min(1).max(30000),
    checks: z.array(z.object({ source: z.string().min(1).max(500), status: z.string().min(1).max(500), facts: z.array(z.string().max(10000)).max(100), url: z.string().max(5000).optional() })).min(1).max(50),
    limitations: z.string().max(30000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
}, async ({ company_name: companyName, inn, checked_at: checkedAt, overall_risk: overallRisk, summary, checks, limitations }) => {
  const buffer = await createReputationDocument({ companyName, inn, checkedAt, overallRisk, summary, checks, limitations });
  const artifact = await saveArtifact(buffer, safeFilename(`Проверка_${companyName}_${inn}`, 'docx'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  return { content: [{ type: 'text', text: `Отчёт о проверке поставщика создан. Передайте пользователю эту ссылку без изменений: [Скачать DOCX](${artifact.downloadUrl})\nСсылка действует до ${artifact.expiresAt}.` }] };
});

async function main() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(`[corp-supplier-tools] ${error.stack || error.message}\n`);
  process.exit(1);
});
