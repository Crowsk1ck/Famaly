import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const start=app.indexOf('function departmentHeadFocus(');
const end=app.indexOf('async function departmentWorkspace(){',start);
assert.ok(start>=0&&end>start,'Department head focus helper must exist');
const project=runInNewContext('('+app.slice(start,end).trim()+')',{Set});

test('v15.7 task preview is scoped to department, active assignees and incomplete work',()=>{
 const members=[
  {id:'head',nickname:'Leader',status:'active'},
  {id:'member-a',nickname:'Active',status:'active'},
  {id:'blocked',nickname:'Blocked',status:'blocked'}
 ];
 const tasks=[
  {id:'outside',department_id:'capt',assignee_id:'member-a',status:'В роботі',ends_at:'2026-11-11'},
  {id:'blocked',department_id:'farm',assignee_id:'blocked',status:'В роботі',ends_at:'2026-11-11'},
  {id:'unknown',department_id:'farm',assignee_id:'unknown',status:'В роботі'},
  {id:'done',department_id:'farm',assignee_id:'member-a',status:'Завершено'},
  {id:'late',department_id:'farm',assignee_id:'member-a',status:'В роботі',ends_at:'2026-11-13'},
  {id:'next',department_id:'farm',assignee_id:'head',status:'На перевірці',ends_at:'2026-11-15'},
  {id:'no-date',department_id:'farm',assignee_id:'member-a',status:'Заплановано'}
 ];
 const idsBefore=tasks.map(x=>x.id);
 const result=project({departmentId:'farm',members,sections:[{id:'tasks',items:tasks}],weekly:{metrics:[]},report:{}});
 assert.equal(result.pendingTasks,3);
 assert.deepEqual(Array.from(result.tasks,x=>x.id),['late','next','no-date']);
 assert.equal(result.memberCount,2);
 assert.deepEqual(tasks.map(x=>x.id),idsBefore,'Authorized task records stay unmodified');
});

test('v15.7 goals count configured targets and report status from actual records',()=>{
 const summary=project({departmentId:'events',members:[],sections:[],weekly:{metrics:[
  {id:'a',actual:5,target:5},
  {id:'b',actual:1,target:4},
  {id:'c',actual:10,target:0},
  {id:'d',actual:6,target:3}
 ]},report:{report:{id:'weekly-report',status:'На перевірці'}}});
 assert.equal(summary.goalsMet,2);
 assert.equal(summary.goalsSet,3);
 assert.equal(summary.goalsPercent,67);
 assert.equal(summary.reportStatus,'На перевірці');
 assert.equal(summary.reportSubmitted,true);
 assert.equal(summary.pendingTasks,0);
 const empty=project({departmentId:'events',members:[],sections:[],weekly:{metrics:[]},report:{report:{}}});
 assert.equal(empty.goalsSet,0);
 assert.equal(empty.goalsPercent,0);
 assert.equal(empty.reportStatus,'Не подано');
 assert.equal(empty.reportSubmitted,false);
});

test('v15.7 all six department command centers share scoped calculations',()=>{
 for(const departmentId of ['capt','farm','fleet','discipline','recruitment','events']){
  const members=[{id:'one',status:'active'},{id:'two',status:'active'},{id:'blocked',status:'blocked'}];
  const sections=[{id:'tasks',items:[{id:departmentId,department_id:departmentId,assignee_id:'one',status:'У роботі'}]}];
  const summary=project({departmentId,members,sections,weekly:{metrics:[{target:1,actual:1}]},report:{report:{}}});
  assert.equal(summary.memberCount,2,departmentId);
  assert.equal(summary.pendingTasks,1,departmentId);
  assert.equal(summary.tasks[0].id,departmentId);
  assert.equal(summary.goalsMet,1);
 }
});

test('v15.7 workspace uses only existing server-scoped API responses',()=>{
 const workspace=app.slice(end,app.indexOf('async function departments(){',end));
 assert.match(workspace,/api\('\/department-workspace\?department='/);
 assert.match(workspace,/focus=departmentHeadFocus\(\{departmentId:dept\.id,members,sections,weekly,report\}\)/);
 assert.match(workspace,/gr-head-focus-grid/);
 assert.match(workspace,/data-action="workspace-section" data-value="weekly"/);
 assert.match(workspace,/data-action="workspace-section" data-value="report"/);
 assert.match(workspace,/data-action="workspace-section" data-value="tasks"/);
 assert.match(workspace,/data-action="workspace-section" data-value="personnel"/);
 assert.match(workspace,/data-action="view-record" data-module="tasks"/);
 assert.match(workspace,/data-action="open-dossier"/);
 assert.match(workspace,/esc\(task\.title\)/);
 assert.match(workspace,/esc\(person\.nickname\)/);
 assert.match(workspace,/focusSummary\+/);
});

test('v15.7 mobile command cards retain accessible progress and touch targets',()=>{
 assert.match(app,/aria-label="Виконання тижневих цілей" aria-valuemin="0" aria-valuemax="100"/);
 assert.match(css,/\.gr-head-focus-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1110px\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/\.gr-head-focus-panel>\.btn\{width:100%;min-height:44px\}/);
 assert.match(css,/\.gr-head-focus-task \.btn,\.gr-head-focus-person \.btn\{min-height:44px\}/);
});
