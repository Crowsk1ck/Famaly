import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDiscordNotification} from '../worker/index.js';

const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');

test('v11.0 sends promotions only after atomic approval and rank update',()=>{
 const start=worker.indexOf("if(mod==='promotions'&&b.status==='Погоджено'){",worker.indexOf("const results=await db.batch(statements)"));
 const end=worker.indexOf('return json({ok:true});',start);
 assert.ok(start>0&&end>start);
 const section=worker.slice(start,end);
 assert.match(section,/SELECT nickname FROM users/);
 assert.match(section,/SELECT title FROM ranks/);
 assert.match(section,/queueDiscord\(ctx,db,env,'announcements'/);
 assert.match(section,/Підвищення учасника/);
});
test('v11.1 includes warning, reprimand, recognition, award and reversal without private reasons',()=>{
 assert.match(worker,/PERSONNEL_ACTION_KINDS\[kind\]/);
 const begin=worker.indexOf("if(path==='/api/personnel-actions'&&method==='POST')");
 const end=worker.indexOf("if(path==='/api/inactivity'&&method==='GET')",begin);
 const section=worker.slice(begin,end);
 assert.equal((section.match(/queueDiscord\(ctx,db,env,'announcements'/g)||[]).length,2);
 assert.ok(section.includes('Кадрове рішення · знято'));
 assert.ok(!section.includes('message:details'));
 assert.ok(!section.includes('message:reason'));
});
test('v11.2 posts only approved leave and uses existing department authorization',()=>{
 const begin=worker.indexOf("m=path.match(/^\\/api\\/absences\\/");
 const end=worker.indexOf("if(path==='/api/department-workspace'",begin);
 const section=worker.slice(begin,end);
 assert.ok(section.includes('canReviewAbsence(user,old)'));
 assert.ok(section.includes("if(decision==='Погоджено')"));
 assert.ok(section.includes("queueDiscord(ctx,db,env,'announcements'"));
 assert.ok(section.includes('ABSENCE_TYPES[parseJson(old.extra,{}).type]'));
 assert.ok(!section.includes('message:extra.review_comment'));
});
test('v11 notifications retain branded embeds and allow only configured family role ping',()=>{
 const p=buildDiscordNotification('announcements',{event:'🎖️ Підвищення учасника',message:'Учасник: Гравець'});
 assert.equal(p.content,'<@&1563285390989987962>');
 assert.deepEqual(p.allowed_mentions,{parse:[],roles:['1563285390989987962']});
 assert.equal(p.embeds[0].color,0xDC2626);
});
