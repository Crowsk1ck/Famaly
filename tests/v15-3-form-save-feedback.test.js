import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const helper=source.match(/function formSavingState\(form,busy\)\{[\s\S]*?\n\}(?=\nfunction saveErrorMessage\()/);
const messages=source.match(/function saveErrorMessage\(err\)\{[\s\S]*?\n\}(?=\nasync function handleSubmit\()/);
assert.ok(helper,'Form locking helper exists');
assert.ok(messages,'User-facing error mapping exists');

function fakeForm(){
 const buttons=[{disabled:false},{disabled:false}];
 let status=null,alert=null;
 const attrs=new Map();
 const form={
  dataset:{},
  querySelectorAll:()=>buttons,
  querySelector(selector){
   if(selector==='[data-form-save-status]')return status;
   if(selector==='[data-form-save-error]')return alert;
   return null;
  },
  append(node){
   if(node.dataset.formSaveStatus)status=node;
   if(node.dataset.formSaveError)alert=node;
   node.remove=()=>{if(status===node)status=null;if(alert===node)alert=null;};
  },
  setAttribute(name,value){attrs.set(name,value);},
  removeAttribute(name){attrs.delete(name);}
 };
 const document={createElement:()=>({dataset:{},setAttribute(){},textContent:'',remove(){}})};
 const lock=runInNewContext('('+helper[0]+')',{document,Array});
 return {form,buttons,lock,attrs,getStatus:()=>status};
}
test('v15.3 pending form sets visible busy state and disables every submit control',()=>{
 const {form,buttons,lock,attrs,getStatus}=fakeForm();
 lock(form,true);
 assert.equal(form.dataset.saving,'true');
 assert.equal(attrs.get('aria-busy'),'true');
 assert.ok(buttons.every(x=>x.disabled));
 assert.equal(getStatus().textContent,'Збереження…');
 assert.equal(getStatus().className,'gr-form-save-status muted small');
 lock(form,false);
 assert.equal(form.dataset.saving,undefined);
 assert.equal(attrs.has('aria-busy'),false);
 assert.ok(buttons.every(x=>!x.disabled));
 assert.equal(getStatus(),null);
});
test('v15.3 errors differentiate conflict, permissions, and offline failure',()=>{
 const describe=runInNewContext('('+messages[0]+')',{navigator:{onLine:false}});
 assert.match(describe({status:409}),/Оновіть дані/);
 assert.match(describe({status:428}),/застарів/);
 assert.match(describe({status:403}),/Недостатньо прав/);
 assert.match(describe({status:429}),/Забагато запитів/);
 assert.match(describe(new Error('Network fail')),/Немає з’єднання/);
 const connected=runInNewContext('('+messages[0]+')',{navigator:{onLine:true}});
 assert.equal(connected(new Error('Server message')),'Server message');
});
test('v15.3 submit handler prevents Enter-key or double-click resubmission',()=>{
 const start=source.slice(source.indexOf('async function handleSubmit(e)'),source.indexOf("document.addEventListener('change',async event"));
 assert.match(start,/e\.preventDefault\(\);\s*if\(f\.dataset\.saving==='true'\)return/);
 assert.match(start,/const b=formData\(f\)/);
 assert.match(start,/formSavingState\(f,true\)/);
 assert.match(start,/finally\{\s*formSavingState\(f,false\)/);
 assert.match(start,/feedback\.setAttribute\('role','alert'\)/);
 assert.match(start,/f\.querySelector\('\[data-form-save-error\]'\)\?\.remove\(\)/);
});
test('v15.3 pending and validation states have mobile-safe styles',()=>{
 assert.match(css,/form\[aria-busy="true"\] \[type="submit"\]\{cursor:progress/);
 assert.match(css,/\.gr-form-save-error\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.gr-form-save-status\{display:flex/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.gr-form-save-status::before\{animation:none/);
});
