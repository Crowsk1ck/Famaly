import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const section=src.slice(src.indexOf('async function overview()'),src.indexOf('function memberStatusLabel',src.indexOf('async function overview()')));

test('Discord health queries execute only for leaders and do not break overview on API errors',()=>{
 assert.match(section,/state\.user\?\.role==='leader'\?api\('\/discord\/status'\)\.catch\(\(\)=>null\)/);
 assert.match(section,/state\.user\?\.role==='leader'\?api\('\/discord\/deliveries'\)\.catch\(\(\)=>null\)/);
 assert.match(section,/const discordOverview=leader\?/);
});
test('leader overview surfaces unconfigured routes and failed deliveries without webhook credentials',()=>{
 assert.match(section,/discordMissing=Object\.entries\(discordRoutes\)/);
 assert.match(section,/discordErrors=\(discordLogs\?\.items\|\|\[\]\)/);
 assert.match(section,/Discord · стан сповіщень/);
 assert.match(section,/discordOverview\+/);
 assert.doesNotMatch(section,/DISCORD_WEBHOOK_ANNOUNCEMENTS|CLOUDFLARE_API_TOKEN/);
});
