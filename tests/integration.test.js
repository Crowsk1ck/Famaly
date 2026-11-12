import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import worker,{payoutPreview,hashPassword,verifyPassword,validDiscordWebhookUrl,discordWebhookDiagnostic,buildDiscordNotification} from '../worker/index.js';

const dir=mkdtempSync(join(tmpdir(),'grizzly-test-'));
const file=join(dir,'local.sqlite');
const schema=['0001_init.sql','0002_capt_signups.sql','0003_discord_notifications.sql','0004_discord_capt_news.sql','0005_discord_announcements.sql','0006_application_statuses.sql'].map(file=>readFileSync(resolve('migrations',file),'utf8')).join('\n');
const child=spawn('python',['-u',resolve('tests/db_adapter.py')]);let pending=[],buf='';child.stdout.on('data',d=>{buf+=d.toString();let idx;while((idx=buf.indexOf('\n'))>=0){const line=buf.slice(0,idx);buf=buf.slice(idx+1);const {resolve:res,reject:rej}=pending.shift();const obj=JSON.parse(line);if(obj.error)rej(new Error(obj.error));else res(obj);}});
function python(payload){return new Promise((res,rej)=>{pending.push({resolve:res,reject:rej});child.stdin.write(JSON.stringify({file,...payload})+'\n');});}
await python({init:schema});
class DB {
  prepare(sql){const obj={sql,params:[],bind(...params){this.params=params;return this;},async run(){return (await python({statements:[{sql:this.sql,params:this.params}]})).items[0];},async first(){return (await this.all()).results[0]||null;},async all(){return (await python({statements:[{sql:this.sql,params:this.params}]})).items[0];}};return obj;}
  async batch(statements){return (await python({statements:statements.map(x=>({sql:x.sql,params:x.params})),transaction:true})).items;}
}
const DB1=new DB(), env={DB:DB1,BOOTSTRAP_TOKEN:'f6c5c0d3c923707c3fbf105103e943a12f533e8'};
async function req(path,{method='GET',data,token,headers={},ctx}={}){const h={'x-grizzly-client':'1',...headers};if(data!==undefined)h['content-type']='application/json';if(token)h.cookie=`grizzly_session=${token}`;const r=await worker.fetch(new Request('https://grizzly.example'+path,{method,headers:h,body:data===undefined?undefined:JSON.stringify(data)}),env,ctx);const out=await r.json();return {status:r.status,data:out,cookie:r.headers.get('set-cookie'),header:r.headers};}
let leader,member,memberId,reportId,contractId,contractVersion;
test('passwords are hashed with PBKDF2 and verified',async()=>{const h=await hashPassword('longsecure_password123');assert.ok(h.startsWith('pbkdf2-sha256$100000$'));assert.ok(await verifyPassword('longsecure_password123',h));assert.ok(!(await verifyPassword('wrong-password',h)));});
test('public home has no financial/private data',async()=>{const r=await req('/api/public');assert.equal(r.status,200);assert.equal(r.data.settings.family_name,'GRIZZLY');assert.equal(r.data.settings.treasury_percent,undefined);assert.deepEqual(r.data.gallery,[]);});
test('bootstrap requires secret and creates first leader once',async()=>{const b={username:'grizzlyadmin',password:'admin-unique-123456',nickname:'Grizzly Owner'};assert.equal((await req('/api/setup/bootstrap',{method:'POST',data:b})).status,403);const a=await req('/api/setup/bootstrap',{method:'POST',data:b,headers:{'x-bootstrap-token':env.BOOTSTRAP_TOKEN}});assert.equal(a.status,201);const again=await req('/api/setup/bootstrap',{method:'POST',data:b,headers:{'x-bootstrap-token':env.BOOTSTRAP_TOKEN}});assert.equal(again.status,409);});
test('login, session and role separation',async()=>{const bad=await req('/api/auth/login',{method:'POST',data:{username:'grizzlyadmin',password:'wrong'}});assert.equal(bad.status,401);const a=await req('/api/auth/login',{method:'POST',data:{username:'grizzlyadmin',password:'admin-unique-123456'}});assert.equal(a.status,200);leader=a.cookie.match(/grizzly_session=([a-f0-9]+)/)[1];assert.match(a.cookie,/HttpOnly/);assert.match(a.cookie,/SameSite=Strict/);assert.match(a.cookie,/Secure/);const no=(await req('/api/users')).status;assert.equal(no,401);const me=await req('/api/auth/me',{token:leader});assert.equal(me.data.user.role,'leader');assert.notEqual(me.data.user.password_hash,'admin-unique-123456');});
test('leader creates member, who only accesses own account',async()=>{const a=await req('/api/users',{method:'POST',token:leader,data:{username:'fighter',password:'member-pass-123456',nickname:'Fighter',game_id:'99',role:'member',rank_id:1,department_id:'capt'}});assert.equal(a.status,201,JSON.stringify(a.data));memberId=a.data.item.id;const b=await req('/api/auth/login',{method:'POST',data:{username:'fighter',password:'member-pass-123456'}});assert.equal(b.status,200);member=b.cookie.match(/grizzly_session=([a-f0-9]+)/)[1];const list=await req('/api/users',{token:member});assert.equal(list.data.items.length,1);assert.equal(list.data.items[0].id,memberId);assert.equal((await req('/api/audit',{token:member})).status,403);});
test('leader can safely apply Grizzly rank presets without overwriting custom ranks',async()=>{
  const unauth=await req('/api/ranks/apply-templates',{method:'POST',data:{expected:[{id:1,version:1}]}});assert.equal(unauth.status,401);
  const denied=await req('/api/ranks/apply-templates',{method:'POST',token:member,data:{expected:[{id:1,version:1}]}});assert.equal(denied.status,403);
  const before=await req('/api/ranks',{token:leader});assert.equal(before.data.items.length,15);assert.equal(before.data.templates.length,15);
  const expected=before.data.items.map(({id,version})=>({id,version}));
  const applied=await req('/api/ranks/apply-templates',{method:'POST',token:leader,data:{expected}});assert.equal(applied.status,200,JSON.stringify(applied.data));assert.equal(applied.data.updated,15);
  const after=await req('/api/ranks',{token:leader});assert.equal(after.data.items[0].title,'Новачок');assert.equal(after.data.items[14].title,'Лідер');assert.ok(JSON.parse(after.data.items[0].checklist).length>=2);
  const again=await req('/api/ranks/apply-templates',{method:'POST',token:leader,data:{expected}});assert.equal(again.status,409);
  const custom=await req('/api/ranks/1',{method:'PATCH',token:leader,data:{title:'Почесний новачок',requirements:'Затверджені умови',checklist:['Один пункт'],version:after.data.items[0].version}});assert.equal(custom.status,200);
  const forbidden=await req('/api/ranks/apply-templates',{method:'POST',token:leader,data:{expected:[{id:1,version:after.data.items[0].version+1}]}});assert.equal(forbidden.status,409);
  const protectedRank=await req('/api/ranks',{token:leader});assert.equal(protectedRank.data.items[0].title,'Почесний новачок');assert.equal(protectedRank.data.items[0].is_example,0);
});
test('member submits report with ImgBB evidence; approval only by leader',async()=>{const a=await req('/api/records/reports',{method:'POST',token:member,data:{title:'Звіт за патрулювання',details:'Виконано завдання',evidence:['https://ibb.co/abcDEF1'],status:'Погоджено'}});assert.equal(a.status,201,JSON.stringify(a.data));reportId=a.data.item.id;assert.equal(a.data.item.status,'На перевірці');const deny=await req(`/api/records/reports/${reportId}/review`,{method:'POST',token:member,data:{status:'Погоджено',version:1}});assert.equal(deny.status,403);const edit=await req(`/api/records/reports/${reportId}`,{method:'PATCH',token:member,data:{version:1,title:'Оновлений звіт',details:'Готовий',evidence:['https://i.ibb.co/xyz123/pic.jpg']}});assert.equal(edit.status,200);const stale=await req(`/api/records/reports/${reportId}`,{method:'PATCH',token:member,data:{version:1,title:'Старий запис'}});assert.equal(stale.status,409);const good=await req(`/api/records/reports/${reportId}/review`,{method:'POST',token:leader,data:{status:'Погоджено',comment:'Прийнято',version:2}});assert.equal(good.status,200,JSON.stringify(good.data));const result=(await req('/api/records/reports',{token:member})).data.items[0];assert.equal(result.status,'Погоджено');assert.equal(result.extra.review_comment,'Прийнято');});
test('contract calculation, atomic settlement and no duplicate payment',async()=>{const c=await req('/api/contracts',{method:'POST',token:leader,data:{title:'RP контракт',details:'Перевезення',amount:1001,treasury_percent:20,participant_ids:[memberId],status:'Заплановано'}});assert.equal(c.status,201,JSON.stringify(c.data));contractId=c.data.item.id;assert.equal((await req('/api/contracts',{token:member})).data.items.length,1);const p=await req(`/api/contracts/${contractId}/preview`,{token:member});assert.equal(p.data.preview.treasury,200);assert.equal(p.data.preview.per_member,801);const edit=await req(`/api/contracts/${contractId}`,{method:'PATCH',token:leader,data:{version:1,status:'Погоджено'}});assert.equal(edit.status,200);const paid=await req(`/api/contracts/${contractId}/settle`,{method:'POST',token:leader,data:{version:2}});assert.equal(paid.status,200,JSON.stringify(paid.data));assert.equal(paid.data.preview.per_member,801);const dup=await req(`/api/contracts/${contractId}/settle`,{method:'POST',token:leader,data:{version:2}});assert.equal(dup.status,409);const fin=await req('/api/finance',{token:member});assert.equal(fin.data.own_total,801);assert.equal(fin.data.own_payouts.length,1);const finance=(await req('/api/finance',{token:leader})).data;assert.equal(finance.treasury_balance,200);assert.equal(finance.payout_count,1);});
test('database persists after new D1 adapter instance',async()=>{env.DB=new DB();const a=await req('/api/finance',{token:member});assert.equal(a.data.own_total,801);const r=await req('/api/records/reports',{token:member});assert.equal(r.data.items[0].status,'Погоджено');env.DB=DB1;});
test('event RSVP, prohibited links, CSRF and export permissions',async()=>{const ev=await req('/api/records/events',{method:'POST',token:leader,data:{title:'Загальні збори',starts_at:'2026-12-01T19:00'}});assert.equal(ev.status,201);const yes=await req(`/api/rsvp/${ev.data.item.id}`,{method:'POST',token:member,data:{response:'Так'}});assert.equal(yes.status,200);const rs=await req(`/api/rsvp/${ev.data.item.id}`,{token:leader});assert.equal(rs.data.counts.yes,1);const link=await req('/api/records/reports',{method:'POST',token:member,data:{title:'Bad',evidence:['https://evil.example/foo']}});assert.equal(link.status,400);const csrf=await req('/api/auth/logout',{method:'POST',token:member,headers:{origin:'https://evil.example'}});assert.equal(csrf.status,403);const exp=await req('/api/export?module=users',{token:member});assert.equal(exp.data.items.length,1);assert.equal(exp.data.items[0].password_hash,undefined);});
test('member requests promotion; approved request updates game rank atomically',async()=>{const pr=await req('/api/records/promotions',{method:'POST',token:member,data:{title:'Заявка на ранг 2',details:'Чекліст виконано',extra:{requested_rank_id:'2',checklist_completed:['Патрулювання','Тренування']},evidence:['https://ibb.co/abcDEF1']}});assert.equal(pr.status,201,JSON.stringify(pr.data));assert.equal(pr.data.item.status,'На перевірці');const bypass=await req(`/api/records/promotions/${pr.data.item.id}`,{method:'PATCH',token:leader,data:{version:1,status:'Погоджено'}});assert.equal(bypass.status,400);const ok=await req(`/api/records/promotions/${pr.data.item.id}/review`,{method:'POST',token:leader,data:{version:1,status:'Погоджено',comment:'Умови виконано'}});assert.equal(ok.status,200,JSON.stringify(ok.data));const u=(await req('/api/auth/me',{token:member})).data.user;assert.equal(u.rank_id,2);});
test('CAPT rate payout is credited only once to recipient',async()=>{const a=await req('/api/records/capt_attendance',{method:'POST',token:member,data:{title:'CAPT тренування / бій',extra:{attendance_type:'battle'}}});assert.equal(a.status,201);const rec=a.data.item;const r=await req(`/api/records/capt_attendance/${rec.id}`,{method:'PATCH',token:leader,data:{version:1,status:'Погоджено'}});assert.equal(r.status,200);const payout=await req(`/api/capt-pay/${rec.id}`,{method:'POST',token:leader});assert.equal(payout.status,200,JSON.stringify(payout.data));assert.equal(payout.data.amount,200000);const duplicate=await req(`/api/capt-pay/${rec.id}`,{method:'POST',token:leader});assert.equal(duplicate.status,409);const f=(await req('/api/finance',{token:member})).data;assert.equal(f.own_total,200801);});
test('CAPT overview respects permissions, existing records and payout status',async()=>{
  const anonymous=await req('/api/capt/overview');
  assert.equal(anonymous.status,401);
  const leaderView=await req('/api/capt/overview',{token:leader});
  assert.equal(leaderView.status,200,JSON.stringify(leaderView.data));
  assert.equal(leaderView.data.rates.battle,200000);
  assert.equal(leaderView.data.rates.afk,100000);
  assert.equal(leaderView.data.attendance.length,1);
  assert.equal(leaderView.data.attendance[0].paid,true);
  assert.equal(leaderView.data.attendance[0].paid_amount,200000);
  const memberView=await req('/api/capt/overview',{token:member});
  assert.equal(memberView.status,200);
  assert.equal(memberView.data.rates,null);
  assert.equal(memberView.data.attendance.length,1);
  assert.equal(memberView.data.attendance[0].paid,true);
  assert.equal(memberView.data.attendance[0].paid_amount,200000);
  const match=await req('/api/records/capt_matches',{method:'POST',token:leader,data:{title:'RP бій, приклад',status:'Заплановано',starts_at:'2026-12-01T21:30',extra:{opponent:'Команда суперника',result:''}}});
  assert.equal(match.status,201);
  const scheduled=await req('/api/capt/overview',{token:member});
  assert.equal(scheduled.status,200);
  assert.equal(scheduled.data.matches.length,1);
  assert.equal(scheduled.data.matches[0].title,'RP бій, приклад');
});
test('CAPT match signups build a deterministic roster and prevent duplicates',async()=>{
  const created=await req('/api/records/capt_matches',{method:'POST',token:leader,data:{
    title:'CAPT registration integration test',status:'Заплановано',starts_at:'2026-12-01T20:00',
    extra:{lineup_limit:1,outcome:''}
  }});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const matchId=created.data.item.id;
  assert.equal((await req('/api/capt/matches/'+matchId+'/signups')).status,401);
  const join=await req('/api/capt/matches/'+matchId+'/signups',{method:'POST',token:member,data:{action:'join'}});
  assert.equal(join.status,200,JSON.stringify(join.data));
  assert.equal(join.data.lineup.length,1);
  assert.equal(join.data.reserve.length,0);
  assert.equal(join.data.own,true);
  assert.equal((await req('/api/capt/matches/'+matchId+'/signups',{method:'POST',token:member,data:{action:'join'}})).data.total,1);
  const reserve=await req('/api/capt/matches/'+matchId+'/signups',{method:'POST',token:leader,data:{action:'join'}});
  assert.equal(reserve.status,200);
  assert.equal(reserve.data.total,2);
  assert.equal(reserve.data.lineup.length,1);
  assert.equal(reserve.data.reserve.length,1);
  assert.equal(reserve.data.lineup[0].user_id,memberId);
  const memberRead=await req('/api/capt/matches/'+matchId+'/signups',{token:member});
  assert.equal(memberRead.data.lineup[0].user_id,memberId);
  assert.equal((await req('/api/records/capt_matches/'+matchId,{method:'PATCH',token:member,data:{version:1,extra:{outcome:'win'}}})).status,403);
  const left=await req('/api/capt/matches/'+matchId+'/signups',{method:'POST',token:member,data:{action:'leave'}});
  assert.equal(left.status,200);
  assert.equal(left.data.lineup.length,1);
  assert.equal(left.data.lineup[0].user_id,(await req('/api/auth/me',{token:leader})).data.user.id);
  const finished=await req('/api/records/capt_matches/'+matchId,{method:'PATCH',token:leader,data:{
    version:1,status:'Завершено',extra:{lineup_limit:1,outcome:'win',opponent:'Тестовий суперник',result:'1:0'}
  }});
  assert.equal(finished.status,200,JSON.stringify(finished.data));
  assert.equal((await req('/api/capt/matches/'+matchId+'/signups',{method:'POST',token:member,data:{action:'join'}})).status,409);
  const scoreboard=(await req('/api/capt/overview',{token:leader})).data.results;
  assert.equal(scoreboard.wins,1);
  assert.equal(scoreboard.losses,0);
  assert.equal(scoreboard.played,1);
  assert.equal(scoreboard.win_rate,100);
  const lost=await req('/api/records/capt_matches',{method:'POST',token:leader,data:{
    title:'Completed test match',status:'Завершено',extra:{lineup_limit:8,outcome:'loss',result:'0:2'}
  }});
  assert.equal(lost.status,201,JSON.stringify(lost.data));
  const updated=(await req('/api/capt/overview',{token:leader})).data.results;
  assert.equal(updated.wins,1);
  assert.equal(updated.losses,1);
  assert.equal(updated.played,2);
  assert.equal(updated.win_rate,50);
  const bad=await req('/api/records/capt_matches',{method:'POST',token:leader,data:{
    title:'Invalid result',extra:{lineup_limit:8,outcome:'made-up'}
  }});
  assert.equal(bad.status,400);
});
test('settings updates use all-or-nothing optimistic versions',async()=>{const first=await req('/api/settings',{token:leader});assert.equal(first.status,200);const v=first.data.versions;const success=await req('/api/settings',{method:'PATCH',token:leader,data:{tagline:'Grizzly Test Update',treasury_percent:'25',__versions:v}});assert.equal(success.status,200,JSON.stringify(success.data));const conflict=await req('/api/settings',{method:'PATCH',token:leader,data:{tagline:'Stale Attempt',treasury_percent:'40',__versions:v}});assert.equal(conflict.status,409);const after=await req('/api/settings',{token:leader});assert.equal(after.data.items.tagline,'Grizzly Test Update');assert.equal(after.data.items.treasury_percent,'25');const pub=await req('/api/public');assert.equal(pub.data.settings.tagline,'Grizzly Test Update');assert.equal(pub.data.settings.treasury_percent,undefined);});
test('payout rounding is deterministic',()=>{const p=payoutPreview(100,20,['a','b','c']);assert.equal(p.treasury,22);assert.equal(p.per_member,26);assert.equal(p.rounding_remainder,2);assert.equal(p.allocations.length,3);});
test.after(()=>{child.kill();rmSync(dir,{recursive:true,force:true});});

