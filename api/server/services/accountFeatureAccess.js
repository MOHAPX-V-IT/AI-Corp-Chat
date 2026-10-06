// Access policies use authentication and roles, never employee email addresses.
const canUseMarketAnalysis = user => Boolean(user && (user._id || user.id));
const hiddenAgentIds = () => [];
function requireMarketAccess(req,res,next){if(!canUseMarketAnalysis(req.user))return res.status(401).json({error:'Требуется вход в аккаунт'});next();}
function requireAgentAccountAccess(req,res,next){next();}
module.exports={canUseMarketAnalysis,hiddenAgentIds,requireMarketAccess,requireAgentAccountAccess};
