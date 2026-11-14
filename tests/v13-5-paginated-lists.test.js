import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const a=source.indexOf('function pageSlice('),b=source.indexOf('function searchBar()',a);
assert.ok(a>=0&&b>a);
const {pageSlice,pageControls}=new Function('esc',source.slice(a,b)+'\nreturn {pageSlice,pageControls};')(String);
test('pages have exactly 25 rows and clamp stale page values',()=>{
 const rows=Array.from({length:77},(_,i)=>({id:i}));
 assert.deepEqual(pageSlice(rows,1).items.map(x=>x.id),Array.from({length:25},(_,i)=>i));
 assert.equal(pageSlice(rows,2).items[0].id,25);
 assert.equal(pageSlice(rows,4).items.length,2);
 assert.equal(pageSlice(rows,999).page,4);
 assert.equal(pageSlice([],99).page,1);
 assert.equal(pageSlice([],1).total,0);
});
test('pager exposes accessible navigation and disabled limits',()=>{
 const first=pageControls(pageSlice(Array.from({length:26},(_,i)=>i),1),'members-page');
 assert.match(first,/aria-label="Сторінки списку"/);
 assert.match(first,/data-action="members-page"/);
 assert.match(first,/disabled/);
 const last=pageControls(pageSlice(Array.from({length:26},(_,i)=>i),2),'audit-page');
 assert.match(last,/data-action="audit-page"/);
 assert.match(last,/Далі →<\/button>/);
 assert.equal(pageControls(pageSlice([1],1),'audit-page'),'');
});
test('member table and mobile cards only render currently visible page',()=>{
 const start=source.indexOf('async function members()');
 const end=source.indexOf('function viewMember(',start);
 const section=source.slice(start,end);
 assert.match(section,/const memberPage=pageSlice\(list,state\.membersPage\|\|1\)/);
 assert.match(section,/tableRows=memberPage\.items\.map/);
 assert.match(section,/mobileCards=memberPage\.items\.map/);
 assert.match(section,/pageControls\(memberPage,'members-page'\)/);
});
test('audit table paginates after search; search resets old page',()=>{
 const start=source.indexOf('async function auditPage()'),end=source.indexOf('async function settingsPage()',start);
 const section=source.slice(start,end);
 assert.match(section,/filtered=all\.filter/);
 assert.match(section,/pageSlice\(filtered,state\.auditPage\|\|1\)/);
 assert.match(section,/pageControls\(page,'audit-page'\)/);
 assert.match(source,/state\.membersPage=1;state\.auditPage=1;state\.search=e\.target\.value/);
 assert.match(css,/\.gr-list-pages/);
});
