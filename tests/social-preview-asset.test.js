import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {readFileSync} from 'node:fs';

const png=readFileSync(new URL('../public/grizzly-social-v2.png',import.meta.url));
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);

test('versioned Discord social-preview is a committed PNG asset, not an SPA fallback',()=>{
 assert.ok(png.subarray(0,8).equals(pngSignature));
 assert.ok(png.length>1000);
});

test('preview route falls back to legacy PNG when assets return HTML for the versioned URL',async()=>{
 const fetched=[];
 const env={ASSETS:{fetch:async req=>{
  const path=new URL(req.url).pathname;
  fetched.push(path);
  return path==='/grizzly-social-v2.png'?
   new Response('<!doctype html>',{headers:{'Content-Type':'text/html'}}):
   new Response(png,{headers:{'Content-Type':'image/png'}});
 }}};
 const res=await worker.fetch(new Request('https://grizzly-family.online/grizzly-social-v2.png'),env,{});
 assert.equal(res.status,200);
 assert.match(res.headers.get('Content-Type'),/image\/png/);
 assert.deepEqual(fetched,['/grizzly-social-v2.png','/grizzly-social.png']);
 assert.ok(Buffer.from(await res.arrayBuffer()).subarray(0,8).equals(pngSignature));
});

test('preview route reports an error rather than HTTP 200 HTML when PNG assets are missing',async()=>{
 const env={ASSETS:{fetch:async()=>new Response('<!doctype html>',{headers:{'Content-Type':'text/html'}})}};
 const res=await worker.fetch(new Request('https://grizzly-family.online/grizzly-social-v2.png'),env,{});
 assert.equal(res.status,503);
 assert.match(await res.text(),/preview unavailable/);
});