test('gallery publishing validates ImgBB and exposes only approved public metadata',async()=>{
  const invalid=await req('/api/records/gallery',{method:'POST',token:leader,data:{
    title:'Broken photo',evidence:['https://i.ibb.co.example.com/bad.jpg'],extra:{gallery_category:'cars'}
  }});
  assert.equal(invalid.status,400);
  const unauthorized=await req('/api/records/gallery',{method:'POST',token:member,data:{
    title:'Unauthorized',evidence:['https://i.ibb.co/test/photo.jpg'],extra:{gallery_category:'capt'}
  }});
  assert.equal(unauthorized.status,403);
  const added=await req('/api/records/gallery',{method:'POST',token:leader,data:{
    title:'GRIZZLY автопарк',details:'Реальний кадр GTA RP',status:'Заплановано',
    evidence:['https://i.ibb.co/test/car.webp'],
    extra:{gallery_category:'cars',featured:true,secret_note:'internal-only'}
  }});
  assert.equal(added.status,201,JSON.stringify(added.data));
  const id=added.data.item.id;
  let pub=await req('/api/public');
  assert.ok(!pub.data.gallery.some(item=>item.id===id));
  const published=await req('/api/records/gallery/'+id,{method:'PATCH',token:leader,data:{
    version:1,status:'Погоджено'
  }});
  assert.equal(published.status,200,JSON.stringify(published.data));
  pub=await req('/api/public');
  const photo=pub.data.gallery.find(item=>item.id===id);
  assert.ok(photo);
  assert.equal(photo.extra.gallery_category,'cars');
  assert.equal(photo.extra.featured,true);
  assert.equal(photo.extra.secret_note,undefined);
  assert.equal(photo.owner_id,undefined);
  const hidden=await req('/api/records/gallery/'+id,{method:'PATCH',token:leader,data:{
    version:2,status:'Заплановано'
  }});
  assert.equal(hidden.status,200);
  assert.equal((await req('/api/public')).data.gallery.some(item=>item.id===id),false);
  const fakeResult=await req('/api/records/gallery',{method:'POST',token:leader,data:{
    title:'Invalid category',evidence:['https://i.ibb.co/test/file.png'],extra:{gallery_category:'unknown'}
  }});
  assert.equal(fakeResult.status,400);
});

