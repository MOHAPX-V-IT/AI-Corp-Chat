import React, { useState, useCallback, useEffect } from 'react';
import { X, Users, Clock, Save } from 'lucide-react';
import { Button } from '@librechat/client';
import { useUpdateTranscriptMutation } from '~/data-provider';
import type { Transcript, TranscriptSegment } from 'librechat-data-provider';

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

interface SpeakerNamingModalProps {
  transcript: Transcript;
  isOpen: boolean;
  onClose: () => void;
}

const SpeakerNamingModal: React.FC<SpeakerNamingModalProps> = ({
  transcript,
  isOpen,
  onClose,
}) => {
  const updateMutation = useUpdateTranscriptMutation();
  const [speakerNames, setSpeakerNames] = useState<string[]>([]);

  // Initialize speaker names from transcript
  useEffect(() => {
    if (isOpen && transcript) {
      const names = transcript.speakerNames || [];
      // Fill missing names with empty strings up to speakersCount
      const fullNames = Array(transcript.speakersCount)
        .fill('')
        .map((_, i) => names[i] || '');
      setSpeakerNames(fullNames);
    }
  }, [isOpen, transcript]);

  // Get sample phrases for each speaker (first 2-3 phrases)
  const getSamplePhrases = useCallback(
    (speakerNum: number): TranscriptSegment[] => {
      if (!transcript.segments) return [];
      return transcript.segments
        .filter((seg) => seg.speaker === speakerNum)
        .slice(0, 3);
    },
    [transcript],
  );

  const handleSave = useCallback(() => {
    if (!transcript) return;
    updateMutation.mutate(
      {
        id: transcript.transcript_id,
        data: { speakerNames },
      },
      {
        onSuccess: () => onClose(),
      },
    );
  }, [transcript, speakerNames, updateMutation, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 flex h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-surface-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light p-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-text-secondary" />
            <h2 className="text-lg font-semibold text-text-primary">Назвать спикеров</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Meta info */}
        <div className="border-b border-border-light p-4">
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDuration(transcript.duration)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {transcript.speakersCount} спикер(ов)
            </span>
          </div>
        </div>

        {/* Scrollable speakers list */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {Array.from({ length: transcript.speakersCount }).map((_, idx) => {
              const samples = getSamplePhrases(idx);
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-border-light bg-surface-secondary p-3"
                >
                  {/* Speaker number + input */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-text-secondary">
                      Спикер {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={speakerNames[idx] || ''}
                      onChange={(e) => {
                        const newNames = [...speakerNames];
                        newNames[idx] = e.target.value;
                        setSpeakerNames(newNames);
                      }}
                      placeholder="Введите имя..."
                      className="flex-1 rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary"
                    />
                  </div>

                  {/* Sample phrases */}
                  {samples.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-text-tertiary">Примеры фраз:</p>
                      {samples.map((seg, segIdx) => (
                        <div
                          key={segIdx}
                          className="rounded border-l-2 border-blue-500 bg-surface-primary p-2 text-xs text-text-secondary"
                        >
                          {seg.text.length > 100
                            ? seg.text.substring(0, 100) + '...'
                            : seg.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border-light p-4">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isLoading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isLoading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SpeakerNamingModal;
