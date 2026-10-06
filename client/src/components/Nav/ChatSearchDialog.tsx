import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Search, X, MessageCircle } from 'lucide-react';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useNavigateToConvo } from '~/hooks';

export default function ChatSearchDialog({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: () => void }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const { navigateToConvo } = useNavigateToConvo();
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  const results = useConversationsInfiniteQuery({ search: debounced || undefined, isArchived: false }, { enabled: open, keepPreviousData: false });
  const conversations = results.data?.pages.flatMap(p => p.conversations) || [];
  return <Dialog open={open} onClose={onClose} className="corp-search-dialog">
    <div className="corp-search-backdrop" aria-hidden="true" />
    <div className="corp-search-position"><DialogPanel className="corp-search-panel">
      <DialogTitle className="sr-only">Поиск чатов</DialogTitle>
      <div className="corp-search-input"><Search size={20} aria-hidden="true" /><input data-autofocus autoFocus aria-label="Поиск чатов" placeholder="Поиск чатов" value={query} onChange={e => setQuery(e.target.value)} /><button type="button" aria-label="Закрыть поиск" onClick={onClose}><X size={20} /></button></div>
      <div className="corp-search-results"><h2>{query ? 'Результаты поиска' : 'Недавние чаты'}</h2>
        {(results.isLoading || query.trim() !== debounced) && <p role="status">Поиск…</p>}
        {results.isError && <p role="alert">Не удалось загрузить чаты. <button onClick={() => results.refetch()}>Повторить</button></p>}
        {!results.isLoading && !results.isError && conversations.length === 0 && <p>Чаты не найдены.</p>}
        {conversations.map(c => <button key={c.conversationId} type="button" className="corp-search-result" onClick={() => { navigateToConvo(c); onClose(); onNavigate(); }}><MessageCircle size={18} aria-hidden="true" /><span>{c.title || 'Новый чат'}</span></button>)}
        {results.hasNextPage && <button className="corp-search-more" disabled={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>Показать еще</button>}
      </div>
    </DialogPanel></div>
  </Dialog>;
}
