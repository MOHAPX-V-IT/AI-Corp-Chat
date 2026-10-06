import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { TooltipAnchor, Button, NewChatIcon, useMediaQuery } from '@librechat/client';
import type { ContextType } from '~/common';
import { useDocumentTitle } from '~/hooks';
import { useListTranscriptsQuery } from '~/data-provider';
import { SidePanelProvider } from '~/Providers';
import { SidePanelGroup } from '~/components/SidePanel';
import { OpenSidebar } from '~/components/Chat/Menus';
import TranscriptCard from './TranscriptCard';
import TranscriptDetail from './TranscriptDetail';
import TranscriptUploadModal from './TranscriptUploadModal';
import { FileAudio, Upload, Search, Loader2 } from 'lucide-react';
import store from '~/store';

const defaultLayout = [100, 0];
const defaultCollapsed = true;

const TranscriptsPage: React.FC = () => {
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();
  const [hideSidePanel, setHideSidePanel] = useRecoilState(store.hideSidePanel);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useDocumentTitle('Транскрипты | AI Corp Chat');

  // Hide side panel on this page, restore previous value on unmount
  const prevHideSidePanel = useRef(hideSidePanel);
  useEffect(() => {
    prevHideSidePanel.current = hideSidePanel;
    setHideSidePanel(true);
    return () => {
      setHideSidePanel(prevHideSidePanel.current);
    };
  }, []);

  const { data, isLoading, isFetching } = useListTranscriptsQuery(
    {
      page: currentPage,
      limit: 20,
      search: searchQuery || undefined,
    },
    {
      refetchInterval: 5000, // Poll every 5s to catch processing status changes
    },
  );

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setCurrentPage(1);
    },
    [],
  );

  const handleCardClick = useCallback((id: string) => {
    setSelectedTranscriptId(id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedTranscriptId(null);
  }, []);

  const fullCollapse = true;

  return (
    <div className="relative flex w-full grow overflow-hidden bg-presentation">
      <SidePanelProvider>
        <SidePanelGroup
          defaultLayout={defaultLayout}
          fullPanelCollapse={fullCollapse}
          defaultCollapsed={defaultCollapsed}
        >
          <main className="flex h-full flex-col overflow-hidden" role="main">
            <div className="scrollbar-gutter-stable relative flex h-full flex-col overflow-y-auto overflow-x-hidden">
              {/* Sticky header — always shown so mobile users can open the sidebar */}
              <div className="sticky top-0 z-20 flex items-center justify-between bg-surface-secondary p-2 font-semibold text-text-primary md:h-14">
                <div className="mx-1 flex items-center gap-2">
                  {!navVisible ? (
                    <OpenSidebar setNavVisible={setNavVisible} />
                  ) : (
                    <div className="h-10 w-10" />
                  )}
                </div>
              </div>

              {/* Hero section */}
              {!isSmallScreen && (
                <div className="container mx-auto max-w-4xl">
                  <div className="mb-8 mt-12 text-center">
                    <h1 className="mb-3 text-3xl font-bold tracking-tight text-text-primary md:text-5xl">
                      Транскрипты
                    </h1>
                    <p className="mx-auto mb-6 max-w-2xl text-lg text-text-secondary">
                      Загружайте аудио, просматривайте и используйте транскрипции в чатах с ИИ
                    </p>
                  </div>
                </div>
              )}

              {/* Search + Upload button */}
              <div className="sticky top-14 z-10 bg-presentation pb-4">
                <div className="container mx-auto max-w-4xl px-4">
                  <div className="mx-auto flex max-w-2xl gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearch}
                        placeholder="Поиск транскриптов..."
                        className="w-full rounded-xl border border-border-light bg-surface-primary py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-heavy focus:outline-none"
                      />
                    </div>
                    <Button
                      onClick={() => setShowUploadModal(true)}
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                    >
                      <Upload className="h-4 w-4" />
                      {!isSmallScreen && 'Загрузить аудио'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="container mx-auto max-w-4xl px-4 pb-8">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
                    <p className="mt-3 text-sm text-text-secondary">Загрузка транскриптов...</p>
                  </div>
                ) : data && data.transcripts.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {data.transcripts.map((transcript) => (
                        <TranscriptCard
                          key={transcript.transcript_id}
                          transcript={transcript}
                          onClick={handleCardClick}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {data.pages > 1 && (
                      <div className="mt-8 flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => p - 1)}
                        >
                          Назад
                        </Button>
                        <span className="text-sm text-text-secondary">
                          {currentPage} / {data.pages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= data.pages}
                          onClick={() => setCurrentPage((p) => p + 1)}
                        >
                          Далее
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20">
                    <FileAudio className="mb-4 h-16 w-16 text-text-tertiary" />
                    <h3 className="mb-2 text-lg font-medium text-text-primary">
                      {searchQuery ? 'Ничего не найдено' : 'У вас пока нет транскриптов'}
                    </h3>
                    <p className="mb-6 max-w-sm text-center text-sm text-text-secondary">
                      {searchQuery
                        ? 'Попробуйте изменить поисковый запрос'
                        : 'Загрузите аудиофайл для создания первого транскрипта'}
                    </p>
                    {!searchQuery && (
                      <Button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Загрузить аудио
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </main>
        </SidePanelGroup>
      </SidePanelProvider>

      {/* Modals */}
      <TranscriptUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />

      {selectedTranscriptId && (
        <TranscriptDetail
          transcriptId={selectedTranscriptId}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
};

export default TranscriptsPage;
