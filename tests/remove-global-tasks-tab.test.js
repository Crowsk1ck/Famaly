import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');

test('standalone tasks tab is removed from the sidebar',()=>{
 const menu=app.slice(app.indexOf('const nav=['),app.indexOf('const state='));
 assert.doesNotMatch(menu,/id:'tasks',text:'Завдання'/);
 assert.match(menu,/id:'workspace',text:'Управління підрозділом'/);
});

test('department task management and API remain functional',()=>{
 assert.match(app,/capt:\['personnel','tasks','reports'/);
 assert.match(app,/case'tasks':/);
 assert.match(app,/case 'workspace-new-record'/);
 assert.match(worker,/tasks: \{manage:'tasks:manage'/);
 assert.match(worker,/\['tasks','Завдання','Робота'\]/);
});
