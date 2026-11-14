import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discordRouteDiagnostics} from '../worker/index.js';

const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const root='https://discord.com/api/webhooks/';
const hook=id=>root+id+'/'+('a'.repeat(42));

test('v11 personnel webhook routes must be individually configured and never fall back',()=>{
 const base={DISCORD_WEBHOOK_ANNOUNCEMENTS:hook('123456789012345678')};
 const missing=discordRouteDiagnostics(base);
 for(const kind of ['promotions','personnel','absences']){
  assert.equal(missing[kind].configured,false);
  assert.equal(missing[kind].reason,'missing');
 }
 const all=discordRouteDiagnostics({
  ...base,
  DISCORD_WEBHOOK_PROMOTIONS:hook('123456789012345679'),
  DISCORD_WEBHOOK_PERSONNEL:hook('123456789012345680'),
  DISCORD_WEBHOOK_ABSENCES:hook('123456789012345681')
 });
 for(const kind of ['promotions','personnel','absences'])assert.equal(all[kind].configured,true,kind);
});
test('duplicate or invalid personnel webhooks cannot masquerade as separate channels',()=>{
 const shared=hook('123456789012345678');
 const result=discordRouteDiagnostics({
  DISCORD_WEBHOOK_ANNOUNCEMENTS:shared,
  DISCORD_WEBHOOK_PROMOTIONS:shared,
  DISCORD_WEBHOOK_PERSONNEL:'https://example.com/not-a-webhook',
  DISCORD_WEBHOOK_ABSENCES:hook('123456789012345681')
 });
 assert.equal(result.promotions.reason,'duplicate');
 assert.equal(result.personnel.reason,'invalid');
 assert.equal(result.absences.configured,true);
});
test('personnel events point to distinct routes and use independent preferences',()=>{
 for(const [marker,route] of [
  ['🎖️ Підвищення учасника','promotions'],
  ['🛡️ Кадрове рішення · знято','personnel'],
  ['Погоджена відсутність · ','absences']
 ]){
  const index=worker.indexOf(marker);
  assert.ok(index>0,marker);
  assert.ok(worker.slice(index,index+450).includes("},'"+route+"');"),marker);
 }
 assert.match(worker,/queueDiscord\(ctx,db,env,'promotions'/);
 assert.match(worker,/if\(!DISCORD_PREFERENCE_KINDS\.includes\(kind\)\)return/);
});
test('leader can see and test all three dedicated destinations from settings',()=>{
 for(const name of ['DISCORD_WEBHOOK_PROMOTIONS','DISCORD_WEBHOOK_PERSONNEL','DISCORD_WEBHOOK_ABSENCES'])
  assert.ok(app.includes(name),name);
 for(const kind of ['promotions','personnel','absences'])
  assert.ok(app.includes(kind+":"),kind);
});
