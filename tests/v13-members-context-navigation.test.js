import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('members, dossiers and activity share contextual navigation without removing any route',()=>{
 assert.match(js,/MEMBER_CONTEXT_ROUTES=\['members','dossier','activity','inactivity'\]/);
 assert.match(js,/function memberContextTabs\(active\)/);
 assert.match(js,/MEMBER_CONTEXT_ROUTES\.includes\(state\.route\)/);
 for(const name of ['members','dossier','activity','inactivity'])
  assert.match(js,new RegExp("case'"+name+"':content="));
});
test('context links use same permission filtering as sidebar and identify active page',()=>{
 const section=js.slice(js.indexOf('function memberContextTabs('),js.indexOf('async function render(){'));
 assert.match(section,/nav\.filter\(visible\)/);
 assert.match(section,/aria-current="page"/);
 assert.match(section,/data-route/);
 assert.match(section,/aria-label="Розділи учасників"/);
});
test('responsive member links have visible keyboard focus',()=>{
 assert.match(css,/\.gr-member-context-link:focus-visible/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(css,/\.gr-member-context-link\.is-active/);
});
