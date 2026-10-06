import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Paperclip, Maximize2, FileText, LoaderCircle } from 'lucide-react';
import MarketTablePreview from './MarketTablePreview';
type Data = Record<string, any>;
export default function MarketAgentChat({analysis,busy,workingLabel,onSend,onUpload,onSource,onDownload}: {
  analysis: Data|null; busy:boolean; workingLabel?:string; onSend:(message:string)=>Promise<void>;
  onUpload:(files:File[])=>Promise<void>;onSource:(file:Data)=>void;onDownload:()=>void;
}) {
  const [draft,setDraft]=useState('');const input=useRef<HTMLInputElement>(null);const thread=useRef<HTMLDivElement>(null);
  const [previewOpen,setPreviewOpen]=useState(false);
  const chat=analysis?.chat||[];
  const status=workingLabel||analysis?.progress||'Агент работает…';
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{setElapsed(0);if(!busy)return;const start=Date.now();const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[busy]);
  useEffect(()=>{setDraft('');},[analysis?.id]);
  const hasReport=!!analysis?.result||!!analysis?.facts?.some((f:Data)=>f.status==='approved');
  useEffect(()=>{if(hasReport)setPreviewOpen(true);},[hasReport]);
  useEffect(()=>{thread.current?.scrollTo({top:thread.current.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[chat.length,status,busy]);
  const send=async()=>{if(!draft.trim()||busy)return;const message=draft;try {await onSend(message);setDraft('');} catch { /* Parent displays error; preserve the draft for retry. */ }};
  const conversation=<>
    <div ref={thread} className="market-agent-thread" tabIndex={0} aria-label="Переписка с агентом">
      {!chat.length && <div className="market-agent-welcome"><h2>{analysis?.result?'Что изменить в отчете?':'Какой рынок изучим?'}</h2><p>Опишите рынок и прикрепите выгрузки, если они есть. Агент найдет публикации DSM Group и AlphaRM, изучит данные и подготовит отчет.</p><p className="market-muted">Агент сам выберет настройки по документам. Вопросы появятся только при нехватке критически важных данных.</p></div>}
      {chat.map((m:Data)=><article key={m.id} className={`market-agent-message ${m.role}`} aria-label={m.role==='user'?'Ваше сообщение':m.role==='tool'?'Выполненные действия':'Ответ агента'}><div>{String(m.text).split(/(https:\/\/[^\s<>]+)/g).map((part,i)=>/^https:\/\//.test(part)?<a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>:part)}</div></article>)}
      {busy&&<p className="market-agent-working" role="status"><LoaderCircle size={17} className="market-working-spinner" aria-hidden="true"/><span>{status}</span><span className="market-working-time" aria-hidden="true">{elapsed<60?`${elapsed} с`:`${Math.floor(elapsed/60)} мин ${elapsed%60} с`}</span></p>}
      
    </div>
    <div className="market-agent-bottom">
      {!!analysis?.files?.length&&<div className="market-agent-files" aria-label="Материалы анализа">{analysis.files.map((f:Data)=><button type="button" key={f.id} onClick={()=>onSource(f)} title={f.name}><FileText size={15}/><span>{f.name}</span></button>)}</div>}
      <form className="market-agent-composer" onSubmit={e=>{e.preventDefault();void send();}}>
        <textarea aria-label="Сообщение агенту анализа" placeholder="Опишите задачу или задайте вопрос" rows={2} value={draft} disabled={busy} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/>
        <div className="market-agent-composer-tools"><input ref={input} type="file" hidden multiple accept=".xlsx,.csv,.docx,.pptx,.pdf,.png,.jpg,.jpeg" aria-label="Прикрепить материалы" onChange={e=>{if(e.target.files?.length)void onUpload(Array.from(e.target.files));e.target.value='';}}/>
          <button type="button" disabled={busy} onClick={()=>input.current?.click()} aria-label="Прикрепить файлы" title="Excel, Word, PowerPoint, PDF и изображения"><Paperclip size={20}/></button>
          <button type="button" disabled={busy||!analysis} onClick={()=>onSend('Сделай сам: изучи загруженные материалы, выбери обоснованные параметры, рассчитай рынок и заполни шаблонные комментарии. Сообщи о допущениях и недостающих данных.').catch(()=>{})} className="market-agent-auto">Сделай сам</button>
          <span>Агент анализа</span><button className="market-agent-send" type="submit" disabled={busy||!draft.trim()} aria-label="Отправить сообщение"><ArrowUp size={20}/></button>
        </div>
      </form><p className="market-agent-hint">Уточнения и правки — в чате. Таблица и скачивание Excel — в предпросмотре.</p>
    </div>
  </>;
  return <section className={`market-agent ${chat.length?'has-messages':''}`} aria-label="Чат рыночного анализа"
    onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy&&e.dataTransfer.files.length)onUpload(Array.from(e.dataTransfer.files));}}>
    <header className="market-agent-header"><span>{analysis?.title||'Новый анализ'}</span><div>
      {analysis && <button type="button" onClick={()=>setPreviewOpen(true)} aria-label="Открыть предварительный просмотр таблицы" title="Развернуть таблицу"><Maximize2 size={19}/></button>}
    </div></header>
    {!previewOpen&&conversation}
    {previewOpen&&analysis&&<MarketTablePreview analysis={analysis} busy={busy} workingLabel={status} onClose={()=>setPreviewOpen(false)} onDownload={onDownload}>{conversation}</MarketTablePreview>}
  </section>;
}
