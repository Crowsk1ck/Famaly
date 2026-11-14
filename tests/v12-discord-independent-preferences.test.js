import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDiscordNotification,discordMentionRole} from '../worker/index.js';

const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('v12 independent personnel notification kinds are identified and enabled separately',()=>{
 for(const k of ['promotions','personnel','absences']){
  assert.match(worker,new RegExp("discord_notify_'\\+k"));
  assert.ok(worker.includes('DISCORD_PERSONNEL_KINDS'));
  assert.ok(worker.includes('DISCORD_PREFERENCE_KINDS'));
  assert.ok(app.includes("'"+k+"'"),k);
 }
 assert.match(worker,/migrationRequired:DISCORD_NOTIFY_KINDS\.some/);
 assert.match(worker,/INSERT OR IGNORE INTO settings\(key,value,updated_at\)/);
});

test('v12 has distinct titles, privacy controls and no public-role ping for personnel alerts',()=>{
 const map={
  promotions:'Підвищення',
  personnel:'Дисципліна',
  absences:'Відпустки'
 };
 for(const [kind,title] of Object.entries(map)){
  const payload=buildDiscordNotification(kind,{event:'Статус',message:'Перевірене кадрове рішення'},discordMentionRole({},kind));
  assert.match(payload.embeds[0].title,new RegExp(title));
  assert.equal(payload.content,undefined);
  assert.deepEqual(payload.allowed_mentions,{parse:[]});
  assert.equal(payload.embeds[0].fields.find(x=>x.name==='📣 Повідомлення').value,'Перевірене кадрове рішення');
 }
});

test('v12 enabled categories include dedicated routes without rewriting financial or contract modules',()=>{
 const sections=[
  ["Кадрове рішення · знято","personnel"],
  ["🎖️ Підвищення учасника","promotions"],
  ["🏖️ Погоджена відсутність","absences"]
 ];
 for(const [marker,kind] of sections){
  const pos=worker.indexOf(marker);
  assert.ok(pos>=0,kind);
  assert.ok(worker.slice(Math.max(0,pos-90),pos).includes("'"+kind+"'"),kind);
 }
 assert.match(worker,/DISCORD_PREFERENCE_KINDS\.includes\(kind\)/);
});
