const {number,suggestMapping}=require('./core');
const total=/^(итого|всего|total)(?:\s|$)/i;
function profile(table){
 const rows=table.rows;const suggestion=suggestMapping(rows);const candidates=[];
 for(let i=0;i<Math.min(rows.length,100);i++){const values=rows[i];const labels=values.filter(v=>typeof v==='string'&&/(бренд|торгов|наименован|мнн|производител|дозиров|упаков|продаж|руб|период|год|sku|units|sales)/i.test(v));if(labels.length)candidates.push({row:i+1,score:labels.length});}
 candidates.sort((a,b)=>b.score-a.score||a.row-b.row);
 const header=suggestion.columns.brand!=null?suggestion.headerRow:(candidates[0]?.row||suggestion.headerRow);const indices=new Set();for(const c of candidates.slice(0,5)){indices.add(c.row-1);if(c.row<rows.length)indices.add(c.row);}
 for(let i=Math.max(0,header-4);i<Math.min(rows.length,header+4);i++)indices.add(i);
 for(let j=0;j<16;j++)indices.add(Math.min(rows.length-1,Math.floor(header+(rows.length-header-1)*j/15)));
 const sample=[...indices].filter(i=>i>=0).sort((a,b)=>a-b);const width=Math.max(0,...sample.map(i=>rows[i].length));
 const columns=Array.from({length:Math.min(width,150)},(_,column)=>{const values=sample.filter(i=>i>=header).map(i=>rows[i][column]).filter(v=>v!=null&&v!=='');const headers=rows.slice(Math.max(0,header-4),header+1).map((r,i)=>({row:Math.max(0,header-4)+i+1,value:r[column]})).filter(x=>x.value!=null&&x.value!=='');return {column,headers,sampleValues:[...new Set(values.map(String))].slice(0,4).map(v=>v.slice(0,160)),numeric:values.filter(v=>number(v)!==null).length,sampled:values.length};});
 const suspicious=[];let suspiciousCount=0;for(let i=header;i<rows.length;i++){if(rows[i].slice(0,6).some(v=>total.test(String(v||'').trim()))){suspiciousCount++;if(suspicious.length<20)suspicious.push({row:i+1,values:rows[i].slice(0,12)});}}
 return {tableId:table.id,name:table.name,rowCount:rows.length,columnCount:width,headerCandidates:candidates.slice(0,5),suggestion,columns,columnsTruncated:width>150,samples:sample.slice(0,24).map(i=>({row:i+1,values:rows[i].slice(0,40)})),possibleTotals:suspicious,possibleTotalsCount:suspiciousCount,notes:['Профиль — выборка и гипотезы, не утвержденное сопоставление.','Итоги и расшифровку нельзя суммировать; периоды и масштабы берутся из заголовков.']};
}
function diagnose(a,mappedRows){const issues=[];for(const t of a.tables.filter(t=>t.enabled&&a.files.find(f=>f.id===t.fileId)?.source===a.params.primarySource)){try{const out=require('./table-tools').prepare(t,t.mapping,a.params.primarySource,a.params.scope);for(const item of out.issues.slice(0,8))issues.push({tableId:t.id,row:item.row,message:item.message,values:t.rows[item.row-1]});if(!out.records.length)issues.push({tableId:t.id,message:'Сопоставление не дает товарных записей: проверьте метрики, периоды и начало данных'});}catch(e){issues.push({tableId:t.id,message:e.message});}}return issues.slice(0,16);}
module.exports={profile,diagnose};