test('public news stays separate from private notices and unpublished drafts',async()=>{
  const noAuth=await req('/api/records/public_news');
  assert.equal(noAuth.status,401);
  const forbidden=await req('/api/records/public_news',{method:'POST',token:member,data:{
    title:'Нелегальна новина',details:'Не можна публікувати',status:'Погоджено'
  }});
  assert.equal(forbidden.status,403);
  const privateNotice=await req('/api/records/notices',{method:'POST',token:leader,data:{
    title:'СЛУЖБОВЕ ОГОЛОШЕННЯ',details:'Секрет сім’ї',status:'Погоджено'
  }});
  assert.equal(privateNotice.status,201);
  const draft=await req('/api/records/public_news',{method:'POST',token:leader,data:{
    title:'CAPT набір',details:'Текст публічної новини сім’ї',status:'Заплановано',
    extra:{news_category:'recruitment',featured:true,internal_note:'NEVER_PUBLIC'}
  }});
  assert.equal(draft.status,201,JSON.stringify(draft.data));
  const newsId=draft.data.item.id;
  let publicData=(await req('/api/public')).data;
  assert.equal(publicData.news.length,0);
  assert.equal(JSON.stringify(publicData).includes('СЛУЖБОВЕ ОГОЛОШЕННЯ'),false);
  const published=await req('/api/records/public_news/'+newsId,{method:'PATCH',token:leader,data:{
    version:1,status:'Погоджено'
  }});
  assert.equal(published.status,200,JSON.stringify(published.data));
  publicData=(await req('/api/public')).data;
  const post=publicData.news.find(x=>x.id===newsId);
  assert.ok(post);
  assert.equal(post.title,'CAPT набір');
  assert.equal(post.category,'recruitment');
  assert.equal(post.featured,true);
  assert.equal(post.internal_note,undefined);
  assert.equal(post.extra,undefined);
  assert.equal(post.owner_id,undefined);
  assert.equal(JSON.stringify(publicData).includes('NEVER_PUBLIC'),false);
  const hidden=await req('/api/records/public_news/'+newsId,{method:'PATCH',token:leader,data:{
    version:2,status:'Заплановано'
  }});
  assert.equal(hidden.status,200);
  publicData=(await req('/api/public')).data;
  assert.equal(publicData.news.some(x=>x.id===newsId),false);
  const invalidCategory=await req('/api/records/public_news',{method:'POST',token:leader,data:{
    title:'Invalid category',details:'Новина для тесту',extra:{news_category:'private'}
  }});
  assert.equal(invalidCategory.status,400);
  const missingText=await req('/api/records/public_news',{method:'POST',token:leader,data:{
    title:'No text',status:'Погоджено',extra:{news_category:'news'}
  }});
  assert.equal(missingText.status,400);
});


