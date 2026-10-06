import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@librechat/client';
import { CLOSE_SIDEBAR_ID, OPEN_SIDEBAR_ID } from '~/components/Chat/Menus/OpenSidebar';
import { Search, SquarePen } from 'lucide-react';
import ChatSearchDialog from './ChatSearchDialog';
import CorpBrand from './CorpBrand';
import { useLocalize, useNewConvo, useShowMarketplace } from '~/hooks';
import { clearMessagesCache } from '~/utils';
import store from '~/store';
import { useAuthContext } from '~/hooks/AuthContext';
import { canUseMarketAnalysis } from '~/utils/marketAccess';
import { canUseIpr } from '~/utils/iprAccess';

export default function NewChat({
  index = 0,
  toggleNav,
  subHeaders,
  isSmallScreen,
  headerButtons,
}: {
  index?: number;
  toggleNav: () => void;
  isSmallScreen?: boolean;
  subHeaders?: React.ReactNode;
  headerButtons?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  /** Note: this component needs an explicit index passed if using more than one */
  const { newConversation: newConvo } = useNewConvo(index);
  const navigate = useNavigate();
  const localize = useLocalize();
  const { pathname } = useLocation();
  const showAgents = useShowMarketplace();
  const { user } = useAuthContext();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  const { conversation } = store.useCreateConversationAtom(index);

  const handleToggleNav = useCallback(() => {
    toggleNav();
    // Delay focus until after the sidebar animation completes (200ms)
    setTimeout(() => {
      document.getElementById('corp-open-sidebar')?.focus();
    }, 250);
  }, [toggleNav]);

  const clickHandler: React.MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
        window.open('/c/new', '_blank');
        return;
      }
      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);
      newConvo();
      navigate('/c/new', { state: { focusChat: true } });
      if (isSmallScreen) {
        toggleNav();
      }
    },
    [queryClient, conversation, newConvo, navigate, toggleNav, isSmallScreen],
  );

  return (
    <>
      <div className="corp-sidebar-header">
        <button className="corp-brand" type="button" aria-label="AI Corp Chat — новый чат" onClick={clickHandler}><CorpBrand /></button>
        <button className="corp-icon-button" type="button" aria-label="Найти чат" title="Поиск чатов (Ctrl+K)" onClick={() => setSearchOpen(true)}><Search size={19} /></button>
        <button className="corp-icon-button" id={CLOSE_SIDEBAR_ID} type="button" aria-label={localize('com_nav_close_sidebar')} aria-expanded={true} onClick={handleToggleNav}><Sidebar aria-hidden="true" /></button>
      </div>
      <div className="corp-tools" aria-label="Инструменты">
        <button type="button" data-testid="nav-new-chat-button" className="corp-nav-item" onClick={clickHandler}><SquarePen size={18} aria-hidden="true" />{localize('com_ui_new_chat')}</button>
        {showAgents && <button type="button" data-testid="nav-agents-marketplace-button" className="corp-nav-item" aria-current={pathname.startsWith('/agents') ? 'page' : undefined} onClick={() => { navigate('/agents'); if (isSmallScreen) toggleNav(); }}>{localize('com_agents_marketplace')}</button>}
        {canUseMarketAnalysis(user) && <button type="button" className="corp-nav-item" aria-current={pathname.startsWith('/market') ? 'page' : undefined} onClick={() => { navigate('/market'); if (isSmallScreen) toggleNav(); }}>Рыночный анализ</button>}
        <button type="button" data-testid="nav-transcripts-button" className="corp-nav-item" aria-current={pathname.startsWith('/transcripts') ? 'page' : undefined} onClick={() => { navigate('/transcripts'); if (isSmallScreen) toggleNav(); }}>Транскрипты</button>
        {canUseIpr(user) && <button type="button" data-testid="nav-ipr-button" className="corp-nav-item" aria-current={pathname.startsWith('/ipr') ? 'page' : undefined} onClick={() => { navigate('/ipr'); if (isSmallScreen) toggleNav(); }}>ИПР сотрудников</button>}
        <button type="button" className="corp-nav-item" aria-current={pathname.startsWith('/translation') ? 'page' : undefined} onClick={() => { navigate('/translation'); if (isSmallScreen) toggleNav(); }}>Перевод документов</button>
        {headerButtons}
      </div>
      {pathname === '/search' && subHeaders}
      <ChatSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={() => { if (isSmallScreen) toggleNav(); }} />
    </>
  );
}
