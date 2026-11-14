import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.js';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const backend=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const deploy=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
const backup=readFileSync(new URL('../.github/workflows/d1-private-backup.yml',import.meta.url),'utf8');
const wrangler=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');

test('public SEO pages have stable canonical metadata without authenticated data',async()=>{
 const env={ASSETS:{fetch:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})}};
 const response=await worker.fetch(new Request('https://grizzly-family.online/about/'),env,{});
 assert.equal(response.status,200);
 const body=await response.text();
 assert.match(body,/<title>Історія та напрямки/);
 assert.match(body,/https:\/\/grizzly-family\.online\/about\//);
 assert.match(body,/ІСТОРІЯ GRIZZLY/);
 assert.doesNotMatch(body,/password_hash|grizzly_session|CLOUDFLARE_API_TOKEN/);
});

test('public paths preserve legacy hash routes and never expose private SPA routes',()=>{
 assert.match(app,/const grPublicPaths=/);
 assert.match(app,/function publicPageFromHash\(hash\)/);
 assert.match(app,/grPublicRoutes\[path\]/);
 assert.doesNotMatch(app,/grPublicPaths=\{[^}]*\/finance\//);
});

test('timezone and task deadline helpers exist without modifying payout calculations',()=>{
 assert.match(app,/timeZone:'Europe\/Kyiv'/);
 assert.match(app,/function kyivDueStatus/);
 assert.match(app,/overdueTasks/);
 assert.match(app,/mod==='tasks'&&x\.ends_at/);
 assert.match(backend,/Некоректна календарна дата/);
});

test('activity leaderboard is gated to server-authorized stats readers',()=>{
 assert.match(app,/can\('stats:read'\)\?api\('\/stats'\)/);
 assert.match(backend,/if\(!can\(user,'stats:read'\)\)return \[\]/);
 assert.match(backend,/user\.role!=='head'\|\|\(!e\.department_id\|\|e\.department_id===user\.department_id\)/);
});

test('public gallery sorting only uses fields in the public whitelist',()=>{
 assert.match(app,/state\.gallerySort==='name'/);
 assert.match(app,/id==='gr-gallery-sort'/);
 assert.match(backend,/evidence:r\.evidence,created_at:r\.created_at,extra:/);
});

test('deployment always runs tests and never applies remote D1 migrations',()=>{
 assert.match(deploy,/npm test/);
 assert.match(deploy,/wrangler deploy/);
 assert.match(deploy,/grizzly-production-deploy/);
 assert.doesNotMatch(deploy,/migrations apply/);
});

test('backups are encrypted and never uploaded as public actions artifacts',()=>{
 assert.match(backup,/openssl enc -aes-256-cbc/);
 assert.match(backup,/GRIZZLY_BACKUP_PASSPHRASE/);
 assert.match(backup,/r2\.cloudflarestorage\.com/);
 assert.doesNotMatch(backup,/actions\/upload-artifact/);
});

test('dedicated SEO routes are intercepted before SPA fallback',()=>{
 for(const route of ['about','news','gallery','achievements','calendar','join'])assert.ok(wrangler.includes('/'+route+'/*'));
 assert.match(app,/history\.replaceState\(history\.state,'','\/'\+url\.search\+url\.hash\)/);
});

test('SEO route is handled by Worker before assets with no-cache response',async()=>{
 assert.match(wrangler,/run_worker_first\s*=\s*true/);
 const env={ASSETS:{fetch:async()=>new Response(html,{headers:{'Content-Type':'text/html'}})}};
 const res=await worker.fetch(new Request('https://grizzly-family.online/about/'),env,{});
 assert.equal(res.status,200);
 assert.equal(res.headers.get('X-Grizzly-Seo-Route'),'/about/');
 assert.equal(res.headers.get('Cache-Control'),'no-store');
 const page=await res.text();
 assert.match(page,/<h1>ІСТОРІЯ GRIZZLY<\/h1>/);
 assert.match(page,/id="modal-root"/);
 assert.match(page,/id="toast-root"/);
});
