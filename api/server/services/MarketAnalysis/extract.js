const fs = require('fs/promises');
const path = require('path');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');
const { PDFDocument } = require('pdf-lib');
const { parse } = require('csv-parse/sync');
const { id, suggestMapping } = require('./core');
const parser = new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false});
const arr=v=>v==null?[]:Array.isArray(v)?v:[v];
function texts(node) {
  if(node==null) return '';
  if(typeof node==='string') return node;
  if(Array.isArray(node)) return node.map(texts).join(' ');
  if(typeof node!=='object') return '';
  if(node.t!=null) return texts(node.t);
  if(node['#text']!=null) return String(node['#text']);
  return Object.entries(node).filter(([k])=>!k.startsWith('@_')).map(([,v])=>texts(v)).join(' ');
}
function find(node,key,result=[]) {
  if(node && typeof node==='object') for(const [k,v] of Object.entries(node)) {if(k===key)result.push(...arr(v));else find(v,key,result);}return result;
}
function cellValue(v) {
  if(v==null) return null;
  if(v instanceof Date) return v.toISOString().slice(0,10);
  if(typeof v!=='object') return v;
  if('formula'in v||'sharedFormula'in v) return cellValue(v.result);
  if(v.richText) return v.richText.map(x=>x.text).join('');
  return v.text??null;
}
async function openZip(buffer) {
  const zip=await JSZip.loadAsync(buffer); const files=Object.values(zip.files);
  if(files.length>10000)throw new Error('Слишком много объектов в документе');
  let size=0; for(const f of files) {size+=f._data?.uncompressedSize||0;if(size>160*1024*1024)throw new Error('Распакованный документ превышает 160 МБ');}
  return zip;
}
async function extract(file, assetDir) {
  const buffer=await fs.readFile(file.path);const ext=path.extname(file.name).toLowerCase();
  const units=[],tables=[],warnings=[];
  const addTable=(name,rows,location)=>{if(rows.length>100000||rows.some(r=>r.length>500)||rows.reduce((n,r)=>n+r.length,0)>2000000)throw new Error('Таблица превышает лимит 100 000 строк, 500 колонок или 2 млн ячеек');const t={id:id(),fileId:file.id,name,location,rows};t.mapping=suggestMapping(rows);tables.push(t);};
  if(ext==='.xlsx') {
    await openZip(buffer);
    const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer);
    let total=0;
    for(const s of wb.worksheets) {
      if(s.state!=='visible') {warnings.push(`Скрытый лист «${s.name}» не включен автоматически`);continue;}
      if(s.rowCount>100000||s.columnCount>500)throw new Error('Лист превышает лимит 100 000 строк / 500 колонок');
      if(total+s.rowCount*s.columnCount>2000000)throw new Error('Книга превышает лимит 2 млн ячеек');
      const width=s.columnCount;
      const rows=[];s.eachRow({includeEmpty:true},r=>{rows.push(Array.from({length:width},(_,i)=>cellValue(r.getCell(i+1).value)));total+=width;});
      if(total>2000000)throw new Error('Книга превышает лимит 2 млн ячеек');
      addTable(s.name,rows,s.name);
      if(s.getRows(1,s.rowCount)?.some(r=>r.hidden))warnings.push(`Лист «${s.name}» содержит скрытые строки: задайте диапазон данных явно`);
    }
    const zip=await openZip(buffer);
    for(const n of Object.keys(zip.files).filter(n=>/^xl\/drawings\/drawing\d+\.xml$/.test(n))) {
      const text=texts(parser.parse(await zip.file(n).async('string')));if(text.trim()) units.push({id:id(),location:n,text});
    }
  } else if(ext==='.csv') {
    const text=buffer.toString('utf8').replace(/^\uFEFF/,'');
    const first=text.split(/\r?\n/)[0];const delimiter=first.split(';').length>first.split(',').length?';':',';
    addTable('CSV',parse(text,{delimiter,bom:true,relax_column_count:true,skip_empty_lines:false}),'CSV');
  } else if(ext==='.docx'||ext==='.pptx') {
    const zip=await openZip(buffer);
    const names=ext==='.docx'?['word/document.xml']:Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/(\d+)\.xml/)[1])-Number(b.match(/(\d+)\.xml/)[1]));
    for(const [index,n] of names.entries()) {
      if(!zip.file(n))throw new Error('Поврежденная структура Office');
      const tree=parser.parse(await zip.file(n).async('string'));const location=ext==='.docx'?'Документ':`Слайд ${index+1}`;
      const paragraphs=find(tree,'p').map(texts).filter(s=>s.trim());
      const text=paragraphs.join('\n');
      for(const [j,t] of find(tree,'tbl').entries()) {
        const rows=arr(t.tr).map(r=>arr(r.tc).map(c=>texts(c)));
        if(rows.length)addTable(`${location}, таблица ${j+1}`,rows,`${location}, таблица ${j+1}`);
      }
      // Bound text chunks without silently dropping the tail.
      for(let i=0;i<text.length;i+=16000)units.push({id:id(),location:`${location}, фрагмент ${1+Math.floor(i/16000)}`,text:text.slice(i,i+16000)});
      const relPath=n.replace(/([^/]+)$/,'_rels/$1.rels');
      const relXml=zip.file(relPath);if(relXml) {
        const rels=arr(parser.parse(await relXml.async('string')).Relationships?.Relationship);
        for(const rel of rels) {
          if(rel['@_TargetMode']==='External') {warnings.push(`${location}: внешняя ссылка не загружалась`);continue;}
          const target=path.posix.normalize(path.posix.join(path.posix.dirname(n),rel['@_Target']||''));
          if(!zip.file(target))continue;
          if(/\/image$/.test(rel['@_Type']||'')&&/\.(png|jpe?g)$/i.test(target)) {
            const data=await zip.file(target).async('nodebuffer');const asset=id()+path.extname(target);await fs.writeFile(path.join(assetDir,asset),data);
            units.push({id:id(),location:`${location}, изображение ${rel['@_Id']}`,text:'Изображение из документа',asset,mime:/png$/i.test(target)?'image/png':'image/jpeg'});
          }
          if(/\/chart$/.test(rel['@_Type']||'')) {
            const chart=parser.parse(await zip.file(target).async('string'));
            const series=find(chart,'ser').map(s=>({title:texts(s.tx),categories:find(s.cat,'pt').map(p=>p.v),values:find(s.val,'pt').map(p=>p.v)}));
            units.push({id:id(),location:`${location}, диаграмма ${rel['@_Id']}`,text:JSON.stringify({title:texts(chart.chartSpace?.chart?.title),series})});
            warnings.push(`${location}: данные диаграммы извлечены из кеша Office; проверьте актуальность`);
          }
        }
      }
    }
  } else if(ext==='.pdf') {
    const pdf=await PDFDocument.load(buffer,{updateMetadata:false});if(pdf.getPageCount()>200)throw new Error('PDF превышает 200 страниц');
    for(let i=0;i<pdf.getPageCount();i++) {
      const single=await PDFDocument.create();single.addPage((await single.copyPages(pdf,[i]))[0]);
      const asset=`${id()}.pdf`;await fs.writeFile(path.join(assetDir,asset),await single.save());
      units.push({id:id(),location:`Страница ${i+1}`,text:'Страница PDF: таблицы, текст, графики и сноски',asset,mime:'application/pdf'});
    }
  } else if(['.png','.jpg','.jpeg'].includes(ext)) {
    const asset=id()+ext;await fs.writeFile(path.join(assetDir,asset),buffer);
    units.push({id:id(),location:'Изображение',asset,mime:ext==='.png'?'image/png':'image/jpeg',text:'Изображение'});
  } else throw new Error('Формат не поддерживается. Сохраните файл как XLSX, CSV, DOCX, PPTX, PDF, PNG или JPG.');
  return {units,tables,warnings};
}
module.exports={extract,texts,cellValue};
