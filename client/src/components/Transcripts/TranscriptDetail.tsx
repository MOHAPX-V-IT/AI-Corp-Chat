import React, { useState, useCallback } from 'react';
import {
  X,
  Copy,
  Check,
  Pencil,
  Trash2,
  Clock,
  Users,
  FileAudio,
  Loader2,
  Download,
  UserCheck,
} from 'lucide-react';
import { Button } from '@librechat/client';
import {
  useGetTranscriptByIdQuery,
  useUpdateTranscriptMutation,
  useDeleteTranscriptMutation,
} from '~/data-provider';
import { SpeakerNamingModal } from '~/components/Transcripts';
import type { Transcript, TranscriptSegment } from 'librechat-data-provider';

/**
 * Format transcript with speaker labels and timecodes as plain text
 */
function formatTranscriptText(transcript: Transcript): string {
  if (transcript.segments && transcript.segments.length > 0) {
    return transcript.segments
      .map((seg) => {
        const speakerName =
          transcript.speakerNames?.[seg.speaker] || `Спикер ${seg.speaker + 1}`;
        return `[${speakerName}] (${formatTimestamp(seg.start)} — ${formatTimestamp(seg.end)})\n${seg.text}`;
      })
      .join('\n\n');
  }
  return transcript.plainText || '';
}

/**
 * Export transcript as DOCX with speaker labels, timecodes, and colored formatting
 */
