import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
test('navigation groups are accessible and preserve role-filtered links',()=>{
 const nav=js.slice(js.indexOf('function sidebar(){'),js.indexOf('function shell(',js.indexOf('function sidebar(){')));
 assert.match(nav,/nav\.filter\(visible\)/);
 assert.match(nav,/aria-expanded/);
 assert.match(nav,/data-action="nav-group-toggle"/);
 assert.match(nav,/data-route/);
 assert.match(nav,/activeGroup/);
 assert.match(nav,/COMPACT_NAV_GROUPS/);
});
test('expanded active group remains visible and compact groups are reversible',()=>{
 assert.match(js,/group!==activeGroup&&Boolean/);
 assert.match(js,/COMPACT_NAV_GROUPS=\['ПУБЛІЧНИЙ САЙТ','СИСТЕМА'\]/);
 assert.match(js,/case 'nav-group-toggle'/);
 assert.match(js,/state\.navCollapsed=/);
 assert.match(css,/\.sideitem\.gr-nav-hidden\{display:none\}/);
 assert.match(css,/\.gr-nav-group-toggle:focus-visible/);
});
