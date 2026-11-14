import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker,{discordOutboxDecision} from '../worker/index.js';

const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const wrangler=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
const migration=readFileSync(new URL('../migrations/0008_discord_outbox.sql',import.meta.url),'utf8');

test('only confirmed Discord HTTP 429 is retried; network uncertainty is quarantined',()=>{
 assert.deepEqual(discordOutboxDecision(null,1),{status:'sent',delaySeconds:0,code:''});
 assert.deepEqual(discordOutboxDecision(new Error('Discord обмежив частоту запитів (HTTP 429)'),1),
  {status:'pending',delaySeconds:30,code:'http_error'});
 assert.deepEqual(discordOutboxDecision(new Error('Discord обмежив частоту запитів (HTTP 429)'),2),
  {status:'pending',delaySeconds:60,code:'http_error'});
 assert.equal(discordOutboxDecision(new Error('Discord обмежив частоту запитів (HTTP 429)'),3).status,'failed');
 assert.equal(discordOutboxDecision(new Error('Немає з’єднання з Discord'),1).status,'uncertain');
 assert.equal(discordOutboxDecision(new Error('Discord відхилив токен webhook (HTTP 401)'),1).status,'failed');
});
test('outbox stays disabled unless explicitly opted in following migration',async()=>{
 assert.equal(typeof worker.scheduled,'function');
 let called=false;
 await worker.scheduled({}, {DB:{prepare(){called=true;throw Error('should not run')}}},{});
 assert.equal(called,false);
 assert.match(source,/env\.DISCORD_OUTBOX_ENABLED==='true'/);
 assert.match(wrangler,/crons = \["\*\/2 \* \* \* \*"\]/);
});
test('outbox claims jobs atomically and quarantines expired sending leases',()=>{
 assert.match(source,/UPDATE discord_outbox SET status='sending',attempts=attempts\+1/);
 assert.match(source,/WHERE id=\? AND status='pending' AND available_at<=\?/);
 assert.match(source,/UPDATE discord_outbox SET status='uncertain'/);
 assert.match(source,/claim\.meta\?\.changes!==1/);
 assert.match(source,/recordDiscordDelivery/);
});
test('outbox migration stores only bounded delivery state without credentials',()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS discord_outbox/);
 assert.match(migration,/CHECK\(status IN \('pending','sending','sent','failed','uncertain'\)\)/);
 assert.match(migration,/CREATE INDEX IF NOT EXISTS idx_discord_outbox_pending/);
 assert.doesNotMatch(migration,/webhook_url|token|password|ledger|payout/i);
});
