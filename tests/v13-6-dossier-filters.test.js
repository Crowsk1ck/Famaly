import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const start=src.indexOf('function filterDossierRows('),end=src.indexOf('async function dossierPage()',start);
assert.ok(start>0&&end>start);
const filterDossierRows=new Function(src.slice(start,end)+'\nreturn filterDossierRows;')();
const actions=[
 {kind:'warning',status:'Чинне',created_at:'2026-11-01T14:00:00Z',title:'Попередження'},
 {kind:'reprimand',status:'Знято',created_at:'2026-11-09T14:00:00Z',title:'Догана'},
 {kind:'award',status:'Чинне',created_at:'2026-11-12T14:00:00Z',title:'Нагорода'}
];
test('v13.6 filters decisions by event type, status and inclusive date',()=>{
 assert.equal(filterDossierRows(actions,{kind:'warning'}).length,1);
 assert.equal(filterDossierRows(actions,{status:'Знято'}).length,1);
 assert.deepEqual(filterDossierRows(actions,{from:'2026-11-09',to:'2026-11-12'}).map(x=>x.kind),['reprimand','award']);
 assert.equal(filterDossierRows(actions,{kind:'award',status:'Знято'}).length,0);
 assert.equal(filterDossierRows(actions,{from:'2026-11-12',to:'2026-11-12'})[0].kind,'award');
});
test('date-only filtering supports audit rows with no personnel decision kind',()=>{
 const history=[{action:'update',created_at:'2026-09-22'},{action:'review',created_at:'2026-11-14'}];
 assert.equal(filterDossierRows(history,{from:'2026-11-01'}).length,1);
 assert.equal(filterDossierRows(history,{}).length,2);
});
test('dossier search offers only server-authorized roster choices and never exposes other member data',()=>{
 const section=src.slice(src.indexOf('async function dossierPage()'),src.indexOf('async function activityPage()',src.indexOf('async function dossierPage()')));
 assert.match(section,/state\.roster\.filter\(p=>\['leader','deputy'\]/);
 assert.match(section,/state\.user\.head_appointed&&p\.department_id===state\.user\.department_id/);
 assert.match(section,/data-lookup/);
 assert.match(section,/dossier-person-search/);
 assert.match(section,/filteredActions=filterDossierRows\(x\.actions/);
 assert.match(section,/filteredHistory=filterDossierRows\(x\.history/);
 assert.match(src,/case 'dossier-reset-filters'/);
 assert.match(src,/select\.replaceChildren\(\.\.\.allowed\.map/);
});
test('new dossier inputs are accessible and responsive',()=>{
 assert.match(src,/id="dossier-from-filter"/);
 assert.match(src,/id="dossier-to-filter"/);
 assert.match(src,/id="dossier-kind-filter"/);
 assert.match(src,/id="dossier-status-filter"/);
 assert.match(css,/\.gr-dossier-picker/);
 assert.match(css,/@media\(max-width:600px\)/);
});
