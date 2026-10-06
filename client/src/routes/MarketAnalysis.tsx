import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import './MarketAnalysis.css';
import MarketAgentChat from './MarketAgentChat';
import { canUseMarketAnalysis } from '~/utils/marketAccess';
type Data = Record<string, any>;
let marketView: {userId: string; analysis: Data | null} | null = null;
export default function MarketAnalysis() {
  const { user } = useAuthContext();
  return canUseMarketAnalysis(user) ? <MarketAnalysisWorkspace /> : <Navigate to="/c/new" replace />;
}
function MarketAnalysisWorkspace() {
  const {token,isAuthenticated,user}=useAuthContext();const [items,setItems]=useState<Data[]>([]);const [a,setA]=useState<Data|null>(()=>marketView && user?.id && marketView.userId===user.id ? marketView.analysis : null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const activeId=useRef<string|null>(null);
  const [workingLabel,setWorkingLabel]=useState('');
  const [deleted,setDeleted]=useState<Data|null>(null);
  const api=async(p:string,method='GET',body?:any)=>{const response=await fetch(`/api/market${p}`,{method,headers:{Authorization:`Bearer ${token}`,...(body && !(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});if(!response.ok){let msg=`Ошибка ${response.status}`;try{msg=(await response.json()).error||msg;}catch{}throw new Error(msg);}return response;};
  const operation=useRef(false);const pendingMessage=useRef<{id:string;analysisId:string;message:string}|null>(null);
  const run=async(fn:()=>Promise<void>)=>{if(operation.current)return;operation.current=true;setBusy(true);setError('');try{await fn();}catch(e){setError((e as Error).message);}finally{operation.current=false;setBusy(false);setWorkingLabel('');}};
  const refreshList=async()=>setItems(await(await api('')).json());
  useEffect(()=>{if(token)run(refreshList);},[token]);
  useEffect(()=>{activeId.current=a?.id||null;},[a?.id]);
  useEffect(()=>{if(user?.id)marketView={userId:user.id,analysis:a};},[user?.id,a]);
  useEffect(()=>{if(!a||a.status!=='processing')return;const current=a.id;const timer=setInterval(async()=>{try{const next=await(await api(`/${current}`)).json();if(activeId.current===current){setA(next);if(next.status!=='processing')await refreshList();}}catch(e){setError((e as Error).message);}},1000);return()=>clearInterval(timer);},[a?.id,a?.status,token]);
  const removeAnalysis=(item:Data)=>run(async()=>{await api(`/${item.id}`,'DELETE');setDeleted(item);setItems(old=>old.filter(x=>x.id!==item.id));if(a?.id===item.id){activeId.current=null;setA(null);marketView=null;}await refreshList();});
  const undoDelete=()=>run(async()=>{if(!deleted)return;await api(`/${deleted.id}/restore`,'POST');setDeleted(null);await refreshList();});
  const ensureAnalysis=async()=>{if(a)return a;const next=await(await api('','POST',{title:'Новый рыночный анализ'})).json();activeId.current=next.id;setA(next);await refreshList();return next;};
  const sendAgent=async(message:string)=>{if(operation.current||a?.status==='processing')return;operation.current=true;setBusy(true);setError('');try{let current=await ensureAnalysis();if(!pendingMessage.current||pendingMessage.current.analysisId!==current.id||pendingMessage.current.message!==message)pendingMessage.current={id:crypto.randomUUID(),analysisId:current.id,message};const next=await(await api(`/${current.id}/chat`,'POST',{message,requestId:pendingMessage.current.id})).json();pendingMessage.current=null;setA(next);await refreshList();}catch(e){setError((e as Error).message);throw e;}finally{operation.current=false;setBusy(false);setWorkingLabel('');}};
  const uploadAgent=async(files:File[])=>run(async()=>{if(!files.length)throw new Error('Выберите документ для загрузки');setWorkingLabel(`Загружаю и разбираю ${files.length===1?'документ':`документы (${files.length})`}…`);const current=await ensureAnalysis();const data=new FormData();Array.from(files).forEach(f=>data.append('files',f));data.append('source','Другой');const loaded=await(await api(`/${current.id}/files`,'POST',data)).json();setA(loaded);setWorkingLabel('Документы разобраны. Передаю данные агенту…');const next=await(await api(`/${current.id}/chat`,'POST',{requestId:crypto.randomUUID(),message:'Я добавил материалы. Самостоятельно изучи структуру и источники, выбери обоснованные настройки и подготовь рыночный отчет. Сохрани прежние договоренности. Укажи допущения и недостающие данные; спрашивай только о том, без чего нельзя получить корректный результат.'})).json();setA(next);await refreshList();});
  const downloadAgent=()=>run(async()=>{if(!a)return;const response=await api(`/${a.id}/export`);const u=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=u;link.download=`Рыночный_анализ_v${a.revision}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});
  const locked=busy||a?.status==='processing';
  if(!isAuthenticated)return <div className="market-page"><p>Войдите в AI Corp Chat, чтобы открыть анализы.</p><Link to="/login">Войти</Link></div>;
  return <div className="market-page"><header className="market-header"><Link to="/c/new" className="market-back"><ArrowLeft size={18}/> В чат</Link><h1>Рыночный анализ</h1><button type="button" disabled={locked} onClick={()=>run(async()=>{const next=await(await api('','POST',{title:'Новый рыночный анализ'})).json();setA(next);await refreshList();})}><Plus size={17}/> Новый анализ</button></header>
    {deleted&&<div className="market-delete-notice" role="status"><span>Анализ «{deleted.title}» удален из списка.</span><button type="button" disabled={busy} onClick={undoDelete}>Отменить удаление</button><button type="button" aria-label="Закрыть уведомление" onClick={()=>setDeleted(null)}><X size={16}/></button></div>}
    {error&&<div role="alert" className="market-error">{error}</div>}
    <div className="market-layout"><aside className="market-history"><h2>Мои анализы</h2>{items.length===0?<p className="market-muted">Здесь появятся сохраненные отчеты.</p>:items.map(item=><div key={item.id} className={`market-history-row ${a?.id===item.id?'selected':''}`}><button type="button" disabled={busy} className={a?.id===item.id?'selected':''} onClick={()=>run(async()=>{setA(await(await api(`/${item.id}`)).json());})}><strong>{item.title}</strong><span>{new Date(item.updatedAt).toLocaleDateString('ru-RU')} · версия {item.revision}</span></button><button type="button" className="market-delete-button" disabled={busy||item.status==='processing'} aria-label={`Удалить анализ «${item.title}»`} title={item.status==='processing'?'Дождитесь завершения обработки':'Удалить анализ'} onClick={()=>removeAnalysis(item)}><Trash2 size={16}/></button></div>)}</aside>
    <main className="market-main"><MarketAgentChat key={a?.id||'new'} analysis={a} busy={!!locked} workingLabel={workingLabel} onSend={sendAgent} onUpload={uploadAgent} onDownload={downloadAgent} onSource={file=>run(async()=>{if(!a)return;const response=await api(`/${a.id}/source/${file.id}`);const u=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=u;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);})}/></main></div></div>;
}
