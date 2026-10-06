const crypto = require('crypto');
const id = () => crypto.randomUUID();
const norm = (v) => String(v ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
function number(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null || /^\s*(?:|[-–—]|н\/д|нет данных)\s*$/i.test(String(v))) return null;
  const s = String(v).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  return /^[-+]?\d+(?:\.\d+)?$/.test(s) && Number.isFinite(Number(s)) ? Number(s) : null;
}
function period(value) {
  const s = String(value ?? '').trim();
  if (/^(19|20)\d{2}$/.test(s)) return s;
  const m = s.match(/^((?:19|20)\d{2})[- .](\d{1,2})(?:[-–](\d{1,2}))?$/);
  if (!m) throw new Error(`Неоднозначный период «${s}». Используйте ГГГГ, ГГГГ-ММ или ГГГГ-ММ-ММ.`);
  const a = Number(m[2]), b = Number(m[3] || m[2]);
  if (a < 1 || b > 12 || a > b) throw new Error(`Некорректный период ${s}`);
  return `${m[1]}-${String(a).padStart(2,'0')}${m[3] ? `-${String(b).padStart(2,'0')}` : ''}`;
}
function comparable(a,b) { return a.slice(4) === b.slice(4) && a !== b; }
function suggestMapping(rows) {
  const aliases = {
    brand: /^(бренд|торговое наименование|торговая марка|brand|sku)$/, tradeName:/^(торговое наименование|trade name)$/,sku: /^(sku id|идентификатор sku|код товара|код sku|номенклатура|наименование sku)$/,
    manufacturer:/^(производитель|производитель\/упаковщик|manufacturer)$/, inn:/^(мнн|inn)$/, form:/^(форма|форма выпуска)$/, dosage:/^(дозировка|dosage)$/,
    registration:/^(статус регистрации|регистрация|тип регистрации)$/, pack:/^(фасовка|размер упаковки|pack)$/, period:/^(период|год|месяц|period|year)$/,
    units:/^(упаковки|количество|количество, уп\.?|продажи, уп\.?|units)$/, sales:/^(рубли|продажи, руб\.?|сумма, rub|сумма|sales|выручка)$/,
    country:/^(страна|country)$/,region:/^(субъект федерации|регион|region)$/,channel:/^(канал|channel)$/,price:/^(цена|цена, rub|price)$/,
  };
  let best = {headerRow: 1, columns:{}, wide:[]}; let score = 0;
  rows.slice(0,25).forEach((row, i) => {
    const columns = {}; row.forEach((c,j) => {for (const [k,re] of Object.entries(aliases)) if (re.test(norm(c).replace(/^(лс|календарь|брики\d+)\./,'').replace(/^sell\s*out\s+/,'').trim())) {const label=norm(c);if(k==='brand'){if(columns.brand==null||/бренд|brand/.test(label))columns.brand=j;}else if(k!=='period'||columns[k]==null||/период/.test(label))columns[k]=j;}});
    const n = Object.keys(columns).length + (columns.brand != null ? 10 : 0);
    if(n > score) {score=n; best={headerRow:i+1,columns,wide:[]};}
  });
  // Period columns under multi-row metric headers (e.g. the supplied AlphaRM report).
  const h = best.headerRow - 1;
  for(let i=Math.max(0,h-3);i<=h;i++) {
    let measure = null;
    (rows[i]||[]).forEach((v,j) => {
      if(aliases.units.test(norm(v))) measure='units';
      else if(aliases.sales.test(norm(v))) measure='sales';
      else if(aliases.price.test(norm(v))) measure='price';
      else if(/доля/i.test(String(v))) measure=null;
      if(!measure) return;
      const p=(rows[i+1]||[])[j];
      try {if(p != null) best.wide.push({column:j,measure,period:period(p)});} catch { /* requires mapping */ }
    });
    if(best.wide.length) break;
  }
  if(best.columns.region!=null&&best.columns.period!=null&&rows.slice(best.headerRow,best.headerRow+4).some(r=>/[а-я]{3}\s+20\d{2}/i.test(String(r[best.columns.period]))))best.normalization={period:'year',sumRegions:true,compareYtd:true};
  return best;
}
function mappedRows(table, mapping, source, scope) {
  const issues=[], records=[];
  if(!Number.isInteger(mapping.headerRow)||mapping.headerRow<1||mapping.headerRow>table.rows.length) throw new Error('Укажите строку заголовков');
  if(!Number.isInteger(mapping.columns?.brand)) throw new Error('Укажите колонку бренда');
  const end = mapping.endRow || table.rows.length;
  if(!Number.isInteger(end)||end<=mapping.headerRow||end>table.rows.length) throw new Error('Проверьте последнюю строку данных');
  const width=Math.max(...table.rows.slice(0,100).map(r=>r.length),1);
  for(const c of Object.values(mapping.columns)) if(!Number.isInteger(c)||c<0||c>=Math.min(width,500)) throw new Error('Колонка вне таблицы');
  const used=new Set(),columns=new Set();
  for(const w of mapping.wide||[]) {
    if(!Number.isInteger(w.column)||w.column<0||w.column>=Math.min(width,500)||!['units','sales','price'].includes(w.measure)) throw new Error('Проверьте колонки показателей');
    const key=`${period(w.period)}:${w.measure}`;
    if(used.has(key)||columns.has(w.column)) throw new Error('Период и показатель либо колонка указаны дважды');
    used.add(key);columns.add(w.column);
  }
  if((mapping.excludeRows||[]).some(n=>!Number.isInteger(n)||n<=mapping.headerRow||n>end)) throw new Error('Исключаемая строка вне диапазона данных');
  const excluded = new Set(mapping.excludeRows || []);
  for(let i=mapping.headerRow;i<Math.min(end,table.rows.length);i++) {
    const row=table.rows[i]; if(!row.some(v=>v!==null&&v!=='')) continue;
    if(excluded.has(i+1)) continue;
    const get=k=>row[mapping.columns[k]];
    const brand=String(get('brand')??'').trim();
    if(!brand || /^(итого|всего|total|ир|абс прирост|упаковки №)/i.test(brand)) {issues.push({row:i+1,message:'Строка без бренда или итоговая строка. Исключите ее явно либо исправьте сопоставление.'});continue;}
    const base={id:id(),source,scope,brand,sku:String(get('sku')??''),manufacturer:String(get('manufacturer')??''),inn:String(get('inn')??''),form:String(get('form')??''),dosage:String(get('dosage')??''),pack:String(get('pack')??''),registration:String(get('registration')??''),tradeName:String(get('tradeName')??''),country:String(get('country')??''),region:String(get('region')??''),channel:String(get('channel')??''),fileId:table.fileId,location:`${table.name}!строка ${i+1}`};
    let groups=[];
    if(mapping.wide?.length) {
      const by={}; for(const w of mapping.wide) {
        const p=period(w.period); by[p] ||= {period:p};
        const raw=row[w.column]; const n=number(raw);
        if(raw!=null && raw!=='' && n===null && !/^[-–—]$/.test(String(raw))) issues.push({row:i+1,message:`Не удалось прочитать число в колонке ${w.column+1}`});
        by[p][w.measure]=n;
      } groups=Object.values(by);
    } else {
      try {groups=[{period:period(get('period')??mapping.period),units:number(get('units')),sales:number(get('sales')),price:number(get('price'))}];}
      catch(e) {issues.push({row:i+1,message:e.message});continue;}
      for(const k of ['units','sales','price']) if(mapping.columns[k]!=null && get(k)!=null && get(k)!=='' && number(get(k))===null && !/^[-–—]$/.test(String(get(k)))) issues.push({row:i+1,message:`Не удалось прочитать ${k}`});
    }
    for(const g of groups) {
      if(g.units==null && g.sales==null) continue;
      const u = g.units==null?null:g.units*(mapping.unitsScale||1);
      const s = g.sales==null?null:g.sales*(mapping.salesScale||1);
      if(u<0||s<0) {issues.push({row:i+1,message:'Отрицательное значение: проверьте возвраты и методику'});continue;}
      records.push({...base,id:id(),...g,units:u,sales:s,price:g.price??null});
    }
  }
  return {records,issues};
}
function aggregate(records, params) {
  if(!records.length) throw new Error('Нет подтвержденных товарных данных для расчета');
  const sources=[...new Set(records.map(r=>r.source))];
  if(!params.primarySource || !sources.includes(params.primarySource)) throw new Error('Выберите основной источник');
  const selected=records.filter(r=>r.source===params.primarySource && (!params.periods?.length||params.periods.includes(r.period)));
  if(!selected.length) throw new Error('Нет данных за выбранные периоды');
  if(new Set(selected.map(r=>r.scope)).size!==1) throw new Error('Нельзя складывать разные каналы или охваты. Выберите один охват.');
  const keys=new Set();
  for(const r of selected) {
    const k=JSON.stringify([norm(r.brand),norm(r.sku),norm(r.manufacturer),norm(r.inn),norm(r.form),norm(r.dosage),norm(r.pack),r.period]);
    if(keys.has(k)) throw new Error(`Повтор позиции ${r.brand}, ${r.period}. Уточните SKU или исключите повторную таблицу.`);
    keys.add(k);
    if(r.units==null||r.sales==null) throw new Error(`Не хватает рублей или упаковок: ${r.brand}, ${r.period}. Пропуск не заменяется нулем.`);
  }
  const periods=[...new Set(selected.map(r=>r.period))].sort();
  const ranking=params.rankingPeriod||periods.at(-1);
  if(!periods.includes(ranking)) throw new Error('Период ранжирования отсутствует');
  const byBrand=new Map();
  for(const r of selected) {
    const key=norm(r.brand); if(!byBrand.has(key)) byBrand.set(key,{brand:r.brand,periods:{},records:[]});
    const b=byBrand.get(key); b.records.push(r); b.periods[r.period] ||= {units:0,sales:0,prices:[],rawPriceSum:0,rawPriceCount:0,rawRowCount:0};
    const p=b.periods[r.period];p.units+=r.units;p.sales+=r.sales;if(r.price!=null)p.prices.push(r.price);p.rawPriceSum+=r.rawPriceSum??r.price??0;p.rawPriceCount+=r.rawPriceCount??(r.price==null?0:1);p.rawRowCount+=r.rawRowCount??1;
  }
  const metric=params.rankBy==='units'?'units':'sales';
  const brands=[...byBrand.values()].sort((a,b)=>(b.periods[ranking]?.[metric]||0)-(a.periods[ranking]?.[metric]||0));
  const wanted=new Set((params.brands||[]).map(norm));
  const top=params.topN==null?brands.length:Math.max(1,Math.min(1000,Number(params.topN)));
  const keep=new Set(brands.filter((b,i)=>i<top||wanted.has(norm(b.brand))).map(b=>norm(b.brand)));
  const totals={}; const warnings=[];
  for(const p of periods) {
    const rows=selected.filter(r=>r.period===p); const units=rows.reduce((a,r)=>a+r.units,0),sales=rows.reduce((a,r)=>a+r.sales,0);
    const brandPrices=brands.map(b=>b.periods[p]).filter(Boolean).map(b=>b.rawPriceCount&&b.rawPriceCount===b.rawRowCount?b.rawPriceSum/b.rawPriceCount:null);
    const price=params.priceMethod==='brandMean' ? (brandPrices.every(v=>v!==null)?brandPrices.reduce((a,n)=>a+n,0)/brandPrices.length:null) : units?sales/units:null;
    totals[p]={units,sales,price};
    if(price===null) warnings.push(`Цена ${p} не рассчитана: нет достаточных исходных значений.`);
    const missing=brands.filter(b=>!b.periods[p]);if(missing.length) warnings.push(`${p}: ${missing.length} брендов без строк. Их продажи не восстановлены.`);
  }
  const output=brands.filter(b=>keep.has(norm(b.brand))).map(b=>({brand:b.brand,periods:b.periods}));
  const other=brands.filter(b=>!keep.has(norm(b.brand)));
  if(other.length) {const b={brand:'Другие',periods:{}};for(const p of periods) {const rows=other.flatMap(x=>x.records).filter(r=>r.period===p); if(rows.length)b.periods[p]={units:rows.reduce((a,r)=>a+r.units,0),sales:rows.reduce((a,r)=>a+r.sales,0),prices:[],rawPriceSum:rows.reduce((s,r)=>s+(r.rawPriceSum??r.price??0),0),rawPriceCount:rows.reduce((s,r)=>s+(r.rawPriceCount??(r.price==null?0:1)),0),rawRowCount:rows.reduce((s,r)=>s+(r.rawRowCount??1),0)};}output.push(b);}
  for(const b of output) for(const [p,v] of Object.entries(b.periods)) {
    v.price=params.priceMethod==='brandMean' ? (v.rawPriceCount&&v.rawPriceCount===v.rawRowCount?v.rawPriceSum/v.rawPriceCount:null) : v.units?v.sales/v.units:null;
    v.unitShare=totals[p].units?v.units/totals[p].units:null;v.salesShare=totals[p].sales?v.sales/totals[p].sales:null;
    delete v.prices;
  }
  const metrics=[];
  for(const p of periods) for(const k of ['units','sales','price']) metrics.push({id:`${k}:${p}`,label:`${k==='units'?'Упаковки':k==='sales'?'Продажи, руб.':'Средняя цена, руб.'} ${p}`,value:totals[p][k],period:p});
  for(let i=1;i<periods.length;i++) {const p=periods[i];const prev=periods.slice(0,i).reverse().find(x=>comparable(x,p));if(prev)for(const k of ['units','sales']) {const base=totals[prev][k];metrics.push({id:`growth:${k}:${p}`,label:`Прирост ${k==='units'?'упаковок':'рублей'} ${p} к ${prev}`,value:base>0?totals[p][k]/base-1:null,percent:true,period:p});}}
  const years=periods.filter(p=>p.length===4);if(years.length>1)for(const k of ['units','sales']) {const a=years[0],b=years.at(-1);metrics.push({id:`cagr:${k}`,label:`CAGR ${k==='units'?'упаковок':'рублей'} ${a}–${b}`,value:totals[a][k]>0?Math.pow(totals[b][k]/totals[a][k],1/(Number(b)-Number(a)))-1:null,percent:true,period:`${a}–${b}`});}
  return {periods,brands:output,details:selected,totals,metrics,warnings,source:params.primarySource,scope:selected[0].scope,priceMethod:params.priceMethod||'weighted',createdAt:new Date().toISOString()};
}
module.exports={id,norm,number,period,comparable,suggestMapping,mappedRows,aggregate};
