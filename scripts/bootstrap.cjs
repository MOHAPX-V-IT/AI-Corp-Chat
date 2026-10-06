const path=require('node:path');
async function bootstrap(){
 require('dotenv').config({path:path.resolve(__dirname,'../.env')});require('module-alias').addAlias('~',path.resolve(__dirname,'../api'));
 const mongoose=require('mongoose'),bcrypt=require('bcryptjs'),{User}=require('../api/db/models'),{connectDb}=require('../api/db/connect');
 try{await connectDb();await require('../api/models').seedDatabase();let owner=await User.findOne({role:'ADMIN'});
  if(!owner){if(await User.countDocuments({}))throw new Error('Existing users found without administrator; bootstrap will not elevate an existing account. Assign roles through your controlled administration process.');
   const password=process.env.ADMIN_PASSWORD;if(!password||password==='CHANGE_ME'||password.length<16)throw new Error('Run npm run setup and configure ADMIN_PASSWORD (16+ characters).');
   const email=process.env.ADMIN_EMAIL||'admin@example.com';owner=await User.create({name:process.env.ADMIN_NAME||'Administrator',username:email.split('@')[0],email,emailVerified:true,provider:'local',role:'ADMIN',password:await bcrypt.hash(password,12)});
   console.log('Created administrator for this empty installation. Existing passwords were not changed.');
  }
  await require('./seed-agents.cjs').seedAgents(owner);
 }finally{await mongoose.disconnect();}
}
module.exports={bootstrap};if(require.main===module)bootstrap().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
