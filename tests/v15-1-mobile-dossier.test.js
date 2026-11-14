import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const dossier=app.slice(app.indexOf('async function dossierPage()'),app.indexOf('async function activityPage()'));

test('v15.1 mobile dossier timeline provides explicit field labels for each table cell',()=>{
 for(const label of ['Дата','Тип','Подія','Статус']){
  assert.ok(dossier.includes('data-label="'+label+'"'),'Timeline label '+label);
 }
 assert.match(dossier,/gr-dossier-timeline/);
 assert.match(dossier,/dossierTimeline\(x\)/);
 assert.match(dossier,/pageControls\(timelinePage,'dossier-timeline-page'\)/);
});

test('v15.1 disciplinary decision cards label all fields without changing action permission',()=>{
 for(const label of ['Рішення','Причина','Статус','Дата','Дія']){
  assert.ok(dossier.includes('data-label="'+label+'"'),'Disciplinary field '+label);
 }
 assert.match(dossier,/gr-dossier-actions/);
 assert.match(dossier,/x\.can_manage&&a\.status==='Чинне'/);
 assert.match(dossier,/data-action="resolve-personnel-action"/);
});

test('v15.1 stacked cards are scoped to dossier timeline and discipline on narrow screens',()=>{
 assert.match(css,/@media\(max-width:600px\)\{/);
 assert.match(css,/\.gr-dossier-timeline tr,\.gr-dossier-actions tr\{display:block/);
 assert.match(css,/\.gr-dossier-timeline td::before,\.gr-dossier-actions td::before\{content:attr\(data-label\)/);
 assert.match(css,/\.gr-dossier-timeline thead,\.gr-dossier-actions thead\{position:absolute/);
 assert.match(css,/\.gr-dossier-timeline td,\.gr-dossier-actions td\{display:grid/);
 assert.match(css,/\.gr-dossier-actions td \.btn\{min-height:42px/);
 assert.match(css,/\.gr-dossier-filters label\{min-width:0/);
 assert.match(css,/@media\(max-width:380px\)/);
});

test('v15.1 leadership buttons are full-width touch targets only on mobile',()=>{
 assert.match(app,/data-action="leadership-open-department"/);
 assert.match(css,/\.gr-leader-footer\{align-items:stretch;flex-direction:column\}/);
 assert.match(css,/\.gr-leader-footer \.btn\{width:100%;min-height:44px/);
 assert.match(css,/\.gr-leader-metric span\{min-width:0;overflow-wrap:anywhere\}/);
});
