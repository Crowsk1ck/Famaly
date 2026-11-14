import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const begin=source.indexOf('function dossierTimeline(');
const end=source.indexOf('async function dossierPage()',begin);
assert.ok(begin>0&&end>begin);
const {dossierTimeline,filterDossierTimeline}=new Function(source.slice(begin,end)+'\nreturn {dossierTimeline,filterDossierTimeline};')();
const sample={
 actions:[{id:'a',created_at:'2026-11-12T10:00:00Z',title:'Догана',details:'Причина',status:'Чинне'}],
 latest_records:[
  {id:'p',module:'promotions',created_at:'2026-11-13T08:00:00Z',title:'Підвищення',status:'Погоджено'},
  {id:'t',module:'tasks',created_at:'2026-11-11T08:00:00Z',title:'Виконане завдання',status:'Завершено'},
  {id:'r',module:'reports',created_at:'2026-11-10T08:00:00Z',title:'Рапорт',status:'Погоджено'},
  {id:'c',module:'capt_training',created_at:'2026-11-09T08:00:00Z',title:'Тренування',status:'Завершено'}],
 absences:[{id:'v',created_at:'2026-11-08T08:00:00Z',title:'Відпустка',status:'Погоджено'}],
 history:[{action:'update',detail:'Зміна рангу',created_at:'2026-11-14T08:00:00Z'}]
};
test('timeline combines authorized events across all requested types in descending date order',()=>{
 const events=dossierTimeline(sample);
 assert.equal(events.length,7);
 assert.deepEqual(events.map(x=>x.category),['change','promotion','personnel','task','report','capt','absence']);
 assert.equal(events.find(x=>x.category==='personnel').detail,'Причина');
});
test('timeline filters by category and inclusive local date without changing original data',()=>{
 const events=dossierTimeline(sample);
 assert.equal(filterDossierTimeline(events,{type:'promotion'}).length,1);
 assert.equal(filterDossierTimeline(events,{from:'2026-11-12',to:'2026-11-13'}).length,2);
 assert.equal(filterDossierTimeline(events,{type:'capt',from:'2026-11-10'}).length,0);
 assert.equal(events.length,7);
});
test('timeline includes no records beyond the authorized dossier response',()=>{
 assert.deepEqual(dossierTimeline({actions:[],latest_records:[],absences:[],history:[]}),[]);
 const section=source.slice(source.indexOf('async function dossierPage()'),source.indexOf('async function activityPage()'));
 assert.match(section,/dossierTimeline\(x\)/);
 assert.match(section,/pageSlice\(timelineFiltered,state\.dossierTimelinePage\|\|1,20\)/);
 assert.match(section,/pageControls\(timelinePage,'dossier-timeline-page'\)/);
 assert.match(section,/Єдина хронологія учасника/);
 assert.match(section,/esc\(event\.detail\)/);
 assert.match(source,/state\.dossierTimelinePage=1;void render\(\)/);
});
