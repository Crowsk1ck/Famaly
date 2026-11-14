import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const begin=src.indexOf('const ROUTES_WITH_RENDER_PRELOAD=');
const end=src.indexOf('const lines=',begin);
assert.ok(begin>0&&end>begin,'initialization helper is present');
const initialSource=src.slice(begin,end);
const makeInitial=new Function('api','state','preload','render','renderPublic','toast','location','URL',initialSource+'\nreturn initial;');

function harness(route){
 const calls=[],state={user:null,route:null},errors=[];
 let rosterLoads=0,renders=0;
 const api=async path=>{
  calls.push(path);
  if(path==='/public')return {settings:{tagline:'GRIZZLY'}};
  if(path==='/auth/me')return {user:{id:'owner',role:'leader'}};
  if(path==='/notifications')return {items:[]};
  throw new Error('unexpected '+path);
 };
 const preload=async()=>{rosterLoads++};
 const render=async()=>{renders++};
 const renderPublic=()=>{};
 const location={hash:'#'+route,href:'https://grizzly-family.online/#'+route};
 const initial=makeInitial(api,state,preload,render,renderPublic,e=>errors.push(e),location,URL);
 return {initial,calls,state,errors,get rosterLoads(){return rosterLoads},get renders(){return renders}};
}
test('v13.3 starts public data and session fetch independently and avoids initial duplicate roster on overview',async()=>{
 const h=harness('overview');
 await h.initial();
 assert.deepEqual(h.calls.slice(0,2),['/public','/auth/me']);
 assert.equal(h.rosterLoads,0,'render preloads roster once on overview');
 assert.equal(h.renders,1);
 assert.equal(h.state.route,'overview');
});
test('v13.3 keeps shared roster available for pages without automatic render preload',async()=>{
 const h=harness('activity');
 await h.initial();
 assert.equal(h.rosterLoads,1);
 assert.equal(h.renders,1);
});
test('v13.3 excludes settings from unconditional four-endpoint roster refresh',()=>{
 const body=src.slice(src.indexOf('async function render(){'),src.indexOf('async function initial()'));
 assert.match(body,/ROUTES_WITH_RENDER_PRELOAD\.has\(state\.route\)\)await preload\(\)/);
 assert.doesNotMatch(src.slice(begin,end),/['"]settings['"]/);
 assert.match(src,/if\(!ROUTES_WITH_RENDER_PRELOAD\.has\(state\.route\)\)await preload\(\)/);
});
