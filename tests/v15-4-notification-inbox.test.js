import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
function extracted(name,next){
 const start=app.indexOf('function '+name+'('),end=app.indexOf('function '+next+'(',start);
 assert.ok(start>=0&&end>start,name+' function is present');
 return app.slice(start,end).trim();
}
const routeSource=extracted('notificationRoute','notificationItems');
const listSource=extracted('notificationItems','notifyPopup');

test('v15.4 notification shortcuts only use known, presently visible routes',()=>{
 const nav=[{id:'dossier'},{id:'absences'},{id:'reports'},{id:'ranks'},{id:'capt'},{id:'contracts'},{id:'finance'},{id:'applications'},{id:'members'}];
 const allowed=new Set(['dossier','absences','reports','ranks','members']);
 const route=runInNewContext('('+routeSource+')',{nav,visible:item=>allowed.has(item.id)});
 assert.equal(route({title:'Запис в особовій справі'}),'dossier');
 assert.equal(route({title:'Рішення щодо відсутності'}),'absences');
 assert.equal(route({title:'Новий тижневий звіт'}),'reports');
 assert.equal(route({title:'CAPT-виплата нарахована'}),null);
 assert.equal(route({title:'Коригування контракту'}),null);
 assert.equal(route({title:'Unknown event'}),null);
 assert.equal(route({title:'<script>alert(1)</script>'}),null);
});

test('v15.4 inbox prioritizes unread and filters read notifications',()=>{
 const state={notifications:[
  {id:'read',read_at:'2026-11-10',created_at:'2026-11-14'},
  {id:'old',read_at:null,created_at:'2026-11-11'},
  {id:'new',read_at:null,created_at:'2026-11-13'}
 ]};
 const items=runInNewContext('('+listSource+')',{state});
 assert.deepEqual(Array.from(items('all'),n=>n.id),['new','old','read']);
 assert.deepEqual(Array.from(items('unread'),n=>n.id),['new','old']);
 assert.equal(state.notifications[0].id,'read','The inbox must not mutate notification state');
});

test('v15.4 popup displays unread badge, filters and safe navigation actions',()=>{
 assert.match(app,/data-action="notifications" aria-label="Сповіщення, непрочитаних: /);
 assert.match(app,/aria-controls="notif-pop"/);
 assert.match(app,/data-action="notification-filter"/);
 assert.match(app,/data-action="read-notification"/);
 assert.match(app,/data-action="notification-open"/);
 assert.match(app,/aria-pressed=/);
 assert.match(app,/data-route-target=/);
 assert.match(app,/notification&&notificationRoute\(notification\)/);
 assert.match(app,/if\(!route\|\|route!==t\.dataset\.routeTarget\)break/);
 assert.match(app,/await navigate\(route\)/);
 assert.match(app,/await render\(\);\s*notifyPopup\(true\)/);
});

test('v15.4 mobile inbox shows scrolled items and touch-friendly navigation',()=>{
 assert.match(css,/\.gr-notif-count\{/);
 assert.match(css,/\.notif-item\.gr-notif-unread\{/);
 assert.match(css,/\.gr-notification-list\{max-height:min\(55vh,460px\);overflow-y:auto/);
 assert.match(css,/@media\(max-width:560px\)/);
 assert.match(css,/\.gr-notif-foot \.btn\{min-height:44px\}/);
});
