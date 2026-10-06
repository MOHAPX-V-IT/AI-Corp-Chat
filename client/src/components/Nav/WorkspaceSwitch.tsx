import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function WorkspaceSwitch() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lastChat = useRef('/c/new');
  const market = pathname.startsWith('/market');
  useEffect(() => { if (pathname.startsWith('/c/')) lastChat.current = pathname; }, [pathname]);
  if (pathname !== '/c/new') return null;

  const options = [{ label: 'Чат', selected: !market, path: lastChat.current }, { label: 'Рыночный анализ', selected: market, path: '/market' }];
  return <div className="corp-workspace-switch" role="tablist" aria-label="Рабочее пространство">
    {options.map((option, i) => <button key={option.label} type="button" role="tab" aria-selected={option.selected} tabIndex={option.selected ? 0 : -1}
      onClick={() => navigate(option.path)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : 1 - i; navigate(options[next].path); (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus(); } }}>{option.label}</button>)}
  </div>;
}
