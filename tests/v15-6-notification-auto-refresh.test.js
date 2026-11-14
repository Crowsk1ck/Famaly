import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const start=app.indexOf('const NOTIFICATION_POLL_MS=60000;');
const end=app.indexOf('function table(headers,rows){',start);
assert.ok(start>=0&&end>start,'Notification refresh module must exist');
const moduleSource=app.slice(start,end);

function makeHarness(fetcher=async()=>({items:[]})){
 let timestamp=100000,timers=0,cancelled=0,requests=0,signouts=0;
 const state={user:{id:'member-1'},route:'overview',notifications:[]};
 const document={
  hidden:false,
  querySelector:()=>null,
  addEventListener(name,callback){if(name==='visibilitychange')this.onVisibilityChange=callback;}
 };
 const runtime=runInNewContext(moduleSource+'\n({startNotificationPolling,stopNotificationPolling,pollNotifications,refreshNotificationWidgets,getPending:()=>notificationPollPending})',{
  state,document,
  api:async path=>{assert.equal(path,'/notifications');requests++;return fetcher();},
  Date:{now:()=>timestamp},
  setInterval:()=>{timers++;return timers;},
  clearInterval:()=>{cancelled++;},
  notificationItems:filter=>state.notifications.filter(x=>filter!=='unread'||!x.read_at),
  notifyPopup:()=>{},
  fmt:n=>String(n),
  renderPublic:()=>{signouts++;},
  toast:()=>{}
 });
 return {state,document,runtime,advance:ms=>{timestamp+=ms;},
  counts:()=>({timers,cancelled,requests,signouts})};
}

test('v15.6 starts one poller and updates unread state without rerendering',async()=>{
 const h=makeHarness(async()=>({items:[{id:'new-message',read_at:null,title:'Завдання'}]}));
 h.runtime.startNotificationPolling();
 h.runtime.startNotificationPolling();
 assert.equal(h.counts().timers,1,'Multiple page renders must reuse one timer');
 await h.runtime.pollNotifications();
 assert.equal(h.counts().requests,1);
 assert.equal(h.state.notifications[0].id,'new-message');
 await h.runtime.pollNotifications();
 assert.equal(h.counts().requests,1,'Short-interval calls must be rate limited');
 h.advance(60000);
 await h.runtime.pollNotifications();
 assert.equal(h.counts().requests,2);
 h.runtime.stopNotificationPolling();
 assert.equal(h.counts().cancelled,1);
});

test('v15.6 hidden tabs do not poll and visibility restore refreshes once',async()=>{
 const h=makeHarness(async()=>({items:[]}));
 h.runtime.startNotificationPolling();
 h.document.hidden=true;
 await h.runtime.pollNotifications();
 assert.equal(h.counts().requests,0);
 h.document.hidden=false;
 h.document.onVisibilityChange();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.counts().requests,1);
 h.runtime.stopNotificationPolling();
});

test('v15.6 overlapping requests and stale responses after logout are ignored',async()=>{
 let resolve;
 const deferred=new Promise(done=>{resolve=done;});
 const h=makeHarness(()=>deferred);
 h.runtime.startNotificationPolling();
 const first=h.runtime.pollNotifications();
 h.advance(60000);
 await h.runtime.pollNotifications();
 assert.equal(h.counts().requests,1,'Only one notification fetch can be in flight');
 h.runtime.stopNotificationPolling();
 h.state.user=null;
 resolve({items:[{id:'stale',read_at:null}]});
 await first;
 assert.equal(h.state.notifications.length,0,'Post-logout response must not revive old notifications');
 assert.equal(h.runtime.getPending(),null);
});

test('v15.6 expired sessions stop background activity without exposing old data',async()=>{
 const h=makeHarness(async()=>{throw Object.assign(new Error('Expired'),{status:401});});
 h.runtime.startNotificationPolling();
 await h.runtime.pollNotifications();
 assert.equal(h.state.user,null);
 assert.deepEqual(h.state.notifications,[]);
 assert.equal(h.counts().cancelled,1);
 assert.equal(h.counts().signouts,1);
 h.advance(60000);
 await h.runtime.pollNotifications();
 assert.equal(h.counts().requests,1,'Expired sessions must not keep polling');
});

test('v15.6 UI refresh is scoped and does not redraw the whole application',()=>{
 assert.match(app,/function refreshNotificationWidgets\(\)/);
 assert.match(app,/querySelector\('\[data-action="notifications"\]'\)/);
 assert.match(app,/querySelector\('\.gr-overview-notifications'\)/);
 assert.match(app,/querySelector\('\.gr-overview-notification-preview'\)/);
 assert.match(app,/preview\.replaceChildren\(\.\.\.nodes\)/);
 assert.match(app,/popup\.querySelector\('\.gr-notification-list'\)/);
 assert.match(app,/document\.hidden/);
 assert.match(app,/notificationMutationVersion\+\+/);
 assert.match(app,/case 'logout':await api\('\/auth\/logout','POST'\);stopNotificationPolling\(\)/);
 assert.match(app,/case 'password-form':await api\('\/auth\/password','POST',b\);stopNotificationPolling\(\)/);
 assert.match(app,/function renderPublic\(\)\{\s*stopNotificationPolling\(\)/);
 assert.match(css,/\.gr-overview-notification-preview\{display:flex;flex-direction:column/);
});
