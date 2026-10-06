const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function problems(text,file){const found=[];const checks=[['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['provider credential',/\b(?:sk-[A-Za-z0-9_-]{24,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,})\b/],['personal Windows path',/[A-Z]:[\\/]Users[\\/](?!Public[\\/]|Example[\\/]|user[\\/])[\w.-]+[\\/]/i]];
 for(const term of (process.env.PUBLIC_CHECK_BLOCKED_TERMS||'').split(',').map(s=>s.trim()).filter(Boolean))if(text.toLowerCase().includes(term.toLowerCase()))found.push(`${file}: operator-blocked term`);
 for(const [label,re]of checks)if(re.test(text))found.push(`${file}: ${label}`);return found;}
function check(root=path.resolve(__dirname,'..')){
 const names=cp.execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);const issues=[];
 for(const name of names){if(name==='scripts/check-public.cjs'||name.startsWith('scripts/tests/'))continue;const file=path.join(root,name);if(!fs.statSync(file).isFile())continue;
  if(/(?:^|\/)(?:\.env(?:\..+)?|auth\.json|storageState\.json)$/.test(name)&&name!=='.env.example')issues.push(`${name}: runtime secret/session file`);
  if(/(?:^|\/)(?:uploads|logs|data-node|secrets)\//.test(name))issues.push(`${name}: runtime data`);
  const data=fs.readFileSync(file);if(data.includes(0)||data.length>3_000_000)continue;issues.push(...problems(data.toString('utf8'),name));
 }
 if(issues.length){console.error(issues.join('\n'));throw new Error(`Public-source check found ${issues.length} issue(s)`);}console.log(`Public-source check passed (${names.length} files). Heuristic scan; not a security audit.`);return names;
}
module.exports={check,problems};if(require.main===module){try{check()}catch(e){console.error(e.message);process.exit(1)}}
