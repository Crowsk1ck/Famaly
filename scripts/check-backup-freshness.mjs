// GRIZZLY v17.1: verify a successful private backup workflow after v17.0.
// READ ONLY: examines GitHub Actions run metadata; never downloads any archive,
// accesses backup keys, writes to D1/R2, or assumes scheduled runs succeeded.
import {fileURLToPath} from 'node:url';

const RELEASE_AT=Date.parse('2026-11-14T16:20:38Z');
const EIGHT_DAYS=8*86400000;

export function summarizeBackupFreshness(runs,{now=Date.now()}={}){
 const eligible=(Array.isArray(runs)?runs:[])
  .filter(run=>run.status==='completed'&&run.conclusion==='success'&&
   run.head_branch==='main'&&['schedule','workflow_dispatch'].includes(run.event))
  .filter(run=>{
   const time=Date.parse(run.created_at||'');
   return Number.isFinite(time)&&time>=RELEASE_AT&&time<=now&&time>=now-EIGHT_DAYS;
  }).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 return {
  passed:eligible.length>0,
  latest:eligible.length?{id:eligible[0].id,url:eligible[0].html_url,at:eligible[0].created_at}:null
 };
}

export async function checkBackupFreshness({
 fetcher=fetch,token=process.env.GITHUB_TOKEN,
 repository=process.env.GITHUB_REPOSITORY,
 api=process.env.GITHUB_API_URL||'https://api.github.com',
 now=Date.now()
}={}){
 if(!token||!repository||!/^[\w.-]+\/[\w.-]+$/.test(repository)){
  throw new Error('GitHub read-only token and GITHUB_REPOSITORY are required');
 }
 const url=new URL('/repos/'+repository+'/actions/workflows/d1-private-backup.yml/runs?per_page=30',api);
 const response=await fetcher(url.toString(),{
  method:'GET',
  headers:{
   Accept:'application/vnd.github+json',
   Authorization:'Bearer '+token,
   'X-GitHub-Api-Version':'2022-11-28'
  },
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw new Error('GitHub backup workflow API returned HTTP '+response.status);
 const data=await response.json();
 if(!Array.isArray(data.workflow_runs))throw new Error('GitHub returned an invalid backup workflow payload');
 const result=summarizeBackupFreshness(data.workflow_runs,{now});
 if(!result.passed)throw new Error('No successful private D1 backup on main within 8 days and after v17.0 release; inspect GRIZZLY private D1 backup workflow and production secrets. Issue #97 remains open.');
 return result;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  const result=await checkBackupFreshness();
  console.log('Verified backup workflow success at '+result.latest.at+'; '+result.latest.url);
  console.log('Note: workflow success includes its offline SQL restore and private R2 upload steps; this monitor checks run metadata only.');
 }catch(error){
  console.error('::error::GRIZZLY backup freshness failed: '+error.message);
  process.exitCode=1;
 }
}