test('public leadership profiles are opt-in, permissioned and contain no account records',async()=>{
  const anonymous=await req('/api/records/public_team');
  assert.equal(anonymous.status,401);
  const forbidden=await req('/api/records/public_team',{method:'POST',token:member,data:{
    title:'Wrong person',details:'Should be rejected',extra:{position:'Лідер',sort_order:1}
  }});
  assert.equal(forbidden.status,403);
  const before=(await req('/api/public')).data;
  assert.ok(Array.isArray(before.team));
  assert.equal(before.team.length,0);
  const draft=await req('/api/records/public_team',{method:'POST',token:leader,data:{
    title:'Andrii Grizzly',details:'Лідер і засновник сім’ї',status:'Заплановано',
    evidence:['https://i.ibb.co/test/grizzly.webp'],
    extra:{position:'Лідер сім’ї',sort_order:1,private_contact:'PRIVATE_ONLY'}
  }});
  assert.equal(draft.status,201,JSON.stringify(draft.data));
  const profileId=draft.data.item.id;
  assert.equal((await req('/api/public')).data.team.some(x=>x.id===profileId),false);
  const published=await req('/api/records/public_team/'+profileId,{method:'PATCH',token:leader,data:{
    status:'Погоджено',version:1
  }});
  assert.equal(published.status,200,JSON.stringify(published.data));
  const pub=(await req('/api/public')).data;
  const profile=pub.team.find(x=>x.id===profileId);
  assert.ok(profile);
  assert.equal(profile.nickname,'Andrii Grizzly');
  assert.equal(profile.position,'Лідер сім’ї');
  assert.equal(profile.order,1);
  assert.equal(profile.photo,'https://i.ibb.co/test/grizzly.webp');
  assert.equal(profile.private_contact,undefined);
  assert.equal(profile.extra,undefined);
  assert.equal(profile.owner_id,undefined);
  assert.equal(profile.username,undefined);
  assert.ok(!JSON.stringify(pub).includes('PRIVATE_ONLY'));
  const hidden=await req('/api/records/public_team/'+profileId,{method:'PATCH',token:leader,data:{
    status:'Заплановано',version:2
  }});
  assert.equal(hidden.status,200);
  assert.equal((await req('/api/public')).data.team.some(x=>x.id===profileId),false);
  const badPosition=await req('/api/records/public_team',{method:'POST',token:leader,data:{
    title:'Missing position',details:'Public text',extra:{sort_order:3}
  }});
  assert.equal(badPosition.status,400);
  const badOrder=await req('/api/records/public_team',{method:'POST',token:leader,data:{
    title:'Invalid order',details:'Public text',extra:{position:'Заступник',sort_order:100}
  }});
  assert.equal(badOrder.status,400);
  const badPhoto=await req('/api/records/public_team',{method:'POST',token:leader,data:{
    title:'Invalid photo',details:'Public text',evidence:['https://ibb.co/example'],
    extra:{position:'CAPT керівник',sort_order:5}
  }});
  assert.equal(badPhoto.status,400);
  const withoutPhoto=await req('/api/records/public_team',{method:'POST',token:leader,data:{
    title:'Photo later',details:'Public text',status:'Погоджено',evidence:[],
    extra:{position:'Керівник CAPT',sort_order:2}
  }});
  assert.equal(withoutPhoto.status,201,JSON.stringify(withoutPhoto.data));
  const publicCard=(await req('/api/public')).data.team.find(x=>x.id===withoutPhoto.data.item.id);
  assert.equal(publicCard.photo,'');
});


test('public achievements respect publication status, dates, permissions and public field whitelist',async()=>{
  const noAuth=await req('/api/records/public_achievements');
  assert.equal(noAuth.status,401);
  const memberWrite=await req('/api/records/public_achievements',{method:'POST',token:member,data:{
    title:'Fake CAPT win',details:'Cannot publish',status:'Погоджено',
    extra:{category:'capt',achieved_on:'2026-11-12'}
  }});
  assert.equal(memberWrite.status,403);
  const before=(await req('/api/public')).data;
  assert.deepEqual(before.achievements,[]);
  const draft=await req('/api/records/public_achievements',{method:'POST',token:leader,data:{
    title:'GRIZZLY CAPT перемога',details:'Погоджений результат CAPT складу',status:'Заплановано',
    evidence:['https://i.ibb.co/test/victory.webp'],
    extra:{category:'capt',achieved_on:'2026-11-12',featured:true,private_note:'NEVER_PUBLIC'}
  }});
  assert.equal(draft.status,201,JSON.stringify(draft.data));
  const id=draft.data.item.id;
  assert.equal((await req('/api/public')).data.achievements.some(x=>x.id===id),false);
  const published=await req('/api/records/public_achievements/'+id,{method:'PATCH',token:leader,data:{
    version:1,status:'Погоджено'
  }});
  assert.equal(published.status,200,JSON.stringify(published.data));
  const publicData=(await req('/api/public')).data;
  const ach=publicData.achievements.find(x=>x.id===id);
  assert.ok(ach);
  assert.equal(ach.title,'GRIZZLY CAPT перемога');
  assert.equal(ach.description,'Погоджений результат CAPT складу');
  assert.equal(ach.category,'capt');
  assert.equal(ach.achieved_on,'2026-11-12');
  assert.equal(ach.photo,'https://i.ibb.co/test/victory.webp');
  assert.equal(ach.featured,true);
  assert.equal(ach.private_note,undefined);
  assert.equal(ach.extra,undefined);
  assert.equal(ach.owner_id,undefined);
  assert.equal(ach.assignee_id,undefined);
  assert.equal(JSON.stringify(publicData).includes('NEVER_PUBLIC'),false);
  const hidden=await req('/api/records/public_achievements/'+id,{method:'PATCH',token:leader,data:{
    version:2,status:'Заплановано'
  }});
  assert.equal(hidden.status,200);
  assert.equal((await req('/api/public')).data.achievements.some(x=>x.id===id),false);
  const badDate=await req('/api/records/public_achievements',{method:'POST',token:leader,data:{
    title:'Wrong date',details:'Invalid calendar day',
    extra:{category:'event',achieved_on:'2026-02-30'}
  }});
  assert.equal(badDate.status,400);
  const badCategory=await req('/api/records/public_achievements',{method:'POST',token:leader,data:{
    title:'Wrong category',details:'Test',
    extra:{category:'private',achieved_on:'2026-11-12'}
  }});
  assert.equal(badCategory.status,400);
  const noText=await req('/api/records/public_achievements',{method:'POST',token:leader,data:{
    title:'No details',status:'Погоджено',
    extra:{category:'award',achieved_on:'2026-11-12'}
  }});
  assert.equal(noText.status,400);
  const missingDate=await req('/api/records/public_achievements',{method:'POST',token:leader,data:{
    title:'Missing date',details:'Must not publish',status:'Погоджено',
    extra:{category:'capt'}
  }});
  assert.equal(missingDate.status,400);
  const fakeImage=await req('/api/records/public_achievements',{method:'POST',token:leader,data:{
    title:'Bad image',details:'Test',evidence:['https://ibb.co/something'],
    extra:{category:'capt',achieved_on:'2026-11-12'}
  }});
  assert.equal(fakeImage.status,400);
});

test('public calendar is opt-in and validates published events without exposing internal schedules',async()=>{
  const unauth=await req('/api/records/public_calendar');
  assert.equal(unauth.status,401);
  const blocked=await req('/api/records/public_calendar',{method:'POST',token:member,data:{
    title:'Unauthorized event',details:'Test',starts_at:'2026-12-04T18:00',
    extra:{category:'meeting',location:'Сімейний маєток'}
  }});
  assert.equal(blocked.status,403);
  const privateEvent=await req('/api/records/events',{method:'POST',token:leader,data:{
    title:'INTERNAL_ONLY_MEETING',details:'Internal schedule',starts_at:'2026-12-02T19:00',status:'Погоджено'
  }});
  assert.equal(privateEvent.status,201);
  const draft=await req('/api/records/public_calendar',{method:'POST',token:leader,data:{
    title:'GRIZZLY — спільні збори',details:'Оголошення для учасників сім’ї',status:'Заплановано',
    starts_at:'2026-12-05T19:00',ends_at:'2026-12-05T20:00',
    extra:{category:'meeting',location:'Маєток сім’ї',secret:'NEVER_PUBLIC'}
  }});
  assert.equal(draft.status,201,JSON.stringify(draft.data));
  const id=draft.data.item.id;
  let pub=await req('/api/public');
  assert.ok(!pub.data.calendar.some(e=>e.id===id));
  assert.ok(!JSON.stringify(pub.data).includes('INTERNAL_ONLY_MEETING'));
  const live=await req('/api/records/public_calendar/'+id,{method:'PATCH',token:leader,data:{
    version:1,status:'Погоджено'
  }});
  assert.equal(live.status,200,JSON.stringify(live.data));
  pub=await req('/api/public');
  const ev=pub.data.calendar.find(e=>e.id===id);
  assert.ok(ev);
  assert.equal(ev.title,'GRIZZLY — спільні збори');
  assert.equal(ev.description,'Оголошення для учасників сім’ї');
  assert.equal(ev.starts_at,'2026-12-05T19:00');
  assert.equal(ev.ends_at,'2026-12-05T20:00');
  assert.equal(ev.location,'Маєток сім’ї');
  assert.equal(ev.category,'meeting');
  assert.equal(ev.secret,undefined);
  assert.equal(ev.extra,undefined);
  assert.equal(ev.owner_id,undefined);
  assert.ok(!JSON.stringify(pub.data).includes('NEVER_PUBLIC'));
  const hidden=await req('/api/records/public_calendar/'+id,{method:'PATCH',token:leader,data:{
    version:2,status:'Заплановано'
  }});
  assert.equal(hidden.status,200);
  assert.ok(!(await req('/api/public')).data.calendar.some(e=>e.id===id));
  const invalidDay=await req('/api/records/public_calendar',{method:'POST',token:leader,data:{
    title:'Bad date',details:'Calendar invalid',starts_at:'2026-02-30T19:00',
    extra:{category:'event'}
  }});
  assert.equal(invalidDay.status,400);
  const invalidOrder=await req('/api/records/public_calendar',{method:'POST',token:leader,data:{
    title:'Bad order',details:'End before start',starts_at:'2026-12-05T19:00',ends_at:'2026-12-05T17:00',
    extra:{category:'event'}
  }});
  assert.equal(invalidOrder.status,400);
  const wrongCategory=await req('/api/records/public_calendar',{method:'POST',token:leader,data:{
    title:'Bad category',details:'Test',starts_at:'2026-12-05T19:00',extra:{category:'private'}
  }});
  assert.equal(wrongCategory.status,400);
  const noDate=await req('/api/records/public_calendar',{method:'POST',token:leader,data:{
    title:'Missing start',details:'Test',status:'Погоджено',extra:{category:'meeting'}
  }});
  assert.equal(noDate.status,400);
});

