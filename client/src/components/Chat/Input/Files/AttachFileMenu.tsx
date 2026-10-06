import useTranscriptAttach from '~/hooks/Files/useTranscriptAttach';
import TranscriptPickerModal from './TranscriptPickerModal';
import { TranscriptUploadModal } from '~/components/Transcripts';
import React, { useRef, useState, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import * as Ariakit from '@ariakit/react';
import {
  FileSearch,
  FileAudio,
  Mic,
  FileImageIcon,
  TerminalSquareIcon,
} from 'lucide-react';
import {
  EToolResources,
  EModelEndpoint,
  defaultAgentCapabilities,
} from 'librechat-data-provider';
import {
  FileUpload,
  TooltipAnchor,
  DropdownPopup,
  AttachmentIcon,
  SharePointIcon,
} from '@librechat/client';
import type { EndpointFileConfig } from 'librechat-data-provider';
import {
  useAgentToolPermissions,
  useAgentCapabilities,
  useGetAgentsConfig,
  useFileHandling,
  useLocalize,
} from '~/hooks';
import useSharePointFileHandling from '~/hooks/Files/useSharePointFileHandling';
import { SharePointPickerDialog } from '~/components/SharePoint';
import { useGetStartupConfig } from '~/data-provider';
import { ephemeralAgentByConvoId } from '~/store';
import { MenuItemProps } from '~/common';
import { cn } from '~/utils';

type FileUploadType = 'image' | 'document' | 'image_document' | 'image_document_video_audio' | 'all';

interface AttachFileMenuProps {
  agentId?: string | null;
  endpoint?: string | null;
  disabled?: boolean | null;
  conversationId: string;
  endpointType?: EModelEndpoint;
  endpointFileConfig?: EndpointFileConfig;
  useResponsesApi?: boolean;
}

const AttachFileMenu = ({
  agentId,
  endpoint: _endpoint,
  disabled,
  endpointType: _endpointType,
  conversationId,
  endpointFileConfig,
  useResponsesApi: _useResponsesApi,
}: AttachFileMenuProps) => {
  const localize = useLocalize();
  const isUploadDisabled = disabled ?? false;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const [ephemeralAgent, setEphemeralAgent] = useRecoilState(
    ephemeralAgentByConvoId(conversationId),
  );
  const [toolResource, setToolResource] = useState<EToolResources | undefined>();
  const { handleFileChange } = useFileHandling();
  const { handleSharePointFiles, isProcessing, downloadProgress } = useSharePointFileHandling({
    toolResource,
  });

  const { agentsConfig } = useGetAgentsConfig();
  const { data: startupConfig } = useGetStartupConfig();
  const sharePointEnabled = startupConfig?.sharePointFilePickerEnabled;

  const [isSharePointDialogOpen, setIsSharePointDialogOpen] = useState(false);
  const [isTranscriptPickerOpen, setIsTranscriptPickerOpen] = useState(false);
  const [isTranscriptUploadOpen, setIsTranscriptUploadOpen] = useState(false);
  const { attachTranscript } = useTranscriptAttach();

  /** TODO: Ephemeral Agent Capabilities
   * Allow defining agent capabilities on a per-endpoint basis
   * Use definition for agents endpoint for ephemeral agents
   * */
  const capabilities = useAgentCapabilities(agentsConfig?.capabilities ?? defaultAgentCapabilities);

  const { fileSearchAllowedByAgent, codeAllowedByAgent } = useAgentToolPermissions(
    agentId,
    ephemeralAgent,
  );

  const handleUploadClick = (fileType?: FileUploadType) => {
    if (!inputRef.current) {
      return;
    }
    inputRef.current.value = '';
    if (fileType === 'image') {
      inputRef.current.accept = 'image/*,.heif,.heic';
    } else if (fileType === 'document') {
      inputRef.current.accept = '.pdf,application/pdf';
    } else if (fileType === 'image_document') {
      inputRef.current.accept = 'image/*,.heif,.heic,.pdf,application/pdf';
    } else if (fileType === 'image_document_video_audio') {
      inputRef.current.accept = 'image/*,.heif,.heic,.pdf,application/pdf,video/*,audio/*';
    } else if (fileType === 'all') {
      // Принимаем все форматы: документы, изображения, видео, аудио
      inputRef.current.accept = '';
    } else {
      inputRef.current.accept = '';
    }
    inputRef.current.click();
    inputRef.current.accept = '';
  };

  const dropdownItems = useMemo(() => {
    const createMenuItems = (onAction: (fileType?: FileUploadType) => void) => {
      const items: MenuItemProps[] = [];
      items.push({label:'Мои транскрипты',onClick:()=>setIsTranscriptPickerOpen(true),icon:<FileAudio className="icon-md"/>});
      items.push({label:'Транскрибировать аудио',onClick:()=>setIsTranscriptUploadOpen(true),icon:<Mic className="icon-md"/>});

      // Основная кнопка "Загрузить файлы" - принимает все форматы (до 10 шт)
      // Сервер сам определит: PDF/image/video/audio → напрямую, остальное → извлечь текст
      items.push({
        label: localize('com_ui_upload_files') + ' (до 10 шт)',
        onClick: () => {
          setToolResource(EToolResources.context);
          onAction('all');
        },
        icon: <FileImageIcon className="icon-md" />,
      });

      //       // Кнопка "Векторное хранилище" для больших файлов (до 50 шт)
      //       items.push({
      //         label: localize('com_ui_upload_vector_store') + ' (до 50 шт)',
      //         onClick: () => {
      //           setToolResource(EToolResources.file_search);
      //           setEphemeralAgent((prev) => ({
      //             ...prev,
      //             [EToolResources.file_search]: true,
      //           }));
      //           onAction();
      //         },
      //         icon: <FileSearch className="icon-md" />,
      //       });

      // Кнопка для интерпретатора кода (если включен)
      if (capabilities.codeEnabled && codeAllowedByAgent) {
        items.push({
          label: localize('com_ui_upload_code_files'),
          onClick: () => {
            setToolResource(EToolResources.execute_code);
            setEphemeralAgent((prev) => ({
              ...prev,
              [EToolResources.execute_code]: true,
            }));
            onAction();
          },
          icon: <TerminalSquareIcon className="icon-md" />,
        });
      }

      return items;
    };

    const localItems = createMenuItems(handleUploadClick);

    if (sharePointEnabled) {
      const sharePointItems = createMenuItems(() => {
        setIsSharePointDialogOpen(true);
        // Note: toolResource will be set by the specific item clicked
      });
      localItems.push({
        label: localize('com_files_upload_sharepoint'),
        onClick: () => {},
        icon: <SharePointIcon className="icon-md" />,
        subItems: sharePointItems,
      });
      return localItems;
    }

    return localItems;
  }, [
    localize,
    capabilities,
    setToolResource,
    setEphemeralAgent,
    sharePointEnabled,
    codeAllowedByAgent,
    fileSearchAllowedByAgent,
    setIsSharePointDialogOpen,
  ]);

  const menuTrigger = (
    <TooltipAnchor
      render={
        <Ariakit.MenuButton
          disabled={isUploadDisabled}
          id="attach-file-menu-button"
          aria-label="Attach File Options"
          className={cn(
            'flex size-9 items-center justify-center rounded-full p-1 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-opacity-50',
            isPopoverActive && 'bg-surface-hover',
          )}
        >
          <div className="flex w-full items-center justify-center gap-2">
            <AttachmentIcon />
          </div>
        </Ariakit.MenuButton>
      }
      id="attach-file-menu-button"
      description={localize('com_sidepanel_attach_files')}
      disabled={isUploadDisabled}
    />
  );
  const handleSharePointFilesSelected = async (sharePointFiles: any[]) => {
    try {
      await handleSharePointFiles(sharePointFiles);
      setIsSharePointDialogOpen(false);
    } catch (error) {
      console.error('SharePoint file processing error:', error);
    }
  };

  return (
    <>
      <FileUpload
        ref={inputRef}
        handleFileChange={(e) => {
          handleFileChange(e, toolResource);
        }}
      >
        <DropdownPopup
          menuId="attach-file-menu"
          className="overflow-visible"
          isOpen={isPopoverActive}
          setIsOpen={setIsPopoverActive}
          modal={true}
          unmountOnHide={true}
          trigger={menuTrigger}
          items={dropdownItems}
          iconClassName="mr-0"
        />
      </FileUpload>
      <TranscriptPickerModal isOpen={isTranscriptPickerOpen} onClose={()=>setIsTranscriptPickerOpen(false)} onSelect={transcript=>attachTranscript(transcript.transcript_id,transcript.title)}/>
      <TranscriptUploadModal isOpen={isTranscriptUploadOpen} onClose={()=>setIsTranscriptUploadOpen(false)}/>
      <SharePointPickerDialog
        isOpen={isSharePointDialogOpen}
        onOpenChange={setIsSharePointDialogOpen}
        onFilesSelected={handleSharePointFilesSelected}
        isDownloading={isProcessing}
        downloadProgress={downloadProgress}
        maxSelectionCount={endpointFileConfig?.fileLimit}
      />
    </>
  );
};

export default React.memo(AttachFileMenu);
