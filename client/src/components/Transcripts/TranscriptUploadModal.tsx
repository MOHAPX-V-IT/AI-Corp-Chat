import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileAudio, Loader2, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@librechat/client';
import { useCreateTranscriptMutation } from '~/data-provider';

interface TranscriptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACCEPTED_AUDIO = '.mp3,.wav,.ogg,.m4a,.flac,.webm,.mp4,.aac';

type FileStatus = 'pending' | 'uploading' | 'done' | 'error';

interface QueuedFile {
  id: string;
  file: File;
  status: FileStatus;
  error?: string;
}

const TranscriptUploadModal: React.FC<TranscriptUploadModalProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [language, setLanguage] = useState('ru');
  const [keyterms, setKeyterms] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useCreateTranscriptMutation();

  const isAudioFile = (f: File) => f.type.startsWith('audio/') || f.type.startsWith('video/');

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter(isAudioFile);
    if (validFiles.length === 0) return;

    setFiles((prev) => [
      ...prev,
      ...validFiles.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        status: 'pending' as FileStatus,
      })),
    ]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleSubmit = useCallback(async () => {
    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length === 0) return;

    setIsUploading(true);

    for (const qf of pending) {
      setFiles((prev) =>
        prev.map((f) => (f.id === qf.id ? { ...f, status: 'uploading' } : f)),
      );

      try {
        const formData = new FormData();
        formData.append('audio', qf.file);
        formData.append('language', language);
        if (keyterms.trim()) {
          formData.append('keyterms', keyterms.trim());
        }

        await createMutation.mutateAsync(formData);

        setFiles((prev) =>
          prev.map((f) => (f.id === qf.id ? { ...f, status: 'done' } : f)),
        );
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === qf.id
              ? { ...f, status: 'error', error: err?.message || 'Ошибка загрузки' }
              : f,
          ),
        );
      }
    }

    setIsUploading(false);
  }, [files, language, keyterms, createMutation]);

  const handleClose = useCallback(() => {
    if (isUploading) return;
    setFiles([]);
    setKeyterms('');
    onClose();
  }, [isUploading, onClose]);

  if (!isOpen) return null;

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const doneCount = files.filter((f) => f.status === 'done').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const totalCount = files.length;
  const allDone = totalCount > 0 && pendingCount === 0 && !isUploading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl bg-surface-primary p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            Загрузить аудио для транскрипции
          </h2>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="rounded-lg p-1 text-text-secondary hover:bg-surface-hover disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          className={`mb-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-border-light hover:border-border-heavy'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click();
            }
          }}
        >
          <Upload className="mb-2 h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-secondary">
            Перетащите аудиофайлы или нажмите для выбора
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            MP3, WAV, OGG, M4A, AAC, FLAC, WebM (до 2 ГБ каждый)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_AUDIO}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                addFiles(e.target.files);
              }
              e.target.value = '';
            }}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
            {files.map((qf) => (
              <div
                key={qf.id}
                className="flex items-center gap-3 rounded-lg border border-border-light bg-surface-secondary px-3 py-2"
              >
                {qf.status === 'pending' && (
                  <FileAudio className="h-4 w-4 shrink-0 text-text-tertiary" />
                )}
                {qf.status === 'uploading' && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
                )}
                {qf.status === 'done' && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                )}
                {qf.status === 'error' && (
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">{qf.file.name}</p>
                  <p className="text-xs text-text-tertiary">
                    {(qf.file.size / 1024 / 1024).toFixed(1)} МБ
                    {qf.error && <span className="ml-1 text-red-500">— {qf.error}</span>}
                  </p>
                </div>
                {qf.status === 'pending' && !isUploading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(qf.id);
                    }}
                    className="shrink-0 rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {isUploading && (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-text-secondary">
              <span>Загрузка...</span>
              <span>{doneCount} из {totalCount}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Language */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-text-secondary">Язык</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isUploading}
            className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary disabled:opacity-50"
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
            <option value="multi">Мультиязычный</option>
          </select>
        </div>

        {/* Keyterms */}
        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-text-secondary">
            Ключевые слова (необязательно)
          </label>
          <input
            type="text"
            value={keyterms}
            onChange={(e) => setKeyterms(e.target.value)}
            disabled={isUploading}
            placeholder="AI Corp Chat, рекрутинг, KPI"
            className="w-full rounded-lg border border-border-light bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-text-tertiary">
            Через запятую. Улучшает распознавание специальных терминов.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isUploading} className="px-4 py-2">
            {allDone ? 'Закрыть' : 'Отмена'}
          </Button>
          {!allDone && (
            <Button
              onClick={handleSubmit}
              disabled={pendingCount === 0 || isUploading}
              className="flex items-center gap-2 px-4 py-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка {doneCount + 1} из {totalCount}...
                </>
              ) : (
                pendingCount === 1
                  ? 'Транскрибировать'
                  : `Транскрибировать ${pendingCount} файлов`
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptUploadModal;
