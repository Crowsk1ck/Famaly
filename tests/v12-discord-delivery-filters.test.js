import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discordDeliveryView} from '../worker/index.js';

const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const section=worker.slice(worker.indexOf("if(path==='/api/discord/deliveries'"),worker.indexOf("if(path==='/api/discord/test'"));
const settings=app.slice(app.indexOf('async function settingsPage(){'),app.indexOf('async function profile(){',app.indexOf('async function settingsPage(){')));

test('leader-only filtered Discord log endpoint validates kind and delivery status',()=>{
 assert.match(section,/user\.role!=='leader'/);
 assert.match(section,/DISCORD_LOG_ROUTE_KINDS\.has\(kindFilter\)/);
 assert.match(section,/\['all','sent','failed'\]/);
 assert.match(section,/LIMIT 300/);
 assert.match(section,/matching\.slice\(0,100\)/);
 assert.match(section,/has_more/);
});
test('filtering uses sanitized stored route labels rather than raw webhook tokens',()=>{
 const rows=[
  {kind:'announcements',status:'failed',error_code:'route:personnel|http_error'},
  {kind:'announcements',status:'sent',error_code:'route:promotions|'},
  {kind:'events',status:'sent',error_code:''}
 ].map(discordDeliveryView);
 assert.equal(rows.filter(x=>x.kind==='personnel'&&x.status==='failed').length,1);
 assert.equal(rows.filter(x=>x.kind==='promotions'&&x.status==='sent').length,1);
 assert.ok(!section.includes('webhook.trim()'));
});
test('settings UI offers independent route/status filters and successful/failed counts',()=>{
 assert.match(settings,/discord-log-kind/);
 assert.match(settings,/discord-log-status/);
 assert.match(settings,/discordLogTotals\.failed/);
 assert.match(settings,/discord\/deliveries\?kind=/);
 assert.match(app,/document\.addEventListener\('change',async event=>/);
});
