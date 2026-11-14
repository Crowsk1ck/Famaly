import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const match=source.match(/async function loadAuthorizedDossier\(requestedId\)\{[\s\S]*?\n\}(?=\nasync function dossierPage\()/);
assert.ok(match,'Access recovery helper must be present');

function setup(state,api){
 const load=runInNewContext('('+match[0]+')',{state,api,encodeURIComponent});
 return {load,state};
}

test('v15 dossier loads permitted selection without reloading account data',async()=>{
 const calls=[],state={user:{id:'self'},roster:[],dossierUser:'allowed'};
 const {load}=setup(state,async path=>{
  calls.push(path);
  return {item:{person:{id:'allowed'}}};
 });
 const result=await load('allowed');
 assert.equal(result.id,'allowed');
 assert.equal(result.recovered,false);
 assert.equal(result.item.person.id,'allowed');
 assert.deepEqual(calls,['/personnel-dossier?user=allowed']);
 assert.equal(state.dossierUser,'allowed');
});

test('v15 stale forbidden dossier refreshes permissions and returns own authorized dossier',async()=>{
 const calls=[],state={user:{id:'self',role:'head',head_appointed:true},roster:[{id:'former'}],dossierUser:'former'};
 const {load}=setup(state,async path=>{
  calls.push(path);
  if(path==='/personnel-dossier?user=former')throw Object.assign(new Error('Forbidden'),{status:403});
  if(path==='/auth/me')return {user:{id:'self',role:'member'}};
  if(path==='/members')return {items:[{id:'self'}]};
  if(path==='/personnel-dossier?user=self')return {item:{person:{id:'self'},can_manage:false}};
  throw Error('Unexpected '+path);
 });
 const result=await load('former');
 assert.equal(result.recovered,true);
 assert.equal(result.id,'self');
 assert.equal(result.item.can_manage,false);
 assert.equal(state.user.role,'member');
 assert.equal(state.dossierUser,'self');
 assert.deepEqual(state.roster,[{id:'self'}]);
 assert.deepEqual(calls,['/personnel-dossier?user=former','/auth/me','/members','/personnel-dossier?user=self']);
});

test('v15 missing dossier recovers, but login failures or own-dossier denial never retry',async()=>{
 for(const failure of [403,404]){
  const state={user:{id:'self'},roster:[],dossierUser:'deleted'};
  const {load}=setup(state,async path=>{
   if(path==='/personnel-dossier?user=deleted')throw Object.assign(new Error('Gone'),{status:failure});
   if(path==='/auth/me')return {user:{id:'self'}};
   if(path==='/members')return {items:[]};
   return {item:{person:{id:'self'}}};
  });
  assert.equal((await load('deleted')).recovered,true);
 }
 for(const {id,status} of [{id:'other',status:401},{id:'self',status:403}]){
  const calls=[],state={user:{id:'self'},roster:[],dossierUser:id};
  const {load}=setup(state,async path=>{
   calls.push(path);
   throw Object.assign(new Error('Denied'),{status});
  });
  await assert.rejects(load(id),error=>error.status===status);
  assert.equal(calls.length,1,'Authentication failure or own dossier denial must propagate');
  assert.equal(state.dossierUser,id);
 }
});

test('v15 dossier page shows a recovery notice after authorized fallback',()=>{
 assert.match(source,/const \{id,item:x,recovered\}=await loadAuthorizedDossier\(/);
 assert.match(source,/if\(recovered\)toast\('Доступ до попередньої справи змінився/);
});
