import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('v10 personnel dossiers and inactivity have separate navigation and six department workspaces',()=>{
 assert.match(app,/id:'dossier',text:'Особові справи'/);
 assert.match(app,/id:'inactivity',text:'Контроль неактиву'/);
 assert.match(app,/case'dossier':content=await dossierPage\(\);break/);
 assert.match(app,/case'inactivity':content=await inactivityPage\(\);break/);
 assert.match(app,/id:'dossiers',title:'Особові справи'/);
 assert.match(app,/id:'inactivity',title:'Контроль неактиву'/);
 assert.match(app,/data-action="open-dossier"/);
 assert.match(css,/\.gr-v10-profile/);
});
test('v10 disciplinary actions and awards are fully backed by server authorization',()=>{
 assert.match(worker,/PERSONNEL_ACTION_KINDS=/);
 for(const kind of ['warning','reprimand','recognition','award'])assert.ok(worker.includes(kind+':'));
 assert.match(worker,/function personnelAllowed\(/);
 assert.match(worker,/function personnelManage\(/);
 assert.match(worker,/head_appointed&&!!viewer.department_id/);
 assert.match(worker,/if\(!personnelManage\(user,person\)\)fail\(403/);
 assert.match(worker,/amount,starts_at,ends_at,evidence,extra/);
 assert.match(worker,/id,'personnel_actions'/);
 assert.match(worker,/version=version\+1/);
 assert.doesNotMatch(app,/personnel-bonus-transfer|personnel-pay-amount/);
});
test('v10 inactivity supports only 7 14 30 day filters and approved absence exceptions',()=>{
 assert.match(worker,/\[7,14,30\]\.includes\(days\)/);
 assert.match(worker,/approved_absence:!!r.absence/);
 assert.match(worker,/overdue:!r.absence/);
 assert.match(worker,/activitySnapshot\(db,user,dep\)/);
 assert.match(app,/\[7,14,30\]\.map/);
 assert.match(app,/x.approved_absence/);
 assert.match(css,/\.gr-v10-toolbar/);
});
