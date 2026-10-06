import React from 'react';
import { FileAudio, Clock, Users, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { TranscriptListItem } from 'librechat-data-provider';

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const statusConfig = {
  processing: {
    icon: Loader2,
    label: 'Обработка...',
    className: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20',
    iconClass: 'animate-spin',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Готово',
    className: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
    iconClass: '',
  },
  failed: {
    icon: XCircle,
    label: 'Ошибка',
    className: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
    iconClass: '',
  },
  uploading: {
    icon: Loader2,
    label: 'Загрузка...',
    className: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
    iconClass: 'animate-spin',
  },
};

interface TranscriptCardProps {
  transcript: TranscriptListItem;
  onClick: (id: string) => void;
}

const TranscriptCard: React.FC<TranscriptCardProps> = ({ transcript, onClick }) => {
  const status = statusConfig[transcript.status] || statusConfig.processing;
  const StatusIcon = status.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      className="group cursor-pointer rounded-xl border border-border-light bg-surface-primary p-4 transition-all hover:border-border-heavy hover:shadow-md"
      onClick={() => onClick(transcript.transcript_id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(transcript.transcript_id);
        }
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileAudio className="h-5 w-5 flex-shrink-0 text-text-secondary" />
          <h3 className="line-clamp-2 text-sm font-medium text-text-primary">
            {transcript.title || transcript.originalFilename || 'Без названия'}
          </h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
        >
          <StatusIcon className={`h-3 w-3 ${status.iconClass}`} />
          {status.label}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
        {transcript.duration > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(transcript.duration)}
          </span>
        )}
        {transcript.speakersCount > 0 && (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {transcript.speakersCount} {transcript.speakersCount === 1 ? 'спикер' : 'спикеров'}
          </span>
        )}
        <span>{formatDate(transcript.createdAt)}</span>
      </div>

      {/* Filename */}
      {transcript.originalFilename && transcript.title && (
        <p className="mt-2 truncate text-xs text-text-tertiary">{transcript.originalFilename}</p>
      )}
    </div>
  );
};

export default TranscriptCard;
