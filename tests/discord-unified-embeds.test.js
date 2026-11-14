import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiscordNotification} from '../worker/index.js';

const kinds=['applications','decisions','events','capt','news','announcements','test'];
test('all supported Discord categories share GRIZZLY branding and security settings',()=>{
 for(const kind of kinds){
  const payload=buildDiscordNotification(kind,{event:'Важливе повідомлення'});
  assert.equal(payload.username,'GRIZZLY FAMILY');
  assert.deepEqual(payload.allowed_mentions,{parse:[]});
  assert.equal(payload.embeds.length,1);
  const embed=payload.embeds[0];
  assert.equal(embed.color,0xDC2626,kind);
  assert.match(embed.author.name,/GRIZZLY FAMILY/);
  assert.match(embed.footer.text,/СИЛА В ЄДНОСТІ/);
  assert.ok(embed.title.length>0);
  assert.ok(embed.description.length>0);
  assert.ok(!Number.isNaN(Date.parse(embed.timestamp)));
 }
});
test('announcements show topic and readable content without repeated headings',()=>{
 const p=buildDiscordNotification('announcements',{event:'Розподіл по підрозділах',message:'Вступіть до бажаного підрозділу.'});
 const e=p.embeds[0];
 assert.equal(e.fields.find(f=>f.name==='📌 Тема оголошення').value,'Розподіл по підрозділах');
 assert.equal(e.fields.find(f=>f.name==='📣 Повідомлення').value,'Вступіть до бажаного підрозділу.');
 assert.ok(!e.fields.some(f=>f.name==='Текст оголошення'||f.name==='Оголошення'));
});
test('long announcements stay inside Discord embed field limits',()=>{
 const p=buildDiscordNotification('announcements',{message:'Опис '.repeat(600)});
 const fields=p.embeds[0].fields;
 assert.ok(fields.length>=3);
 assert.ok(fields.every(f=>f.value.length<=1024));
 assert.ok(fields.every(f=>f.name.length<=256));
 assert.ok(fields.map(f=>f.value).join('').length>950);
});
test('user supplied mentions cannot notify users or roles',()=>{
 const p=buildDiscordNotification('announcements',{event:'@everyone <@123456789012345678>',message:'@here <@&123456789012345678>'});
 assert.deepEqual(p.allowed_mentions,{parse:[]});
 const serialized=JSON.stringify(p);
 assert.ok(!serialized.includes('@everyone'));
 assert.ok(!serialized.includes('@here'));
 assert.ok(!serialized.includes('<@&'));
 assert.ok(!serialized.includes('<@123'));
});