test('Discord webhook validation and formatter forbid spoofed hosts and mentions',()=>{
  const valid='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  assert.equal(validDiscordWebhookUrl(valid),true);
  assert.equal(validDiscordWebhookUrl('  '+valid+'  '),true);
  assert.equal(validDiscordWebhookUrl(valid.replace('discord.com','discordapp.com')+'/'),true);
  assert.equal(validDiscordWebhookUrl(valid.replace('discord.com','canary.discord.com')),true);
  assert.deepEqual(discordWebhookDiagnostic(valid.replace('discord.com','canary.discord.com')),{configured:true,reason:'ready'});
  assert.equal(validDiscordWebhookUrl(valid.replace('discord.com','canary.discord.com.evil.example')),false);
  assert.deepEqual(discordWebhookDiagnostic(undefined),{configured:false,reason:'missing'});
  assert.deepEqual(discordWebhookDiagnostic('not-a-webhook'),{configured:false,reason:'invalid'});
  assert.deepEqual(discordWebhookDiagnostic(valid),{configured:true,reason:'ready'});
  for(const url of [
    '',null,'http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789',
    'https://discord.com.evil.example/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789',
    'https://discord.com@evil.example/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789',
    'https://discord.com/api/webhooks/123456789012345678/abc',
    valid+'?wait=true'
  ])assert.equal(validDiscordWebhookUrl(url),false,String(url));
  const alert=buildDiscordNotification('applications',{
    nickname:'@everyone <@123456789012345678>',gameId:'99'
  });
  assert.deepEqual(alert.allowed_mentions,{parse:[]});
  assert.ok(!JSON.stringify(alert).includes('@everyone'));
  assert.ok(JSON.stringify(alert).includes('99'));
  assert.equal(alert.embeds.length,1);
  assert.ok(!JSON.stringify(alert).includes('password_hash'));
});
test('Discord settings and delivery enforce leader access and notify once per meaningful event',async()=>{
  const guest=await req('/api/discord/status');
  assert.equal(guest.status,401);
  const memberStatus=await req('/api/discord/status',{token:member});
  assert.equal(memberStatus.status,403);
  const disabled=await req('/api/discord/status',{token:leader});
  assert.equal(disabled.status,200);
  assert.equal(disabled.data.configured,false);
  assert.equal(disabled.data.reason,'missing');
  assert.equal(disabled.data.worker,'famaly');
  env.DISCORD_WEBHOOK_URL='this is not a webhook';
  const invalid=await req('/api/discord/status',{token:leader});
  assert.equal(invalid.status,200);
  assert.equal(invalid.data.reason,'invalid');
  assert.equal(invalid.data.configured,false);
  assert.ok(!JSON.stringify(invalid.data).includes('this is not a webhook'));
  const invalidTest=await req('/api/discord/test',{method:'POST',token:leader,data:{}});
  assert.equal(invalidTest.status,503);
  delete env.DISCORD_WEBHOOK_URL;
  const notConfigured=await req('/api/discord/test',{method:'POST',token:leader,data:{}});
  assert.equal(notConfigured.status,503);
  const webhook='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  env.DISCORD_WEBHOOK_URL=webhook;
  const oldFetch=globalThis.fetch;
  const sent=[];
  const pending=[];
  const ctx={waitUntil(p){pending.push(p);}};
  globalThis.fetch=async (url,init)=>{
    assert.equal(url,webhook);
    const body=JSON.parse(init.body);
    sent.push(body);
    return new Response(null,{status:204});
  };
  try{
    const status=await req('/api/discord/status',{token:leader});
    assert.equal(status.status,200);
    assert.equal(status.data.configured,true);
    assert.equal(status.data.reason,'ready');
    assert.ok(!JSON.stringify(status.data).includes(webhook));
    const forbidden=await req('/api/discord/test',{method:'POST',token:member,data:{}});
    assert.equal(forbidden.status,403);
    const testResult=await req('/api/discord/test',{method:'POST',token:leader,data:{}});
    assert.equal(testResult.status,200);
    assert.equal(sent.length,1);
    const apply=await req('/api/apply',{method:'POST',headers:{'cf-connecting-ip':'198.51.100.98'},data:{
      nickname:'@everyone Grizzly candidate',game_id:'454',discord:'PRIVATE_CONTACT',
      motivation:'PRIVATE MOTIVATION TEST TEXT',experience:'Private experience test 12345'
    },ctx});
    assert.equal(apply.status,201,JSON.stringify(apply.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,2);
    const applicant=sent[1];
    assert.ok(JSON.stringify(applicant).includes('454'));
    assert.ok(JSON.stringify(applicant).includes('Grizzly candidate'));
    assert.ok(!JSON.stringify(applicant).includes('@everyone'));
    assert.ok(!JSON.stringify(applicant).includes('PRIVATE_CONTACT'));
    assert.ok(!JSON.stringify(applicant).includes('PRIVATE MOTIVATION'));
    assert.deepEqual(applicant.allowed_mentions,{parse:[]});
    const apps=await req('/api/applications',{token:leader});
    const item=apps.data.items.find(a=>a.nickname==='@everyone Grizzly candidate');
    assert.ok(item);
    assert.equal(item.status,'Очікує');
    assert.ok(JSON.stringify(applicant).includes('Очікує'));
    const reviewed=await req('/api/applications/'+item.id,{method:'PATCH',token:leader,data:{
      status:'Прийнято',comment:'PRIVATE REVIEW COMMENT',version:item.version
    },ctx});
    assert.equal(reviewed.status,200);
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,3);
    assert.ok(JSON.stringify(sent[2]).includes('Прийнято'));
    assert.ok(!JSON.stringify(sent[2]).includes('PRIVATE REVIEW COMMENT'));
    const same=await req('/api/applications/'+item.id,{method:'PATCH',token:leader,data:{
      status:'Прийнято',comment:'Other internal comment',version:item.version+1
    },ctx});
    assert.equal(same.status,200);
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,3);
    const event=await req('/api/records/public_calendar',{method:'POST',token:leader,data:{
      title:'GRIZZLY open event',details:'Public event details',starts_at:'2026-12-09T18:30',
      status:'Погоджено',extra:{category:'event',location:'Маєток сім’ї'}
    },ctx});
    assert.equal(event.status,201,JSON.stringify(event.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,4);
    assert.ok(JSON.stringify(sent[3]).includes('GRIZZLY open event'));
    assert.ok(JSON.stringify(sent[3]).includes('18:30'));
    assert.deepEqual(sent[3].allowed_mentions,{parse:[]});
    const publicData=(await req('/api/public')).data;
    assert.ok(!JSON.stringify(publicData).includes(webhook));
    assert.ok(!JSON.stringify((await req('/api/settings',{token:leader})).data).includes(webhook));
  }finally{
    delete env.DISCORD_WEBHOOK_URL;
    globalThis.fetch=oldFetch;
  }
});

