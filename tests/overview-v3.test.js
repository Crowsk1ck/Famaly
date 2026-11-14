import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const overview=app.slice(app.indexOf('async function overview()'),app.indexOf('function memberStatusLabel',app.indexOf('async function overview()')));

test('overview v3 uses authenticated existing contract and roster data',()=>{
 assert.match(overview,/api\('\/contracts'\)/);
 assert.match(overview,/state\.roster/);
 assert.match(overview,/recentContracts=\[\.\.\.contracts\]/);
 assert.match(overview,/recentMembers=\[\.\.\.state\.roster\]/);
});

test('overview v3 contract and member detail actions reuse existing handlers',()=>{
 assert.match(overview,/data-action="view-contract"/);
 assert.match(overview,/data-action="view-member"/);
 assert.match(overview,/data-route="contracts"/);
 assert.match(overview,/data-route="members"/);
});

test('overview v3 formats user-controlled text safely and keeps finance operations read-only',()=>{
 assert.match(overview,/esc\(x\.title\)/);
 assert.match(overview,/esc\(x\.nickname\|\|'Учасник'\)/);
 assert.match(overview,/esc\(x\.id\)/);
 assert.doesNotMatch(overview,/api\([^\n]*'POST'/);
});

test('overview v3 counts only active unassigned members and settled contracts',()=>{
 assert.match(overview,/activeMembers=state\.roster\.filter\(x=>x\.status==='active'\)/);
 assert.match(overview,/unassignedMembers=activeMembers\.filter/);
 assert.match(overview,/completedContracts=contracts\.filter\(x=>!!x\.settled_at\)/);
});
