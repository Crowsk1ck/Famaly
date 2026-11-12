import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const begin=source.indexOf('async function settingsPage(){');
const end=source.indexOf('async function profile(){',begin);
assert.ok(begin>=0&&end>begin,'Discord settings editor is present');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ui(discord,items=[],role='leader'){
  const state={user:{role}};
  const calls=[];
  const api=async path=>{
    calls.push(path);
    if(path==='/settings')return {items:{family_name:'GRIZZLY'},versions:{}};
    if(path==='/discord/status')return discord;
    if(path==='/discord/deliveries')return {items};
    throw Error('Unexpected API path '+path);
  };
  const intro=()=>'<section>GRIZZLY settings</section>';
  const field=(_label,name,value='')=>'<input name="'+name+'" value="'+esc(value)+'">';
  const date=v=>v||'';
  const fn=new Function('api','state','intro','field','esc','date',
    source.slice(begin,end)+'\nreturn settingsPage;')(api,state,intro,field,esc,date);
  return fn().then(html=>({html,state,calls}));
}
const ready={
  configured:true,reason:'ready',worker:'famaly',
  enabled:{applications:true,decisions:false,events:true},
  versions:{applications:2,decisions:3,events:4},
  categories:{applications:true,decisions:false,events:true},
  lockedByEnvironment:{applications:false,decisions:false,events:false},
  migrationRequired:false
};
test('leader sees persistent Discord switches and successful/failed delivery history',async()=>{
  const {html,state,calls}=await ui(ready,[
    {id:'1',kind:'applications',status:'sent',http_status:null,error_code:'',created_at:'2026-11-12'},
    {id:'2',kind:'events',status:'failed',http_status:404,error_code:'http_error',created_at:'2026-11-12'}
  ]);
  assert.ok(html.includes('id="discord-preferences-form"'));
  assert.ok(html.includes('name="applications" checked'));
  assert.ok(!html.includes('name="decisions" checked'));
  assert.ok(html.includes('name="events" checked'));
  assert.ok(html.includes('Журнал доставки'));
  assert.ok(html.includes('HTTP 404'));
  assert.ok(html.includes('Надіслано'));
  assert.ok(html.includes('Помилка'));
  assert.deepEqual(state.discordVersions,ready.versions);
  assert.deepEqual(calls,['/settings','/discord/status','/discord/deliveries']);
});
test('missing migration shows instructions instead of attempting to access nonexistent journal',async()=>{
  const {html,calls}=await ui({...ready,migrationRequired:true});
  assert.ok(!html.includes('id="discord-preferences-form"'));
  assert.ok(html.includes('0003_discord_notifications.sql'));
  assert.ok(!calls.includes('/discord/deliveries'));
});
test('environment-locked notification has disabled switch and reason',async()=>{
  const {html}=await ui({...ready,lockedByEnvironment:{applications:false,decisions:false,events:true}});
  assert.ok(html.includes('name="events" checked disabled'));
  assert.ok(html.includes('Вимкнено у змінних Cloudflare'));
});
test('non-leader cannot see Discord integration controls in settings',async()=>{
  const {html,calls}=await ui(ready,[],'member');
  assert.ok(!html.includes('id="discord-preferences-form"'));
  assert.ok(!html.includes('Журнал доставки'));
  assert.deepEqual(calls,['/settings']);
});