test('Discord leader preferences persist and prevent disabled alerts; delivery log records safe status only',async()=>{
  const notLogged=await req('/api/discord/deliveries');
  assert.equal(notLogged.status,401);
  const memberList=await req('/api/discord/deliveries',{token:member});
  assert.equal(memberList.status,403);
  const memberEdit=await req('/api/discord/preferences',{method:'PATCH',token:member,data:{
    enabled:{applications:false,decisions:false,events:false,capt:false,news:false,announcements:false},versions:{applications:1,decisions:1,events:1,capt:1,news:1,announcements:1}
  }});
  assert.equal(memberEdit.status,403);
  const original=(await req('/api/discord/status',{token:leader})).data;
  assert.equal(original.migrationRequired,false);
  assert.equal(original.enabled.applications,true);
  assert.equal(original.enabled.capt,true);
  assert.equal(original.enabled.news,true);
  assert.equal(original.enabled.announcements,true);
  assert.ok(original.versions.applications>=1);
  const bad=await req('/api/discord/preferences',{method:'PATCH',token:leader,data:{
    enabled:{applications:'false',decisions:true,events:true,capt:true,news:true,announcements:true},versions:original.versions
  }});
  assert.equal(bad.status,400);
  const update=await req('/api/discord/preferences',{method:'PATCH',token:leader,data:{
    enabled:{applications:false,decisions:true,events:false,capt:true,news:true,announcements:true},versions:original.versions
  }});
  assert.equal(update.status,200,JSON.stringify(update.data));
  const status=(await req('/api/discord/status',{token:leader})).data;
  assert.equal(status.categories.applications,false);
  assert.equal(status.categories.decisions,true);
  assert.equal(status.categories.events,false);
  assert.equal(status.categories.capt,true);
  assert.equal(status.categories.news,true);
  assert.equal(status.categories.announcements,true);
  assert.ok(status.versions.applications>original.versions.applications);
  const stale=await req('/api/discord/preferences',{method:'PATCH',token:leader,data:{
    enabled:{applications:true,decisions:true,events:true,capt:true,news:true,announcements:true},versions:original.versions
  }});
  assert.equal(stale.status,409);
  const webhook='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const oldFetch=globalThis.fetch;
  env.DISCORD_WEBHOOK_URL=webhook;
  const pending=[],ctx={waitUntil(p){pending.push(p);}},sent=[];
  globalThis.fetch=async(url,options)=>{sent.push(JSON.parse(options.body));return new Response(null,{status:204});};
  try{
    const before=(await req('/api/discord/deliveries',{token:leader})).data.items.length;
    const hidden=await req('/api/apply',{method:'POST',headers:{'cf-connecting-ip':'198.51.100.108'},
      data:{nickname:'Discord switch OFF',game_id:'42',motivation:'Test application must not notify while disabled'},ctx});
    assert.equal(hidden.status,201,JSON.stringify(hidden.data));
    const event=await req('/api/records/public_calendar',{method:'POST',token:leader,
      data:{title:'Hidden Discord event',details:'Test no alert when disabled',status:'Погоджено',starts_at:'2026-12-22T19:00',
        extra:{category:'event',location:'Маєток'}},ctx});
    assert.equal(event.status,201);
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,0);
    assert.equal((await req('/api/discord/deliveries',{token:leader})).data.items.length,before);
    const reenable=await req('/api/discord/preferences',{method:'PATCH',token:leader,data:{
      enabled:{applications:true,decisions:true,events:true,capt:true,news:true,announcements:true},versions:status.versions
    }});
    assert.equal(reenable.status,200,JSON.stringify(reenable.data));
    const active=await req('/api/apply',{method:'POST',headers:{'cf-connecting-ip':'198.51.100.109'},
      data:{nickname:'Discord switch ON',game_id:'43',motivation:'Test delivery success after enabled'},ctx});
    assert.equal(active.status,201,JSON.stringify(active.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,1);
    let entries=(await req('/api/discord/deliveries',{token:leader})).data.items;
    assert.equal(entries[0].kind,'applications');
    assert.equal(entries[0].status,'sent');
    assert.equal(entries[0].http_status,null);
    assert.ok(!JSON.stringify(entries).includes('Discord switch ON'));
    assert.ok(!JSON.stringify(entries).includes(webhook));
    globalThis.fetch=async()=>new Response(null,{status:404});
    const failed=await req('/api/apply',{method:'POST',headers:{'cf-connecting-ip':'198.51.100.110'},
      data:{nickname:'Discord failure test',game_id:'44',motivation:'Test delivery log on Discord 404'},ctx});
    assert.equal(failed.status,201);
    await Promise.all(pending.splice(0));
    entries=(await req('/api/discord/deliveries',{token:leader})).data.items;
    assert.equal(entries[0].kind,'applications');
    assert.equal(entries[0].status,'failed');
    assert.equal(entries[0].http_status,404);
    assert.equal(entries[0].error_code,'http_error');
    assert.ok(!JSON.stringify(entries).includes('Discord failure test'));
    assert.ok(!JSON.stringify(entries).includes(webhook));
  }finally{
    globalThis.fetch=oldFetch;
    delete env.DISCORD_WEBHOOK_URL;
  }
});


