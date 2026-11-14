import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const overview=app.slice(app.indexOf('async function overview()'),app.indexOf('function memberStatusLabel',app.indexOf('async function overview()')));

test('overview v4 fetches trends only with finance permissions and audit only for leader',()=>{
 assert.match(overview,/mayViewFinance=can\('finance:read'\)\|\|can\('finance:manage'\)/);
 assert.match(overview,/mayViewFinance\?api\('\/finance\/trends\?period='/);
 assert.match(overview,/state\.user\?\.role==='leader'\?api\('\/audit'\)/);
 assert.match(overview,/const auditOverview=leader\?/);
 assert.match(overview,/const financeOverview=mayViewFinance\?/);
});

test('overview v4 supports controlled 7 and 30 day periods without changing payouts',()=>{
 assert.match(overview,/state\.overviewTrendPeriod==='30'\?'30':'7'/);
 assert.match(overview,/data-action="overview-trend-period"/);
 assert.match(app,/case 'overview-trend-period':state\.overviewTrendPeriod=t\.dataset\.value==='30'\?'30':'7';await render\(\);break;/);
 assert.doesNotMatch(overview,/api\([^\n]*'POST'/);
});

test('overview v4 summarizes settled departmental contracts and actual recorded activity',()=>{
 assert.match(overview,/if\(!contract\.settled_at\|\|!contract\.department_id\)continue/);
 assert.match(overview,/settledByDepartment\.get\(d\.id\)/);
 assert.match(overview,/auditItems=\(auditData\?\.items\|\|\[\]\)\.slice\(0,6\)/);
 assert.match(overview,/esc\(x\.actor_name\|\|'Користувач'\)/);
 assert.match(overview,/esc\(String\(x\.detail\|\|''\)\.slice\(0,110\)\)/);
});

test('overview v4 compact CSS is scoped to dashboard and mobile sizes',()=>{
 assert.match(overview,/gr-overview-v4/);
 assert.match(css,/\.gr-overview-v4 \.empty\{/);
 assert.match(css,/@media\(max-width:680px\)/);
});
