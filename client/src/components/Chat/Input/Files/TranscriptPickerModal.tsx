import React, { useState, useCallback } from 'react';
import { X, FileAudio, Clock, Users, Search, Loader2, Check, Plus } from 'lucide-react';
import { Button } from '@librechat/client';
import { useListTranscriptsQuery } from '~/data-provider';
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

interface TranscriptPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (transcript: TranscriptListItem) => void;
}

const TranscriptPickerModal: React.FC<TranscriptPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useListTranscriptsQuery(
    {
      status: 'completed',
      search: searchQuery || undefined,
      limit: 50,
    },
    { enabled: isOpen },
  );

  const handleToggleSelect = useCallback((transcriptId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transcriptId)) {
        newSet.delete(transcriptId);
      } else {
        newSet.add(transcriptId);
      }
      return newSet;
    });
  }, []);

  const handleAttachSelected = useCallback(() => {
    if (!data || selectedIds.size === 0) return;
    const selectedTranscripts = data.transcripts.filter((t) =>
      selectedIds.has(t.transcript_id),
    );
    selectedTranscripts.forEach((transcript) => onSelect(transcript));
    setSelectedIds(new Set());
    onClose();
  }, [data, selectedIds, onSelect, onClose]);

  // Reset selection when modal closes
  const handleClose = useCallback(() => {
    setSelectedIds(new Set());
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex h-[70vh] w-full max-w-lg flex-col rounded-xl bg-surface-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light p-4">
          <h2 className="text-lg font-semibold text-text-primary">Мои транскрипты</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-text-secondary hover:bg-surface-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border-light p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск транскриптов..."
              className="w-full rounded-lg border border-border-light bg-surface-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
              <p className="mt-2 text-sm text-text-secondary">Загрузка...</p>
            </div>
          ) : data && data.transcripts.length > 0 ? (
            <div className="space-y-1">
              {data.transcripts.map((transcript) => {
                const isSelected = selectedIds.has(transcript.transcript_id);
                return (
                  <div
                    key={transcript.transcript_id}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover"
                    onClick={() => handleToggleSelect(transcript.transcript_id)}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Checkbox */}
                    <div
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        isSelected
                          ? 'border-green-600 bg-green-600'
                          : 'border-border-medium bg-surface-primary'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <FileAudio className="h-5 w-5 flex-shrink-0 text-text-secondary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {transcript.title || transcript.originalFilename || 'Без названия'}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-text-tertiary">
                        {transcript.duration > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(transcript.duration)}
                          </span>
                        )}
                        {transcript.speakersCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {transcript.speakersCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <FileAudio className="mb-2 h-10 w-10 text-text-tertiary" />
              <p className="text-sm text-text-secondary">
                {searchQuery ? 'Ничего не найдено' : 'Нет готовых транскриптов'}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {searchQuery
                  ? 'Попробуйте другой запрос'
                  : 'Сначала загрузите и транскрибируйте аудио'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between border-t border-border-light p-3">
            <p className="text-sm text-text-secondary">Выбрано: {selectedIds.size}</p>
            <Button onClick={handleAttachSelected} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Прикрепить {selectedIds.size > 1 ? `(${selectedIds.size})` : ''}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptPickerModal;
