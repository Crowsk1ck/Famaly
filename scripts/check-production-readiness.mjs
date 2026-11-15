// GRIZZLY v17.1: strictly read-only, anonymous checks against production.
// No login credentials, POSTs, production writes or secret material.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const PRODUCTION='https://grizzly-family.online';
const headersToRequire={
 'x-frame-options':'DENY',
 'x-content-type-options':'nosniff'
};

async function get(fetcher,base,path){
 const url=new URL(path,base).toString();
 const response=await fetcher(url,{
  method:'GET',redirect:'follow',cache:'no-store',
  headers:{'Accept':path.startsWith('/api/')?'application/json':'text/html'},
  signal:AbortSignal.timeout(15000)
 });
 for(const [name,value] of Object.entries(headersToRequire)){
  assert.equal(response.headers.get(name),value,path+' missing '+name);
 }
 assert.ok(response.headers.get('referrer-policy'),path+' missing Referrer-Policy');
 return response;
}

export async function checkProduction({fetcher=fetch,base=PRODUCTION}={}){
 const health=await get(fetcher,base,'/api/health');
 assert.equal(health.status,200,'Health check must be HTTP 200');
 const healthData=await health.json();
 assert.equal(healthData.ok,true);
 assert.equal(healthData.service,'grizzly');
 assert.equal(healthData.storage,'D1');

 const publicResponse=await get(fetcher,base,'/api/public');
 assert.equal(publicResponse.status,200,'Public API must be HTTP 200');
 const publicData=await publicResponse.json();
 assert.equal(typeof publicData.settings,'object','Public API settings missing');
 for(const key of ['gallery','news','team','achievements','calendar']){
  assert.ok(Array.isArray(publicData[key]),'Public API missing '+key+' array');
 }
 const raw=JSON.stringify(publicData);
 for(const forbidden of ['password_hash','token_hash','bootstrap_token','secret_key']){
  assert.ok(!raw.includes('"'+forbidden+'"'),'Public API exposed private field '+forbidden);
 }

 for(const path of ['/api/auth/me','/api/users','/api/members']){
  const response=await get(fetcher,base,path);
  assert.equal(response.status,401,'Anonymous access not denied: '+path);
 }

 for(const path of ['/about/','/join/']){
  const response=await get(fetcher,base,path);
  assert.equal(response.status,200,'Public page unreachable: '+path);
  const html=await response.text();
  assert.ok(html.includes('<html')&&html.includes('GRIZZLY'),
   'Public page unexpectedly missing expected HTML: '+path);
 }

 return {passed:true,readOnlyRequests:7,base};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  const result=await checkProduction();
  console.log('Production readiness passed: '+result.readOnlyRequests+' anonymous GET requests; public API and RBAC are responding correctly.');
 }catch(error){
  console.error('::error::GRIZZLY production readiness failed: '+error.message);
  process.exitCode=1;
 }
}
