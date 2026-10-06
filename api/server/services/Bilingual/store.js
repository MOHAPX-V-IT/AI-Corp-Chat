const fs=require('fs/promises'),path=require('path'),crypto=require('crypto');
const root=process.env.BILINGUAL_DIR||path.resolve('uploads/bilingual');const busy=new Set();
function owner(user){if(typeof user!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(user)||['undefined','null'].includes(user))throw new Error('Некорректный владелец документа');return user;}
function dir(user,id){if(!/^[a-zA-Z0-9_-]{1,80}$/.test(owner(user))||!/^[a-f0-9-]{36}$/.test(id))throw new Error('Некорректный идентификатор');return path.join(root,String(user),id);}
function verifyOwner(user,d){if(d.ownerId&&d.ownerId!==owner(user)){const e=new Error('Документ не найден');e.status=404;throw e;}}
async function save(user,d){verifyOwner(user,d);d.ownerId=owner(user);d.updatedAt=new Date().toISOString();const p=dir(user,d.id);await fs.mkdir(p,{recursive:true});const temp=path.join(p,crypto.randomUUID()+'.tmp');await fs.writeFile(temp,JSON.stringify(d));try{for(let attempt=0;;attempt++){try{await fs.rename(temp,path.join(p,'document.json'));break;}catch(e){if(process.platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes(e.code)||attempt>=9)throw e;await new Promise(r=>setTimeout(r,30*(attempt+1)));}}}finally{await fs.unlink(temp).catch(()=>{});}return d;}
async function read(user,id){const d=JSON.parse(await fs.readFile(path.join(dir(user,id),'document.json'),'utf8'));verifyOwner(user,d);if(d.deletedAt){const e=new Error('Документ удален');e.status=404;throw e;}return d;}
async function list(user){let entries=[];try{entries=await fs.readdir(path.join(root,owner(user)));}catch(e){if(e.code!=='ENOENT')throw e;}const result=[];for(const id of entries){try{const d=await read(user,id);result.push({id,title:d.title,status:d.status,updatedAt:d.updatedAt,revision:d.revision});}catch{}}return result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
const key=(u,id)=>u+'/'+id;function isBusy(u,id){return busy.has(key(u,id));}
async function lock(u,id,fn){const k=key(u,id);if(busy.has(k)){const e=new Error('Документ уже обрабатывается');e.status=409;throw e;}busy.add(k);try{return await fn();}finally{busy.delete(k);}}
module.exports={dir,save,read,list,lock,isBusy};
