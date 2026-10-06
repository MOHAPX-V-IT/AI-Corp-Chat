import { useState, useCallback } from 'react';
import { useToastContext } from '@librechat/client';
import download from 'downloadjs';
import { useLocalize } from '~/hooks';

interface UseExportMessageOptions {
  content: string;
  messageId?: string;
  title?: string;
}

interface UseExportMessageReturn {
  exportToPdf: () => Promise<void>;
  exportToDocx: () => Promise<void>;
  isExporting: boolean;
  exportFormat: 'pdf' | 'docx' | null;
}

export function useExportMessage({
  content,
  messageId,
  title,
}: UseExportMessageOptions): UseExportMessageReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | null>(null);
  const { showToast } = useToastContext();
  const localize = useLocalize();

  const getFilename = useCallback(() => {
    if (title && title !== 'New Chat') {
      // Sanitize title for filename: remove invalid characters
      return title.replace(/[<>:"/\\|?*]/g, '').trim();
    }
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const id = messageId?.slice(0, 8) || 'message';
    return `ai-response-${id}-${timestamp}`;
  }, [messageId, title]);

  const exportToPdf = useCallback(async () => {
    if (isExporting || !content) return;

    setIsExporting(true);
    setExportFormat('pdf');

    try {
      const { markdownToPdf } = await import('~/utils/export/markdownToPdf');
      const filename = getFilename();
      const blob = await markdownToPdf(content, filename);
      download(blob, `${filename}.pdf`, 'application/pdf');

      showToast({
        message: localize('com_ui_export_success') || 'Document exported successfully',
        status: 'success',
      });
    } catch (error) {
      console.error('PDF export error:', error);
      showToast({
        message: localize('com_ui_export_error') || 'Failed to export document',
        status: 'error',
      });
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  }, [content, getFilename, isExporting, showToast, localize]);

  const exportToDocx = useCallback(async () => {
    if (isExporting || !content) return;

    setIsExporting(true);
    setExportFormat('docx');

    try {
      const { markdownToDocx } = await import('~/utils/export/markdownToDocx');
      const filename = getFilename();
      const blob = await markdownToDocx(content, filename);
      download(blob, `${filename}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      showToast({
        message: localize('com_ui_export_success') || 'Document exported successfully',
        status: 'success',
      });
    } catch (error) {
      console.error('DOCX export error:', error);
      showToast({
        message: localize('com_ui_export_error') || 'Failed to export document',
        status: 'error',
      });
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  }, [content, getFilename, isExporting, showToast, localize]);

  return {
    exportToPdf,
    exportToDocx,
    isExporting,
    exportFormat,
  };
}
