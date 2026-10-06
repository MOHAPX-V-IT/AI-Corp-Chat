const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
async function release(){const root=path.resolve(__dirname,'..'),pkg=require('../package.json');const files=require('./check-public.cjs').check(root);const JSZip=require('jszip'),zip=new JSZip();const folder=zip.folder(`AI_Corp_Chat-${pkg.version}`);
 for(const name of files)if(fs.statSync(path.join(root,name)).isFile())folder.file(name,fs.readFileSync(path.join(root,name)));
 function addDist(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())addDist(full);else if(!full.endsWith('.map'))folder.file(path.relative(root,full).split(path.sep).join('/'),fs.readFileSync(full));}}
 if(!fs.existsSync(path.join(root,'client/dist/index.html')))throw new Error('Run npm run build before packaging.');addDist(path.join(root,'client/dist'));
 const output=path.join(root,'..',`AI_Corp_Chat-${pkg.version}.zip`);if(fs.existsSync(output))throw new Error('Release already exists; choose a new version or move the old archive.');fs.writeFileSync(output,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),{flag:'wx'});console.log(path.basename(output));}
release().catch(e=>{console.error(e.message);process.exit(1)});
