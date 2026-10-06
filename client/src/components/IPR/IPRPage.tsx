import { useState, useEffect, useMemo, useRef } from 'react';
import { Navigate, useOutletContext } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { Button } from '@librechat/client';
import { TrendingUp } from 'lucide-react';
import type { ContextType } from '~/common';
import { useDocumentTitle, useLocalize } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import { canUseIpr } from '~/utils/iprAccess';
import { OpenSidebar } from '~/components/Chat/Menus';
import IPRTable from './IPRTable';
import NewcomerProfilesManager from './NewcomerProfilesManager';
import AnalyzeEmployeeModal from './AnalyzeEmployeeModal';
import store from '~/store';

type TabType = 'mp' | 'rm' | 'rgr' | 'newcomer';

export default function IPRPage() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();
  const [hideSidePanel, setHideSidePanel] = useRecoilState(store.hideSidePanel);
  const previousSidePanel = useRef(hideSidePanel);
  const [activeTab, setActiveTab] = useState<TabType>('mp');
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  useDocumentTitle('ИПР сотрудников | AI Corp Chat');

  useEffect(() => {
    setHideSidePanel(true);
    return () => setHideSidePanel(previousSidePanel.current);
  }, [setHideSidePanel]);

  const managerRole = useMemo(() => {
    if (user?.role === 'ADMIN' || user?.position === 'ROP' || user?.position === 'TRAINER') return 'ROP';
    if (user?.position === 'RGR') return 'RGR';
    if (user?.position === 'RM') return 'RM';
    return null;
  }, [user]);

  const tabs = useMemo(() => [
    { key: 'mp' as TabType, label: localize('com_ipr_tab_mp'), visible: true },
    { key: 'rm' as TabType, label: localize('com_ipr_tab_rm'), visible: managerRole === 'RGR' || managerRole === 'ROP' },
    { key: 'rgr' as TabType, label: localize('com_ipr_tab_rgr'), visible: managerRole === 'ROP' },
    { key: 'newcomer' as TabType, label: localize('com_ipr_tab_newcomer'), visible: managerRole === 'RGR' || managerRole === 'ROP' },
  ].filter(tab => tab.visible), [managerRole, localize]);

  useEffect(() => {
    if ((managerRole === 'RM' && activeTab !== 'mp') ||
        (managerRole === 'RGR' && activeTab === 'rgr')) setActiveTab('mp');
  }, [activeTab, managerRole]);

  useEffect(() => {
    setSelectedEntries(new Set());
  }, [activeTab]);

  if (!canUseIpr(user)) return <Navigate to="/c/new" replace />;

  return (
    <main className="corp-ipr-page flex h-full min-h-0 w-full min-w-0 flex-col bg-presentation text-text-primary">
      <header className="shrink-0 border-b border-border-light px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-center gap-2">
            {!navVisible && <OpenSidebar setNavVisible={setNavVisible} />}
            <h1 className="text-2xl font-medium tracking-tight">ИПР сотрудников</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAnalyzeModal(true)} className="min-h-10 gap-2 rounded-lg">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
            {localize('com_ipr_analyze_button')}{selectedEntries.size > 0 ? ` (${selectedEntries.size})` : ''}
          </Button>
        </div>
        <nav aria-label="Категория сотрудников" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} type="button" aria-pressed={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${activeTab === tab.key ? 'border-border-heavy text-text-primary' : 'border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="mb-5 text-sm text-text-secondary">История разборов и планов развития. Найдите сотрудника по имени или фамилии и раскройте запись, чтобы прочитать анализ.</p>
          <IPRTable tab={activeTab} managerRole={managerRole} selectedEntries={selectedEntries} onSelectionChange={setSelectedEntries} />
          {activeTab === 'newcomer' && <section className="mt-8"><h2 className="mb-4 text-xl font-medium">{localize('com_newcomer_profiles_title')}</h2><NewcomerProfilesManager /></section>}
        </div>
      </div>
      <AnalyzeEmployeeModal isOpen={showAnalyzeModal} onClose={() => setShowAnalyzeModal(false)} selectedEntryIds={Array.from(selectedEntries)} activeTab={activeTab} />
    </main>
  );
}
