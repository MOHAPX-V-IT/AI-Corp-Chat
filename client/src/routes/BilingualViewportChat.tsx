import React, {useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown, ChevronUp, GripHorizontal} from 'lucide-react';

export function BilingualChatContainer({preview, collapsed, onToggle, children}: {
 preview:boolean; collapsed:boolean; onToggle:()=>void; children:React.ReactNode;
}) {
 return preview?<BilingualViewportChat collapsed={collapsed} onToggle={onToggle}>{children}</BilingualViewportChat>:<>{children}</>;
}

/** A viewport dock: the document's scroll/overflow never clips the chat. */
export default function BilingualViewportChat({children, collapsed, onToggle}: {
 children: React.ReactNode; collapsed: boolean; onToggle: () => void;
}) {
 const panel = useRef<HTMLDivElement>(null);
 const position = useRef<{x:number;y:number}|null>(null);
 const drag = useRef<{x:number;y:number;originX:number;originY:number}|null>(null);
 const [point, setPoint] = useState<{x:number;y:number}|null>(null);
 const move = (x:number, y:number) => {
  const rect = panel.current?.getBoundingClientRect();
  if (!rect) return;
  const next = {x:Math.max(8, Math.min(x, window.innerWidth-rect.width-8)), y:Math.max(8, Math.min(y, window.innerHeight-rect.height-8))};
  position.current = next;
  setPoint(old => old?.x===next.x && old.y===next.y ? old : next);
 };
 useLayoutEffect(() => {
  const fit = () => {
   const rect=panel.current?.getBoundingClientRect();
   if (rect) move(position.current?.x ?? window.innerWidth-rect.width-16, position.current?.y ?? window.innerHeight-rect.height-16);
  };
  fit();
  const observer=new ResizeObserver(fit);
  if(panel.current) observer.observe(panel.current);
  window.addEventListener('resize',fit);
  return () => {observer.disconnect();window.removeEventListener('resize',fit);};
 }, []);
 return createPortal(<div className="corp-shell bilingual-page bilingual-overlay">
  <div ref={panel} className="bilingual-floating" style={{left:point?.x ?? 8,top:point?.y ?? 8,visibility:point?'visible':'hidden'}} aria-label="Плавающий чат с переводчиком">
   <div className="bilingual-dock-head">
    <button aria-label="Переместить чат: перетащите или используйте стрелки" title="Перетащите чат в любую область окна" className="bilingual-drag"
     onKeyDown={e=>{const delta:Record<string,number[]>={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};const p=position.current;if(delta[e.key]&&p){e.preventDefault();move(p.x+delta[e.key][0],p.y+delta[e.key][1]);}}}
     onPointerDown={e=>{if(e.button!==0||!position.current)return;drag.current={x:e.clientX,y:e.clientY,originX:position.current.x,originY:position.current.y};e.currentTarget.setPointerCapture(e.pointerId);}}
     onPointerMove={e=>{const d=drag.current;if(d)move(d.originX+e.clientX-d.x,d.originY+e.clientY-d.y);}}
     onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}><GripHorizontal size={18}/></button>
    <span>Чат с переводчиком</span><button aria-label={collapsed?'Развернуть чат':'Свернуть чат'} onClick={onToggle}>{collapsed?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button>
   </div>{children}
  </div>
 </div>,document.body);
}
