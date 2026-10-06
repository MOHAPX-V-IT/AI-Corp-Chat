const fs=require('fs/promises');
const path=require('path');
const {id}=require('./core');
const root=process.env.MARKET_ANALYSIS_DIR||path.resolve(process.cwd(),'uploads','market-analysis');
const valid=s=>/^[a-f0-9-]{36}$/.test(s);
function dir(owner,analysisId){if(!/^[a-zA-Z0-9_-]{1,80}$/.test(String(owner))||!valid(analysisId))throw new Error('Некорректный идентификатор');return path.join(root,String(owner),analysisId);}
async function read(owner,analysisId,includeDeleted=false){const a=JSON.parse(await fs.readFile(path.join(dir(owner,analysisId),'analysis.json'),'utf8'));if(a.deletedAt&&!includeDeleted){const e=new Error('Анализ не найден');e.code='ENOENT';throw e;}return a;}
async function save(owner,a){a.updatedAt=new Date().toISOString();const d=dir(owner,a.id);await fs.mkdir(d,{recursive:true});const temp=path.join(d,`${id()}.tmp`);await fs.writeFile(temp,JSON.stringify(a));for(let attempt=0;;attempt++){try{await fs.rename(temp,path.join(d,'analysis.json'));break;}catch(e){if(!['EPERM','EBUSY'].includes(e.code)||attempt>=5)throw e;await new Promise(r=>setTimeout(r,25*(attempt+1)));}}return a;}
async function list(owner){const d=path.join(root,String(owner));let entries=[];try{entries=await fs.readdir(d);}catch(e){if(e.code!=='ENOENT')throw e;}const out=[];for(const n of entries.filter(valid)){try{const a=await read(owner,n);out.push({id:a.id,title:a.title,status:a.status,updatedAt:a.updatedAt,revision:a.revision});}catch{}}return out.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
const busy=new Set();
async function lock(owner,analysisId,fn){const key=`${owner}/${analysisId}`;if(busy.has(key)){const e=new Error('Анализ уже обрабатывается');e.status=409;throw e;}busy.add(key);try{return await fn();}finally{busy.delete(key);}}
function isBusy(owner,analysisId){return busy.has(`${owner}/${analysisId}`);}
async function recover(owner,a){if(a.status!=='processing'||isBusy(owner,a.id))return a;return lock(owner,a.id,async()=>{const fresh=await read(owner,a.id);if(fresh.status==='processing'){fresh.status='failed';fresh.error='Обработка прервана перезапуском. Исходные файлы сохранены; повторите операцию.';await save(owner,fresh);}return fresh;});}
module.exports={root,dir,read,save,list,lock,isBusy,recover};
