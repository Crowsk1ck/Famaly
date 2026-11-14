import test from 'node:test';
import assert from 'node:assert/strict';
import {sendDiscordWebhook} from '../worker/index.js';

const valid='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const env={DISCORD_WEBHOOK_ANNOUNCEMENTS:valid};

test('short HTTP 429 is retried once with the identical Discord payload',async()=>{
 const prior=globalThis.fetch;
 let calls=0;const bodies=[];
 globalThis.fetch=async(url,request)=>{
  assert.equal(url,valid);
  bodies.push(request.body);
  calls++;
  return calls===1?new Response(null,{status:429,headers:{'Retry-After':'0'}}):
    new Response(null,{status:204});
 };
 try{
  assert.equal(await sendDiscordWebhook(env,'announcements',{event:'Збір'}),true);
  assert.equal(calls,2);
  assert.equal(bodies[0],bodies[1]);
 }finally{globalThis.fetch=prior;}
});
test('long or missing Retry-After does not schedule a prolonged retry',async()=>{
 const prior=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response(null,{status:429,headers:{'Retry-After':'30'}})};
 try{
  await assert.rejects(sendDiscordWebhook(env,'announcements',{event:'Збір'}),/HTTP 429/);
  assert.equal(calls,1);
  globalThis.fetch=async()=>{calls++;return new Response(null,{status:429})};
  await assert.rejects(sendDiscordWebhook(env,'announcements',{event:'Збір'}),/HTTP 429/);
  assert.equal(calls,2);
 }finally{globalThis.fetch=prior;}
});
test('ambiguous network failures and non-429 errors are never retried',async()=>{
 const prior=globalThis.fetch;
 let calls=0;
 try{
  globalThis.fetch=async()=>{calls++;throw new Error('contains private webhook url')};
  await assert.rejects(sendDiscordWebhook(env,'announcements',{}),/Немає з’єднання з Discord/);
  assert.equal(calls,1);
  globalThis.fetch=async()=>{calls++;return new Response(null,{status:403})};
  await assert.rejects(sendDiscordWebhook(env,'announcements',{}),/HTTP 403/);
  assert.equal(calls,2);
 }finally{globalThis.fetch=prior;}
});
