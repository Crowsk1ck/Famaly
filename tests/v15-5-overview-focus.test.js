import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const start=app.indexOf('function overviewFocusItems(');
const end=app.indexOf('async function overview(){',start);
assert.ok(start>=0&&end>start,'Overview focus projection is present');
const focus=runInNewContext('('+app.slice(start,end).trim()+')',{
 kyivWallDate:value=>String(value||'').slice(0,16)
});

test('v15.5 focus scopes tasks to the logged-in member and excludes completed work',()=>{
 const tasks=[
  {id:'other',assignee_id:'another',status:'Заплановано',ends_at:'2026-11-14T08:00'},
  {id:'done',assignee_id:'mine',status:'Завершено',ends_at:'2026-11-14T09:00'},
  {id:'late',assignee_id:'mine',status:'Заплановано',ends_at:'2026-11-14T10:00'},
  {id:'next',assignee_id:'mine',status:'У роботі',ends_at:'2026-11-15T09:00'},
  {id:'last',assignee_id:'mine',status:'У роботі',ends_at:'2026-11-16T09:00'},
  {id:'fourth',assignee_id:'mine',status:'У роботі',ends_at:'2026-11-17T09:00'}
 ];
 const before=tasks.map(x=>x.id);
 const result=focus({tasks,events:[],notifications:[],userId:'mine',nowLocal:'2026-11-14T12:00'});
 assert.deepEqual(Array.from(result.tasks,x=>x.id),['late','next','last']);
 assert.deepEqual(tasks.map(x=>x.id),before,'Filtering must not reorder API records');
});

test('v15.5 nearest events exclude cancelled and past items and keep Kyiv clock order',()=>{
 const events=[
  {id:'later',starts_at:'2026-11-18T17:00',status:'Заплановано'},
  {id:'past',starts_at:'2026-11-13T17:00',status:'Заплановано'},
  {id:'near',starts_at:'2026-11-14T19:00',status:'Погоджено'},
  {id:'cancelled',starts_at:'2026-11-14T18:00',status:'Скасовано'},
  {id:'far',starts_at:'2026-12-01T10:00',status:'Погоджено'}
 ];
 const result=focus({tasks:[],events,notifications:[],userId:'mine',nowLocal:'2026-11-14T12:00'});
 assert.deepEqual(Array.from(result.events,x=>x.id),['near','later']);
 assert.equal(events[0].id,'later','Source event order is unchanged');
});

test('v15.5 unread preview sorts newest first and keeps the real total',()=>{
 const notifications=[
  {id:'read',read_at:'2026-11-14T10:00',created_at:'2026-11-14T10:00'},
  {id:'old',read_at:null,created_at:'2026-11-12T12:00'},
  {id:'new',read_at:null,created_at:'2026-11-14T11:00'},
  {id:'middle',read_at:null,created_at:'2026-11-13T11:00'}
 ];
 const result=focus({tasks:[],events:[],notifications,userId:'mine',nowLocal:'2026-11-14T12:00'});
 assert.equal(result.unreadCount,3);
 assert.deepEqual(Array.from(result.notifications,x=>x.id),['new','middle']);
 assert.equal(notifications[0].id,'read');
});

test('v15.5 overview integrates actual record opens and the existing notification control',()=>{
 const overview=app.slice(end,app.indexOf('function memberStatusLabel',end));
 assert.match(overview,/focus=overviewFocusItems\(\{tasks,events,notifications:state\.notifications/);
 assert.match(overview,/gr-overview-focus-grid/);
 assert.match(overview,/data-action="view-record" data-module="tasks"/);
 assert.match(overview,/data-action="view-record" data-module="events"/);
 assert.match(overview,/data-action="notifications"/);
 assert.match(overview,/esc\(x\.title\)/);
 assert.match(overview,/focusPanel\+/);
 assert.match(css,/\.gr-overview-focus-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1050px\)/);
 assert.match(css,/\.gr-focus-item \.btn\{min-height:44px\}/);
});
