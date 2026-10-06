import React, { memo } from 'react';

import { Spinner } from '@librechat/client';

import type { TMessage } from 'librechat-data-provider';

import { useExportMessage } from '~/hooks/Messages';



interface ExportMessageProps {

  message: TMessage;

  isLast: boolean;

  title?: string;

}



/**

 * Remove thinking blocks from text

 */

const removeThinkingBlocks = (text: string): string => {

  let cleaned = text.replace(/:::thinking[\s\S]*?:::/g, '');

  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;

};



const extractMessageContent = (message: TMessage): string => {

  let content = '';



  if (typeof message.content === 'string') {

    content = message.content;

  } else if (Array.isArray(message.content)) {

    content = message.content

      .map((part) => {

        if (part == null) return '';

        if (typeof part === 'string') return part;

        if ('text' in part) return part.text || '';

        if ('think' in part) return ''; // Skip thinking

        return '';

      })

      .join('');

  } else {

    content = message.text || '';

  }



  return removeThinkingBlocks(content);

};



function ExportMessage({ message, title }: ExportMessageProps) {

  const content = extractMessageContent(message);

  const { exportToDocx, isExporting } = useExportMessage({

    content,

    messageId: message.messageId,

    title,

  });



  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {

    e.preventDefault();

    exportToDocx();

  };



  return (

    <button

      className="corp-docx-button"

      onClick={handleClick}

      type="button"

      title="Преобразовать этот ответ в документ Word для редактирования или совместной работы"

      aria-label="Преобразовать в DOCX"

      disabled={isExporting}

    >

      {isExporting ? (

        <Spinner className="h-[18px] w-[18px]" />

      ) : (

        <svg className="corp-word-icon" width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">

          <rect className="word-page" x="7" y="2" width="15" height="20" rx="2" />

          <path className="word-lines" d="M11 7h8M11 11h8M11 15h8M11 19h8" fill="none" strokeWidth="1.5" />

          <rect className="word-tile" x="1" y="6" width="13" height="13" rx="1.5" />

          <path className="word-letter" d="m3.5 9 1.4 7 2.1-5 2.1 5 1.4-7" fill="none" strokeWidth="1.5" strokeLinejoin="round" />

        </svg>

      )}

      <span>{isExporting ? "Создание DOCX…" : "Преобразовать в DOCX"}</span>

    </button>

  );

}



export default memo(ExportMessage);

