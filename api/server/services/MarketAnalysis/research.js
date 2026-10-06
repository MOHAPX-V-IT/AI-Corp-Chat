const cheerio=require('cheerio');
const {id}=require('./core');
const HOSTS=new Set(['dsm.ru','www.dsm.ru','alpharm.ru','www.alpharm.ru','old.alpharm.ru','grls.rosminzdrav.ru','grls.minzdrav.gov.ru']);
const seeds=['https://dsm.ru/news-reports/','https://alpharm.ru/','https://old.alpharm.ru/'];
function official(value){const u=new URL(value);if(u.protocol!=='https:'||!HOSTS.has(u.hostname)||u.port||u.username||u.password)throw new Error('Допустимы только публичные HTTPS-страницы DSM Group, AlphaRM и ГРЛС');u.hash='';return u;}
const source=url=>new URL(url).hostname.endsWith('dsm.ru')?'DSM Group':new URL(url).hostname.endsWith('alpharm.ru')?'AlphaRM':'Другой';
async function fetchOfficial(value,fetcher=fetch){let url=official(value);for(let i=0;i<5;i++){const r=await fetcher(url.href,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'CorpMarketResearch/1.0','Accept':'text/html,application/pdf,*/*'}});if([301,302,303,307,308].includes(r.status)){await r.body?.cancel();url=official(new URL(r.headers.get('location'),url).href);continue;}if(!r.ok)throw new Error(`Источник недоступен: HTTP ${r.status}`);const max=20*1024*1024;if(Number(r.headers.get('content-length'))>max){await r.body?.cancel();throw new Error('Документ больше 20 МБ');}const chunks=[];let n=0;for await(const c of r.body){n+=c.length;if(n>max)throw new Error('Документ больше 20 МБ');chunks.push(c);}return {url:url.href,buffer:Buffer.concat(chunks),mime:r.headers.get('content-type')||''};}throw new Error('Слишком много перенаправлений источника');}
function htmlPage(buffer,url){const $=cheerio.load(buffer.toString('utf8'));$('script,style,noscript,nav,footer,form').remove();const title=$('title').text().trim();const links=[];$('a[href]').each((_,el)=>{try{const u=official(new URL($(el).attr('href'),url).href).href;if(!links.some(l=>l.url===u))links.push({url:u,title:$(el).text().replace(/\s+/g,' ').trim().slice(0,350)});}catch{}});$('br').replaceWith('\n');$('p,div,h1,h2,h3,li,tr').append('\n');return {title,text:$('body').text().replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim(),links};}
function research(a){return a.research||=( {searches:[],pages:[],candidates:[]} );}
async function search(a,query,fetcher=fetch){const r=research(a);const cached=r.searches.findLast(x=>x.query.trim().toLowerCase()===query.trim().toLowerCase()&&Date.now()-Date.parse(x.at)<86400000);if(cached)return {...cached,cached:true};const tokens=query.toLowerCase().match(/[\p{L}\d]{3,}/gu)||[];const results=await Promise.all(seeds.map(async url=>{try{const doc=await fetchOfficial(url,fetcher);const page=htmlPage(doc.buffer,doc.url);return {source:source(url),url,status:'read',links:page.links};}catch(e){return {source:source(url),url,status:'unavailable',error:e.message,links:[]};}}));
 const candidates=results.flatMap(p=>p.links.map(l=>({...l,source:p.source})));const ranked=candidates.map(l=>({...l,score:tokens.reduce((n,t)=>n+(l.title+' '+l.url).toLowerCase().includes(t),0)+( /отчет|отчёт|аналит|рынок|рейтинг|report|news/i.test(l.title+' '+l.url)?2:0)})).sort((a,b)=>b.score-a.score);
 // Keep results from both providers, even when one catalog matches more keywords.
 const selected=['DSM Group','AlphaRM'].flatMap(s=>ranked.filter(l=>l.source===s).slice(0,25));r.candidates=[...new Map([...r.candidates,...selected].map(l=>[l.url,l])).values()].slice(-200);
 const record={query,at:new Date().toISOString(),providers:results.map(({links,...p})=>p),results:selected};r.searches.push(record);return record;
}
async function open(a,user,url,addFile,fetcher=fetch,prepared){const r=research(a);url=official(url).href;if(r.pages.some(p=>p.url===url)||a.files.some(f=>f.url===url))return {url,status:'already_read'};const doc=prepared||await fetchOfficial(url,fetcher),s=source(doc.url);const ext=new URL(doc.url).pathname.match(/\.(xlsx|csv|docx|pptx|pdf|png|jpe?g)$/i)?.[0];
 if(ext||/application\/pdf/i.test(doc.mime)){const name=ext?decodeURIComponent(new URL(doc.url).pathname.split('/').pop()):'report.pdf';await addFile(a,user,name,doc.buffer,s,doc.url);r.pages.push({url:doc.url,source:s,title:name,status:'downloaded',at:new Date().toISOString()});return {url:doc.url,status:'downloaded',source:s};}
 if(!/html|text\//i.test(doc.mime))throw new Error('Формат страницы не поддерживается');
 const page=htmlPage(doc.buffer,doc.url);if(page.text.length<80)throw new Error('Страница не содержит доступного текста');
 if(a.files.length>=30)throw new Error('В анализе допускается не более 30 источников');
 const file={id:id(),name:page.title||doc.url,source:s,url:doc.url,kind:'web',createdAt:new Date().toISOString()};a.files.push(file);
 const content=page.text.slice(0,100000);for(let start=0;start<content.length;start+=10000)a.units.push({id:id(),fileId:file.id,location:`${doc.url} · фрагмент ${Math.floor(start/10000)+1}`,text:content.slice(start,start+10000),status:'pending'});
 const record={url:doc.url,title:page.title,source:s,status:'read',at:new Date().toISOString(),truncated:page.text.length>content.length};r.pages.push(record);r.candidates=[...new Map([...r.candidates,...page.links.map(l=>({...l,source:s}))].map(l=>[l.url,l])).values()].slice(-200);a.revision++;return {...record,links:page.links.slice(0,40)};
}
async function openBatch(a,user,urls,addFile,fetcher=fetch){
 const unique=[...new Set(urls.map(u=>official(u).href))];const results=[];
 for(let i=0;i<unique.length;i+=2){const chunk=unique.slice(i,i+2);const fetched=await Promise.allSettled(chunk.map(url=>a.research?.pages.some(p=>p.url===url)||a.files.some(f=>f.url===url)?null:fetchOfficial(url,fetcher)));
 for(let j=0;j<chunk.length;j++){const value=fetched[j];try{if(value.status==='rejected')throw value.reason;results.push(value.value?await open(a,user,chunk[j],addFile,fetcher,value.value):{url:chunk[j],status:'already_read'});}catch(e){results.push({url:chunk[j],status:'failed',error:e.message});}}}
 return results;
}
module.exports={official,fetchOfficial,htmlPage,research,search,open,openBatch};
