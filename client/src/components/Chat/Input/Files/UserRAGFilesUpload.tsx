import React, { useRef, useState } from 'react';
import { FileSearch } from 'lucide-react';
import { EToolResources } from 'librechat-data-provider';
import { TooltipAnchor, FileUpload } from '@librechat/client';
import { useFileHandling, useLocalize } from '~/hooks';
import { cn } from '~/utils';

interface UserRAGFilesUploadProps {
  agentId?: string | null;
  conversationId: string;
  disabled?: boolean;
}

const UserRAGFilesUpload = ({
  agentId,
  conversationId,
  disabled = false,
}: UserRAGFilesUploadProps) => {
  const localize = useLocalize();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { handleFileChange } = useFileHandling({
    additionalMetadata: {
      agent_id: agentId,
      conversation_id: conversationId,
      tool_resource: EToolResources.file_search,
    },
  });

  const handleUploadClick = () => {
    if (!inputRef.current) {
      return;
    }
    inputRef.current.value = '';
    inputRef.current.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsUploading(true);
    try {
      await handleFileChange(e, EToolResources.file_search);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <FileUpload ref={inputRef} handleFileChange={handleChange}>
      <TooltipAnchor
        aria-label={localize('com_agents_upload_user_files')}
        render={
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={handleUploadClick}
            className={cn(
              'btn relative border-0 p-1 text-black dark:text-white md:ml-0',
              'transition-colors duration-200',
              'disabled:cursor-not-allowed disabled:opacity-40',
              'hover:bg-surface-hover',
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <FileSearch className={cn('h-5 w-5', isUploading && 'animate-pulse')} />
              <span className="hidden text-sm font-medium sm:inline">
                {isUploading
                  ? localize('com_agents_uploading')
                  : localize('com_agents_upload_user_files')}
              </span>
            </div>
          </button>
        }
        id="user-rag-files-button"
        description={localize('com_agents_upload_user_files_description')}
        disabled={disabled || isUploading}
      />
    </FileUpload>
  );
};

export default React.memo(UserRAGFilesUpload);
