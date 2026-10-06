const fs = require('fs');
const path = require('path');
const { mappedRows, aggregate, period } = require('./core');
const { fillComments, capture, memory } = require('./memory');
const SYSTEM = fs.readFileSync(path.join(__dirname, 'agent-prompt.txt'), 'utf8');
const sources = ['AlphaRM', 'DSM Group', 'Другой'];
const fields = ['brand','tradeName','sku','manufacturer','inn','form','dosage','pack','registration','period','units','sales','price','country','region','channel'];
const text = (v, max = 15000) => { if (typeof v !== 'string' || v.length > max) throw new Error('Некорректное текстовое поле агента'); return v; };
function settings(current, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Некорректные параметры');
  const keys = ['primarySource','priceMethod','rankBy','topN','scope','brands','periods','rankingPeriod'];
  if (Object.keys(patch).some(k => !keys.includes(k))) throw new Error('Неизвестный параметр');
  const p = {...current, ...patch};
  if (!sources.includes(p.primarySource) || !['weighted','brandMean'].includes(p.priceMethod) || !['sales','units'].includes(p.rankBy) || !Number.isInteger(p.topN) || p.topN < 1 || p.topN > 1000) throw new Error('Некорректные правила расчета');
  text(p.scope,500); if (!p.scope.trim()) throw new Error('Пустой охват');
  if (!Array.isArray(p.brands) || p.brands.length > 100 || p.brands.some(x => typeof x !== 'string' || x.length > 200)) throw new Error('Некорректные бренды');
  if (p.periods != null) { if (!Array.isArray(p.periods) || p.periods.length > 100) throw new Error('Некорректные периоды'); p.periods = p.periods.map(period); }
  if (p.rankingPeriod) p.rankingPeriod = period(p.rankingPeriod);
  return p;
}
function mapping(table, m) {
  if (!m || !m.columns || Array.isArray(m.columns) || Object.keys(m.columns).some(k => !fields.includes(k))) throw new Error('Некорректные поля таблицы');
  for (const k of ['wide','excludeRows']) if (m[k] != null && !Array.isArray(m[k])) throw new Error('Некорректные списки сопоставления');
  for (const k of ['unitsScale','salesScale']) if (![1,1000,1000000,1000000000].includes(m[k] ?? 1)) throw new Error('Некорректный масштаб');
  require('./table-tools').validate(table,m);mappedRows(table,m,'Другой','Проверка структуры');
  return m;
}
function apply(a, actions) {
  if (!Array.isArray(actions) || actions.length > 100) throw new Error('Некорректный план агента');
  const next = structuredClone(a), tasks = [], changes = [];
  capture(next);
  let invalid = false;
  for (const action of actions) {
    switch(action.type) {
      case 'search': text(action.query,500); tasks.push({type:'search',query:action.query});break;
      case 'open': {
        const url=require('./research').official(action.url).href;
        const linked=(a.research?.candidates||[]).some(l=>l.url===url)||(a.chat||[]).filter(m=>m.role==='user').some(m=>(m.text.match(/https:\/\/[^\s<>]+/g)||[]).includes(url));
        if(!linked)throw new Error('Ссылка не найдена в источниках или сообщениях: сначала search, затем open найденной ссылки');
        tasks.push({type:'open',url});break;
      }
      case 'remember': {
        const k=text(action.key,200);if(['__proto__','constructor','prototype'].includes(k))throw new Error('Некорректный ключ памяти');
        memory(next).decisions[k]={text:text(action.value,4000),at:new Date().toISOString()};changes.push('Договоренность сохранена в памяти анализа');break;
      }
      case 'settings':
        if (action.title != null) next.title = text(action.title,200);
        if (action.expertNotes != null) next.expertNotes = text(action.expertNotes);
        if (action.params) { next.params = settings(next.params,action.params); invalid = true; } changes.push('Параметры анализа обновлены'); break;
      case 'source': {
        const f = next.files.find(f => f.id === action.fileId);
        if (!f || !sources.includes(action.source)) throw new Error('Некорректный источник файла');
        f.source = action.source; invalid = true; changes.push(`Источник «${f.name}»: ${f.source}`); break;
      }
      case 'cell': {
        const t=next.tables.find(t=>t.id===action.tableId);const r=action.row,c=action.column,v=action.value;
        if(!t||!Number.isInteger(r)||r<=t.mapping.headerRow||r>t.rows.length||!Number.isInteger(c)||c<0||c>=Math.min(500,Math.max(...t.rows.slice(0,100).map(row=>row.length))))throw new Error('Ячейка вне товарных данных');
        if(!['string','number'].includes(typeof v)||(typeof v==='number'&&!Number.isFinite(v))||(typeof v==='string'&&v.length>500))throw new Error('Некорректное значение ячейки');
        const request=(a.chat||[]).filter(m=>m.role==='user').at(-1)?.text||'';
        const numbers=(request.match(/[-+]?\d[\d \u00a0\u202f]*(?:[.,]\d+)?/g)||[]).map(n=>Number(n.replace(/[ \u00a0\u202f]/g,'').replace(',','.')));
        if(typeof v==='number'?!numbers.includes(v):!v.trim()||!request.toLowerCase().includes(v.toLowerCase()))throw new Error('Новое значение ячейки должно быть явно указано пользователем');
        const m=memory(next);m.cellEdits||=[];m.cellEdits.push({tableId:t.id,row:r,column:c,before:t.rows[r-1][c],after:v,request,reason:text(action.reason||'Правка пользователя',1000),at:new Date().toISOString()});
        t.rows[r-1][c]=v;invalid=true;changes.push(`«${t.name}», строка ${r}, колонка ${c+1}: ${v}`);break;
      }
      case 'restoreMapping': {
        const t=next.tables.find(t=>t.id===action.tableId);const change=memory(next).changes.find(c=>c.section==='tables'&&c.revision===action.revision&&c.before.some(x=>x.id===action.tableId));
        if(!t||!change)throw new Error('Сохраненная версия сопоставления не найдена');const old=change.before.find(x=>x.id===t.id);t.mapping=structuredClone(old.mapping);t.enabled=old.enabled;invalid=true;changes.push('Восстановлено сопоставление до выбранной версии');break;
      }
      case 'table': {
        const t = next.tables.find(t => t.id === action.tableId);
        if (!t || (action.enabled != null && typeof action.enabled !== 'boolean')) throw new Error('Таблица не найдена или не задано участие');
        if (action.mapping) t.mapping = mapping(t,{...t.mapping,...action.mapping,columns:action.replaceColumns===true?action.mapping.columns:{...t.mapping.columns,...action.mapping.columns}});
        if (action.enabled) mapping(t,t.mapping);
        t.enabled = action.enabled ?? t.enabled; invalid = true; changes.push(`Таблица «${t.name}»: ${t.enabled?'включена':'исключена'}`); break;
      }
      case 'productInfo': {
        const product=text(action.product,200),field=action.field,value=text(action.value,6000),quote=text(action.quote,8000);
        if(!['indications','registration','registeredPacks'].includes(field))throw new Error('Неизвестное справочное поле');
        const u=next.units.find(u=>u.id===action.unitId),file=next.files.find(f=>f.id===u?.fileId);
        const normalize=v=>String(v||'').toLowerCase().replace(/\s+/g,' ').trim();
        if(!quote.trim()||!u?.text||!normalize(u.text).includes(normalize(quote))||!normalize(quote).includes(normalize(value))||!normalize(quote).includes(normalize(product)))throw new Error('Справочное значение и торговое наименование должны буквально присутствовать в цитате оригинала');
        if(!next.result?.details.some(d=>normalize(d.brand)===normalize(product)))throw new Error('Товар не найден в рассчитанном рынке');
        if(field!=='indications'&&!/^https:\/\/(grls\.rosminzdrav\.ru|grls\.minzdrav\.gov\.ru)\//i.test(file?.url||''))throw new Error('Регистрация и зарегистрированные фасовки требуют источника официального реестра');
        next.productInfo||=[];const old=next.productInfo.find(x=>normalize(x.product)===normalize(product)&&x.field===field);
        const entry={product,field,value,quote,unitId:u.id,fileId:file.id,url:file.url||file.name,at:new Date().toISOString()};
        if(old){entry.history=[...(old.history||[]),{...old,history:undefined}];Object.assign(old,entry);}else next.productInfo.push(entry);
        changes.push('Справочные сведения сохранены с цитатой оригинала');break;
      }
      case 'fact': {
        const f = [...next.facts,...next.notes].find(f => f.id === action.id);
        if (!f || !action.changes || typeof action.changes !== 'object') throw new Error('Показатель не найден');
        const update = {};
        for (const [k,v] of Object.entries(action.changes)) {
          if (k === 'value') { if (!Number.isFinite(v)) throw new Error('Некорректное число'); update[k] = v; }
          else if (k === 'status') { if (!['approved','rejected','pending'].includes(v)) throw new Error('Некорректный статус'); update[k] = v; }
          else if (['label','unit','period','comparisonPeriod','scope','text'].includes(k)) update[k] = text(v,3000);
          else throw new Error('Неизвестное поле показателя');
        }
        if (update.status === 'approved' || (f.status === 'approved' && Object.keys(update).some(k=>k!=='status'))) {
          const u = next.units.find(u => u.id === f.unitId || (!f.unitId && u.fileId===f.fileId && u.location===f.location));
          const value = update.value ?? f.value;
          const quote = String(f.quote || '').replace(/\s+/g,'');
          const quotedValues=(String(f.quote||'').match(/[-+]?\d[\d \u00a0\u202f]*(?:[.,]\d+)?/g)||[]).map(n=>Number(n.replace(/[ \u00a0\u202f]/g,'').replace(',','.')));
          const request=(a.chat||[]).filter(m=>m.role==='user').at(-1)?.text||'';
          const userConfirmed=action.confirmedByUser===true && /подтвержда|верно|правильно/i.test(request) && request.includes(f.id) && (f.value==null || request.includes(String(value)));
          if (!userConfirmed && (!u?.text || !quote || !u.text.replace(/\s+/g,'').includes(quote) || (f.value!=null && (!Number.isFinite(value) || !quotedValues.includes(value))))) throw new Error(`Уточни показатель в чате: ${f.label||f.text}, ${value??''}, ${f.location||''}. Для подтверждения пользователь должен написать «Подтверждаю ${f.id}${f.value==null?'':': '+value}».`);
        }
        if(update.status==='approved')update.verifiedBy=action.confirmedByUser===true?'user-in-chat':'agent-source';
        f.history ||= []; f.history.push({at:new Date().toISOString(),actor:'agent',before:{...f,history:undefined},reason:text(action.reason || 'Сопоставление с источником',1000)});
        Object.assign(f,update); next.comments=[]; changes.push('Показатель сводки обновлен'); break;
      }
      case 'comment': {
        let c=next.comments.find(c=>c.id===action.id);
        if(!action.id){c={id:require('./core').id(),title:text(action.title||'Экспертный комментарий',200),text:'',evidenceIds:[],custom:true};next.comments.push(c);}
        if (!c) throw new Error('Комментарий не найден');
        c.history ||= []; c.history.push({text:c.text,at:new Date().toISOString(),actor:'agent'});
        c.text=text(action.text); c.origin='expert'; capture(next); changes.push('Правка комментария сохранена'); break;
      }
      case 'extract': case 'calculate': case 'commentary': if (!tasks.includes(action.type)) tasks.push(action.type); break;
      default: throw new Error('Неизвестное действие агента');
    }
  }
  if (invalid) { next.result=null; next.comments=[]; next.mappingIssues=[]; }
  if (invalid && a.result && !tasks.includes('calculate')) tasks.push('calculate');
  if (actions.length) next.revision++;
  return {next,tasks,changes};
}
function calculate(a) {
  capture(a);
  const tables=a.tables.filter(t=>t.enabled && a.files.find(f=>f.id===t.fileId)?.source===a.params.primarySource);
  if (!tables.length) throw new Error('Нет выбранных товарных таблиц основного источника');
  const records=[],issues=[],audits=[];
  for (const t of tables) { const out=require('./table-tools').prepare(t,t.mapping,a.params.primarySource,a.params.scope);audits.push(out.audit);records.push(...out.records); issues.push(...out.issues.map(i=>`${t.name}, строка ${i.row}: ${i.message}`)); }
  a.mappingIssues=issues; a.result=null; a.comments=[];
  if (issues.length) throw new Error(`Проверьте сопоставление: ${issues.slice(0,8).join('; ')}`);
  const prepared=require('./report-standard').prepareReport(a,records);a.result=aggregate(prepared,a.params);a.result.normalization=audits;a.result.standardVersion='alice-market-1';a.comments=fillComments(a);a.acceptance=require('./report-standard').acceptance(a);
}
function context(a) {
  return {acceptance:a.result?require('./report-standard').acceptance(a):null,productInfo:a.productInfo||[],research:a.research||null,warnings:a.warnings||[],memory:{decisions:memory(a).decisions,cellEdits:memory(a).cellEdits||[],recentChanges:memory(a).changes.slice(-12).map(({before,after,...c})=>c),expertComments:memory(a).commentOverrides},userRequests:(a.chat||[]).filter(m=>m.role==='user'),title:a.title,params:a.params,expertNotes:a.expertNotes,files:a.files.map(({path,...f})=>f),
    tables:a.tables.map(t=>({id:t.id,fileId:t.fileId,name:t.name,enabled:t.enabled,mapping:t.mapping,rowCount:t.rows.length,rows:t.rows.slice(0,20),tail:t.rows.slice(-5)})),
    units:a.units.map(u=>({id:u.id,fileId:u.fileId,location:u.location,status:u.status,text:String(u.text||'').slice(0,12000),error:u.error})),
    facts:a.facts.slice(0,150),notes:a.notes.slice(0,50),comments:a.comments,metrics:a.result?.metrics,mappingIssues:a.mappingIssues?.slice(0,30),
    history:(a.chat||[]).slice(-16),limits:{factsTotal:a.facts.length,notesTotal:a.notes.length}};
}
function compactContext(a){
 const ctx=context(a);const latest=(a.chat||[]).filter(m=>m.role==='user').at(-1)?.text||'';
 const words=(latest.toLowerCase().match(/[\p{L}\d]{3,}/gu)||[]).filter(w=>!['измени','только','бренд','таблице','таблица','сделай','анализ','данные','рынок','пожалуйста'].includes(w));
 const score=v=>words.reduce((n,w)=>n+(String(v).toLowerCase().includes(w)?1:0),0);
 const relevant=(values,max)=>values.map((value,index)=>({value,index,rank:score(JSON.stringify(value))})).sort((x,y)=>y.rank-x.rank||y.index-x.index).slice(0,max).map(x=>x.value);
 ctx.history=(a.chat||[]).slice(-6).map(m=>({...m,text:m.text.slice(0,2500)}));
 const requests=(a.chat||[]).filter(m=>m.role==='user');ctx.userRequests=[...new Map([...relevant(requests.slice(0,-6),8),...requests.slice(-6)].map(m=>[m.id||m.text,m])).values()];
 ctx.memory.cellEdits=(ctx.memory.cellEdits||[]).slice(-8);ctx.memory.recentChanges=ctx.memory.recentChanges.slice(-4);ctx.comments=ctx.comments.map(({history,...c})=>c);
 ctx.facts=relevant(a.facts.filter(f=>f.status==='pending'),35).concat(relevant(a.facts.filter(f=>f.status!=='pending'),15)).map(({history,...f})=>f);ctx.notes=relevant(a.notes,15).map(({history,...n})=>n);
 const needed=new Set(ctx.facts.filter(f=>f.status==='pending').map(f=>f.unitId));
 ctx.units=a.units.filter(u=>needed.has(u.id)).slice(0,8).map(u=>({id:u.id,fileId:u.fileId,location:u.location,status:u.status,text:String(u.text||'').slice(0,6000)}));
 ctx.pendingDocuments=a.units.filter(u=>u.status!=='done').map(({id,fileId,location,status})=>({id,fileId,location,status}));
 ctx.tables=a.tables.map(t=>{const hits=[];if(words.length)for(let i=t.mapping?.headerRow||1;i<t.rows.length;i++){const brand=t.rows[i][t.mapping?.columns?.brand??0];if(score(brand)>0){hits.push({row:i+1,values:t.rows[i]});if(hits.length===8)break;}}return {id:t.id,fileId:t.fileId,name:t.name,enabled:t.enabled,mapping:t.mapping,rowCount:t.rows.length,rows:t.rows.slice(0,a.result?3:15),locatedRows:hits,tail:a.result?[]:t.rows.slice(-2)};});
 if(ctx.research)ctx.research={pages:ctx.research.pages,candidates:ctx.research.candidates,searches:ctx.research.searches.slice(-2).map(({results,...r})=>r)};
 ctx.normalization=a.result?.normalization;ctx.normalizedPreview=relevant(a.result?.details||[],8).map(({lineage,...r})=>({...r,sourceRows:lineage?.length}));ctx.warnings=ctx.warnings.slice(-15);ctx.limits={...ctx.limits,requestsTotal:requests.length,contextIsSelection:true};return ctx;
}
async function plan(a, user, generate) {
  const {profile,diagnose}=require('./document-profile');
  const ctx=compactContext(a);let extra=(a.documentInspections||[]).filter(x=>(x.tableId&&Array.isArray(x.rows)&&Number.isInteger(x.start))||x.unitId).map(x=>{if(x.tableId){const t=a.tables.find(t=>t.id===x.tableId);return t?{...x,rows:t.rows.slice(x.start-1,x.start-1+x.rows.length)}:null;}return x;}).filter(Boolean),validationError=null;
  // Inspect structure locally before asking the model; ordinary corrections reuse current mappings.
  if(!a.result){a.documentUnderstanding={version:1,at:new Date().toISOString(),tables:a.tables.map(profile),target:{tables:['Рынок по брендам','Детализация по дозировкам'],required:['brand','period','units','sales'],optional:['form','dosage','registration','manufacturer','sku'],comments:'Фиксированные шаблоны из проверенных расчетов'}};ctx.documentUnderstanding=a.documentUnderstanding;}
  ctx.mappingDiagnostics=diagnose(a,mappedRows);
  for(let i=0;i<3;i++) {
    const prompt=JSON.stringify({analysis:ctx,inspectedRows:extra,validationError});
    if(prompt.length>350000) throw new Error('Слишком много материалов для одного анализа. Разделите файлы по рынкам.');
    const result=await generate(prompt,user,null,SYSTEM);
    text(result.answer,12000);
    if(!result.inspect?.length) {
      try { const checked=apply(a,result.actions||[]);if(checked.tasks.includes('calculate')){const diagnostics=diagnose(checked.next,mappedRows);if(diagnostics.length){extra.push({mappingDiagnostics:diagnostics});throw new Error('Предварительная проверка обнаружила ошибки строк; исправь сопоставление по mappingDiagnostics, не проси пользователя номера колонок');}calculate(checked.next);}return result; }
      catch(e) { if(i===2)throw e; validationError=`План НЕ выполнен: ${e.message}. Исправь JSON-действия. Номера строк начинаются с 1, индексы колонок с 0. Верни полный исправленный план.`; continue; }
    }
    if (i===2) throw new Error('Изучение структуры не завершено. Прочитанные диапазоны сохранены; продолжите обработку.');
    if (!Array.isArray(result.inspect) || result.inspect.length>5) throw new Error('Некорректный запрос строк');
    extra=extra.concat(result.inspect.map(q=>{if(q.kind==='lineage'){const r=a.result?.details.find(r=>r.id===q.recordId);if(!r)throw new Error('Нормализованная строка не найдена');return {recordId:r.id,brand:r.brand,period:r.period,sourceRows:r.lineage?.length,examples:(r.lineage||[]).slice(0,40)};}if(q.unitId){const u=a.units.find(u=>u.id===q.unitId);if(!u)throw new Error('Фрагмент не найден');return {unitId:u.id,location:u.location,text:String(u.text||'').slice(0,12000)};}const t=a.tables.find(t=>t.id===q.tableId);if(q.kind==='versions')return {tableId:q.tableId,versions:memory(a).changes.filter(c=>c.section==='tables'&&c.before.some(x=>x.id===q.tableId)).slice(-12).map(c=>({revision:c.revision,at:c.at,request:c.request,before:c.before.find(x=>x.id===q.tableId)}))};if(q.kind){if(!t)throw new Error('Таблица не найдена');return require('./table-tools').inspect(t,q);}if(!t || !Number.isInteger(q.start)||q.start<1||q.start>t.rows.length||!Number.isInteger(q.count)||q.count<1||q.count>80)throw new Error('Некорректный диапазон строк');return {tableId:t.id,start:q.start,rows:t.rows.slice(q.start-1,q.start-1+q.count)};}));a.documentInspections=extra.slice(-8);
  }
}
module.exports={SYSTEM,settings,mapping,apply,calculate,context,compactContext,plan};
