const {id}=require('./core');
const n=(v,d=1)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(v);
function fillComments(a){
  const sections=[];const add=(title,text,evidenceIds)=>sections.push({id:id(),title,text,evidenceIds,origin:'template',templateVersion:'market-ru-1',status:'draft'});
  const r=a.result;
  if(r){
    const latest=r.periods.at(-1),full=r.periods.filter(p=>p.length===4).at(-1);
    const p=full||latest,t=r.totals[p];
    add('Размер рынка',`За ${p} объем рынка составил ${n(t.units,0)} уп. и ${Math.abs(t.sales)>=1000000?`${n(t.sales/1000000,2)} млн руб.`:`${n(t.sales,2)} руб.`} Источник: ${r.source}. Охват: ${r.scope}.`,[`units:${p}`,`sales:${p}`]);
    const growth=r.metrics.filter(m=>m.id.startsWith('growth:')&&m.period===latest);
    if(growth.length)add('Динамика',growth.map(m=>m.value==null?`${m.label}: не рассчитан из-за нулевой базы.`:`${m.label}: ${m.value>0?'рост':m.value<0?'снижение':'без изменения'}${m.value===0?'':` на ${n(Math.abs(m.value)*100,2)}%`}.`).join(' '),growth.map(m=>m.id));
    const cagr=r.metrics.filter(m=>m.id.startsWith('cagr:'));
    if(cagr.length)add('Среднегодовой темп',cagr.map(m=>`${m.label}: ${m.value==null?'не рассчитан из-за нулевой базы':`${n(m.value*100,2)}%`}.`).join(' '),cagr.map(m=>m.id));
    const pt=r.totals[latest];add('Цена',`Средняя цена категории за ${latest}: ${pt.price==null?'недостаточно данных':`${n(pt.price,2)} руб./уп.`} Метод: ${r.priceMethod==='brandMean'?'среднее арифметическое цен исходных строк внутри торгового наименования; для категории — среднее цен торговых наименований':'объем продаж в рублях, деленный на количество упаковок'}.`,[`price:${latest}`]);
    const leaders=r.brands.filter(b=>b.brand!=='Другие'&&b.periods[latest]?.salesShare!=null).sort((a,b)=>b.periods[latest].salesShare-a.periods[latest].salesShare).slice(0,3);
    if(leaders.length)add('Доля рынка',`Лидеры среди выделенных брендов по продажам в рублях за ${latest}: ${leaders.map(b=>`${b.brand} — ${n(b.periods[latest].salesShare*100,2)}%`).join('; ')}.`,[`sales:${latest}`]);
    const brands=new Set(r.details.map(x=>x.brand.trim().toLowerCase()));const skus=r.details.map(x=>x.sku).filter(Boolean);
    add('Состав выборки',`В выбранных товарных данных: ${brands.size} брендов.${skus.length===r.details.length?` Уникальных кодов/наименований SKU: ${new Set(skus).size}.`:' Число SKU не определяется: идентификаторы заполнены не во всех строках.'}`,[]);
  }
  for(const f of a.facts.filter(f=>f.status==='approved'))add('Показатель из сводки',`${f.label}: ${n(f.value,4)} ${f.unit}. Период: ${f.period||'не указан'}. ${f.comparisonPeriod?`Сравнение: ${f.comparisonPeriod}. `:''}Охват: ${f.scope||'не указан'}. ${f.isForecast?'Прогноз. ':''}Источник: ${f.source}, ${f.location}.`,[f.id]);
  const notes=a.notes.filter(n=>n.status==='approved');if(notes.length)add('Подтвержденные сведения',notes.map(n=>n.text).join('\n'),notes.map(n=>n.id));
  if(a.expertNotes?.trim())add('Комментарий эксперта',a.expertNotes,[]);
  return sections;
}
module.exports={fillComments};
