import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('every GRIZZLY department gets a focused navigation menu',()=>{
 const start=app.indexOf('const workspaceDepartmentSections='),end=app.indexOf('function workspaceTabs(',start);
 assert.ok(start>=0&&end>start);
 const source=app.slice(start,end);
 for(const id of ['capt','farm','fleet','discipline','recruitment','events'])assert.match(source,new RegExp('\\b'+id+':\\['));
 assert.match(source,/capt:\['personnel','tasks','reports','capt_matches','capt_training','capt_attendance'/);
 assert.match(source,/fleet:\['personnel','vehicles','vehicle_loans'/);
 assert.doesNotMatch(source,/fleet:\[[^\n]*capt_matches/);
 assert.doesNotMatch(source,/capt:\[[^\n]*vehicles/);
});

test('workspace section and fallback are limited to focused tabs',()=>{
 assert.match(app,/const focusedSections=workspaceTabs\(dept\.id,allSections\)/);
 assert.match(app,/const active=focusedSections\.find\(x=>x\.id===id\)\|\|focusedSections\[0\]/);
 assert.match(app,/const buttons=focusedSections\.map\(x=>/);
 assert.match(app,/state\.workspaceSection='personnel'/);
});

test('workspace dashboard has four aligned cards and no tall scrolling side panel',()=>{
 assert.match(app,/const stats=\[\['Активні учасники'/);
 assert.match(css,/\.gr-workspace-stats\{\s*display:grid!important;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/\.gr-workspace-nav\{max-height:none;overflow:visible/);
 assert.match(css,/@media\(max-width:1050px\)/);
});
