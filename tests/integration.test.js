import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import worker,{payoutPreview,hashPassword,verifyPassword,validDiscordWebhookUrl,discordWebhookDiagnostic,buildDiscordNotification} from '../worker/index.js';

const dir=mkdtempSync(join(tmpdir(),'grizzly-test-'));
const file=join(dir,'local.sqlite');
const schema=['0001_init.sql','0002_capt_signups.sql','0003_discord_notifications.sql','0004_discord_capt_news.sql','0005_discord_announcements.sql','0006_application_statuses.sql','0007_payout_confirmations.sql'].map(file=>readFileSync(resolve('migrations',file),'utf8')).join('\n');
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
test('family roster has compact filters, Ukrainian statuses, sorting and mobile cards',()=>{
  const app=readFileSync(resolve('public/app.js'),'utf8');
  const css=readFileSync(resolve('public/style.css'),'utf8');
  assert.match(app,/select\('members-role-filter','Роль',roleOptions,role\)/);
  assert.match(app,/select\('members-status-filter','Статус',statusOptions,status\)/);
  assert.match(app,/select\('members-department-filter','Напрямок',departmentOptions,department\)/);
  assert.match(app,/select\('members-sort-filter','Сортування',sortOptions,sort\)/);
  assert.match(app,/data-action="members-reset"/);
  assert.match(app,/memberStatusLabel\(u\.status\)/);
  assert.match(app,/status==='active'\?'Активний'/);
  assert.match(app,/sort==='name'/);
  assert.match(app,/sort==='joined'/);
  assert.match(app,/Number\(b\.rank_id\|\|0\)-Number\(a\.rank_id\|\|0\)/);
  assert.match(app,/class="member-mobile-list"/);
  assert.match(app,/class="member-desktop-table"/);
  assert.match(app,/esc\(nameOf\(u\)\)/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/\.member-desktop-table\{display:none\}/);
  assert.match(css,/\.member-mobile-list\{display:block\}/);
});
test('leader creates member, who only accesses own account',async()=>{const a=await req('/api/users',{method:'POST',token:leader,data:{username:'fighter',password:'member-pass-123456',nickname:'Fighter',game_id:'99',role:'member',rank_id:1,department_id:'capt'}});assert.equal(a.status,201,JSON.stringify(a.data));memberId=a.data.item.id;const b=await req('/api/auth/login',{method:'POST',data:{username:'fighter',password:'member-pass-123456'}});assert.equal(b.status,200);member=b.cookie.match(/grizzly_session=([a-f0-9]+)/)[1];const list=await req('/api/users',{token:member});assert.equal(list.data.items.length,1);assert.equal(list.data.items[0].id,memberId);assert.equal((await req('/api/audit',{token:member})).status,403);});
test('every logged-in family member sees roster without other accounts or private fields',async()=>{
  const denied=await req('/api/members');
  assert.equal(denied.status,401);
  const roster=await req('/api/members',{token:member});
  assert.equal(roster.status,200,JSON.stringify(roster.data));
  assert.equal(roster.data.items.length,2);
  const others=roster.data.items.filter(u=>u.id!==memberId);
  assert.equal(others.length,1);
  assert.equal(others[0].role,'leader');
  const visible=['id','nickname','role','rank_id','department_id','game_id','status','joined_at'];
  for(const u of roster.data.items){
    assert.deepEqual(Object.keys(u).sort(),visible.slice().sort());
    for(const secret of ['username','password_hash','discord','permissions','custom_permissions','activity','version','created_at','updated_at']){
      assert.equal(Object.hasOwn(u,secret),false,secret);
    }
  }
  const accounts=await req('/api/users',{token:member});
  assert.equal(accounts.data.items.length,1,'Private user accounts remain restricted');
  assert.equal(accounts.data.items[0].id,memberId);
  const app=readFileSync(resolve('public/app.js'),'utf8');
  assert.match(app,/api\('\/members'\)/);
  assert.match(app,/const all=state\.roster/);
  assert.match(app,/data-action="view-member"/);
  assert.match(app,/state\.users\.some\(account=>account\.id===u\.id\)/);
});
test('rank requirements presets preserve existing rank titles and promotion self-reports are explicit',()=>{
  const app=readFileSync(resolve('public/app.js'),'utf8');
  assert.match(app,/function rankRequirementsMissing\(rank\)/);
  assert.match(app,/rankRequirementsMissing\(rank\)&&state\.rankTemplates/);
  assert.match(app,/data-action="rank-fill-requirements"/);
  assert.match(app,/case 'rank-fill-requirements':/);
  assert.match(app,/title:rank\.title,requirements:template\.requirements,checklist:template\.checklist,version:rank\.version/);
  assert.match(app,/class="promotion-requirement"/);
  assert.match(app,/function syncPromotionChecklist\(\)/);
  assert.match(app,/promotionChecklistView\(e\.target\.value,\[\]\)/);
  assert.match(app,/Самозвіт:/);
  assert.match(app,/Керівництво перевіряє докази перед рішенням/);
});
test('rank dashboard shows fifteen-rank hierarchy, checklists, member counts and promotion actions',()=>{
  const app=readFileSync(resolve('public/app.js'),'utf8');
  assert.match(app,/function rankChecklist\(rank\)/);
  assert.match(app,/api\('\/records\/promotions'\)/);
  assert.match(app,/state\.roster\.filter\(u=>Number\(u\.rank_id\)===Number\(rank\.id\)\)/);
  assert.match(app,/rankChecklist\(rank\)/);
  assert.match(app,/data-action="edit-rank"/);
  assert.match(app,/data-module="promotions"/);
  assert.match(app,/data-action="rank-promotions-list"/);
  assert.match(app,/case 'rank-promotions-list':/);
  assert.match(app,/esc\(rank\.title\)/);
  assert.match(app,/esc\(item\)/);
});
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
test('fleet vehicle viewer is zoomable and omits zero-value metadata',async()=>{
  const {readFileSync}=await import('node:fs');
  const app=readFileSync('public/app.js','utf8');
  assert.match(app,/data-action="fleet-photo"/);
  assert.match(app,/height:240px;object-fit:contain/);
  assert.match(app,/Number\(car\.extra\?\.value\)>0/);
  assert.match(app,/Number\(car\.extra\?\.mileage\)>0/);
  assert.doesNotMatch(app,/data-action="fleet-action"/);
});
test('fleet stores vehicles with condition, image evidence and member-visible loan history',async()=>{
  const created=await req('/api/records/vehicles',{method:'POST',token:leader,data:{
    title:'Obey 8F Drafter',details:'Автомобіль сімейного гаража',status:'Заплановано',
    extra:{plate:'GRZ-001',model:'Obey 8F Drafter',condition:'ready',location:'Особняк',responsible:'Fighter'},
    evidence:['https://i.ibb.co/example/vehicle.png']
  }});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const cars=await req('/api/records/vehicles',{token:member});
  assert.equal(cars.status,200);
  const car=cars.data.items.find(item=>item.id===created.data.item.id);
  assert.ok(car);
  assert.equal(car.extra.plate,'GRZ-001');
  assert.equal(car.extra.condition,'ready');
  const forbidden=await req('/api/records/vehicles',{method:'POST',token:member,data:{title:'Несанкціонований транспорт'}});
  assert.equal(forbidden.status,403);
  const trip=await req('/api/records/vehicle_loans',{method:'POST',token:member,data:{
    title:'Виїзд на патруль',details:'Повернути на особняк',extra:{vehicle:'GRZ-001',action:'issue',driver:'Fighter'}
  }});
  assert.equal(trip.status,201,JSON.stringify(trip.data));
  const log=await req('/api/records/vehicle_loans',{token:leader});
  assert.ok(log.data.items.some(item=>item.id===trip.data.item.id&&item.extra.vehicle==='GRZ-001'));
});
test('contract calculation, atomic settlement and no duplicate payment',async()=>{const c=await req('/api/contracts',{method:'POST',token:leader,data:{title:'RP контракт',details:'Перевезення',amount:1001,treasury_percent:20,participant_ids:[memberId],status:'Заплановано'}});assert.equal(c.status,201,JSON.stringify(c.data));contractId=c.data.item.id;assert.equal((await req('/api/contracts',{token:member})).data.items.length,1);const p=await req(`/api/contracts/${contractId}/preview`,{token:member});assert.equal(p.data.preview.treasury,200);assert.equal(p.data.preview.per_member,801);const edit=await req(`/api/contracts/${contractId}`,{method:'PATCH',token:leader,data:{version:1,status:'Погоджено'}});assert.equal(edit.status,200);const paid=await req(`/api/contracts/${contractId}/settle`,{method:'POST',token:leader,data:{version:2}});assert.equal(paid.status,200,JSON.stringify(paid.data));assert.equal(paid.data.preview.per_member,801);const dup=await req(`/api/contracts/${contractId}/settle`,{method:'POST',token:leader,data:{version:2}});assert.equal(dup.status,409);const fin=await req('/api/finance',{token:member});assert.equal(fin.data.own_total,801);assert.equal(fin.data.own_payouts.length,1);const finance=(await req('/api/finance',{token:leader})).data;assert.equal(finance.treasury_balance,200);assert.equal(finance.payout_count,1);});
test('all authenticated members see aggregate finance but cannot access details or mutate money',async()=>{
  const noSession=await req('/api/finance');assert.equal(noSession.status,401);
  const viewer=await req('/api/finance',{token:member});
  const leaderFinance=await req('/api/finance',{token:leader});
  assert.equal(viewer.status,200,JSON.stringify(viewer.data));
  assert.equal(viewer.data.treasury_balance,leaderFinance.data.treasury_balance);
  assert.equal(viewer.data.payout_total,leaderFinance.data.payout_total);
  assert.equal(viewer.data.payout_count,leaderFinance.data.payout_count);
  assert.deepEqual(viewer.data.totals,leaderFinance.data.totals);
  for(const key of ['contract_treasury','contributions','expenses','bonuses','capt','contract_payouts','contract_payout_count','treasury_change'])assert.equal(viewer.data.month[key],leaderFinance.data.month[key],key);
  assert.equal(viewer.data.payment_rows,undefined,'Member must not receive other peoples payout records');
  assert.ok(Array.isArray(viewer.data.own_payouts));
  assert.equal((await req('/api/ledger',{token:member})).status,403);
  assert.equal((await req('/api/finance/outstanding',{token:member})).status,403);
  assert.equal((await req('/api/finance/analytics?days=7',{token:member})).status,403);
  assert.equal((await req('/api/finance/trends?period=12w',{token:member})).status,403);
  const write=await req('/api/ledger',{method:'POST',token:member,data:{kind:'expense',amount:100,description:'Unauthorized'}});
  assert.equal(write.status,403);
  const app=readFileSync(resolve('public/app.js'),'utf8');
  assert.match(app,/Загальна статистика казни та власні виплати/);
  assert.match(app,/can\('finance:manage'\)\?'<button class="btn" data-action="new-ledger"/);
});
test('unconfirmed contract payout dashboard respects finance permissions and totals',async()=>{
  const denied=await req('/api/finance/outstanding',{token:member});
  assert.equal(denied.status,403);
  const waiting=await req('/api/finance/outstanding',{token:leader});
  assert.equal(waiting.status,200,JSON.stringify(waiting.data));
  assert.equal(waiting.data.count,1);
  assert.equal(waiting.data.amount,801);
  assert.equal(waiting.data.people[0].user_id,memberId);
  assert.equal(waiting.data.people[0].amount,801);
});
test('in-game payout handoff is finance-only, recorded once and does not change treasury',async()=>{const before=(await req('/api/finance',{token:leader})).data;const payout=before.payment_rows.find(p=>p.contract_id===contractId);assert.ok(payout);assert.equal(payout.confirmed_at,null);const forbidden=await req('/api/payouts/'+payout.id+'/confirm',{method:'POST',token:member,data:{}});assert.equal(forbidden.status,403);const ok=await req('/api/payouts/'+payout.id+'/confirm',{method:'POST',token:leader,data:{note:'Видано у грі'}});assert.equal(ok.status,200,JSON.stringify(ok.data));const duplicate=await req('/api/payouts/'+payout.id+'/confirm',{method:'POST',token:leader,data:{}});assert.equal(duplicate.status,409);const after=(await req('/api/finance',{token:leader})).data;assert.equal(after.treasury_balance,before.treasury_balance);assert.equal(after.payout_total,before.payout_total);assert.equal(after.payment_rows.find(p=>p.id===payout.id).note,'Видано у грі');const pending=await req('/api/finance/outstanding',{token:leader});assert.equal(pending.status,200);assert.equal(pending.data.count,0);assert.equal(pending.data.amount,0);const memberView=(await req('/api/finance',{token:member})).data;assert.equal(memberView.payment_rows,undefined);});
test('finance analytics limits access and reconciles earnings for weekly and monthly reports',async()=>{
  const denied=await req('/api/finance/analytics?days=7',{token:member});
  assert.equal(denied.status,403);
  const invalid=await req('/api/finance/analytics?days=365',{token:leader});
  assert.equal(invalid.status,400);
  const week=await req('/api/finance/analytics?days=7',{token:leader});
  assert.equal(week.status,200,JSON.stringify(week.data));
  assert.equal(week.data.report.days,7);
  assert.equal(week.data.report.member_earned,801);
  assert.equal(week.data.report.member_handed_over,801);
  assert.equal(week.data.report.contracts_count,1);
  assert.equal(week.data.leaderboard[0].user_id,memberId);
  const month=await req('/api/finance/analytics?days=30',{token:leader});
  assert.equal(month.status,200);
  assert.equal(month.data.report.member_earned,week.data.report.member_earned);
  assert.equal(month.data.report.net_change,week.data.report.net_change);
});
test('twelve-week financial trends are private and reconcile weekly sums',async()=>{
  const denied=await req('/api/finance/trends',{token:member});
  assert.equal(denied.status,403);
  const result=await req('/api/finance/trends',{token:leader});
  assert.equal(result.status,200,JSON.stringify(result.data));
  const {weeks,members}=result.data;
  assert.equal(weeks.length,12);
  assert.equal(weeks.reduce((n,w)=>n+w.earned,0),801);
  assert.equal(weeks.reduce((n,w)=>n+w.income,0),200);
  assert.equal(weeks.reduce((n,w)=>n+w.net,0),200);
  assert.equal(weeks.reduce((n,w)=>n+w.payout_count,0),1);
  assert.equal(members[0].user_id,memberId);
  assert.equal(members[0].earned,801);
  assert.equal(members[0].handed_over,801);
  assert.equal(members[0].weekly.reduce((s,n)=>s+n,0),801);
});
test('finance trend period filters preserve balance and reject invalid windows',async()=>{
  const all=await req('/api/finance/trends?period=all',{token:leader});
  const seven=await req('/api/finance/trends?period=7',{token:leader});
  const thirty=await req('/api/finance/trends?period=30',{token:leader});
  const ninety=await req('/api/finance/trends?period=90',{token:leader});
  const bad=await req('/api/finance/trends?period=invalid',{token:leader});
  assert.equal(bad.status,400);
  for(const response of [all,seven,thirty,ninety]){
    assert.equal(response.status,200,JSON.stringify(response.data));
    assert.ok(response.data.weeks.length>=1);
    const last=response.data.weeks.at(-1);
    assert.equal(last.balance,response.data.opening_balance+response.data.weeks.reduce((s,w)=>s+w.net,0));
  }
  // 'all' begins with the first real transaction, while fixed windows may include earlier empty weeks.
  assert.ok(all.data.weeks.length>=1);
  assert.ok(ninety.data.weeks.length>=thirty.data.weeks.length);
  assert.equal(all.data.weeks.reduce((s,w)=>s+w.net,0),200);
  assert.equal(all.data.opening_balance,0);
});
test('database persists after new D1 adapter instance',async()=>{env.DB=new DB();const a=await req('/api/finance',{token:member});assert.equal(a.data.own_total,801);const r=await req('/api/records/reports',{token:member});assert.equal(r.data.items[0].status,'Погоджено');env.DB=DB1;});
test('event RSVP, prohibited links, CSRF and export permissions',async()=>{const ev=await req('/api/records/events',{method:'POST',token:leader,data:{title:'Загальні збори',starts_at:'2026-12-01T19:00'}});assert.equal(ev.status,201);const yes=await req(`/api/rsvp/${ev.data.item.id}`,{method:'POST',token:member,data:{response:'Так'}});assert.equal(yes.status,200);const rs=await req(`/api/rsvp/${ev.data.item.id}`,{token:leader});assert.equal(rs.data.counts.yes,1);const link=await req('/api/records/reports',{method:'POST',token:member,data:{title:'Bad',evidence:['https://evil.example/foo']}});assert.equal(link.status,400);const csrf=await req('/api/auth/logout',{method:'POST',token:member,headers:{origin:'https://evil.example'}});assert.equal(csrf.status,403);const exp=await req('/api/export?module=users',{token:member});assert.equal(exp.data.items.length,1);assert.equal(exp.data.items[0].password_hash,undefined);});
test('promotion review panel shows evidence and progress while leader cannot self-approve',async()=>{
 const app=readFileSync(resolve('public/app.js'),'utf8');
 assert.match(app,/function promotionReviewSummary\(record\)/);
 assert.match(app,/Автор заявки:/);
 assert.match(app,/Цільовий ранг:/);
 assert.match(app,/Докази ImgBB/);
 assert.match(app,/Самозвіт:/);
 assert.match(app,/promotionReviewSummary\(r\)/);
 assert.match(app,/Власну заявку або звіт погоджувати заборонено/);
 assert.match(app,/case 'review-record':await reviewModal/);
 const own=await req('/api/records/promotions',{method:'POST',token:leader,data:{
   title:'Заявка лідера на перевірку',details:'Лише для перевірки захисту',
   extra:{requested_rank_id:'2',checklist_completed:[]}
 }});
 assert.equal(own.status,201,JSON.stringify(own.data));
 const attempt=await req('/api/records/promotions/'+own.data.item.id+'/review',{method:'POST',token:leader,data:{version:1,status:'Погоджено',comment:'Самопогодження'}});
 assert.equal(attempt.status,403);
 const stored=await req('/api/records/promotions',{token:leader});
 assert.equal(stored.data.items.find(x=>x.id===own.data.item.id).status,'На перевірці');
});
test('member requests promotion; approved request updates game rank atomically',async()=>{const pr=await req('/api/records/promotions',{method:'POST',token:member,data:{title:'Заявка на ранг 2',details:'Чекліст виконано',extra:{requested_rank_id:'2',checklist_completed:['Патрулювання','Тренування']},evidence:['https://ibb.co/abcDEF1']}});assert.equal(pr.status,201,JSON.stringify(pr.data));assert.equal(pr.data.item.status,'На перевірці');const bypass=await req(`/api/records/promotions/${pr.data.item.id}`,{method:'PATCH',token:leader,data:{version:1,status:'Погоджено'}});assert.equal(bypass.status,400);const ok=await req(`/api/records/promotions/${pr.data.item.id}/review`,{method:'POST',token:leader,data:{version:1,status:'Погоджено',comment:'Умови виконано'}});assert.equal(ok.status,200,JSON.stringify(ok.data));const u=(await req('/api/auth/me',{token:member})).data.user;assert.equal(u.rank_id,2);});
test('member can update only own pending promotion checklist without changing rank or privileges',async()=>{
  const rankRows=await req('/api/ranks',{token:member});
  assert.equal(rankRows.status,200);
  const source=rankRows.data.items.find(r=>r.id===2);
  const requirement=JSON.parse(source.checklist)[0];
  assert.ok(requirement);
  const created=await req('/api/records/promotions',{method:'POST',token:member,data:{title:'Прогрес до рангу 3',extra:{requested_rank_id:'3',checklist_completed:[]},evidence:['https://ibb.co/abcDEF1']}});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const id=created.data.item.id;
  const changed=await req('/api/records/promotions/'+id,{method:'PATCH',token:member,data:{version:1,extra:{requested_rank_id:'3',checklist_completed:[requirement]}}});
  assert.equal(changed.status,200,JSON.stringify(changed.data));
  const list=await req('/api/records/promotions',{token:member});
  const saved=list.data.items.find(x=>x.id===id);
  assert.deepEqual(saved.extra.checklist_completed,[requirement]);
  assert.equal(Number(saved.extra.requested_rank_id),3);
  const bypass=await req('/api/records/promotions/'+id,{method:'PATCH',token:member,data:{version:saved.version,extra:{requested_rank_id:'15',checklist_completed:[requirement]}}});
  assert.equal(bypass.status,403);
  const fake=await req('/api/records/promotions/'+id,{method:'PATCH',token:member,data:{version:saved.version,extra:{checklist_completed:['неіснуюча вимога']}}});
  assert.equal(fake.status,400);
});
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
    const legacy=await req('/api/applications/'+app.id,{method:'PATCH',token:leader,ctx,data:{
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

test('members see all family contracts and payout previews but cannot edit or settle',async()=>{
  const publicRequest=await req('/api/contracts');assert.equal(publicRequest.status,401);
  const leaderResponse=await req('/api/contracts',{token:leader});
  const memberResponse=await req('/api/contracts',{token:member});
  assert.equal(memberResponse.status,200,JSON.stringify(memberResponse.data));
  assert.deepEqual(memberResponse.data.items.map(x=>x.id),leaderResponse.data.items.map(x=>x.id));
  const created=await req('/api/contracts',{method:'POST',token:leader,data:{title:'Контракт для перевірки загального доступу',details:'Тест доступу',amount:1500,participant_ids:[memberId],treasury_percent:20,status:'Погоджено'}});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const contract=created.data.item;
  const afterCreation=await req('/api/contracts',{token:member});
  assert.ok(afterCreation.data.items.some(x=>x.id===contract.id));
  const calculation=await req('/api/contracts/'+contract.id+'/preview',{token:member});
  assert.equal(calculation.status,200,JSON.stringify(calculation.data));
  assert.equal(calculation.data.preview.amount,contract.amount);
  const blockedCreate=await req('/api/contracts',{method:'POST',token:member,data:{title:'Без дозволу',amount:1000,participant_ids:[memberId]}});
  assert.equal(blockedCreate.status,403);
  const blockedUpdate=await req('/api/contracts/'+contract.id,{method:'PATCH',token:member,data:{version:contract.version,title:'Зміна'}});
  assert.equal(blockedUpdate.status,403);
  const blockedSettle=await req('/api/contracts/'+contract.id+'/settle',{method:'POST',token:member,data:{version:contract.version}});
  assert.equal(blockedSettle.status,403);
  const app=readFileSync(resolve('public/app.js'),'utf8');
  assert.match(app,/data-action="contract-filter"/);
  assert.match(app,/case 'contract-filter':/);
  assert.match(app,/Спільний реєстр контрактів/);
});
test('contract amounts synchronize to finance without crediting unsettled money',async()=>{
  const before=(await req('/api/finance',{token:member})).data;
  assert.ok(before.contract_summary);
  const created=await req('/api/contracts',{method:'POST',token:leader,data:{
    title:'Синхронізація контракту з фінансами',details:'Перевірка обліку',
    amount:2000,treasury_percent:20,participant_ids:[memberId],status:'Погоджено'
  }});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const id=created.data.item.id;
  const pending=(await req('/api/finance',{token:member})).data;
  assert.equal(pending.contract_summary.contracts_count,before.contract_summary.contracts_count+1);
  assert.equal(pending.contract_summary.contracts_total,before.contract_summary.contracts_total+2000);
  assert.equal(pending.contract_summary.unsettled_total,before.contract_summary.unsettled_total+2000);
  assert.equal(pending.contract_summary.approved_pending_total,before.contract_summary.approved_pending_total+2000);
  assert.equal(pending.treasury_balance,before.treasury_balance,'Unsettled contracts must not increase treasury');
  assert.equal(pending.payout_total,before.payout_total,'Unsettled contracts must not create payouts');
  const settle=await req('/api/contracts/'+id+'/settle',{method:'POST',token:leader,data:{version:created.data.item.version}});
  assert.equal(settle.status,200,JSON.stringify(settle.data));
  const settled=(await req('/api/finance',{token:member})).data;
  assert.equal(settled.contract_summary.contracts_total,pending.contract_summary.contracts_total);
  assert.equal(settled.contract_summary.settled_total,pending.contract_summary.settled_total+2000);
  assert.equal(settled.contract_summary.unsettled_total,pending.contract_summary.unsettled_total-2000);
  assert.equal(settled.contract_summary.approved_pending_total,pending.contract_summary.approved_pending_total-2000);
  assert.equal(settled.treasury_balance,before.treasury_balance+400,'Only 20% treasury share is credited');
  assert.equal(settled.payout_total,before.payout_total+1600,'Member payouts are tracked separately');
  assert.equal(settled.payment_rows,undefined,'Regular member cannot view other payout details');
  const app=readFileSync(resolve('public/app.js'),'utf8');
  assert.match(app,/Контракти → фінанси/);
  assert.match(app,/Сума всіх контрактів/);
  assert.match(app,/Погоджено, очікує нарахування/);
  assert.match(app,/data-route="contracts"/);
});
test('leader corrects settled zero payouts without duplicate credits or falsely paid handoffs',async()=>{
  const leaderId=(await req('/api/auth/me',{token:leader})).data.user.id;
  const create=await req('/api/contracts',{method:'POST',token:leader,data:{
    title:'Коригування помилкової суми',details:'Фінансова звірка',
    amount:1,treasury_percent:10,participant_ids:[leaderId,memberId],status:'Погоджено'
  }});
  assert.equal(create.status,201,JSON.stringify(create.data));
  const contract=create.data.item;
  const settle=await req('/api/contracts/'+contract.id+'/settle',{method:'POST',token:leader,data:{version:contract.version}});
  assert.equal(settle.status,200,JSON.stringify(settle.data));
  assert.equal(settle.data.preview.treasury,1);
  assert.equal(settle.data.preview.per_member,0);
  const financeBefore=(await req('/api/finance',{token:leader})).data;
  const originalPayouts=financeBefore.payment_rows.filter(p=>p.contract_id===contract.id);
  assert.equal(originalPayouts.length,2);
  for(const payout of originalPayouts){
    const handoff=await req('/api/payouts/'+payout.id+'/confirm',{method:'POST',token:leader,data:{note:'Нульовий запис'}});
    assert.equal(handoff.status,200,JSON.stringify(handoff.data));
  }
  const body={amount:120000,reason:'Помилкова сума 1 замість 120000'};
  const unauthorized=await req('/api/contracts/'+contract.id+'/correction-preview',{method:'POST',token:member,data:body});
  assert.equal(unauthorized.status,403);
  const preview=await req('/api/contracts/'+contract.id+'/correction-preview',{method:'POST',token:leader,data:body});
  assert.equal(preview.status,200,JSON.stringify(preview.data));
  assert.equal(preview.data.preview.old_treasury,1);
  assert.equal(preview.data.preview.new_treasury,12000);
  assert.equal(preview.data.preview.new_per_member,54000);
  assert.equal(preview.data.preview.reset_zero_confirmations,2);
  const blocked=await req('/api/contracts/'+contract.id+'/correct',{method:'POST',token:member,data:{...body,version:preview.data.version,confirm_reset_zero_confirmations:true}});
  assert.equal(blocked.status,403);
  const noConsent=await req('/api/contracts/'+contract.id+'/correct',{method:'POST',token:leader,data:{...body,version:preview.data.version}});
  assert.equal(noConsent.status,400);
  const stale=await req('/api/contracts/'+contract.id+'/correct',{method:'POST',token:leader,data:{...body,version:0,confirm_reset_zero_confirmations:true}});
  assert.equal(stale.status,409);
  const done=await req('/api/contracts/'+contract.id+'/correct',{method:'POST',token:leader,data:{...body,version:preview.data.version,confirm_reset_zero_confirmations:true}});
  assert.equal(done.status,200,JSON.stringify(done.data));
  const financeAfter=(await req('/api/finance',{token:leader})).data;
  const updated=financeAfter.payment_rows.filter(p=>p.contract_id===contract.id);
  assert.equal(updated.length,2);
  assert.deepEqual(updated.map(x=>x.amount),[54000,54000]);
  assert.ok(updated.every(p=>p.confirmed_at===null),'Corrections must not mark new payouts as handed over');
  assert.equal(financeAfter.treasury_balance,financeBefore.treasury_balance+11999);
  assert.equal(financeAfter.payout_total,financeBefore.payout_total+108000);
  assert.equal(financeAfter.contract_summary.contracts_total,financeBefore.contract_summary.contracts_total+119999);
  const ledger=(await req('/api/ledger',{token:leader})).data.items.filter(x=>x.reference==='contract:'+contract.id);
  assert.equal(ledger.length,1,'Treasury allocation is updated, not inserted again');
  assert.equal(ledger[0].amount,12000);
  const pending=await req('/api/finance/outstanding',{token:leader});
  assert.ok(pending.data.count>=2);
  const again=await req('/api/contracts/'+contract.id+'/correct',{method:'POST',token:leader,data:{...body,version:done.data.version,confirm_reset_zero_confirmations:true}});
  assert.equal(again.status,400);
  const audit=(await req('/api/audit',{token:leader})).data.items;
  const correction=audit.find(x=>x.action==='correct_settled_contract'&&x.entity_id===contract.id);
  assert.ok(correction);
  assert.equal(JSON.parse(correction.detail).reset_confirmations,2);
  const app=readFileSync(resolve('public/app.js'),'utf8');
  assert.match(app,/contract-correction-preview/);
  assert.match(app,/contract-correction-save/);
  assert.match(app,/Тільки для помилкових нарахувань з нульовими виплатами/);
});
test('department leaders must be active heads assigned to the same department',async()=>{
  const data=(await req('/api/departments',{token:leader})).data.items;
  const capt=data.find(d=>d.id==='capt');
  assert.ok(capt);
  const invalid=await req('/api/departments/capt',{method:'PATCH',token:leader,data:{title:capt.title,head_id:memberId,version:capt.version}});
  assert.equal(invalid.status,400,'An ordinary member cannot be a department head');
  const foreign=await req('/api/users',{method:'POST',token:leader,data:{
    username:'foreignhead',password:'foreign-head-pass-123',nickname:'Foreign Head',role:'head',department_id:'fleet'
  }});
  assert.equal(foreign.status,201,JSON.stringify(foreign.data));
  const wrong=await req('/api/departments/capt',{method:'PATCH',token:leader,data:{title:capt.title,head_id:foreign.data.item.id,version:capt.version}});
  assert.equal(wrong.status,400,'A head of another department cannot lead capt');
  const created=await req('/api/users',{method:'POST',token:leader,data:{
    username:'captleader',password:'capt-leader-pass-123',nickname:'CAPT Leader',role:'head',department_id:'capt'
  }});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const headId=created.data.item.id;
  const denied=await req('/api/departments/capt',{method:'PATCH',token:member,data:{title:'Hijacked',head_id:headId,version:capt.version}});
  assert.equal(denied.status,403);
  const appointed=await req('/api/departments/capt',{method:'PATCH',token:leader,data:{title:capt.title,head_id:headId,version:capt.version}});
  assert.equal(appointed.status,200,JSON.stringify(appointed.data));
  const after=(await req('/api/departments',{token:member})).data.items.find(d=>d.id==='capt');
  assert.equal(after.head_id,headId);
  const assigned=(await req('/api/users',{token:leader})).data.items.find(u=>u.id===headId);
  const move=await req('/api/users/'+headId,{method:'PATCH',token:leader,data:{...assigned,department_id:'fleet'}});
  assert.equal(move.status,409,'Head cannot move until unassigned');
  const demote=await req('/api/users/'+headId,{method:'PATCH',token:leader,data:{...assigned,role:'member'}});
  assert.equal(demote.status,409,'Head cannot be demoted until unassigned');
  const block=await req('/api/users/'+headId,{method:'PATCH',token:leader,data:{...assigned,status:'blocked'}});
  assert.equal(block.status,409,'Head cannot be blocked until unassigned');
  const clear=await req('/api/departments/capt',{method:'PATCH',token:leader,data:{title:capt.title,head_id:'',version:after.version}});
  assert.equal(clear.status,200,JSON.stringify(clear.data));
  const nowAllowed=await req('/api/users/'+headId,{method:'PATCH',token:leader,data:{...assigned,department_id:'fleet',role:'member'}});
  assert.equal(nowAllowed.status,200,JSON.stringify(nowAllowed.data));
  const app=readFileSync(resolve('public/app.js'),'utf8');
  assert.match(app,/async function departments\(\)/);
  assert.match(app,/state\.departmentFocus/);
  assert.match(app,/data-action="department-select"/);
  assert.match(app,/data-action="department-new-task"/);
  assert.match(app,/Голова відділу/);
  assert.match(app,/Звіти напрямку/);
});
test('department contract finances remain scoped to the assigned head and track settlement correctly',async()=>{
  const head=await req('/api/users',{method:'POST',token:leader,data:{username:'financefarmhead',password:'finance-farm-head-123',nickname:'Farm Finance Head',role:'head',department_id:'farm'}});
  assert.equal(head.status,201,JSON.stringify(head.data));
  const login=await req('/api/auth/login',{method:'POST',data:{username:'financefarmhead',password:'finance-farm-head-123'}});
  assert.equal(login.status,200,JSON.stringify(login.data));
  const headToken=login.cookie.match(/grizzly_session=([a-f0-9]+)/)[1];
  assert.equal((await req('/api/departments/capt/finance-summary',{token:headToken})).status,403);
  assert.equal((await req('/api/departments/farm/finance-summary',{token:member})).status,403);
  assert.equal((await req('/api/departments/missing/finance-summary',{token:leader})).status,404);
  const before=await req('/api/departments/farm/finance-summary',{token:headToken});
  assert.equal(before.status,200,JSON.stringify(before.data));
  const invalid=await req('/api/contracts',{method:'POST',token:leader,data:{title:'Invalid dept',amount:100,treasury_percent:20,participant_ids:[memberId],department_id:'missing'}});
  assert.equal(invalid.status,400);
  const contract=await req('/api/contracts',{method:'POST',token:leader,data:{title:'Фарм контракт',amount:1000,treasury_percent:20,participant_ids:[memberId],department_id:'farm',status:'Погоджено'}});
  assert.equal(contract.status,201,JSON.stringify(contract.data));
  const ownContracts=await req('/api/contracts',{token:headToken});
  assert.equal(ownContracts.status,200,JSON.stringify(ownContracts.data));
  assert.ok(ownContracts.data.items.some(x=>x.id===contract.data.item.id));
  assert.ok(ownContracts.data.items.every(x=>x.department_id==='farm'));
  const foreignContract=(await req('/api/contracts',{token:leader})).data.items.find(x=>x.department_id==='capt');
  if(foreignContract){
    assert.equal((await req('/api/contracts/'+foreignContract.id+'/preview',{token:headToken})).status,403);
    const exported=await req('/api/export?module=contracts',{token:headToken});
    assert.ok(exported.data.items.every(x=>x.department_id==='farm'));
  }
  const unauthorizedSettle=await req('/api/contracts/'+contract.data.item.id+'/settle',{method:'POST',token:headToken,data:{version:contract.data.item.version}});
  assert.equal(unauthorizedSettle.status,403,'Department head cannot financially settle contracts');
  const pending=(await req('/api/departments/farm/finance-summary',{token:headToken})).data;
  assert.equal(pending.contracts.count,before.data.contracts.count+1);
  assert.equal(pending.contracts.total,before.data.contracts.total+1000);
  assert.equal(pending.contracts.pending_total,before.data.contracts.pending_total+1000);
  assert.equal(pending.treasury_contract_income,before.data.treasury_contract_income);
  const settle=await req('/api/contracts/'+contract.data.item.id+'/settle',{method:'POST',token:leader,data:{version:contract.data.item.version}});
  assert.equal(settle.status,200,JSON.stringify(settle.data));
  const after=(await req('/api/departments/farm/finance-summary',{token:headToken})).data;
  assert.equal(after.contracts.settled_total,before.data.contracts.settled_total+1000);
  assert.equal(after.contracts.pending_total,before.data.contracts.pending_total);
  assert.equal(after.treasury_contract_income,before.data.treasury_contract_income+200);
  assert.equal(after.payouts.accrued,before.data.payouts.accrued+800);
  assert.equal(after.payouts.handed_over,before.data.payouts.handed_over);
  const capt=(await req('/api/departments/capt/finance-summary',{token:leader})).data;
  assert.equal(capt.contracts.total,(await req('/api/departments/capt/finance-summary',{token:leader})).data.contracts.total);
  const app=readFileSync(resolve('public/app.js'),'utf8');
  assert.match(app,/finance-summary/);
  assert.match(app,/Підрозділ контракту/);
  assert.match(app,/Статистика тільки цього підрозділу/);
  assert.match(app,/contract-department-filter/);
  assert.match(app,/department-contracts/);
});
test('GRIZZLY overview v2 uses authenticated role-scoped sources and shows key panels',async()=>{
  const app=readFileSync(resolve('public/app.js'),'utf8');
  const section=app.slice(app.indexOf('async function overview(){'),app.indexOf('function memberStatusLabel(',app.indexOf('async function overview(){')));
  assert.match(section,/api\('\/finance'\)/);
  assert.match(section,/api\('\/contracts'\)/);
  assert.match(section,/api\('\/records\/tasks'\)/);
  assert.match(section,/api\('\/records\/reports'\)/);
  assert.match(section,/api\('\/records\/events'\)/);
  assert.match(section,/Сума контрактів/);
  assert.match(section,/Баланс скарбниці/);
  assert.match(section,/Оборот, не баланс скарбниці/);
  assert.match(section,/Мої завдання/);
  assert.match(section,/Звіти на перевірці/);
  assert.match(section,/Найближчі заходи/);
  assert.match(section,/Стан підрозділів/);
  assert.match(section,/Нові сповіщення/);
  assert.match(section,/departmentFinance/);
  assert.match(app,/\['overview','members','ranks','departments','contracts','settings','profile'\]/);
  const finance=await req('/api/finance',{token:member});
  const contracts=await req('/api/contracts',{token:member});
  const tasks=await req('/api/records/tasks',{token:member});
  const reports=await req('/api/records/reports',{token:member});
  const events=await req('/api/records/events',{token:member});
  for(const result of [finance,contracts,tasks,reports,events])assert.equal(result.status,200,JSON.stringify(result.data));
  assert.equal(finance.data.payment_rows,undefined,'Member must not get other people’s payment rows');
  assert.ok(Array.isArray(contracts.data.items));
  const memberAccounts=await req('/api/users',{token:member});
  assert.equal(memberAccounts.data.items.length,1,'Overview must not depend on unrestricted user account data');
});
test('department workspaces require a real appointment and never return foreign records',async()=>{
  const depList=(await req('/api/departments',{token:leader})).data.items;
  const own=depList.find(d=>!d.head_id&&d.id!=='capt')||depList.find(d=>!d.head_id);
  assert.ok(own,'Expected available department for assigned head');
  const foreign=depList.find(d=>d.id!==own.id);
  const created=await req('/api/users',{method:'POST',token:leader,data:{
    username:'workspacehead',password:'workspace-head-pass-123',nickname:'Workspace Manager',
    role:'head',department_id:own.id
  }});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const headId=created.data.item.id;
  const auth=await req('/api/auth/login',{method:'POST',data:{username:'workspacehead',password:'workspace-head-pass-123'}});
  assert.equal(auth.status,200);
  const headToken=auth.cookie.match(/grizzly_session=([a-f0-9]+)/)[1];
  assert.equal((await req('/api/department-workspace?department='+own.id,{token:member})).status,403);
  assert.equal((await req('/api/department-workspace?department='+own.id,{token:headToken})).status,403,
    'Role head alone must not grant departmental workspace privileges');
  assert.equal((await req('/api/department-workspace?department='+foreign.id,{token:headToken})).status,403);
  const appointed=await req('/api/departments/'+own.id,{method:'PATCH',token:leader,
    data:{title:own.title,head_id:headId,version:own.version}});
  assert.equal(appointed.status,200,JSON.stringify(appointed.data));

  const ownTask=await req('/api/records/tasks',{method:'POST',token:leader,
    data:{title:'Тестове завдання керівника підрозділу',department_id:own.id,status:'Заплановано'}});
  const foreignTask=await req('/api/records/tasks',{method:'POST',token:leader,
    data:{title:'Завдання іншого відділу',department_id:foreign.id,status:'Заплановано'}});
  assert.equal(ownTask.status,201,JSON.stringify(ownTask.data));
  assert.equal(foreignTask.status,201,JSON.stringify(foreignTask.data));

  const scoped=await req('/api/department-workspace?department='+own.id,{token:headToken});
  assert.equal(scoped.status,200,JSON.stringify(scoped.data));
  assert.equal(scoped.data.department.id,own.id);
  const tasks=scoped.data.sections.find(x=>x.id==='tasks');
  assert.ok(tasks.items.some(x=>x.id===ownTask.data.item.id));
  assert.ok(!tasks.items.some(x=>x.id===foreignTask.data.item.id));
  assert.ok(scoped.data.sections.every(x=>x.items.every(r=>r.department_id===own.id)));
  assert.ok(scoped.data.contracts.every(c=>c.department_id===own.id));
  assert.ok(scoped.data.members.every(m=>!Object.hasOwn(m,'password_hash')&&!Object.hasOwn(m,'username')));
  assert.ok(scoped.data.sections.some(x=>x.id==='capt_matches'));
  assert.ok(scoped.data.sections.some(x=>x.id==='vehicle_loans'));
  assert.equal((await req('/api/department-workspace?department='+foreign.id,{token:headToken})).status,403);
  const leadership=await req('/api/department-workspace?department='+foreign.id,{token:leader});
  assert.equal(leadership.status,200,JSON.stringify(leadership.data));
  assert.ok(leadership.data.sections.find(x=>x.id==='tasks').items.some(x=>x.id===foreignTask.data.item.id));
  assert.equal((await req('/api/department-workspace?department=missing',{token:leader})).status,404);
});
test('department head permissions follow specialty and require appointment',async()=>{
  const departments=(await req('/api/departments',{token:leader})).data.items;
  const recruitment=departments.find(d=>d.id==='recruitment');
  assert.ok(recruitment&&!recruitment.head_id,'Recruitment must be available for this test');
  const created=await req('/api/users',{token:leader,method:'POST',data:{
    username:'recruitworkspace',password:'recruit-workspace-pass123',
    nickname:'Recruit Workspace Manager',role:'head',department_id:'recruitment'
  }});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const login=await req('/api/auth/login',{method:'POST',data:{username:'recruitworkspace',password:'recruit-workspace-pass123'}});
  assert.equal(login.status,200);
  const token=login.cookie.match(/grizzly_session=([a-f0-9]+)/)[1];
  assert.equal(login.data.user.head_appointed,false);
  assert.ok(!login.data.user.permissions.includes('recruitment:manage'));
  assert.equal((await req('/api/applications',{token})).status,403);
  const appoint=await req('/api/departments/recruitment',{method:'PATCH',token:leader,
    data:{title:recruitment.title,head_id:created.data.item.id,version:recruitment.version}});
  assert.equal(appoint.status,200,JSON.stringify(appoint.data));
  const identity=await req('/api/auth/me',{token});
  assert.equal(identity.status,200);
  assert.equal(identity.data.user.head_appointed,true);
  assert.ok(identity.data.user.permissions.includes('recruitment:manage'));
  assert.ok(!identity.data.user.permissions.includes('capt:manage'));
  assert.ok(!identity.data.user.permissions.includes('fleet:manage'));
  assert.equal((await req('/api/applications',{token})).status,200);
  assert.equal((await req('/api/records/capt_matches',{token,method:'POST',
    data:{title:'Неавторизований CAPT',department_id:'recruitment'}})).status,403);
  const updated=(await req('/api/departments',{token:leader})).data.items.find(d=>d.id==='recruitment');
  assert.equal((await req('/api/departments/recruitment',{method:'PATCH',token:leader,
    data:{title:updated.title,head_id:'',version:updated.version}})).status,200);
  assert.equal((await req('/api/applications',{token})).status,403,'Revoked head loses recruitment access immediately');
  const after=await req('/api/auth/me',{token});
  assert.equal(after.data.user.head_appointed,false);
  assert.ok(!after.data.user.permissions.includes('recruitment:manage'));
});
// Run destructive session-revocation coverage last: other integration tests use this member's active session.
test('blocking user revokes sessions and stops access',async()=>{const u=(await req('/api/users',{token:leader})).data.items.find(x=>x.id===memberId);const r=await req(`/api/users/${memberId}`,{method:'PATCH',token:leader,data:{...u,status:'blocked'}});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal((await req('/api/auth/me',{token:member})).status,401);});
