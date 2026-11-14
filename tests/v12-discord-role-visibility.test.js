import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discordMentionRole} from '../worker/index.js';

const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('leader status only exposes validated role IDs, never raw webhook URLs',()=>{
 const start=worker.indexOf("if(path==='/api/discord/status'");
 const end=worker.indexOf("if(path==='/api/discord/preferences'",start);
 const section=worker.slice(start,end);
 assert.match(section,/user\.role!=='leader'/);
 assert.match(section,/roleMentions:Object\.fromEntries/);
 assert.match(section,/discordMentionRole\(env,kind\)/);
 assert.doesNotMatch(section,/env\[discordRouteSecrets/);
});
test('safe defaults keep family role for public notices but disable HR role pings',()=>{
 assert.equal(discordMentionRole({},'announcements'),'1563285390989987962');
 for(const kind of ['promotions','personnel','absences'])assert.equal(discordMentionRole({},kind),'');
 assert.equal(discordMentionRole({DISCORD_ROLE_PROMOTIONS:'123456789012345678'},'promotions'),'123456789012345678');
 assert.equal(discordMentionRole({DISCORD_ROLE_PROMOTIONS:'not-a-snowflake'},'promotions'),'');
});
test('leader settings show each route role or disabled status safely',()=>{
 const start=app.indexOf('async function settingsPage()'),end=app.indexOf('async function profile()',start);
 const section=app.slice(start,end);
 assert.match(section,/discord\.roleMentions\?\.\[kind\]\?\.enabled/);
 assert.match(section,/esc\(discord\.roleMentions\[kind\]\.role_id\)/);
 assert.match(section,/Згадка ролі/);
});
