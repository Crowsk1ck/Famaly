import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const a=source.indexOf('function dossierCareerReview(');
const b=source.indexOf('async function dossierPage()',a);
assert.ok(a>0&&b>a,'career helper is present');
const dossierCareerReview=new Function('rankChecklist',source.slice(a,b)+'\nreturn dossierCareerReview;')
 (r=>JSON.parse(r.checklist||'[]'));

const ranks=[
 {id:2,title:'Стажер',checklist:JSON.stringify(['2 завдання','1 звіт']),requirements:'Підтвердити виконання'},
 {id:3,title:'Свій',checklist:'[]'}
];
const today=Date.parse('2026-11-14T12:00:00Z');
const subject={
 person:{id:'u1',rank_id:2},
 actions:[
  {id:'w',kind:'warning',status:'Чинне',created_at:'2026-10-25T09:00:00Z',title:'Попередження'},
  {id:'r',kind:'reprimand',status:'Знято',created_at:'2026-09-01T09:00:00Z'},
  {id:'a',kind:'award',status:'Чинне',created_at:'2026-10-20T09:00:00Z'},
  {id:'fresh',kind:'reprimand',status:'Чинне',created_at:'2026-11-13T09:00:00Z'}
 ],
 latest_records:[
  {id:'p',module:'promotions',title:'Підвищення',status:'На перевірці'},
  {id:'t',module:'tasks',title:'Доручення'}
 ]
};
test('career summary uses real rank checklist but never assumes it is completed',()=>{
 const result=dossierCareerReview(subject,ranks,today);
 assert.equal(result.current.title,'Стажер');
 assert.equal(result.next.title,'Свій');
 assert.deepEqual(result.checklist,['2 завдання','1 звіт']);
 assert.equal(result.requests.length,1);
 assert.equal(result.requests[0].status,'На перевірці');
});
test('only active warnings and reprimands count; 14-day marker is advisory',()=>{
 const result=dossierCareerReview(subject,ranks,today);
 assert.deepEqual(result.sanctions.map(x=>x.id),['w','fresh']);
 assert.equal(result.review_count,1);
 assert.equal(result.sanctions[0].review_suggested,true);
 assert.equal(result.sanctions[1].review_suggested,false);
 assert.equal(subject.actions[0].status,'Чинне');
});
test('missing dates never trigger fake overdue warnings, and top rank has no next rank',()=>{
 const top=dossierCareerReview({person:{rank_id:15},actions:[{kind:'warning',status:'Чинне',created_at:null}]},ranks,today);
 assert.equal(top.highest,true);
 assert.equal(top.next,undefined);
 assert.equal(top.sanctions[0].days_active,null);
 assert.equal(top.review_count,0);
});
test('UI is within existing authorized dossier, read-only and responsive',()=>{
 const start=source.indexOf('async function dossierPage()'),end=source.indexOf('async function activityPage()',start);
 const view=source.slice(start,end);
 assert.match(source,/async function loadAuthorizedDossier\(requestedId\)/);
 assert.match(source,/api\(path\(requestedId\)\)/);
 assert.match(view,/loadAuthorizedDossier\(state\.dossierUser\|\|state\.user\.id\)/);
 assert.match(view,/dossierCareerReview\(x,state\.ranks\)/);
 assert.match(view,/Кар’єра та кадровий контроль/);
 assert.match(view,/Історія заявок на підвищення/);
 assert.match(view,/не строк автоматичного зняття догани/);
 assert.doesNotMatch(view,/api\([^\n]+,'PATCH'/);
 assert.match(css,/\.gr-dossier-career-grid/);
 assert.match(css,/@media\(max-width:560px\)/);
});
