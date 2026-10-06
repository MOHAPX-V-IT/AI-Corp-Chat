const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
if(!isMainThread){require('./extract').extract(workerData.file,workerData.assetDir).then(result=>parentPort.postMessage({result})).catch(e=>parentPort.postMessage({error:e.message}));}
let active=0;
function extract(file,assetDir,options={}){
 if(active>=2){const e=new Error('Два документа уже обрабатываются. Повторите загрузку немного позже.');e.status=429;return Promise.reject(e);}
 active++;
 return new Promise((resolve,reject)=>{
  let worker,done=false,timer;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);const stopped=worker?worker.terminate():Promise.resolve();stopped.finally(()=>{active--;error?reject(error):resolve(result);});};
  try{worker=new Worker(options.workerPath||__filename,{workerData:{file,assetDir},resourceLimits:{maxOldGenerationSizeMb:1024}});worker.once('message',m=>finish(m.error?new Error(m.error):null,m.result));worker.once('error',e=>finish(new Error(`Не удалось разобрать документ: ${e.message}`)));worker.once('exit',code=>{if(!done)finish(new Error(`Обработка документа завершилась без результата (${code}). Разделите книгу на меньшие файлы.`));});timer=setTimeout(()=>finish(new Error('Разбор документа превысил 90 секунд. Разделите книгу на меньшие файлы и повторите загрузку.')),options.timeoutMs||90000);}catch(e){finish(e);}
 });
}
module.exports={extract};
