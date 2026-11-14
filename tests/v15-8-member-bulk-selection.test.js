import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const begin=app.indexOf('function selectedMemberRows(');
const midway=app.indexOf('function syncMembersBulkUi(){',begin);
const end=app.indexOf('function memberStatusLabel(',midway);
assert.ok(begin>=0&&midway>begin&&end>midway);
const helpers=runInNewContext(app.slice(begin,midway)+
 '\n({selectedMemberRows,selectedMembersCsv})',{
 Set,memberStatusLabel:status=>status==='active'?'Активний':status==='blocked'?'Заблокований':status||'—'
});

test('v15.8 selected rows include only IDs from the already authorized roster',()=>{
 const roster=[
  {id:'one',nickname:'One',role:'member'},
  {id:'two',nickname:'Two',role:'member'},
  {id:'three',nickname:'Three',role:'head'}
 ];
 const rows=helpers.selectedMemberRows(roster,['three','missing','one','three']);
 assert.deepEqual(Array.from(rows,x=>x.id),['one','three']);
 assert.equal(roster.length,3);
 assert.deepEqual(Array.from(helpers.selectedMemberRows(roster,[])),[]);
});

test('v15.8 CSV export excludes credentials and neutralizes spreadsheet formulas',()=>{
 const rows=[
  {id:'one',nickname:'=HYPERLINK("https://example.org","click")',game_id:'-4',role:'member',
   rank_id:1,department_id:'farm',status:'active',joined_at:'2026-11-14'},
  {id:'two',nickname:'  +SUM(1,2)',game_id:'42',role:'head',
   rank_id:2,department_id:'capt',status:'blocked',joined_at:'2026-11-13'}
 ];
 const csv=helpers.selectedMembersCsv(rows,{member:'Учасник',head:'Керівник'},
  value=>'Ранг '+value,value=>'Відділ '+value);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.match(csv,/Нікнейм;|Нікнейм"/);
 assert.ok(csv.includes("'=HYPERLINK("));
 assert.ok(csv.includes("'-4"));
 assert.ok(csv.includes("'  +SUM(1,2)"));
 assert.ok(csv.includes('Учасник'));
 assert.ok(csv.includes('Заблокований'));
 assert.equal(csv.includes('password'),false);
 assert.equal(csv.includes('token'),false);
 assert.equal(csv.split('\r\n').length,3);
});

test('v15.8 partial page selection and duplicate desktop/mobile inputs stay synchronized',()=>{
 const page={checked:false,indeterminate:false};
 const inputs=[{value:'one',checked:false},{value:'two',checked:false},{value:'two',checked:false}];
 const count={textContent:''};
 const buttons=[{disabled:true},{disabled:true},{disabled:true}];
 const document={
  getElementById:id=>id==='members-select-page'?page:id==='members-selected-count'?count:null,
  querySelectorAll:selector=>selector==='[data-member-select]'?inputs:
    selector==='[data-members-bulk],[data-action="members-bulk-clear"]'?buttons:[]
 };
 const state={route:'members',membersSelectedIds:['two']};
 const sync=runInNewContext('('+app.slice(midway,end).trim()+')',{Set,Array,document,state});
 sync();
 assert.equal(page.checked,false);
 assert.equal(page.indeterminate,true);
 assert.deepEqual(inputs.map(x=>x.checked),[false,true,true]);
 assert.equal(count.textContent,'1 вибрано');
 assert.ok(buttons.every(x=>x.disabled===false));
 state.membersSelectedIds=['one','two'];
 sync();
 assert.equal(page.checked,true);
 assert.equal(page.indeterminate,false);
 state.membersSelectedIds=[];
 sync();
 assert.equal(page.checked,false);
 assert.ok(buttons.every(x=>x.disabled===true));
});

test('v15.8 interface supports accessible page selection and read-only batch operations',()=>{
 const start=app.indexOf('async function members(){'),end=app.indexOf('function viewMember(',start);
 const part=app.slice(start,end);
 assert.match(part,/members-select-page/);
 assert.match(part,/data-member-select/);
 assert.match(part,/data-action="members-bulk-copy"/);
 assert.match(part,/can\('members:read'\)\?'<button type="button" class="btn tiny secondary" data-members-bulk data-action="members-bulk-csv"/);
 assert.match(part,/pageControls\(memberPage,'members-page'\)/);
 assert.match(app,/case 'members-bulk-csv':\{\s*if\(!can\('members:read'\)\)/);
 assert.match(app,/case 'members-bulk-copy'/);
 assert.match(app,/selectedMemberRows\(state\.roster,state\.membersSelectedIds\)/);
 assert.match(app,/state\.membersSelectedIds=\[\];state\.search=''/);
 assert.match(app,/state\.membersSelectedIds=\[\];state\.route='overview'/);
 assert.match(css,/\.gr-member-bulk-bar\{display:flex/);
 assert.match(css,/@media\(max-width:720px\)/);
});