test('CAPT announcements and family news notify only on explicit public-news publication',async()=>{
  const hook='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const oldFetch=globalThis.fetch;
  const sent=[],pending=[],ctx={waitUntil(p){pending.push(p);}};
  const captHook=hook.replace('123456789012345678','223456789012345678');
  const newsHook=hook.replace('123456789012345678','323456789012345678');
  env.DISCORD_WEBHOOK_URL=hook;
  env.DISCORD_WEBHOOK_CAPT=captHook;
  env.DISCORD_WEBHOOK_NEWS=newsHook;
  const destinations=[];
  globalThis.fetch=async(url,opt)=>{destinations.push(url);sent.push(JSON.parse(opt.body));return new Response(null,{status:204});};
  try{
    const initial=(await req('/api/discord/status',{token:leader})).data;
    assert.equal(initial.migrationRequired,false);
    assert.equal(initial.categories.capt,true);
    assert.equal(initial.categories.news,true);
    const captDraft=await req('/api/records/public_news',{method:'POST',token:leader,ctx,data:{
      title:'CAPT збори <@123456789012345678>',details:'PUBLIC_CAPT_DETAILS',
      status:'Заплановано',extra:{news_category:'capt',featured:false,secret:'PRIVATE_CAPT_NOTE'}
    }});
    assert.equal(captDraft.status,201,JSON.stringify(captDraft.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,0);
    const id=captDraft.data.item.id;
    const captLive=await req('/api/records/public_news/'+id,{method:'PATCH',token:leader,ctx,data:{
      version:1,status:'Погоджено'
    }});
    assert.equal(captLive.status,200,JSON.stringify(captLive.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,1);
    assert.equal(destinations[0],captHook);
    assert.ok(sent[0].embeds[0].title.includes('CAPT'));
    assert.ok(JSON.stringify(sent[0]).includes('CAPT збори'));
    assert.ok(!JSON.stringify(sent[0]).includes('PUBLIC_CAPT_DETAILS'));
    assert.ok(!JSON.stringify(sent[0]).includes('PRIVATE_CAPT_NOTE'));
    assert.deepEqual(sent[0].allowed_mentions,{parse:[]});
    assert.ok(!JSON.stringify(sent[0]).includes('<@123456789012345678>'));
    const sameStatus=await req('/api/records/public_news/'+id,{method:'PATCH',token:leader,ctx,data:{
      version:2,status:'Погоджено',title:'CAPT збори оновлено'
    }});
    assert.equal(sameStatus.status,200,JSON.stringify(sameStatus.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,1);
    const newsPost=await req('/api/records/public_news',{method:'POST',token:leader,ctx,data:{
      title:'Сімейні новини GRIZZLY',details:'PUBLIC_NEWS_DETAILS',status:'Погоджено',
      extra:{news_category:'news',private_comment:'SECRET_NEWS_COMMENT'}
    }});
    assert.equal(newsPost.status,201,JSON.stringify(newsPost.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,2);
    assert.equal(destinations[1],newsHook);
    assert.ok(sent[1].embeds[0].title.includes('Новина'));
    assert.ok(JSON.stringify(sent[1]).includes('Сімейні новини GRIZZLY'));
    assert.ok(!JSON.stringify(sent[1]).includes('PUBLIC_NEWS_DETAILS'));
    assert.ok(!JSON.stringify(sent[1]).includes('SECRET_NEWS_COMMENT'));
    let log=(await req('/api/discord/deliveries',{token:leader})).data.items;
    assert.ok(log.some(x=>x.kind==='capt'&&x.status==='sent'));
    assert.ok(log.some(x=>x.kind==='news'&&x.status==='sent'));
    assert.ok(!JSON.stringify(log).includes('CAPT збори'));
    const toggles=await req('/api/discord/preferences',{method:'PATCH',token:leader,data:{
      enabled:{...initial.enabled,capt:false,news:false},versions:initial.versions
    }});
    assert.equal(toggles.status,200,JSON.stringify(toggles.data));
    const disabledCapt=await req('/api/records/public_news',{method:'POST',token:leader,ctx,data:{
      title:'CAPT без Discord',details:'Публічне оголошення без сповіщення',status:'Погоджено',
      extra:{news_category:'capt'}
    }});
    assert.equal(disabledCapt.status,201,JSON.stringify(disabledCapt.data));
    const disabledNews=await req('/api/records/public_news',{method:'POST',token:leader,ctx,data:{
      title:'Новина без Discord',details:'Публічний текст без сповіщення',status:'Погоджено',
      extra:{news_category:'news'}
    }});
    assert.equal(disabledNews.status,201,JSON.stringify(disabledNews.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,2);
    const restored=await req('/api/discord/preferences',{method:'PATCH',token:leader,data:{
      enabled:initial.enabled,versions:toggles.data.versions
    }});
    assert.equal(restored.status,200,JSON.stringify(restored.data));
  }finally{
    delete env.DISCORD_WEBHOOK_URL;
    delete env.DISCORD_WEBHOOK_CAPT;
    delete env.DISCORD_WEBHOOK_NEWS;
    globalThis.fetch=oldFetch;
  }
});

test('General announcements use a distinct webhook, not CAPT/news or the legacy route',async()=>{
  const base='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const own=base.replace('123456789012345678','423456789012345678');
  const capt=base.replace('123456789012345678','223456789012345678');
  const news=base.replace('123456789012345678','323456789012345678');
  const oldFetch=globalThis.fetch;
  const sent=[],pending=[],ctx={waitUntil(p){pending.push(p);}};
  env.DISCORD_WEBHOOK_URL=base;
  env.DISCORD_WEBHOOK_CAPT=capt;
  env.DISCORD_WEBHOOK_NEWS=news;
  env.DISCORD_WEBHOOK_ANNOUNCEMENTS=own;
  globalThis.fetch=async(url,opt)=>{sent.push({url,payload:JSON.parse(opt.body)});return new Response(null,{status:204});};
  try{
    const initial=(await req('/api/discord/status',{token:leader})).data;
    assert.equal(initial.migrationRequired,false);
    assert.deepEqual(initial.routes.announcements,{configured:true,reason:'ready'});
    assert.deepEqual(initial.routes.capt,{configured:true,reason:'ready'});
    assert.deepEqual(initial.routes.news,{configured:true,reason:'ready'});
    const draft=await req('/api/records/public_news',{method:'POST',token:leader,ctx,data:{
      title:'Важливе оголошення GRIZZLY',details:'Збори на маєтку о 19:00',status:'Заплановано',
      extra:{news_category:'announcement',private_note:'SECRET_NOT_FOR_DISCORD'}
    }});
    assert.equal(draft.status,201,JSON.stringify(draft.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,0);
    const published=await req('/api/records/public_news/'+draft.data.item.id,{method:'PATCH',token:leader,ctx,data:{
      version:1,status:'Погоджено'
    }});
    assert.equal(published.status,200,JSON.stringify(published.data));
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,1);
    assert.equal(sent[0].url,own);
    assert.ok(sent[0].payload.embeds[0].title.includes('Оголошення'));
    assert.ok(JSON.stringify(sent[0].payload).includes('Збори на маєтку'));
    assert.ok(!JSON.stringify(sent[0].payload).includes('SECRET_NOT_FOR_DISCORD'));
    assert.deepEqual(sent[0].payload.allowed_mentions,{parse:[]});
    const same=await req('/api/records/public_news/'+draft.data.item.id,{method:'PATCH',token:leader,ctx,data:{
      version:2,status:'Погоджено',title:'Оголошення оновлено'
    }});
    assert.equal(same.status,200);
    await Promise.all(pending.splice(0));
    assert.equal(sent.length,1);
    const logs=(await req('/api/discord/deliveries',{token:leader})).data.items;
    assert.ok(logs.some(x=>x.kind==='announcements'&&x.status==='sent'));
    assert.ok(!JSON.stringify(logs).includes('Збори на маєтку'));
    const announceTest=await req('/api/discord/test',{method:'POST',token:leader,data:{kind:'announcements'}});
    assert.equal(announceTest.status,200,JSON.stringify(announceTest.data));
    assert.equal(sent.length,2);
    assert.equal(sent[1].url,own);
    const captTest=await req('/api/discord/test',{method:'POST',token:leader,data:{kind:'capt'}});
    assert.equal(captTest.status,200,JSON.stringify(captTest.data));
    assert.equal(sent[2].url,capt);
    const newsTest=await req('/api/discord/test',{method:'POST',token:leader,data:{kind:'news'}});
    assert.equal(newsTest.status,200,JSON.stringify(newsTest.data));
    assert.equal(sent[3].url,news);
    // Duplicating a secret must not silently merge editorial channels.
    env.DISCORD_WEBHOOK_ANNOUNCEMENTS=capt;
    const duplicate=(await req('/api/discord/status',{token:leader})).data;
    assert.equal(duplicate.routes.announcements.reason,'duplicate');
    assert.equal(duplicate.routes.announcements.configured,false);
    const noSend=await req('/api/discord/test',{method:'POST',token:leader,data:{kind:'announcements'}});
    assert.equal(noSend.status,503);
    assert.equal(sent.length,4);
    // Missing separate secret does not fall back to the default URL.
    delete env.DISCORD_WEBHOOK_ANNOUNCEMENTS;
    const missing=(await req('/api/discord/status',{token:leader})).data;
    assert.equal(missing.routes.announcements.reason,'missing');
    const missTest=await req('/api/discord/test',{method:'POST',token:leader,data:{kind:'announcements'}});
    assert.equal(missTest.status,503);
    assert.equal(sent.length,4);
  }finally{
    globalThis.fetch=oldFetch;
    delete env.DISCORD_WEBHOOK_URL;
    delete env.DISCORD_WEBHOOK_CAPT;
    delete env.DISCORD_WEBHOOK_NEWS;
    delete env.DISCORD_WEBHOOK_ANNOUNCEMENTS;
  }
});

test('Recruitment applications have only three statuses, preserve legacy decisions and enforce moderator access',async()=>{
  const guest=await req('/api/applications');
  assert.equal(guest.status,401);
  const denied=await req('/api/applications',{token:member});
  assert.equal(denied.status,403);
  const apply=await req('/api/apply',{method:'POST',headers:{'cf-connecting-ip':'198.51.100.170'},data:{
    nickname:'Three status candidate',game_id:'171',motivation:'Checking recruitment status workflow'
  }});
  assert.equal(apply.status,201,JSON.stringify(apply.data));
  let items=(await req('/api/applications',{token:leader})).data.items;
  const candidate=items.find(x=>x.nickname==='Three status candidate');
  assert.ok(candidate);
  assert.equal(candidate.status,'Очікує');
  assert.equal((await DB1.prepare('SELECT status FROM applications WHERE id=?').bind(candidate.id).first()).status,'Очікує');
  const rejected=await req('/api/applications/'+candidate.id,{method:'PATCH',token:leader,data:{
    status:'Відхилено',version:candidate.version,comment:'Не відповідає вимогам'
  }});
  assert.equal(rejected.status,200,JSON.stringify(rejected.data));
  items=(await req('/api/applications',{token:leader})).data.items;
  assert.equal(items.find(x=>x.id===candidate.id).status,'Відхилено');
  const oldStatusRejected=await req('/api/applications/'+candidate.id,{method:'PATCH',token:leader,data:{
    status:'Погоджено',version:candidate.version+1
  }});
  assert.equal(oldStatusRejected.status,400);
  const anyOtherStatus=await req('/api/applications/'+candidate.id,{method:'PATCH',token:leader,data:{
    status:'У роботі',version:candidate.version+1
  }});
  assert.equal(anyOtherStatus.status,400);
  const memberEdit=await req('/api/applications/'+candidate.id,{method:'PATCH',token:member,data:{
    status:'Прийнято',version:candidate.version+1
  }});
  assert.equal(memberEdit.status,403);
  const stale=await req('/api/applications/'+candidate.id,{method:'PATCH',token:leader,data:{
    status:'Прийнято',version:candidate.version
  }});
  assert.equal(stale.status,409);
  const accepted=await req('/api/applications/'+candidate.id,{method:'PATCH',token:leader,data:{
    status:'Прийнято',version:candidate.version+1
  }});
  assert.equal(accepted.status,200);
  const exported=(await req('/api/export?module=applications',{token:leader})).data.items.find(x=>x.id===candidate.id);
  assert.equal(exported.status,'Прийнято');
  // Approval never creates an account or reveals login credentials.
  const users=(await req('/api/users',{token:leader})).data.items;
  assert.ok(!users.some(x=>x.nickname==='Three status candidate'));
  // Legacy records from an older deployment remain readable before migration 0006 runs.
  const oldId=crypto.randomUUID(),time=new Date().toISOString();
  await DB1.prepare('INSERT INTO applications(id,nickname,game_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .bind(oldId,'Previous applicant','172','Погоджено',time,time).run();
  const legacyList=(await req('/api/applications',{token:leader})).data.items;
  const legacy=legacyList.find(x=>x.id===oldId);
  assert.equal(legacy.status,'Прийнято');
  const legacyUpdated=await req('/api/applications/'+oldId,{method:'PATCH',token:leader,data:{
    status:'Прийнято',version:legacy.version,comment:'Зміна коментаря'
  }});
  assert.equal(legacyUpdated.status,200);
  assert.equal((await DB1.prepare('SELECT status FROM applications WHERE id=?').bind(oldId).first()).status,'Прийнято');
});

test('Application waiting, accepted, rejected notifications each use their own webhook and preserve legacy fallback',async()=>{
  const root='https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const waiting=root.replace('123456789012345678','523456789012345678');
  const accepted=root.replace('123456789012345678','623456789012345678');
  const rejected=root.replace('123456789012345678','723456789012345678');
  const oldFetch=globalThis.fetch;
  const deliveries=[],pending=[],ctx={waitUntil(p){pending.push(p);}};
  env.DISCORD_WEBHOOK_URL=root;
  env.DISCORD_WEBHOOK_APPLICATIONS_WAITING=waiting;
  env.DISCORD_WEBHOOK_APPLICATIONS_ACCEPTED=accepted;
  env.DISCORD_WEBHOOK_APPLICATIONS_REJECTED=rejected;
  globalThis.fetch=async(url,options)=>{
    deliveries.push({url,payload:JSON.parse(options.body)});
    return new Response(null,{status:204});
  };
  try{
    const status=await req('/api/discord/status',{token:leader});
    assert.equal(status.status,200);
    for(const kind of ['application_waiting','application_accepted','application_rejected'])
      assert.deepEqual(status.data.applicationRoutes[kind],{configured:true,reason:'ready',separate:true});
    assert.ok(!JSON.stringify(status.data).includes(waiting));
    assert.ok(!JSON.stringify(status.data).includes(accepted));
    assert.ok(!JSON.stringify(status.data).includes(rejected));

    const newApp=await req('/api/apply',{method:'POST',headers:{'cf-connecting-ip':'198.51.100.220'},ctx,data:{
      nickname:'Status route player',game_id:'321',motivation:'Testing routing to different webhook destinations'
    }});
    assert.equal(newApp.status,201,JSON.stringify(newApp.data));
    await Promise.all(pending.splice(0));
    assert.equal(deliveries.length,1);
    assert.equal(deliveries[0].url,waiting);
    assert.ok(JSON.stringify(deliveries[0].payload).includes('Очікує'));

    const all=(await req('/api/applications',{token:leader})).data.items;
    const app=all.find(x=>x.nickname==='Status route player');
    assert.equal(app.status,'Очікує');
    const approved=await req('/api/applications/'+app.id,{method:'PATCH',token:leader,ctx,data:{
      version:app.version,status:'Прийнято',comment:'Private application review'
    }});
    assert.equal(approved.status,200);
    await Promise.all(pending.splice(0));
    assert.equal(deliveries.length,2);
    assert.equal(deliveries[1].url,accepted);
    assert.ok(JSON.stringify(deliveries[1].payload).includes('Прийнято'));
    assert.ok(!JSON.stringify(deliveries[1].payload).includes('Private application review'));

    const declined=await req('/api/applications/'+app.id,{method:'PATCH',token:leader,ctx,data:{
      version:app.version+1,status:'Відхилено',comment:'Confidential'
    }});
    assert.equal(declined.status,200);
    await Promise.all(pending.splice(0));
    assert.equal(deliveries.length,3);
    assert.equal(deliveries[2].url,rejected);
    assert.ok(JSON.stringify(deliveries[2].payload).includes('Відхилено'));

    const updateOnly=await req('/api/applications/'+app.id,{method:'PATCH',token:leader,ctx,data:{
      version:app.version+2,status:'Відхилено',comment:'Second internal note'
    }});
    assert.equal(updateOnly.status,200);
    await Promise.all(pending.splice(0));
    assert.equal(deliveries.length,3);

    const returnedToWaiting=await req('/api/applications/'+app.id,{method:'PATCH',token:leader,ctx,data:{
      version:app.version+3,status:'Очікує',comment:'Pending again'
    }});
    assert.equal(returnedToWaiting.status,200);
    await Promise.all(pending.splice(0));
    assert.equal(deliveries.length,4);
    assert.equal(deliveries[3].url,waiting);

    const routeTest=await req('/api/discord/test',{method:'POST',token:leader,data:{kind:'application_accepted'}});
    assert.equal(routeTest.status,200,JSON.stringify(routeTest.data));
    assert.equal(deliveries[4].url,accepted);

    env.DISCORD_WEBHOOK_APPLICATIONS_ACCEPTED=waiting;
    const duplicate=(await req('/api/discord/status',{token:leader})).data.applicationRoutes;
    assert.equal(duplicate.application_accepted.reason,'duplicate');
    assert.equal(duplicate.application_waiting.reason,'duplicate');
    const blocked=await req('/api/discord/test',{method:'POST',token:leader,data:{kind:'application_accepted'}});
    assert.equal(blocked.status,503);
    assert.equal(deliveries.length,5);

    // Unconfigured statuses use the legacy decision hook rather than disappearing silently.
    delete env.DISCORD_WEBHOOK_APPLICATIONS_ACCEPTED;
    const fallback=(await req('/api/discord/status',{token:leader})).data.applicationRoutes;
    assert.equal(fallback.application_accepted.reason,'legacy');
    assert.equal(fallback.application_accepted.separate,false);
    assert.equal(fallback.application_accepted.configured,true);
    const legacy=(await req('/api/applications/'+app.id,{method:'PATCH',token:leader,ctx,data:{
      version:app.version+4,status:'Прийнято'
    }});
    assert.equal(legacy.status,200);
    await Promise.all(pending.splice(0));
    assert.equal(deliveries[5].url,root);
  }finally{
    globalThis.fetch=oldFetch;
    delete env.DISCORD_WEBHOOK_URL;
    delete env.DISCORD_WEBHOOK_APPLICATIONS_WAITING;
    delete env.DISCORD_WEBHOOK_APPLICATIONS_ACCEPTED;
    delete env.DISCORD_WEBHOOK_APPLICATIONS_REJECTED;
  }
});

// Run destructive session-revocation coverage last: other integration tests use this member's active session.
test('blocking user revokes sessions and stops access',async()=>{const u=(await req('/api/users',{token:leader})).data.items.find(x=>x.id===memberId);const r=await req(`/api/users/${memberId}`,{method:'PATCH',token:leader,data:{...u,status:'blocked'}});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal((await req('/api/auth/me',{token:member})).status,401);});
