import { useCallback } from 'react';
import { EToolResources } from 'librechat-data-provider';
import { dataService } from 'librechat-data-provider';
import useFileHandling from './useFileHandling';

/**
 * Hook for attaching a transcript's plainText as a context file in chat.
 * Fetches the full transcript, creates a .txt File from plainText,
 * and feeds it through the standard file upload pipeline with tool_resource=context.
 */
export default function useTranscriptAttach() {
  const { handleFileChange } = useFileHandling();

  const attachTranscript = useCallback(
    async (transcriptId: string, title?: string) => {
      const transcript = await dataService.getTranscriptById(transcriptId);
      if (!transcript?.plainText) {
        throw new Error('Transcript has no text content');
      }

      // Format plainText with speaker labels if segments exist
      let textContent = '';
      if (transcript.segments && transcript.segments.length > 0) {
        textContent = transcript.segments
          .map((seg) => {
            const speakerName =
              transcript.speakerNames?.[seg.speaker] || `Спикер ${seg.speaker + 1}`;
            return `[${speakerName}] (${formatTime(seg.start)} - ${formatTime(seg.end)})\n${seg.text}`;
          })
          .join('\n\n');
      } else {
        textContent = transcript.plainText;
      }

      // Create a synthetic .txt file from the transcript text
      const fileName = `${(title || transcript.title || 'transcript').replace(/[^a-zA-Zа-яА-Я0-9_\- ]/g, '_')}.txt`;
      const blob = new Blob([textContent], { type: 'text/plain' });
      const file = new File([blob], fileName, { type: 'text/plain' });

      // Create a synthetic input change event with the file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const syntheticEvent = {
        stopPropagation: () => {},
        target: { files: dataTransfer.files, value: '' },
      } as unknown as React.ChangeEvent<HTMLInputElement>;

      handleFileChange(syntheticEvent, EToolResources.context);
    },
    [handleFileChange],
  );

  return { attachTranscript };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
