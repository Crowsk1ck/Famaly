import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('v15.2 mobile drawer provides semantic open and close controls',()=>{
 assert.match(app,/id="gr-panel-navigation"/);
 assert.match(app,/aria-controls="gr-panel-navigation"/);
 assert.match(app,/aria-expanded="false"/);
 assert.match(app,/data-action="close-menu" aria-label="Закрити меню"/);
 assert.match(app,/case 'toggle-menu':\{/);
 assert.match(app,/case 'close-menu':\{/);
 assert.match(app,/button\?\.setAttribute\('aria-expanded',String\(open\)\)/);
 assert.match(app,/event\.key!=='Escape'/);
 assert.match(app,/shell\.classList\.remove\('menu-open'\)/);
});
test('v15.2 drawer backdrop is pointer guarded and only visible when open',()=>{
 assert.match(css,/\.gr-menu-scrim\{display:none\}/);
 assert.match(css,/\.gr-menu-scrim\{display:block;position:fixed;inset:0;z-index:59;opacity:0;visibility:hidden;pointer-events:none/);
 assert.match(css,/\.shell\.menu-open \.gr-menu-scrim\{opacity:1;visibility:visible;pointer-events:auto/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('v15.2 search input is mobile-friendly and clearing resets pagination',()=>{
 assert.match(app,/function searchBar\(\)\{return `<input id="search-input" type="search"/);
 assert.match(app,/data-action="members-clear-search"/);
 assert.match(app,/case 'members-clear-search':\{/);
 assert.match(app,/state\.search='';state\.membersPage=1/);
 assert.match(app,/let memberSearchTimer=null/);
 assert.match(app,/clearTimeout\(memberSearchTimer\)/);
 assert.match(app,/\},220\)/);
 assert.match(app,/if\(state\.route!==route\)return/);
 assert.match(css,/\.gr-member-searchbar #search-input\{flex-basis:100%;max-width:none;min-height:44px\}/);
});
test('v15.2 large member lists preserve pagination and readable touch cards',()=>{
 assert.match(app,/const memberPage=pageSlice\(list,state\.membersPage\|\|1\)/);
 assert.match(app,/pageControls\(memberPage,'members-page'\)/);
 assert.match(app,/member-mobile-card/);
 assert.match(css,/\.member-mobile-card \.btn\{min-height:44px;white-space:normal\}/);
});
