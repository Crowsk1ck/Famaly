/** Grizzly Family API. Runs directly on Cloudflare Workers; no server framework required. */
import { GRIZZLY_RANK_TEMPLATES } from './rank-templates.js';
const STATUSES = ['Заплановано', 'У роботі', 'На перевірці', 'На доопрацювання', 'Погоджено', 'Відхилено', 'Завершено'];
const ROLES = ['leader','deputy','head','member'];
const DEFAULT_PERMISSIONS = {
  leader: ['*'],
  deputy: ['members:read','members:write','tasks:manage','reports:review','promotions:review','events:manage','capt:manage','fleet:manage','recruitment:manage','notices:manage','content:manage','finance:read','stats:read'],
  head: ['members:read','tasks:manage','reports:review','promotions:review','stats:read'],
  member: []
};
const HEAD_DEPARTMENT_PERMISSIONS = Object.freeze({
  capt:['capt:manage'],
  farm:[],
  fleet:['fleet:manage'],
  discipline:['discipline:manage'],
  recruitment:['recruitment:manage'],
  events:['events:manage','notices:manage']
});
const MODULES = {
  tasks: {manage:'tasks:manage', memberRead:true, memberUpdate:true},
  reports: {manage:'reports:review', memberRead:true, memberCreate:true, review:true},
  promotions: {manage:'promotions:review', memberRead:true, memberCreate:true, review:true},
  events: {manage:'events:manage', memberRead:true},
  capt_matches: {manage:'capt:manage', memberRead:true},
  capt_training: {manage:'capt:manage', memberRead:true},
  capt_attendance: {manage:'capt:manage', memberRead:true, memberCreate:true},
  vehicles: {manage:'fleet:manage', memberRead:true},
  vehicle_loans: {manage:'fleet:manage', memberRead:true, memberCreate:true},
  discipline: {manage:'discipline:manage', ownerRead:true},
  blacklist: {manage:'discipline:manage', restricted:true},
  notices: {manage:'notices:manage', memberRead:true},
  gallery: {manage:'content:manage', memberRead:true},
  public_news: {manage:'content:manage'},
  public_team: {manage:'content:manage'},
  public_achievements: {manage:'content:manage'},
  public_calendar: {manage:'content:manage'},
  templates: {manage:'notices:manage', memberRead:true},
  contributions: {manage:'finance:manage', restricted:true},
  expenses: {manage:'finance:manage', restricted:true},
  bonuses: {manage:'finance:manage', restricted:true},
  capt_payments: {manage:'finance:manage', restricted:true}
};
// Department workspaces reuse existing records and privileges; no parallel ledger or D1 tables.
const DEPARTMENT_WORKSPACE_MODULES = [
 ['tasks','Завдання','Робота'],['reports','Звіти','Робота'],['promotions','Підвищення','Робота'],
 ['events','Заходи','Робота'],['capt_matches','CAPT — бої','CAPT'],['capt_training','CAPT — тренування','CAPT'],
 ['capt_attendance','CAPT — участь','CAPT'],['vehicles','Автопарк','Ресурси'],
 ['vehicle_loans','Видача транспорту','Ресурси'],['discipline','Дисципліна','Адміністрування'],
 ['blacklist','Чорний список','Адміністрування'],['notices','Оголошення','Адміністрування'],
 ['templates','Шаблони','Адміністрування'],['gallery','Галерея','Контент'],
 ['public_news','Новини сайту','Контент'],['public_team','Керівництво сайту','Контент'],
 ['public_achievements','Досягнення сайту','Контент'],['public_calendar','Календар сайту','Контент']
];
// Operational goals are editable only by the family leader; they never trigger payouts.
// A goal of zero means "no target" and is excluded from progress percentages.
const DEPARTMENT_WEEKLY_METRICS=Object.freeze({
 capt:[['capt_matches_done','Завершені CAPT-бої','capt_matches'],['capt_training_done','Проведені тренування','capt_training'],['capt_attendance_approved','Підтверджені участі','capt_attendance']],
 farm:[['tasks_done','Виконані завдання','tasks'],['reports_approved','Погоджені звіти','reports'],['contracts_settled','Нараховані контракти','contracts']],
 fleet:[['vehicle_loans_done','Повернення транспорту','vehicle_loans'],['tasks_done','Виконані завдання','tasks'],['reports_approved','Погоджені звіти','reports']],
 discipline:[['discipline_resolved','Завершені перевірки','discipline'],['tasks_done','Виконані завдання','tasks'],['reports_approved','Погоджені звіти','reports']],
 recruitment:[['applications_accepted','Прийняті кандидати','applications'],['tasks_done','Виконані завдання','tasks'],['reports_approved','Погоджені звіти','reports']],
 events:[['events_done','Проведені заходи','events'],['notices_published','Опубліковані оголошення','notices'],['tasks_done','Виконані завдання','tasks']]
});
function weeklyGoalKey(departmentId){return 'department_goals_'+departmentId;}

const ABSENCE_MODULE='absence_requests';
const ABSENCE_TYPES=Object.freeze({vacation:'Відпустка',inactive:'Тимчасовий неактив'});
function dateOnly(value){
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
 !Number.isNaN(Date.parse(value+'T00:00:00Z'))&&
 new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
}
function validAbsenceDates(start,end){
 if(!dateOnly(start)||!dateOnly(end))fail(400,'Введіть коректні дати початку та завершення');
 const days=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;
 if(days<1||days>90)fail(400,'Тривалість відсутності: від 1 до 90 днів');
 const today=new Date().toISOString().slice(0,10);
 if(start<today)fail(400,'Не можна подавати нову заявку на минулі дати');
 if(start>new Date(Date.now()+366*86400000).toISOString().slice(0,10))
  fail(400,'Заявку можна оформити не більш ніж на рік наперед');
}
function canReviewAbsence(user,record){
 if(user.id===record.owner_id)return false;
 if(user.role==='leader'||user.role==='deputy')return true;
 return user.role==='head'&&user.head_appointed&&!!record.department_id&&user.department_id===record.department_id;
}
function visibleAbsence(user,record){
 return user.id===record.owner_id||user.role==='leader'||user.role==='deputy'||
  (user.role==='head'&&user.head_appointed&&record.department_id===user.department_id);
}
function absenceView(row){
 const x=mapRecord(row);
 return {id:x.id,title:x.title,details:x.details,status:x.status,owner_id:x.owner_id,
  department_id:x.department_id,starts_at:x.starts_at,ends_at:x.ends_at,
  type:x.extra.type,review_comment:x.extra.review_comment||'',
  reviewer_id:x.extra.reviewer_id||null,created_at:x.created_at,updated_at:x.updated_at,version:x.version};
}
async function activitySnapshot(db,viewer,departmentId){
 if(!['leader','deputy','head','member'].includes(viewer.role))fail(403,'Недостатньо прав');
 if(viewer.role==='head'&&!viewer.head_appointed)fail(403,'Призначення керівника не підтверджено');
 if(viewer.role==='head'&&departmentId&&departmentId!==viewer.department_id)fail(403,'Доступ тільки до власного підрозділу');
 const users=await allRows(db,"SELECT id,nickname,department_id,role,status FROM users WHERE status='active' ORDER BY nickname COLLATE NOCASE");
 const allowed=users.filter(x=>viewer.role==='leader'||viewer.role==='deputy'?
  (!departmentId||x.department_id===departmentId):
  viewer.role==='head'?x.department_id===viewer.department_id:x.id===viewer.id);
 const day7=new Date(Date.now()-7*86400000).toISOString();
 const day30=new Date(Date.now()-30*86400000).toISOString();
 // Only operational actions; logins, profile edits, and money movements do not count as RP activity.
 const [actions,absences]=await Promise.all([
  allRows(db,`SELECT actor_id,MAX(created_at) AS last_action,COUNT(*) AS count_30,
   SUM(CASE WHEN created_at>=? THEN 1 ELSE 0 END) AS count_7 FROM audit
   WHERE created_at>=? AND action IN ('create','update','review','submit')
   AND entity IN ('tasks','reports','promotions','events','capt_matches','capt_training',
    'capt_attendance','vehicles','vehicle_loans','discipline','notices','gallery',
    'public_news','department_weekly_report')
   GROUP BY actor_id`,day7,day30),
  allRows(db,"SELECT owner_id,starts_at,ends_at,extra FROM records WHERE module=? AND status='Погоджено' AND deleted_at IS NULL",ABSENCE_MODULE)
 ]);
 const totals=new Map(actions.map(x=>[x.actor_id,x]));
 const today=new Date().toISOString().slice(0,10);
 const items=allowed.map(x=>{
  const a=totals.get(x.id);
  const leave=absences.find(r=>r.owner_id===x.id&&r.starts_at<=today&&r.ends_at>=today);
  return {id:x.id,nickname:x.nickname,department_id:x.department_id,role:x.role,
   actions_7:Number(a?.count_7||0),actions_30:Number(a?.count_30||0),
   last_action:a?.last_action||null,
   absence:leave?parseJson(leave.extra,{}).type||'vacation':null};
 });
 return {items,periods:[7,30],basis:'Дії у панелі GRIZZLY (не час у GTA 5)'};
}

function weeklyMetrics(departmentId,visibleRecords,contracts,applications,goals,from=Date.now()-7*86400000,to=Date.now()){
 const rows=DEPARTMENT_WEEKLY_METRICS[departmentId]||[['tasks_done','Виконані завдання','tasks'],['reports_approved','Погоджені звіти','reports']];
 const isRecent=(date)=>!!date&&Number.isFinite(Date.parse(date))&&Date.parse(date)>=from&&Date.parse(date)<to;
 const countRecords=(module,statuses)=>visibleRecords.filter(r=>r.module===module&&statuses.includes(r.status)&&isRecent(r.updated_at||r.created_at)).length;
 return rows.map(([id,title,source])=>{
  let actual=0;
  if(id==='tasks_done')actual=countRecords('tasks',['Завершено']);
  else if(id==='reports_approved')actual=countRecords('reports',['Погоджено','Завершено']);
  else if(id==='capt_matches_done')actual=countRecords('capt_matches',['Завершено']);
  else if(id==='capt_training_done')actual=countRecords('capt_training',['Завершено']);
  else if(id==='capt_attendance_approved')actual=countRecords('capt_attendance',['Погоджено','Завершено']);
  else if(id==='vehicle_loans_done')actual=countRecords('vehicle_loans',['Завершено']);
  else if(id==='discipline_resolved')actual=countRecords('discipline',['Завершено']);
  else if(id==='events_done')actual=countRecords('events',['Завершено']);
  else if(id==='notices_published')actual=countRecords('notices',['Погоджено','Завершено']);
  else if(id==='contracts_settled')actual=contracts.filter(c=>isRecent(c.settled_at)).length;
  else if(id==='applications_accepted')actual=applications.filter(a=>applicationStatus(a.status)==='Прийнято'&&isRecent(a.updated_at)).length;
  const target=Number.isInteger(goals?.[id])&&goals[id]>=0&&goals[id]<=100?goals[id]:0;
  return {id,title,source,actual,target};
 });
}
// Last *completed* UTC Mon–Sun week. Reports are generated from existing records;
 // they never post ledger entries, send payments or create financial obligations.
function completedReportWeek(){
 const nowDate=new Date(),dow=(nowDate.getUTCDay()+6)%7;
 const currentMonday=Date.UTC(nowDate.getUTCFullYear(),nowDate.getUTCMonth(),nowDate.getUTCDate()-dow);
 const from=currentMonday-7*86400000;
 return {from,to:currentMonday,start:new Date(from).toISOString().slice(0,10),
   end:new Date(currentMonday-86400000).toISOString().slice(0,10)};
}
function weeklyReportRecordId(departmentId,start){return 'dept-week-'+departmentId+'-'+start;}
async function departmentWeekSnapshot(db,department,user,period){
 const [records,contracts,goals,applications,people,submitted]=await Promise.all([
  allRows(db,'SELECT module,status,owner_id,assignee_id,department_id,updated_at,created_at FROM records WHERE department_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 3000',department.id),
  allRows(db,'SELECT settled_at,department_id FROM contracts WHERE department_id=? ORDER BY created_at DESC LIMIT 1500',department.id),
  db.prepare('SELECT value FROM settings WHERE key=?').bind(weeklyGoalKey(department.id)).first(),
  department.id==='recruitment'?allRows(db,'SELECT status,updated_at FROM applications ORDER BY created_at DESC LIMIT 2000'):Promise.resolve([]),
  db.prepare("SELECT COUNT(*) AS total FROM users WHERE department_id=? AND status='active'").bind(department.id).first(),
  db.prepare("SELECT id,status,created_at,owner_id,extra FROM records WHERE id=? AND module='reports' AND deleted_at IS NULL").bind(weeklyReportRecordId(department.id,period.start)).first()
 ]);
 const scoped=records.filter(r=>permittedRecord(user,r.module,r));
 const metrics=weeklyMetrics(department.id,scoped,contracts,applications,parseJson(goals?.value||'{}',{}),period.from,period.to);
 const achieved=metrics.filter(x=>x.target>0&&x.actual>=x.target).length;
 const targeted=metrics.filter(x=>x.target>0).length;
 return {department_id:department.id,department_title:department.title,
   head_id:department.head_id||null,head_name:department.head_name||'',
   head_active:department.head_status==='active',week_start:period.start,week_end:period.end,
   members_active:Number(people?.total||0),metrics,goals_met:achieved,goals_set:targeted,
   report:{id:submitted?.id||null,status:submitted?.status||'Не подано',
      submitted_at:submitted?.created_at||null,submitted_by:submitted?.owner_id||null}};
}
function departmentReportText(snapshot,comment){
 const lines=['Тижневий звіт · '+snapshot.department_title,
  'Період (UTC): '+snapshot.week_start+' — '+snapshot.week_end,
  'Активних учасників: '+snapshot.members_active,
  'Виконано планів: '+snapshot.goals_met+' / '+snapshot.goals_set,
  ...snapshot.metrics.map(x=>x.title+': '+x.actual+(x.target?' / '+x.target:' (ціль не задана)'))];
 if(comment)lines.push('Коментар керівника: '+comment);
 return lines.join('\n').slice(0,3000);
}
const PUBLIC_SETTINGS = ['family_name','tagline','history','discord_url','rules','requirements'];
const ALL_SETTINGS = [...PUBLIC_SETTINGS,'treasury_percent','capt_afk_rate','capt_battle_rate'];

