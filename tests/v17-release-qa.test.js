import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import worker from '../worker/index.js';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('v16.3 public page, assets and unknown API replies have browser security headers',async()=>{
 const assets={fetch:async req=>new Response(req.url.endsWith('.css')?'body{}':
  '<!doctype html><html><head><title>GRIZZLY</title></head><body><div id="app"></div></body></html>',
  {status:200,headers:{'Content-Type':req.url.endsWith('.css')?'text/css':'text/html'}})};
 const env={ASSETS:assets};
 for(const url of ['https://grizzly.example/','https://grizzly.example/about/','https://grizzly.example/style.css']){
  const response=await worker.fetch(new Request(url),env,{});
  assert.equal(response.status,200,url);
  assert.equal(response.headers.get('X-Frame-Options'),'DENY',url);
  assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff',url);
  assert.equal(response.headers.get('Referrer-Policy'),'strict-origin-when-cross-origin',url);
  assert.ok(response.headers.get('Permissions-Policy').includes('camera=()'),url);
 }
 // D1 is intentionally absent in this fixture, so API correctly fails closed.
 // Error responses must still carry the same browser protection headers.
 const health=await worker.fetch(new Request('https://grizzly.example/api/health'),env,{});
 assert.equal(health.status,500);
 assert.equal(health.headers.get('X-Frame-Options'),'DENY');
});

test('v16.2 modal locks background scrolling, restores trigger and can close via Escape',()=>{
 const start=app.indexOf('let modalRestoreFocus=null;');
 const end=app.indexOf('function visible(',start);
 assert.ok(start>0&&end>start);
 let isOpen=false,focused=false,handler;
 const trigger={isConnected:true,focus(){focused=true;}};
 const root={_html:'',get innerHTML(){return this._html;},set innerHTML(value){this._html=value;isOpen=Boolean(value);}};
 const classes=new Set();
 const dialog={querySelectorAll:()=>[],focus(){},contains:()=>false};
 const document={
  activeElement:trigger,body:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},
  querySelector:query=>query==='#modal-root [role="dialog"]'&&isOpen?dialog:null,
  addEventListener:(name,callback)=>{if(name==='keydown')handler=callback;}
 };
 const $=query=>query==='#modal-root'?root:null;
 const runtime=runInNewContext(app.slice(start,end)+'\n({modal,closeModal})',{
  document,$,state:{},esc:v=>String(v),setTimeout:callback=>callback(),Array
 });
 runtime.modal('Тестове вікно','<p>Test</p>');
 assert.ok(root.innerHTML.includes('role="dialog"'));
 assert.ok(root.innerHTML.includes('aria-label="Закрити вікно"'));
 assert.equal(classes.has('gr-dialog-open'),true);
 let prevented=false;
 handler({key:'Escape',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);
 assert.equal(classes.has('gr-dialog-open'),false);
 assert.equal(root.innerHTML,'');
 assert.equal(focused,true);
});

test('v16.2 dialogs stay within mobile viewport and form controls are large enough',()=>{
 assert.match(css,/body\.gr-dialog-open\{overflow:hidden\}/);
 assert.match(css,/\.modal\{width:100%;max-height:calc\(100dvh - 20px\)/);
 assert.match(css,/\.modal \.formgrid\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/\.modal \.form-actions>\.btn\{flex:1 1 120px;min-height:44px\}/);
});

test('v17.0 protects backup, authenticated browser QA and performance budgets in CI',()=>{
 const verify=readFileSync(new URL('../.github/workflows/verify.yml',import.meta.url),'utf8');
 const backup=readFileSync(new URL('../.github/workflows/d1-private-backup.yml',import.meta.url),'utf8');
 assert.match(verify,/panel_browser_acceptance:/);
 assert.match(verify,/node tests\/panel-browser-acceptance\.mjs/);
 assert.match(verify,/node scripts\/check-performance-budget\.mjs/);
 assert.match(verify,/bash scripts\/check-backup-roundtrip\.sh/);
 assert.match(backup,/python3 scripts\/verify-d1-restore\.py "\$VERIFY"/);
 assert.match(backup,/cmp -s "\$BACKUP" "\$VERIFY"/);
 assert.ok(backup.indexOf('python3 scripts/verify-d1-restore.py')<backup.indexOf('s3 cp "$BACKUP.enc"'));
});
