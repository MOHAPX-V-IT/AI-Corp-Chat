const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const { logger } = require('@librechat/data-schemas');
const { parseText } = require('@librechat/api');

/** Максимальный размер загружаемого архива (200 МБ). */
const MAX_ARCHIVE_SIZE = 200 * 1024 * 1024;
/** Максимальный суммарный размер распакованных данных — защита от zip-бомб (500 МБ). */
const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024;
/** Максимальное число файлов внутри архива. */
const MAX_ENTRIES = 1000;
/** Максимальный суммарный объём извлечённого текста, который отдаём ИИ (10 МБ). */
const MAX_TOTAL_TEXT_BYTES = 10 * 1024 * 1024;
/** Максимальный объём текста из одного вложенного файла (2 МБ). */
const MAX_FILE_TEXT_BYTES = 2 * 1024 * 1024;

/** Расширения архивов (без точки). */
const archiveExtensions = new Set(['zip']);

/** MIME-типы, по которым определяем zip-архив. */
const archiveMimeTypes = new Set([
  'application/zip',
  'application/x-zip',
  'application/x-zip-compressed',
  'application/octet-stream', // некоторые браузеры отдают zip так — уточняем по расширению
]);

/**
 * Расширения «богатых» документов, для которых текст извлекается через parseText
 * (RAG API либо нативный парсер), а не простым чтением как UTF-8.
 */
const richDocExtensions = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'rtf',
  'odt',
  'ods',
  'odp',
  'epub',
]);

/** Расширения, которые заведомо бинарные — пропускаем. */
const binaryExtensions = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'heic', 'heif', 'ico', 'svg',
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus',
  'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp',
  'zip', 'rar', '7z', 'gz', 'tar', 'bz2', 'xz',
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'db', 'sqlite',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
]);

/** Служебные записи архива, которые нужно игнорировать. */
const junkPatterns = [/^__MACOSX\//, /\.DS_Store$/, /Thumbs\.db$/i, /^\._/];

const getExtension = (name) => (name.split('.').pop() || '').toLowerCase();

/**
 * Определяет, является ли загруженный файл zip-архивом (по MIME или расширению).
 * @param {{ mimetype?: string, originalname?: string }} file
 * @returns {boolean}
 */
function isArchiveFile(file) {
  if (!file) {
    return false;
  }
  const ext = getExtension(file.originalname || '');
  if (archiveExtensions.has(ext)) {
    return true;
  }
  return archiveMimeTypes.has((file.mimetype || '').toLowerCase()) && ext === 'zip';
}

/**
 * Эвристика: похоже ли содержимое буфера на текст (нет NUL-байтов в начале).
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function looksLikeText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      return false;
    }
  }
  return true;
}

/**
 * Извлекает текст из одного «богатого» документа (pdf/docx/xlsx/...) через parseText,
 * записывая его во временный файл.
 * @param {object} params
 * @param {import('~/types').ServerRequest} params.req
 * @param {Buffer} params.buffer
 * @param {string} params.entryName
 * @param {string} params.file_id
 * @returns {Promise<string|null>}
 */
async function parseRichDoc({ req, buffer, entryName, file_id }) {
  const ext = getExtension(entryName);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-archive-'));
  const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}.${ext}`);
  try {
    fs.writeFileSync(tmpPath, buffer);
    const mimetype = require('mime').getType(entryName) || 'application/octet-stream';
    const pseudoFile = {
      path: tmpPath,
      size: buffer.length,
      mimetype,
      originalname: path.basename(entryName),
    };
    const { text } = await parseText({ req, file: pseudoFile, file_id });
    return text || null;
  } catch (error) {
    logger.warn(`[extractArchive] Не удалось распарсить "${entryName}":`, error?.message || error);
    return null;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* noop */
    }
  }
}

/**
 * Распаковывает zip-архив и собирает текст всех читаемых вложенных файлов
 * в единый документ с заголовками путей.
 *
 * @param {object} params
 * @param {import('~/types').ServerRequest} params.req - Express request.
 * @param {string} params.filePath - Путь к загруженному архиву на диске.
 * @param {string} params.filename - Оригинальное имя архива.
 * @param {string} params.file_id - ID файла.
 * @returns {Promise<{ text: string, bytes: number, fileCount: number, skipped: string[], truncated: boolean }>}
 */
async function extractArchiveText({ req, filePath, filename, file_id }) {
  const archiveBuffer = fs.readFileSync(filePath);

  let zip;
  try {
    zip = await JSZip.loadAsync(archiveBuffer);
  } catch (error) {
    throw new Error(`Не удалось прочитать архив: ${error?.message || 'повреждён или не поддерживается'}`);
  }

  /** @type {Array<{ name: string, entry: import('jszip').JSZipObject }>} */
  const entries = [];
  zip.forEach((relativePath, entry) => {
    if (entry.dir) {
      return;
    }
    if (junkPatterns.some((re) => re.test(relativePath))) {
      return;
    }
    entries.push({ name: relativePath, entry });
  });

  if (entries.length > MAX_ENTRIES) {
    throw new Error(
      `Слишком много файлов в архиве (${entries.length}). Максимум — ${MAX_ENTRIES}.`,
    );
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  const parts = [];
  const skipped = [];
  let fileCount = 0;
  let totalUncompressed = 0;
  let totalTextBytes = 0;
  let truncated = false;

  for (const { name, entry } of entries) {
    if (totalTextBytes >= MAX_TOTAL_TEXT_BYTES) {
      truncated = true;
      skipped.push(name);
      continue;
    }

    const ext = getExtension(name);
    if (binaryExtensions.has(ext)) {
      skipped.push(name);
      continue;
    }

    let buffer;
    try {
      buffer = await entry.async('nodebuffer');
    } catch (error) {
      logger.warn(`[extractArchive] Ошибка распаковки "${name}":`, error?.message || error);
      skipped.push(name);
      continue;
    }

    totalUncompressed += buffer.length;
    if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
      throw new Error('Распакованный размер архива превышает допустимый лимит (защита от zip-бомб).');
    }

    let text = null;

    if (richDocExtensions.has(ext)) {
      text = await parseRichDoc({ req, buffer, entryName: name, file_id });
    } else if (looksLikeText(buffer)) {
      text = buffer.toString('utf8');
    } else {
      skipped.push(name);
      continue;
    }

    if (text == null || text.trim() === '') {
      skipped.push(name);
      continue;
    }

    let textBytes = Buffer.byteLength(text, 'utf8');
    if (textBytes > MAX_FILE_TEXT_BYTES) {
      text = text.slice(0, MAX_FILE_TEXT_BYTES);
      text += '\n\n[...файл обрезан по лимиту размера...]';
      textBytes = Buffer.byteLength(text, 'utf8');
      truncated = true;
    }

    totalTextBytes += textBytes;
    fileCount += 1;
    parts.push(`\n\n===== Файл: ${name} =====\n${text}`);
  }

  if (fileCount === 0) {
    throw new Error('В архиве не найдено читаемых текстовых файлов.');
  }

  const header =
    `Содержимое архива "${filename}" (файлов извлечено: ${fileCount}` +
    (skipped.length ? `, пропущено: ${skipped.length}` : '') +
    `):`;

  let text = header + parts.join('');
  if (truncated) {
    text += '\n\n[Часть содержимого архива обрезана из-за ограничений по размеру.]';
  }

  return {
    text,
    bytes: Buffer.byteLength(text, 'utf8'),
    fileCount,
    skipped,
    truncated,
  };
}

module.exports = {
  isArchiveFile,
  extractArchiveText,
  MAX_ARCHIVE_SIZE,
};
