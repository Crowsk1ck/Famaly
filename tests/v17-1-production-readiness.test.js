import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkProduction} from '../scripts/check-production-readiness.mjs';
import {checkBackupFreshness,summarizeBackupFreshness} from '../scripts/check-backup-freshness.mjs';

const security={
 'x-frame-options':'DENY',
 'x-content-type-options':'nosniff',
 'referrer-policy':'strict-origin-when-cross-origin'
};
function makeResponse(body,status=200,headers={}){
 return new Response(typeof body==='string'?body:JSON.stringify(body),{
  status,headers:{...security,...headers,'content-type':'application/json'}
 });
}
function productionMock(overrides={}){
 const requests=[];
 const endpoints={
  '/api/health':makeResponse({ok:true,service:'grizzly',storage:'D1'}),
  '/api/public':makeResponse({
   settings:{family_name:'GRIZZLY'},
   gallery:[],news:[],team:[],achievements:[],calendar:[]
  }),
  '/api/auth/me':makeResponse({error:'Login required'},401),
  '/api/users':makeResponse({error:'Login required'},401),
  '/api/members':makeResponse({error:'Login required'},401),
  '/about/':makeResponse('<html><body>ІСТОРІЯ GRIZZLY</body></html>'),
  '/join/':makeResponse('<html><body>ВСТУП GRIZZLY</body></html>'),
  ...overrides
 };
 return {
  requests,
  fetcher:async(url,options)=>{
   const path=new URL(url).pathname;
   requests.push({path,method:options.method,url});
   assert.equal(options.method,'GET','Monitoring must never mutate production');
   assert.equal(options.signal.aborted,false);
   assert.ok(endpoints[path], 'Unknown probe '+path);
   return endpoints[path].clone();
  }
 };
}

test('v17.1 daily monitor only performs 7 anonymous GETs and checks public data/auth barriers',async()=>{
 const {requests,fetcher}=productionMock();
 const result=await checkProduction({fetcher,base:'https://grizzly-family.online'});
 assert.equal(result.passed,true);
 assert.equal(result.readOnlyRequests,7);
 assert.deepEqual(requests.map(x=>x.path),[
  '/api/health','/api/public','/api/auth/me','/api/users','/api/members','/about/','/join/'
 ]);
 assert.equal(requests.every(x=>x.method==='GET'),true);
});

test('v17.1 monitor fails closed if public API leaks a private field or anonymous user route opens',async()=>{
 const leak=productionMock({'/api/public':makeResponse({
  settings:{family_name:'GRIZZLY',password_hash:'should-never-leak'},
  gallery:[],news:[],team:[],achievements:[],calendar:[]
 })});
 await assert.rejects(checkProduction({fetcher:leak.fetcher}),/password_hash/);
 const open=productionMock({'/api/users':makeResponse({items:[{username:'private'}]},200)});
 await assert.rejects(checkProduction({fetcher:open.fetcher}),/Anonymous access not denied/);
 const insecure=productionMock({'/api/health':makeResponse({ok:true,service:'grizzly',storage:'D1'},200,{'x-frame-options':'SAMEORIGIN'})});
 await assert.rejects(checkProduction({fetcher:insecure.fetcher}),/missing x-frame-options/);
});

const makeRun=(id,time,conclusion='success',branch='main',event='schedule')=>({
 id,status:'completed',conclusion,head_branch:branch,event,created_at:time,
 html_url:'https://github.com/Crowsk1ck/Famaly/actions/runs/'+id
});
test('v17.1 private backup monitor rejects stale, pre-release and failed runs',()=>{
 const now=Date.parse('2026-11-24T09:00:00Z');
 const runs=[
  makeRun(1,'2026-11-12T03:17:00Z'),
  makeRun(2,'2026-11-15T03:17:00Z'),
  makeRun(3,'2026-11-23T03:17:00Z','failure'),
  makeRun(4,'2026-11-23T04:00:00Z','success','feature-test'),
  makeRun(5,'2026-11-23T05:00:00Z','success','main','pull_request')
 ];
 const result=summarizeBackupFreshness(runs,{now});
 assert.equal(result.passed,false);
 assert.equal(result.latest,null);
 const valid=summarizeBackupFreshness([...runs,makeRun(6,'2026-11-23T03:17:00Z')],{now});
 assert.equal(valid.passed,true);
 assert.equal(valid.latest.id,6);
});

test('v17.1 GitHub backup inspection requests only run metadata, with auth and time validation',async()=>{
 const now=Date.parse('2026-11-17T10:00:00Z');
 const requests=[];
 const fetcher=async(url,opts)=>{
  requests.push({url,method:opts.method});
  assert.equal(opts.method,'GET');
  assert.equal(opts.headers.Authorization,'Bearer fake-test-token');
  return makeResponse({workflow_runs:[makeRun(9,'2026-11-16T03:17:00Z')]});
 };
 const result=await checkBackupFreshness({fetcher,token:'fake-test-token',repository:'Crowsk1ck/Famaly',now});
 assert.equal(result.passed,true);
 assert.equal(result.latest.id,9);
 assert.match(requests[0].url,/\/actions\/workflows\/d1-private-backup\.yml\/runs\?per_page=30$/);
 const missing=async()=>makeResponse({workflow_runs:[]});
 await assert.rejects(checkBackupFreshness({fetcher:missing,token:'fake-test-token',repository:'Crowsk1ck/Famaly',now}),/No successful private D1 backup/);
 await assert.rejects(checkBackupFreshness({fetcher:missing,token:'',repository:'Crowsk1ck/Famaly',now}),/read-only token/);
});

test('v17.1 scheduled checks avoid backup secrets, mutations and noisy repeated backup checks',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/production-readiness.yml',import.meta.url),'utf8');
 const health=readFileSync(new URL('../scripts/check-production-readiness.mjs',import.meta.url),'utf8');
 const backup=readFileSync(new URL('../scripts/check-backup-freshness.mjs',import.meta.url),'utf8');
 assert.match(workflow,/cron: '13 6 \* \* \*'/);
 assert.match(workflow,/cron: '21 7 \* \* 2'/);
 assert.match(workflow,/if: github\.event_name == 'workflow_dispatch' \|\| github\.event\.schedule == '21 7 \* \* 2'/);
 assert.match(workflow,/actions: read/);
 assert.doesNotMatch(workflow,/(CLOUDFLARE_API_TOKEN|GRIZZLY_BACKUP_R2_SECRET_ACCESS_KEY|wrangler d1|wrangler deploy)/);
 assert.doesNotMatch(health,/method:'POST'|method:'PUT'|method:'PATCH'|method:'DELETE'/);
 assert.doesNotMatch(backup,/s3 cp|download_artifact|secret_key/);
});
