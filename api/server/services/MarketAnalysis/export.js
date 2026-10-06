const ExcelJS=require('exceljs');
const standard=require('./report-standard');
function note(sheet,title,text){
  let row=sheet.rowCount+2;sheet.getCell(row,2).value=title;sheet.getCell(row,2).font={bold:true,size:11};sheet.mergeCells(row,2,row,9);
  row++;sheet.getCell(row,2).value=String(text);sheet.mergeCells(row,2,row,9);sheet.getRow(row).height=Math.max(32,Math.ceil(String(text).length/110)*16);sheet.getRow(row).alignment={wrapText:true,vertical:'top'};
}
async function exportWorkbook(a){
  const acceptance=standard.acceptance(a);
  if(a.result&&acceptance.status==='blocked')throw new Error('Экспорт заблокирован: контрольные суммы не прошли проверку');
  const w=new ExcelJS.Workbook();w.creator='AI Corp Chat';w.created=new Date();w.calcProperties.fullCalcOnLoad=true;
  const market=a.result?standard.addMarketSheet(w,a):w.addWorksheet('Рынок');
  if(!a.result){market.getColumn(2).width=34;for(let i=3;i<=9;i++)market.getColumn(i).width=17;note(market,a.title||'Рыночный анализ','Товарная таблица не рассчитана. Ниже приведены только подтвержденные сведения источников.');}
  note(market,'Основания расчета',[
    `Источник: ${a.result?.source||'Сводки'}. Охват: ${a.result?.scope||'Указан для каждого показателя'}.`,
    a.result?`Периоды: ${a.result.periods.join(', ')}.`:'',
    a.result?(a.result.priceMethod==='brandMean'?'Цена: среднее исходных цен внутри торгового наименования; цена категории — среднее этих значений.':'Цена: продажи в рублях / количество упаковок.'):'',
  ].filter(Boolean).join('\n'));
  if(a.expertNotes)note(market,'Экспертные сведения и ограничения',a.expertNotes);
  const limitations=[...acceptance.checks.filter(c=>c.status!=='ok').map(c=>`${c.section}: ${c.detail}`),...(a.result?.warnings||[])];
  if(limitations.length)note(market,'Ограничения данных',[...new Set(limitations)].join('\n'));
  const sources=(a.files||[]).map(f=>`${f.source}: ${f.name}${f.url?' — '+f.url:''}`);
  if(sources.length)note(market,'Источники',sources.join('\n'));
  for(const f of (a.facts||[]).filter(f=>f.status==='approved'))note(market,f.label,`${f.value} ${f.unit||''}; ${f.period||''}; ${f.scope||''}${f.isForecast?'; прогноз':''}. Источник: ${f.source}; ${f.location||''}. ${f.quote||''}`);
  if(!a.result)for(const c of a.comments||[])note(market,c.title,c.text);
  const competitors=w.addWorksheet('Конкуренты');
  competitors.addRow(['Торговое наименование','МНН, форма и фасовка','Показания']);
  const products=standard.competitors(a);
  for(const c of products)competitors.addRow([c.name,c.description,c.indications]);
  for(const n of (a.notes||[]).filter(n=>n.status==='approved'))competitors.addRow(['Примечание',n.text,`${n.quote||''}; ${n.location||''}`]);
  competitors.columns.forEach((c,i)=>c.width=[32,55,75][i]);
  competitors.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};competitors.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17634C'}};competitors.getRow(1).height=32;
  const footnote=text=>{const r=competitors.addRow([text]);competitors.mergeCells(r.number,1,r.number,3);r.height=Math.max(32,Math.ceil(text.length/130)*16);};
  if(products.some(c=>c.referenceOnly))footnote('Показания и описания перенесены из эталона пользователя «операторский эталонный файл». Актуальность инструкций отдельно не подтверждена.');
  if(products.some(c=>c.registration.includes('не подтвержден')))footnote('Актуальный регистрационный статус и зарегистрированные фасовки отдельно не подтверждены. Наличие продаж не является подтверждением регистрации.');
  for(const info of a.productInfo||[])footnote(`${info.product}: ${info.field==='registration'?'Регистрация: ':info.field==='registeredPacks'?'Зарегистрированные фасовки: ':''}${info.value}. Источник: ${info.url}.`);
  competitors.views=[{state:'frozen',ySplit:1,xSplit:1}];
  competitors.eachRow((r,i)=>{r.alignment={wrapText:true,vertical:'top'};if(i>1&&!r.height)r.height=Math.min(409,Math.max(48,...r.values.slice(1).map((v,k)=>Math.ceil(String(v||'').length/([28,48,65,32,32,57][k]||50))*15)));});
  return w.xlsx.writeBuffer();
}
module.exports={exportWorkbook};
