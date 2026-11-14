import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
test('department workspaces are visible to leaders, deputies and heads only',()=>{
 assert.match(app,/id:'workspace',text:'Управління підрозділом'/);
 assert.match(app,/n\.id==='workspace'&&!\['leader','deputy','head'\]\.includes\(state\.user\.role\)/);
 assert.match(app,/case'workspace':content=await departmentWorkspace\(\);break/);
 assert.match(app,/data-route="workspace">Відкрити підрозділ/);
});
test('department workspace contains every operational section with server-owned data',()=>{
 for(const mod of ['tasks','reports','promotions','events','capt_matches','capt_training','capt_attendance','vehicles','vehicle_loans','discipline','blacklist','notices','templates','gallery','public_news','public_team','public_achievements','public_calendar']){
  assert.ok(worker.includes("['"+mod+"','")||worker.includes("['"+mod+"',"),'Missing section '+mod);
 }
 assert.match(app,/api\('\/department-workspace\?department='/);
 assert.match(app,/data-action="workspace-section"/);
 assert.match(app,/data-action="view-record"/);
 assert.match(app,/Фінанси підрозділу/);
 assert.match(app,/Тільки статистика свого підрозділу/);
});
test('head appointment is checked by backend and foreign department is forbidden',()=>{
 assert.match(worker,/dept\.head_id!==user\.id/);
 assert.match(worker,/requested&&requested!==departmentId/);
 assert.match(worker,/WHERE department_id=\?/);
 assert.match(worker,/permittedRecord\(user,mod,r\)/);
 assert.doesNotMatch(app,/workspace-settle-contract/);
});
test('manager workspace is responsive and department selection drives API refresh',()=>{
 assert.match(css,/\.gr-workspace-layout\{/);
 assert.match(css,/@media\(max-width:880px\)/);
 assert.match(app,/id==='workspace-department-select'/);
 assert.match(app,/workspace-new-record/);
});
