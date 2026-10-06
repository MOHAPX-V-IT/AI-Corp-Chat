const path=require('node:path'),fs=require('node:fs');
async function seedAgents(owner){
 const {createAgent}=require('../api/models/Agent'),{Agent}=require('../api/db/models');
 const {grantPermission}=require('../api/server/services/PermissionService'),{getProjectByName,addAgentIdsToProject}=require('../api/models/Project');
 const {Constants,AccessRoleIds,ResourceType,PrincipalType}=require('librechat-data-provider');
 const {agents}=JSON.parse(fs.readFileSync(path.join(__dirname,'../config/seed/agents.json'),'utf8')),project=await getProjectByName(Constants.GLOBAL_PROJECT_NAME);let created=0;
 for(const template of agents){let agent=await Agent.findOne({id:template.id}).lean();if(!agent){agent=await createAgent({...template,model:process.env.CHAT_MODEL||'deepseek-v4-flash',provider:process.env.CHAT_PROVIDER||'DeepSeek',author:owner._id,authorName:'Administrator',projectIds:[project._id]});created++;}
  await grantPermission({principalType:PrincipalType.USER,principalId:agent.author,resourceType:ResourceType.AGENT,resourceId:agent._id,accessRoleId:AccessRoleIds.AGENT_OWNER,grantedBy:owner._id});
  await grantPermission({principalType:PrincipalType.PUBLIC,principalId:null,resourceType:ResourceType.AGENT,resourceId:agent._id,accessRoleId:AccessRoleIds.AGENT_VIEWER,grantedBy:owner._id});
  await addAgentIdsToProject(project._id,[agent.id]);
 }
 console.log(`Assistant catalog ready: ${agents.length} entries, ${created} newly created. Existing customizations preserved.`);return {total:agents.length,created};
}
module.exports={seedAgents};if(require.main===module)require('./bootstrap.cjs').bootstrap().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
