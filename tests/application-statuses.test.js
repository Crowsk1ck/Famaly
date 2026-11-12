import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const begin=source.indexOf('async function applications(){');
const end=source.indexOf('async function contracts(){',begin);
assert.ok(begin>=0&&end>begin,'Recruitment screen and review modal exist');

function recruitmentScreen(items,filter=''){
  const applicationStatuses=['Очікує','Прийнято','Відхилено'];
  const state={filter,search:'',sort:'new'};
  let modalHtml='';
  const api=async path=>{
    assert.equal(path,'/applications');
    return {items};
  };
  const intro=(title,detail)=>'<h2>'+title+'</h2><p>'+detail+'</p>';
  const esc=x=>String(x??'');
  const searchBar=()=>'<input placeholder="Пошук">';
  const filterControls=values=>'<select id="status-filter">'+values.map(s=>'<option>'+s+'</option>').join('')+'</select>';
  const exportButton=()=>'<button>Експорт</button>';
  const applyFilters=rows=>rows.filter(x=>!state.filter||x.status===state.filter);
  const searchMatch=()=>true;
  const badge=s=>'<b>'+s+'</b>';
  const table=(_headers,rows)=>'<table>'+rows.join('')+'</table>';
  const date=s=>s;
  const modal=(_title,html)=>{modalHtml=html;};
  const field=(_label,_name,value)=>'<textarea>'+esc(value||'')+'</textarea>';
  const actions=new Function('api','state','applicationStatuses','intro','esc','searchBar','filterControls',
    'exportButton','applyFilters','searchMatch','badge','table','date','modal','field',
    source.slice(begin,end)+'\nreturn {applications,appReview};')(
      api,state,applicationStatuses,intro,esc,searchBar,filterControls,
      exportButton,applyFilters,searchMatch,badge,table,date,modal,field);
  return {actions,state,getModal:()=>modalHtml};
}
const fixtures=[
  {id:'a',nickname:'Очікує Гравець',game_id:'10',status:'Очікує',discord:'',experience:'',created_at:'2026-11-12',version:1,comment:'',motivation:'Тестова мотивація'},
  {id:'b',nickname:'Прийнятий Гравець',game_id:'11',status:'Прийнято',discord:'',experience:'',created_at:'2026-11-12',version:1,comment:'',motivation:'Тестова мотивація'},
  {id:'c',nickname:'Відхилений Гравець',game_id:'12',status:'Відхилено',discord:'',experience:'',created_at:'2026-11-12',version:1,comment:'',motivation:'Тестова мотивація'}
];

test('recruitment table shows the three statuses with counts and dedicated filter options',async()=>{
  const page=recruitmentScreen(fixtures);
  const html=await page.actions.applications();
  assert.ok(html.includes('Очікує: <strong>1</strong>'));
  assert.ok(html.includes('Прийнято: <strong>1</strong>'));
  assert.ok(html.includes('Відхилено: <strong>1</strong>'));
  const select=html.match(/<select id="status-filter">([\s\S]*?)<\/select>/)?.[1]||'';
  assert.deepEqual([...select.matchAll(/<option>(.*?)<\/option>/g)].map(x=>x[1]),
    ['Очікує','Прийнято','Відхилено']);
  assert.ok(!select.includes('Погоджено'));
  assert.ok(html.includes('Розглянути'));
  assert.ok(html.includes('Переглянути'));
});
test('recruitment review modal offers no unrelated task/report statuses',async()=>{
  const page=recruitmentScreen(fixtures);
  await page.actions.appReview('b');
  const html=page.getModal();
  assert.ok(html.includes('Прийнято</option>'));
  assert.ok(html.includes('Очікує</option>'));
  assert.ok(html.includes('Відхилено</option>'));
  assert.ok(!html.includes('На перевірці'));
  assert.ok(!html.includes('На доопрацювання'));
  assert.ok(!html.includes('Погоджено'));
  assert.ok(html.includes('Статус «Прийнято» не створює акаунт'));
});
test('application screen clears outdated global status filters',async()=>{
  const page=recruitmentScreen(fixtures,'Погоджено');
  const html=await page.actions.applications();
  assert.equal(page.state.filter,'');
  assert.ok(html.includes('Прийнятий Гравець'));
});
