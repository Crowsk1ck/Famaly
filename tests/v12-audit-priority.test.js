import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discordMentionRole,buildDiscordNotification} from '../worker/index.js';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const nav=app.slice(app.indexOf('const nav=['),app.indexOf('];',app.indexOf('const nav=['))+2);
const overview=app.slice(app.indexOf('async function overview()'),app.indexOf('function memberStatusLabel',app.indexOf('async function overview()')));

test('v12 navigation preserves all existing module routes, reordered into practical groups',()=>{
 const expected=['overview','members','dossier','activity','inactivity','departments','workspace','leadership',
  'capt','contracts','fleet','events','reports','ranks','absences','applications','discipline',
  'announcements','finance','gallery','public_news','public_team','public_achievements','public_calendar',
  'stats','audit','settings','profile'];
 for(const name of expected)assert.ok(nav.includes("id:'"+name+"'"),name);
 assert.equal((nav.match(/id:'/g)||[]).length,expected.length);
 for(const group of ['ГОЛОВНЕ','ПІДРОЗДІЛИ','ОПЕРАЦІЇ','КЕРІВНИЦТВО','ПУБЛІЧНИЙ САЙТ','СИСТЕМА'])
  assert.ok(nav.includes("group:'"+group+"'"),group);
 assert.match(app,/nav\.filter\(visible\)/);
});
test('v12 overview brings important decisions forward without writing any financial records',()=>{
 assert.match(overview,/needsAttention=\[/);
 assert.match(overview,/Прострочені завдання/);
 assert.match(overview,/Звіти очікують перевірки/);
 assert.match(overview,/Учасники без підрозділу/);
 assert.match(overview,/attentionPanel\+/);
 assert.doesNotMatch(overview,/api\([^\n]*'POST'/);
});
test('v12 does not ping entire family for personnel alerts by default',()=>{
 const env={};
 for(const kind of ['promotions','personnel','absences']){
  const role=discordMentionRole(env,kind);
  assert.equal(role,'',kind);
  const payload=buildDiscordNotification('announcements',{event:'Кадрова зміна'},role);
  assert.equal(payload.content,undefined);
  assert.deepEqual(payload.allowed_mentions,{parse:[]});
 }
 assert.equal(discordMentionRole(env,'announcements'),'1563285390989987962');
});
test('v12 opt-in channel-specific roles are validated; malformed IDs are never pinged',()=>{
 const env={DISCORD_ROLE_PERSONNEL:'1563285390989987962',DISCORD_ROLE_PROMOTIONS:'not-a-role',
  DISCORD_ROLE_ABSENCES:'',DISCORD_ROLE_ANNOUNCEMENTS:'123456789012345678'};
 assert.equal(discordMentionRole(env,'personnel'),'1563285390989987962');
 assert.equal(discordMentionRole(env,'promotions'),'');
 assert.equal(discordMentionRole(env,'absences'),'');
 assert.equal(discordMentionRole(env,'announcements'),'123456789012345678');
 const payload=buildDiscordNotification('announcements',{event:'Тест'},discordMentionRole(env,'announcements'));
 assert.deepEqual(payload.allowed_mentions,{parse:[],roles:['123456789012345678']});
 assert.equal(payload.content,'<@&123456789012345678>');
});