class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
function fail(status,message){throw new HttpError(status,message);}
function str(x,max=500){return String(x??'').trim().slice(0,max);}
function uuid(){return crypto.randomUUID();}
function now(){return new Date().toISOString();}
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});}
async function body(req){const n=Number(req.headers.get('content-length')||0);if(n>256000)fail(413,'Завеликий запит');const raw=await req.text();if(raw.length>256000)fail(413,'Завеликий запит');try{return JSON.parse(raw);}catch{fail(400,'Некоректний JSON');}}
function parseJson(v,fallback){try{return JSON.parse(v);}catch{return fallback;}}
function uniqueIds(value,limit=100){if(!Array.isArray(value)||value.length>limit)fail(400,'Некоректний список учасників');return [...new Set(value.map(x=>str(x,80)).filter(Boolean))];}
function evidence(value){if(!Array.isArray(value)||value.length>30)fail(400,'Некоректний список доказів');return value.map(link=>{const s=str(link,700);let u;try{u=new URL(s);}catch{fail(400,'Некоректне посилання на доказ');}if(u.protocol!=='https:'||!['ibb.co','i.ibb.co'].includes(u.hostname)||!u.pathname||u.pathname==='/')fail(400,'Для доказів використовуйте HTTPS-посилання ImgBB');return s;});}
function money(v){if(!Number.isSafeInteger(Number(v))||Number(v)<0||Number(v)>1_000_000_000_000)fail(400,'Сума має бути цілим невід’ємним числом');return Number(v);}
function percent(v){const x=Number(v);if(!Number.isInteger(x)||x<0||x>100)fail(400,'Відсоток повинен бути від 0 до 100');return x;}
function validStatus(v){if(!STATUSES.includes(v))fail(400,'Недопустимий статус');return v;}
// Recruitment uses a dedicated 3-state workflow, independent of record statuses.
const APPLICATION_STATUSES=['Очікує','Прийнято','Відхилено'];
function applicationStatus(raw){
  if(raw==='Погоджено'||raw==='Завершено'||raw==='Прийнято')return 'Прийнято';
  if(raw==='Відхилено')return 'Відхилено';
  return 'Очікує';
}
function validApplicationStatus(value){
  if(!APPLICATION_STATUSES.includes(value))fail(400,'Статус заявки: Очікує, Прийнято або Відхилено');
  return value;
}
function applicationView(record){return {...record,status:applicationStatus(record.status)};}
function dateInput(v){const s=str(v,40);if(!s)return '';if(!/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d(?::\d\d)?)?$/.test(s))fail(400,'Невірний формат дати');const [year,month,day,hour=0,minute=0,second=0]=s.split(/[-T:]/).map(Number);const t=new Date(Date.UTC(year,month-1,day,hour,minute,second));if(t.getUTCFullYear()!==year||t.getUTCMonth()!==month-1||t.getUTCDate()!==day||t.getUTCHours()!==hour||t.getUTCMinutes()!==minute||t.getUTCSeconds()!==second)fail(400,'Некоректна календарна дата');return s;}
function tokenValue(){const b=new Uint8Array(32);crypto.getRandomValues(b);return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function sha256(s){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function fromHex(s){return new Uint8Array(s.match(/.{2}/g)?.map(v=>parseInt(v,16))||[]);}
function toHex(b){return [...b].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function hashPassword(password){if(typeof password!=='string'||password.length<12||password.length>128)fail(400,'Пароль: 12–128 символів');const salt=new Uint8Array(16);crypto.getRandomValues(salt);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256);return `pbkdf2-sha256$100000$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;}
export async function verifyPassword(password,encoded){if(typeof password!=='string'||password.length>128)return false;const parts=String(encoded||'').split('$');if(parts.length!==4||parts[0]!=='pbkdf2-sha256'||parts[1]!=='100000')return false;const salt=fromHex(parts[2]), expected=fromHex(parts[3]);if(salt.length!==16||expected.length!==32)return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256));let diff=0;for(let i=0;i<32;i++)diff |=actual[i]^expected[i];return diff===0;}
function permissions(user){const p=parseJson(user.permissions,[]);if(p&&!Array.isArray(p)&&p.custom===true&&Array.isArray(p.items))return p.items;const base=DEFAULT_PERMISSIONS[user.role]||[];return user.role==='head'?[...new Set([...base,...(HEAD_DEPARTMENT_PERMISSIONS[user.department_id]||[])])]:base;}
function can(user,perm){if(!user)return false;if(user.role==='head'&&(perm.startsWith('finance:')||perm==='members:write'||(!user.head_appointed&&perm!=='members:read'&&perm!=='stats:read')))return false;return user.role==='leader'||permissions(user).includes('*')||permissions(user).includes(perm);}
function requirePerm(user,perm){if(!can(user,perm))fail(403,'Недостатньо прав');}
function manageInDepartment(user,department){return user.role!=='head'||(!!user.department_id && user.department_id===department);}
function cookie(req,token){const host=new URL(req.url).hostname;const secure=(host!=='localhost'&&host!=='127.0.0.1')?'; Secure':'';return `grizzly_session=${token}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=604800`;}
function clearCookie(req){return cookie(req,'')+'; Max-Age=0';}
function safeUser(u){if(!u)return null;return {id:u.id,username:u.username,nickname:u.nickname,game_id:u.game_id,discord:u.discord,role:u.role,permissions:u.role==='head'&&!u.head_appointed?['members:read','stats:read']:permissions(u),head_appointed:u.role==='head'?!!u.head_appointed:undefined,custom_permissions:parseJson(u.permissions,[]),rank_id:u.rank_id,department_id:u.department_id,joined_at:u.joined_at,status:u.status,activity:u.activity,version:u.version,created_at:u.created_at,updated_at:u.updated_at};}
async function audit(db,user,action,entity,id,detail=''){await db.prepare('INSERT INTO audit(id,actor_id,actor_name,action,entity,entity_id,detail,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(uuid(),user?.id||'system',user?.username||'system',action,entity,id,str(detail,1000),now()).run();}
async function notify(db,userId,title,details=''){if(!userId)return;await db.prepare('INSERT INTO notifications(id,user_id,title,details,created_at) VALUES(?,?,?,?,?)').bind(uuid(),userId,str(title,150),str(details,600),now()).run();}
// A Discord webhook is a credential. Never store it in D1, echo it in JSON,
// or include it in diagnostic logs. Configure DISCORD_WEBHOOK_URL as a Worker secret.
export function validDiscordWebhookUrl(value){
  if(typeof value!=='string'||!value.trim())return false;
  try{
    const u=new URL(value.trim());
    return u.protocol==='https:'&&['discord.com','discordapp.com','canary.discord.com'].includes(u.hostname)&&u.port===''&&
      !u.username&&!u.password&&!u.search&&!u.hash&&
      /^\/api\/webhooks\/\d{17,22}\/[A-Za-z0-9._-]{30,}\/?$/.test(u.pathname);
  }catch{return false;}
}
export function discordWebhookDiagnostic(value){
  const present=typeof value==='string'&&!!value.trim();
  return {configured:present&&validDiscordWebhookUrl(value),reason:!present?'missing':validDiscordWebhookUrl(value)?'ready':'invalid'};
}
function discordSafe(value,limit=180){
  return str(value,limit).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/@/g,'@\u200b').replace(/<(?=[@#])/g,'&lt;');
}
const DISCORD_NOTIFY_KINDS=['applications','decisions','events','capt','news','announcements'];

const DISCORD_WEBHOOK_ROUTES={
  applications:'DISCORD_WEBHOOK_APPLICATIONS',
  decisions:'DISCORD_WEBHOOK_DECISIONS',
  events:'DISCORD_WEBHOOK_EVENTS',
  capt:'DISCORD_WEBHOOK_CAPT',
  news:'DISCORD_WEBHOOK_NEWS',
  announcements:'DISCORD_WEBHOOK_ANNOUNCEMENTS'
};
const DISCORD_LEGACY_KINDS=['applications','decisions','events'];
const APPLICATION_WEBHOOK_ROUTES={
  application_waiting:'DISCORD_WEBHOOK_APPLICATIONS_WAITING',
  application_accepted:'DISCORD_WEBHOOK_APPLICATIONS_ACCEPTED',
  application_rejected:'DISCORD_WEBHOOK_APPLICATIONS_REJECTED'
};
function applicationWebhookKind(status){
  return status==='Прийнято'?'application_accepted':status==='Відхилено'?'application_rejected':'application_waiting';
}
function discordDestination(env,kind){
  if(kind==='test')return env.DISCORD_WEBHOOK_URL;
  if(Object.hasOwn(APPLICATION_WEBHOOK_ROUTES,kind)){
    const specific=env[APPLICATION_WEBHOOK_ROUTES[kind]];
    if(typeof specific==='string'&&specific.trim())return specific;
    // Preserve existing recruitment notifications until all dedicated secrets are configured.
    return discordDestination(env,kind==='application_waiting'?'applications':'decisions');
  }
  if(!DISCORD_NOTIFY_KINDS.includes(kind))return undefined;
  const specific=env[DISCORD_WEBHOOK_ROUTES[kind]];
  if(typeof specific==='string'&&specific.trim())return specific;
  return DISCORD_LEGACY_KINDS.includes(kind)?env.DISCORD_WEBHOOK_URL:undefined;
}
export function applicationRouteDiagnostics(env){
  const result={};
  const existing=Object.fromEntries(DISCORD_NOTIFY_KINDS.map(kind=>[kind,discordDestination(env,kind)]));
  for(const kind of Object.keys(APPLICATION_WEBHOOK_ROUTES)){
    const raw=env[APPLICATION_WEBHOOK_ROUTES[kind]];
    const explicit=typeof raw==='string'&&!!raw.trim();
    const source=discordDestination(env,kind);
    const checked=discordWebhookDiagnostic(source);
    if(!explicit){
      result[kind]=checked.configured?{configured:true,reason:'legacy',separate:false}:checked;
      continue;
    }
    if(checked.configured){
      const url=String(source).trim();
      const duplicates=Object.keys(APPLICATION_WEBHOOK_ROUTES).filter(k=>k!==kind&&
        validDiscordWebhookUrl(env[APPLICATION_WEBHOOK_ROUTES[k]])&&
        String(env[APPLICATION_WEBHOOK_ROUTES[k]]).trim()===url);
      const shared=Object.values(existing).some(v=>validDiscordWebhookUrl(v)&&String(v).trim()===url);
      if(duplicates.length||shared){
        result[kind]={configured:false,reason:'duplicate',separate:false};
        continue;
      }
    }
    result[kind]={...checked,separate:checked.configured};
  }
  return result;
}
// Different Cloudflare secrets are required for the three public editorial channels.
// Matching webhook URLs would collapse them into the same destination.
export function discordRouteDiagnostics(env){
  const result={};
  const sources=Object.fromEntries(DISCORD_NOTIFY_KINDS.map(kind=>[kind,discordDestination(env,kind)]));
  for(const kind of DISCORD_NOTIFY_KINDS){
    const status=discordWebhookDiagnostic(sources[kind]);
    if(status.configured&&['capt','news','announcements'].includes(kind)){
      const raw=String(sources[kind]).trim();
      if(Object.entries(sources).some(([other,value])=>other!==kind&&validDiscordWebhookUrl(value)&&String(value).trim()===raw)){
        result[kind]={configured:false,reason:'duplicate'};
        continue;
      }
    }
    result[kind]=status;
  }
  return result;
}

function publicNewsDiscordKind(category){return category==='capt'?'capt':category==='announcement'?'announcements':'news';}
function discordEnvAllowed(env,kind){
  return env['DISCORD_NOTIFY_'+String(kind).toUpperCase()]!=='false';
}
async function discordPreferences(db,env){
  const keys=DISCORD_NOTIFY_KINDS.map(k=>'discord_notify_'+k);
  const rows=await allRows(db,'SELECT key,value,version FROM settings WHERE key IN ('+keys.map(()=>'?').join(',')+')',...keys);
  const map=Object.fromEntries(rows.map(r=>[r.key,r]));
  const enabled=Object.fromEntries(DISCORD_NOTIFY_KINDS.map(k=>[k,map['discord_notify_'+k]?.value!=='false']));
  return {enabled,
    versions:Object.fromEntries(DISCORD_NOTIFY_KINDS.map(k=>[k,Number(map['discord_notify_'+k]?.version||0)])),
    categories:Object.fromEntries(DISCORD_NOTIFY_KINDS.map(k=>[k,enabled[k]&&discordEnvAllowed(env,k)])),
    lockedByEnvironment:Object.fromEntries(DISCORD_NOTIFY_KINDS.map(k=>[k,!discordEnvAllowed(env,k)])),
    migrationRequired:rows.length!==keys.length};
}
async function discordEnabled(db,env,kind){
  if(!DISCORD_NOTIFY_KINDS.includes(kind)||!discordEnvAllowed(env,kind))return false;
  const row=await db.prepare('SELECT value FROM settings WHERE key=?').bind('discord_notify_'+kind).first();
  return !row||row.value==='true';
}
async function recordDiscordDelivery(db,kind,error=null){
  const match=error?String(error.message).match(/\(HTTP (\d{3})\)$/):null;
  const httpStatus=match?Number(match[1]):null;
  const code=error?(httpStatus?'http_error':String(error.message).includes('з’єднання')?'network_error':'configuration_error'):'';
  try{
    await db.prepare('INSERT INTO discord_delivery_log(id,kind,status,http_status,error_code,created_at) VALUES(?,?,?,?,?,?)')
      .bind(uuid(),kind,error?'failed':'sent',httpStatus,code,now()).run();
    await db.prepare('DELETE FROM discord_delivery_log WHERE id IN (SELECT id FROM discord_delivery_log ORDER BY created_at DESC LIMIT -1 OFFSET 300)').run();
  }catch{
    // Delivery remains functional until migration 0003 is applied; never log credentials.
    console.error('GRIZZLY Discord log unavailable; apply D1 migration 0003');
  }
}
export function buildDiscordNotification(kind,info={}){
  const label={applications:'📝 Нова заявка GRIZZLY',decisions:'📋 Рішення за заявкою',events:'📅 Новий захід GRIZZLY',capt:'🎯 CAPT-оголошення GRIZZLY',news:'📰 Новина GRIZZLY',announcements:'📢 Оголошення GRIZZLY',test:'🐻 Перевірка Discord GRIZZLY'}[kind];
  if(!label)throw new Error('Невідомий тип Discord-сповіщення');
  const fields=[];
  if(info.nickname)fields.push({name:'Ігровий нік',value:discordSafe(info.nickname,80),inline:true});
  if(info.gameId)fields.push({name:'Ігровий ID',value:discordSafe(info.gameId,40),inline:true});
  if(info.status)fields.push({name:kind==='applications'?'Статус заявки':'Рішення',value:discordSafe(info.status,70),inline:true});
  if(info.event)fields.push({name:kind==='capt'?'CAPT-оголошення':kind==='news'?'Заголовок новини':kind==='announcements'?'Оголошення':'Подія',value:discordSafe(info.event,150),inline:false});
  if(info.message&&kind==='announcements')fields.push({name:'Текст оголошення',value:discordSafe(info.message,950),inline:false});
  if(info.startsAt)fields.push({name:'Час за Києвом',value:discordSafe(info.startsAt,28).replace('T',' · '),inline:true});
  if(info.location)fields.push({name:'Місце',value:discordSafe(info.location,120),inline:true});
  return {username:'GRIZZLY FAMILY',allowed_mentions:{parse:[]},
    embeds:[{title:label,color:kind==='decisions'?0xF0A44F:kind==='events'||kind==='capt'?0xE84255:0x6D8B9E,
      description:kind==='test'?'З’єднання із сайтом працює. Повідомлення з’являтимуться після відповідних дій.':
        kind==='applications'?'Створено нову заявку. Перегляньте її в закритій панелі рекрутингу.':
        kind==='decisions'?'Статус заявки оновлено керівництвом.':kind==='capt'?'Опубліковано CAPT-оголошення. Деталі доступні на сторінці новин сім’ї.':kind==='news'?'На сайті GRIZZLY з’явилася нова публічна новина.':kind==='announcements'?'Керівництво опублікувало оголошення для сім’ї.':'Опубліковано захід у календарі сім’ї.',
      fields,footer:{text:'GRIZZLY · Автоматичне сповіщення'},timestamp:new Date().toISOString()}]
  };
}
async function sendDiscordWebhook(env,kind,info,targetKind=kind){
  const destinations=Object.hasOwn(APPLICATION_WEBHOOK_ROUTES,targetKind)?
    applicationRouteDiagnostics(env):discordRouteDiagnostics(env);
  if(targetKind!=='test'&&destinations[targetKind]?.reason==='duplicate')
    throw new Error('Webhook категорії повторює інший Discord webhook');
  const webhook=discordDestination(env,targetKind);
  if(!validDiscordWebhookUrl(webhook))
    throw new Error('Discord webhook для категорії '+String(targetKind)+' відсутній або має невірний формат');
  let response;
  try{
    response=await fetch(webhook.trim(),{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(buildDiscordNotification(kind,info))
    });
  }catch{
    // Transport errors can contain the full URL (including webhook token).
    // Always replace them with a safe, generic message.
    throw new Error('Немає з’єднання з Discord');
  }
  if(!response.ok){
    const messages={400:'Discord відхилив повідомлення',401:'Discord відхилив токен webhook',403:'Немає доступу до Discord-каналу',404:'Webhook не існує або був видалений',429:'Discord обмежив частоту запитів'};
    throw new Error((messages[response.status]||'Discord повернув помилку')+' (HTTP '+response.status+')');
  }
  return true;
}
function queueDiscord(ctx,db,env,kind,info,targetKind=kind){
  if(!DISCORD_NOTIFY_KINDS.includes(kind))return;
  const task=(async()=>{
    if(!await discordEnabled(db,env,kind))return;
    let failure=null;
    try{await sendDiscordWebhook(env,kind,info,targetKind);}catch(e){failure=e;}
    await recordDiscordDelivery(db,kind,failure);
    if(failure)console.error('GRIZZLY Discord delivery failed:',String(failure.message).slice(0,90));
  })().catch(()=>console.error('GRIZZLY Discord dispatch failed'));
  if(ctx&&typeof ctx.waitUntil==='function')ctx.waitUntil(task);
  return task;
}
async function markHeadAppointment(db,user){if(user.role==='head'){const row=await db.prepare('SELECT head_id FROM departments WHERE id=?').bind(user.department_id).first();user.head_appointed=!!row&&row.head_id===user.id;}return user;}
async function auth(req,db){const match=(req.headers.get('cookie')||'').match(/(?:^|;\s*)grizzly_session=([a-f0-9]{64})(?:;|$)/);if(!match)fail(401,'Потрібно увійти');const hashed=await sha256(match[1]);const u=await db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'").bind(hashed,now()).first();if(!u)fail(401,'Сесію завершено. Увійдіть повторно');return markHeadAppointment(db,u);}
function writeSafety(req){if(['POST','PATCH','PUT','DELETE'].includes(req.method)){
  const o=req.headers.get('origin');if(o && o!==new URL(req.url).origin)fail(403,'Неприпустиме походження запиту');
  if(req.headers.get('x-grizzly-client')!=='1')fail(403,'Відсутній захисний заголовок запиту');
}}
async function rateCheck(db,key,max=5,intervalMinutes=15){const row=await db.prepare('SELECT * FROM login_attempts WHERE key=?').bind(key).first();const t=Date.now();if(row?.blocked_until&&new Date(row.blocked_until).getTime()>t)fail(429,'Забагато спроб. Повторіть пізніше');if(row && t-new Date(row.updated_at).getTime()>intervalMinutes*60000)await db.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();const current=await db.prepare('SELECT attempts FROM login_attempts WHERE key=?').bind(key).first();if((current?.attempts||0)>=max)fail(429,'Ліміт спроб вичерпано');}
async function rateFail(db,key,max=5,minutes=15){const t=now();await db.prepare('INSERT INTO login_attempts(key,attempts,updated_at,blocked_until) VALUES(?,1,?,NULL) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1,updated_at=excluded.updated_at').bind(key,t).run();await db.prepare('UPDATE login_attempts SET blocked_until=? WHERE key=? AND attempts>=?').bind(new Date(Date.now()+minutes*60000).toISOString(),key,max).run();}
function publicOrigin(req){const forwarded=req.headers.get('cf-connecting-ip');return forwarded||'unknown';}
async function allRows(db,sql,...args){return (await db.prepare(sql).bind(...args).all()).results||[];}
function permittedRecord(user,mod,r,mode='read'){
  const cfg=MODULES[mod];if(!cfg)return false;
  if(cfg.restricted)return user.role==='leader'||(user.role==='deputy'&&can(user,cfg.manage));
  if(mode==='manage')return can(user,cfg.manage)&&manageInDepartment(user,r.department_id);
  if(mode==='read'){
    if(can(user,cfg.manage)&&manageInDepartment(user,r.department_id))return true;
    if(cfg.ownerRead)return r.owner_id===user.id;
    if(mod==='reports'||mod==='promotions'||mod==='capt_attendance'||mod==='vehicle_loans')return r.owner_id===user.id||r.assignee_id===user.id;
    if(mod==='tasks')return !r.assignee_id||r.assignee_id===user.id||r.owner_id===user.id;
    return !!cfg.memberRead;
  }
  return false;
}
function mapRecord(r){return {...r,evidence:parseJson(r.evidence,[]),extra:parseJson(r.extra,{}),version:Number(r.version)};}
function recordPayload(b,u,mod,old){const cfg=MODULES[mod];let ex=b.extra??(old?parseJson(old.extra,{}):{});if(typeof ex!=='object'||Array.isArray(ex)||ex===null)fail(400,'Невірні додаткові поля');const dept=str(b.department_id||old?.department_id||u.department_id,80)||null;
  return {title:str(b.title??old?.title,160),details:str(b.details??old?.details,3000),status:validStatus(b.status??old?.status??(cfg.review?'На перевірці':'Заплановано')),
    owner_id:old?.owner_id||u.id,assignee_id:str(b.assignee_id??old?.assignee_id,80)||null,department_id:dept,
    amount:money(b.amount??old?.amount??0),starts_at:dateInput(b.starts_at??old?.starts_at??''),ends_at:dateInput(b.ends_at??old?.ends_at??''),
    evidence:evidence(b.evidence??(old?parseJson(old.evidence,[]):[])),extra:ex};
}
async function settings(db,isPublic=false){const rows=await allRows(db,'SELECT key,value FROM settings');return Object.fromEntries(rows.filter(r=>!isPublic||PUBLIC_SETTINGS.includes(r.key)).map(r=>[r.key,r.value]));}
async function safeContractUsers(db,ids){if(!ids.length)fail(400,'Додайте щонайменше одного учасника');const rows=await allRows(db,`SELECT id,status FROM users WHERE id IN (${ids.map(()=>'?').join(',')})`,...ids);if(rows.length!==ids.length||rows.some(r=>r.status!=='active'))fail(400,'Виберіть існуючих активних учасників');}
function validateGalleryPayload(p){
  if(!p.evidence.length)fail(400,'Додайте посилання на фотографію ImgBB');
  const allowed=['capt','cars','meetings','events','other'];
  if(p.extra.gallery_category!==undefined&&!allowed.includes(p.extra.gallery_category))
    fail(400,'Некоректна категорія галереї');
  if(p.extra.featured!==undefined&&typeof p.extra.featured!=='boolean')
    fail(400,'Некоректна ознака рекомендованого фото');
  if(p.status==='Погоджено'&&!p.evidence.some(link=>{
    try{const u=new URL(link);return u.hostname==='i.ibb.co'&&/\.(jpe?g|png|webp|gif)$/i.test(u.pathname);}catch{return false;}
  }))fail(400,'Для публікації потрібне пряме HTTPS-посилання ImgBB на зображення');
}
function validatePublicNewsPayload(p){
  const allowed=['news','event','recruitment','achievement','capt','announcement'];
  if(p.extra.news_category!==undefined&&!allowed.includes(p.extra.news_category))
    fail(400,'Некоректна категорія новини');
  if(p.extra.featured!==undefined&&typeof p.extra.featured!=='boolean')
    fail(400,'Ознака важливої новини має бути логічною');
  if(p.status==='Погоджено'&&(!p.title||!p.details))
    fail(400,'Для публікації потрібні заголовок і текст новини');
}
function validatePublicTeamPayload(p){
  const name=str(p.title,160);
  const position=p.extra.position;
  const sortOrder=p.extra.sort_order??50;
  if(p.status==='Погоджено'&&!name)fail(400,'Вкажіть ігровий нік керівника');
  if(typeof position!=='string'||!position.trim()||position.length>80)
    fail(400,'Посада повинна містити від 1 до 80 символів');
  if(!Number.isInteger(Number(sortOrder))||Number(sortOrder)<1||Number(sortOrder)>99)
    fail(400,'Порядок відображення має бути від 1 до 99');
  if(p.evidence.length>1)fail(400,'Для одного профілю можна додати одне фото');
  if(p.evidence.length){
    const u=new URL(p.evidence[0]);
    if(u.hostname!=='i.ibb.co'||!/\.(jpe?g|png|webp|gif)$/i.test(u.pathname))
      fail(400,'Фото має бути прямим посиланням ImgBB на зображення');
  }
}
function validatePublicAchievementPayload(p){
  const categories=['capt','milestone','event','award'];
  if(!p.extra||typeof p.extra!=='object'||Array.isArray(p.extra))fail(400,'Некоректні дані досягнення');
  if(!categories.includes(p.extra.category??'milestone'))fail(400,'Невідома категорія досягнення');
  if(p.extra.featured!==undefined&&typeof p.extra.featured!=='boolean')fail(400,'Некоректна ознака важливого досягнення');
  const when=p.extra.achieved_on??'';
  if(typeof when!=='string'||(when&&(!/^\d{4}-\d{2}-\d{2}$/.test(when)||(!Number.isFinite(Date.parse(when))||new Date(when).toISOString().slice(0,10)!==when))))
    fail(400,'Дата досягнення повинна мати формат РРРР-ММ-ДД');
  if(p.evidence.length>1)fail(400,'Для досягнення доступна лише одна обкладинка');
  if(p.evidence.length){
    const url=new URL(p.evidence[0]);
    if(url.hostname!=='i.ibb.co'||!/\.(png|jpe?g|webp|gif)$/i.test(url.pathname))fail(400,'Завантажте пряме HTTPS-посилання на картинку ImgBB');
  }
  if(p.status==='Погоджено'&&(!p.title||!p.details||!when))
    fail(400,'Для публікації потрібні назва, опис і дата досягнення');
}
function validatePublicCalendarPayload(p){
  const allowed=['meeting','capt','training','event'];
  if(!allowed.includes(p.extra.category??'event'))fail(400,'Некоректна категорія заходу');
  if(p.extra.location!==undefined&&(typeof p.extra.location!=='string'||p.extra.location.length>120))
    fail(400,'Місце заходу має бути текстом до 120 символів');
  const starts=String(p.starts_at||''),ends=String(p.ends_at||'');
  const checkDateTime=value=>{
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return false;
    const time=new Date(value+'Z');
    return Number.isFinite(time.getTime())&&time.toISOString().slice(0,16)===value;
  };
  if(starts&&!checkDateTime(starts))fail(400,'Некоректна дата початку заходу');
  if(ends&&!checkDateTime(ends))fail(400,'Некоректна дата завершення заходу');
  if(ends&&(!starts||ends<=starts))fail(400,'Завершення заходу має бути після початку');
  if(p.status==='Погоджено'&&(!p.title||!p.details||!starts))
    fail(400,'Для публікації потрібні назва, опис і дата початку');
}
function captMatchSize(extra) {
  const value=extra?.lineup_limit??8;
  const size=Number(value);
  if(!Number.isInteger(size)||size<1||size>50)fail(400,'Розмір CAPT-складу має бути від 1 до 50');
  return size;
}
function captMatchPayload(record,old) {
  const extra=record.extra;
  if(extra.outcome!==undefined && !['','win','loss','draw','cancelled'].includes(extra.outcome))
    fail(400,'Некоректний результат CAPT');
  captMatchSize(extra);
  // Keep the auto-generated roster separate from legacy free-text lineup.
  return record;
}
function captResults(records) {
  const summary={wins:0,losses:0,draws:0,cancelled:0,played:0,win_rate:0};
  for(const r of records){
    if(r.status!=='Завершено')continue;
    const outcome=r.extra?.outcome;
    if(outcome==='win'){summary.wins++;summary.played++;}
    else if(outcome==='loss'){summary.losses++;summary.played++;}
    else if(outcome==='draw'){summary.draws++;summary.played++;}
    else if(outcome==='cancelled')summary.cancelled++;
  }
  summary.win_rate=summary.played?Math.round(summary.wins*100/summary.played):0;
  return summary;
}
function contractView(c){return {...c,participant_ids:parseJson(c.participant_ids,[]),evidence:parseJson(c.evidence,[])};}
export function payoutPreview(amount,rate,ids){const total=money(amount),pct=percent(rate);const members=uniqueIds(ids);if(!members.length)fail(400,'Контракт без учасників');const treasuryBase=Math.floor(total*pct/100),pool=total-treasuryBase,each=Math.floor(pool/members.length),remainder=pool-each*members.length;return {amount:total,treasury_percent:pct,treasury:treasuryBase+remainder,per_member:each,participants:members.length,distributable:each*members.length,rounding_remainder:remainder,allocations:members.map(user_id=>({user_id,amount:each}))};}

async function handleApi(req,env,ctx){const db=env.DB;if(!db)fail(500,'Не налаштовано D1');const url=new URL(req.url),path=url.pathname,method=req.method;writeSafety(req);
  if(path==='/api/health'&&method==='GET')return json({ok:true,service:'grizzly',storage:'D1'});
  if(path==='/api/public'&&method==='GET'){
    const [s,gallery,news,team,achievements,calendar]=await Promise.all([
      settings(db,true),
      allRows(db,"SELECT id,title,details,evidence,extra,created_at FROM records WHERE module='gallery' AND deleted_at IS NULL AND status='Погоджено' ORDER BY created_at DESC LIMIT 100"),
      allRows(db,"SELECT id,title,details,extra,updated_at FROM records WHERE module='public_news' AND deleted_at IS NULL AND status='Погоджено' ORDER BY updated_at DESC LIMIT 60"),
      allRows(db,"SELECT id,title,details,extra,evidence FROM records WHERE module='public_team' AND deleted_at IS NULL AND status='Погоджено' ORDER BY created_at ASC LIMIT 70"),
      allRows(db,"SELECT id,title,details,extra,evidence FROM records WHERE module='public_achievements' AND deleted_at IS NULL AND status='Погоджено' ORDER BY created_at DESC LIMIT 100"),
      allRows(db,"SELECT id,title,details,starts_at,ends_at,extra FROM records WHERE module='public_calendar' AND deleted_at IS NULL AND status='Погоджено' ORDER BY starts_at ASC LIMIT 240")
    ]);
    return json({settings:s,
      gallery:gallery.map(mapRecord).sort((a,b)=>Number(!!b.extra?.featured)-Number(!!a.extra?.featured)).slice(0,48).map(r=>({id:r.id,title:r.title,details:r.details,evidence:r.evidence,created_at:r.created_at,extra:{gallery_category:r.extra?.gallery_category||'other',featured:r.extra?.featured===true}})),
      news:news.map(r=>({id:r.id,title:r.title,details:r.details,updated_at:r.updated_at,
        category:['news','event','recruitment','achievement','capt','announcement'].includes(parseJson(r.extra,{}).news_category)?parseJson(r.extra,{}).news_category:'news',
        featured:parseJson(r.extra,{}).featured===true})).sort((a,b)=>Number(b.featured)-Number(a.featured)||String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,12),
      team:team.map(r=>{const x=parseJson(r.extra,{});return {id:r.id,nickname:r.title,position:str(x.position,80),bio:r.details,order:Number(x.sort_order??50),photo:parseJson(r.evidence,[])[0]||''};}).sort((a,b)=>a.order-b.order||a.nickname.localeCompare(b.nickname,'uk')).slice(0,18),
      achievements:achievements.map(r=>{const x=parseJson(r.extra,{});return {id:r.id,title:r.title,description:r.details,category:['capt','milestone','event','award'].includes(x.category)?x.category:'milestone',achieved_on:x.achieved_on||'',featured:x.featured===true,photo:parseJson(r.evidence,[])[0]||''};}).sort((a,b)=>Number(b.featured)-Number(a.featured)||String(b.achieved_on).localeCompare(String(a.achieved_on))).slice(0,40),
      calendar:calendar.map(r=>{const x=parseJson(r.extra,{});return {id:r.id,title:r.title,description:r.details,starts_at:r.starts_at,ends_at:r.ends_at,category:['meeting','capt','training','event'].includes(x.category)?x.category:'event',location:str(x.location,120)};})
    });
  }
  if(path==='/api/apply'&&method==='POST'){
    const key='apply:'+await sha256(publicOrigin(req));await rateCheck(db,key,3,60);const b=await body(req);const nickname=str(b.nickname,80),gameId=str(b.game_id,40),motivation=str(b.motivation,1400);if(!nickname||!gameId||motivation.length<10)fail(400,'Вкажіть нік, ігровий ID та мотивацію (від 10 символів)');
    const id=uuid(),t=now();await db.prepare('INSERT INTO applications(id,nickname,game_id,discord,experience,motivation,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,nickname,gameId,str(b.discord,120),str(b.experience,700),motivation,'Очікує',t,t).run();await rateFail(db,key,1000,60);queueDiscord(ctx,db,env,'applications',{nickname,gameId,status:'Очікує'},applicationWebhookKind('Очікує'));return json({ok:true,message:'Заявку надіслано. Акаунт не створюється автоматично.'},201);
  }
  if(path==='/api/setup/bootstrap'&&method==='POST'){
    const configured=env.BOOTSTRAP_TOKEN||'';if(configured.length<32)fail(503,'Для створення лідера налаштуйте секрет BOOTSTRAP_TOKEN (мінімум 32 символи)');
    const supplied=req.headers.get('x-bootstrap-token')||'';if(supplied.length!==configured.length)fail(403,'Невірний токен налаштування');let diff=0;for(let i=0;i<configured.length;i++)diff|=configured.charCodeAt(i)^supplied.charCodeAt(i);if(diff)fail(403,'Невірний токен налаштування');
    const existing=await db.prepare('SELECT id FROM users LIMIT 1').first();if(existing)fail(409,'Лідера вже створено. Повторна ініціалізація заборонена');const b=await body(req),username=str(b.username,50).toLowerCase();if(!/^[a-z0-9_.-]{3,50}$/.test(username))fail(400,'Логін: латиниця, цифри, _ . - (від 3 символів)');const pw=await hashPassword(b.password);const id=uuid(),t=now();await db.prepare("INSERT INTO users(id,username,password_hash,nickname,role,joined_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,username,pw,str(b.nickname||'Лідер Grizzly',80),'leader',t.slice(0,10),t,t).run();await audit(db,{id,username},'bootstrap','users',id);return json({ok:true,message:'Лідера створено. Тепер увійдіть через сайт.'},201);
  }
  if(path==='/api/auth/login'&&method==='POST'){
    const b=await body(req),username=str(b.username,50).toLowerCase(),password=String(b.password||'');const ip=await sha256(publicOrigin(req)),key='auth:'+await sha256(ip+'|'+username),ipkey='ip:'+ip;
    await rateCheck(db,key);await rateCheck(db,ipkey,25);const user=await db.prepare('SELECT * FROM users WHERE username=?').bind(username).first();const valid=user&&user.status==='active'&&await verifyPassword(password,user.password_hash);
    if(!valid){await rateFail(db,key);await rateFail(db,ipkey,25);fail(401,'Неправильний логін або пароль');}
    await db.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();const token=tokenValue(),sid=uuid(),t=now(),exp=new Date(Date.now()+7*86400000).toISOString();await db.prepare('INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at,user_agent) VALUES(?,?,?,?,?,?)').bind(sid,user.id,await sha256(token),t,exp,str(req.headers.get('user-agent'),180)).run();await audit(db,user,'login','sessions',sid);return json({user:safeUser(await markHeadAppointment(db,user))},200,{'Set-Cookie':cookie(req,token)});
  }
  const user=await auth(req,db);
  if(path==='/api/auth/me'&&method==='GET')return json({user:safeUser(user)});
  if(path==='/api/auth/logout'&&method==='POST'){
    const token=(req.headers.get('cookie')||'').match(/grizzly_session=([a-f0-9]{64})/)?.[1];if(token)await db.prepare('UPDATE sessions SET revoked_at=? WHERE token_hash=? AND user_id=?').bind(now(),await sha256(token),user.id).run();return json({ok:true},200,{'Set-Cookie':clearCookie(req)});
  }
  if(path==='/api/auth/sessions'&&method==='GET')return json({items:await allRows(db,'SELECT id,created_at,expires_at,revoked_at,user_agent FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 50',user.id)});
  if(path==='/api/auth/password'&&method==='POST'){
    const b=await body(req);if(!await verifyPassword(String(b.old_password||''),user.password_hash))fail(403,'Поточний пароль неправильний');const pw=await hashPassword(b.new_password);await db.batch([db.prepare('UPDATE users SET password_hash=?,updated_at=?,version=version+1 WHERE id=?').bind(pw,now(),user.id),db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=?').bind(now(),user.id)]);await audit(db,user,'password_change','users',user.id);return json({ok:true,reauth:true},200,{'Set-Cookie':clearCookie(req)});
  }
  let m=path.match(/^\/api\/auth\/sessions\/([\w-]+)$/);if(m&&method==='DELETE'){const target=await db.prepare('SELECT user_id FROM sessions WHERE id=?').bind(m[1]).first();if(!target||target.user_id!==user.id)fail(404,'Не знайдено');await db.prepare('UPDATE sessions SET revoked_at=? WHERE id=? AND user_id=?').bind(now(),m[1],user.id).run();return json({ok:true});}
  // Authenticated family roster: public-in-family gameplay fields only.
  // Keep /api/users restricted to own/managed accounts and their private profile data.
  if(path==='/api/members'&&method==='GET'){
    const rows=await allRows(db,'SELECT id,nickname,role,rank_id,department_id,game_id,status,joined_at FROM users ORDER BY created_at DESC');
    return json({items:rows.map(u=>({
      id:u.id,nickname:u.nickname||'Учасник',role:u.role,rank_id:u.rank_id,
      department_id:u.department_id,game_id:u.game_id,status:u.status,joined_at:u.joined_at
    }))});
  }
  if(path==='/api/users'&&method==='GET'){
    const all=await allRows(db,'SELECT * FROM users ORDER BY created_at DESC');return json({items:all.filter(u=>u.id===user.id||can(user,'members:read')&&manageInDepartment(user,u.department_id)).map(safeUser)});
  }
  if(path==='/api/users'&&method==='POST'){
    requirePerm(user,'members:write');if(user.role==='head')fail(403,'Немає прав');const b=await body(req),username=str(b.username,50).toLowerCase();if(!/^[a-z0-9_.-]{3,50}$/.test(username))fail(400,'Логін: латиниця, цифри, _ . - (від 3 символів)');const role=ROLES.includes(b.role)?b.role:'member';if(user.role!=='leader'&&role!=='member')fail(403,'Тільки лідер призначає керівні ролі');const pw=await hashPassword(b.password),id=uuid(),t=now();await db.prepare('INSERT INTO users(id,username,password_hash,nickname,game_id,discord,role,rank_id,department_id,joined_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,username,pw,str(b.nickname,80),str(b.game_id,40),str(b.discord,120),role,b.rank_id?Number(b.rank_id):null,str(b.department_id,80)||null,dateInput(b.joined_at)||t.slice(0,10),t,t).run();await audit(db,user,'create','users',id,username);return json({item:safeUser(await db.prepare('SELECT * FROM users WHERE id=?').bind(id).first())},201);
  }
  m=path.match(/^\/api\/users\/([\w-]+)(?:\/(reset-password))?$/);
  if(m&&m[2]==='reset-password'&&method==='POST'){
    if(user.role!=='leader')fail(403,'Лише лідер може скидати паролі');const target=await db.prepare('SELECT * FROM users WHERE id=?').bind(m[1]).first();if(!target)fail(404,'Не знайдено');const b=await body(req),pw=await hashPassword(b.password);await db.batch([db.prepare('UPDATE users SET password_hash=?,version=version+1,updated_at=? WHERE id=?').bind(pw,now(),target.id),db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=?').bind(now(),target.id)]);await audit(db,user,'reset_password','users',target.id);return json({ok:true});
  }
  if(m&&!m[2]&&method==='PATCH'){
    const old=await db.prepare('SELECT * FROM users WHERE id=?').bind(m[1]).first();if(!old)fail(404,'Не знайдено');const b=await body(req);if(!Number.isInteger(b.version))fail(428,'Потрібна версія запису');const isSelf=old.id===user.id,manager=can(user,'members:write')&&manageInDepartment(user,old.department_id);if(!isSelf&&!manager)fail(403,'Немає прав');
    const role=(manager&&user.role==='leader'&&ROLES.includes(b.role))?b.role:old.role;
    if(!manager&&(['role','rank_id','department_id','status','permissions'].some(k=>Object.prototype.hasOwnProperty.call(b,k))))fail(403,'Недостатньо прав на ці поля');
    if(user.role!=='leader'&&old.role==='leader'&&manager)fail(403,'Зміна лідера заборонена');
    if(b.status==='blocked'&&old.id===user.id)fail(400,'Не можна заблокувати себе');if(old.role==='leader' && role!=='leader' && old.id===user.id)fail(400,'Не можна позбавити себе ролі лідера');
    // A designated head cannot silently lose the role, department or active status.
    const assignedHead=await db.prepare('SELECT id FROM departments WHERE head_id=?').bind(old.id).first();
    if(assignedHead&&(role!=='head'||(manager?str(b.department_id??old.department_id,80):old.department_id)!==assignedHead.id||
      (manager&&b.status==='blocked')))
      fail(409,'Спочатку призначте іншого керівника або зніміть призначення в налаштуваннях підрозділу');
    const customPerms=user.role==='leader'&&Object.prototype.hasOwnProperty.call(b,'permissions')?JSON.stringify({custom:true,items:uniqueIds(b.permissions,40)}):old.permissions;
    const result=await db.prepare('UPDATE users SET nickname=?,game_id=?,discord=?,role=?,permissions=?,rank_id=?,department_id=?,joined_at=?,status=?,activity=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(str(b.nickname??old.nickname,80),str(b.game_id??old.game_id,40),str(b.discord??old.discord,120),role,customPerms,manager?(b.rank_id?Number(b.rank_id):null):old.rank_id,manager?(str(b.department_id,80)||null):old.department_id,manager?dateInput(b.joined_at??old.joined_at):old.joined_at,manager&&['active','blocked'].includes(b.status)?b.status:old.status,str(b.activity??old.activity,100),now(),old.id,b.version).run();if(result.meta.changes!==1)fail(409,'Запис змінив інший користувач. Оновіть дані');
    if(b.status==='blocked')await db.prepare('UPDATE sessions SET revoked_at=? WHERE user_id=?').bind(now(),old.id).run();await audit(db,user,'update','users',old.id);return json({item:safeUser(await db.prepare('SELECT * FROM users WHERE id=?').bind(old.id).first())});
  }
  if(path==='/api/ranks'&&method==='GET')return json({items:await allRows(db,'SELECT * FROM ranks ORDER BY id'),templates:user.role==='leader'?GRIZZLY_RANK_TEMPLATES:undefined});
  if(path==='/api/ranks/apply-templates'&&method==='POST'){
    if(user.role!=='leader')fail(403,'Лише лідер може встановити приклади рангів');
    const b=await body(req), expected=b?.expected;
    if(!Array.isArray(expected)||expected.length<1||expected.length>15)fail(400,'Виберіть від 1 до 15 початкових рангів');
    const unique=new Set(), candidates=[];
    for(const entry of expected){
      const id=entry?.id, version=entry?.version;
      if(!Number.isInteger(id)||id<1||id>15||!Number.isInteger(version)||version<1||unique.has(id))fail(400,'Некоректний список рангів');
      unique.add(id); candidates.push({id,version});
    }
    const records=await allRows(db,'SELECT id,title,is_example,version FROM ranks');
    for(const candidate of candidates){
      const row=records.find(x=>x.id===candidate.id);
      if(!row||row.version!==candidate.version||row.is_example!==1||row.title!==`Ранг ${String(candidate.id).padStart(2,'0')} — приклад`)
        fail(409,'Один із рангів уже налаштовано або змінено. Оновіть список');
    }
    const timestamp=now();
    const statements=candidates.map(({id,version})=>{
      const preset=GRIZZLY_RANK_TEMPLATES[id-1],placeholder=`Ранг ${String(id).padStart(2,'0')} — приклад`;
      return db.prepare('UPDATE ranks SET title=?,requirements=?,checklist=?,is_example=1,version=version+1,updated_at=? WHERE id=? AND version=? AND title=? AND is_example=1')
        .bind(preset.title,preset.requirements,JSON.stringify(preset.checklist),timestamp,id,version,placeholder);
    });
    const results=await db.batch(statements);
    const updated=results.reduce((total,result)=>total+Number(result.meta?.changes||0),0);
    await audit(db,user,'apply_templates','ranks','grizzly',`${updated} із ${candidates.length} початкових рангів`);
    return json({ok:true,updated,skipped:candidates.length-updated});
  }
  m=path.match(/^\/api\/ranks\/(\d+)$/);if(m&&method==='PATCH'){
    if(user.role!=='leader')fail(403,'Лише лідер редагує ранги');const b=await body(req);if(!Number.isInteger(b.version))fail(428,'Потрібна версія');const checklist=Array.isArray(b.checklist)?b.checklist.map(x=>str(x,250)).filter(Boolean):[];if(checklist.length>30)fail(400,'Забагато умов');const r=await db.prepare('UPDATE ranks SET title=?,requirements=?,checklist=?,is_example=0,version=version+1,updated_at=? WHERE id=? AND version=?').bind(str(b.title,100),str(b.requirements,3000),JSON.stringify(checklist),now(),Number(m[1]),b.version).run();if(r.meta.changes!==1)fail(409,'Ранг змінився, оновіть список');await audit(db,user,'update','ranks',m[1]);return json({ok:true});
  }
  m=path.match(/^\/api\/departments\/([\w-]+)\/finance-summary$/);
  if(m&&method==='GET'){
    const dept=await db.prepare('SELECT id,title FROM departments WHERE id=?').bind(m[1]).first();
    if(!dept)fail(404,'Підрозділ не знайдено');
    if(user.role!=='leader'&&user.role!=='deputy'&&!(user.role==='head'&&user.department_id===dept.id))
      fail(403,'Фінансова статистика доступна лише керівнику свого підрозділу та керівництву сім’ї');
    const contracts=await db.prepare(`SELECT COUNT(*) count,COALESCE(SUM(amount),0) total,
      COALESCE(SUM(CASE WHEN settled_at IS NOT NULL THEN amount ELSE 0 END),0) settled_total,
      COALESCE(SUM(CASE WHEN settled_at IS NULL THEN amount ELSE 0 END),0) pending_total,
      SUM(CASE WHEN settled_at IS NOT NULL THEN 1 ELSE 0 END) settled_count
      FROM contracts WHERE department_id=?`).bind(dept.id).first();
    const treasury=await db.prepare(`SELECT COALESCE(SUM(l.amount),0) amount FROM ledger l
      JOIN contracts c ON l.reference='contract:'||c.id
      WHERE l.kind='treasury' AND c.department_id=?`).bind(dept.id).first();
    const payout=await db.prepare(`SELECT COUNT(*) count,COALESCE(SUM(p.amount),0) amount,
      COALESCE(SUM(CASE WHEN pc.confirmed_at IS NOT NULL THEN p.amount ELSE 0 END),0) handed_over
      FROM payouts p JOIN contracts c ON c.id=p.contract_id
      LEFT JOIN payout_confirmations pc ON pc.payout_id=p.id WHERE c.department_id=?`).bind(dept.id).first();
    const capt=await db.prepare(`SELECT COUNT(*) count,
      SUM(CASE WHEN status='Погоджено' OR status='Завершено' THEN 1 ELSE 0 END) approved
      FROM records WHERE department_id=? AND deleted_at IS NULL
      AND module IN ('capt_matches','capt_training','capt_attendance')`).bind(dept.id).first();
    const captPayments=await db.prepare(`SELECT COUNT(*) count,COALESCE(SUM(l.amount),0) total
      FROM ledger l JOIN records r ON l.reference='capt_attendance:'||r.id
      WHERE l.kind='capt' AND r.module='capt_attendance' AND r.department_id=?`).bind(dept.id).first();
    const num=x=>Number(x)||0;
    return json({department_id:dept.id,department_title:dept.title,
      contracts:{count:num(contracts.count),total:num(contracts.total),settled_total:num(contracts.settled_total),
        pending_total:num(contracts.pending_total),settled_count:num(contracts.settled_count)},
      treasury_contract_income:num(treasury.amount),
      payouts:{count:num(payout.count),accrued:num(payout.amount),handed_over:num(payout.handed_over)},
      capt:{records:num(capt.count),approved:num(capt.approved),paid_count:num(captPayments.count),paid_total:num(captPayments.total)}});
  }
  if(path==='/api/leadership-overview'&&method==='GET'){
    if(!['leader','deputy'].includes(user.role))fail(403,'Контроль керівників доступний лише керівництву');
    const departments=await allRows(db,`SELECT d.id,d.title,d.head_id,u.nickname AS head_name,u.status AS head_status
      FROM departments d LEFT JOIN users u ON u.id=d.head_id ORDER BY d.rowid`);
    const week=completedReportWeek();
    const items=await Promise.all(departments.map(d=>departmentWeekSnapshot(db,d,user,week)));
    return json({week_start:week.start,week_end:week.end,items});
  }
  if(path==='/api/department-weekly-report'&&method==='GET'){
    if(!['leader','deputy','head'].includes(user.role))fail(403,'Тижневий звіт доступний лише керівництву');
    const departmentId=str(url.searchParams.get('department'),80);
    if(!departmentId)fail(400,'Оберіть підрозділ');
    if(user.role==='head'&&(departmentId!==user.department_id||!user.head_appointed))fail(403,'Тільки свій призначений підрозділ');
    const department=await db.prepare(`SELECT d.id,d.title,d.head_id,u.nickname AS head_name,u.status AS head_status
      FROM departments d LEFT JOIN users u ON u.id=d.head_id WHERE d.id=?`).bind(departmentId).first();
    if(!department)fail(404,'Підрозділ не знайдено');
    return json({item:await departmentWeekSnapshot(db,department,user,completedReportWeek())});
  }
  if(path==='/api/department-weekly-report'&&method==='POST'){
    if(user.role!=='head'||!user.head_appointed)fail(403,'Звіт подає тільки призначений керівник підрозділу');
    const input=await body(req);
    const departmentId=str(input.department_id,80);
    if(departmentId!==user.department_id)fail(403,'Не можна подавати звіти іншого підрозділу');
    const dept=await db.prepare(`SELECT d.id,d.title,d.head_id,u.nickname AS head_name,u.status AS head_status
      FROM departments d LEFT JOIN users u ON u.id=d.head_id WHERE d.id=?`).bind(departmentId).first();
    if(!dept||dept.head_id!==user.id||dept.head_status!=='active')fail(403,'Призначення керівника не підтверджено');
    const comment=str(input.comment||'',800);
    const week=completedReportWeek();
    if(input.week_start!==week.start)fail(409,'Період звіту змінився. Оновіть дані');
    const snapshot=await departmentWeekSnapshot(db,dept,user,week);
    const id=weeklyReportRecordId(dept.id,week.start),t=now();
    const extra={kind:'department_weekly',week_start:week.start,week_end:week.end,
      metrics:snapshot.metrics,members_active:snapshot.members_active,
      goals_met:snapshot.goals_met,goals_set:snapshot.goals_set,comment};
    const result=await db.prepare(`INSERT OR IGNORE INTO records
      (id,module,title,details,status,owner_id,assignee_id,department_id,amount,starts_at,ends_at,evidence,extra,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
       id,'reports','Тижневий звіт · '+dept.title+' · '+week.start,
       departmentReportText(snapshot,comment),'На перевірці',user.id,null,dept.id,0,
       week.start,week.end,'[]',JSON.stringify(extra),t,t).run();
    if(result.meta.changes!==1)fail(409,'За цей тиждень звіт уже подано');
    await audit(db,user,'submit','department_weekly_report',id,dept.id+' '+week.start);
    const leaders=await allRows(db,"SELECT id FROM users WHERE role='leader' AND status='active'");
    await Promise.all(leaders.map(x=>notify(db,x.id,'Новий тижневий звіт',dept.title+' · '+week.start)));
    return json({id,status:'На перевірці',week_start:week.start},201);
  }
  if(path==='/api/activity'&&method==='GET'){
    const departmentId=str(url.searchParams.get('department'),80);
    if(departmentId&&user.role==='member'&&departmentId!==user.department_id)fail(403,'Тільки особиста активність');
    return json(await activitySnapshot(db,user,departmentId));
  }
  if(path==='/api/absences'&&method==='GET'){
    if(user.role==='head'&&!user.head_appointed)fail(403,'Вас не призначено керівником');
    const rows=await allRows(db,"SELECT * FROM records WHERE module=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 2000",ABSENCE_MODULE);
    return json({items:rows.filter(r=>visibleAbsence(user,r)).map(absenceView)});
  }
  if(path==='/api/absences'&&method==='POST'){
    const input=await body(req);
    const type=str(input.type,20),start=str(input.starts_at,20),end=str(input.ends_at,20);
    if(!ABSENCE_TYPES[type])fail(400,'Оберіть відпустку або тимчасовий неактив');
    validAbsenceDates(start,end);
    const comment=str(input.details||'',700);
    if(comment.length<5)fail(400,'Опишіть причину щонайменше 5 символами');
    const existing=await db.prepare(`SELECT id FROM records
      WHERE module=? AND owner_id=? AND deleted_at IS NULL
      AND status IN ('На перевірці','Погоджено') AND starts_at<=? AND ends_at>=? LIMIT 1`)
      .bind(ABSENCE_MODULE,user.id,end,start).first();
    if(existing)fail(409,'У цей період вже є заявка на відсутність');
    const id=uuid(),t=now(),departmentId=user.department_id||null;
    await db.prepare(`INSERT INTO records
      (id,module,title,details,status,owner_id,assignee_id,department_id,amount,starts_at,ends_at,evidence,extra,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id,ABSENCE_MODULE,ABSENCE_TYPES[type]+' · '+user.nickname,comment,
      'На перевірці',user.id,null,departmentId,0,start,end,'[]',JSON.stringify({type}),t,t).run();
    await audit(db,user,'submit',ABSENCE_MODULE,id,type);
    const managers=await allRows(db,"SELECT id,role,department_id FROM users WHERE status='active' AND role IN ('leader','deputy','head')");
    await Promise.all(managers.filter(m=>m.role!=='head'||
      (m.department_id===departmentId&&m.id!==user.id)).map(m=>notify(db,m.id,'Заявка на відсутність',user.nickname+' · '+ABSENCE_TYPES[type])));
    return json({item:absenceView(await db.prepare('SELECT * FROM records WHERE id=?').bind(id).first())},201);
  }
  m=path.match(/^\/api\/absences\/([\w-]+)$/);
  if(m&&method==='PATCH'){
    const old=await db.prepare("SELECT * FROM records WHERE id=? AND module=? AND deleted_at IS NULL")
      .bind(m[1],ABSENCE_MODULE).first();
    if(!old||!visibleAbsence(user,old))fail(404,'Заявку не знайдено');
    const input=await body(req);
    if(!Number.isInteger(input.version))fail(428,'Оновіть заявку перед зміною');
    const decision=str(input.status,35);
    const ownCancel=user.id===old.owner_id&&decision==='Скасовано';
    if(!ownCancel&&!canReviewAbsence(user,old))fail(403,'Немає прав для розгляду');
    if(ownCancel&&!['На перевірці'].includes(old.status))fail(409,'Погоджену відпустку скасовує керівництво');
    if(!ownCancel&&!['Погоджено','Відхилено','Скасовано'].includes(decision))fail(400,'Некоректне рішення');
    if(!['На перевірці','Погоджено'].includes(old.status)||old.status==='Погоджено'&&decision!=='Скасовано')
      fail(409,'Рішення за заявкою вже ухвалено');
    const extra={...parseJson(old.extra,{}),review_comment:str(input.comment||'',400),reviewer_id:ownCancel?null:user.id};
    const result=await db.prepare('UPDATE records SET status=?,extra=?,updated_at=?,version=version+1 WHERE id=? AND version=?')
      .bind(decision,JSON.stringify(extra),now(),old.id,input.version).run();
    if(result.meta.changes!==1)fail(409,'Заявку вже змінив інший користувач');
    await audit(db,user,'review',ABSENCE_MODULE,old.id,decision);
    if(user.id!==old.owner_id)await notify(db,old.owner_id,'Рішення щодо відсутності',decision);
    return json({ok:true});
  }
  if(path==='/api/department-workspace'&&method==='GET'){
    if(!['leader','deputy','head'].includes(user.role))fail(403,'Панель доступна керівництву');
    const requested=str(url.searchParams.get('department'),80);
    const departmentId=user.role==='head'?user.department_id:requested;
    if(!departmentId)fail(400,'Оберіть підрозділ');
    if(user.role==='head'&&requested&&requested!==departmentId)fail(403,'Доступ лише до свого підрозділу');
    const dept=await db.prepare('SELECT id,title,head_id FROM departments WHERE id=?').bind(departmentId).first();
    if(!dept)fail(404,'Підрозділ не знайдено');
    // Role "head" alone does not grant access. The leader must appoint this exact active head.
    if(user.role==='head'&&dept.head_id!==user.id)fail(403,'Лідер ще не призначив вас керівником цього підрозділу');
    const [allRecords,members,contracts,goalRow,recruitment]=await Promise.all([
      allRows(db,'SELECT * FROM records WHERE department_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1500',dept.id),
      allRows(db,"SELECT id,nickname,role,rank_id,status,joined_at FROM users WHERE department_id=? ORDER BY created_at DESC",dept.id),
      allRows(db,'SELECT * FROM contracts WHERE department_id=? ORDER BY created_at DESC LIMIT 500',dept.id),
      db.prepare('SELECT value,version FROM settings WHERE key=?').bind(weeklyGoalKey(dept.id)).first(),
      dept.id==='recruitment'?allRows(db,"SELECT status,updated_at FROM applications ORDER BY created_at DESC LIMIT 1000"):Promise.resolve([])
    ]);
    const sections=DEPARTMENT_WORKSPACE_MODULES.map(([mod,title,group])=>{
      const cfg=MODULES[mod];
      const items=allRecords.filter(r=>r.module===mod&&permittedRecord(user,mod,r)).map(mapRecord);
      const mayManage=can(user,cfg.manage)&&manageInDepartment(user,dept.id)&&!cfg.restricted;
      const maySubmit=!!cfg.memberCreate;
      return {id:mod,title,group,items,count:items.length,can_create:mayManage||maySubmit,
        can_manage:mayManage,can_review:!!cfg.review&&mayManage,
        attention:items.filter(r=>r.status==='На перевірці').length,
        active:items.filter(r=>!['Завершено','Відхилено','Погоджено'].includes(r.status)).length};
    });
    const visibleRecords=allRecords.filter(r=>permittedRecord(user,r.module,r));
    const currentGoals=parseJson(goalRow?.value||'{}',{});
    const weekly=weeklyMetrics(dept.id,visibleRecords,contracts,recruitment,currentGoals);
    return json({
      department:dept,sections,
      weekly:{metrics:weekly,version:goalRow?.version||0,period_days:7,can_edit:user.role==='leader'},
      members:members.map(m=>({id:m.id,nickname:m.nickname||'Учасник',role:m.role,rank_id:m.rank_id,status:m.status,joined_at:m.joined_at})),
      contracts:contracts.map(contractView),
      summary:{
        members:members.filter(m=>m.status==='active').length,
        tasks_open:sections.find(x=>x.id==='tasks').active,
        reports_review:sections.find(x=>x.id==='reports').attention,
        contracts_count:contracts.length,
        contracts_settled:contracts.filter(c=>!!c.settled_at).length
      }
    });
  }
  m=path.match(/^\/api\/department-goals\/([\w-]+)$/);
  if(m&&method==='PATCH'){
    if(user.role!=='leader')fail(403,'Тільки лідер встановлює цілі підрозділів');
    const departmentId=m[1];
    const metricDefs=DEPARTMENT_WEEKLY_METRICS[departmentId];
    if(!metricDefs)fail(404,'Невідомий підрозділ');
    const dept=await db.prepare('SELECT id FROM departments WHERE id=?').bind(departmentId).first();
    if(!dept)fail(404,'Підрозділ не знайдено');
    const input=await body(req);
    if(!Number.isInteger(input.version)||input.version<0)fail(428,'Необхідно оновити цілі перед збереженням');
    const targets=input.targets;
    if(!targets||typeof targets!=='object'||Array.isArray(targets)||Object.keys(targets).length!==metricDefs.length)fail(400,'Вкажіть усі показники підрозділу');
    const clean={};
    for(const [id] of metricDefs){
      if(!Number.isInteger(targets[id])||targets[id]<0||targets[id]>100)fail(400,'Ціль має бути цілим числом від 0 до 100');
      clean[id]=targets[id];
    }
    const key=weeklyGoalKey(departmentId),value=JSON.stringify(clean);
    let result;
    if(input.version===0){
      result=await db.prepare('INSERT INTO settings(key,value,version,updated_at) VALUES(?,?,1,?) ON CONFLICT(key) DO NOTHING').bind(key,value,now()).run();
    }else{
      result=await db.prepare('UPDATE settings SET value=?,version=version+1,updated_at=? WHERE key=? AND version=?').bind(value,now(),key,input.version).run();
    }
    if(result.meta.changes!==1)fail(409,'Цілі вже змінив інший керівник. Оновіть сторінку');
    await audit(db,user,'update','department_goals',departmentId,JSON.stringify(clean));
    return json({ok:true,version:input.version+1,targets:clean});
  }
  if(path==='/api/departments'&&method==='GET')return json({items:await allRows(db,'SELECT * FROM departments ORDER BY rowid')});
  m=path.match(/^\/api\/departments\/([\w-]+)$/);if(m&&method==='PATCH'){
    if(user.role!=='leader')fail(403,'Лише лідер редагує напрямки');const b=await body(req);if(!Number.isInteger(b.version))fail(428,'Потрібна версія');const headId=str(b.head_id,80)||null;
    if(headId){
      const candidate=await db.prepare('SELECT id,role,status,department_id FROM users WHERE id=?').bind(headId).first();
      if(!candidate||candidate.status!=='active'||candidate.role!=='head'||candidate.department_id!==m[1])
        fail(400,'Керівник має бути активним користувачем із роллю «Голова відділу» саме цього підрозділу');
    }
    const r=await db.prepare('UPDATE departments SET title=?,head_id=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(str(b.title,100),headId,now(),m[1],b.version).run();if(r.meta.changes!==1)fail(409,'Напрямок змінився, оновіть список');await audit(db,user,'update','departments',m[1],JSON.stringify({head_id:headId}));return json({ok:true});
  }
  if(path==='/api/discord/status'&&method==='GET'){
    if(user.role!=='leader')fail(403,'Лише лідер переглядає інтеграцію Discord');
    return json({...discordWebhookDiagnostic(env.DISCORD_WEBHOOK_URL),
      worker:'famaly',routes:discordRouteDiagnostics(env),applicationRoutes:applicationRouteDiagnostics(env),...await discordPreferences(db,env)});
  }
  if(path==='/api/discord/preferences'&&method==='PATCH'){
    if(user.role!=='leader')fail(403,'Лише лідер змінює Discord-сповіщення');
    const b=await body(req),values=b.enabled,versions=b.versions;
    if(!values||typeof values!=='object'||Array.isArray(values)||
       DISCORD_NOTIFY_KINDS.some(k=>typeof values[k]!=='boolean'))
      fail(400,'Потрібно обрати стан усіх шести категорій');
    if(!versions||DISCORD_NOTIFY_KINDS.some(k=>!Number.isInteger(versions[k])||versions[k]<1))
      fail(428,'Оновіть налаштування перед збереженням');
    const current=await discordPreferences(db,env);
    if(current.migrationRequired)fail(503,'Застосуйте міграції D1 0003–0005 (Discord-сповіщення)');
    const keys=DISCORD_NOTIFY_KINDS.map(k=>'discord_notify_'+k);
    const sql='UPDATE settings SET value=CASE key '+keys.map(()=>'WHEN ? THEN ?').join(' ')+
      ' ELSE value END,version=version+1,updated_at=? WHERE key IN ('+keys.map(()=>'?').join(',')+') AND (SELECT COUNT(*) FROM settings WHERE '+
      keys.map(()=>'key=? AND version=?').join(' OR ')+')='+keys.length;
    const args=[...DISCORD_NOTIFY_KINDS.flatMap((k,i)=>[keys[i],values[k]?'true':'false']),now(),...keys,
      ...DISCORD_NOTIFY_KINDS.flatMap((k,i)=>[keys[i],versions[k]])];
    const outcome=await db.prepare(sql).bind(...args).run();
    if(outcome.meta.changes!==keys.length)fail(409,'Налаштування змінено в іншій сесії. Оновіть сторінку');
    await audit(db,user,'discord_preferences','integrations','discord');
    return json({ok:true,...await discordPreferences(db,env)});
  }
  if(path==='/api/discord/deliveries'&&method==='GET'){
    if(user.role!=='leader')fail(403,'Лише лідер переглядає журнал Discord');
    if((await discordPreferences(db,env)).migrationRequired)
      fail(503,'Для журналу доставки застосуйте міграції D1 0003–0005');
    return json({items:await allRows(db,
      'SELECT id,kind,status,http_status,error_code,created_at FROM discord_delivery_log ORDER BY created_at DESC LIMIT 100')});
  }
  if(path==='/api/discord/test'&&method==='POST'){
    if(user.role!=='leader')fail(403,'Лише лідер може перевіряти Discord');
    const b=await body(req);
    const kind=b.kind||'test';
    if(kind!=='test'&&!DISCORD_NOTIFY_KINDS.includes(kind)&&!Object.hasOwn(APPLICATION_WEBHOOK_ROUTES,kind))fail(400,'Невідома категорія Discord');
    const diagnostic=kind==='test'?discordWebhookDiagnostic(env.DISCORD_WEBHOOK_URL):
      Object.hasOwn(APPLICATION_WEBHOOK_ROUTES,kind)?applicationRouteDiagnostics(env)[kind]:discordRouteDiagnostics(env)[kind];
    if(!diagnostic?.configured){
      const explanation=diagnostic?.reason==='duplicate'?'Webhook має бути унікальним для цього статусу та інших категорій Discord':
        diagnostic?.reason==='invalid'?'Некоректний URL webhook у Cloudflare':'Потрібно додати секрет webhook відповідної категорії в Cloudflare';
      fail(503,explanation);
    }
    const rateKey='discord:test:'+user.id;
    await rateCheck(db,rateKey,6,10);
    await rateFail(db,rateKey,6,10);
    try{
      await sendDiscordWebhook(env,'test',{event:kind==='test'?undefined:'Тест маршруту '+kind},kind);
      await recordDiscordDelivery(db,Object.hasOwn(APPLICATION_WEBHOOK_ROUTES,kind)?(kind==='application_waiting'?'applications':'decisions'):(kind==='test'?'test':kind));
    }catch(e){
      await recordDiscordDelivery(db,Object.hasOwn(APPLICATION_WEBHOOK_ROUTES,kind)?(kind==='application_waiting'?'applications':'decisions'):(kind==='test'?'test':kind),e);
      fail(502,'Не вдалося надіслати тест до Discord. '+String(e.message).slice(0,110));
    }
    await audit(db,user,'discord_test','integrations','discord');
    return json({ok:true,message:'Тестове повідомлення прийнято Discord',kind});
  }
  if(path==='/api/settings'&&method==='GET'){const items=await settings(db,user.role!=='leader');const versions=user.role==='leader'?Object.fromEntries((await allRows(db,'SELECT key,version FROM settings')).map(r=>[r.key,r.version])):undefined;return json({items,versions});}
  if(path==='/api/settings'&&method==='PATCH'){
    if(user.role!=='leader')fail(403,'Лише лідер редагує налаштування');const b=await body(req);const entries=Object.entries(b).filter(([k])=>ALL_SETTINGS.includes(k));if(!entries.length)fail(400,'Немає налаштувань');const versions=b.__versions;if(!versions||entries.some(([k])=>!Number.isInteger(versions[k])))fail(428,'Потрібні версії налаштувань');const normalized=[];
    for(const [k,v] of entries){let val=str(v,k==='history'||k==='rules'||k==='requirements'?5000:600);if(k==='treasury_percent')val=String(percent(val));if(k.startsWith('capt_'))val=String(money(val));if(k==='discord_url'&&val){let u;try{u=new URL(val);}catch{fail(400,'Некоректний Discord URL');}if(u.protocol!=='https:'||!['discord.gg','discord.com','www.discord.com'].includes(u.hostname))fail(400,'Посилання повинно вести на Discord');}normalized.push([k,val,versions[k]]);}
    const caseSql=normalized.map(()=>`WHEN ? THEN ?`).join(' ');const keys=normalized.map(()=>'?').join(',');const guard=normalized.map(()=>'(key=? AND version=?)').join(' OR ');
    const args=[...normalized.flatMap(([k,v])=>[k,v]),now(),...normalized.map(([k])=>k),...normalized.flatMap(([k,_,v])=>[k,v])];
    const r=await db.prepare(`UPDATE settings SET value=CASE key ${caseSql} ELSE value END,version=version+1,updated_at=? WHERE key IN (${keys}) AND (SELECT COUNT(*) FROM settings WHERE ${guard})=?`).bind(...args,normalized.length).run();
    if(r.meta.changes!==normalized.length)fail(409,'Налаштування змінив інший лідер. Оновіть сторінку');await audit(db,user,'update','settings','site',entries.map(([k])=>k).join(','));return json({items:await settings(db)});
  }
  if(path==='/api/applications'&&method==='GET'){requirePerm(user,'recruitment:manage');if(user.role==='head'){const appointed=await db.prepare('SELECT head_id FROM departments WHERE id=?').bind('recruitment').first();if(user.department_id!=='recruitment'||appointed?.head_id!==user.id)fail(403,'Лише призначений керівник рекрутингу переглядає заявки');}return json({items:(await allRows(db,'SELECT * FROM applications ORDER BY created_at DESC LIMIT 500')).map(applicationView)});}
  m=path.match(/^\/api\/applications\/([\w-]+)$/);if(m&&method==='PATCH'){
    requirePerm(user,'recruitment:manage');if(user.role==='head'){const appointed=await db.prepare('SELECT head_id FROM departments WHERE id=?').bind('recruitment').first();if(user.department_id!=='recruitment'||appointed?.head_id!==user.id)fail(403,'Лише призначений керівник рекрутингу розглядає заявки');}const b=await body(req);if(!Number.isInteger(b.version))fail(428,'Потрібна версія');const old=await db.prepare('SELECT nickname,status FROM applications WHERE id=?').bind(m[1]).first();if(!old)fail(404,'Заявку не знайдено');const status=validApplicationStatus(b.status);const r=await db.prepare('UPDATE applications SET status=?,comment=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(status,str(b.comment,1200),now(),m[1],b.version).run();if(r.meta.changes!==1)fail(409,'Заявку змінено іншим користувачем');await audit(db,user,'review','applications',m[1],status);if(applicationStatus(old.status)!==status)queueDiscord(ctx,db,env,'decisions',{nickname:old.nickname,status},applicationWebhookKind(status));return json({ok:true});
  }
  // CAPT dashboard: return only records the current role can see. Payout details
  // remain limited to finance managers or the payout recipient.
  if(path==='/api/capt/overview'&&method==='GET'){
    const [rawMatches,rawTraining,rawAttendance]=await Promise.all([
      allRows(db,"SELECT * FROM records WHERE module='capt_matches' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1000"),
      allRows(db,"SELECT * FROM records WHERE module='capt_training' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1000"),
      allRows(db,"SELECT * FROM records WHERE module='capt_attendance' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1000")
    ]);
    const matches=rawMatches.filter(r=>permittedRecord(user,'capt_matches',r)).map(mapRecord);
    const trainings=rawTraining.filter(r=>permittedRecord(user,'capt_training',r)).map(mapRecord);
    const attendance=rawAttendance.filter(r=>permittedRecord(user,'capt_attendance',r));
    const financeManager=can(user,'finance:manage');
    const payoutRows=financeManager
      ?await allRows(db,"SELECT reference,recipient_id,amount,created_at FROM ledger WHERE kind='capt' AND reference LIKE 'capt_attendance:%' ORDER BY created_at DESC LIMIT 2000")
      :await allRows(db,"SELECT reference,recipient_id,amount,created_at FROM ledger WHERE kind='capt' AND recipient_id=? AND reference LIKE 'capt_attendance:%' ORDER BY created_at DESC LIMIT 2000",user.id);
    const paidByRef=new Map(payoutRows.map(r=>[r.reference,r]));
    const visibleAttendance=attendance.map(r=>{
      const item=mapRecord(r);
      const ownPayout=r.assignee_id===user.id||(!r.assignee_id&&r.owner_id===user.id);
      const canSeePayout=financeManager||ownPayout;
      const payment=canSeePayout?paidByRef.get('capt_attendance:'+r.id):undefined;
      return {...item,paid:canSeePayout?!!payment:null,
        paid_amount:canSeePayout&&payment?payment.amount:null,
        paid_at:canSeePayout&&payment?payment.created_at:null};
    });
    const s=financeManager?await settings(db):null;
    return json({matches,trainings,attendance:visibleAttendance,results:captResults(matches),
      rates:financeManager?{afk:Number(s.capt_afk_rate||0),battle:Number(s.capt_battle_rate||0)}:null});
  }
  // Members may register themselves for scheduled CAPT matches. Roster is
  // computed deterministically from registration order, never from arbitrary
  // player names in the match's free-text notes.
  m=path.match(/^\/api\/capt\/matches\/([a-zA-Z0-9_-]+)\/signups$/);
  if(m&&(method==='GET'||method==='POST')){
    const match=await db.prepare("SELECT * FROM records WHERE id=? AND module='capt_matches' AND deleted_at IS NULL").bind(m[1]).first();
    if(!match||!permittedRecord(user,'capt_matches',match))fail(404,'Бій CAPT не знайдено');
    const isOpen=['Заплановано','У роботі'].includes(match.status);
    if(method==='POST'){
      const b=await body(req),action=str(b.action,20);
      if(!['join','leave'].includes(action))fail(400,'Оберіть запис або скасування запису');
      if(!isOpen)fail(409,'Запис на цей бій уже закрито');
      if(action==='join'){
        await db.prepare('INSERT OR IGNORE INTO capt_signups(match_id,user_id,joined_at) VALUES(?,?,?)').bind(match.id,user.id,now()).run();
      }else{
        await db.prepare('DELETE FROM capt_signups WHERE match_id=? AND user_id=?').bind(match.id,user.id).run();
      }
      await audit(db,user,action==='join'?'capt_signup':'capt_leave','capt_matches',match.id);
    }
    const roster=await allRows(db,"SELECT s.user_id,s.joined_at,COALESCE(NULLIF(u.nickname,''),u.username) nickname FROM capt_signups s JOIN users u ON u.id=s.user_id WHERE s.match_id=? AND u.status='active' ORDER BY s.joined_at ASC,s.user_id ASC",match.id);
    const limit=captMatchSize(parseJson(match.extra,{})),lineup=roster.slice(0,limit),reserve=roster.slice(limit);
    return json({match_id:match.id,limit,total:roster.length,lineup,reserve,own:roster.some(x=>x.user_id===user.id),open:isOpen});
  }
  m=path.match(/^\/api\/capt-pay\/([\w-]+)$/);
  if(m&&method==='POST'){
    requirePerm(user,'finance:manage');const r=await db.prepare("SELECT * FROM records WHERE id=? AND module='capt_attendance' AND deleted_at IS NULL").bind(m[1]).first();if(!r)fail(404,'Запис CAPT не знайдено');if(r.status!=='Погоджено')fail(409,'Спершу погодьте відвідування CAPT');const extra=parseJson(r.extra,{}),mode=extra.attendance_type;if(!['afk','battle'].includes(mode))fail(400,'У записі потрібно вказати тип участі: afk або battle');const payee=r.assignee_id||r.owner_id;if(!await db.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(payee).first())fail(400,'Учасник недоступний');const s=await settings(db);const amount=money(mode==='afk'?s.capt_afk_rate:s.capt_battle_rate);const id=uuid(),t=now();try{
      await db.prepare('INSERT INTO ledger(id,kind,amount,description,reference,actor_id,recipient_id,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,'capt',amount,`CAPT ${mode}: ${r.title}`,`capt_attendance:${r.id}`,user.id,payee,t).run();
    }catch(e){if(String(e).includes('UNIQUE'))fail(409,'Виплату за цей CAPT-запис уже нараховано');throw e;}
    await audit(db,user,'capt_pay','capt_attendance',r.id,`${payee}:${amount}`);await notify(db,payee,'CAPT-виплата нарахована',`${r.title}: ${amount}`);return json({ok:true,amount,recipient_id:payee});
  }
  // Uniform, permission-checked CRUD used for all operational modules.
  m=path.match(/^\/api\/records\/([a-z_]+)(?:\/([\w-]+))?(?:\/(review))?$/);
  if(m&&MODULES[m[1]]){
    const mod=m[1],id=m[2],review=m[3],cfg=MODULES[mod];
    if(!id&&method==='GET'){
      const rows=await allRows(db,'SELECT * FROM records WHERE module=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1000',mod);return json({items:rows.filter(r=>permittedRecord(user,mod,r)).map(mapRecord)});
    }
    if(!id&&method==='POST'){
      const b=await body(req);const allowed=can(user,cfg.manage) || cfg.memberCreate;if(!allowed)fail(403,'Недостатньо прав для створення');const p=recordPayload(b,user,mod);if(mod==='capt_matches')captMatchPayload(p);if(mod==='gallery')validateGalleryPayload(p);if(mod==='public_news')validatePublicNewsPayload(p);if(mod==='public_team')validatePublicTeamPayload(p);if(mod==='public_achievements')validatePublicAchievementPayload(p);if(mod==='public_calendar')validatePublicCalendarPayload(p);if(!p.title)fail(400,'Додайте назву');if(mod==='promotions'&&(!Number.isInteger(Number(p.extra.requested_rank_id))||Number(p.extra.requested_rank_id)<1||Number(p.extra.requested_rank_id)>15))fail(400,'Виберіть ранг для підвищення');if(user.role==='head'&&!manageInDepartment(user,p.department_id))fail(403,'Доступ лише до свого напрямку');if(cfg.review)p.status='На перевірці';if(!can(user,cfg.manage)){p.status=cfg.review?'На перевірці':'Заплановано';p.assignee_id=user.id;p.department_id=user.department_id;}
      if(mod==='capt_attendance'&&!can(user,'capt:manage'))p.status='На перевірці';
      const newId=uuid(),t=now();await db.prepare('INSERT INTO records(id,module,title,details,status,owner_id,assignee_id,department_id,amount,starts_at,ends_at,evidence,extra,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(newId,mod,p.title,p.details,p.status,p.owner_id,p.assignee_id,p.department_id,p.amount,p.starts_at,p.ends_at,JSON.stringify(p.evidence),JSON.stringify(p.extra),t,t).run();await audit(db,user,'create',mod,newId);if(mod==='public_calendar'&&p.status==='Погоджено')queueDiscord(ctx,db,env,'events',{event:p.title,startsAt:p.starts_at,location:p.extra.location});if(mod==='public_news'&&p.status==='Погоджено')queueDiscord(ctx,db,env,publicNewsDiscordKind(p.extra.news_category),{event:p.title,message:p.extra.news_category==='announcement'?p.details:undefined});
      if(p.assignee_id&&p.assignee_id!==user.id)await notify(db,p.assignee_id,'Нове завдання / запис',p.title);return json({item:mapRecord(await db.prepare('SELECT * FROM records WHERE id=?').bind(newId).first())},201);
    }
    if(id){const old=await db.prepare('SELECT * FROM records WHERE id=? AND module=? AND deleted_at IS NULL').bind(id,mod).first();if(!old||!permittedRecord(user,mod,old))fail(404,'Запис не знайдено');
      if(review&&method==='POST'){
        if(!cfg.review||!permittedRecord(user,mod,old,'manage'))fail(403,'Не дозволено погоджувати');if(mod==='promotions'&&old.status==='Погоджено')fail(409,'Це підвищення вже погоджене');if(old.owner_id===user.id)fail(403,'Не можна погоджувати власні заявки або звіти');const b=await body(req);if(!['Погоджено','Відхилено','На доопрацювання'].includes(b.status))fail(400,'Неправильне рішення');if(!Number.isInteger(b.version))fail(428,'Потрібна версія');const nonce=uuid();const extra={...parseJson(old.extra,{}),review_comment:str(b.comment,1000),reviewer_id:user.id,review_nonce:nonce};const statements=[db.prepare('UPDATE records SET status=?,extra=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(b.status,JSON.stringify(extra),now(),id,b.version)];
        if(mod==='promotions'&&b.status==='Погоджено'){
          const newRank=Number(extra.requested_rank_id);if(!Number.isInteger(newRank)||newRank<1||newRank>15||!await db.prepare('SELECT id FROM ranks WHERE id=?').bind(newRank).first())fail(400,'У заявці не вибрано чинний цільовий ранг');
          statements.push(db.prepare("UPDATE users SET rank_id=?,version=version+1,updated_at=? WHERE id=? AND EXISTS (SELECT 1 FROM records WHERE id=? AND json_extract(extra,'$.review_nonce')=?)").bind(newRank,now(),old.owner_id,id,nonce));
        }
        const results=await db.batch(statements);if(results[0].meta.changes!==1)fail(409,'Запис змінено іншим користувачем');await audit(db,user,'review',mod,id,b.status);await notify(db,old.owner_id,`Рішення за ${mod}`,`${old.title}: ${b.status}`);return json({ok:true});
      }
      if(!review&&method==='PATCH'){
        if(mod==='reports'&&parseJson(old.extra,{}).kind==='department_weekly')fail(403,'Автоматичний звіт незмінний; скористайтеся перевіркою');
        const b=await body(req);if(!Number.isInteger(b.version))fail(428,'Потрібна версія');const manager=permittedRecord(user,mod,old,'manage');const self=old.owner_id===user.id||old.assignee_id===user.id;
        if(!manager&&!(self&&(cfg.memberUpdate||cfg.memberCreate)))fail(403,'Недостатньо прав');if(!manager&&['Погоджено','Відхилено','Завершено'].includes(b.status))fail(403,'Погодження тільки керівником');if(cfg.review&&manager&&b.status&&b.status!==old.status&&['Погоджено','Відхилено','На доопрацювання','Завершено'].includes(b.status))fail(400,'Для рішення використовуйте спеціальне погодження');
        if(mod==='promotions'&&old.status==='Погоджено')fail(409,'Погоджене підвищення не можна змінювати');const p=recordPayload(b,user,mod,old);if(mod==='capt_matches')captMatchPayload(p,old);if(mod==='gallery')validateGalleryPayload(p);if(mod==='public_news')validatePublicNewsPayload(p);if(mod==='public_team')validatePublicTeamPayload(p);if(mod==='public_achievements')validatePublicAchievementPayload(p);if(mod==='public_calendar')validatePublicCalendarPayload(p);if(!manager){
          p.assignee_id=old.assignee_id;p.department_id=old.department_id;p.amount=old.amount;p.starts_at=old.starts_at;p.ends_at=old.ends_at;
          const originalExtra=parseJson(old.extra,{});
          if(mod==='promotions'&&old.owner_id===user.id){
            if(!['На перевірці','На доопрацювання'].includes(old.status))
              fail(403,'Заявку з рішенням керівництва вже не можна редагувати');
            if(b.extra?.requested_rank_id!==undefined&&String(b.extra.requested_rank_id)!==String(originalExtra.requested_rank_id))
              fail(403,'Цільовий ранг заявки змінювати не дозволено');
            const checks=b.extra?.checklist_completed;
            if(checks!==undefined){
              if(!Array.isArray(checks)||checks.length>30||checks.some(x=>typeof x!=='string'||x.length>250))
                fail(400,'Некоректний чекліст підвищення');
              const fromRank=Number(originalExtra.requested_rank_id)-1;
              const rank=fromRank>=1?await db.prepare('SELECT checklist FROM ranks WHERE id=?').bind(fromRank).first():null;
              const allowed=parseJson(rank?.checklist||'[]',[]);
              if(!checks.every(x=>allowed.includes(x)))fail(400,'Вимога відсутня в налаштованому чеклісті рангу');
              originalExtra.checklist_completed=[...new Set(checks)];
            }
          }
          p.extra=originalExtra;p.status=cfg.review?'На перевірці':p.status;
        }
        if(user.role==='head'&&!manageInDepartment(user,p.department_id))fail(403,'Напрямок недоступний');const r=await db.prepare('UPDATE records SET title=?,details=?,status=?,assignee_id=?,department_id=?,amount=?,starts_at=?,ends_at=?,evidence=?,extra=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(p.title,p.details,p.status,p.assignee_id,p.department_id,p.amount,p.starts_at,p.ends_at,JSON.stringify(p.evidence),JSON.stringify(p.extra),now(),id,b.version).run();if(r.meta.changes!==1)fail(409,'Запис змінено іншим користувачем');await audit(db,user,'update',mod,id);if(mod==='public_calendar'&&old.status!=='Погоджено'&&p.status==='Погоджено')queueDiscord(ctx,db,env,'events',{event:p.title,startsAt:p.starts_at,location:p.extra.location});if(mod==='public_news'&&old.status!=='Погоджено'&&p.status==='Погоджено')queueDiscord(ctx,db,env,publicNewsDiscordKind(p.extra.news_category),{event:p.title,message:p.extra.news_category==='announcement'?p.details:undefined});return json({ok:true});
      }
      if(!review&&method==='DELETE'){
        if(mod==='reports'&&parseJson(old.extra,{}).kind==='department_weekly')fail(403,'Тижневий звіт не можна видаляти');
        if(!permittedRecord(user,mod,old,'manage'))fail(403,'Немає прав');const b=await body(req);if(!Number.isInteger(b.version))fail(428,'Потрібна версія');const r=await db.prepare('UPDATE records SET deleted_at=?,version=version+1 WHERE id=? AND version=?').bind(now(),id,b.version).run();if(r.meta.changes!==1)fail(409,'Запис змінено');await audit(db,user,'delete',mod,id);return json({ok:true});
      }
    }
  }
  m=path.match(/^\/api\/rsvp\/([\w-]+)$/);
  if(m&&(method==='GET'||method==='POST')){
    const event=await db.prepare("SELECT * FROM records WHERE id=? AND module='events' AND deleted_at IS NULL").bind(m[1]).first();if(!event||!permittedRecord(user,'events',event))fail(404,'Захід не знайдено');
    if(method==='GET'){const r=await allRows(db,'SELECT user_id,response,updated_at FROM event_rsvps WHERE event_id=?',m[1]);return json({own:r.find(x=>x.user_id===user.id)?.response||null,counts:{yes:r.filter(x=>x.response==='Так').length,no:r.filter(x=>x.response==='Ні').length},items:can(user,'events:manage')?r:[]});}
    const b=await body(req);if(!['Так','Ні'].includes(b.response))fail(400,'Оберіть Так або Ні');await db.prepare('INSERT INTO event_rsvps(event_id,user_id,response,updated_at) VALUES(?,?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET response=excluded.response,updated_at=excluded.updated_at').bind(m[1],user.id,b.response,now()).run();await audit(db,user,'rsvp','events',m[1],b.response);return json({ok:true});
  }
  if(path==='/api/contracts'&&method==='GET'){
    const rows=await allRows(db,'SELECT * FROM contracts ORDER BY created_at DESC LIMIT 500');return json({items:rows.filter(x=>user.role!=='head'||x.department_id===user.department_id).map(contractView)});
  }
  if(path==='/api/contracts'&&method==='POST'){
    requirePerm(user,'finance:manage');const b=await body(req),ids=uniqueIds(b.participant_ids);await safeContractUsers(db,ids);const s=await settings(db),pct=percent(b.treasury_percent??s.treasury_percent),amount=money(b.amount),title=str(b.title,160);const departmentId=str(b.department_id,80)||null;if(departmentId&&!await db.prepare('SELECT id FROM departments WHERE id=?').bind(departmentId).first())fail(400,'Невідомий підрозділ');if(!title)fail(400,'Назва обов’язкова');const id=uuid(),t=now();await db.prepare('INSERT INTO contracts(id,title,details,amount,treasury_percent,participant_ids,status,evidence,owner_id,department_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,title,str(b.details,2500),amount,pct,JSON.stringify(ids),validStatus(b.status||'Заплановано'),JSON.stringify(evidence(b.evidence||[])),user.id,departmentId,t,t).run();await audit(db,user,'create','contracts',id);return json({item:contractView(await db.prepare('SELECT * FROM contracts WHERE id=?').bind(id).first())},201);
  }
  m=path.match(/^\/api\/contracts\/([\w-]+)(?:\/(preview|settle|correction-preview|correct))?$/);
  if(m){const c=await db.prepare('SELECT * FROM contracts WHERE id=?').bind(m[1]).first();if(!c)fail(404,'Контракт не знайдено');if(user.role==='head'&&c.department_id!==user.department_id)fail(403,'Контракт іншого підрозділу недоступний');// All authenticated family members may inspect contract previews. Settlement and editing remain permission-gated.
    if(m[2]==='preview'&&method==='GET')return json({preview:payoutPreview(c.amount,c.treasury_percent,parseJson(c.participant_ids,[])),settled:!!c.settled_at});
    if(['correction-preview','correct'].includes(m[2])&&method==='POST'){
      if(user.role!=='leader')fail(403,'Тільки лідер може коригувати проведений контракт');
      if(!c.settled_at)fail(409,'Контракт ще не проведено');
      const b=await body(req),newAmount=money(b.amount),reason=str(b.reason,700);
      if(newAmount<=c.amount)fail(400,'Нова сума повинна бути більшою за стару');
      if(reason.length<10)fail(400,'Вкажіть причину коригування (мінімум 10 символів)');
      const ids=parseJson(c.participant_ids,[]),previous=payoutPreview(c.amount,c.treasury_percent,ids),next=payoutPreview(newAmount,c.treasury_percent,ids);
      const rows=await allRows(db,'SELECT p.id,p.user_id,p.amount,pc.confirmed_at,pc.confirmed_by,pc.note FROM payouts p LEFT JOIN payout_confirmations pc ON pc.payout_id=p.id WHERE p.contract_id=?',c.id);
      const ledgerEntry=await db.prepare("SELECT id,amount FROM ledger WHERE reference=? AND kind='treasury'").bind('contract:'+c.id).first();
      if(rows.length!==ids.length||rows.some(p=>!ids.includes(p.user_id)||p.amount!==0)||previous.per_member!==0||next.per_member<=0||
        !ledgerEntry||ledgerEntry.amount!==previous.treasury)
        fail(409,'Автоматичне коригування дозволене лише для раніше нульових виплат з узгодженим обліком. Зверніться до ручної звірки.');
      const confirmed=rows.filter(x=>!!x.confirmed_at);
      const preview={old_amount:c.amount,new_amount:newAmount,old_treasury:previous.treasury,new_treasury:next.treasury,
        treasury_change:next.treasury-previous.treasury,old_per_member:0,new_per_member:next.per_member,
        participants:ids.length,reset_zero_confirmations:confirmed.length,reason};
      if(m[2]==='correction-preview')return json({preview,version:c.version});
      if(b.version!==c.version)fail(409,'Контракт змінився. Перегляньте розрахунок повторно');
      if(b.confirm_reset_zero_confirmations!==true)fail(400,'Потрібно підтвердити скидання старих нульових позначок «Видано»');
      const t=now(),detail=JSON.stringify({old_amount:c.amount,new_amount:newAmount,old_treasury:previous.treasury,
        new_treasury:next.treasury,old_per_member:0,new_per_member:next.per_member,reset_confirmations:confirmed.length,old_confirmations:confirmed.map(x=>({payout_id:x.id,confirmed_at:x.confirmed_at,confirmed_by:x.confirmed_by,note:x.note})),reason});
      const batch=[
        db.prepare('UPDATE contracts SET amount=?,version=version+1,updated_at=? WHERE id=? AND version=? AND amount=? AND settled_at IS NOT NULL')
          .bind(newAmount,t,c.id,c.version,c.amount),
        db.prepare('DELETE FROM payout_confirmations WHERE payout_id IN (SELECT p.id FROM payouts p JOIN contracts c ON c.id=p.contract_id WHERE p.contract_id=? AND p.amount=0 AND c.version=? AND c.amount=?)')
          .bind(c.id,c.version+1,newAmount),
        db.prepare('UPDATE payouts SET amount=? WHERE contract_id=? AND amount=0 AND EXISTS (SELECT 1 FROM contracts WHERE id=? AND version=? AND amount=?)')
          .bind(next.per_member,c.id,c.id,c.version+1,newAmount),
        db.prepare("UPDATE ledger SET amount=?,description=? WHERE reference=? AND kind='treasury' AND amount=? AND EXISTS (SELECT 1 FROM contracts WHERE id=? AND version=? AND amount=?)")
          .bind(next.treasury,'Контракт: '+c.title+' (коригування: '+reason.slice(0,150)+')','contract:'+c.id,previous.treasury,c.id,c.version+1,newAmount),
        db.prepare('INSERT INTO audit(id,actor_id,actor_name,action,entity,entity_id,detail,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM contracts WHERE id=? AND version=? AND amount=?)')
          .bind('correction:'+c.id+':'+(c.version+1),user.id,user.username,'correct_settled_contract','contracts',c.id,detail,t,c.id,c.version+1,newAmount)
      ];
      const result=await db.batch(batch);
      if(result[0].meta.changes!==1||result[1].meta.changes!==confirmed.length||result[2].meta.changes!==ids.length||result[3].meta.changes!==1||result[4].meta.changes!==1)
        fail(409,'Дані змінилися або облік не збігається. Не повторюйте коригування, перевірте журнал і зверніться до адміністратора.');
      for(const id of ids)await notify(db,id,'Коригування контракту',c.title+': нове нарахування '+next.per_member+'. Фактичну видачу потрібно підтвердити заново.');
      return json({ok:true,preview,version:c.version+1});
    }
    if(m[2]==='settle'&&method==='POST'){
      requirePerm(user,'finance:manage');if(c.settled_at)fail(409,'Виплати за цим контрактом уже нараховані');if(c.status!=='Погоджено')fail(409,'Перед нарахуванням погодьте контракт');const b=await body(req);if(b.version!==c.version)fail(409,'Контракт змінився. Оновіть сторінку');const p=payoutPreview(c.amount,c.treasury_percent,parseJson(c.participant_ids,[])),t=now(),settlementId=uuid();
      const batch=[db.prepare("UPDATE contracts SET settled_at=?,status='Завершено',version=version+1,updated_at=? WHERE id=? AND version=? AND settled_at IS NULL AND status='Погоджено'").bind(settlementId,t,c.id,c.version)];
      for(const x of p.allocations){batch.push(db.prepare('INSERT INTO payouts(id,contract_id,user_id,amount,created_at) SELECT ?,id,?,?,? FROM contracts WHERE id=? AND settled_at=?').bind(uuid(),x.user_id,x.amount,t,c.id,settlementId));}
      batch.push(db.prepare("INSERT INTO ledger(id,kind,amount,description,reference,actor_id,created_at) SELECT ?,'treasury',?,?,?, ?,? FROM contracts WHERE id=? AND settled_at=?").bind(uuid(),p.treasury,`Контракт: ${c.title}`,`contract:${c.id}`,user.id,t,c.id,settlementId));
      const results=await db.batch(batch);if(results[0].meta.changes!==1)fail(409,'Інший користувач уже нарахував виплати');await audit(db,user,'settle','contracts',c.id,JSON.stringify({treasury:p.treasury,each:p.per_member}));for(const x of p.allocations)await notify(db,x.user_id,'Виплату нараховано',`${c.title}: ${x.amount.toLocaleString('uk-UA')}`);return json({ok:true,preview:p});
    }
    if(!m[2]&&method==='PATCH'){
      requirePerm(user,'finance:manage');if(c.settled_at)fail(409,'Нарахований контракт змінювати не можна');const b=await body(req);if(!Number.isInteger(b.version))fail(428,'Потрібна версія');const ids=uniqueIds(b.participant_ids??parseJson(c.participant_ids,[]));await safeContractUsers(db,ids);const r=await db.prepare('UPDATE contracts SET title=?,details=?,amount=?,treasury_percent=?,participant_ids=?,status=?,evidence=?,version=version+1,updated_at=? WHERE id=? AND version=? AND settled_at IS NULL').bind(str(b.title??c.title,160),str(b.details??c.details,2500),money(b.amount??c.amount),percent(b.treasury_percent??c.treasury_percent),JSON.stringify(ids),validStatus(b.status??c.status),JSON.stringify(evidence(b.evidence??parseJson(c.evidence,[]))),now(),c.id,b.version).run();if(r.meta.changes!==1)fail(409,'Контракт змінився іншим користувачем');await audit(db,user,'update','contracts',c.id);return json({ok:true});
    }
  }
  // Confirm that an already-accrued payout was actually handed over in GTA RP.
  // The unique payout_id ensures retries and concurrent requests cannot duplicate confirmation.
  m=path.match(/^\/api\/payouts\/([\w-]+)\/confirm$/);
  if(m&&method==='POST'){
    requirePerm(user,'finance:manage');
    const payout=await db.prepare('SELECT id FROM payouts WHERE id=?').bind(m[1]).first();
    if(!payout)fail(404,'Нарахування не знайдено');
    const b=await body(req),note=str(b.note,500),t=now();
    const result=await db.prepare('INSERT OR IGNORE INTO payout_confirmations(payout_id,confirmed_by,confirmed_at,note) VALUES(?,?,?,?)').bind(payout.id,user.id,t,note).run();
    if(result.meta.changes!==1)fail(409,'Видачу вже підтверджено');
    await audit(db,user,'confirm_handoff','payouts',payout.id);
    return json({ok:true,confirmed_at:t});
  }
  if(path==='/api/ledger'&&method==='GET'){
    if(!can(user,'finance:read')&&!can(user,'finance:manage'))fail(403,'Немає прав');return json({items:await allRows(db,'SELECT * FROM ledger ORDER BY created_at DESC LIMIT 1000')});
  }
  if(path==='/api/ledger'&&method==='POST'){
    requirePerm(user,'finance:manage');const b=await body(req),kind=b.kind;if(!['contribution','expense','bonus','capt'].includes(kind))fail(400,'Невірний тип операції');const amount=money(b.amount);if(!amount)fail(400,'Сума повинна бути більшою за нуль');const recipient=str(b.recipient_id,80)||null;if(['bonus','capt'].includes(kind)){if(!recipient||!await db.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(recipient).first())fail(400,'Для премії або CAPT вкажіть активного учасника');}const id=uuid();await db.prepare('INSERT INTO ledger(id,kind,amount,description,actor_id,recipient_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,kind,amount,str(b.description,700),user.id,recipient,now()).run();await audit(db,user,'create','ledger',id,`${kind}:${amount}`);return json({ok:true},201);
  }
  if(path==='/api/finance'&&method==='GET'){
    const own=await allRows(db,'SELECT p.*,c.title contract_title FROM payouts p JOIN contracts c ON c.id=p.contract_id WHERE p.user_id=? ORDER BY p.created_at DESC',user.id);const ownExtra=await allRows(db,"SELECT id,kind,amount,description,created_at FROM ledger WHERE recipient_id=? AND kind IN ('capt','bonus') ORDER BY created_at DESC",user.id);const ownTotal=own.reduce((s,r)=>s+r.amount,0)+ownExtra.reduce((s,r)=>s+r.amount,0);
    const detailed=can(user,'finance:read')||can(user,'finance:manage');
    const paymentRows=detailed?await allRows(db,`SELECT p.id,p.contract_id,p.user_id,p.amount,p.created_at,c.title contract_title,pc.confirmed_at,pc.confirmed_by,pc.note
      FROM payouts p JOIN contracts c ON c.id=p.contract_id
      LEFT JOIN payout_confirmations pc ON pc.payout_id=p.id
      ORDER BY p.created_at DESC LIMIT 1000`):[];
    const ledger=await allRows(db,'SELECT kind,COALESCE(SUM(amount),0) total FROM ledger GROUP BY kind');const all=await allRows(db,'SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM payouts');const totals=Object.fromEntries(ledger.map(x=>[x.kind,x.total]));
    // A rolling 30-day view; timestamps are stored as sortable UTC ISO strings.
    const since=new Date(Date.now()-30*86400000).toISOString();
    const recentLedger=await allRows(db,'SELECT kind,COALESCE(SUM(amount),0) total FROM ledger WHERE created_at>=? GROUP BY kind',since);
    const recentPayout=await db.prepare('SELECT COALESCE(SUM(amount),0) total,COUNT(*) count FROM payouts WHERE created_at>=?').bind(since).first();
    const byKind=Object.fromEntries(recentLedger.map(x=>[x.kind,Number(x.total)||0]));
    const month={from:since,through:now(),contract_treasury:byKind.treasury||0,contributions:byKind.contribution||0,expenses:byKind.expense||0,bonuses:byKind.bonus||0,capt:byKind.capt||0,contract_payouts:Number(recentPayout?.total)||0,contract_payout_count:Number(recentPayout?.count)||0};
    month.treasury_change=month.contract_treasury+month.contributions-month.expenses-month.bonuses-month.capt;
    // Contract face values are informational. Only confirmed settlement creates treasury ledger entries and payouts.
    const contractsSummary=await db.prepare(`SELECT
      COUNT(*) contracts_count,
      COALESCE(SUM(amount),0) contracts_total,
      COALESCE(SUM(CASE WHEN settled_at IS NOT NULL THEN amount ELSE 0 END),0) settled_total,
      COALESCE(SUM(CASE WHEN settled_at IS NULL THEN amount ELSE 0 END),0) unsettled_total,
      COALESCE(SUM(CASE WHEN settled_at IS NULL AND status='Погоджено' THEN amount ELSE 0 END),0) approved_pending_total,
      SUM(CASE WHEN settled_at IS NOT NULL THEN 1 ELSE 0 END) settled_count,
      SUM(CASE WHEN settled_at IS NULL AND status='Погоджено' THEN 1 ELSE 0 END) approved_pending_count
      FROM contracts`).first();
    const contract_summary=Object.fromEntries(Object.entries(contractsSummary||{}).map(([key,value])=>[key,Number(value)||0]));
    const shared={own_payouts:own,own_extra:ownExtra,own_total:ownTotal,totals,payout_total:all[0]?.total||0,payout_count:all[0]?.count||0,treasury_balance:(totals.treasury||0)+(totals.contribution||0)-(totals.expense||0)-(totals.bonus||0)-(totals.capt||0),month,contract_summary};
    // Members see aggregate totals and their own payouts only; individual payout rows stay private.
    return json(detailed?{...shared,payment_rows:paymentRows}:shared);
  }
  // Finance v2.5: accrued contract payouts awaiting actual GTA RP handoff.
  if(path==='/api/finance/outstanding'&&method==='GET'){
    if(!can(user,'finance:read')&&!can(user,'finance:manage'))fail(403,'Немає прав');
    const [summary,people]=await Promise.all([
      db.prepare("SELECT COUNT(*) count,COALESCE(SUM(p.amount),0) amount,MIN(p.created_at) oldest FROM payouts p LEFT JOIN payout_confirmations pc ON pc.payout_id=p.id WHERE pc.payout_id IS NULL").first(),
      allRows(db,`SELECT p.user_id,u.nickname,u.username,COUNT(*) count,COALESCE(SUM(p.amount),0) amount,MIN(p.created_at) oldest
        FROM payouts p JOIN users u ON u.id=p.user_id LEFT JOIN payout_confirmations pc ON pc.payout_id=p.id
        WHERE pc.payout_id IS NULL
        GROUP BY p.user_id,u.nickname,u.username ORDER BY amount DESC,p.user_id ASC LIMIT 100`)
    ]);
    return json({count:Number(summary?.count||0),amount:Number(summary?.amount||0),oldest:summary?.oldest||null,people});
  }
  // Finance v2.2: aggregated contract/earning analytics, never exposed to ordinary members.
  if(path==='/api/finance/analytics'&&method==='GET'){
    if(!can(user,'finance:read')&&!can(user,'finance:manage'))fail(403,'Немає прав');
    const days=Number(url.searchParams.get('days')||7);
    if(![7,30].includes(days))fail(400,'Доступні періоди: 7 або 30 днів');
    const end=now(),start=new Date(Date.now()-days*86400000).toISOString();
    const [contractSummary,leaderboard,transactions]=await Promise.all([
      allRows(db,`SELECT c.id,c.title,c.amount,c.treasury_percent,c.settled_at,c.updated_at,
          COUNT(p.id) payout_count, COALESCE(SUM(p.amount),0) member_total,
          SUM(CASE WHEN pc.confirmed_at IS NOT NULL THEN 1 ELSE 0 END) confirmed_count
        FROM contracts c
        JOIN payouts p ON p.contract_id=c.id
        LEFT JOIN payout_confirmations pc ON pc.payout_id=p.id
        WHERE p.created_at>=? AND p.created_at<=?
        GROUP BY c.id,c.title,c.amount,c.treasury_percent,c.settled_at,c.updated_at
        ORDER BY c.updated_at DESC LIMIT 200`,start,end),
      allRows(db,`SELECT p.user_id, u.nickname,u.username,COUNT(p.id) payout_count,
          SUM(p.amount) earned,
          SUM(CASE WHEN pc.confirmed_at IS NOT NULL THEN p.amount ELSE 0 END) handed_over
        FROM payouts p JOIN users u ON u.id=p.user_id
        LEFT JOIN payout_confirmations pc ON pc.payout_id=p.id
        WHERE p.created_at>=? AND p.created_at<=?
        GROUP BY p.user_id,u.nickname,u.username ORDER BY earned DESC, p.user_id ASC LIMIT 100`,start,end),
      allRows(db,`SELECT kind,COALESCE(SUM(amount),0) amount,COUNT(*) entries
        FROM ledger WHERE created_at>=? AND created_at<=? GROUP BY kind`,start,end)
    ]);
    const kinds=Object.fromEntries(transactions.map(r=>[r.kind,Number(r.amount)||0]));
    const report={
      days,from:start,to:end,
      treasury_income:(kinds.treasury||0)+(kinds.contribution||0),
      expenses:(kinds.expense||0)+(kinds.bonus||0)+(kinds.capt||0),
      net_change:(kinds.treasury||0)+(kinds.contribution||0)-(kinds.expense||0)-(kinds.bonus||0)-(kinds.capt||0),
      contracts_count:contractSummary.length,
      contracts_amount:contractSummary.reduce((s,r)=>s+Number(r.amount||0),0),
      member_earned:leaderboard.reduce((s,r)=>s+Number(r.earned||0),0),
      member_handed_over:leaderboard.reduce((s,r)=>s+Number(r.handed_over||0),0)
    };
    return json({report,contracts:contractSummary,leaderboard});
  }
  // Finance v2.3: 12 complete or current ISO Monday-starting UTC weeks.
  // Only authorized financial viewers can access aggregate and member earnings.
  if(path==='/api/finance/trends'&&method==='GET'){
    if(!can(user,'finance:read')&&!can(user,'finance:manage'))fail(403,'Немає прав');
    const period=url.searchParams.get('period')||'12w';
    if(!['7','30','90','all','12w'].includes(period))fail(400,'Невірний період');
    const current=new Date(),today=new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth(),current.getUTCDate()));
    const monday=new Date(today);monday.setUTCDate(today.getUTCDate()-(today.getUTCDay()+6)%7);
    let requestedFrom;
    if(period==='all'){
      const earliest=await db.prepare("SELECT MIN(created_at) first FROM (SELECT created_at FROM ledger UNION ALL SELECT created_at FROM payouts)").first();
      requestedFrom=earliest?.first||today.toISOString();
    }else if(period==='12w'){
      const start=new Date(monday);start.setUTCDate(start.getUTCDate()-11*7);requestedFrom=start.toISOString();
    }else{
      requestedFrom=new Date(Date.now()-Number(period)*86400000).toISOString();
    }
    const first=new Date(requestedFrom);
    first.setUTCHours(0,0,0,0);
    first.setUTCDate(first.getUTCDate()-(first.getUTCDay()+6)%7);
    const from=requestedFrom,to=now();
    const count=Math.max(1,Math.floor((monday-first)/(7*86400000))+1);
    if(count>1000)fail(400,'Архів понад 1000 тижнів: звузьте період');
    const openingRows=await allRows(db,'SELECT kind,COALESCE(SUM(amount),0) total FROM ledger WHERE created_at<? GROUP BY kind',from);
    const opening=Object.fromEntries(openingRows.map(r=>[r.kind,Number(r.total)||0]));
    const opening_balance=(opening.treasury||0)+(opening.contribution||0)-(opening.expense||0)-(opening.bonus||0)-(opening.capt||0);
    const [entries,payments]=await Promise.all([
      allRows(db,"SELECT kind,amount,created_at FROM ledger WHERE created_at>=? AND created_at<=? ORDER BY created_at",from,to),
      allRows(db,"SELECT p.user_id,u.nickname,u.username,p.amount,p.created_at,pc.confirmed_at FROM payouts p JOIN users u ON u.id=p.user_id LEFT JOIN payout_confirmations pc ON pc.payout_id=p.id WHERE p.created_at>=? AND p.created_at<=? ORDER BY p.created_at",from,to)
    ]);
    const weeks=Array.from({length:count},(_,i)=>{
      const start=new Date(first);start.setUTCDate(first.getUTCDate()+7*i);
      return {week_start:start.toISOString().slice(0,10),income:0,expenses:0,net:0,earned:0,handed_over:0,payout_count:0};
    });
    function weekIndex(value){
      const timestamp=Date.parse(value);
      return Number.isFinite(timestamp)?Math.floor((timestamp-first.getTime())/(7*86400000)):-1;
    }
    for(const e of entries){
      const idx=weekIndex(e.created_at);if(idx<0||idx>=weeks.length)continue;
      const amount=Number(e.amount)||0;
      if(e.kind==='treasury'||e.kind==='contribution')weeks[idx].income+=amount;
      if(e.kind==='expense'||e.kind==='bonus'||e.kind==='capt')weeks[idx].expenses+=amount;
    }
    const members=new Map();
    for(const p of payments){
      const idx=weekIndex(p.created_at);if(idx<0||idx>=weeks.length)continue;
      const amount=Number(p.amount)||0;weeks[idx].earned+=amount;weeks[idx].payout_count++;
      if(p.confirmed_at)weeks[idx].handed_over+=amount;
      const item=members.get(p.user_id)||{user_id:p.user_id,nickname:p.nickname,username:p.username,earned:0,handed_over:0,payout_count:0,weekly:Array(count).fill(0)};
      item.earned+=amount;item.payout_count++;item.weekly[idx]+=amount;
      if(p.confirmed_at)item.handed_over+=amount;
      members.set(p.user_id,item);
    }
    let running=opening_balance;
    for(const w of weeks){w.net=w.income-w.expenses;running+=w.net;w.balance=running;}
    return json({period,from,to,opening_balance,weeks,members:[...members.values()].sort((a,b)=>b.earned-a.earned||a.user_id.localeCompare(b.user_id)).slice(0,100)});
  }
  if(path==='/api/notifications'&&method==='GET')return json({items:await allRows(db,'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 150',user.id)});
  m=path.match(/^\/api\/notifications\/([\w-]+)\/read$/);if(m&&method==='POST'){await db.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').bind(now(),m[1],user.id).run();return json({ok:true});}
  if(path==='/api/audit'&&method==='GET'){if(user.role!=='leader')fail(403,'Лише лідер переглядає журнал');return json({items:await allRows(db,'SELECT * FROM audit ORDER BY created_at DESC LIMIT 1000')});}
  if(path==='/api/stats'&&method==='GET'){
    const users=await allRows(db,"SELECT COUNT(*) count FROM users WHERE status='active'");const all=await allRows(db,'SELECT * FROM records WHERE deleted_at IS NULL');const available=all.filter(r=>permittedRecord(user,r.module,r));const reports=available.filter(x=>x.module==='reports');const tasks=available.filter(x=>x.module==='tasks');const events=available.filter(x=>x.module==='events');const weekAgo=Date.now()-7*86400000,monthAgo=Date.now()-30*86400000;
    const recent=(from)=>available.filter(x=>new Date(x.updated_at).getTime()>=from);const countMod=(items,mod)=>items.filter(x=>x.module===mod).length;
    const participation=can(user,'stats:read')?(await allRows(db,"SELECT r.user_id,r.updated_at,e.department_id,e.owner_id,e.assignee_id,e.module,e.status FROM event_rsvps r JOIN records e ON e.id=r.event_id WHERE r.response='Так' AND e.deleted_at IS NULL")).filter(e=>user.role!=='head'||(!e.department_id||e.department_id===user.department_id)):[];
    const rankFor=(from)=>{
      if(!can(user,'stats:read'))return [];
      const scores=new Map();const add=(id,points)=>{if(!id)return;const x=scores.get(id)||{user_id:id,points:0,completed:0};x.points+=points;x.completed++;scores.set(id,x);};
      for(const r of available.filter(r=>(r.status==='Завершено'||r.status==='Погоджено')&&new Date(r.updated_at).getTime()>=from))add(r.assignee_id||r.owner_id,r.module==='tasks'?3:r.module==='events'?2:1);
      for(const r of participation.filter(r=>new Date(r.updated_at).getTime()>=from))add(r.user_id,2);
      return [...scores.values()].sort((a,b)=>b.points-a.points).slice(0,25);
    };const leaderboard_week=rankFor(weekAgo),leaderboard_month=rankFor(monthAgo);
    const financeEvents=can(user,'finance:read')||can(user,'finance:manage')?await allRows(db,"SELECT amount,created_at,kind FROM ledger WHERE kind IN ('treasury','contribution')"):[];const revenue=(from)=>financeEvents.filter(x=>new Date(x.created_at).getTime()>=from).reduce((sum,x)=>sum+x.amount,0);return json({members:can(user,'members:read')?users[0]?.count:null,tasks_active:tasks.filter(r=>!['Завершено','Відхилено'].includes(r.status)).length,reports_review:reports.filter(r=>r.status==='На перевірці').length,events_upcoming:events.filter(r=>r.starts_at&&new Date(r.starts_at).getTime()>=Date.now()).length,week:{tasks:countMod(recent(weekAgo),'tasks'),reports:countMod(recent(weekAgo),'reports'),events:countMod(recent(weekAgo),'events'),income:revenue(weekAgo)},month:{tasks:countMod(recent(monthAgo),'tasks'),reports:countMod(recent(monthAgo),'reports'),events:countMod(recent(monthAgo),'events'),income:revenue(monthAgo)},leaderboard:leaderboard_week,leaderboard_week,leaderboard_month});
  }
  if(path==='/api/export'&&method==='GET'){
    const mod=url.searchParams.get('module');let data;if(mod==='users'){data=(await allRows(db,'SELECT * FROM users')).filter(x=>x.id===user.id||can(user,'members:read')&&manageInDepartment(user,x.department_id)).map(safeUser);}else if(mod==='contracts'){data=(await allRows(db,'SELECT * FROM contracts')).filter(c=>user.role==='head'?c.department_id===user.department_id:(can(user,'finance:read')||can(user,'finance:manage')||parseJson(c.participant_ids,[]).includes(user.id))).map(contractView);}else if(mod==='applications'){requirePerm(user,'recruitment:manage');data=(await allRows(db,'SELECT * FROM applications')).map(applicationView);}else if(MODULES[mod]){data=(await allRows(db,'SELECT * FROM records WHERE module=? AND deleted_at IS NULL',mod)).filter(r=>permittedRecord(user,mod,r)).map(mapRecord);}else fail(400,'Невідомий модуль експорту');return json({module:mod,exported_at:now(),items:data},200,{'Content-Disposition':`attachment; filename="grizzly-${mod}.json"`});
  }
  fail(404,'Маршрут не знайдено');
}
// Server-rendered public landing metadata and crawlable summary; private API content is never embedded.
const PUBLIC_SEO={
 '/about/':{title:'Історія та напрямки — GRIZZLY Family',description:'Історія сім’ї Grizzly, її принципи, керівництво та напрямки у GTA 5 Roleplay.',heading:'ІСТОРІЯ GRIZZLY',intro:'Сім’я Grizzly об’єднує гравців, для яких важливі повага, дисципліна й командна робота.'},
 '/news/':{title:'Новини сім’ї — GRIZZLY Family',description:'Оголошення, новини та важливі події сім’ї GRIZZLY у GTA 5 RP.',heading:'НОВИНИ GRIZZLY',intro:'Офіційні новини та оголошення сім’ї. Актуальні записи з’являються після публікації.'},
 '/achievements/':{title:'Досягнення — GRIZZLY Family',description:'Перемоги CAPT, нагороди та важливі досягнення GRIZZLY Family.',heading:'ДОСЯГНЕННЯ GRIZZLY',intro:'Здобутки сім’ї, результати спільних подій і підтверджені перемоги.'},
 '/gallery/':{title:'Галерея — GRIZZLY Family',description:'Фотографії сім’ї GRIZZLY: CAPT, автомобілі, збори та події GTA 5 RP.',heading:'ГАЛЕРЕЯ GRIZZLY',intro:'Світлини та найкращі моменти спільного життя сім’ї GRIZZLY.'},
 '/calendar/':{title:'Календар заходів — GRIZZLY Family',description:'Збори, тренування, CAPT та інші публічні заходи сім’ї GRIZZLY.',heading:'КАЛЕНДАР GRIZZLY',intro:'Публічний розклад зборів, тренувань та інших заходів сім’ї.'},
 '/join/':{title:'Вступити до сім’ї — GRIZZLY Family',description:'Подайте заявку на вступ до GRIZZLY Family у GTA 5 Roleplay.',heading:'ВСТУП ДО GRIZZLY',intro:'Познайомтеся з правилами вступу й подайте заявку до сім’ї.'}
};
function seoSafe(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
async function publicHtml(req,env){
 const url=new URL(req.url),page=PUBLIC_SEO[url.pathname];
 if(!page||req.method!=='GET')return env.ASSETS.fetch(req);
 // Cloudflare canonicalizes /index.html to / with a 307; fetch the canonical asset URL to avoid forwarding that redirect.
 const res=await env.ASSETS.fetch(new Request(new URL('/',req.url),req));
 if(!res.ok)return res;
 let html=await res.text();
 const canonical='https://grizzly-family.online'+url.pathname;
 const swap=(key,value)=>{const re=new RegExp('(<meta (?:name|property)="'+key+'" content=")[^"]*(" />)');html=html.replace(re,(_,a,b)=>a+seoSafe(value)+b);};
 html=html.replace(/<title>[^<]*<\/title>/,'<title>'+seoSafe(page.title)+'</title>')
          .replace(/(<link rel="canonical" href=")[^"]*(" \/>)/,'$1'+canonical+'$2');
 swap('description',page.description);swap('og:title',page.title);swap('og:description',page.description);swap('og:url',canonical);
 html=html.replace('<div id="app">','<div id="app"><main class="gr-prerender"><h1>'+seoSafe(page.heading)+'</h1><p>'+seoSafe(page.intro)+'</p><a href="/">GRIZZLY Family — Головна</a></main>');
 // Remove the root-only loading emblem: the public SEO shell is already visible until hydration.
 html=html.replace('<div class="boot"><div class="brand-mark big">🐻</div><span>GRIZZLY</span></div>','');
 const headers=new Headers(res.headers);headers.delete('content-length');headers.set('Content-Type','text/html; charset=utf-8');headers.set('Cache-Control','no-store');headers.set('X-Grizzly-Seo-Route',url.pathname);
 return new Response(html,{status:res.status,headers});
}
const SECURITY_HEADERS={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
export default {async fetch(req,env,ctx){try{if(!new URL(req.url).pathname.startsWith('/api/'))return publicHtml(req,env);const res=await handleApi(req,env,ctx);const h=new Headers(res.headers);Object.entries(SECURITY_HEADERS).forEach(([k,v])=>h.set(k,v));return new Response(res.body,{status:res.status,headers:h});}catch(err){const code=err instanceof HttpError?err.status:500;if(code===500)console.error('Grizzly API error',err);return json({error:code===500?'Внутрішня помилка сервера':err.message},code,SECURITY_HEADERS);}}};
