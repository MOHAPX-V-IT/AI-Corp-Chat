const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['gemini.cjs','gemini.js']){const source=path.join(root,'patches/google-common',file),dest=path.join(root,'node_modules/@langchain/google-common/dist/utils',file);if(!fs.existsSync(dest))throw new Error('Install the locked @langchain/google-common dependency before applying its compatibility patch.');fs.copyFileSync(source,dest);}
console.log('Applied the included Gemini tool compatibility patches.');
