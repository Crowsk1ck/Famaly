import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('each of six departments has its own weekly targets and duties',()=>{
 for(const id of ['capt','farm','fleet','discipline','recruitment','events']){
  assert.match(app,new RegExp('\\b'+id+':\\['));
  assert.match(worker,new RegExp('\\b'+id+':\\['));
 }
 assert.match(app,/id:'weekly',title:'План на тиждень'/);
 assert.match(app,/const active=focusedSections\.find\(x=>x\.id===id\)\|\|focusedSections\[0\]/);
});

test('leader-only target editor writes through protected endpoint',()=>{
 assert.match(app,/case 'workspace-edit-goals'/);
 assert.match(app,/state\.user\.role!=='leader'/);
 assert.match(app,/case 'department-goals-form'/);
 assert.match(app,/api\('\/department-goals\/'.*'PATCH'/);
 assert.match(worker,/user\.role!=='leader'\)fail\(403,'Тільки лідер встановлює цілі/);
 assert.match(worker,/version=version\+1/);
 assert.match(worker,/fail\(409,'Цілі вже змінив інший керівник/);
});

test('KPI data is calculated using eligible recent records and never mutates payouts',()=>{
 assert.match(worker,/from=Date\.now\(\)-7\*86400000,to=Date\.now\(\)/);
 assert.match(worker,/visibleRecords=allRecords\.filter\(r=>permittedRecord\(user,r\.module,r\)\)/);
 assert.match(worker,/contracts\.filter\(c=>isRecent\(c\.settled_at\)\)\.length/);
 assert.match(worker,/return \{id,title,source,actual,target\}/);
 assert.match(app,/role="progressbar"/);
 assert.match(css,/\.gr-weekly-progress/);
 assert.doesNotMatch(app,/workspace-pay-weekly-goals/);
});