async function exportTranscriptDocx(transcript: Transcript) {
  const docx = await import('docx');

  const children: any[] = [];

  // Title
  children.push(
    new docx.Paragraph({
      children: [new docx.TextRun({ text: transcript.title || 'Транскрипт', bold: true, size: 32 })],
      heading: docx.HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  );

  // Meta
  const meta: string[] = [];
  if (transcript.duration) meta.push(`Длительность: ${formatDuration(transcript.duration)}`);
  if (transcript.speakersCount) meta.push(`Спикеров: ${transcript.speakersCount}`);
  if (transcript.language) meta.push(`Язык: ${transcript.language}`);
  if (meta.length > 0) {
    children.push(
      new docx.Paragraph({
        children: [new docx.TextRun({ text: meta.join(' | '), color: '888888', size: 20 })],
        spacing: { after: 300 },
      }),
    );
  }

  const speakerColors = ['2563EB', '16A34A', '9333EA', 'EA580C', 'DB2777', '0D9488', 'DC2626', 'CA8A04'];

  if (transcript.segments && transcript.segments.length > 0) {
    for (const seg of transcript.segments) {
      const color = speakerColors[seg.speaker % speakerColors.length];
      const speakerName = transcript.speakerNames?.[seg.speaker] || `Спикер ${seg.speaker + 1}`;

      // Speaker label + timecode
      children.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: speakerName,
              bold: true,
              color,
              size: 22,
            }),
            new docx.TextRun({
              text: `  (${formatTimestamp(seg.start)} — ${formatTimestamp(seg.end)})`,
              color: '999999',
              size: 20,
            }),
          ],
          spacing: { before: 200, after: 50 },
          border: {
            left: { style: docx.BorderStyle.SINGLE, size: 12, color },
          },
          indent: { left: 100 },
        }),
      );

      // Text
      children.push(
        new docx.Paragraph({
          children: [new docx.TextRun({ text: seg.text, size: 22 })],
          spacing: { after: 100 },
          border: {
            left: { style: docx.BorderStyle.SINGLE, size: 12, color },
          },
          indent: { left: 100 },
        }),
      );
    }
  } else {
    children.push(
      new docx.Paragraph({
        children: [new docx.TextRun({ text: transcript.plainText || '', size: 22 })],
      }),
    );
  }

  const doc = new docx.Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children,
      },
    ],
  });

  const blob = await docx.Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(transcript.title || 'transcript').replace(/[^a-zA-Zа-яА-Я0-9_\- ]/g, '_')}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}ч ${m}мин`;
  }
  return `${m}мин ${s}с`;
}

const SPEAKER_COLORS = [
  'border-l-blue-500',
  'border-l-green-500',
  'border-l-purple-500',
  'border-l-orange-500',
  'border-l-pink-500',
  'border-l-teal-500',
  'border-l-red-500',
  'border-l-yellow-500',
];

const SPEAKER_LABELS = [
  'text-blue-600 dark:text-blue-400',
  'text-green-600 dark:text-green-400',
  'text-purple-600 dark:text-purple-400',
  'text-orange-600 dark:text-orange-400',
  'text-pink-600 dark:text-pink-400',
  'text-teal-600 dark:text-teal-400',
  'text-red-600 dark:text-red-400',
  'text-yellow-600 dark:text-yellow-400',
];

interface TranscriptDetailProps {
  transcriptId: string;
  onClose: () => void;
}

const TranscriptDetail: React.FC<TranscriptDetailProps> = ({ transcriptId, onClose }) => {
  const { data: transcript, isLoading } = useGetTranscriptByIdQuery(transcriptId);
  const updateMutation = useUpdateTranscriptMutation();
  const deleteMutation = useDeleteTranscriptMutation();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSpeakerNamingOpen, setIsSpeakerNamingOpen] = useState(false);

  const handleCopy = useCallback(() => {
    if (!transcript) return;
    const text = formatTranscriptText(transcript);
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [transcript]);

  const handleDownloadDocx = useCallback(() => {
    if (!transcript) return;
    exportTranscriptDocx(transcript);
  }, [transcript]);

  const handleSaveTitle = useCallback(() => {
    if (!transcript || !editTitle.trim()) return;
    updateMutation.mutate({
      id: transcript.transcript_id,
      data: { title: editTitle.trim() },
    });
    setIsEditingTitle(false);
  }, [transcript, editTitle, updateMutation]);

  const handleDelete = useCallback(() => {
    if (!transcript) return;
    if (window.confirm('Удалить транскрипт? Это действие нельзя отменить.')) {
      deleteMutation.mutate(transcript.transcript_id, {
        onSuccess: () => onClose(),
      });
    }
  }, [transcript, deleteMutation, onClose]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-xl bg-surface-primary p-8">
          <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
        </div>
      </div>
    );
  }

  if (!transcript) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-surface-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-light p-4">
          <div className="flex-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  className="flex-1 rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5 text-sm text-text-primary"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveTitle}>
                  Сохранить
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FileAudio className="h-5 w-5 text-text-secondary" />
                <h2 className="text-lg font-semibold text-text-primary">
                  {transcript.title || 'Без названия'}
                </h2>
                <button
                  onClick={() => {
                    setEditTitle(transcript.title || '');
                    setIsEditingTitle(true);
                  }}
                  className="rounded p-1 text-text-tertiary hover:text-text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Meta info */}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(transcript.duration)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {transcript.speakersCount} спикер(ов)
              </span>
              {transcript.confidence != null && (
                <span>Точность: {(transcript.confidence * 100).toFixed(1)}%</span>
              )}
              {transcript.language && <span>Язык: {transcript.language}</span>}
            </div>
          </div>

          <div className="ml-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="flex items-center gap-1"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Скопировано' : 'Копировать'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadDocx}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" />
              DOCX
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSpeakerNamingOpen(true)}
              className="flex items-center gap-1"
            >
              <UserCheck className="h-4 w-4" />
              Назвать спикеров
            </Button>
            <button
              onClick={handleDelete}
              className="rounded-lg p-2 text-text-tertiary hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
              title="Удалить"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-text-secondary hover:bg-surface-hover"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {transcript.segments && transcript.segments.length > 0 ? (
            <div className="space-y-3">
              {transcript.segments.map((segment: TranscriptSegment, idx: number) => {
                const speakerName =
                  transcript.speakerNames?.[segment.speaker] || `Спикер ${segment.speaker + 1}`;
                return (
                  <div
                    key={idx}
                    className={`border-l-4 pl-3 ${SPEAKER_COLORS[segment.speaker % SPEAKER_COLORS.length]}`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span
                        className={`font-semibold ${SPEAKER_LABELS[segment.speaker % SPEAKER_LABELS.length]}`}
                      >
                        {speakerName}
                        </span>
                      <span className="text-text-tertiary">
                        {formatTimestamp(segment.start)} — {formatTimestamp(segment.end)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-text-primary">{segment.text}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
              {transcript.plainText || 'Транскрипт пуст'}
            </div>
          )}
        </div>

        {/* Footer */}
        {transcript.keyterms && transcript.keyterms.length > 0 && (
          <div className="border-t border-border-light p-3">
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-text-tertiary">Ключевые слова:</span>
              {transcript.keyterms.map((term, idx) => (
                <span
                  key={idx}
                  className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary"
                >
                  {term}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Speaker Naming Modal */}
      <SpeakerNamingModal
        transcript={transcript}
        isOpen={isSpeakerNamingOpen}
        onClose={() => setIsSpeakerNamingOpen(false)}
      />
    </div>
  );
};

export default TranscriptDetail;
