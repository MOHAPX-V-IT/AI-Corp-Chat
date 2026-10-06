const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function setup(root=path.resolve(__dirname,'..')){
 const env=path.join(root,'.env');if(fs.existsSync(env)){console.log('.env exists; configuration preserved.');return false;}
 const secret=bytes=>crypto.randomBytes(bytes).toString('hex'),mongo=secret(24),postgres=secret(24);
 const values={MONGO_PASSWORD:mongo,POSTGRES_PASSWORD:postgres,DB_PASSWORD:postgres,MONGO_URI:`mongodb://ai_corp:${mongo}@mongodb:27017/ai_corp_chat?authSource=admin`,TOKEN_USAGE_DB_URL:`postgresql://ai_corp:${postgres}@vectordb:5432/ai_corp`,JWT_SECRET:secret(32),JWT_REFRESH_SECRET:secret(32),CREDS_KEY:secret(32),CREDS_IV:secret(16),MEILI_MASTER_KEY:secret(32),ADMIN_PASSWORD:secret(24)};
 const template=fs.readFileSync(path.join(root,'.env.example'),'utf8').replace(/\r\n/g,'\n'),content=template.replace(/^([A-Z_]+)=.*$/gm,(line,key)=>values[key]?`${key}=${values[key]}`:line);
 fs.writeFileSync(env,content,{flag:'wx',mode:0o600});fs.mkdirSync(path.join(root,'secrets'),{recursive:true});
 console.log('Created local .env with fresh secrets. Add model/embedding keys. Administrator password is stored only in .env.');return true;
}
module.exports={setup};if(require.main===module)setup();
