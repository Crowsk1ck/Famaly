import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('const pendingApiReads=new Map()');
const end=source.indexOf('async function preload()',start);
assert.ok(start>=0&&end>start,'deduplicated API helper is present');
const makeApi=new Function('fetch',source.slice(start,end)+'\nreturn api;');
const ok=value=>({ok:true,status:200,json:async()=>value});
const rejected=(status=503)=>({ok:false,status,json:async()=>({error:'Тимчасова помилка'})});

test('simultaneous identical GETs share exactly one fetch and return the same data',async()=>{
 let requests=0,release;
 const wait=new Promise(resolve=>{release=resolve});
 const api=makeApi(async()=>{requests++;await wait;return ok({items:[{id:'member'}]})});
 const a=api('/users'),b=api('/users');
 assert.equal(requests,1);
 release();
 const [first,second]=await Promise.all([a,b]);
 assert.deepEqual(first,second);
 assert.equal(requests,1);
 await api('/users');
 assert.equal(requests,2,'completed reads must never be cached');
});
test('different GET paths and all writes remain independent',async()=>{
 let requests=0;
 const api=makeApi(async(_url,opts)=>{requests++;return ok({method:opts.method})});
 await Promise.all([api('/users'),api('/ranks')]);
 assert.equal(requests,2);
 await Promise.all([api('/users','POST',{a:1}),api('/users','POST',{a:1})]);
 assert.equal(requests,4);
});
test('failed reads clear pending state and a later GET can retry',async()=>{
 let requests=0,release;
 const wait=new Promise(resolve=>{release=resolve});
 const api=makeApi(async()=>{requests++;if(requests===1){await wait;return rejected()}return ok({items:[]})});
 const pair=Promise.allSettled([api('/notifications'),api('/notifications')]);
 assert.equal(requests,1);
 release();
 const results=await pair;
 assert.deepEqual(results.map(r=>r.status),['rejected','rejected']);
 assert.equal(results[0].reason.status,503);
 assert.deepEqual(await api('/notifications'),{items:[]});
 assert.equal(requests,2);
});
test('fetch always requests same-origin credentials with no HTTP caching',async()=>{
 const options=[];
 const api=makeApi(async(_url,opts)=>{options.push(opts);return ok({})});
 await api('/users');
 assert.equal(options[0].cache,'no-store');
 assert.equal(options[0].credentials,'same-origin');
 assert.equal(options[0].headers['X-Grizzly-Client'],'1');
});
