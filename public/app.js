'use strict';
// Hide the referral tracking parameter in the browser address bar without reloading
// or disrupting the current SPA hash route or other query parameters.
{
  const url = new URL(window.location.href);
  if (url.searchParams.get('utm_source') === 'chatgpt.com') {
    url.searchParams.delete('utm_source');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }
}
const $=sel=>document.querySelector(sel);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('uk-UA');
const date=v=>v?new Date(v).toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'}):'—';
const short=v=>String(v||'').slice(0,18);
const roles={leader:'Лідер',deputy:'Заступник',head:'Керівник напрямку',member:'Учасник'};
const statuses=['Заплановано','У роботі','На перевірці','На доопрацювання','Погоджено','Відхилено','Завершено'];
const applicationStatuses=['Очікує','Прийнято','Відхилено'];
const permissionNames={'members:read':'Перегляд складу','members:write':'Керування складом','tasks:manage':'Завдання','reports:review':'Перевірка звітів','promotions:review':'Підвищення','events:manage':'Заходи','capt:manage':'CAPT','fleet:manage':'Автопарк','recruitment:manage':'Рекрутинг','notices:manage':'Оголошення','content:manage':'Публічний контент','finance:read':'Перегляд фінансів','finance:manage':'Нарахування й фінанси','discipline:manage':'Дисципліна','stats:read':'Статистика'};
const nav=[
  {id:'overview',text:'Огляд',icon:'◫',group:'РОБОТА'},
  {id:'members',text:'Склад сім’ї',icon:'♟',group:'РОБОТА'},
  {id:'ranks',text:'Ранги та підвищення',icon:'⬡',group:'РОБОТА'},
  {id:'departments',text:'Напрямки',icon:'▦',group:'РОБОТА'},
  {id:'workspace',text:'Управління підрозділом',icon:'▤',group:'РОБОТА'},
  {id:'tasks',text:'Завдання',icon:'☑',group:'ОПЕРАЦІЇ'},
  {id:'contracts',text:'Контракти',icon:'▤',group:'ОПЕРАЦІЇ'},
  {id:'capt',text:'CAPT',icon:'◎',group:'ОПЕРАЦІЇ'},
  {id:'finance',text:'Фінанси',icon:'₴',group:'ОПЕРАЦІЇ'},
  {id:'fleet',text:'Автопарк',icon:'▣',group:'ОПЕРАЦІЇ'},
  {id:'events',text:'Заходи',icon:'◈',group:'ОПЕРАЦІЇ'},
  {id:'applications',text:'Заявки на вступ',icon:'✉',group:'АДМІНІСТРУВАННЯ'},
  {id:'reports',text:'Звіти та підвищення',icon:'☷',group:'АДМІНІСТРУВАННЯ'},
  {id:'discipline',text:'Дисципліна',icon:'⚑',group:'АДМІНІСТРУВАННЯ'},
  {id:'announcements',text:'Оголошення',icon:'◉',group:'АДМІНІСТРУВАННЯ'},
  {id:'gallery',text:'Галерея',icon:'▧',group:'АДМІНІСТРУВАННЯ'},
  {id:'public_news',text:'Новини сайту',icon:'✦',group:'АДМІНІСТРУВАННЯ'},
  {id:'public_team',text:'Керівництво сайту',icon:'♛',group:'АДМІНІСТРУВАННЯ'},
  {id:'public_achievements',text:'Досягнення сайту',icon:'★',group:'АДМІНІСТРУВАННЯ'},
  {id:'public_calendar',text:'Календар сайту',icon:'▣',group:'АДМІНІСТРУВАННЯ'},
  {id:'stats',text:'Статистика',icon:'▥',group:'СИСТЕМА'},
  {id:'audit',text:'Журнал змін',icon:'≡',group:'СИСТЕМА'},
  {id:'settings',text:'Налаштування',icon:'⚙',group:'СИСТЕМА'},
  {id:'profile',text:'Мій профіль',icon:'◌',group:'СИСТЕМА'}
];
const moduleInfo={
  tasks:['Завдання','Створення та виконання завдань','tasks:manage'],
  reports:['Звіти','Особисті й командні рапорти з доказами','reports:review'],
  promotions:['Підвищення','Заявки на підвищення з чеклістами','promotions:review'],
  events:['Заходи','Збори, виїзди, тренування та підтвердження участі','events:manage'],
  capt_matches:['CAPT — бої','Склад, розклад та результати CAPT','capt:manage'],
  capt_training:['CAPT — тренування','Розклад і програма тренувань','capt:manage'],
  capt_attendance:['CAPT — відвідування','Запис на бій, облік участі та AFK','capt:manage'],
  vehicles:['Транспорт','Автопарк сім’ї','fleet:manage'],
  vehicle_loans:['Видача й повернення','Журнал переміщення транспорту','fleet:manage'],
  discipline:['Порушення','Попередження й дисциплінарні рішення','discipline:manage'],
  blacklist:['Чорний список','Обмежений доступ для керівництва','discipline:manage'],
  notices:['Оголошення','Повідомлення для учасників','notices:manage'],
  templates:['Шаблони','Тексти з {час}, {місце}, {ім’я}','notices:manage'],
  gallery:['Галерея','Публікація фото за посиланнями ImgBB','content:manage'],
  public_news:['Новини сайту','Публічні оголошення для головної сторінки','content:manage'],
  public_team:['Керівництво сайту','Публічні ігрові профілі керівництва','content:manage'],
  public_achievements:['Досягнення сайту','Опубліковані перемоги CAPT, нагороди та визначні події','content:manage'],
  public_calendar:['Календар сайту','Публічні збори, тренування та івенти','content:manage']
};
const groupRoutes={capt:['capt_matches','capt_training','capt_attendance'],fleet:['vehicles'],discipline:['discipline','blacklist'],announcements:['notices','templates'],reports:['reports','promotions']};
const state={user:null,route:'overview',sub:{},search:'',sort:'new',period:'week',settingsVersions:{},public:null,users:[],roster:[],departments:[],ranks:[],notifications:[],filter:'',menu:false};
function can(p){return state.user?.role==='leader'||state.user?.permissions?.includes('*')||state.user?.permissions?.includes(p);}
function toast(msg,error=false){const div=document.createElement('div');div.className='toast'+(error?' error':'');div.textContent=msg;$('#toast-root').append(div);setTimeout(()=>div.remove(),4500);}
async function api(path,method='GET',payload){const h={'X-Grizzly-Client':'1'};if(payload!==undefined)h['Content-Type']='application/json';const r=await fetch('/api'+path,{method,credentials:'same-origin',headers:h,body:payload===undefined?undefined:JSON.stringify(payload),cache:'no-store'});let o;try{o=await r.json();}catch{o={error:'Невірна відповідь сервера'};}if(!r.ok){const err=new Error(o.error||`Помилка ${r.status}`);err.status=r.status;throw err;}return o;}
async function preload(){const [users,deps,ranks,roster]=await Promise.all([api('/users'),api('/departments'),api('/ranks'),api('/members')]);state.users=users.items;state.roster=roster.items;state.departments=deps.items;state.ranks=ranks.items;state.rankTemplates=ranks.templates||[];}
function userName(id){const x=state.users.find(y=>y.id===id)||state.roster.find(y=>y.id===id);return x?(x.nickname||x.username||'Учасник'):id?'Учасник':'—';}
function departmentName(id){return state.departments.find(x=>x.id===id)?.title||'—';}
function rankName(id){return state.ranks.find(x=>x.id===Number(id))?.title||'—';}
function badge(s){const cls=['Погоджено','Прийнято','Завершено','active','Так'].includes(s)?'green':['Відхилено','blocked','Ні'].includes(s)?'red':['Очікує','На перевірці','Заплановано'].includes(s)?'yellow':'blue';return `<span class="badge ${cls}">${esc(s||'—')}</span>`;}
function intro(title,description='',right=''){return `<div class="page-intro"><div><div class="overline">GRIZZLY / FAMILY PANEL</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${right}</div>`;}
function empty(label='Тут поки немає записів',desc='Створіть перший запис або змініть параметри пошуку.'){return `<div class="empty"><div><div class="empty-icon">◇</div><strong>${esc(label)}</strong>${esc(desc)}</div></div>`;}
function itemText(obj){return esc(JSON.stringify(obj));}
const galleryCategories=[['all','Усі фото'],['capt','CAPT'],['cars','Автомобілі'],['meetings','Збори'],['events','Івенти'],['other','Інше']];
function kyivNowLocal(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return v.year+'-'+v.month+'-'+v.day+'T'+v.hour+':'+v.minute;}
function kyivWallDate(value){return String(value||'').slice(0,16).replace(' ','T');}
function kyivDueStatus(value,status){if(!value||['Завершено','Відхилено'].includes(status))return '';return kyivWallDate(value)<kyivNowLocal()?'Прострочено':'До '+kyivWallDate(value).replace('T',' ');}
function galleryPhoto(record){
  const urls=Array.isArray(record?.evidence)?record.evidence:[];
  for(const raw of urls){
    if(typeof raw!=='string')continue;
    try{
      const url=new URL(raw);
      if(url.protocol==='https:'&&url.hostname==='i.ibb.co'&&/\.(png|jpe?g|webp|gif)$/i.test(url.pathname))return url.href;
    }catch{}
  }
  return '';
}
function galleryLink(record){
  for(const raw of Array.isArray(record?.evidence)?record.evidence:[]){
    if(typeof raw!=='string')continue;
    try{const url=new URL(raw);if(url.protocol==='https:'&&['i.ibb.co','ibb.co'].includes(url.hostname))return url.href;}catch{}
  }
  return '';
}
function galleryCategory(record){
  const category=String(record?.extra?.gallery_category||'other');
  return galleryCategories.some(([k])=>k===category&&k!=='all')?category:'other';
}
function galleryCategoryLabel(category){
  return galleryCategories.find(([k])=>k===category)?.[1]||'Інше';
}
function publicGalleryFiltered(){
  const gallery=Array.isArray(state.public?.gallery)?state.public.gallery:[];
  const category=state.galleryFilter||'all';
  const selected=category==='all'?gallery:gallery.filter(r=>galleryCategory(r)===category);
  return [...selected].sort((a,b)=>state.gallerySort==='name'?String(a.title||'').localeCompare(String(b.title||''),'uk'):String(b.created_at||'').localeCompare(String(a.created_at||'')));
}
function publicPhotoCard(record,index){
  const title=String(record.title||'Момент GRIZZLY');
  const description=String(record.details||'');
  const photo=galleryPhoto(record),link=galleryLink(record),category=galleryCategory(record);
  const id=String(record.id||'');
  return '<article class="gr-photo-card'+(record.extra?.featured?' gr-photo-featured':'')+'">'+
    '<div class="gr-photo-frame">'+
    (photo?'<img src="'+esc(photo)+'" alt="'+esc(title)+'" loading="lazy" decoding="async">':
      '<div class="gr-photo-empty" aria-hidden="true"><span>GRIZZLY</span><strong>✦</strong><small>FAMILY MOMENTS</small></div>')+
    '<span class="gr-photo-number">'+String(index+1).padStart(2,'0')+'</span>'+
    '<span class="gr-photo-category">'+esc(galleryCategoryLabel(category))+'</span>'+
    (photo&&id?'<button type="button" class="gr-photo-view" data-action="gallery-open" data-id="'+esc(id)+'" aria-label="Переглянути фото: '+esc(title)+'">Переглянути фото ↗</button>':'')+
    '</div>'+
    '<div class="gr-photo-info"><div><h3>'+esc(title)+'</h3>'+(description?'<p>'+esc(description.slice(0,100))+'</p>':'')+'</div>'+
    (link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer" aria-label="Відкрити фото: '+esc(title)+'">↗</a>':'')+
    '</div></article>';
}
function renderPublicGallery(){
  const all=Array.isArray(state.public?.gallery)?state.public.gallery:[];
  if(!all.length)return '<div class="gr-gallery-placeholder"><div class="gr-placeholder-mark" aria-hidden="true">✦</div><div><span class="gr-small-label">GRIZZLY / GALLERY</span><h3>НАШІ НАЙКРАЩІ МОМЕНТИ<br>ЩЕ ПОПЕРЕДУ.</h3><p>Коли керівництво опублікує фото в розділі «Галерея», вони автоматично з’являться тут.</p></div></div>';
  const active=state.galleryFilter||'all';
  const items=publicGalleryFiltered();
  const filters='<div class="gr-gallery-filters" role="group" aria-label="Фільтр фотографій">'+galleryCategories.map(([id,label])=>{
    const count=id==='all'?all.length:all.filter(r=>galleryCategory(r)===id).length;
    if(!count&&id!=='all')return '';
    return '<button type="button" class="gr-gallery-filter'+(active===id?' active':'')+'" data-action="gallery-filter" data-category="'+id+'" aria-pressed="'+(active===id)+'">'+esc(label)+' <span>'+count+'</span></button>';
  }).join('')+'</div>';
  const sort='<div class="gr-gallery-sort"><label for="gr-gallery-sort">Сортування</label><select id="gr-gallery-sort" class="select"><option value="new" '+(state.gallerySort==='name'?'':'selected')+'>Нові спочатку</option><option value="name" '+(state.gallerySort==='name'?'selected':'')+'>За назвою</option></select></div>';
  return filters+sort+(items.length?'<div class="gr-gallery-grid">'+items.map(publicPhotoCard).join('')+'</div>':'<div class="gr-gallery-filter-empty">У цій категорії ще немає фотографій.</div>');
}
function publicGalleryLightbox(id){
  const list=publicGalleryFiltered().filter(r=>galleryPhoto(r));
  const at=list.findIndex(r=>String(r.id||'')===String(id||''));
  if(at<0)return;
  const record=list[at],image=galleryPhoto(record);
  if(!image)return;
  state.galleryLightboxId=record.id;
  modal('GRIZZLY — '+record.title,
    '<div class="gr-gallery-lightbox"><div class="gr-gallery-lightbox-image"><img src="'+esc(image)+'" alt="'+esc(record.title)+'"></div>'+
    '<div class="gr-gallery-lightbox-details"><span class="gr-small-label">'+esc(galleryCategoryLabel(galleryCategory(record)))+' · '+(at+1)+' / '+list.length+'</span>'+
    '<strong>'+esc(record.title)+'</strong>'+(record.details?'<p>'+esc(record.details)+'</p>':'')+
    '<div class="gr-gallery-lightbox-controls">'+
    '<button type="button" class="btn secondary" data-action="gallery-step" data-offset="-1" '+(at===0?'disabled':'')+' aria-label="Попереднє фото">← Попереднє</button>'+
    '<button type="button" class="btn secondary" data-action="gallery-step" data-offset="1" '+(at===list.length-1?'disabled':'')+' aria-label="Наступне фото">Наступне →</button>'+
    '</div></div></div>');
}
function publicGalleryStep(offset){
  const list=publicGalleryFiltered().filter(r=>galleryPhoto(r));
  const index=list.findIndex(r=>String(r.id)===String(state.galleryLightboxId));
  const next=list[index+offset];
  if(next)publicGalleryLightbox(next.id);
}
const newsTypes=[['news','Новина'],['announcement','Оголошення'],['capt','CAPT-оголошення'],['event','Подія'],['recruitment','Набір'],['achievement','Досягнення']];
function newsTypeLabel(key){return newsTypes.find(([id])=>id===key)?.[1]||'Новина';}
function renderPublicNews(){
  const rows=Array.isArray(state.public?.news)?state.public.news:[];
  if(!rows.length)return '<div class="gr-news-empty"><span class="gr-small-label">GRIZZLY / NEWS</span><h3>НОВИНИ ГОТУЮТЬСЯ.</h3><p>Нові публікації з’являться тут після підтвердження керівництвом.</p></div>';
  return '<div class="gr-news-grid">'+rows.map((post,i)=>{
    const txt=String(post.details||''),shortText=txt.length>260?txt.slice(0,260).trimEnd()+'…':txt;
    return '<article class="gr-news-card'+(post.featured?' gr-news-featured':'')+'">'+
      '<div class="gr-news-top"><span class="gr-news-category">'+esc(newsTypeLabel(post.category))+'</span><span class="gr-news-date">'+esc(date(post.updated_at))+'</span></div>'+
      '<div class="gr-news-count">'+String(i+1).padStart(2,'0')+' / GRIZZLY</div>'+
      '<h3>'+esc(post.title)+'</h3><p class="gr-news-excerpt">'+esc(shortText)+'</p>'+
      (txt.length>260?'<details class="gr-news-expand"><summary>Читати повністю <span>↗</span></summary><p>'+esc(txt)+'</p></details>':'')+
      (post.category==='recruitment'?'<a class="gr-news-join" href="#join">Подати заявку ↗</a>':'')+
      (post.featured?'<span class="gr-news-important">★ Важливе</span>':'')+
      '</article>';
  }).join('')+'</div>';
}
function renderPublicTeam(){
  const members=Array.isArray(state.public?.team)?state.public.team:[];
  if(!members.length)return '<div class="gr-team-empty"><strong>ЛЮДИ, ЯКІ СТОЯТЬ ЗА GRIZZLY.</strong><p>Профілі керівництва з’являться після публікації в особистій панелі.</p></div>';
  return '<div class="gr-team-grid">'+members.map((person,index)=>{
    const photo=galleryPhoto({evidence:[person.photo]});
    const name=String(person.nickname||'GRIZZLY');
    const position=String(person.position||'Керівництво');
    const bio=String(person.bio||'');
    const initial=name.trim().slice(0,1).toUpperCase()||'G';
    return '<article class="gr-team-card">'+
      '<div class="gr-team-portrait">'+
        (photo?'<img src="'+esc(photo)+'" loading="lazy" decoding="async" alt="Ігровий персонаж '+esc(name)+'">':
        '<div class="gr-team-placeholder" aria-hidden="true"><span>'+esc(initial)+'</span><small>GRIZZLY FAMILY</small></div>')+
        '<span class="gr-team-index">'+String(index+1).padStart(2,'0')+' / TEAM</span>'+
      '</div><div class="gr-team-details"><span class="gr-team-role">'+esc(position)+'</span><h3>'+esc(name)+'</h3>'+
      (bio?'<p>'+esc(bio)+'</p>':'')+'</div></article>';
  }).join('')+'</div>';
}
const achievementTypes=[['all','Усі'],['capt','CAPT'],['milestone','Віхи'],['event','Події'],['award','Нагороди']];
function achievementTypeLabel(key){return achievementTypes.find(([k])=>k===key)?.[1]||'Віхи';}
function renderPublicAchievements(){
  const list=Array.isArray(state.public?.achievements)?state.public.achievements:[];
  if(!list.length)return '<div class="gr-ach-empty"><span>★</span><h3>НАША ІСТОРІЯ ПИШЕТЬСЯ.</h3><p>Підтверджені перемоги, важливі події та нагороди з’являться тут після публікації керівництвом.</p></div>';
  const category=state.achievementFilter||'all';
  const filtered=category==='all'?list:list.filter(a=>a.category===category);
  const shown=[...filtered].sort((a,b)=>state.achievementSort==='old'?String(a.achieved_on||'').localeCompare(String(b.achieved_on||'')):String(b.achieved_on||'').localeCompare(String(a.achieved_on||'')));
  const counts={all:list.length,capt:list.filter(a=>a.category==='capt').length,milestone:list.filter(a=>a.category==='milestone').length,event:list.filter(a=>a.category==='event').length,award:list.filter(a=>a.category==='award').length};
  const tabs='<div class="gr-ach-filters" role="group" aria-label="Фільтр досягнень">'+achievementTypes.filter(([id])=>id==='all'||counts[id]).map(([id,name])=>
    '<button type="button" class="gr-ach-filter'+(id===category?' active':'')+'" data-action="achievement-filter" data-category="'+id+'" aria-pressed="'+(id===category)+'">'+esc(name)+' <span>'+counts[id]+'</span></button>').join('')+'</div>';
  const sort='<div class="gr-gallery-sort"><label for="gr-achievement-sort">Порядок</label><select id="gr-achievement-sort" class="select"><option value="new" '+(state.achievementSort==='old'?'':'selected')+'>Нові спочатку</option><option value="old" '+(state.achievementSort==='old'?'selected':'')+'>Старі спочатку</option></select></div>';
  const cards=shown.map((a,index)=>{
    const photo=galleryPhoto({evidence:[a.photo]});
    const label=achievementTypeLabel(a.category);
    const dateLabel=a.achieved_on?date(a.achieved_on):'—';
    const details=String(a.description||'');
    const icon=a.category==='capt'?'✦':a.category==='award'?'★':a.category==='event'?'◈':'◆';
    return '<article class="gr-ach-card'+(a.featured?' gr-ach-featured':'')+'">'+
      '<div class="gr-ach-card-top"><span>'+esc(label)+'</span><span>'+esc(dateLabel)+'</span></div>'+
      '<div class="gr-ach-visual">'+(photo?'<img src="'+esc(photo)+'" alt="'+esc(a.title)+'" loading="lazy" decoding="async">':
        '<div class="gr-ach-icon" aria-hidden="true">'+icon+'</div>')+
        '<span class="gr-ach-serial">'+String(index+1).padStart(2,'0')+' / GRIZZLY</span></div>'+
      '<div class="gr-ach-details">'+(a.featured?'<span class="gr-ach-highlight">★ Важливе досягнення</span>':'')+
      '<h3>'+esc(a.title)+'</h3><p>'+esc(details)+'</p></div></article>';
  }).join('');
  return sort+'<div class="gr-ach-stats"><div><strong>'+counts.all+'</strong><span>Опублікованих досягнень</span></div>'+
    '<div><strong>'+counts.capt+'</strong><span>Здобутків CAPT</span></div>'+
    '<div><strong>'+counts.award+'</strong><span>Нагород</span></div></div>'+
    tabs+(shown.length?'<div class="gr-ach-grid">'+cards+'</div>':'<div class="gr-ach-empty"><p>У цій категорії поки немає записів.</p></div>');
}
const grPublicRoutes={home:'home',about:'about',team:'about',directions:'about',rules:'about',news:'news',achievements:'achievements',gallery:'gallery',calendar:'calendar',join:'join'};
const grPublicPaths={home:'/',about:'/about/',news:'/news/',achievements:'/achievements/',gallery:'/gallery/',calendar:'/calendar/',join:'/join/'};
function publicPageFromHash(hash){const route=grPublicRoutes[String(hash||'').replace(/^#/,'').toLowerCase()];if(route)return route;const path=String(location.pathname||'/').replace(/^\/+|\/+$/g,'');return grPublicRoutes[path]||'home';}
function renderPublicNewsPreview(){
  const posts=Array.isArray(state.public?.news)?state.public.news.slice(0,3):[];
  if(!posts.length)return '<div class="gr-home-news-empty"><p>Новини сім’ї скоро з’являться тут.</p><a href="#news">Переглянути новини ↗</a></div>';
  return '<div class="gr-home-news-grid">'+posts.map(p=>{
    const description=String(p.details||''),excerpt=description.length>130?description.slice(0,130).trimEnd()+'…':description;
    return '<article class="gr-home-news-card"><div class="gr-home-news-meta"><span>'+esc(newsTypeLabel(p.category))+'</span><time>'+esc(date(p.updated_at))+'</time></div>'+
      '<h3>'+esc(p.title)+'</h3><p>'+esc(excerpt)+'</p><a href="#news">Усі новини ↗</a></article>';
  }).join('')+'</div>';
}
const grCalendarCategories=[['all','Усі'],['meeting','Збори'],['capt','CAPT'],['training','Тренування'],['event','Івенти']];
function grCalendarLabel(value){return grCalendarCategories.find(([id])=>id===value)?.[1]||'Івент';}
function grCalendarMonthValue(){
  const v=String(state.calendarMonth||'');
  if(/^\d{4}-(0[1-9]|1[0-2])$/.test(v))return v;
  const now=new Date();
  return String(now.getFullYear()).padStart(4,'0')+'-'+String(now.getMonth()+1).padStart(2,'0');
}
function grCalendarEvents(){
  const all=Array.isArray(state.public?.calendar)?state.public.calendar:[];
  const category=state.calendarCategory||'all';
  return all.filter(e=>category==='all'||e.category===category);
}
function grCalendarDay(ymd){const d=new Date(ymd+'T12:00:00Z');return d.toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'});}
function grCalendarCard(event){
  const day=kyivWallDate(event.starts_at).slice(0,10);
  const start=kyivWallDate(event.starts_at).slice(11,16);
  const end=kyivWallDate(event.ends_at).slice(11,16);
  const time=start?start+(end?'–'+end:''):'Час уточнюється';
  return '<article class="gr-cal-event">'+
    '<div class="gr-cal-event-time"><span>'+esc(grCalendarDay(day))+'</span><strong>'+esc(time)+'</strong></div>'+
    '<div class="gr-cal-event-body"><div class="gr-cal-event-type">'+esc(grCalendarLabel(event.category))+'</div>'+
    '<h3>'+esc(event.title)+'</h3><p>'+esc(event.description||'')+'</p>'+
    (event.location?'<div class="gr-cal-event-location">⌖ '+esc(event.location)+'</div>':'')+'</div></article>';
}
function renderPublicCalendar(){
  const month=grCalendarMonthValue();
  const [year,mon]=month.split('-').map(Number);
  const first=new Date(Date.UTC(year,mon-1,1));
  const monthName=first.toLocaleDateString('uk-UA',{month:'long',year:'numeric',timeZone:'UTC'});
  const firstWeekday=(first.getUTCDay()+6)%7;
  const days=new Date(Date.UTC(year,mon,0)).getUTCDate();
  const calendar=grCalendarEvents();
  const monthEvents=calendar.filter(e=>String(e.starts_at||'').startsWith(month));
  const counts=new Map();
  for(const ev of monthEvents){const day=String(ev.starts_at||'').slice(0,10);counts.set(day,(counts.get(day)||0)+1);}
  const today=kyivNowLocal().slice(0,10);
  const week=['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(x=>'<span class="gr-cal-weekday">'+x+'</span>').join('');
  let cells='';
  for(let i=0;i<firstWeekday;i++)cells+='<span class="gr-cal-pad" aria-hidden="true"></span>';
  for(let day=1;day<=days;day++){
    const date=month+'-'+String(day).padStart(2,'0'),count=counts.get(date)||0;
    cells+='<div class="gr-cal-cell'+(count?' has-event':'')+(today===date?' is-today':'')+'" aria-label="'+esc(grCalendarDay(date))+(count?' — заходів: '+count:'')+'">'+
      '<span>'+day+'</span>'+(count?'<a class="gr-cal-count" href="#cal-events" title="Переглянути заходи: '+esc(grCalendarDay(date))+'">'+count+' '+(count===1?'подія':'події')+'</a>':'')+'</div>';
  }
  const filters=grCalendarCategories.map(([key,title])=>'<button type="button" data-action="public-calendar-filter" data-category="'+key+'" class="gr-cal-filter'+((state.calendarCategory||'all')===key?' active':'')+'" aria-pressed="'+((state.calendarCategory||'all')===key)+'">'+esc(title)+'</button>').join('');
  return '<div class="gr-cal-filterbar">'+filters+'</div>'+
    '<div class="gr-cal-layout"><div class="gr-cal-month">'+
    '<div class="gr-cal-controls"><button type="button" data-action="public-calendar-prev" aria-label="Попередній місяць">←</button>'+
    '<h3>'+esc(monthName)+'</h3><button type="button" data-action="public-calendar-next" aria-label="Наступний місяць">→</button></div>'+
    '<div class="gr-cal-grid">'+week+cells+'</div><p class="gr-cal-note">Час подій вказано за Києвом (Europe/Kyiv).</p></div>'+
    '<div class="gr-cal-sidebar" id="cal-events"><div class="gr-cal-sidebar-head"><span class="gr-kicker">РОЗКЛАД</span><h3>ПОДІЇ МІСЯЦЯ</h3></div>'+
    (monthEvents.length?monthEvents.map(grCalendarCard).join(''):'<div class="gr-cal-empty">У цьому місяці немає опублікованих заходів. Перевір інший місяць або категорію.</div>')+
    '</div></div>';
}
function renderPublic(){
  const page=publicPageFromHash(location.hash);
  const routeKey=String(location.pathname||'/')+String(location.hash||'');
  const publicRouteChanged=state.publicLastRoute!==undefined&&state.publicLastRoute!==routeKey;
  state.publicLastRoute=routeKey;
  const publicTitles={home:'Головна',about:'Про сім’ю',news:'Новини',achievements:'Досягнення',gallery:'Галерея',calendar:'Календар заходів',join:'Вступити'};
  if(typeof document!=='undefined'){
    document.title=(publicTitles[page]||'Головна')+' — GRIZZLY Family | GTA 5 RP';
    const canonical=document.querySelector('link[rel="canonical"]');
    if(canonical)canonical.href='https://grizzly-family.online'+(grPublicPaths[page]||'/');
  }
  const settings=state.public?.settings||{};
  const gallery=Array.isArray(state.public?.gallery)?state.public.gallery:[];
  const highlighted=gallery.find(r=>r?.extra?.featured&&galleryPhoto(r))||gallery.find(r=>galleryPhoto(r));
  const heroPhoto=highlighted?galleryPhoto(highlighted):'';
  const history=String(settings.history||'Grizzly об’єднує гравців, для яких повага, дисципліна та взаємодопомога важливіші за гучні слова.');
  const preview=history.length>480?history.slice(0,480).trimEnd()+'…':history;
  const introText=String(settings.tagline||'Сила в єдності. Повага — у вчинках.');
  const rules=String(settings.rules||'Дотримуйся правил сервера, субординації та поважай інших учасників сім’ї.');
  const requirements=String(settings.requirements||'Активність, командна гра, дисципліна та бажання розвивати сім’ю.');
  let discord='';
  try{
    const d=new URL(settings.discord_url||'');
    if(d.protocol==='https:'&&['discord.gg','discord.com','www.discord.com'].includes(d.hostname))discord=d.href;
  }catch{}
  const discordLink=discord?'<a class="gr-nav-discord" href="'+esc(discord)+'" target="_blank" rel="noopener noreferrer">Discord ↗</a>':'';
  const navLinks=[['home','Головна'],['about','Про сім’ю'],['news','Новини'],['achievements','Досягнення'],['gallery','Галерея'],['calendar','Календар'],['join','Вступити']].map(([route,label])=>'<a href="'+(grPublicPaths[route]||'/')+'"'+(page===route?' aria-current="page"':'')+'>'+label+'</a>').join('')+discordLink;
  $('#app').innerHTML=
  '<div class="gr-public">'+
  '<div class="gr-topline"><div class="gr-container"><span><i></i> GTA 5 ROLEPLAY · LOS SANTOS</span><span>GRIZZLY FAMILY / COMMUNITY</span></div></div>'+
  '<header class="gr-header"><div class="gr-container gr-header-inner">'+
    '<a href="#home" class="gr-logo" aria-label="GRIZZLY — на головну"><img class="gr-logo-image" src="/grizzly-header-logo.svg" alt="" width="48" height="48" decoding="async"><span class="gr-logo-copy"><strong>GRIZZLY</strong><small>FAMILY / GTA V RP</small></span></a>'+
    '<nav class="gr-nav" aria-label="Основна навігація">'+navLinks+'</nav>'+
    '<div class="gr-header-actions">'+(state.user?'<a class="gr-login-btn" href="/#overview">Відкрити панель <span>↗</span></a>':'<button class="gr-login-btn" data-action="show-login" type="button">Особистий кабінет <span>↗</span></button>')+
    '<details class="gr-mobile-menu"><summary aria-label="Відкрити навігацію">☰</summary><nav aria-label="Мобільна навігація">'+navLinks+
    (state.user?'<a class="gr-mobile-account" href="/#overview">Відкрити панель ↗</a>':'<button type="button" class="gr-mobile-account" data-action="show-login">Особистий кабінет ↗</button>')+
    '</nav></details></div>'+
  '</div></header>'+
  '<main id="gr-main" tabindex="-1">'+
  (page==='home'?(
    ('<section class="gr-hero" id="home"><div class="gr-hero-grid" aria-hidden="true"></div><div class="gr-container gr-hero-inner">'+
    '<div class="gr-hero-content"><div class="gr-eyebrow"><span class="gr-red-dot"></span> УКРАЇНСЬКА GTA 5 RP СІМ’Я <span class="gr-eyebrow-rule"></span> LOS SANTOS</div>'+
      '<h1>БІЛЬШЕ НІЖ<br><em>СІМ’Я.</em><span> GRIZZLY.</span></h1>'+
      '<p class="gr-hero-description">'+esc(introText)+'</p>'+
      '<div class="gr-hero-buttons"><a class="gr-button gr-button-primary" href="#join">Стати частиною GRIZZLY <span aria-hidden="true">↗</span></a><a class="gr-button gr-button-outline" href="#about">Наша історія <span aria-hidden="true">→</span></a></div>'+
      '<div class="gr-hero-values"><span><b>01</b> Братерство</span><span><b>02</b> Дисципліна</span><span><b>03</b> Розвиток</span></div>'+
    '</div>'+
    '<div class="gr-hero-art'+(heroPhoto?' has-photo':'')+'" aria-label="Емблема GRIZZLY">'+
      (heroPhoto?'<img class="gr-art-photo" src="'+esc(heroPhoto)+'" alt="" aria-hidden="true" decoding="async" loading="eager" fetchpriority="high">':'')+
      '<div class="gr-art-grid"></div><span class="gr-art-corner gr-art-corner-top">GRZ / 001</span><div class="gr-art-round"><span class="gr-art-arc"></span>'+
      '<svg class="gr-paw" viewBox="0 0 240 240" role="img" aria-label="Символ ведмежої лапи">'+
       '<ellipse cx="48" cy="80" rx="18" ry="27" transform="rotate(-27 48 80)" fill="currentColor"/>'+
       '<ellipse cx="90" cy="50" rx="19" ry="28" transform="rotate(-8 90 50)" fill="currentColor"/>'+
       '<ellipse cx="140" cy="48" rx="19" ry="29" transform="rotate(8 140 48)" fill="currentColor"/>'+
       '<ellipse cx="184" cy="79" rx="18" ry="27" transform="rotate(25 184 79)" fill="currentColor"/>'+
       '<path d="M120 91c-24 0-35 19-48 34-17 18-35 29-31 51 4 19 22 31 41 27 14-3 23-11 38-11s24 8 39 11c19 4 37-8 40-27 4-22-14-33-31-51-14-15-25-34-48-34Z" fill="currentColor"/>'+
      '</svg></div><span class="gr-art-word">STAY LOYAL.</span><span class="gr-art-corner gr-art-corner-bottom">EST. IN LOS SANTOS</span></div>'+
    '</div><div class="gr-hero-footer"><div class="gr-container"><span>SCROLL TO EXPLORE <b>↓</b></span><span>GRIZZLY · STRENGTH IN UNITY</span></div></div></section>')+
    ('<section class="gr-section gr-home-intro" id="home-intro"><div class="gr-container"><span class="gr-kicker">01 — ПРО НАС</span><div class="gr-section-heading gr-heading-row"><h2>ОДНА СІМ’Я.<br><span>ОДИН ХАРАКТЕР.</span></h2><p>Сила в єдності. Повага — у вчинках.</p></div><p class="gr-home-story">'+esc(history.length>320?history.slice(0,320).trimEnd()+'…':history)+'</p><a class="gr-text-link" href="#about">Читати нашу історію <span>↗</span></a><div class="gr-home-features"><article><span>01 / CAPT</span><h3>КОМАНДНА ГРА</h3><p>Тренування, бої та командна тактика.</p></article><article><span>02 / FAMILY</span><h3>СВОЇ ЛЮДИ</h3><p>Довіра, повага та взаємодопомога.</p></article><article><span>03 / PROGRESS</span><h3>РОЗВИТОК</h3><p>Контракти, івенти й спільна активність.</p></article></div></div></section>')+
    ('<section class="gr-section gr-home-news" id="home-news"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">02 — ЖИТТЯ СІМ’Ї</span><h2>ОСТАННІ <span>НОВИНИ.</span></h2></div><a href="#news" class="gr-text-link">Усі новини <span>↗</span></a></div>'+renderPublicNewsPreview()+'</div></section>')+
    ('<section class="gr-home-cta" id="home-join"><div class="gr-container gr-home-cta-layout"><div><span class="gr-kicker">03 — ПРИЄДНАЙСЯ ДО НАС</span><h2>СТАНЬ ЧАСТИНОЮ<br><span>GRIZZLY FAMILY.</span></h2><p>Твоя команда чекає. Заповни коротку анкету для вступу.</p></div><a class="gr-button gr-button-primary" href="#join">Подати заявку <span>↗</span></a></div></section>')
  ):'')+
  (page==='about'?(
    ('<section class="gr-section gr-about" id="about"><div class="gr-container"><div class="gr-section-heading"><span class="gr-kicker">01 — НАША ІСТОРІЯ</span><h2>ПОВАГА НЕ ДАЄТЬСЯ.<br><span>ЇЇ ЗАСЛУГОВУЮТЬ.</span></h2></div>'+
   '<div class="gr-about-layout"><div class="gr-about-identity"><div class="gr-identity-symbol" aria-hidden="true">G<span>✦</span></div><p>ЄДНІСТЬ <em>·</em> ВІДДАНІСТЬ <em>·</em> СИЛА</p></div>'+
   '<div class="gr-about-story"><span class="gr-small-label">ХТО МИ</span><p class="gr-story-preview">'+esc(preview)+'</p>'+
   (history.length>480?'<details class="gr-story-expand"><summary>Читати повну історію <span>＋</span></summary><div class="gr-story-full">'+esc(history)+'</div></details>':'')+
   '<a class="gr-text-link" href="#directions">Дізнайся, чим живе сім’я <span>↗</span></a></div></div>'+
   '<div class="gr-history-timeline" aria-label="Етапи історії сім’ї">'+
   '<article><span>01 / ПОЧАТОК</span><h3>КОРІННЯ СІМ’Ї</h3><p>Історія Grizzly бере початок в Україні — з довіри між найближчими людьми.</p></article>'+
   '<article><span>02 / НОВИЙ ШЛЯХ</span><h3>ЛОС-САНТОС</h3><p>Переїзд до нового міста став випробуванням і початком спільної справи.</p></article>'+
   '<article><span>03 / РОЗВИТОК</span><h3>GRIZZLY СЬОГОДНІ</h3><p>Сім’я будує власну історію через бізнес, командні події та спільні рішення.</p></article>'+
   '</div></div></section>')+
    ('<section class="gr-section gr-team" id="team"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">02 — КЕРІВНИЦТВО</span><h2>ЛЮДИ, ЯКІ<br><span>ВЕДУТЬ GRIZZLY.</span></h2></div><p>Ігрові профілі представників сім’ї. Кожна посада — відповідальність перед командою.</p></div>'+renderPublicTeam()+'</div></section>')+
    ('<section class="gr-section gr-directions" id="directions"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">03 — НАШІ НАПРЯМКИ</span><h2>ОДНА СІМ’Я.<br><span>БАГАТО МОЖЛИВОСТЕЙ.</span></h2></div><p>У кожного своя сильна сторона. Разом ми досягаємо більшого.</p></div>'+
   '<div class="gr-direction-grid">'+
     '<article class="gr-direction-card"><span class="gr-direction-index">01 / CAPT</span><div class="gr-direction-icon" aria-hidden="true">✧</div><h3>CAPT СКЛАД</h3><p>Командні бої, тренування, тактика й злагоджена гра.</p><span class="gr-direction-footer">КОМАНДА / НАВИЧКИ</span></article>'+
     '<article class="gr-direction-card"><span class="gr-direction-index">02 / DEVELOPMENT</span><div class="gr-direction-icon" aria-hidden="true">▥</div><h3>ФАРМ І РОЗВИТОК</h3><p>Контракти, спільна активність та підтримка розвитку сім’ї.</p><span class="gr-direction-footer">АКТИВНІСТЬ / ПРОГРЕС</span></article>'+
     '<article class="gr-direction-card"><span class="gr-direction-index">03 / COMMUNITY</span><div class="gr-direction-icon" aria-hidden="true">◎</div><h3>СІМ’Я ТА ІВЕНТИ</h3><p>Збори, спільні виїзди, події та взаємодопомога.</p><span class="gr-direction-footer">ЄДНІСТЬ / ДОВІРА</span></article>'+
   '</div></div></section>')+
    ('<section class="gr-section gr-rules" id="rules"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">04 — НАШ КОДЕКС</span><h2>СИЛА — У ПОРЯДКУ.</h2></div><p>Прозорі правила для тих, хто грає в команді.</p></div>'+
    '<div class="gr-rules-grid"><article class="gr-rules-card"><div class="gr-rules-top"><span>01</span><strong>ПРАВИЛА СІМ’Ї</strong><span>↗</span></div><p class="gr-rule-copy">'+esc(rules)+'</p></article>'+
    '<article class="gr-rules-card"><div class="gr-rules-top"><span>02</span><strong>ВИМОГИ ДО УЧАСНИКІВ</strong><span>↗</span></div><p class="gr-rule-copy">'+esc(requirements)+'</p></article></div>'+
  '</div></section>')
  ):'')+
  (page==='news'?('<section class="gr-section gr-news" id="news"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">05 — ЖИТТЯ СІМ’Ї</span><h2>НОВИНИ<br><span>GRIZZLY.</span></h2></div><p>Офіційні повідомлення, події та досягнення нашої сім’ї.</p></div>'+renderPublicNews()+'</div></section>'):'')+
  (page==='achievements'?('<section class="gr-section gr-achievements" id="achievements"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">06 — НАША ГОРДІСТЬ</span><h2>ДОСЯГНЕННЯ<br><span>GRIZZLY.</span></h2></div><p>Перемоги, нагороди й визначні моменти, які формують нашу історію.</p></div><div id="gr-achievements-content">'+renderPublicAchievements()+'</div></div></section>'):'')+
  (page==='gallery'?('<section class="gr-section gr-gallery" id="gallery"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">07 — ЗАКАРБОВАНІ МОМЕНТИ</span><h2>НАША ІСТОРІЯ<br><span>У КАДРАХ.</span></h2></div><p>Моменти з життя сім’ї GRIZZLY — від командних боїв до спільних зустрічей.</p></div>'+
   '<div id="gr-gallery-content">'+renderPublicGallery()+'</div>'+
  '</div></section>'):'')+
  (page==='calendar'?('<section class="gr-section gr-public-calendar" id="calendar"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">ПЛАНУЙМО РАЗОМ</span><h2>КАЛЕНДАР<br><span>GRIZZLY.</span></h2></div><p>Збори, CAPT та спільні заходи. Тут публікується тільки підтверджений керівництвом розклад.</p></div><div id="gr-calendar-content">'+renderPublicCalendar()+'</div></div></section>'):'')+
  (page==='join'?('<section class="gr-section gr-join" id="join"><div class="gr-container gr-join-layout"><div class="gr-join-info"><span class="gr-kicker">08 — ПРИЄДНАЙСЯ ДО НАС</span><h2>ТВОЄ МІСЦЕ<br><span>СЕРЕД СВОЇХ.</span></h2><p>Готовий стати частиною GRIZZLY? Заповни анкету — рекрутер розгляне твою заявку.</p><div class="gr-join-steps"><div><span>01</span><p>Заповни анкету</p></div><div><span>02</span><p>Дочекайся розгляду</p></div><div><span>03</span><p>Приєднайся до команди</p></div></div></div>'+
    '<div class="gr-join-form"><div class="gr-form-header"><span>ЗАЯВКА НА ВСТУП</span><small>GRIZZLY / RECRUITMENT</small></div>'+
     '<form id="apply-form" class="formgrid">'+
       '<div class="field"><label for="gr-nick">Ігровий нікнейм *</label><input id="gr-nick" class="input" name="nickname" required maxlength="80" autocomplete="off" placeholder="Наприклад, Player Grizzly"></div>'+
       '<div class="field"><label for="gr-game-id">Ігровий ID *</label><input id="gr-game-id" class="input" name="game_id" required maxlength="40" placeholder="Ваш ID у грі"></div>'+
       '<div class="field"><label for="gr-discord">Discord</label><input id="gr-discord" class="input" name="discord" maxlength="120" autocomplete="off" placeholder="Ваш Discord"></div>'+
       '<div class="field"><label for="gr-experience">Досвід GTA RP</label><input id="gr-experience" class="input" name="experience" maxlength="700" placeholder="Де грали раніше"></div>'+
       '<div class="field full"><label for="gr-motivation">Чому хочеш вступити? *</label><textarea id="gr-motivation" class="textarea" name="motivation" required minlength="10" maxlength="1400" placeholder="Розкажи про себе, свій досвід та цілі"></textarea></div>'+
       '<button class="gr-button gr-button-primary gr-submit full" type="submit">Надіслати заявку <span>↗</span></button>'+
       '<p class="gr-form-note full">Заявка не створює акаунт автоматично. Дані доступу видає керівництво після рішення.</p>'+
     '</form></div></div></section>'):'')+
    '</main>'+
  '<footer class="gr-footer"><div class="gr-container"><div class="gr-footer-top"><a href="#home" class="gr-footer-brand">GRIZZLY<span>.</span></a><p>Сила в єдності.<br>Повага — у вчинках.</p><a href="#home" class="gr-back-top">НАГОРУ ↑</a></div><div class="gr-footer-bottom"><span>© '+new Date().getFullYear()+' GRIZZLY FAMILY · GTA 5 RP</span><span>MADE FOR THE FAMILY. BUILT ON LOYALTY.</span>'+(discord?'<a href="'+esc(discord)+'" target="_blank" rel="noopener noreferrer">DISCORD ↗</a>':'<a href="#join">ВСТУПИТИ ↗</a>')+'</div></div></footer>'+
  '</div>';
  if(typeof window!=='undefined'&&typeof window.requestAnimationFrame==='function'){
    window.requestAnimationFrame(()=>{
      const anchor=String(location.hash||'').replace(/^#/,'');
      if(['team','directions','rules'].includes(anchor))document.getElementById(anchor)?.scrollIntoView();
      else if(window.scrollY>0)window.scrollTo(0,0);
      if(publicRouteChanged)document.getElementById('gr-main')?.focus({preventScroll:true});
    });
  }
}
function loginModal(){modal('Вхід до панелі',`<p class="modal-desc">Логін і пароль видає керівник сім’ї. Реєстрація після заявки не відбувається автоматично.</p><form id="login-form" class="stack"><div class="field"><label>Логін</label><input class="input" name="username" autocomplete="username" required autofocus></div><div class="field"><label>Пароль</label><input class="input" type="password" name="password" autocomplete="current-password" required></div><button type="submit" class="btn">Увійти →</button></form>`);}
function modal(title,html){$('#modal-root').innerHTML=`<div class="modal-backdrop" data-backdrop="1"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h3>${esc(title)}</h3><button type="button" data-action="close-modal" class="iconbtn">✕</button></div><div class="modal-body">${html}</div></div></div>`;const first=$('#modal-root input:not([type=hidden])');if(first)setTimeout(()=>first.focus(),20);}
function closeModal(){$('#modal-root').innerHTML='';state.galleryLightboxId=null;}
function visible(n){if(n.id==='workspace'&&!['leader','deputy','head'].includes(state.user.role))return false;if(['audit','settings'].includes(n.id)&&state.user.role!=='leader')return false;if(n.id==='applications'&&!can('recruitment:manage'))return false;if(['public_news','public_team','public_achievements','public_calendar'].includes(n.id)&&!can('content:manage'))return false;if(n.id==='discipline'&&!can('discipline:manage'))return false;if(n.id==='contracts'&&!can('finance:read')&&!can('finance:manage'))return true;return true;}
function sidebar(){let current='';return `<aside class="sidebar"><div class="sidebrand"><div class="brand"><span class="brand-mark">🐻</span>GRIZZLY</div><span class="sub">FAMILY CONTROL</span></div><nav class="side-scroll"><a class="sideitem" href="/?view=public#home"><span class="ni">↗</span> Публічний сайт</a>${nav.filter(visible).map(n=>{let group='';if(n.group!==current){current=n.group;group=`<div class="nav-group">${esc(current)}</div>`;}return `${group}<a href="#${n.id}" class="sideitem ${state.route===n.id?'active':''}" data-route="${n.id}"><span class="ni">${n.icon}</span>${esc(n.text)}</a>`;}).join('')}</nav><div class="side-bottom"><div class="row"><div class="avatar">${esc((state.user.nickname||state.user.username).slice(0,1).toUpperCase())}</div><div style="min-width:0"><strong class="small">${esc(state.user.nickname||state.user.username)}</strong><div class="muted small">${esc(roles[state.user.role])}</div></div></div><button class="btn ghost tiny sidebar-logout" data-action="logout">Вийти ↗</button></div></aside>`;}
function shell(content){const unread=state.notifications.filter(x=>!x.read_at).length;$('#app').innerHTML=`<div class="shell ${state.menu?'menu-open':''}">${sidebar()}<div class="app-main"><header class="topbar"><div class="row"><button class="iconbtn mobile-menu" data-action="toggle-menu">☰</button><div><small>GRIZZLY / ${esc(roles[state.user.role])}</small><h2>${esc(nav.find(n=>n.id===state.route)?.text||'Огляд')}</h2></div></div><div class="row"><div class="notif-menu"><button class="iconbtn" data-action="notifications" aria-label="Сповіщення">♧${unread?'<span class="alert-dot"></span>':''}</button><div id="notif-pop" class="notif-pop hide"></div></div><button class="iconbtn" data-route="profile" title="Мій профіль">◌</button></div></header><div class="app-content">${content}</div></div></div>`;}
function notifyPopup(){const el=$('#notif-pop');if(!el)return;el.classList.toggle('hide');el.innerHTML=`<div class="card-head"><h3>Сповіщення</h3><span class="pill">${state.notifications.filter(x=>!x.read_at).length} нових</span></div>${state.notifications.length?state.notifications.slice(0,12).map(n=>`<div class="notif-item"><div class="row space"><strong class="small">${esc(n.title)}</strong>${n.read_at?'':`<button class="btn tiny ghost" data-action="read-notification" data-id="${esc(n.id)}">✓</button>`}</div><div class="muted small">${esc(n.details)}</div><div class="muted small">${date(n.created_at)}</div></div>`).join(''):empty('Немає сповіщень','Нові події з’являться тут.')}`;}
function table(headers,rows){return rows.length?`<div class="tablewrap"><table><thead><tr>${headers.map(s=>`<th>${esc(s)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:empty();}
function searchBar(){return `<input id="search-input" class="input" aria-label="Пошук" placeholder="⌕  Пошук за назвою, ніком, ID…" value="${esc(state.search)}">`;}
function filterControls(options=statuses){return `<div class="row wrap"><select class="select" style="width:auto" id="status-filter"><option value="">Усі статуси</option>${options.map(x=>`<option ${state.filter===x?'selected':''}>${x}</option>`).join('')}</select><select class="select" style="width:auto" id="sort-select"><option value="new" ${state.sort==='new'?'selected':''}>Спочатку нові</option><option value="old" ${state.sort==='old'?'selected':''}>Спочатку старі</option><option value="name" ${state.sort==='name'?'selected':''}>За назвою</option></select></div>`;}
function applyFilters(items){return items.filter(x=>!state.filter||x.status===state.filter).sort((a,b)=>state.sort==='name'?String(a.title||a.nickname||'').localeCompare(String(b.title||b.nickname||''),'uk'):state.sort==='old'?String(a.created_at||'').localeCompare(String(b.created_at||'')):String(b.created_at||'').localeCompare(String(a.created_at||'')));}
function exportButton(mod){return `<button class="btn tiny ghost" data-action="export" data-module="${esc(mod)}">↓ Експорт JSON</button>`;}

function searchMatch(...fields){return !state.search||fields.some(x=>String(x||'').toLowerCase().includes(state.search.toLowerCase()));}
function selectOptions(items,val,emptyName='Не призначено'){return `<option value="">${esc(emptyName)}</option>${items.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(val)?'selected':''}>${esc(x.title||x.nickname||x.username)}</option>`).join('')}`;}
function field(label,name,value='',type='text',full=false,other=''){return `<div class="field ${full?'full':''}"><label>${esc(label)}</label>${type==='textarea'?`<textarea class="textarea" name="${name}" ${other}>${esc(value)}</textarea>`:`<input class="input" type="${type}" name="${name}" value="${esc(value)}" ${other}>`}</div>`;}
function selectField(label,name,items,value='',full=false){return `<div class="field ${full?'full':''}"><label>${esc(label)}</label><select name="${name}" class="select">${selectOptions(items,value)}</select></div>`;}
function statusField(value){return `<div class="field"><label>Статус</label><select class="select" name="status">${statuses.map(s=>`<option ${s===value?'selected':''}>${s}</option>`).join('')}</select></div>`;}
function formatDateField(v){return (v||'').slice(0,16);}
async function overview(){
 const mayViewFinance=can('finance:read')||can('finance:manage');
 const trendPeriod=state.overviewTrendPeriod==='30'?'30':'7';
 const [finance,taskData,reportData,eventData,contractData,trendData,auditData,activityData]=await Promise.all([
  api('/finance'),api('/records/tasks'),api('/records/reports'),api('/records/events'),api('/contracts'),
  mayViewFinance?api('/finance/trends?period='+trendPeriod):Promise.resolve(null),
  state.user?.role==='leader'?api('/audit'):Promise.resolve(null),
  can('stats:read')?api('/stats'):Promise.resolve(null)
 ]);
 const user=state.user||{},leader=user.role==='leader',manager=leader||user.role==='deputy'||user.role==='head';
 const tasks=taskData.items||[],reports=reportData.items||[],events=eventData.items||[],contracts=contractData.items||[];
 const myTasks=tasks.filter(x=>x.assignee_id===user.id&&x.status!=='Завершено'&&x.status!=='Відхилено');
 const overdueTasks=myTasks.filter(x=>x.ends_at&&kyivWallDate(x.ends_at)<kyivNowLocal());
 const reviewReports=manager?reports.filter(x=>x.status==='На перевірці'):reports.filter(x=>x.owner_id===user.id&&x.status==='На перевірці');
 const upcoming=events.filter(x=>x.starts_at&&kyivWallDate(x.starts_at)>=kyivNowLocal()&&x.status!=='Відхилено').sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at)));
 const nextEvents=upcoming.slice(0,4);
 const pendingContracts=contracts.filter(x=>x.status==='Погоджено'&&!x.settled_at);
 const ownDepartment=state.departments.find(d=>d.id===user.department_id);
 const departmentFinance=user.role==='head'&&ownDepartment?await api('/departments/'+encodeURIComponent(ownDepartment.id)+'/finance-summary'):null;
 const summary=finance.contract_summary||{};
 const metric=(label,value,note='')=>'<div class="card stat"><div class="muted small">'+esc(label)+'</div><div class="number">'+value+'</div>'+(note?'<div class="muted small overview-stat-note">'+esc(note)+'</div>':'')+'</div>';
 const section=(title,route,label)=>'<div class="card-head"><h3>'+esc(title)+'</h3><button class="btn tiny secondary" data-route="'+route+'">'+esc(label)+' ↗</button></div>';
 const taskRows=[...myTasks].sort((a,b)=>String(a.ends_at||'9999').localeCompare(String(b.ends_at||'9999'))).slice(0,5).map(x=>'<tr><td class="table-title">'+esc(x.title)+'</td><td>'+esc(departmentName(x.department_id))+'</td><td>'+badge(x.status)+(x.ends_at?'<div class="muted small">'+esc(kyivDueStatus(x.ends_at,x.status))+'</div>':'')+'</td><td><button class="btn tiny secondary" data-action="view-record" data-module="tasks" data-id="'+esc(x.id)+'">Відкрити</button></td></tr>');
 const reviewRows=reviewReports.slice(0,5).map(x=>'<tr><td class="table-title">'+esc(x.title)+'</td><td>'+esc(userName(x.owner_id))+'</td><td>'+badge(x.status)+'</td><td><button class="btn tiny secondary" data-action="view-record" data-module="reports" data-id="'+esc(x.id)+'">Відкрити</button></td></tr>');
 const departmentCards=state.departments.map(d=>{
  const members=state.roster.filter(u=>u.department_id===d.id&&u.status==='active').length;
  const finished=tasks.filter(t=>t.department_id===d.id&&t.status==='Завершено').length;
  const pending=tasks.filter(t=>t.department_id===d.id&&!['Завершено','Відхилено'].includes(t.status)).length;
  return '<div class="card flat"><div class="row space"><strong>'+esc(d.title)+'</strong><span class="muted small">'+members+' уч.</span></div>'+
   '<div class="muted small mt">Керівник: '+esc(d.head_id?userName(d.head_id):'Не призначено')+'</div><div class="muted small mt">Завдання: '+fmt(finished)+' виконано · '+fmt(pending)+' в роботі</div></div>';
 }).join('');
 const recentContracts=[...contracts].sort((a,b)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||''))).slice(0,5);
 const contractRows=recentContracts.map(x=>'<tr><td class="table-title"><strong>'+esc(x.title)+'</strong><div class="muted small">'+esc(departmentName(x.department_id))+' · '+esc(userName(x.owner_id))+'</div></td><td class="mono">'+fmt(x.amount||0)+'</td><td>'+badge(x.settled_at?'Нараховано':x.status)+'</td><td><button class="btn tiny secondary" data-action="view-contract" data-id="'+esc(x.id)+'">Відкрити</button></td></tr>');
 const recentMembers=[...state.roster].filter(x=>x.status==='active').sort((a,b)=>String(b.joined_at||'').localeCompare(String(a.joined_at||''))).slice(0,5);
 const memberRows=recentMembers.map(x=>'<tr><td class="table-title">'+esc(x.nickname||'Учасник')+'</td><td>'+esc(departmentName(x.department_id))+'</td><td>'+esc(x.joined_at?date(x.joined_at):'—')+'</td><td><button class="btn tiny secondary" data-action="view-member" data-id="'+esc(x.id)+'">Профіль</button></td></tr>');
 const activeMembers=state.roster.filter(x=>x.status==='active');
 const unassignedMembers=activeMembers.filter(x=>!x.department_id||!state.departments.some(d=>d.id===x.department_id)).length;
 const completedContracts=contracts.filter(x=>!!x.settled_at).length;
 const overviewDetails='<div class="cards">'+
  metric('Усього контрактів',fmt(contracts.length),'З реєстру сім’ї')+
  metric('Нараховані контракти',fmt(completedContracts),'Проведені через фінанси')+
  metric('Підрозділів',fmt(state.departments.length),'У системі сім’ї')+
  metric('Без підрозділу',fmt(unassignedMembers),'Активні учасники')+
 '</div>'+
 '<div class="grid2"><div class="card">'+section('Останні контракти','contracts','Усі контракти')+
 (contractRows.length?table(['Контракт','Сума','Статус','Дія'],contractRows):empty('Контрактів поки немає'))+
 '</div><div class="card">'+section('Нещодавно додані учасники','members','Склад сім’ї')+
 (memberRows.length?table(['Учасник','Підрозділ','Дата вступу','Дія'],memberRows):empty('Учасників поки немає'))+
 '</div></div>';
 const settledByDepartment=new Map();
 for(const contract of contracts){
  if(!contract.settled_at||!contract.department_id)continue;
  const previous=settledByDepartment.get(contract.department_id)||{count:0,amount:0};
  previous.count++;previous.amount+=Number(contract.amount)||0;
  settledByDepartment.set(contract.department_id,previous);
 }
 const departmentSummary=state.departments.map(d=>{
  const activeCount=activeMembers.filter(u=>u.department_id===d.id).length;
  const done=settledByDepartment.get(d.id)||{count:0,amount:0};
  return '<div class="overview-dept"><div class="row space"><strong>'+esc(d.title)+'</strong><span class="muted small">'+fmt(activeCount)+' уч.</span></div>'+
   '<div class="muted small">Нараховано контрактів: '+fmt(done.count)+' · Сума: '+fmt(done.amount)+'</div></div>';
 }).join('');
 const weekly=trendData?.weeks||[];
 const trendEntries=weekly.filter(w=>Number(w.income)||Number(w.expenses));
 const totalIncome=weekly.reduce((n,w)=>n+(Number(w.income)||0),0);
 const totalExpense=weekly.reduce((n,w)=>n+(Number(w.expenses)||0),0);
 const top=Math.max(1,...weekly.flatMap(w=>[Number(w.income)||0,Number(w.expenses)||0]));
 const trendBars=weekly.map(w=>'<div class="overview-trend-row"><span class="muted small">'+esc(w.week_start||'')+'</span>'+
  '<div class="overview-trend-bars"><span class="overview-trend-income" style="width:'+Math.max(0,Math.min(100,(Number(w.income)||0)*100/top))+'%"></span>'+
  '<span class="overview-trend-expense" style="width:'+Math.max(0,Math.min(100,(Number(w.expenses)||0)*100/top))+'%"></span></div>'+
  '<span class="mono small">'+fmt(w.income)+' / '+fmt(w.expenses)+'</span></div>').join('');
 const financeOverview=mayViewFinance?'<div class="card overview-finance">'+
  '<div class="card-head"><div><h3>Динаміка скарбниці</h3><p class="muted small">Надходження та витрати, згруповані за тижнями (UTC)</p></div><button class="btn tiny secondary" data-route="finance">Детальна аналітика ↗</button></div>'+
  '<div class="row wrap overview-periods"><button class="btn tiny secondary" data-action="overview-trend-period" data-value="7" aria-pressed="'+(trendPeriod==='7')+'">7 днів</button>'+
  '<button class="btn tiny secondary" data-action="overview-trend-period" data-value="30" aria-pressed="'+(trendPeriod==='30')+'">30 днів</button></div>'+
  '<div class="overview-finance-totals"><div><span class="muted small">Надходження</span><strong>'+fmt(totalIncome)+'</strong></div>'+
  '<div><span class="muted small">Витрати</span><strong>'+fmt(totalExpense)+'</strong></div>'+
  '<div><span class="muted small">Зміна</span><strong>'+fmt(totalIncome-totalExpense)+'</strong></div></div>'+
  (trendEntries.length?trendBars:'<p class="muted small">За цей період фінансових операцій немає.</p>')+
  '</div>':'';
 const auditItems=(auditData?.items||[]).slice(0,6);
 const auditOverview=leader?'<div class="card overview-audit"><div class="card-head"><h3>Останні дії керівництва</h3>'+
  '<button class="btn tiny secondary" data-route="audit">Журнал змін ↗</button></div>'+
  (auditItems.length?auditItems.map(x=>'<div class="overview-audit-row"><div><strong>'+esc(x.actor_name||'Користувач')+'</strong> · '+
  esc(x.action||'Дія')+'<div class="muted small">'+esc(x.entity||'')+' · '+esc(String(x.detail||'').slice(0,110))+'</div></div>'+
  '<span class="muted small">'+esc(String(x.created_at||'').replace('T',' ').slice(0,16))+'</span></div>').join(''):
  '<p class="muted small">У журналі ще немає подій.</p>')+'</div>':'';
 const activityLeaders=(activityData?.leaderboard_week||[]).slice(0,5);
 const activityOverview=activityData?'<div class="card overview-activity"><div class="card-head"><h3>Активність учасників · 7 днів</h3><button class="btn tiny secondary" data-route="stats">Уся статистика ↗</button></div>'+
 (activityLeaders.length?'<div class="overview-activity-list">'+activityLeaders.map((r,i)=>'<div class="row space"><span><strong>'+esc(String(i+1)+'. '+userName(r.user_id))+'</strong><span class="muted small"> · '+fmt(r.completed)+' дій</span></span><strong class="mono">'+fmt(r.points)+' балів</strong></div>').join('')+'</div>':empty('Немає завершених активностей','Рейтинг формується на підставі погоджених і завершених записів.'))+'</div>':'';
 const notices=(state.notifications||[]).filter(x=>!x.read_at).slice(0,4);
 const notifySection=notices.length?'<div class="card mt"><div class="card-head"><h3>Нові сповіщення</h3></div><div class="stack">'+notices.map(n=>'<div class="row space"><div><strong>'+esc(n.title)+'</strong><div class="muted small">'+esc((n.details||'').slice(0,150))+'</div></div><span class="muted small">'+date(n.created_at)+'</span></div>').join('')+'</div></div>':'';
 return intro('Огляд GRIZZLY','Головна панель сім’ї · актуальні показники та швидкий доступ до роботи',
  '<button class="btn secondary" data-action="refresh">↻ Оновити</button>')+
 '<div class="stack gr-overview-v4 gr-overview-design-v5"><div class="dashboard-welcome"><div><div class="overline">GRIZZLY / FAMILY OPERATIONS</div><h2>Вітаємо, '+esc(user.nickname||user.username||'учаснику')+'! 🐻</h2><p>'+(ownDepartment?'Твій підрозділ: '+esc(ownDepartment.title)+' · ':'')+'Слідкуй за завданнями, подіями та роботою сім’ї.</p></div><span class="bear">🐻</span></div>'+
 (manager?'<div class="card gr-workspace-entry"><div><div class="overline">GRIZZLY / УПРАВЛІННЯ</div><h3>'+(user.role==='head'?'Мій робочий простір керівника':'Робочі простори керівників')+'</h3><p class="small muted">Особовий склад, завдання, звіти, контракти й інші розділи за підрозділами.</p></div><button class="btn" data-route="workspace">Відкрити підрозділ ↗</button></div>':'')+
 '<div class="cards">'+
 metric('Учасників сім’ї',fmt(state.roster.filter(u=>u.status==='active').length),'Активні акаунти')+
 metric('Мої активні завдання',fmt(myTasks.length),overdueTasks.length?'Прострочено: '+overdueTasks.length:'Потребують виконання')+
 metric(manager?'Звіти на перевірці':'Мої звіти на перевірці',fmt(reviewReports.length))+
 metric('Майбутні заходи',fmt(upcoming.length),'У доступному розкладі')+
 '</div>'+
 '<div class="cards">'+
 metric('Баланс скарбниці',fmt(finance.treasury_balance||0),'Спільна статистика')+
 metric('Сума контрактів',fmt(summary.contracts_total||0),'Оборот, не баланс скарбниці')+
 metric('Контракти до нарахування',fmt(pendingContracts.length),'Погоджені й не проведені')+
 metric('Мої нарахування',fmt(finance.own_total||0),'Контракти, CAPT і премії')+
 '</div>'+
 (departmentFinance?'<div class="card"><div class="card-head"><h3>Мій підрозділ · '+esc(ownDepartment.title)+'</h3><button class="btn tiny secondary" data-route="workspace">Керувати ↗</button></div><div class="grid3 mt">'+
 metric('Контракти напряму',fmt(departmentFinance.contracts.total))+
 metric('Нараховано учасникам',fmt(departmentFinance.payouts.accrued))+
 metric('CAPT-виплати',fmt(departmentFinance.capt.paid_total))+
 '</div><p class="muted small mt">Показники лише твого підрозділу. Проведення виплат залишається за уповноваженим керівництвом.</p></div>':'')+
 '<div class="grid2"><div class="card">'+section('Мої завдання','tasks','Усі завдання')+
 (myTasks.length?table(['Назва','Напрямок','Статус','Дія'],taskRows):empty('Активних завдань немає','Нові призначення з’являться тут автоматично.'))+
 '</div><div class="card">'+section(manager?'Звіти на перевірці':'Мої звіти','reports','Усі звіти')+
 (reviewReports.length?table(['Звіт','Автор','Статус','Дія'],reviewRows):empty('Звітів на перевірці немає'))+
 '</div></div>'+
 '<div class="grid2"><div class="card">'+section('Найближчі заходи','events','Календар')+
 (nextEvents.length?nextEvents.map(x=>'<div class="row space mb"><div><strong>'+esc(x.title)+'</strong><div class="muted small">'+esc(String(x.starts_at).replace('T',' '))+' · '+esc(departmentName(x.department_id))+'</div></div>'+badge(x.status)+'</div>').join(''):empty('Заходів поки немає'))+
 '</div><div class="card"><div class="card-head"><h3>Швидкі дії</h3></div><div class="stack">'+
 '<button class="btn secondary" data-action="new-record" data-module="reports">＋ Подати звіт</button>'+
 '<button class="btn secondary" data-route="contracts">▤ Контракти сім’ї</button>'+
 '<button class="btn secondary" data-route="departments">▦ Підрозділи та керівники</button>'+
 '<button class="btn secondary" data-route="finance">₴ Фінанси та виплати</button>'+
 (can('members:write')?'<button class="btn secondary" data-action="new-user">♟ Додати учасника</button>':'')+
 '</div></div></div>'+
 overviewDetails+
 financeOverview+
 activityOverview+
 auditOverview+
 (leader?'<div class="card"><div class="card-head"><h3>Контракти за підрозділами</h3></div><div class="grid3 mt">'+departmentSummary+'</div></div>':'')+
 (leader?'<div class="card"><div class="card-head"><h3>Стан підрозділів</h3><button class="btn tiny secondary" data-route="departments">Керувати ↗</button></div><div class="grid3 mt">'+departmentCards+'</div></div>':'')+
 notifySection+'</div>';
}
function memberStatusLabel(status){return status==='active'?'Активний':status==='blocked'?'Заблокований':status||'—';}
async function members(){
 const all=state.roster;
 const role=state.membersRole||'all',status=state.membersStatus||'all',department=state.membersDepartment||'all',sort=state.membersSort||'rank';
 const list=all.filter(u=>(role==='all'||u.role===role)&&(status==='all'||u.status===status)&&(department==='all'||String(u.department_id||'')===department)&&searchMatch(u.nickname,u.game_id,departmentName(u.department_id)));
 const nameOf=u=>String(u.nickname||'Учасник');
 const byName=(a,b)=>nameOf(a).localeCompare(nameOf(b),'uk');
 list.sort((a,b)=>sort==='name'?byName(a,b):sort==='joined'?String(b.joined_at||'').localeCompare(String(a.joined_at||''))||byName(a,b):Number(b.rank_id||0)-Number(a.rank_id||0)||byName(a,b));
 const summary=[['Усього учасників',all.length],['Активні',all.filter(u=>u.status==='active').length],['Заблоковані',all.filter(u=>u.status==='blocked').length],['Напрямки',new Set(all.map(u=>u.department_id).filter(Boolean)).size]];
 const select=(id,label,options,current)=>'<div class="field" style="min-width:145px;flex:1"><label for="'+id+'">'+label+'</label><select id="'+id+'" class="select" style="width:100%">'+options.map(([v,t])=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select></div>';
 const roleOptions=[['all','Усі ролі'],...Object.entries(roles)];
 const statusOptions=[['all','Усі статуси'],['active','Активні'],['blocked','Заблоковані']];
 const departmentOptions=[['all','Усі напрямки'],...state.departments.map(x=>[String(x.id),x.title])];
 const sortOptions=[['rank','За рангом ↓'],['name','За ніком А–Я'],['joined','За датою вступу ↓']];
 const isFiltered=role!=='all'||status!=='all'||department!=='all'||sort!=='rank'||Boolean(state.search);
 const editButton=u=>state.users.some(account=>account.id===u.id)?'<button class="btn tiny secondary" data-action="edit-user" data-id="'+esc(u.id)+'">Особова справа</button>':'<button class="btn tiny secondary" data-action="view-member" data-id="'+esc(u.id)+'">Переглянути</button>';
 const statusBadge=u=>'<span class="badge '+(u.status==='active'?'green':u.status==='blocked'?'red':'blue')+'">'+esc(memberStatusLabel(u.status))+'</span>';
 const tableRows=list.map(u=>'<tr><td><strong>'+esc(nameOf(u))+'</strong><div class="muted">Ігровий профіль</div></td><td>'+esc(roles[u.role]||u.role)+'<div class="muted">'+esc(rankName(u.rank_id))+'</div></td><td>'+esc(departmentName(u.department_id))+'</td><td>'+esc(u.game_id||'—')+'</td><td>'+statusBadge(u)+'<div class="muted">'+esc(u.joined_at?('Вступ: '+date(u.joined_at)):'У сім’ї')+'</div></td><td>'+editButton(u)+'</td></tr>');
 const mobileCards=list.map(u=>'<article class="card member-mobile-card"><div class="row space" style="align-items:start"><div><strong>'+esc(nameOf(u))+'</strong><div class="muted small">Учасник GRIZZLY</div></div>'+statusBadge(u)+'</div><div class="small mt">'+esc(roles[u.role]||u.role)+' · '+esc(rankName(u.rank_id))+'</div><div class="small muted mt">Напрямок: '+esc(departmentName(u.department_id))+'</div><div class="small muted">Ігровий ID: '+esc(u.game_id||'—')+'</div><div class="small muted">Активність: '+esc(u.joined_at?('Вступ: '+date(u.joined_at)):'У сім’ї')+'</div><div class="mt">'+editButton(u)+'</div></article>').join('');
 return intro('Склад сім’ї','Особовий склад, ігрові ранги, напрямки та доступи.',can('members:write')?'<button class="btn" data-action="new-user">＋ Додати учасника</button>':'')+
 '<div class="cards">'+summary.map(([title,value])=>'<div class="card stat"><div class="muted small">'+esc(title)+'</div><div class="number">'+value+'</div></div>').join('')+'</div>'+
 '<div class="toolbar mt">'+searchBar()+'<span class="muted small">Знайдено: '+list.length+'</span>'+(can('members:read')?exportButton('users'):'')+'</div>'+
 '<div class="card mb"><div class="row wrap member-filters" style="gap:10px;align-items:end">'+select('members-role-filter','Роль',roleOptions,role)+select('members-status-filter','Статус',statusOptions,status)+select('members-department-filter','Напрямок',departmentOptions,department)+select('members-sort-filter','Сортування',sortOptions,sort)+'<button class="btn tiny secondary" data-action="members-reset" '+(!isFiltered?'disabled':'')+'>Скинути фільтри</button></div></div>'+
 (list.length?'<div class="member-desktop-table">'+table(['Учасник','Роль / ранг','Напрямок','Ігровий ID','Активність','Дії'],tableRows)+'</div><div class="member-mobile-list">'+mobileCards+'</div>':empty('Учасників не знайдено','Спробуйте інші параметри пошуку або скиньте фільтри.'));
}
function viewMember(id){
  const u=state.roster.find(item=>item.id===id);
  if(!u)return toast('Учасника не знайдено',true);
  modal('Учасник GRIZZLY','<div class="stack">'+
    '<h3>'+esc(u.nickname||'Учасник')+'</h3>'+
    '<p>Роль: '+esc(roles[u.role]||'Учасник')+'</p>'+
    '<p>Ігровий ранг: '+esc(rankName(u.rank_id))+'</p>'+
    '<p>Напрямок: '+esc(departmentName(u.department_id))+'</p>'+
    '<p>Ігровий ID: '+esc(u.game_id||'—')+'</p>'+
    '<p>Статус: '+esc(memberStatusLabel(u.status))+'</p>'+
    (u.joined_at?'<p>Дата вступу: '+esc(date(u.joined_at))+'</p>':'')+
    '</div>');
}
function credentialReceipt(username,password,nickname,reset=false){
  modal(reset?'Новий пароль учасника':'Акаунт створено',`<div class="notice mb"><strong>Дані доступу показано один раз.</strong> Скопіюйте й передайте учаснику особисто, не в загальному чаті. Після закриття вікна пароль не можна переглянути повторно — лише скинути.</div>
  <div class="stack">
    <p class="muted small">Учасник: ${esc(nickname||username)}</p>
    <div class="field"><label>Логін</label><input id="credential-receipt-login" class="input" value="${esc(username)}" readonly autocomplete="off"></div>
    <div class="field"><label>Тимчасовий пароль</label><input id="credential-receipt-password" class="input" type="password" value="${esc(password)}" readonly autocomplete="off"></div>
    <div class="row wrap">
      <button type="button" class="btn secondary tiny" data-action="toggle-temp-password">Показати / приховати</button>
      <button type="button" class="btn secondary tiny" data-action="copy-access-invite">Копіювати дані для учасника</button>
    </div>
    <p class="muted small">Сайт: ${esc(location.origin)} · Після входу учаснику слід змінити тимчасовий пароль у «Мій профіль».</p>
    <div class="form-actions"><button type="button" class="btn" data-action="close-modal">Готово — закрити</button></div>
  </div>`);
}
function userForm(id){const u=state.users.find(x=>x.id===id),edit=!!u,manager=can('members:write'),leader=state.user.role==='leader';const roleOptions=Object.entries(roles).filter(([k])=>leader||k==='member').map(([k,v])=>`<option value="${k}" ${(u?.role||'member')===k?'selected':''}>${v}</option>`).join('');const fields=`<form id="user-form" data-id="${esc(id||'')}" class="formgrid">${field('Ігровий нікнейм','nickname',u?.nickname||'','text',false,'required maxlength="80"')}${field('Ігровий ID','game_id',u?.game_id||'')}${field('Discord','discord',u?.discord||'')}${field('Активність','activity',u?.activity||'')}${!edit?`${field('Логін *','username','','text',false,'required minlength="3" autocomplete="off"')}${field('Тимчасовий пароль (12+ символів) *','password','','password',false,'required minlength="12" autocomplete="new-password"')}<div class="full credential-tools"><button type="button" class="btn tiny secondary" data-action="generate-login">Згенерувати логін</button><button type="button" class="btn tiny secondary" data-action="generate-temp-password">Згенерувати пароль</button><button type="button" class="btn tiny ghost" data-action="toggle-temp-password">Показати / приховати</button><span class="muted small">20 випадкових символів, пароль буде показано лише під час видачі доступу.</span></div>`:''}${(manager||!edit)?`<div class="field"><label>Роль доступу</label><select name="role" class="select">${roleOptions}</select></div>${selectField('Ігровий ранг','rank_id',state.ranks,u?.rank_id)}${selectField('Напрямок','department_id',state.departments,u?.department_id)}${field('Дата вступу','joined_at',u?.joined_at||new Date().toISOString().slice(0,10),'date')}<div class="field"><label>Статус акаунта</label><select name="status" class="select"><option value="active" ${u?.status==='active'?'selected':''}>Активний</option><option value="blocked" ${u?.status==='blocked'?'selected':''}>Заблокований</option></select></div>`:''}${leader&&edit?field('Індивідуальні права через кому (порожньо = без прав при збереженні)','permissions',Array.isArray(u.custom_permissions)?u.permissions.join(', '):u.custom_permissions?.items?.join(', ')||'', 'textarea',true):''}<div class="full form-actions"><button type="button" class="btn ghost" data-action="close-modal">Закрити</button><button class="btn" type="submit">${edit?'Зберегти зміни':'Створити акаунт'}</button></div></form>`;modal(edit?'Особова справа / '+(u.nickname||u.username):'Новий учасник',`<p class="modal-desc">${edit?'Редагування запису з перевіркою версії.':'Логін та пароль потрібно особисто передати учаснику.'}</p>${fields}${edit&&leader?`<div class="hr"></div><button class="btn tiny danger" data-action="reset-password" data-id="${esc(id)}">Скинути пароль і всі сесії</button>`:''}`);}
function rankRequirementsMissing(rank){return !String(rank.requirements||'').trim()||String(rank.requirements||'').trim()==='Умови встановлює керівник';}
function promotionProgress(record){
 const target=Number(record?.extra?.requested_rank_id||0);
 const current=state.ranks.find(r=>Number(r.id)===target-1);
 const needed=current?rankChecklist(current):[];
 const completed=Array.isArray(record?.extra?.checklist_completed)?record.extra.checklist_completed:[];
 return {needed,done:needed.filter(item=>completed.includes(item)).length,total:needed.length};
}
function promotionChecklistView(targetId,completed=[]){
 const source=state.ranks.find(rank=>Number(rank.id)===Number(targetId)-1);
 const checklist=source?rankChecklist(source):[];
 if(!source)return '<div class="notice">Для цього рангу автоматичний чекліст не передбачено. Рішення приймає лідер сім’ї.</div>';
 if(!checklist.length)return '<div class="notice">Керівник ще не додав вимоги до попереднього рангу. Уточніть їх перед поданням заявки.</div>';
 return '<div class="full card flat"><strong>Вимоги для переходу з «'+esc(source.title)+'»</strong><p class="muted small">Позначайте лише те, що виконали. Підтвердження здійснює керівництво.</p>'+
  '<div class="stack mt">'+checklist.map((item,index)=>'<label class="row" style="gap:8px;align-items:flex-start"><input type="checkbox" class="promotion-requirement" data-requirement="'+esc(item)+'" '+(completed.includes(item)?'checked':'')+'><span class="small">'+esc(item)+'</span></label>').join('')+'</div><div class="small muted mt" id="promotion-progress">Виконано: '+checklist.filter(x=>completed.includes(x)).length+' із '+checklist.length+'</div></div>';
}
function syncPromotionChecklist(){
 const form=document.querySelector('#record-form[data-module="promotions"]');
 if(!form)return;
 const checked=[...form.querySelectorAll('.promotion-requirement:checked')].map(input=>input.dataset.requirement);
 const hidden=form.querySelector('[name="extra_checklist_completed"]');
 if(hidden)hidden.value=checked.join('\n');
 const info=form.querySelector('#promotion-progress');
 if(info)info.textContent='Виконано: '+checked.length+' із '+form.querySelectorAll('.promotion-requirement').length;
}
function rankChecklist(rank){
 try{const result=JSON.parse(rank.checklist||'[]');return Array.isArray(result)?result.filter(x=>typeof x==='string'&&x.trim()):[];}catch{return [];}
}
async function ranks(){
 const response=await api('/records/promotions');
 const requests=response.items||[];
 const query=String(state.search||'').trim().toLocaleLowerCase('uk');
 const entries=state.ranks.filter(r=>[r.title,r.requirements,...rankChecklist(r),String(r.id)].some(x=>String(x||'').toLocaleLowerCase('uk').includes(query))).sort((a,b)=>a.id-b.id);
 const placeholders=state.ranks.filter(r=>Number(r.is_example)===1&&r.title==='Ранг '+String(r.id).padStart(2,'0')+' — приклад');
 const missing=state.ranks.filter(rank=>rankRequirementsMissing(rank)&&state.rankTemplates?.some(t=>t.id===rank.id));
 const counts={total:state.ranks.length,pending:requests.filter(r=>r.status==='На перевірці'||r.status==='На доопрацювання').length,approved:requests.filter(r=>r.status==='Погоджено').length,members:state.roster.length};
 const cards=entries.map(rank=>{
  const checklist=rankChecklist(rank),holders=state.roster.filter(u=>Number(u.rank_id)===Number(rank.id)),next=state.ranks.find(x=>Number(x.id)===Number(rank.id)+1);
  return '<article class="card" style="display:flex;flex-direction:column;gap:10px">'+
    '<div class="row space"><span class="overline">РАНГ '+String(rank.id).padStart(2,'0')+' / 15</span>'+(Number(rank.is_example)===1?'<span class="pill">Приклад</span>':'')+'</div>'+
    '<h3>'+esc(rank.title)+'</h3>'+
    '<div class="muted small">Учасників із рангом: <strong>'+holders.length+'</strong></div>'+
    (rank.requirements?'<div class="small longtext">'+esc(rank.requirements)+'</div>':'<p class="muted small">Умови підвищення не заповнено</p>')+
    (checklist.length?'<details class="small"><summary style="cursor:pointer;font-weight:600">Вимоги / чекліст ('+checklist.length+')</summary><ul style="padding-left:18px;margin:8px 0">'+checklist.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul></details>':'')+
    (next?'<div class="muted small">Наступний: '+esc(next.title)+'</div>':'<div class="muted small">Найвищий ранг сім’ї</div>')+
    (state.user.role==='leader'?'<div class="mt" style="margin-top:auto"><button class="btn tiny secondary" data-action="edit-rank" data-id="'+rank.id+'">Редагувати ранг</button></div>':'')+
    '</article>';
 }).join('');
 const recent=requests.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).slice(0,8);
 const recentRows=recent.map(x=>{
   const destination=state.ranks.find(r=>r.id===Number(x.extra?.requested_rank_id));
   const progress=promotionProgress(x);
   return '<tr><td>'+esc(userName(x.owner_id))+'</td><td>'+esc(destination?.title||'Ранг не вказано')+'</td><td>'+badge(x.status)+'</td><td>'+(progress.total?'<span class="small">Заявлено: '+progress.done+'/'+progress.total+'</span>':'<span class="muted small">Без чекліста</span>')+'</td><td>'+date(x.created_at)+'</td><td><button class="btn tiny secondary" data-action="view-record" data-module="promotions" data-id="'+esc(x.id)+'">Відкрити</button></td></tr>';
 });
 return intro('Ранги та підвищення','15 ігрових рангів GRIZZLY, вимоги, учасники та заявки. Ранг не змінює права доступу до панелі.',(state.user.role==='leader'?(placeholders.length?'<button class="btn" data-action="preview-rank-templates">🐻 Заповнити ранги GRIZZLY</button>':'')+(missing.length?'<button class="btn secondary" data-action="rank-fill-requirements">＋ Заповнити вимоги ('+missing.length+')</button>':''):'') )+
  '<div class="cards">'+[['Рангів',counts.total],['Учасників',counts.members],['Заявок на розгляді',counts.pending],['Погоджених заявок',counts.approved]].map(([name,value])=>'<div class="card stat"><div class="muted small">'+name+'</div><div class="number">'+value+'</div></div>').join('')+'</div>'+
  '<div class="toolbar mt">'+searchBar()+'<span class="muted small">Показано '+entries.length+' з '+state.ranks.length+' рангів</span>'+
  '<button class="btn tiny secondary" data-action="new-record" data-module="promotions">＋ Подати заявку</button></div>'+
  (entries.length?'<div class="grid3">'+cards+'</div>':empty('Рангів не знайдено','Змініть пошуковий запит.'))+
  '<div class="row space mt"><div><h2>Заявки на підвищення</h2><p class="muted small">Останні доступні вам заявки. Погоджені рішення оновлюють ігровий ранг.</p></div><button class="btn tiny secondary" data-action="rank-promotions-list">Усі заявки ↗</button></div>'+
  (recent.length?table(['Учасник','Цільовий ранг','Статус','Прогрес','Дата','Дія'],recentRows):empty('Заявок поки немає','Створіть першу заявку на підвищення.'));
}
function rankForm(id){const r=state.ranks.find(x=>x.id===Number(id));modal(`Редагування рангу ${id}`,`<form id="rank-form" data-id="${id}" class="formgrid">${field('Назва рангу','title',r.title,'text',true,'required')}${field('Умови підвищення','requirements',r.requirements,'textarea',true)}${field('Чекліст (кожна вимога з нового рядка)','checklist',JSON.parse(r.checklist||'[]').join('\n'),'textarea',true)}<div class="full form-actions"><button class="btn" type="submit">Зберегти ранг</button></div></form>`);}
async function departmentWorkspace(){
 const user=state.user;
 if(!['leader','deputy','head'].includes(user.role))return intro('Доступ до підрозділу','Тільки призначені керівники та вище керівництво.');
 const available=state.departments;
 const selected=user.role==='head'?user.department_id:(available.some(d=>d.id===state.workspaceDepartment)?state.workspaceDepartment:available[0]?.id);
 if(!selected)return intro('Управління підрозділом','Спочатку створіть підрозділ та призначте відповідального.');
 let data;
 try{data=await api('/department-workspace?department='+encodeURIComponent(selected));}
 catch(error){
  if(error.status===403&&user.role==='head')return intro('Управління підрозділом','Лідер має призначити вас керівником підрозділу у розділі «Напрямки».')+
    '<div class="notice mt">Ваша роль і призначення керівника мають відповідати одному підрозділу.</div>';
  throw error;
 }
 const dept=data.department,sections=data.sections||[],members=data.members||[],contracts=data.contracts||[];
 const financeSummary=await api('/departments/'+encodeURIComponent(dept.id)+'/finance-summary');
 const id=state.workspaceSection||'tasks';
 const allSections=[{id:'personnel',title:'Особовий склад',group:'Керування',count:members.length},
  {id:'contracts',title:'Контракти',group:'Керування',count:contracts.length},
  {id:'finance',title:'Фінанси підрозділу',group:'Керування',count:financeSummary.contracts.count},...sections];
 const active=allSections.find(x=>x.id===id)||allSections[0];
 const selector=user.role==='head'
  ?'<span class="badge blue">Мій підрозділ</span>'
  :'<label class="gr-workspace-select-label">Підрозділ <select class="select" id="workspace-department-select" aria-label="Оберіть підрозділ">'+
   available.map(d=>'<option value="'+esc(d.id)+'"'+(d.id===dept.id?' selected':'')+'>'+esc(d.title)+'</option>').join('')+'</select></label>';
 const stats=[['Активні учасники',data.summary.members],['Активні завдання',data.summary.tasks_open],
  ['Звіти на перевірці',data.summary.reports_review],['Контракти',data.summary.contracts_count],
  ['Контрактів нараховано',data.summary.contracts_settled]];
 const buttons=allSections.map(x=>'<button type="button" class="gr-workspace-tab'+(x.id===active.id?' active':'')+'" data-action="workspace-section" data-value="'+esc(x.id)+'" aria-pressed="'+(x.id===active.id)+'"><span>'+esc(x.title)+'</span><span class="gr-workspace-count">'+fmt(x.count||0)+'</span></button>').join('');
 const membersRows=members.map(m=>'<tr><td class="table-title">'+esc(m.nickname)+'</td><td>'+esc(rankName(m.rank_id))+'</td><td>'+esc(roles[m.role]||m.role)+'</td><td>'+badge(m.status)+'</td></tr>');
 const contractRows=contracts.map(c=>'<tr><td class="table-title">'+esc(c.title)+'</td><td class="mono">'+fmt(c.amount)+'</td><td>'+badge(c.settled_at?'Нараховано':c.status)+'</td><td><button class="btn tiny secondary" data-action="view-contract" data-id="'+esc(c.id)+'">Переглянути ↗</button></td></tr>');
 let content='';
 if(active.id==='personnel')content=members.length?table(['Учасник','Ранг','Роль','Статус'],membersRows):empty('Учасників ще немає','Лідер може призначити учасників до цього напрямку.');
 else if(active.id==='contracts')content=(contracts.length?table(['Контракт','Сума','Статус','Дія'],contractRows):empty('Контрактів немає'))+
   '<p class="muted small mt">Фінансові нарахування й видача коштів виконуються тільки уповноваженим керівництвом.</p>';
 else if(active.id==='finance'){
  const figures=[
    ['Всі контракти · сума',financeSummary.contracts.total],
    ['Проведено',financeSummary.contracts.settled_total],
    ['Очікують нарахування',financeSummary.contracts.pending_total],
    ['Частка скарбниці',financeSummary.treasury_contract_income],
    ['Нараховано учасникам',financeSummary.payouts.accrued],
    ['Фактично видано',financeSummary.payouts.handed_over],
    ['CAPT-записи',financeSummary.capt.records],
    ['CAPT-виплати',financeSummary.capt.paid_total]
  ];
  content='<div class="grid3 gr-workspace-finance">'+figures.map(([label,value])=>'<div class="card flat"><div class="muted small">'+esc(label)+'</div><h3 class="mono">'+fmt(value)+'</h3></div>').join('')+'</div>'+
   '<p class="muted small mt">Тільки статистика свого підрозділу. Редагування казни, проведення контрактів і фактичні виплати тут недоступні.</p>';
 }
 else {
  const rows=(active.items||[]).slice(0,60).map(r=>'<tr><td class="table-title">'+esc(r.title)+
   '<div class="small muted">'+esc(String(r.details||'').slice(0,110))+'</div></td><td>'+
   esc(userName(r.assignee_id||r.owner_id))+'</td><td>'+badge(r.status)+'</td><td>'+
   '<button class="btn tiny secondary" data-action="view-record" data-module="'+esc(active.id)+'" data-id="'+esc(r.id)+'">Відкрити ↗</button></td></tr>');
  content=rows.length?table(['Назва','Відповідальний','Статус','Дії'],rows):empty('Записів цього підрозділу немає');
 }
 const canAdd=!!active.can_create&&active.id!=='personnel'&&active.id!=='contracts'&&active.id!=='public_calendar';
 const create=canAdd?'<button class="btn" data-action="workspace-new-record" data-module="'+esc(active.id)+'">＋ Додати запис</button>':'';
 return intro('Управління підрозділом','Окремий робочий простір керівника: особовий склад, контракти та всі доступні операційні розділи.')+
  '<div class="card gr-workspace-head"><div class="row space wrap"><div><div class="overline">GRIZZLY / ПІДРОЗДІЛ</div><h2>'+esc(dept.title)+'</h2><p class="muted small">Керівник: '+esc(userName(dept.head_id))+'</p></div>'+selector+'</div></div>'+
  '<div class="cards gr-workspace-stats">'+stats.map(([label,value])=>'<div class="card stat"><span class="muted small">'+esc(label)+'</span><div class="number">'+fmt(value)+'</div></div>').join('')+'</div>'+
  '<div class="gr-workspace-layout"><nav class="card gr-workspace-nav" aria-label="Розділи підрозділу"><h3>Розділи керівника</h3><p class="small muted">Дані тільки обраного напрямку.</p>'+buttons+'</nav>'+
  '<section class="card gr-workspace-content"><div class="card-head"><div><h3>'+esc(active.title)+'</h3>'+
  '<p class="small muted">У підрозділі: '+fmt(active.count||0)+' записів'+(active.attention?' · На перевірці: '+fmt(active.attention):'')+'</p></div>'+create+'</div>'+
  content+'</section></div>';
}
async function departments(){
 const all=state.departments;
 const focus=state.departmentFocus||'all';
 const dept=all.find(d=>d.id===focus);
 const [taskRes,reportRes,financial]=await Promise.all([api('/records/tasks'),api('/records/reports'),dept&&(state.user.role==='leader'||state.user.role==='deputy'||(state.user.role==='head'&&state.user.department_id===dept.id))?api('/departments/'+encodeURIComponent(dept.id)+'/finance-summary'):Promise.resolve(null)]);
 const tasks=taskRes.items||[],reports=reportRes.items||[];
 const roster=state.roster||[];
 const sectionMembers=id=>roster.filter(u=>u.department_id===id);
 const headLabel=d=>d.head_id?userName(d.head_id):'Не призначено';
 const cards=all.map(d=>{
  const members=sectionMembers(d.id),mine=d.id===state.user.department_id;
  const taskCount=tasks.filter(x=>x.department_id===d.id&&x.status!=='Завершено').length;
  const reportCount=reports.filter(x=>x.department_id===d.id&&x.status==='На перевірці').length;
  return '<article class="card" style="display:flex;flex-direction:column;gap:10px">'+
   '<div class="row space"><span class="overline">ПІДРОЗДІЛ</span>'+(mine?'<span class="badge green">Мій напрямок</span>':'')+'</div>'+
   '<h3>'+esc(d.title)+'</h3>'+
   '<div class="small">Керівник: <strong>'+esc(headLabel(d))+'</strong></div>'+
   '<div class="row wrap small muted"><span>Учасників: '+members.length+'</span><span>Активних завдань: '+taskCount+'</span><span>Звітів на перевірці: '+reportCount+'</span></div>'+
   '<div class="row wrap mt" style="margin-top:auto"><button class="btn tiny secondary" data-action="department-select" data-value="'+esc(d.id)+'">Відкрити напрямок</button>'+
   (state.user.role==='leader'?'<button class="btn tiny secondary" data-action="edit-department" data-id="'+esc(d.id)+'">Налаштувати</button>':'')+'</div></article>';
 }).join('');
 let details='';
 if(dept){
  const members=sectionMembers(dept.id),dtasks=tasks.filter(x=>x.department_id===dept.id),dreports=reports.filter(x=>x.department_id===dept.id);
  const memberRows=members.map(u=>'<tr><td><strong>'+esc(u.nickname||'Учасник')+'</strong></td><td>'+esc(rankName(u.rank_id))+'</td><td>'+esc(roles[u.role]||u.role)+'</td><td>'+esc(memberStatusLabel(u.status))+'</td></tr>');
  const taskRows=dtasks.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(userName(x.assignee_id))+'</td><td>'+badge(x.status)+'</td><td><button class="btn tiny secondary" data-action="view-record" data-module="tasks" data-id="'+esc(x.id)+'">Відкрити</button></td></tr>');
  const reportRows=dreports.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(userName(x.owner_id))+'</td><td>'+badge(x.status)+'</td><td><button class="btn tiny secondary" data-action="view-record" data-module="reports" data-id="'+esc(x.id)+'">Відкрити</button></td></tr>');
  const allowed=(state.user.role==='leader'||state.user.role==='deputy'||(state.user.role==='head'&&state.user.department_id===dept.id))&&can('tasks:manage');
  details='<div class="card mt"><div class="row space wrap"><div><h2>'+esc(dept.title)+'</h2><p class="muted small">Керівник: '+esc(headLabel(dept))+' · Учасників: '+members.length+'</p></div>'+
   '<div class="row wrap"><button class="btn tiny secondary" data-action="department-select" data-value="all">Усі напрямки</button><button class="btn tiny secondary" data-action="department-contracts" data-value="'+esc(dept.id)+'">Контракти напрямку</button>'+
   (allowed?'<button class="btn tiny" data-action="department-new-task" data-value="'+esc(dept.id)+'">＋ Завдання підрозділу</button>':'')+'</div></div>'+
   (financial?'<div class="grid3 mt">'+[
    ['Сума контрактів',fmt(financial.contracts.total)],
    ['Контракти · проведено',fmt(financial.contracts.settled_total)],
    ['Очікують нарахування',fmt(financial.contracts.pending_total)],
    ['До скарбниці з контрактів',fmt(financial.treasury_contract_income)],
    ['Нараховано учасникам',fmt(financial.payouts.accrued)],
    ['Видано учасникам',fmt(financial.payouts.handed_over)],
    ['CAPT-записи',fmt(financial.capt.records)],
    ['CAPT-виплати',fmt(financial.capt.paid_total)]
   ].map(([label,value])=>'<div class="card flat"><div class="muted small">'+esc(label)+'</div><h3 class="mono">'+value+'</h3></div>').join('')+'</div><div class="notice mt">Статистика тільки цього підрозділу. Внески та витрати загальної казни не розподіляються автоматично між напрямками.</div>':'')+
   '<h3 class="mt">Особовий склад</h3>'+(members.length?table(['Нікнейм','Ігровий ранг','Роль','Статус'],memberRows):empty('Учасників немає','Лідер може призначити напрямок в особовій справі учасника.'))+
   '<h3 class="mt">Завдання напрямку</h3>'+(dtasks.length?table(['Завдання','Виконавець','Статус','Дія'],taskRows):empty('Немає доступних завдань'))+
   '<h3 class="mt">Звіти напрямку</h3>'+(dreports.length?table(['Звіт','Автор','Статус','Дія'],reportRows):empty('Немає доступних звітів'))+
   '<p class="muted small mt">Завдання та звіти відображаються відповідно до ваших прав доступу. Керівник іншого напрямку не може керувати ними.</p></div>';
 }
 const unassigned=roster.filter(u=>!u.department_id);
 return intro('Підрозділи GRIZZLY','Кожен напрямок має свого керівника, учасників, завдання та звіти. Призначення складу і керівників виконує лідер.')+
 '<div class="cards">'+[['Підрозділів',all.length],['Учасників у напрямках',roster.length-unassigned.length],['Без підрозділу',unassigned.length],['Керівників призначено',all.filter(d=>!!d.head_id).length]].map(([label,value])=>'<div class="card stat"><div class="muted small">'+esc(label)+'</div><div class="number">'+value+'</div></div>').join('')+'</div>'+
 (unassigned.length&&state.user.role==='leader'?'<div class="notice mt">Без підрозділу: '+unassigned.map(x=>esc(x.nickname||'Учасник')).join(', ')+'. Призначте напрямок в розділі «Склад сім’ї».</div>':'')+
 '<div class="grid3 mt">'+cards+'</div>'+details;
}
function departmentForm(id){
 const d=state.departments.find(x=>x.id===id);
 if(!d||state.user.role!=='leader')throw new Error('Тільки лідер налаштовує підрозділи');
 const candidates=state.users.filter(u=>u.role==='head'&&u.status==='active'&&u.department_id===d.id);
 const options=[{id:'',nickname:'Без керівника'},...candidates].map(u=>'<option value="'+esc(u.id)+'" '+(u.id===(d.head_id||'')?'selected':'')+'>'+esc(u.nickname||u.username)+'</option>').join('');
 modal('Налаштувати підрозділ','<p class="muted small mb">Спочатку призначте учаснику роль «Голова відділу» та цей напрямок у його особовій справі. Лише після цього призначте керівника нижче.</p>'+
  '<form id="department-form" data-id="'+esc(id)+'" class="formgrid">'+field('Назва підрозділу','title',d.title,'text',true,'required')+
  '<div class="field full"><label>Керівник підрозділу</label><select class="select" name="head_id">'+options+'</select></div>'+
  '<div class="full form-actions"><button class="btn" type="submit">Зберегти</button></div></form>');
}
const evidenceText=r=>(r?.evidence||[]).join('\n');
function links(r){return (r.evidence||[]).length?`<div class="row wrap">${r.evidence.map((v,i)=>`<a class="small gallery-link" href="${esc(v)}" target="_blank" rel="noopener noreferrer">Доказ ${i+1} ↗</a>`).join('')}</div>`:'<span class="muted small">Без доказів</span>';}
async function renderModule(mod){const cfg=moduleInfo[mod];if(!cfg)return empty('Розділ відсутній');if(mod==='blacklist'&&!can('discipline:manage'))return empty('Недостатньо прав');const data=await api(`/records/${mod}`);const list=applyFilters(data.items.filter(x=>searchMatch(x.title,x.details,x.status,userName(x.assignee_id))));const create=can(cfg[2])||['reports','promotions','capt_attendance','vehicle_loans'].includes(mod);return `${intro(cfg[0],cfg[1],create?`<button class="btn" data-action="new-record" data-module="${mod}">＋ Додати запис</button>`:'')}<div class="toolbar">${searchBar()}${filterControls()}${exportButton(mod)}<span class="muted small">${list.length} записів</span></div>${table(['Назва / опис','Відповідальний','Статус','Дата','Дії'],list.map(x=>`<tr><td class="table-title">${esc(x.title)}<div class="muted wordwrap" style="max-width:330px">${esc(x.details.slice(0,110))}</div></td><td>${esc(userName(x.assignee_id||x.owner_id))}<div class="muted">${esc(departmentName(x.department_id))}</div></td><td>${badge(x.status)}${mod==='tasks'&&x.ends_at?'<div class="muted small">'+esc(kyivDueStatus(x.ends_at,x.status))+'</div>':''}</td><td>${mod==='tasks'&&x.ends_at?esc('До '+kyivWallDate(x.ends_at).replace('T',' ')):date(x.starts_at||x.created_at)}</td><td><button class="btn tiny secondary" data-action="view-record" data-id="${esc(x.id)}" data-module="${mod}">Відкрити ↗</button></td></tr>`))}`;}
function recordExtraFields(mod,r){const ex=r?.extra||{};const text=(label,key)=>field(label,`extra_${key}`,ex[key]||'');const area=(label,key)=>field(label,`extra_${key}`,Array.isArray(ex[key])?ex[key].join('\n'):ex[key]||'','textarea',true);const pick=(label,key,opts)=>`<div class="field"><label>${esc(label)}</label><select class="select" name="extra_${key}">${opts.map(([v,t])=>`<option value="${v}" ${ex[key]===v?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`;
 switch(mod){
 case 'promotions':return `<div class="field full"><label>Цільовий ранг *</label><select name="extra_requested_rank_id" class="select" required><option value="">Оберіть ранг</option>${state.ranks.map(rank=>`<option value="${rank.id}" ${Number(ex.requested_rank_id)===rank.id?'selected':''}>${esc(rank.title)}</option>`).join('')}</select><small>Перевірте умови рангу у розділі «Ранги»</small></div><div id="promotion-requirement-box" class="full">${promotionChecklistView(ex.requested_rank_id||'',Array.isArray(ex.checklist_completed)?ex.checklist_completed:[])}</div><textarea name="extra_checklist_completed" class="textarea" style="display:none" aria-hidden="true">${esc(Array.isArray(ex.checklist_completed)?ex.checklist_completed.join('\n'):'')}</textarea>`;
 case 'capt_matches':return `${text('Суперник','opponent')}${text('Місце проведення','place')}${field('Кількість місць в основному складі (1–50)','extra_lineup_limit',ex.lineup_limit??8,'number',false,'min="1" max="50" step="1"')}${area('Ручні примітки щодо складу (не впливають на автоматичний набір)','lineup')}<div class="field"><label>Підсумок бою (для статистики)</label><select class="select" name="extra_outcome">${[['','Не вказано'],['win','Перемога'],['loss','Поразка'],['draw','Нічия'],['cancelled','Скасовано']].map(([v,label])=>`<option value="${v}" ${ex.outcome===v?'selected':''}>${label}</option>`).join('')}</select></div>${text('Результат / рахунок','result')}`;
 case 'capt_training':return `${text('Тема тренування','topic')}${text('Інструктор','instructor')}`;
 case 'capt_attendance':return `${pick('Тип участі','attendance_type',[['battle','Бій'],['afk','AFK']])}${text('ID бою / тренування','match_id')}${text('Відмітка відвідування','attendance_note')}`;
 case 'vehicles':return `${text('Державний номер / ID транспорту','plate')}${text('Марка та модель','model')}${pick('Стан транспорту','condition',[['ready','Справний'],['repair','На ремонті'],['unavailable','Недоступний']])}${text('Гараж / місце паркування','location')}${text('Відповідальний (нік)','responsible')}${text('Примітка до авто','notes')}`;
 case 'vehicle_loans':return `${text('ID або номер транспорту','vehicle')}${pick('Дія','action',[['issue','Видано'],['return','Повернено']])}${text('Кому / від кого','driver')}${text('Стан / примітка','condition')}`;
 case 'events':return `${text('Місце заходу','place')}${pick('Тип заходу','event_type',[['meeting','Збори'],['training','Тренування'],['trip','Виїзд'],['event','Івент']])}`;
 case 'discipline':return `${text('Порушник','offender')}${text('Пункт правил','rule')}${text('Рішення / стягнення','sanction')}`;
 case 'blacklist':return `${text('Нік гравця','offender')}${text('Причина','reason')}${text('Тривалість','duration')}`;
 case 'templates':return `${pick('Для каналу','channel',[['discord','Discord'],['game','Ігровий чат']])}`;
 case 'notices':return `${pick('Канал оголошення','channel',[['discord','Discord'],['game','Ігровий чат']])}`;
 default:return '';
 }
}
async function galleryManager(){
  const result=await api('/records/gallery');
  const list=applyFilters(result.items.filter(r=>searchMatch(r.title,r.details,galleryCategoryLabel(galleryCategory(r)))));
  const active=state.galleryAdminFilter||'all';
  const visible=active==='all'?list:list.filter(r=>galleryCategory(r)===active);
  const totals={all:list.length,approved:list.filter(r=>r.status==='Погоджено').length,draft:list.filter(r=>r.status!=='Погоджено').length};
  const filters=galleryCategories.map(([id,label])=>'<button type="button" class="btn tiny '+(active===id?'':'ghost')+'" data-action="gallery-admin-filter" data-category="'+id+'">'+esc(label)+'</button>').join('');
  const cards=visible.map(r=>{
    const photo=galleryPhoto(r);
    const image=photo?'<img src="'+esc(photo)+'" alt="'+esc(r.title)+'" loading="lazy">':'<div class="gr-admin-photo-placeholder">▧<small>Додайте пряме посилання ImgBB</small></div>';
    const publish=r.status==='Погоджено';
    return '<article class="card gr-admin-photo-card"><div class="gr-admin-photo-image">'+image+'<span class="gr-admin-photo-status">'+(publish?'На сайті':'Чернетка')+'</span></div>'+
      '<div class="gr-admin-photo-body"><div class="row space"><span class="small muted">'+esc(galleryCategoryLabel(galleryCategory(r)))+'</span>'+
      (r.extra?.featured?'<span class="pill">★ Обкладинка</span>':'')+'</div>'+
      '<h3>'+esc(r.title)+'</h3>'+
      (r.details?'<p class="muted small">'+esc(r.details.slice(0,135))+'</p>':'')+
      '<div class="row wrap gr-admin-photo-actions"><button class="btn tiny secondary" data-action="edit-record" data-module="gallery" data-id="'+esc(r.id)+'">Редагувати</button>'+
      (can('content:manage')?'<button class="btn tiny '+(publish?'ghost':'')+'" data-action="gallery-publish" data-id="'+esc(r.id)+'" data-status="'+(publish?'Заплановано':'Погоджено')+'">'+(publish?'Зняти з публікації':'Опублікувати')+'</button>':'')+'</div></div></article>';
  }).join('');
  return intro('Фотогалерея GRIZZLY','Реальні скриншоти GTA 5 через ImgBB. На головній видно лише погоджені фото.',
    can('content:manage')?'<button class="btn" data-action="gallery-new">＋ Додати фото</button>':'')+
    '<div class="cards gr-gallery-manager-stats"><div class="card stat"><div class="muted small">Усього фото</div><div class="number">'+fmt(totals.all)+'</div></div>'+
    '<div class="card stat"><div class="muted small">На головній</div><div class="number">'+fmt(totals.approved)+'</div></div>'+
    '<div class="card stat"><div class="muted small">Не опубліковано</div><div class="number">'+fmt(totals.draft)+'</div></div></div>'+
    '<div class="notice mt">Відкрийте <a href="https://imgbb.com/" target="_blank" rel="noopener noreferrer">ImgBB ↗</a>, завантажте свій скриншот та скопіюйте <strong>пряме посилання на зображення</strong> (зазвичай https://i.ibb.co/…jpg). Після створення натисніть «Опублікувати».</div>'+
    '<div class="toolbar gr-admin-gallery-toolbar">'+searchBar()+'<div class="row wrap">'+filters+'</div>'+exportButton('gallery')+'</div>'+
    (visible.length?'<div class="gr-admin-gallery-grid">'+cards+'</div>':empty('Немає фотографій для показу','Додайте перше фото або змініть фільтр.'));
}
function galleryForm(record){
  const r=record||{};
  const category=galleryCategory(r);
  const options=galleryCategories.filter(([key])=>key!=='all').map(([key,label])=>
    '<option value="'+key+'" '+(key===category?'selected':'')+'>'+esc(label)+'</option>').join('');
  const direct=galleryPhoto(r);
  const statusOptions=['Заплановано','Погоджено',...(!['Заплановано','Погоджено'].includes(r.status)&&r.status?[r.status]:[])].map(s=>'<option value="'+esc(s)+'" '+((r.status||'Заплановано')===s?'selected':'')+'>'+esc(s==='Погоджено'?'Опубліковано':s==='Заплановано'?'Чернетка':s)+'</option>').join('');
  modal(record?'Редагувати фото GRIZZLY':'Нове фото GRIZZLY',
    '<form id="gallery-form" class="formgrid" data-id="'+esc(r.id||'')+'">'+
    field('Назва фотографії *','title',r.title||'','text',true,'required maxlength="160"')+
    field('Опис / підпис','details',r.details||'','textarea',true,'maxlength="3000"')+
    '<div class="field full"><label>Пряме посилання на фото ImgBB *</label><input class="input" type="url" required name="photo_url" placeholder="https://i.ibb.co/.../photo.jpg" value="'+esc(direct||galleryLink(r))+'">'+
    '<small>Тільки HTTPS ImgBB. Для показу фото виберіть посилання, що закінчується на .jpg, .png або .webp.</small></div>'+
    '<div class="field"><label>Категорія</label><select class="select" name="category">'+options+'</select></div>'+
    '<div class="field"><label>Виділяти на головній</label><select class="select" name="featured"><option value="false" '+(!r.extra?.featured?'selected':'')+'>Ні</option><option value="true" '+(r.extra?.featured?'selected':'')+'>Так ★</option></select></div>'+
    '<div class="field"><label>Публікація</label><select class="select" name="status">'+statusOptions+'</select></div>'+
    '<div class="field"><label>Завантаження зображення</label><a class="btn secondary" href="https://imgbb.com/" target="_blank" rel="noopener noreferrer">Відкрити ImgBB ↗</a></div>'+
    '<div class="full gr-gallery-form-preview" id="gallery-live-preview">'+(direct?'<img src="'+esc(direct)+'" alt="Попередній перегляд" loading="lazy">':'<span class="muted small">Попередній перегляд з’явиться після введення прямого посилання</span>')+'</div>'+
    '<div class="full form-actions"><button type="button" class="btn ghost" data-action="close-modal">Скасувати</button><button type="submit" class="btn">Зберегти фото</button></div></form>');
}
function updateGalleryFormPreview(){
  const form=$('#gallery-form'),target=$('#gallery-live-preview');
  if(!form||!target)return;
  const img=galleryPhoto({evidence:[form.querySelector('[name="photo_url"]')?.value||'']});
  target.innerHTML=img?'<img src="'+esc(img)+'" alt="Попередній перегляд" loading="lazy">':
    '<span class="muted small">Вставте пряме HTTPS-посилання ImgBB на JPG, PNG, WEBP або GIF.</span>';
}
async function newsManager(){
  const items=(await api('/records/public_news')).items;
  const visible=applyFilters(items.filter(r=>searchMatch(r.title,r.details,newsTypeLabel(r.extra?.news_category))));
  const published=items.filter(x=>x.status==='Погоджено').length;
  const cards=visible.map(r=>{
    const published=r.status==='Погоджено';
    return '<article class="card gr-news-admin-card"><div class="row space"><span class="pill">'+esc(newsTypeLabel(r.extra?.news_category))+'</span><span class="muted small">'+esc(date(r.updated_at))+'</span></div>'+
      '<h3>'+esc(r.title)+'</h3><p class="muted small gr-news-admin-text">'+esc(r.details.slice(0,240))+'</p>'+
      '<div class="row space wrap"><span>'+badge(r.status)+'</span>'+(r.extra?.featured?'<span class="pill">★ Важливе</span>':'')+'</div>'+
      '<div class="row wrap"><button class="btn tiny secondary" data-action="news-edit" data-id="'+esc(r.id)+'">Редагувати</button>'+
      '<button class="btn tiny '+(published?'ghost':'')+'" data-action="news-publish" data-id="'+esc(r.id)+'" data-status="'+(published?'Заплановано':'Погоджено')+'">'+(published?'Приховати':'Опублікувати')+'</button></div></article>';
  }).join('');
  return intro('Новини GRIZZLY','Публічні повідомлення для відвідувачів. Внутрішні оголошення сюди не передаються.',
    can('content:manage')?'<button class="btn" data-action="news-new">＋ Нова публікація</button>':'')+
    '<div class="notice">На головній відображаються лише новини зі статусом «Погоджено». Створюйте тут тільки матеріали для відкритого доступу.</div>'+
    '<div class="cards mt gr-news-admin-stats"><div class="card stat"><div class="muted small">Публікацій</div><div class="number">'+fmt(items.length)+'</div></div>'+
    '<div class="card stat"><div class="muted small">На сайті</div><div class="number">'+fmt(published)+'</div></div>'+
    '<div class="card stat"><div class="muted small">Чернеток</div><div class="number">'+fmt(items.length-published)+'</div></div></div>'+
    '<div class="toolbar">'+searchBar()+'</div>'+
    (visible.length?'<div class="gr-news-admin-grid">'+cards+'</div>':empty('Новин поки немає','Створи першу публічну новину GRIZZLY.'));
}
function newsForm(record){
  const item=record||{},extra=item.extra||{};
  const options=newsTypes.map(([id,name])=>'<option value="'+id+'" '+((extra.news_category||'news')===id?'selected':'')+'>'+esc(name)+'</option>').join('');
  const statuses=['Заплановано','Погоджено'].map(s=>'<option value="'+s+'" '+((item.status||'Заплановано')===s?'selected':'')+'>'+(s==='Заплановано'?'Чернетка':'Опубліковано')+'</option>').join('');
  modal(record?'Редагувати новину':'Нова публічна новина',
    '<div class="notice mb">Увага: це відкрита публікація на сайті GRIZZLY. Не вказуйте внутрішню інформацію сім’ї.</div>'+
    '<form id="news-form" class="formgrid" data-id="'+esc(item.id||'')+'">'+
    field('Заголовок *','title',item.title||'','text',true,'required maxlength="160"')+
    field('Текст новини *','details',item.details||'','textarea',true,'required minlength="10" maxlength="3000"')+
    '<div class="field"><label>Категорія</label><select name="category" class="select">'+options+'</select></div>'+
    '<div class="field"><label>Важлива публікація</label><select name="featured" class="select"><option value="false" '+(!extra.featured?'selected':'')+'>Ні</option><option value="true" '+(extra.featured?'selected':'')+'>Так ★</option></select></div>'+
    '<div class="field full"><label>Видимість</label><select name="status" class="select">'+statuses+'</select></div>'+
    '<div class="full form-actions"><button type="button" class="btn ghost" data-action="close-modal">Скасувати</button><button class="btn" type="submit">Зберегти новину</button></div></form>');
}
async function teamManager(){
  const records=(await api('/records/public_team')).items;
  const matching=records.filter(r=>searchMatch(r.title,r.details,r.extra?.position));
  const display=matching.sort((a,b)=>Number(a.extra?.sort_order??50)-Number(b.extra?.sort_order??50)||String(a.title).localeCompare(String(b.title),'uk'));
  const published=records.filter(r=>r.status==='Погоджено').length;
  const cards=display.map(r=>{
    const image=galleryPhoto(r);
    const isPublic=r.status==='Погоджено';
    const initial=String(r.title||'G').slice(0,1).toUpperCase();
    return '<article class="card gr-admin-team-card">'+
      '<div class="gr-admin-team-portrait">'+(image?'<img loading="lazy" src="'+esc(image)+'" alt="Персонаж '+esc(r.title)+'">':
       '<div class="gr-admin-team-placeholder">'+esc(initial)+'</div>')+'</div>'+
      '<div class="gr-admin-team-meta"><div class="row wrap"><span>'+badge(r.status)+'</span><span class="pill">Порядок: '+esc(String(r.extra?.sort_order??50))+'</span></div>'+
      '<span class="gr-admin-team-role">'+esc(r.extra?.position||'Посаду не вказано')+'</span>'+
      '<h3>'+esc(r.title)+'</h3><p class="muted small">'+esc(String(r.details||'').slice(0,145))+'</p>'+
      '<div class="row wrap gr-admin-team-actions"><button class="btn tiny secondary" data-action="team-edit" data-id="'+esc(r.id)+'">Редагувати</button>'+
      '<button class="btn tiny '+(isPublic?'ghost':'')+'" data-action="team-publish" data-id="'+esc(r.id)+'" data-status="'+(isPublic?'Заплановано':'Погоджено')+'">'+(isPublic?'Приховати':'Опублікувати')+'</button>'+'<button class="btn tiny danger" data-action="team-delete" data-id="'+esc(r.id)+'">Видалити</button></div>'+
      '</div></article>';
  }).join('');
  return intro('Керівництво сайту','Публічні RP-профілі керівників сім’ї. Вони не пов’язані з приватними даними акаунтів.',
    '<button class="btn" data-action="team-new">＋ Додати керівника</button>')+
    '<div class="notice">На головній видно тільки опубліковані профілі. Додавай лише ігрові нікнейми, посади й зображення, які можна показувати відкрито.</div>'+
    '<div class="cards gr-admin-team-stats mt">'+
      '<div class="card stat"><div class="muted small">Усього профілів</div><div class="number">'+fmt(records.length)+'</div></div>'+
      '<div class="card stat"><div class="muted small">Показуються на сайті</div><div class="number">'+fmt(published)+'</div></div>'+
      '<div class="card stat"><div class="muted small">Не опубліковано</div><div class="number">'+fmt(records.length-published)+'</div></div>'+
    '</div><div class="toolbar">'+searchBar()+'</div>'+
    (display.length?'<div class="gr-admin-team-grid">'+cards+'</div>':empty('Профілів керівництва ще немає','Натисни «Додати керівника» та заповни ігровий профіль.'));
}
function teamForm(record){
  const r=record||{},extra=r.extra||{},image=galleryPhoto(r);
  const options=['Заплановано','Погоджено'].map(status=>'<option value="'+status+'" '+((r.status||'Заплановано')===status?'selected':'')+'>'+(status==='Погоджено'?'Опубліковано':'Чернетка')+'</option>').join('');
  modal(record?'Редагувати профіль керівника':'Новий профіль керівника',
    '<div class="notice mb">Додавай тільки дані ігрового персонажа, які мають бути публічними. Особові справи учасників не використовуються.</div>'+
    '<form id="team-form" data-id="'+esc(r.id||'')+'" class="formgrid">'+
    field('Ігровий нікнейм *','nickname',r.title||'','text',true,'required maxlength="160"')+
    field('Посада в сім’ї *','position',extra.position||'','text',false,'required maxlength="80"')+
    field('Порядок на сайті (1–99)','sort_order',extra.sort_order??50,'number',false,'required min="1" max="99" step="1"')+
    field('Коротка біографія / опис','bio',r.details||'','textarea',true,'maxlength="3000"')+
    '<div class="field full"><label>Фото персонажа (необов’язково)</label>'+
    '<input class="input" type="url" name="photo_url" placeholder="https://i.ibb.co/.../image.webp" value="'+esc(image||galleryLink(r))+'">'+
    '<small>Пряме HTTPS-посилання ImgBB на JPG, PNG або WEBP. Без фото буде стилізована картка з першою літерою імені.</small></div>'+
    '<div class="field full"><label>Публікація</label><select name="status" class="select">'+options+'</select></div>'+
    '<div class="full gr-gallery-form-preview" id="team-live-preview">'+(image?'<img alt="Попередній перегляд персонажа" src="'+esc(image)+'" loading="lazy">':'<span class="muted small">Фото можна додати пізніше.</span>')+'</div>'+
    '<div class="full form-actions"><button type="button" class="btn ghost" data-action="close-modal">Скасувати</button>'+
    '<button type="submit" class="btn">Зберегти профіль</button></div></form>');
}
function updateTeamFormPreview(){
  const form=$('#team-form'),target=$('#team-live-preview');
  if(!form||!target)return;
  const raw=form.querySelector('[name="photo_url"]')?.value.trim()||'';
  const img=galleryPhoto({evidence:[raw]});
  target.innerHTML=img?'<img alt="Попередній перегляд персонажа" src="'+esc(img)+'" loading="lazy">':
    '<span class="muted small">'+(raw?'Вкажіть пряме HTTPS-посилання ImgBB на зображення.':'Фото можна додати пізніше.')+'</span>';
}
async function achievementsManager(){
  const data=(await api('/records/public_achievements')).items;
  const visible=applyFilters(data.filter(a=>searchMatch(a.title,a.details,achievementTypeLabel(a.extra?.category),a.extra?.achieved_on)));
  const cat=state.achievementAdminFilter||'all';
  const shown=cat==='all'?visible:visible.filter(a=>(a.extra?.category||'milestone')===cat);
  const published=data.filter(a=>a.status==='Погоджено').length;
  const tabs=achievementTypes.map(([key,title])=>'<button type="button" class="btn tiny '+(key===cat?'':'ghost')+'" data-action="achievement-admin-filter" data-category="'+key+'">'+esc(title)+'</button>').join('');
  const cards=shown.map(a=>{
    const photo=galleryPhoto(a),active=a.status==='Погоджено',category=a.extra?.category||'milestone';
    const label=achievementTypeLabel(category);
    return '<article class="card gr-admin-ach-card"><div class="gr-admin-ach-media">'+(photo?'<img src="'+esc(photo)+'" alt="'+esc(a.title)+'" loading="lazy">':
      '<div class="gr-admin-ach-symbol">★</div>')+'<span class="gr-admin-ach-flag">'+esc(label)+'</span></div>'+
      '<div class="gr-admin-ach-body"><div class="row space wrap">'+badge(a.status)+'<span class="muted small">'+esc(a.extra?.achieved_on||'Дата не вказана')+'</span></div>'+
      '<h3>'+esc(a.title)+'</h3><p class="muted small">'+esc(a.details.slice(0,170))+'</p>'+
      (a.extra?.featured?'<span class="pill">★ Вибране</span>':'')+
      '<div class="row wrap gr-admin-ach-actions">'+
      '<button class="btn tiny secondary" data-action="achievement-edit" data-id="'+esc(a.id)+'">Редагувати</button>'+
      '<button class="btn tiny '+(active?'ghost':'')+'" data-action="achievement-publish" data-id="'+esc(a.id)+'" data-status="'+(active?'Заплановано':'Погоджено')+'">'+(active?'Приховати':'Опублікувати')+'</button>'+
      '<button class="btn tiny danger" data-action="achievement-delete" data-id="'+esc(a.id)+'">Видалити</button>'+
      '</div></div></article>';
  }).join('');
  return intro('Досягнення GRIZZLY','Публічна історія CAPT-перемог, нагород і визначних подій сім’ї.',
    '<button class="btn" data-action="achievement-new">＋ Додати досягнення</button>')+
    '<div class="notice">Досягнення не імпортуються з внутрішнього CAPT автоматично. Для головної сторінки публікуйте лише перевірені результати.</div>'+
    '<div class="cards gr-admin-ach-stats mt"><div class="card stat"><div class="muted small">Усього записів</div><div class="number">'+fmt(data.length)+'</div></div>'+
    '<div class="card stat"><div class="muted small">На головній</div><div class="number">'+fmt(published)+'</div></div>'+
    '<div class="card stat"><div class="muted small">Чернеток</div><div class="number">'+fmt(data.length-published)+'</div></div></div>'+
    '<div class="toolbar gr-admin-ach-toolbar">'+searchBar()+'<div class="row wrap">'+tabs+'</div></div>'+
    (shown.length?'<div class="gr-admin-ach-grid">'+cards+'</div>':empty('У вибраній категорії немає досягнень','Створи перший запис або зміни фільтр.'));
}
function achievementForm(record){
  const r=record||{},x=r.extra||{};
  const categories=achievementTypes.filter(([key])=>key!=='all').map(([key,name])=>
    '<option value="'+key+'" '+((x.category||'milestone')===key?'selected':'')+'>'+esc(name)+'</option>').join('');
  const options=['Заплановано','Погоджено'].map(s=>
    '<option value="'+s+'" '+((r.status||'Заплановано')===s?'selected':'')+'>'+(s==='Погоджено'?'Опубліковано':'Чернетка')+'</option>').join('');
  const img=galleryPhoto(r);
  modal(record?'Редагувати досягнення':'Додати досягнення',
    '<div class="notice mb">Перевір достовірність результату перед публікацією. Внутрішні записи CAPT залишаються приватними.</div>'+
    '<form id="achievement-form" class="formgrid" data-id="'+esc(r.id||'')+'">'+
      field('Назва досягнення *','title',r.title||'','text',true,'required maxlength="160"')+
      field('Опис досягнення *','description',r.details||'','textarea',true,'required maxlength="3000"')+
      '<div class="field"><label>Категорія</label><select class="select" name="category">'+categories+'</select></div>'+
      field('Дата досягнення *','achieved_on',x.achieved_on||'','date',false,'required')+
      '<div class="field"><label>Важливе досягнення</label><select class="select" name="featured">'+
      '<option value="false" '+(!x.featured?'selected':'')+'>Ні</option>'+
      '<option value="true" '+(x.featured?'selected':'')+'>Так ★</option></select></div>'+
      '<div class="field"><label>Публікація</label><select class="select" name="status">'+options+'</select></div>'+
      '<div class="field full"><label>Обкладинка ImgBB (необов’язково)</label>'+
      '<input type="url" class="input" name="photo_url" placeholder="https://i.ibb.co/.../trophy.webp" value="'+esc(img||galleryLink(r))+'">'+
      '<small>Використовуй пряме HTTPS-посилання на зображення. Без фото буде емблема досягнення.</small></div>'+
      '<div class="full gr-gallery-form-preview" id="achievement-live-preview">'+
      (img?'<img src="'+esc(img)+'" alt="Попередній перегляд" loading="lazy">':'<span class="muted small">Обкладинка не додана.</span>')+'</div>'+
      '<div class="full form-actions"><button type="button" class="btn ghost" data-action="close-modal">Скасувати</button>'+
      '<button type="submit" class="btn">Зберегти досягнення</button></div></form>');
}
function updateAchievementPreview(){
  const form=$('#achievement-form'),node=$('#achievement-live-preview');
  if(!form||!node)return;
  const raw=form.querySelector('[name="photo_url"]')?.value.trim()||'';
  const img=galleryPhoto({evidence:[raw]});
  node.innerHTML=img?'<img src="'+esc(img)+'" alt="Попередній перегляд" loading="lazy">':
    '<span class="muted small">'+(raw?'Потрібне пряме посилання ImgBB на JPG, PNG, WEBP або GIF.':'Обкладинка не додана.')+'</span>';
}
async function calendarManager(){
  const items=(await api('/records/public_calendar')).items;
  const visible=applyFilters(items.filter(x=>searchMatch(x.title,x.details,x.extra?.location)));
  const published=items.filter(x=>x.status==='Погоджено').length;
  const cards=visible.sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at))).map(x=>
    '<article class="card gr-cal-admin-card"><div class="row space wrap">'+badge(x.status)+'<span class="pill">'+esc(grCalendarLabel(x.extra?.category))+'</span></div>'+
    '<h3>'+esc(x.title)+'</h3><p class="muted small">'+esc(x.details)+'</p>'+
    '<strong>◷ '+esc(x.starts_at?.replace('T',' · ')||'Дата не вказана')+'</strong>'+
    (x.extra?.location?'<span class="muted small">⌖ '+esc(x.extra.location)+'</span>':'')+
    '<div class="row wrap"><button class="btn tiny secondary" data-action="calendar-edit" data-id="'+esc(x.id)+'">Редагувати</button>'+
    '<button class="btn tiny '+(x.status==='Погоджено'?'ghost':'')+'" data-action="calendar-publish" data-id="'+esc(x.id)+'" data-status="'+(x.status==='Погоджено'?'Заплановано':'Погоджено')+'">'+(x.status==='Погоджено'?'Приховати':'Опублікувати')+'</button>'+
    '<button class="btn tiny danger" data-action="calendar-delete" data-id="'+esc(x.id)+'">Видалити</button></div></article>'
  ).join('');
  return intro('Календар сайту','Публічний календар GRIZZLY — окремо від приватних заходів.',
    '<button class="btn" data-action="calendar-new">＋ Додати захід</button>')+
    '<div class="notice">Публікуй тільки підтверджені заходи. Час вводиться за Києвом.</div>'+
    '<div class="cards mt gr-cal-admin-stats"><div class="card stat"><div class="muted small">Усі</div><div class="number">'+fmt(items.length)+'</div></div>'+
    '<div class="card stat"><div class="muted small">Опубліковано</div><div class="number">'+fmt(published)+'</div></div>'+
    '<div class="card stat"><div class="muted small">Чернетки</div><div class="number">'+fmt(items.length-published)+'</div></div></div>'+
    '<div class="toolbar">'+searchBar()+'</div>'+
    (visible.length?'<div class="gr-cal-admin-grid">'+cards+'</div>':empty('Публічних заходів ще немає','Створіть перше оголошення про збори або тренування.'));
}
function calendarForm(record){
  const r=record||{},x=r.extra||{};
  const cat=grCalendarCategories.filter(([id])=>id!=='all').map(([id,label])=>'<option value="'+id+'" '+((x.category||'event')===id?'selected':'')+'>'+esc(label)+'</option>').join('');
  const status=['Заплановано','Погоджено'].map(v=>'<option value="'+v+'" '+((r.status||'Заплановано')===v?'selected':'')+'>'+(v==='Погоджено'?'Опубліковано':'Чернетка')+'</option>').join('');
  modal(record?'Редагувати публічний захід':'Новий публічний захід',
    '<div class="notice mb">Час події вводиться за Києвом, без автоматичного перетворення часових поясів.</div>'+
    '<form id="calendar-form" class="formgrid" data-id="'+esc(r.id||'')+'">'+
    field('Назва *','title',r.title||'','text',true,'required maxlength="160"')+
    field('Опис *','description',r.details||'','textarea',true,'required maxlength="3000"')+
    '<div class="field"><label>Категорія</label><select name="category" class="select">'+cat+'</select></div>'+
    field('Місце','location',x.location||'','text',false,'maxlength="120"')+
    field('Початок (за Києвом) *','starts_at',r.starts_at||'','datetime-local',false,'required')+
    field('Завершення (за Києвом)','ends_at',r.ends_at||'','datetime-local',false,'')+
    '<div class="field full"><label>Видимість</label><select name="status" class="select">'+status+'</select></div>'+
    '<div class="full form-actions"><button type="button" class="btn ghost" data-action="close-modal">Скасувати</button>'+
    '<button type="submit" class="btn">Зберегти захід</button></div></form>');
}
function fleetVehicleForm(r){
 const e=r?.extra||{},mode=fleetCondition(r||{});
 const opts=[['ready','Справний'],['repair','Потребує ремонту'],['unavailable','Недоступний']];
 const f='<form id="record-form" class="formgrid" data-module="vehicles" data-id="'+esc(r?.id||'')+'">'+
 field('Марка та модель *','title',e.model||r?.title||'','text',false,'required')+
 field('Номер автомобіля *','extra_plate',e.plate||'','text',false,'required')+
 '<div class="field"><label>Стан</label><select name="extra_condition" class="select">'+opts.map(([v,t])=>'<option value="'+v+'" '+(mode===v?'selected':'')+'>'+t+'</option>').join('')+'</select></div>'+
 field('Гараж','extra_location',e.location||'')+
 field('Відповідальний','extra_responsible',e.responsible||'')+
 field('Вартість GTA$','extra_value',e.value??0,'number',false,'min="0" step="1"')+
 field('Пробіг км','extra_mileage',e.mileage??0,'number',false,'min="0" step="1"')+
 field('Примітки','details',r?.details||'','textarea',true)+
 field('Фото ImgBB','evidence',evidenceText(r),'textarea',true)+
 '<div class="full form-actions"><button type="button" class="btn ghost" data-action="close-modal">Скасувати</button><button type="submit" class="btn">Зберегти</button></div></form>';
 modal(r?'Редагувати авто':'Додати авто',f);
}
function moduleForm(mod,r){const cfg=moduleInfo[mod],isEdit=!!r;const canManage=can(cfg[2]);const x=r||{};const fields=`<form id="record-form" data-module="${mod}" data-id="${esc(r?.id||'')}" class="formgrid">${field('Назва / тема *','title',x.title,'text',true,'required maxlength="160"')}${field('Опис / RP-звіт','details',x.details,'textarea',true)}${recordExtraFields(mod,r)}${canManage?`${statusField(x.status||'Заплановано')}${selectField('Виконавець','assignee_id',state.users,x.assignee_id)}${selectField('Напрямок','department_id',state.departments,x.department_id)}${field('Сума / винагорода (ігрова валюта)','amount',x.amount||0,'number',false,'min="0" step="1"')}${field('Початок','starts_at',formatDateField(x.starts_at),'datetime-local')}${field('Термін / завершення','ends_at',formatDateField(x.ends_at),'datetime-local')}`:''}${field('Докази ImgBB (кожне посилання з нового рядка)','evidence',evidenceText(x),'textarea',true)}${canManage?field('Додаткові дані (JSON: склад, номер ТЗ, стан, чекліст тощо)','extra',JSON.stringify(x.extra||{},null,2),'textarea',true):''}<div class="full form-actions"><button type="button" class="btn ghost" data-action="close-modal">Скасувати</button><button type="submit" class="btn">${isEdit?'Зберегти':'Створити'}</button></div></form>`;modal(`${isEdit?'Редагувати':'Створити'} · ${cfg[0]}`,`${isEdit?`<div class="notice mb">Запис із перевіркою версії: чужі зміни не будуть перезаписані.</div>`:''}${fields}`);}
async function viewRecord(mod,id){const rows=(await api(`/records/${mod}`)).items;const r=rows.find(x=>x.id===id);if(!r)return toast('Запис недоступний',true);const payoutState=mod==='capt_attendance'?(await api('/capt/overview')).attendance.find(x=>x.id===id):null;const canManage=can(moduleInfo[mod][2])&&(state.user.role!=='head'||r.department_id===state.user.department_id);const canEdit=canManage||((r.owner_id===state.user.id||r.assignee_id===state.user.id)&&['reports','promotions','capt_attendance','vehicle_loans','tasks'].includes(mod));const review=canManage&&['reports','promotions'].includes(mod)&&r.owner_id!==state.user.id&&(mod!=='promotions'||['На перевірці','На доопрацювання'].includes(r.status));const status=mod==='events'?`<div class="hr"></div><div id="rsvp-content" class="muted small">Завантаження учасників…</div>`:'';modal(r.title,`<div class="stack"><div class="row space">${badge(r.status)}<span class="muted small">v${r.version} · ${date(r.updated_at)}</span></div><div class="longtext">${esc(r.details||'Опис не додано')}</div><div class="small muted">Відповідальний: ${esc(userName(r.assignee_id||r.owner_id))} · ${esc(departmentName(r.department_id))}</div>${r.amount?`<div class="small">Винагорода: <strong>${fmt(r.amount)}</strong></div>`:''}${r.starts_at?`<div class="small">Початок: ${esc(r.starts_at.replace('T',' '))}</div>`:''}${r.ends_at?`<div class="small">${mod==='tasks'?'Дедлайн':'Завершення'}: ${esc(kyivWallDate(r.ends_at).replace('T',' '))}${mod==='tasks'?' · '+esc(kyivDueStatus(r.ends_at,r.status)):''}</div>`:''}${links(r)}${mod==='promotions'?promotionReviewSummary(r):''}${Object.keys(r.extra||{}).length?`<div class="card flat"><strong>Додаткова інформація</strong><div class="stack mt small">${Object.entries(r.extra).filter(([k])=>k!=='review_nonce').map(([k,v])=>`<div><span class="muted">${esc(({requested_rank_id:'Цільовий ранг',checklist_completed:'Виконані умови',opponent:'Суперник',place:'Місце',lineup:'Склад на бій',result:'Результат',attendance_type:'Тип участі',match_id:'Бій / тренування',plate:'Номер ТЗ',condition:'Стан',responsible:'Відповідальний',review_comment:'Коментар керівника'})[k]||k)}:</span> <strong>${esc(Array.isArray(v)?v.join(', '):v)}</strong></div>`).join('')}</div></div>`:''}${status}${mod==='promotions'&&canManage&&r.owner_id===state.user.id?'<div class="notice">Це ваша власна заявка. Для перевірки потрібен інший уповноважений керівник.</div>':''}${mod==='capt_matches'?'<div class="hr"></div><section id="capt-signup-panel" class="stack"><p class="muted">Завантаження списку учасників…</p></section>':''}<div class="form-actions">${review?`<button class="btn secondary" data-action="review-record" data-module="${mod}" data-id="${id}">Перевірити</button>`:''}${canEdit?`<button class="btn" data-action="edit-record" data-module="${mod}" data-id="${id}">Редагувати</button>`:''}${mod==='templates'?`<button class="btn secondary" data-action="copy-template" data-id="${id}">Копіювати текст</button>`:''}${mod==='capt_attendance'&&payoutState?.paid===true?'<span class="pill">CAPT-виплату проведено</span>':mod==='capt_attendance'&&r.status==='Погоджено'&&can('finance:manage')?`<button class="btn" data-action="capt-pay" data-id="${id}">₴ Нарахувати CAPT</button>`:''}${canManage?`<button class="btn danger" data-action="delete-record" data-module="${mod}" data-id="${id}">Видалити</button>`:''}</div></div>`);if(mod==='capt_matches')await renderCaptSignupPanel(id);if(mod==='events'){try{const rs=await api(`/rsvp/${id}`);const el=$('#rsvp-content');if(el)el.innerHTML=`<div class="row wrap"><strong>Моя участь: ${esc(rs.own||'Не підтверджено')}</strong><span class="muted">Так: ${rs.counts.yes} · Ні: ${rs.counts.no}</span></div><div class="row mt"><button class="btn tiny" data-action="rsvp" data-id="${id}" data-value="Так">✓ Буду</button><button class="btn tiny ghost" data-action="rsvp" data-id="${id}" data-value="Ні">Не зможу</button></div>${rs.items.length?`<div class="muted small mt">${rs.items.map(i=>`${esc(userName(i.user_id))}: ${esc(i.response)}`).join(' · ')}</div>`:''}`;}catch(e){toast(e.message,true);}}}
async function renderCaptSignupPanel(id){
  const el=$('#capt-signup-panel');if(!el)return;
  try{
    const d=await api('/capt/matches/'+encodeURIComponent(id)+'/signups');
    if(!el.isConnected)return;
    const roster=(people)=>people.map((person,i)=>'<div class="capt-person"><span>'+String(i+1)+'. '+esc(person.nickname)+'</span></div>').join('')||'<p class="muted small">Немає записів</p>';
    el.innerHTML='<h3>Автоматичне формування CAPT-складу</h3>'
     +'<p class="small muted">Записано: '+fmt(d.total)+' · Основних місць: '+fmt(d.limit)+' · Резерв: '+fmt(d.reserve.length)+'. Основний склад формується за чергою запису.</p>'
     +'<div class="grid2"><div class="card flat"><strong>Основний склад</strong><div class="mt">'+roster(d.lineup)+'</div></div><div class="card flat"><strong>Резерв</strong><div class="mt">'+roster(d.reserve)+'</div></div></div>'
     +'<div class="form-actions">'+(d.open?(d.own?'<button class="btn secondary" data-action="capt-leave" data-id="'+esc(id)+'">Скасувати мій запис</button>':'<button class="btn" data-action="capt-join" data-id="'+esc(id)+'">＋ Записатися на бій</button>'):'<span class="pill">Запис закрито</span>')+'</div>';
  }catch(err){if(el.isConnected)el.innerHTML='<div class="notice">Не вдалося завантажити склад: '+esc(err.message)+'. Перевірте міграцію CAPT у D1.</div>';}
}
function promotionReviewSummary(record){
 const target=state.ranks.find(rank=>Number(rank.id)===Number(record.extra?.requested_rank_id));
 const progress=promotionProgress(record);
 const completed=Array.isArray(record.extra?.checklist_completed)?record.extra.checklist_completed:[];
 const checklist=progress.needed.length?'<div class="stack mt">'+progress.needed.map(item=>'<div class="row" style="align-items:start;gap:10px"><span aria-hidden="true">'+(completed.includes(item)?'☑':'☐')+'</span><span class="small">'+esc(item)+'</span></div>').join('')+'</div>':'<p class="muted small mt">Для цього підвищення чекліст не налаштований.</p>';
 return '<div class="card flat"><strong>Перевірка підвищення</strong>'+
 '<div class="small mt">Автор заявки: <strong>'+esc(userName(record.owner_id))+'</strong></div>'+
 '<div class="small">Цільовий ранг: <strong>'+esc(target?.title||'Не вказано')+'</strong></div>'+
 '<div class="small">Статус: '+badge(record.status)+'</div>'+
 '<div class="small mt">Самозвіт: <strong>'+(progress.total?progress.done+' із '+progress.total:'без встановленого чекліста')+'</strong></div>'+
 checklist+
 '<div class="hr"></div><strong class="small">Докази ImgBB</strong><div class="mt">'+links(record)+'</div>'+
 '<p class="muted small mt">Виконання умов заявлено учасником. Керівництво перевіряє докази перед рішенням.</p></div>';
}
async function reviewModal(mod,id){
 const record=(await api('/records/'+encodeURIComponent(mod))).items.find(x=>x.id===id);
 if(!record)throw new Error('Запис не знайдено');
 if(!can(moduleInfo[mod][2])||(state.user.role==='head'&&record.department_id!==state.user.department_id))throw new Error('Недостатньо прав для перевірки');
 if(record.owner_id===state.user.id)throw new Error('Власну заявку або звіт погоджувати заборонено');
 if(mod==='promotions'&&!['На перевірці','На доопрацювання'].includes(record.status))throw new Error('Ця заявка вже отримала рішення');
 const summary=mod==='promotions'?promotionReviewSummary(record):'<div class="notice mb">Перевірте звіт і прикріплені докази перед рішенням.</div>';
 const submit='<form id="review-form" data-module="'+esc(mod)+'" data-id="'+esc(id)+'" class="stack"><div class="field"><label>Рішення</label><select name="status" class="select"><option>Погоджено</option><option>На доопрацювання</option><option>Відхилено</option></select></div>'+
 field('Коментар керівника','comment','','textarea',true)+
 '<button class="btn" type="submit">Зберегти рішення</button></form>';
 modal('Перевірка заявки · GRIZZLY',summary+submit);
}
function grouped(mods,title,description){const active=state.sub[state.route]||mods[0];return `<div class="tabs mb">${mods.map(m=>`<button data-action="change-sub" data-value="${m}" class="tab ${m===active?'active':''}">${esc(moduleInfo[m][0])}</button>`).join('')}</div>`;}
function fleetCondition(record){
  const v=String(record.extra?.condition||'').toLowerCase().trim();
  if(['repair','ремонт','на ремонті','несправний'].includes(v))return 'repair';
  if(['unavailable','недоступний','заблоковано'].includes(v))return 'unavailable';
  return 'ready';
}
function fleetConditionLabel(condition){
  return ({ready:'Справний',repair:'Потребує ремонту',unavailable:'Недоступний'})[condition]||'Справний';
}
async function fleetPage(){
 const cars=(await api('/records/vehicles')).items;
 const query=String(state.search||'').trim().toLocaleLowerCase('uk');
 const condition=state.fleetCondition||'all';
 const counts={total:cars.length,ready:0,repair:0,unavailable:0};
 for(const car of cars)counts[fleetCondition(car)]++;
 const matches=car=>[car.title,car.details,car.extra?.plate,car.extra?.model,car.extra?.responsible,car.extra?.location].some(v=>String(v||'').toLocaleLowerCase('uk').includes(query));
 const list=applyFilters(cars.filter(car=>(condition==='all'||fleetCondition(car)===condition)&&matches(car)));
 const cards=list.map(car=>{
   const model=car.extra?.model||car.title,photo=galleryPhoto(car);
   const edit=can('fleet:manage')?'<button class="btn tiny secondary" data-action="edit-record" data-module="vehicles" data-id="'+esc(car.id)+'">Редагувати</button>':'';
   return '<div class="card" style="overflow:hidden">'+(photo?'<button type="button" data-action="fleet-photo" data-id="'+esc(car.id)+'" aria-label="Переглянути фото '+esc(model)+'" style="display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in"><img src="'+esc(photo)+'" alt="'+esc(model)+'" loading="lazy" style="width:100%;height:240px;object-fit:contain;background:#101218;border-radius:10px"></button>':'<div style="height:180px;display:grid;place-items:center;font-size:44px;opacity:.55">🚘</div>')+
    '<div class="row space mt"><h3>'+esc(model)+'</h3>'+badge(fleetConditionLabel(fleetCondition(car)))+'</div>'+
    '<p class="muted small">Номер: '+esc(car.extra?.plate||'Не вказано')+'</p>'+
    '<p class="muted small">Гараж: '+esc(car.extra?.location||'Не вказано')+'</p>'+
    '<p class="muted small">Відповідальний: '+esc(car.extra?.responsible||userName(car.assignee_id)||'—')+'</p>'+
    (Number(car.extra?.value)>0?'<p class="muted small">Вартість: '+fmt(car.extra.value)+' GTA$</p>':'')+(Number(car.extra?.mileage)>0?'<p class="muted small">Пробіг: '+fmt(car.extra.mileage)+' км</p>':'')+
    '<div class="row mt" style="flex-wrap:wrap;gap:6px"><button class="btn tiny secondary" data-action="view-record" data-module="vehicles" data-id="'+esc(car.id)+'">Деталі ↗</button>'+edit+'</div></div>';
 }).join('');
 return intro('Автопарк GRIZZLY','Автомобілі сім’ї: реєстрація, технічний стан та відповідальні.',can('fleet:manage')?'<button class="btn" data-action="new-record" data-module="vehicles">＋ Додати автомобіль</button>':'')+
 '<div class="cards">'+[['Усього авто',counts.total],['Справні',counts.ready],['Потребують ремонту',counts.repair],['Недоступні',counts.unavailable]].map(([name,value])=>'<div class="card stat"><div class="muted small">'+name+'</div><div class="number">'+value+'</div></div>').join('')+'</div>'+
 '<div class="toolbar mt">'+searchBar()+'<div class="row" style="flex-wrap:wrap;gap:6px">'+[['all','Усі'],['ready','Справні'],['repair','Потребують ремонту'],['unavailable','Недоступні']].map(([value,label])=>'<button class="btn tiny secondary" aria-pressed="'+(condition===value)+'" data-action="fleet-condition" data-value="'+value+'">'+label+'</button>').join('')+'</div>'+exportButton('vehicles')+'</div>'+
 (list.length?'<div class="grid3 mt">'+cards+'</div>':empty('Автомобілів не знайдено','Додайте транспорт або змініть фільтри.'));
}
async function groupPage(route){const mods=groupRoutes[route],active=state.sub[route]||mods[0];if(route==='discipline'&&!can('discipline:manage'))return intro('Доступ заборонено');return grouped(mods)+await renderModule(active);}

function captCalendar(schedule){
  const selected=state.captMonth||new Date().toISOString().slice(0,7);
  const [year,month]=selected.split('-').map(Number);
  const first=new Date(year,month-1,1);
  const length=new Date(year,month,0).getDate();
  const offset=(first.getDay()+6)%7;
  const byDate=new Map();
  for(const item of schedule){
    const day=String(item.starts_at||'').slice(0,10);
    if(!day.startsWith(selected+'-'))continue;
    if(!byDate.has(day))byDate.set(day,[]);
    byDate.get(day).push(item);
  }
  const days=['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  let cells=days.map(x=>'<div class="capt-weekday">'+x+'</div>').join('');
  for(let i=0;i<offset;i++)cells+='<div class="capt-day muted capt-blank" aria-hidden="true"></div>';
  for(let day=1;day<=length;day++){
    const key=selected+'-'+String(day).padStart(2,'0');
    const entries=(byDate.get(key)||[]).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
    const events=entries.slice(0,3).map(rec=>
      '<button type="button" class="capt-calendar-event '+(rec.module==='capt_matches'?'capt-match-event':'capt-training-event')+'" data-action="view-record" data-id="'+esc(rec.id)+'" data-module="'+rec.module+'" title="'+esc(rec.title)+'">'
       +esc(rec.starts_at.slice(11,16))+' '+esc(rec.title)+'</button>').join('');
    cells+='<div class="capt-day"><strong>'+day+'</strong>'+events+(entries.length>3?'<span class="small muted">+'+(entries.length-3)+' події</span>':'')+'</div>';
  }
  return '<section class="card capt-calendar"><div class="card-head"><h3>Календар CAPT</h3><div class="row"><button class="btn tiny ghost" data-action="capt-month" data-offset="-1" aria-label="Попередній місяць">‹</button><strong>'+esc(first.toLocaleDateString('uk-UA',{month:'long',year:'numeric'}))+'</strong><button class="btn tiny ghost" data-action="capt-month" data-offset="1" aria-label="Наступний місяць">›</button></div></div><div class="capt-calendar-scroll"><div class="capt-days">'+cells+'</div></div></section>';
}
async function captPage(){
  const d=await api('/capt/overview');
  const canManage=can('capt:manage'),canPay=can('finance:manage');
  const schedule=[...d.matches.map(r=>({...r,kind:'Бій',module:'capt_matches'})),...d.trainings.map(r=>({...r,kind:'Тренування',module:'capt_training'}))];
  const upcoming=schedule.filter(r=>r.starts_at&&new Date(r.starts_at).getTime()>=Date.now()&&!['Відхилено','Завершено'].includes(r.status))
    .sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,6);
  const results=d.matches.filter(r=>String(r.extra?.result||'').trim()||['win','loss','draw'].includes(r.extra?.outcome)).slice(0,8);
  const pending=d.attendance.filter(r=>r.status==='Погоджено'&&r.paid===false);
  const notices=d.rates?'<div class="notice mb">Ставки CAPT: AFK — <strong>'+fmt(d.rates.afk)+'</strong>, бій — <strong>'+fmt(d.rates.battle)+'</strong> (ігрова валюта). Лідер змінює ставки у «Налаштуваннях».</div>':'';
  const upcomingRows=upcoming.map(r=>'<div class="capt-line"><div><strong>'+esc(r.title)+'</strong><div class="small muted">'+esc(r.kind)+' · '+esc(r.starts_at.replace('T',' '))+(r.extra?.opponent?' · '+esc(r.extra.opponent):'')+'</div></div><button class="btn tiny secondary" data-action="view-record" data-id="'+esc(r.id)+'" data-module="'+r.module+'">Відкрити</button></div>').join('')||empty('Поки немає запланованих боїв або тренувань');
  const resultRows=results.map(r=>'<div class="capt-line"><div><strong>'+esc(r.title)+'</strong><div class="small muted">'+esc(r.extra?.opponent||'Суперника не вказано')+' · '+date(r.starts_at||r.created_at)+'</div></div><span class="capt-result">'+esc((({win:'Перемога',loss:'Поразка',draw:'Нічия',cancelled:'Скасовано'})[r.extra?.outcome]||'')+(r.extra?.result?' · '+r.extra.result:''))+'</span></div>').join('')||empty('Результатів ще немає');
  const attendRows=[...d.attendance].sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(0,8).map(r=>
    '<div class="capt-line"><div><strong>'+esc(userName(r.assignee_id||r.owner_id))+'</strong><div class="small muted">'+esc(r.title)+' · '+(r.extra?.attendance_type==='afk'?'AFK':'Бій')+' · '+date(r.created_at)+'</div></div><div class="capt-actions">'+badge(r.status)+(r.paid===true?'<span class="pill">Виплачено</span>':r.paid===false&&r.status==='Погоджено'?'<span class="pill">До виплати</span>':'')+'<button class="btn tiny secondary" data-action="view-record" data-id="'+esc(r.id)+'" data-module="capt_attendance">Деталі</button></div></div>').join('')||empty('Відвідувань ще не записано');
  const stats=[['Бої',d.matches.length,'◎'],['Тренування',d.trainings.length,'◉'],
    [canManage?'Записи відвідування':'Мої відвідування',d.attendance.length,'♟'],
    [canPay?'Погоджено, не виплачено':'Погоджені відвідування',canPay?pending.length:d.attendance.filter(r=>r.status==='Погоджено').length,'₴']];
  const statCards=stats.map(row=>'<div class="card stat"><span class="stat-symbol">'+row[2]+'</span><div class="muted small">'+esc(row[0])+'</div><div class="number">'+fmt(row[1])+'</div></div>').join('');
  const resultsStats=d.results||{wins:0,losses:0,draws:0,played:0,win_rate:0};
  const outcomeCards=[['Перемоги',resultsStats.wins],['Поразки',resultsStats.losses],['Нічиї',resultsStats.draws],['Відсоток перемог',resultsStats.win_rate+'%']].map(([label,value])=>'<div class="card stat"><div class="muted small">'+esc(label)+'</div><div class="number">'+esc(value)+'</div></div>').join('');
  return intro('CAPT — командний склад','Планування боїв, відвідування, результати та контроль виплат.',
       canManage?'<button class="btn" data-action="new-record" data-module="capt_matches">＋ Запланувати бій</button>':'<button class="btn" data-action="new-record" data-module="capt_attendance">＋ Моя участь</button>')
    +'<div class="cards">'+statCards+'</div>'+'<div class="cards capt-scorecards">'+outcomeCards+'</div>' +captCalendar(schedule)+notices
    +'<div class="grid2 capt-grid"><div class="card"><div class="card-head"><h3>Найближчі бої та тренування</h3>'
    +(canManage?'<button class="btn tiny ghost" data-action="new-record" data-module="capt_training">＋ Тренування</button>':'')
    +'</div>'+upcomingRows+'</div><div class="card"><div class="card-head"><h3>Останні результати боїв</h3></div>'+resultRows+'</div></div>'
    +'<div class="card capt-attendance-card"><div class="card-head"><h3>Відвідуваність та виплати</h3><button class="btn tiny ghost" data-action="change-sub" data-value="capt_attendance">Усі записи</button></div>'+attendRows+'</div>'
    +'<div class="notice mb">Нарахування CAPT можливе після погодження відвідування. Повторну виплату за тим самим записом система блокує.</div>'
    +grouped(groupRoutes.capt)+await renderModule(state.sub.capt||groupRoutes.capt[0]);
}

async function applications(){
  if(state.filter&&!applicationStatuses.includes(state.filter))state.filter='';
  const all=(await api('/applications')).items;
  const counts=Object.fromEntries(applicationStatuses.map(st=>[st,all.filter(a=>a.status===st).length]));
  const list=applyFilters(all.filter(x=>searchMatch(x.nickname,x.game_id,x.status)));
  const stats='<div class="row wrap mb">'+applicationStatuses.map(st=>'<span class="pill">'+esc(st)+': <strong>'+counts[st]+'</strong></span>').join('')+'</div>';
  return `${intro('Заявки на вступ','Три стани: очікує, прийнято, відхилено. Нові заявки не створюють акаунтів.')}
    ${stats}<div class="toolbar">${searchBar()}${filterControls(applicationStatuses)}${exportButton('applications')}<span class="muted small">${list.length} заявок</span></div>
    ${table(['Кандидат','Досвід','Статус','Дата','Дії'],list.map(a=>`<tr><td class="table-title">${esc(a.nickname)}<div class="muted">ID: ${esc(a.game_id)} · ${esc(a.discord||'Без Discord')}</div></td><td class="wordwrap">${esc(a.experience.slice(0,80))}</td><td>${badge(a.status)}</td><td>${date(a.created_at)}</td><td><button class="btn tiny secondary" data-action="review-app" data-id="${esc(a.id)}">${a.status==='Очікує'?'Розглянути':'Переглянути'}</button></td></tr>`))}`;
}
async function appReview(id){
  const app=(await api('/applications')).items.find(a=>a.id===id);
  if(!app)return;
  modal('Заявка · '+app.nickname,`<div class="stack"><div class="card flat">
      <div><strong>Ігровий ID: ${esc(app.game_id)}</strong></div>
      <div>Discord: ${esc(app.discord||'—')}</div>
      <div>Досвід: ${esc(app.experience)}</div>
      <div class="hr"></div><div class="longtext">${esc(app.motivation)}</div>
    </div><form id="app-review-form" data-id="${esc(id)}" class="stack">
      <div class="field"><label>Рішення щодо заявки</label><select class="select" name="status">${applicationStatuses.map(st=>`<option ${st===app.status?'selected':''}>${st}</option>`).join('')}</select></div>
      ${field('Коментар рекрутера','comment',app.comment,'textarea',true)}
      <button class="btn" type="submit">Зберегти статус</button>
    </form><div class="notice">Статус «Прийнято» не створює акаунт. Лідер видає дані доступу окремо.</div></div>`);
}
async function contracts(){
 const contracts=(await api('/contracts')).items;
 const filter=state.contractStatus||'all';
 const deptFilter=state.contractDepartment||'all';
 const scoped=contracts.filter(x=>deptFilter==='all'||(deptFilter==='none'?!x.department_id:x.department_id===deptFilter));
 const list=applyFilters(scoped.filter(x=>searchMatch(x.title,x.status,x.details)&&(
   filter==='all'||(filter==='settled'&&!!x.settled_at)||(filter==='open'&&!x.settled_at)||
   (filter==='approved'&&x.status==='Погоджено'&&!x.settled_at))));
 const recentlyCreated=scoped.filter(x=>Date.parse(x.created_at||'')>=Date.now()-30*86400000);
 const needsAction=scoped.filter(x=>x.status==='Погоджено'&&!x.settled_at);
 const totals=[['Усього контрактів',scoped.length],['Загальна сума',fmt(scoped.reduce((n,x)=>n+Number(x.amount||0),0))],['Нараховано',scoped.filter(x=>x.settled_at).length],['Очікують нарахування',needsAction.length]];
 const activityLine='<div class="notice mb"><strong>Останні 30 днів:</strong> '+fmt(recentlyCreated.length)+' нових контрактів · оборот '+fmt(recentlyCreated.reduce((n,x)=>n+Number(x.amount||0),0))+' · погоджено до нарахування '+fmt(needsAction.length)+'</div>';
 const statuses=[['all','Усі'],['open','Не нараховані'],['approved','Готові до виплат'],['settled','Нараховані']];
 const buttons=statuses.map(([key,name])=>'<button type="button" class="btn tiny secondary" data-action="contract-filter" data-value="'+key+'" aria-pressed="'+(filter===key)+'">'+name+'</button>').join('');
 const rows=list.map(x=>{
  const settled=!!x.settled_at,people=(x.participant_ids||[]).map(id=>userName(id)).join(', ');
  return '<tr><td class="table-title"><strong>'+esc(x.title)+'</strong><div class="muted small">'+esc((x.details||'').slice(0,110))+'</div><div class="muted small">Створив: '+esc(userName(x.owner_id))+' · '+esc(String(x.created_at||'').slice(0,10))+'</div></td>'+
   '<td><span class="muted small">'+esc(departmentName(x.department_id))+'</span></td>'+'<td class="mono">'+fmt(x.amount)+'</td>'+
   '<td><strong>'+x.participant_ids.length+'</strong><div class="muted small">'+esc(people||'Не визначено')+'</div></td>'+
   '<td>'+esc(String(x.treasury_percent))+'%</td>'+
   '<td>'+badge(settled?'Нараховано':x.status)+'</td>'+
   '<td><button class="btn tiny secondary" data-action="view-contract" data-id="'+esc(x.id)+'">Переглянути ↗</button></td></tr>';
 });
 return intro('Контракти GRIZZLY','Спільний реєстр контрактів. Усі учасники бачать суми та розподіл; фінансові дії виконує тільки керівництво.',can('finance:manage')?'<button class="btn" data-action="new-contract">＋ Новий контракт</button>':'')+
 '<div class="cards">'+totals.map(([name,value])=>'<div class="card stat"><div class="muted small">'+esc(name)+'</div><div class="number" style="font-size:clamp(19px,2vw,30px)">'+value+'</div></div>').join('')+'</div>'+
 activityLine+
 '<div class="notice mt mb">Розподіл: відсоток контракту надходить до скарбниці, залишок порівну між учасниками; округлення додається до скарбниці. Нарахування здійснюється один раз після погодження.</div>'+
 '<div class="toolbar mt">'+searchBar()+'<select class="select" id="contract-department-filter" aria-label="Підрозділ контракту"><option value="all">Усі підрозділи</option><option value="none" '+(deptFilter==='none'?'selected':'')+'>Без підрозділу</option>'+state.departments.map(d=>'<option value="'+esc(d.id)+'" '+(deptFilter===d.id?'selected':'')+'>'+esc(d.title)+'</option>').join('')+'</select><div class="row" style="flex-wrap:wrap;gap:6px">'+buttons+'</div><span class="muted small">Знайдено: '+list.length+'</span>'+exportButton('contracts')+'</div>'+
 (list.length?'<div class="contract-desktop-table">'+table(['Контракт','Підрозділ','Сума','Учасники','Казна','Статус','Дія'],rows)+'</div><div class="contract-mobile-list">'+list.map(x=>'<article class="card contract-mobile-card"><div class="row space"><strong>'+esc(x.title)+'</strong>'+badge(x.settled_at?'Нараховано':x.status)+'</div><div class="muted small mt">'+esc((x.details||'').slice(0,130))+'</div><div class="muted small mt">Створив: '+esc(userName(x.owner_id))+' · '+esc(String(x.created_at||'').slice(0,10))+'</div><div class="row space mt"><span class="muted small">Сума</span><strong>'+fmt(x.amount)+'</strong></div><div class="row space"><span class="muted small">Учасники</span><strong>'+x.participant_ids.length+'</strong></div><div class="row space"><span class="muted small">До казни</span><strong>'+esc(String(x.treasury_percent))+'%</strong></div><button class="btn tiny secondary mt" data-action="view-contract" data-id="'+esc(x.id)+'">Переглянути контракт</button></article>').join('')+'</div>':empty('Контрактів не знайдено','Змініть пошук або фільтри.'));
}
async function contractForm(id){const old=id?(await api('/contracts')).items.find(c=>c.id===id):null;const s=await api('/settings');const c=old||{participant_ids:[],treasury_percent:s.items.treasury_percent||20};const checks=state.users.map(u=>`<label class="row small" style="gap:7px"><input type="checkbox" name="participant" value="${esc(u.id)}" ${c.participant_ids.includes(u.id)?'checked':''}>${esc(u.nickname||u.username)} (${esc(u.username)})</label>`).join('')||empty('Додайте учасників спочатку');modal(old?'Редагувати контракт':'Новий контракт',`<form id="contract-form" data-id="${esc(id||'')}" class="formgrid">${field('Назва *','title',c.title,'text',true,'required')}${field('Опис','details',c.details,'textarea',true)}${field('Сума (ціле число)','amount',c.amount??0,'number',false,'required min="0" step="1"')}${field('Відсоток казни','treasury_percent',c.treasury_percent,'number',false,'min="0" max="100"')}${statusField(c.status||'Заплановано')}${selectField('Підрозділ контракту','department_id',[{id:'',title:'Загальний / без підрозділу'},...state.departments],c.department_id||'',true)}<div class="field full"><label>Учасники контракту *</label><div class="card flat stack" style="max-height:220px;overflow:auto">${checks}</div></div>${field('Докази ImgBB (за рядками)','evidence',(c.evidence||[]).join('\n'),'textarea',true)}<div class="full form-actions"><button class="btn" type="submit">Зберегти контракт</button></div></form>`);}
async function contractView(id){const c=(await api('/contracts')).items.find(x=>x.id===id);if(!c)return;const p=(await api(`/contracts/${id}/preview`)).preview;modal('Контракт · '+c.title,`<div class="stack"><div class="row space">${badge(c.status)}<span class="muted small">Версія: ${c.version}</span></div><p class="longtext">${esc(c.details)}</p><div class="grid2"><div class="card flat"><div class="muted small">Загальна сума</div><h2>${fmt(p.amount)}</h2></div><div class="card flat"><div class="muted small">Казна (${p.treasury_percent}%)</div><h2>${fmt(p.treasury)}</h2></div><div class="card flat"><div class="muted small">На учасника (${p.participants})</div><h2>${fmt(p.per_member)}</h2></div><div class="card flat"><div class="muted small">Залишок округлення → казна</div><h2>${fmt(p.rounding_remainder)}</h2></div></div><div class="card flat"><h3>Розподіл</h3><div class="stack mt">${p.allocations.map(a=>`<div class="row space small"><span>${esc(userName(a.user_id))}</span><strong>${fmt(a.amount)}</strong></div>`).join('')}</div></div>${links(c)}${c.settled_at?'<div class="notice">Нарахування проведене. Звичайне редагування заблоковано; для помилкових нульових виплат лідер може скористатися контрольованим коригуванням.</div>':''}${can('finance:manage')?`<div class="form-actions">${c.settled_at&&state.user.role==='leader'?`<button class="btn secondary" data-action="contract-correction-open" data-id="${c.id}">Коригувати нарахування</button>`:''}${!c.settled_at?`<button class="btn secondary" data-action="edit-contract" data-id="${c.id}">Редагувати</button>`:''}${c.status==='Погоджено'&&!c.settled_at?`<button class="btn" data-action="settle-contract" data-id="${c.id}" data-version="${c.version}">✓ Підтвердити нарахування</button>`:''}</div>`:''}</div>`);}
function contractCorrectionForm(id){
 const c=state.contractCorrectionRecord;
 if(state.user?.role!=='leader'||!c||c.id!==id||!c.settled_at)throw new Error('Недостатньо прав або контракт не проведено');
 modal('Коригування проведеного контракту','<div class="notice mb">Тільки для помилкових нарахувань з нульовими виплатами. Перед зміною перевірте фактичні передачі грошей. Старі позначки «Видано» для нульових сум будуть скинуті.</div>'+
  '<form id="contract-correction-form" data-id="'+esc(id)+'" data-version="'+c.version+'" class="stack">'+
  '<div class="small">Контракт: <strong>'+esc(c.title)+'</strong> · Поточна сума: <strong>'+fmt(c.amount)+'</strong></div>'+
  field('Правильна сума контракту','amount',c.amount,'number',true,'required min="1" step="1"')+
  field('Причина коригування (мінімум 10 символів)','reason','','textarea',true,'required minlength="10"')+
  '<div id="contract-correction-preview" class="card flat muted small">Спочатку перегляньте розрахунок.</div>'+
  '<div class="form-actions"><button class="btn secondary" type="button" data-action="contract-correction-preview">Попередній розрахунок</button>'+
  '<button class="btn" type="button" data-action="contract-correction-save" disabled>Підтвердити коригування</button></div></form>');
}
function financeTrendHtml(data){
  const weeks=data.weeks||[],members=data.members||[];
  const period=state.financeTrendPeriod||'12w',tab=state.financeTrendTab||'chart',hideEmpty=state.financeHideEmpty!==false;
  const filtered=hideEmpty?weeks.filter(w=>w.income||w.expenses||w.earned):weeks;
  const types=[['7','7 днів'],['30','30 днів'],['90','3 місяці'],['12w','12 тижнів'],['all','Увесь час']];
  const tabs=[['chart','Графік'],['history','Тижнева історія'],['members','Учасники']];
  const pills=arr=>arr.map(([id,label])=>'<button class="btn tiny secondary" data-action="'+(arr===types?'finance-trend-period':'finance-trend-tab')+'" data-value="'+id+'" aria-pressed="'+(arr===types?period===id:tab===id)+'">'+label+'</button>').join('');
  const emptyText='<p class="muted small">За вибраний період фінансових операцій або контрактних виплат немає.</p>';
  const max=Math.max(1,...filtered.flatMap(w=>[w.income,w.expenses]));
  const line=(amount,color)=>'<span style="display:block;height:9px;border-radius:4px;background:'+color+';width:'+Math.max(0,Math.min(100,amount*100/max))+'%"></span>';
  const barChart=filtered.map(w=>'<div style="display:grid;grid-template-columns:85px minmax(0,1fr) 130px;gap:10px;align-items:center;margin:9px 0"><span class="muted small">'+esc(w.week_start)+'</span><div style="display:grid;gap:3px">'+line(w.income,'#3d9c86')+line(w.expenses,'#db4d5d')+'</div><span class="mono small">'+fmt(w.income)+' / '+fmt(w.expenses)+'</span></div>').join('');
  const balances=filtered.map(w=>Number(w.balance)||0);
  const lower=Math.min(0,...balances,Number(data.opening_balance)||0),upper=Math.max(1,...balances,Number(data.opening_balance)||0);
  const balanceBars=filtered.map(w=>{
    const level=(Number(w.balance)-lower)/(upper-lower)*100;
    return '<div style="display:grid;grid-template-columns:85px minmax(0,1fr) 110px;gap:10px;align-items:center;margin:6px 0"><span class="muted small">'+esc(w.week_start)+'</span><div style="height:9px;border-radius:4px;background:rgba(150,160,175,.16)"><span style="display:block;height:100%;width:'+Math.max(1,level)+'%;background:#7a9ac9;border-radius:4px"></span></div><span class="mono small">'+fmt(w.balance)+'</span></div>';
  }).join('');
  const history=table(['Тиждень','Надходження','Витрати','Зміна','Баланс'],filtered.map(w=>'<tr><td>'+esc(w.week_start)+'</td><td class="mono">'+fmt(w.income)+'</td><td class="mono">'+fmt(w.expenses)+'</td><td class="mono">'+fmt(w.net)+'</td><td class="mono">'+fmt(w.balance)+'</td></tr>'));
  const term=String(state.financeMemberSearch||'').trim().toLocaleLowerCase('uk');
  const matched=members.filter(m=>(m.nickname||m.username||'').toLocaleLowerCase('uk').includes(term));
  const stats=table(['Учасник','Нараховано','Видано','Виплат','Активних тижнів'],matched.map(m=>'<tr><td>'+esc(m.nickname||m.username)+'</td><td class="mono">'+fmt(m.earned)+'</td><td class="mono">'+fmt(m.handed_over)+'</td><td>'+Number(m.payout_count)+'</td><td>'+m.weekly.filter(v=>v>0).length+'</td></tr>'));
  const chartHtml=filtered.length?'<p class="muted small">Зелений — надходження, червоний — витрати (GTA$).</p>'+barChart+'<h3 class="mt">Накопичений баланс скарбниці</h3><p class="muted small">Враховано початковий баланс до обраного періоду.</p>'+balanceBars:emptyText;
  const historyHtml=filtered.length?history:emptyText;
  const memberHtml='<label class="muted small">Пошук за ніком <input class="input" id="finance-member-search" placeholder="Введіть нік" value="'+esc(state.financeMemberSearch||'')+'"></label><button class="btn tiny secondary" data-action="finance-member-search">Знайти</button>'+(matched.length?stats:'<p class="muted small">За вибраний період контрактних виплат немає або пошук не дав результатів.</p>');
  return '<div class="card mt"><div class="card-head"><h3>Фінансова динаміка</h3></div><div class="row" style="flex-wrap:wrap;gap:6px">'+pills(types)+'</div><div class="row mt" style="flex-wrap:wrap;gap:6px">'+pills(tabs)+'</div><p class="muted small mt">Період від '+esc(data.from.slice(0,10))+' · '+esc(data.to.slice(0,10))+'</p>'+(tab!=='members'?'<label class="muted small"><input type="checkbox" id="finance-hide-empty" '+(hideEmpty?'checked':'')+'> Приховати порожні тижні</label><button class="btn tiny secondary" data-action="finance-empty-toggle">Застосувати</button>':'')+'<div class="mt">'+(tab==='chart'?chartHtml:tab==='history'?historyHtml:memberHtml)+'</div></div>';
}
function financeOutstandingHtml(data){
  const people=Array.isArray(data.people)?data.people:[];
  const items=table(['Учасник','Не видано','Нарахувань','Найдавніше'],people.map(p=>'<tr><td>'+esc(p.nickname||p.username)+'</td><td class="mono">'+fmt(p.amount)+'</td><td>'+Number(p.count)+'</td><td>'+date(p.oldest)+'</td></tr>'));
  return '<div class="card mt"><div class="card-head"><h3>Невидані контрактні виплати</h3></div><div class="grid3"><div><span class="muted small">Очікують видачі</span><h3 class="mono">'+fmt(data.amount)+'</h3></div><div><span class="muted small">Кількість нарахувань</span><h3 class="mono">'+Number(data.count)+'</h3></div><div><span class="muted small">Найдавніша невидана виплата</span><h3>'+ (data.oldest?date(data.oldest):'—') +'</h3></div></div><p class="muted small mt">Це вже нараховані гроші, які ще не позначені як фактично передані в GTA RP. Баланс скарбниці від цього показника не змінюється.</p>'+(people.length?items:'<p class="muted small">Усі нараховані контрактні виплати видані або нарахувань ще немає.</p>')+'</div>';
}
function financeAnalyticsHtml(data){
  const r=data.report;
  const metric=(label,value)=>'<div><span class="muted small">'+esc(label)+'</span><h3 class="mono">'+fmt(value)+'</h3></div>';
  const members=table(['Учасник','Зароблено','Видано','Виплат'],data.leaderboard.map((x,i)=>'<tr><td>'+esc((i+1)+'. '+(x.nickname||x.username))+'</td><td class="mono">'+fmt(x.earned)+'</td><td class="mono">'+fmt(x.handed_over)+'</td><td>'+Number(x.payout_count)+'</td></tr>'));
  const contracts=table(['Контракт','Сума','Учасникам','Казна','Видано'],data.contracts.map(x=>'<tr><td>'+esc(x.title)+'</td><td class="mono">'+fmt(x.amount)+'</td><td class="mono">'+fmt(x.member_total)+'</td><td>'+Number(x.treasury_percent)+'%</td><td>'+Number(x.confirmed_count)+'/'+Number(x.payout_count)+'</td></tr>'));
  return '<div class="card mt"><div class="card-head"><h3>Аналітика контрактів і заробітку</h3><div class="row"><button class="btn tiny secondary" data-action="finance-period" data-days="7">7 днів</button><button class="btn tiny secondary" data-action="finance-period" data-days="30">30 днів</button><button class="btn tiny secondary" data-action="finance-report-csv">↓ Звіт CSV</button></div></div><p class="muted small">Звіт за останні '+r.days+' днів. Зароблено — нараховано; видано — підтверджено передачу в GTA RP.</p><div class="grid3 mt">'+metric('Контракти з виплатами',r.contracts_count)+metric('Заробіток учасників',r.member_earned)+metric('Фактично видано',r.member_handed_over)+metric('Надходження казни',r.treasury_income)+metric('Витрати',r.expenses)+metric('Зміна казни',r.net_change)+'</div><h3 class="mt">Рейтинг заробітку</h3>'+members+'<h3 class="mt">Статистика контрактів</h3>'+contracts+'</div>';
}
async function finance(){const f=await api('/finance');const allowed=can('finance:read')||can('finance:manage');const analytics=allowed?await api('/finance/analytics?days='+(state.financeDays||7)):null;const trends=allowed?await api('/finance/trends?period='+(state.financeTrendPeriod||'12w')):null;const outstanding=allowed?await api('/finance/outstanding'):null;return `${intro('Фінанси та виплати','Загальна статистика казни та власні виплати. Фінансові операції доступні лише керівництву.',can('finance:manage')?'<button class="btn" data-action="new-ledger">＋ Додати операцію</button>':'')}<div class="cards"><div class="card stat"><div class="muted small">Мої виплати</div><div class="number">${fmt(f.own_total)}</div></div>${`<div class="card stat"><div class="muted small">Баланс казни</div><div class="number">${fmt(f.treasury_balance)}</div></div><div class="card stat"><div class="muted small">Виплати за контрактами</div><div class="number">${fmt(f.payout_total)}</div></div><div class="card stat"><div class="muted small">Внески</div><div class="number">${fmt(f.totals.contribution||0)}</div></div>`}</div>${f.contract_summary?`<div class="card mt"><div class="card-head"><div><h3>Контракти → фінанси</h3><p class="muted small">Суми синхронізуються з реєстром контрактів автоматично.</p></div><button class="btn tiny secondary" data-route="contracts">Відкрити контракти ↗</button></div><div class="grid3 mt"><div><span class="muted small">Усього контрактів</span><h3 class="mono">${fmt(f.contract_summary.contracts_count)}</h3></div><div><span class="muted small">Сума всіх контрактів</span><h3 class="mono">${fmt(f.contract_summary.contracts_total)}</h3></div><div><span class="muted small">Проведено контрактів</span><h3 class="mono">${fmt(f.contract_summary.settled_total)}</h3><span class="muted small">${fmt(f.contract_summary.settled_count)} контрактів</span></div><div><span class="muted small">Ще не нараховано</span><h3 class="mono">${fmt(f.contract_summary.unsettled_total)}</h3></div><div><span class="muted small">Погоджено, очікує нарахування</span><h3 class="mono">${fmt(f.contract_summary.approved_pending_total)}</h3><span class="muted small">${fmt(f.contract_summary.approved_pending_count)} контрактів</span></div></div><div class="notice mt">Сума контрактів — це оборот, а не баланс казни. До казни зараховується лише її частка після підтвердження нарахування. Виплати учасникам не списуються з казни повторно.</div></div>`:''}${f.month?`<div class="card mt"><div class="card-head"><h3>Фінансовий звіт · останні 30 днів</h3><span class="muted small">Показники казни й нарахування за період</span></div><div class="grid3 mt"><div><span class="muted small">Контракти → казна</span><h3 class="mono">+${fmt(f.month.contract_treasury)}</h3></div><div><span class="muted small">Внески</span><h3 class="mono">+${fmt(f.month.contributions)}</h3></div><div><span class="muted small">Витрати</span><h3 class="mono">−${fmt(f.month.expenses)}</h3></div><div><span class="muted small">Премії та CAPT</span><h3 class="mono">−${fmt(f.month.bonuses+f.month.capt)}</h3></div><div><span class="muted small">Зміна казни</span><h3 class="mono">${fmt(f.month.treasury_change)}</h3></div><div><span class="muted small">Нарахування учасникам за контрактами</span><h3 class="mono">${fmt(f.month.contract_payouts)}</h3><span class="muted small">${f.month.contract_payout_count} виплат</span></div></div><div class="notice mt">Контрактні виплати показані окремо: вони розподіляються з суми контракту й не списуються повторно з казни.</div></div>` :''}<div class="grid2 mt"><div class="card"><div class="card-head"><h3>Мої контрактні виплати</h3></div>${table(['Контракт','Сума','Дата'],f.own_payouts.map(p=>`<tr><td class="table-title">${esc(p.contract_title)}</td><td class="mono success">+${fmt(p.amount)}</td><td>${date(p.created_at)}</td></tr>`))}</div><div class="card"><div class="card-head"><h3>CAPT та премії</h3></div>${table(['Тип','Сума','Дата'],(f.own_extra||[]).map(p=>`<tr><td>${p.kind==='capt'?'CAPT':'Премія'}<div class="muted">${esc(p.description)}</div></td><td class="mono success">+${fmt(p.amount)}</td><td>${date(p.created_at)}</td></tr>`))}</div></div>${allowed?`<div class="card mt"><div class="card-head"><h3>Журнал казни</h3><button class="btn tiny secondary" data-action="view-ledger">Відкрити</button></div><div class="grid3">${Object.entries(f.totals).map(([k,v])=>`<div><span class="muted small">${esc(({treasury:'Контракти → казна',contribution:'Внески',expense:'Витрати',bonus:'Премії',capt:'CAPT'})[k]||k)}</span><h3 class="mono">${fmt(v)}</h3></div>`).join('')}</div></div>${allowed?`<div class="card mt"><div class="card-head"><h3>Видача контрактних виплат у грі</h3></div><p class="muted small">Нараховано ≠ фактично видано. Підтверджуйте лише після передачі грошей.</p>${table(['Контракт','Учасник','Сума','Нараховано','Стан','Дія'],(f.payment_rows||[]).map(p=>`<tr><td>${esc(p.contract_title)}</td><td>${esc(userName(p.user_id))}</td><td class="mono">${fmt(p.amount)}</td><td>${date(p.created_at)}</td><td>${p.confirmed_at?badge('Видано'):badge('Очікує')}</td><td>${p.confirmed_at?esc(userName(p.confirmed_by)):can('finance:manage')?`<button class="btn tiny secondary" data-action="confirm-payout" data-id="${esc(p.id)}">Підтвердити видачу</button>`:'—'}</td></tr>`))}</div>`:''}`:''}${outstanding?financeOutstandingHtml(outstanding):''}${analytics?financeAnalyticsHtml(analytics):''}${trends?financeTrendHtml(trends):''}`;}
function financeRows(rows){const k=state.ledgerKind||'all',d=state.ledgerDays||'all',since=d==='all'?0:Date.now()-Number(d)*86400000;return rows.filter(r=>(k==='all'||r.kind===k)&&(!since||Date.parse(r.created_at)>=since));}
function financeCsv(rows){const q=v=>'"'+String(v??'').replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';const data=[['Дата','Тип','Сума GTA$','Отримувач','Відповідальний','Опис'],...rows.map(r=>[r.created_at,r.kind,r.amount,userName(r.recipient_id),userName(r.actor_id),r.description])];const blob=new Blob(['\uFEFF'+data.map(x=>x.map(q).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='grizzly-finance-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
async function ledgerModal(){const all=(await api('/ledger')).items,rows=financeRows(all);const opts=(values,selected)=>values.map(([v,label])=>'<option value="'+v+'" '+(v===selected?'selected':'')+'>'+label+'</option>').join('');const kinds=[['all','Усі'],['treasury','Контракти'],['contribution','Внески'],['expense','Витрати'],['bonus','Премії'],['capt','CAPT']],periods=[['all','Увесь журнал'],['1','24 години'],['7','7 днів'],['30','30 днів'],['90','90 днів']];modal('Журнал фінансових операцій',`<div class="toolbar"><label>Тип <select class="select" id="ledger-kind">${opts(kinds,state.ledgerKind||'all')}</select></label><label>Період <select class="select" id="ledger-days">${opts(periods,state.ledgerDays||'all')}</select></label><button class="btn tiny secondary" data-action="ledger-filter">Застосувати</button><button class="btn tiny secondary" data-action="ledger-csv">↓ CSV</button></div><p class="muted small">Показано ${rows.length} із ${all.length} останніх операцій.</p>${table(['Дата','Тип','Сума','Кому','Відповідальний','Опис'],rows.map(r=>`<tr><td>${date(r.created_at)}</td><td>${esc(r.kind)}</td><td class="mono">${fmt(r.amount)}</td><td>${esc(userName(r.recipient_id))}</td><td>${esc(userName(r.actor_id))}</td><td>${esc(r.description)}</td></tr>`))}`);}
function ledgerForm(){modal('Нова фінансова операція',`<form id="ledger-form" class="formgrid"><div class="field"><label>Тип операції</label><select class="select" name="kind"><option value="contribution">Внесок до казни</option><option value="expense">Витрата</option><option value="bonus">Премія учаснику</option><option value="capt">Виплата CAPT</option></select></div>${field('Сума','amount','0','number',false,'required min="1" step="1"')}${selectField('Отримувач (обов’язковий для премій та CAPT)','recipient_id',state.users,'',true)}${field('Підстава / коментар','description','','textarea',true)}<div class="notice full">CAPT-ставки змінюються керівником у налаштуваннях. Не дублюйте вже проведені виплати.</div><div class="full form-actions"><button class="btn" type="submit">Провести операцію</button></div></form>`);}
async function stats(){const s=await api('/stats');const leaderboard=(state.period==='month'?s.leaderboard_month:s.leaderboard_week)||s.leaderboard||[];return `${intro('Статистика сім’ї','Активність за останні 7 і 30 днів. Рейтинг враховує погоджені й завершені записи.')}<div class="grid2"><div class="card"><h3>За 7 днів</h3><div class="grid3 mt">${Object.entries(s.week).map(([k,v])=>`<div><span class="muted small">${esc(({tasks:'Завдання',reports:'Звіти',events:'Заходи',income:'Надходження'})[k])}</span><h2>${fmt(v)}</h2></div>`).join('')}</div></div><div class="card"><h3>За 30 днів</h3><div class="grid3 mt">${Object.entries(s.month).map(([k,v])=>`<div><span class="muted small">${esc(({tasks:'Завдання',reports:'Звіти',events:'Заходи',income:'Надходження'})[k])}</span><h2>${fmt(v)}</h2></div>`).join('')}</div></div></div><div class="card mt"><div class="card-head"><h3>Рейтинг активності</h3><select id="period-filter" class="select" style="width:auto"><option value="week" ${state.period==='week'?'selected':''}>За 7 днів</option><option value="month" ${state.period==='month'?'selected':''}>За 30 днів</option></select></div>${table(['Учасник','Завершено','Бали'],leaderboard.map((x,i)=>`<tr><td>${i+1}. ${esc(userName(x.user_id))}</td><td>${x.completed}</td><td class="mono">${x.points}</td></tr>`))}</div>`;}
async function auditPage(){const a=(await api('/audit')).items;return `${intro('Журнал змін','Хто, коли й що змінював. Доступ лише лідеру.')}<div class="toolbar">${searchBar()}</div>${table(['Дата','Користувач','Дія','Розділ','ID'],a.filter(x=>searchMatch(x.actor_name,x.action,x.entity,x.detail)).map(x=>`<tr><td>${esc(x.created_at.replace('T',' ').slice(0,19))}</td><td>${esc(x.actor_name)}</td><td>${esc(x.action)}<div class="muted">${esc(x.detail.slice(0,110))}</div></td><td>${esc(x.entity)}</td><td><span class="muted small">${esc(short(x.entity_id))}</span></td></tr>`))}`;}
async function settingsPage(){const response=await api('/settings');const s=response.items;state.settingsVersions=response.versions||{};const discord=state.user.role==='leader'?await api('/discord/status'):null;
if(discord)state.discordVersions=discord.versions||{};
let discordLogs=[],discordLogError='';
if(discord&&!discord.migrationRequired){
  try{discordLogs=(await api('/discord/deliveries')).items||[];}catch(e){discordLogError=e.message;}
}

const discordLabel=discord?.reason==='missing'?'Секрет відсутній':discord?.reason==='invalid'?'Некоректний URL':discord?.configured?'Секрет знайдено':'Не підключено';
const discordHelp=discord?.reason==='missing'?
 'Worker famaly не бачить DISCORD_WEBHOOK_URL. У Cloudflare відкрий Workers & Pages → famaly → Settings → Variables and Secrets → Add Secret → Deploy.':
 discord?.reason==='invalid'?
 'Секрет існує, але адреса неправильна. Потрібен повний URL виду https://discord.com/api/webhooks/ID/TOKEN без зайвих лапок, параметрів або стороннього домену.':
 'Секрет виявлено, але зв’язок ще не перевірений. Натисни «Надіслати тестове повідомлення».';
const discordNames={applications:'Нові заявки',decisions:'Рішення за заявками',events:'Опубліковані події',capt:'CAPT-оголошення',news:'Новини сім’ї',announcements:'Оголошення',test:'Тест webhook'};
const discordSettingsHtml=discord&&!discord.migrationRequired?
 '<form id="discord-preferences-form" class="gr-discord-settings">'+
 ['applications','decisions','events','capt','news','announcements'].map(k=>
   '<label class="gr-discord-switch"><span><strong>'+discordNames[k]+'</strong>'+
   '<small>'+(discord.lockedByEnvironment?.[k]?'Вимкнено у змінних Cloudflare.':'Керуй сповіщеннями без зміни Cloudflare.')+'</small></span>'+
   '<input type="checkbox" name="'+k+'" '+(discord.enabled?.[k]?'checked':'')+' '+(discord.lockedByEnvironment?.[k]?'disabled':'')+' aria-label="'+discordNames[k]+'"></label>'
 ).join('')+
 '<button class="btn secondary" type="submit">Зберегти перемикачі</button></form>':
 '<div class="notice mt">Для перемикачів і журналу потрібно застосувати нову міграцію D1: <strong>0003_discord_notifications.sql та 0004_discord_capt_news.sql та 0005_discord_announcements.sql</strong>. Сповіщення продовжать працювати з поточними налаштуваннями до міграції.</div>';
const discordRouteLabels={
  applications:'Заявки',decisions:'Рішення',events:'Події',
  capt:'CAPT',news:'Новини',announcements:'Оголошення'
};
const discordRouteSecrets={
  applications:'DISCORD_WEBHOOK_APPLICATIONS',decisions:'DISCORD_WEBHOOK_DECISIONS',
  events:'DISCORD_WEBHOOK_EVENTS',capt:'DISCORD_WEBHOOK_CAPT',
  news:'DISCORD_WEBHOOK_NEWS',announcements:'DISCORD_WEBHOOK_ANNOUNCEMENTS'
};
const discordRoutesHtml=discord?
 '<div class="gr-discord-routes"><h3>Окремі Discord-канали</h3>'+
 '<p class="muted small">Для CAPT, Новин і Оголошень потрібні три різні webhook. Перші три категорії можуть використовувати чинний основний webhook або власні секрети.</p>'+
 Object.keys(discordRouteLabels).map(kind=>{
   const route=discord.routes?.[kind]||{configured:false,reason:'missing'};
   const status=route.reason==='ready'?'Підключено':
     route.reason==='duplicate'?'Повторюється webhook':
     route.reason==='invalid'?'Некоректний URL':'Не підключено';
   return '<div class="gr-discord-route"><div><strong>'+discordRouteLabels[kind]+'</strong>'+
     '<small>Cloudflare Secret: <code>'+discordRouteSecrets[kind]+'</code></small></div>'+
     '<span class="gr-discord-route-status '+(route.configured?'is-ready':'is-missing')+'">'+status+'</span>'+
     '<button class="btn tiny secondary" type="button" data-action="discord-test-route" data-kind="'+kind+'" '+(route.configured?'':'disabled')+'>Тест каналу</button></div>';
 }).join('')+'</div>':'';
const appWebhookNames={
  application_waiting:'Очікує',
  application_accepted:'Прийнято',
  application_rejected:'Відхилено'
};
const appWebhookSecrets={
  application_waiting:'DISCORD_WEBHOOK_APPLICATIONS_WAITING',
  application_accepted:'DISCORD_WEBHOOK_APPLICATIONS_ACCEPTED',
  application_rejected:'DISCORD_WEBHOOK_APPLICATIONS_REJECTED'
};
const applicationWebhooksHtml=discord?
 '<div class="gr-discord-routes"><h3>Webhook за статусами заявок</h3>'+
 '<p class="muted small">Для трьох статусів можна вказати три різні Discord-канали. Якщо секрет не заданий, використовується старий webhook заявок або рішень — він позначений як «Загальний».</p>'+
 Object.keys(appWebhookNames).map(kind=>{
   const route=discord.applicationRoutes?.[kind]||{configured:false,reason:'missing'};
   const status=route.reason==='ready'?'Окремий підключено':
     route.reason==='legacy'?'Загальний webhook':
     route.reason==='duplicate'?'Webhook повторюється':
     route.reason==='invalid'?'Некоректний URL':'Не підключено';
   return '<div class="gr-discord-route"><div><strong>Заявка: '+appWebhookNames[kind]+'</strong>'+
     '<small>Cloudflare Secret: <code>'+appWebhookSecrets[kind]+'</code></small></div>'+
     '<span class="gr-discord-route-status '+(route.separate?'is-ready':'is-missing')+'">'+status+'</span>'+
     '<button class="btn tiny secondary" type="button" data-action="discord-test-route" data-kind="'+kind+'" '+(route.configured?'':'disabled')+'>Тест статусу</button></div>';
 }).join('')+'</div>':'';
const discordLogsHtml=discord&&!discord.migrationRequired?
 '<div class="gr-discord-log"><div class="row space wrap"><h3>Журнал доставки</h3><span class="muted small">Останні 100 відправлень</span></div>'+
 (discordLogError?'<div class="notice">'+esc(discordLogError)+'</div>':
 discordLogs.length?'<div class="gr-discord-log-scroll"><table class="gr-discord-table"><thead><tr><th>Дата</th><th>Тип</th><th>Результат</th><th>Помилка</th></tr></thead><tbody>'+
 discordLogs.map(e=>'<tr><td>'+esc(date(e.created_at))+'</td><td>'+esc(discordNames[e.kind]||e.kind)+'</td>'+
 '<td><span class="gr-discord-result '+(e.status==='sent'?'is-success':'is-error')+'">'+(e.status==='sent'?'Надіслано':'Помилка')+'</span></td>'+
 '<td>'+esc(e.status==='failed'?(e.http_status?'HTTP '+e.http_status:e.error_code==='network_error'?'Мережевий збій':'Помилка налаштувань'):'—')+'</td></tr>').join('')+
 '</tbody></table></div>':'<p class="muted small">Історія порожня. Натисни кнопку тесту або дочекайся нової заявки.</p>')+
 '</div>':'';
return `${intro('Налаштування Grizzly','Редагування публічного сайту, правил, Discord та фінансових параметрів.')}<div class="card"><form id="settings-form" class="formgrid">${field('Назва сім’ї','family_name',s.family_name)}${field('Гасло','tagline',s.tagline)}${field('Історія сім’ї','history',s.history,'textarea',true)}${field('Посилання Discord','discord_url',s.discord_url,'url',true,'placeholder="https://discord.gg/..."')}${field('Правила','rules',s.rules,'textarea',true)}${field('Вимоги до кандидатів','requirements',s.requirements,'textarea',true)}${field('Відсоток казни від контрактів','treasury_percent',s.treasury_percent,'number',false,'min="0" max="100"')}${field('CAPT — ставка AFK','capt_afk_rate',s.capt_afk_rate,'number',false,'min="0"')}${field('CAPT — ставка за бій','capt_battle_rate',s.capt_battle_rate,'number',false,'min="0"')}<div class="full form-actions"><button class="btn" type="submit">Зберегти налаштування</button></div></form></div>${discord?'<div class="card mt"><div class="card-head"><h3>Discord-сповіщення</h3><span class="pill">'+discordLabel+'</span></div>'+
    '<p class="muted small mt">Нові заявки, рішення, заходи, CAPT-оголошення, новини та звичайні оголошення. Webhook зберігається як секрет Cloudflare, не в D1.</p>'+ '<div class="notice mt">'+discordHelp+'</div>'+ 
    '<div class="row wrap mt"><span class="pill">Заявки: '+(discord.categories.applications?'увімкнено':'вимкнено')+'</span>'+
    '<span class="pill">Рішення: '+(discord.categories.decisions?'увімкнено':'вимкнено')+'</span>'+
    '<span class="pill">Події: '+(discord.categories.events?'увімкнено':'вимкнено')+'</span>'+ 
    '<span class="pill">CAPT: '+(discord.categories.capt?'увімкнено':'вимкнено')+'</span>'+ 
    '<span class="pill">Новини: '+(discord.categories.news?'увімкнено':'вимкнено')+'</span>'+ 
    '<span class="pill">Оголошення: '+(discord.categories.announcements?'увімкнено':'вимкнено')+'</span></div>'+
    applicationWebhooksHtml+discordRoutesHtml+discordSettingsHtml+discordLogsHtml+
    '<div class="row wrap mt"><button class="btn secondary" type="button" data-action="discord-test" '+(discord.configured?'':'disabled')+'>Надіслати тестове повідомлення</button>'+
    '<button type="button" class="btn ghost" data-action="discord-refresh">Оновити статус</button><span class="muted small">Worker: famaly · Не надсилай webhook у чат.</span></div></div>':''}<div class="notice mt">Ставки CAPT застосовуються вручну при створенні виплат, щоб керівник контролював підставу нарахування. Права заступників задаються в особових справах.</div>`;}
async function profile(){const u=state.user;const sessions=(await api('/auth/sessions')).items;return `${intro('Мій профіль','Особисті дані, пароль та активні сесії.')}<div class="grid2"><div class="card"><h3>${esc(u.nickname||u.username)}</h3><div class="stack mt"><div>Логін: <strong>${esc(u.username)}</strong></div><div>Роль доступу: <strong>${esc(roles[u.role])}</strong></div><div>Ігровий ранг: <strong>${esc(rankName(u.rank_id))}</strong></div><div>Напрямок: <strong>${esc(departmentName(u.department_id))}</strong></div><div>Ігровий ID: <strong>${esc(u.game_id||'—')}</strong></div><div>Discord: <strong>${esc(u.discord||'—')}</strong></div></div><button class="btn tiny secondary mt" data-action="edit-user" data-id="${u.id}">Редагувати профіль</button></div><div class="card"><h3>Зміна пароля</h3><form id="password-form" class="stack mt">${field('Поточний пароль','old_password','','password',true,'required')}${field('Новий пароль (12–128 символів)','new_password','','password',true,'minlength="12" required')}<button class="btn" type="submit">Змінити пароль і завершити сесії</button></form></div></div><div class="card mt"><div class="card-head"><h3>Сесії</h3><span class="muted small">Завершення доступу з інших пристроїв</span></div>${table(['Створено','Термін дії','Пристрій','Дія'],sessions.map(x=>`<tr><td>${date(x.created_at)}</td><td>${date(x.expires_at)}</td><td class="wordwrap">${esc(x.user_agent.slice(0,100))}</td><td>${x.revoked_at?badge('Завершено'):`<button class="btn tiny danger" data-action="revoke-session" data-id="${esc(x.id)}">Завершити</button>`}</td></tr>`))}</div>`;}
async function render(){state.menu=false;let content='';try{if(!state.user||(location.pathname!=='/'&&Object.values(grPublicPaths).includes(location.pathname)&&!location.hash.startsWith('#overview'))){renderPublic();return;}if(['overview','members','ranks','departments','contracts','settings','profile'].includes(state.route)||state.route==='workspace')await preload();switch(state.route){case'overview':content=await overview();break;case'members':content=await members();break;case'ranks':content=await ranks();break;case'departments':content=await departments();break;case'workspace':content=await departmentWorkspace();break;case'tasks':content=await renderModule('tasks');break;case'events':content=await renderModule('events');break;case'gallery':content=await galleryManager();break;case'public_news':content=await newsManager();break;case'public_team':content=await teamManager();break;case'public_achievements':content=await achievementsManager();break;case'public_calendar':content=await calendarManager();break;case'contracts':content=await contracts();break;case'capt':content=await captPage();break;case'fleet':content=await fleetPage();break;case'discipline':case'announcements':case'reports':content=await groupPage(state.route);break;case'finance':content=await finance();break;case'applications':content=await applications();break;case'stats':content=await stats();break;case'audit':content=await auditPage();break;case'settings':content=await settingsPage();break;case'profile':content=await profile();break;default:state.route='overview';content=await overview();}shell(content);}catch(e){if(e.status===401){state.user=null;state.route='overview';renderPublic();toast('Сесію завершено. Увійдіть повторно.',true);return;}shell(intro('Помилка завантаження',e.message)+`<button class="btn mt" data-action="refresh">Повторити</button>`);toast(e.message,true);}}
async function navigate(route){const url=new URL(location.href);if(url.searchParams.has('view')||url.pathname!=='/'){url.searchParams.delete('view');history.replaceState(history.state,'','/'+url.search+url.hash);}state.route=route;state.search='';state.sort='new';state.filter='';state.menu=false;location.hash=route;await render();}
async function initial(){try{state.public=await api('/public');}catch(e){state.public={settings:{tagline:'Сила в єдності.'},gallery:[]};toast('Не вдалося отримати публічні дані. Перевірте D1 та міграції.',true);}try{state.user=(await api('/auth/me')).user;}catch{state.user=null;}if(state.user){try{state.notifications=(await api('/notifications')).items;await preload();}catch(e){toast(e.message,true);}state.route=location.hash.replace('#','')||'overview';}if(new URL(location.href).searchParams.get('view')==='public'){renderPublic();return;}await render();}
const lines=s=>String(s||'').split(/\n/).map(x=>x.trim()).filter(Boolean);
function formData(f){return Object.fromEntries(new FormData(f).entries());}
async function afterSaved(msg='Збережено'){closeModal();toast(msg);if(state.user){state.notifications=(await api('/notifications')).items;await preload();}if(['gallery','public_news','public_team','public_achievements','public_calendar'].includes(state.route))state.public=await api('/public');await render();}
async function handleSubmit(e){const f=e.target;if(!f.id)return;e.preventDefault();const b=formData(f);const submit=f.querySelector('[type=submit]');if(submit)submit.disabled=true;try{switch(f.id){
  case 'apply-form':await api('/apply','POST',b);f.reset();toast('Заявку надіслано. Очікуйте рішення рекрутера.');return;
  case 'login-form':state.user=(await api('/auth/login','POST',b)).user;closeModal();state.notifications=(await api('/notifications')).items;await preload();await navigate('overview');toast('Вхід успішний');return;
  case 'user-form':{const id=f.dataset.id,old=state.users.find(u=>u.id===id);let payload={...b};if(!id){delete payload.activity;delete payload.status;}else{payload.version=old.version;if(state.user.role==='leader'){payload.permissions=lines((b.permissions||'').replace(/,/g,'\n'));}else delete payload.permissions;}
    const result=await api(id?`/users/${id}`:'/users',id?'PATCH':'POST',payload);if(!id){closeModal();await preload();await render();credentialReceipt(result.item.username,b.password,result.item.nickname);return;}await afterSaved('Особову справу оновлено');return;}
  case 'rank-form':{const r=state.ranks.find(x=>x.id===Number(f.dataset.id));await api(`/ranks/${r.id}`,'PATCH',{title:b.title,requirements:b.requirements,checklist:lines(b.checklist),version:r.version});await afterSaved('Ранг оновлено');return;}
  case 'department-form':{const d=state.departments.find(x=>x.id===f.dataset.id);await api(`/departments/${d.id}`,'PATCH',{...b,version:d.version});await afterSaved();return;}
  case 'calendar-form':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const id=f.dataset.id,old=id?(await api('/records/public_calendar')).items.find(x=>x.id===id):null;
    if(id&&!old)throw new Error('Захід не знайдено');
    if(b.ends_at&&b.ends_at<=b.starts_at)throw new Error('Дата завершення має бути після початку');
    await api(id?'/records/public_calendar/'+encodeURIComponent(id):'/records/public_calendar',id?'PATCH':'POST',{
      title:b.title,details:b.description,status:b.status||'Заплановано',
      starts_at:b.starts_at,ends_at:b.ends_at||'',extra:{category:b.category,location:b.location||''},version:old?.version
    });
    await afterSaved('Захід збережено');return;}
  case 'achievement-form':{
    if(!can('content:manage'))throw new Error('Недостатньо прав для досягнень');
    const id=f.dataset.id,old=id?(await api('/records/public_achievements')).items.find(a=>a.id===id):null;
    if(id&&!old)throw new Error('Досягнення не знайдено');
    const photo=String(b.photo_url||'').trim();
    if(photo&&!galleryPhoto({evidence:[photo]}))throw new Error('Фото має бути прямим HTTPS-посиланням ImgBB на JPG, PNG, WEBP або GIF');
    const payload={title:b.title,details:b.description,status:b.status||'Заплановано',
      evidence:photo?[photo]:[],extra:{category:b.category,achieved_on:b.achieved_on,featured:b.featured==='true'},version:old?.version};
    await api(id?'/records/public_achievements/'+encodeURIComponent(id):'/records/public_achievements',id?'PATCH':'POST',payload);
    await afterSaved('Досягнення збережено');return;}
  case 'team-form':{
    if(!can('content:manage'))throw new Error('Недостатньо прав для редагування публічних профілів');
    const id=f.dataset.id,old=id?(await api('/records/public_team')).items.find(x=>x.id===id):null;
    if(id&&!old)throw new Error('Профіль не знайдено');
    const photo=String(b.photo_url||'').trim();
    if(photo&&!galleryPhoto({evidence:[photo]}))throw new Error('Фото має бути прямим HTTPS-посиланням ImgBB на JPG, PNG, WEBP або GIF');
    const payload={title:b.nickname,details:b.bio||'',status:b.status||'Заплановано',
      evidence:photo?[photo]:[],extra:{position:b.position,sort_order:Number(b.sort_order??50)},version:old?.version};
    await api(id?'/records/public_team/'+encodeURIComponent(id):'/records/public_team',id?'PATCH':'POST',payload);
    await afterSaved('Профіль керівника збережено');return;}
  case 'news-form':{
    if(!can('content:manage'))throw new Error('Недостатньо прав для публікації');
    const id=f.dataset.id,record=id?(await api('/records/public_news')).items.find(r=>r.id===id):null;
    if(id&&!record)throw new Error('Новину не знайдено');
    const payload={title:b.title,details:b.details,status:b.status||'Заплановано',evidence:[],
      extra:{...record?.extra,news_category:b.category,featured:b.featured==='true'},version:record?.version};
    await api(id?'/records/public_news/'+encodeURIComponent(id):'/records/public_news',id?'PATCH':'POST',payload);
    await afterSaved('Новину збережено');return;}
  case 'gallery-form':{
    const id=f.dataset.id,old=id?(await api('/records/gallery')).items.find(x=>x.id===id):null;
    const url=String(b.photo_url||'').trim();
    if(!galleryPhoto({evidence:[url]}))throw new Error('Для галереї потрібне пряме HTTPS-посилання ImgBB на JPG, PNG, WEBP або GIF.');
    const payload={title:b.title,details:b.details||'',status:b.status||'Заплановано',evidence:[url],
      extra:{...old?.extra,gallery_category:b.category,featured:b.featured==='true'},version:old?.version};
    await api(id?'/records/gallery/'+id:'/records/gallery',id?'PATCH':'POST',payload);
    await afterSaved('Фотографію збережено');return;}
  case 'record-form':{const mod=f.dataset.module,id=f.dataset.id;const rec=id?(await api(`/records/${mod}`)).items.find(x=>x.id===id):null;const payload={...b,evidence:lines(b.evidence),amount:Number(b.amount||0),version:rec?.version,extra:{...rec?.extra}};if(b.extra){try{payload.extra=JSON.parse(b.extra);}catch{throw new Error('Додаткові дані повинні бути коректним JSON');}}
    Object.keys(b).filter(k=>k.startsWith('extra_')).forEach(k=>{payload.extra[k.slice(6)]=k==='extra_checklist_completed'||k==='extra_lineup'?lines(b[k]):b[k];delete payload[k];});
    if(mod==='vehicles'){payload.extra.model=b.title;payload.extra.value=Number(b.extra_value||0);payload.extra.mileage=Number(b.extra_mileage||0);}if(!b.starts_at)delete payload.starts_at;if(!b.ends_at)delete payload.ends_at;await api(id?`/records/${mod}/${id}`:`/records/${mod}`,id?'PATCH':'POST',payload);await afterSaved('Запис збережено');return;}
  case 'review-form':{const mod=f.dataset.module,id=f.dataset.id,r=(await api(`/records/${mod}`)).items.find(x=>x.id===id);await api(`/records/${mod}/${id}/review`,'POST',{...b,version:r.version});await afterSaved('Рішення записано');return;}
  case 'contract-form':{const id=f.dataset.id,old=id?(await api('/contracts')).items.find(x=>x.id===id):null;const participant_ids=[...f.querySelectorAll('[name=participant]:checked')].map(x=>x.value);await api(id?`/contracts/${id}`:'/contracts',id?'PATCH':'POST',{...b,participant_ids,amount:Number(b.amount),treasury_percent:Number(b.treasury_percent),evidence:lines(b.evidence),version:old?.version});await afterSaved('Контракт збережено');return;}
  case 'app-review-form':{const a=(await api('/applications')).items.find(x=>x.id===f.dataset.id);await api(`/applications/${a.id}`,'PATCH',{...b,version:a.version});await afterSaved('Рішення щодо кандидата збережено');return;}
  case 'ledger-form':await api('/ledger','POST',{...b,amount:Number(b.amount)});await afterSaved('Операцію проведено');return;
  case 'discord-preferences-form':{
    if(state.user?.role!=='leader')throw new Error('Недостатньо прав');
    const enabled=Object.fromEntries(['applications','decisions','events','capt','news','announcements'].map(k=>[k,!!f.elements.namedItem(k)?.checked]));
    await api('/discord/preferences','PATCH',{enabled,versions:state.discordVersions});
    await render();toast('Discord-сповіщення оновлено');return;}
  case 'settings-form':await api('/settings','PATCH',{...b,__versions:state.settingsVersions});state.public=await api('/public');await afterSaved('Налаштування оновлено');return;
  case 'password-form':await api('/auth/password','POST',b);state.user=null;closeModal();renderPublic();toast('Пароль змінено. Увійдіть повторно.');return;
  case 'reset-password-form':{const target=state.users.find(u=>u.id===f.dataset.id);await api(`/users/${f.dataset.id}/reset-password`,'POST',b);closeModal();await preload();await render();credentialReceipt(target?.username||'',b.password,target?.nickname||'',true);return;}
} }catch(err){toast(err.message,true);if(err.status===409)toast('Оновіть сторінку перед повторним редагуванням.',true);}finally{if(submit)submit.disabled=false;}}
document.addEventListener('submit',handleSubmit);
document.addEventListener('input',e=>{if(e.target.closest('#contract-correction-form')){const f=e.target.closest('form');f.dataset.previewAmount='';f.dataset.previewReason='';const btn=f.querySelector('[data-action="contract-correction-save"]');if(btn)btn.disabled=true;const box=f.querySelector('#contract-correction-preview');if(box)box.textContent='Дані змінено. Повторіть попередній розрахунок.';}if(e.target.name==='photo_url'&&e.target.closest('#gallery-form'))updateGalleryFormPreview();if(e.target.name==='photo_url'&&e.target.closest('#team-form'))updateTeamFormPreview();if(e.target.name==='photo_url'&&e.target.closest('#achievement-form'))updateAchievementPreview();if(e.target.id==='search-input'){state.search=e.target.value;const start=e.target.selectionStart;render().then(()=>{const v=$('#search-input');if(v){v.focus();try{v.setSelectionRange(start,start);}catch{}}});}});
document.addEventListener('change',e=>{if(e.target.id==='workspace-department-select'){state.workspaceDepartment=e.target.value;state.workspaceSection='personnel';void render();return;}if(e.target.id==='gr-gallery-sort'){state.gallerySort=e.target.value;const node=$('#gr-gallery-content');if(node)node.innerHTML=renderPublicGallery();return;}if(e.target.id==='gr-achievement-sort'){state.achievementSort=e.target.value;const node=$('#gr-achievements-content');if(node)node.innerHTML=renderPublicAchievements();return;}if(e.target.matches('#record-form[data-module="promotions"] [name="extra_requested_rank_id"]')){const form=e.target.form,box=form.querySelector('#promotion-requirement-box');if(box){box.innerHTML=promotionChecklistView(e.target.value,[]);syncPromotionChecklist();}return;}if(e.target.matches('.promotion-requirement')){syncPromotionChecklist();return;}if(state.route==='members'&&['members-role-filter','members-status-filter','members-department-filter','members-sort-filter'].includes(e.target.id)){const key={'members-role-filter':'membersRole','members-status-filter':'membersStatus','members-department-filter':'membersDepartment','members-sort-filter':'membersSort'}[e.target.id];state[key]=e.target.value;render();return;}if(e.target.id==='contract-department-filter'){state.contractDepartment=e.target.value;render();return;}if(e.target.id==='status-filter'){state.filter=e.target.value;render();}if(e.target.id==='sort-select'){state.sort=e.target.value;render();}if(e.target.id==='period-filter'){state.period=e.target.value;render();}});
document.addEventListener('click',async e=>{const back=e.target.closest('[data-backdrop]');if(back&&e.target===back){closeModal();return;}const t=e.target.closest('[data-action],[data-route]');if(!t)return;e.preventDefault();try{if(t.dataset.route){await navigate(t.dataset.route);return;}const act=t.dataset.action,id=t.dataset.id,mod=t.dataset.module;switch(act){
  case 'show-login':loginModal();break;
  case 'close-modal':closeModal();break;
  case 'toggle-menu':$('.shell')?.classList.toggle('menu-open');break;
  case 'refresh':await render();break;
  case 'overview-trend-period':state.overviewTrendPeriod=t.dataset.value==='30'?'30':'7';await render();break;
  case 'discord-refresh':{if(state.user?.role!=='leader')throw new Error('Недостатньо прав');await render();toast('Статус Discord оновлено');break;}
  case 'discord-test-route':{if(state.user?.role!=='leader')throw new Error('Недостатньо прав');const kind=t.dataset.kind;const result=await api('/discord/test','POST',{kind});toast(result.message||'Тест надіслано');break;}
  case 'discord-test':{if(state.user?.role!=='leader')throw new Error('Недостатньо прав');const result=await api('/discord/test','POST',{});toast(result.message||'Тест надіслано');break;}
  case 'logout':await api('/auth/logout','POST');state.user=null;state.notifications=[];state.route='overview';state.search='';location.hash='home';renderPublic();toast('Ви вийшли з панелі');break;
  case 'notifications':notifyPopup();break;
  case 'read-notification':await api(`/notifications/${id}/read`,'POST');state.notifications=(await api('/notifications')).items;notifyPopup();await render();break;
  case 'generate-login':{
    const form=$('#user-form');if(!form||form.dataset.id)break;
    const nickname=form.querySelector('[name="nickname"]')?.value||'';
    const username=GrizzlyCredentials.generateLogin(nickname,state.users.map(u=>u.username));
    form.querySelector('[name="username"]').value=username;
    toast('Логін згенеровано');break;}
  case 'generate-temp-password':{
    const input=document.querySelector('#user-form input[name="password"], #reset-password-form input[name="password"]');
    if(!input)break;
    input.value=GrizzlyCredentials.generatePassword();
    toast('Надійний пароль згенеровано');break;}
  case 'toggle-temp-password':{
    const input=document.querySelector('#credential-receipt-password, #user-form input[name="password"], #reset-password-form input[name="password"]');
    if(input)input.type=input.type==='password'?'text':'password';
    break;}
  case 'copy-access-invite':{
    const username=$('#credential-receipt-login')?.value, password=$('#credential-receipt-password')?.value;
    if(!username||!password)break;
    await navigator.clipboard.writeText(`🐻 GRIZZLY FAMILY | Особистий доступ\n🌐 ${location.origin}/\n👤 Логін: ${username}\n🔐 Тимчасовий пароль: ${password}\nПісля входу змініть пароль у «Мій профіль». Не передавайте його іншим.`);
    toast('Дані доступу скопійовано — надішліть особисто');break;}
  case 'new-user':await preload();userForm();break;
  case 'edit-user':await preload();userForm(id);break;
  case 'reset-password':modal('Скидання пароля',`<div class="notice mb">Усі активні сесії цього учасника буде завершено.</div><form id="reset-password-form" data-id="${esc(id)}" class="stack">${field('Новий пароль (від 12 символів)','password','','password',true,'required minlength="12"')}<button type="button" class="btn tiny secondary" data-action="generate-temp-password">Згенерувати надійний пароль</button><button type="button" class="btn tiny ghost" data-action="toggle-temp-password">Показати / приховати</button><button class="btn danger" type="submit">Скинути пароль</button></form>`);break;
  case 'preview-rank-templates':{
     const placeholders=state.ranks.filter(r=>Number(r.is_example)===1&&r.title===`Ранг ${String(r.id).padStart(2,'0')} — приклад`);
     modal('15 рангів Grizzly',`<p class="modal-desc">Заповнити ${placeholders.length} стандартних рангів готовими редагованими прикладами? Уже налаштовані ранги не зміняться. Роль доступу до сайту не залежить від рангу.</p><div class="stack">${state.rankTemplates.map(r=>`<div class="row space"><strong>${r.id}. ${esc(r.title)}</strong><span class="muted small">${r.checklist.length} умов</span></div>`).join('')}</div><div class="form-actions mt"><button class="btn ghost" data-action="close-modal">Скасувати</button><button class="btn" data-action="apply-rank-templates">Заповнити ${placeholders.length} рангів</button></div>`);
     break;}
   case 'apply-rank-templates':{
     const expected=state.ranks.filter(r=>Number(r.is_example)===1&&r.title===`Ранг ${String(r.id).padStart(2,'0')} — приклад`).map(r=>({id:r.id,version:r.version}));
     if(!expected.length){closeModal();toast('Усі ранги вже заповнено');break;}
     const result=await api('/ranks/apply-templates','POST',{expected});
     await afterSaved(`Заповнено ${result.updated} рангів. Можна редагувати кожен окремо.`);break;}
  case 'rank-promotions-list':state.sub.reports='promotions';await navigate('reports');break;
  case 'rank-fill-requirements':{
    if(state.user.role!=='leader')throw new Error('Лише лідер може змінювати вимоги');
    await preload();
    const eligible=state.ranks.filter(rank=>rankRequirementsMissing(rank)&&state.rankTemplates?.some(x=>x.id===rank.id));
    if(!eligible.length){toast('Немає рангів з незаповненими вимогами');break;}
    if(!confirm('Заповнити рекомендовані RP-вимоги та чеклісти для '+eligible.length+' рангів? Назви, вже налаштовані вимоги та ранги учасників не зміняться.'))break;
    let saved=0;
    for(const rank of eligible){
      const template=state.rankTemplates.find(x=>x.id===rank.id);
      await api('/ranks/'+rank.id,'PATCH',{title:rank.title,requirements:template.requirements,checklist:template.checklist,version:rank.version});
      saved++;
    }
    await afterSaved('Рекомендовані вимоги додано: '+saved);
    break;
  }
  case 'edit-rank':rankForm(id);break;
  case 'workspace-section':state.workspaceSection=t.dataset.value||'personnel';await render();break;
  case 'workspace-new-record':{
    const module=t.dataset.module;
    if(!module||!moduleInfo[module])throw new Error('Невідомий розділ');
    const dep=state.user.role==='head'?state.user.department_id:(state.workspaceDepartment||state.departments[0]?.id);
    if(!dep)throw new Error('Спочатку оберіть підрозділ');
    // The API remains the final authority; the form only preselects the assigned department.
    await preload();
    if(module==='vehicles')fleetVehicleForm();
    else if(module==='gallery')galleryForm();
    else if(module==='public_news')newsForm();
    else if(module==='public_team')teamForm();
    else if(module==='public_achievements')achievementForm();
    else moduleForm(module);
    const input=document.querySelector('#record-form [name="department_id"]');
    if(input){input.value=dep;if(state.user.role==='head'){input.disabled=true;const hidden=document.createElement('input');hidden.type='hidden';hidden.name='department_id';hidden.value=dep;input.after(hidden);}}
    break;
  }
  case 'department-select':state.departmentFocus=t.dataset.value||'all';await render();break;
  case 'department-contracts':state.contractDepartment=t.dataset.value||'all';await navigate('contracts');break;
  case 'department-new-task':{
    const dept=state.departments.find(d=>d.id===t.dataset.value);
    if(!dept||!can('tasks:manage')||(state.user.role==='head'&&state.user.department_id!==dept.id))throw new Error('Немає прав для створення завдання цього напрямку');
    await preload();moduleForm('tasks');
    const input=document.querySelector('#record-form [name="department_id"]');
    if(input){input.value=dept.id;if(state.user.role==='head'){input.disabled=true;const hidden=document.createElement('input');hidden.type='hidden';hidden.name='department_id';hidden.value=dept.id;input.after(hidden);}}
    break;
  }
  case 'edit-department':departmentForm(id);break;
  case 'new-record':await preload();if(mod==='vehicles')fleetVehicleForm();else if(mod==='gallery')galleryForm();else if(mod==='public_news')newsForm();else if(mod==='public_team')teamForm();else if(mod==='public_achievements')achievementForm();else moduleForm(mod);break;
  case 'edit-record':{const r=(await api(`/records/${mod}`)).items.find(x=>x.id===id);await preload();if(mod==='vehicles')fleetVehicleForm(r);else if(mod==='gallery')galleryForm(r);else if(mod==='public_news')newsForm(r);else if(mod==='public_team')teamForm(r);else if(mod==='public_achievements')achievementForm(r);else moduleForm(mod,r);break;}
  case 'calendar-new':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');calendarForm();break;}
  case 'calendar-edit':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const rec=(await api('/records/public_calendar')).items.find(x=>x.id===id);
    if(!rec)throw new Error('Захід не знайдено');calendarForm(rec);break;}
  case 'calendar-publish':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const rec=(await api('/records/public_calendar')).items.find(x=>x.id===id);
    if(!rec)throw new Error('Захід не знайдено');
    await api('/records/public_calendar/'+encodeURIComponent(id),'PATCH',{version:rec.version,status:t.dataset.status});
    await afterSaved(t.dataset.status==='Погоджено'?'Захід опубліковано':'Захід приховано');break;}
  case 'calendar-delete':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    if(!confirm('Видалити публічний захід?'))break;
    const rec=(await api('/records/public_calendar')).items.find(x=>x.id===id);
    if(!rec)throw new Error('Захід не знайдено');
    await api('/records/public_calendar/'+encodeURIComponent(id),'DELETE',{version:rec.version});
    await afterSaved('Захід видалено');break;}
  case 'public-calendar-filter':{
    state.calendarCategory=t.dataset.category||'all';
    const node=$('#gr-calendar-content');if(node)node.innerHTML=renderPublicCalendar();break;}
  case 'public-calendar-prev':
  case 'public-calendar-next':{
    const [year,month]=grCalendarMonthValue().split('-').map(Number);
    const d=new Date(Date.UTC(year,month-1+(act==='public-calendar-prev'?-1:1),1));
    state.calendarMonth=d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
    const node=$('#gr-calendar-content');if(node)node.innerHTML=renderPublicCalendar();break;}
  case 'achievement-new':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    achievementForm();break;}
  case 'achievement-edit':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const old=(await api('/records/public_achievements')).items.find(a=>a.id===id);
    if(!old)throw new Error('Досягнення не знайдено');
    achievementForm(old);break;}
  case 'achievement-publish':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const old=(await api('/records/public_achievements')).items.find(a=>a.id===id);
    if(!old)throw new Error('Досягнення не знайдено');
    await api('/records/public_achievements/'+encodeURIComponent(id),'PATCH',{version:old.version,status:t.dataset.status});
    await afterSaved(t.dataset.status==='Погоджено'?'Досягнення опубліковано':'Досягнення приховано');break;}
  case 'achievement-delete':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    if(!confirm('Видалити це досягнення з історії GRIZZLY?'))break;
    const old=(await api('/records/public_achievements')).items.find(a=>a.id===id);
    if(!old)throw new Error('Досягнення не знайдено');
    await api('/records/public_achievements/'+encodeURIComponent(id),'DELETE',{version:old.version});
    await afterSaved('Досягнення видалено');break;}
  case 'achievement-admin-filter':state.achievementAdminFilter=t.dataset.category||'all';await render();break;
  case 'achievement-filter':{
    state.achievementFilter=t.dataset.category||'all';
    const block=$('#gr-achievements-content');
    if(block)block.innerHTML=renderPublicAchievements();
    break;}
  case 'team-new':if(!can('content:manage'))throw new Error('Недостатньо прав');teamForm();break;
  case 'team-edit':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const item=(await api('/records/public_team')).items.find(x=>x.id===id);
    if(!item)throw new Error('Профіль не знайдено');teamForm(item);break;}
  case 'team-delete':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    if(!confirm('Назавжди видалити цей публічний профіль?'))break;
    const item=(await api('/records/public_team')).items.find(x=>x.id===id);
    if(!item)throw new Error('Профіль не знайдено');
    await api('/records/public_team/'+encodeURIComponent(id),'DELETE',{version:item.version});
    await afterSaved('Профіль видалено');break;}
  case 'team-publish':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const item=(await api('/records/public_team')).items.find(x=>x.id===id);
    if(!item)throw new Error('Профіль не знайдено');
    await api('/records/public_team/'+encodeURIComponent(id),'PATCH',{version:item.version,status:t.dataset.status});
    await afterSaved(t.dataset.status==='Погоджено'?'Профіль опубліковано':'Профіль приховано');break;}
  case 'news-new':if(!can('content:manage'))throw new Error('Недостатньо прав');newsForm();break;
  case 'news-edit':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const item=(await api('/records/public_news')).items.find(x=>x.id===id);
    if(!item)throw new Error('Новину не знайдено');newsForm(item);break;}
  case 'news-publish':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const item=(await api('/records/public_news')).items.find(x=>x.id===id);
    if(!item)throw new Error('Новину не знайдено');
    await api('/records/public_news/'+encodeURIComponent(id),'PATCH',{version:item.version,status:t.dataset.status});
    await afterSaved(t.dataset.status==='Погоджено'?'Новину опубліковано':'Новину приховано');break;}
  case 'gallery-new':galleryForm();break;
  case 'gallery-admin-filter':state.galleryAdminFilter=t.dataset.category||'all';await render();break;
  case 'gallery-publish':{
    if(!can('content:manage'))throw new Error('Недостатньо прав');
    const item=(await api('/records/gallery')).items.find(x=>x.id===id);
    if(!item)throw new Error('Запис галереї не знайдено');
    if(t.dataset.status==='Погоджено'&&!galleryPhoto(item))throw new Error('Для публікації потрібне пряме посилання на зображення ImgBB. Відредагуйте фото.');
    await api('/records/gallery/'+id,'PATCH',{version:item.version,status:t.dataset.status});
    await afterSaved(t.dataset.status==='Погоджено'?'Фото опубліковано на головній':'Фото знято з публікації');break;}
  case 'gallery-filter':state.galleryFilter=t.dataset.category||'all';{
    const node=$('#gr-gallery-content');if(node)node.innerHTML=renderPublicGallery();break;}
  case 'gallery-open':publicGalleryLightbox(id);break;
  case 'gallery-step':publicGalleryStep(Number(t.dataset.offset)||0);break;
  case 'view-record':await preload();await viewRecord(mod,id);break;
  case 'review-record':await reviewModal(mod,id);break;
  case 'delete-record':{if(!confirm('Видалити цей запис?'))return;const r=(await api(`/records/${mod}`)).items.find(x=>x.id===id);await api(`/records/${mod}/${id}`,'DELETE',{version:r.version});await afterSaved('Запис видалено');break;}
  case 'capt-month':{
    const current=state.captMonth||new Date().toISOString().slice(0,7);
    const [year,month]=current.split('-').map(Number);
    const next=new Date(year,month-1+Number(t.dataset.offset||0),1);
    state.captMonth=next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0');
    await render();break;}
  case 'capt-join':
  case 'capt-leave':{
    await api('/capt/matches/'+encodeURIComponent(id)+'/signups','POST',{action:act==='capt-join'?'join':'leave'});
    await renderCaptSignupPanel(id);toast(act==='capt-join'?'Запис на CAPT збережено':'Запис на CAPT скасовано');break;}
  case 'change-sub':state.sub[state.route]=t.dataset.value;state.search='';state.filter='';await render();break;
  case 'fleet-condition':state.fleetCondition=t.dataset.value||'all';await render();break;
  case 'contract-filter':state.contractStatus=t.dataset.value||'all';await render();break;
  case 'view-member':viewMember(id);break;
  case 'members-reset':state.membersRole='all';state.membersStatus='all';state.membersDepartment='all';state.membersSort='rank';state.search='';await render();break;
  case 'members-role':state.membersRole=t.dataset.value||'all';await render();break;
  case 'members-status':state.membersStatus=t.dataset.value||'all';await render();break;
  case 'members-department':state.membersDepartment=document.getElementById('members-department-filter')?.value||'all';await render();break;
  
  case 'fleet-photo':{
    const record=(await api('/records/vehicles')).items.find(x=>x.id===id);
    const photo=record?galleryPhoto(record):'';
    if(!photo)throw new Error('Фотографія недоступна');
    modal(record.extra?.model||record.title,'<div style="display:grid;place-items:center"><img src="'+esc(photo)+'" alt="'+esc(record.title)+'" style="display:block;max-width:100%;max-height:75vh;object-fit:contain;border-radius:10px" loading="eager"></div>');
    break;
  }
  case 'review-app':await appReview(id);break;
  case 'new-contract':await preload();await contractForm();break;
  case 'edit-contract':await preload();await contractForm(id);break;
  case 'view-contract':await preload();await contractView(id);break;
  case 'contract-correction-open':{
    if(state.user?.role!=='leader')throw new Error('Тільки лідер може виконати коригування');
    state.contractCorrectionRecord=(await api('/contracts')).items.find(x=>x.id===id);
    contractCorrectionForm(id);break;
  }
  case 'contract-correction-preview':{
    const form=document.querySelector('#contract-correction-form');
    if(!form||!form.reportValidity())break;
    const id=form.dataset.id,amount=Number(form.elements.namedItem('amount').value),reason=form.elements.namedItem('reason').value.trim();
    const data=await api('/contracts/'+id+'/correction-preview','POST',{amount,reason});
    const p=data.preview;
    document.getElementById('contract-correction-preview').innerHTML='<strong>Перевірка різниці</strong><div class="mt">Було: '+fmt(p.old_amount)+' → Стане: '+fmt(p.new_amount)+'</div>'+
      '<div>Казна: '+fmt(p.old_treasury)+' → '+fmt(p.new_treasury)+' (різниця +'+fmt(p.treasury_change)+')</div>'+
      '<div>Кожному з '+p.participants+' учасників: '+fmt(p.old_per_member)+' → '+fmt(p.new_per_member)+'</div>'+
      '<div class="notice mt">Нульових позначок «Видано» буде скинуто: '+p.reset_zero_confirmations+'. Нові виплати потребують фактичної видачі та окремого підтвердження.</div>';
    form.dataset.previewAmount=String(amount);form.dataset.previewReason=reason;form.dataset.previewVersion=String(data.version);
    form.querySelector('[data-action="contract-correction-save"]').disabled=false;
    break;
  }
  case 'contract-correction-save':{
    const form=document.querySelector('#contract-correction-form');if(!form||!form.reportValidity())break;
    const id=form.dataset.id,amount=Number(form.elements.namedItem('amount').value),reason=form.elements.namedItem('reason').value.trim();
    if(String(amount)!==form.dataset.previewAmount||reason!==form.dataset.previewReason)throw new Error('Після зміни суми або причини повторіть попередній розрахунок');
    if(!confirm('УВАГА: буде змінено проведений контракт, нарахування і частку казни. Усі підтвердження нульових виплат скинуться. Продовжити?'))break;
    await api('/contracts/'+id+'/correct','POST',{amount,reason,version:Number(form.dataset.previewVersion),confirm_reset_zero_confirmations:true});
    state.contractCorrectionRecord=null;await afterSaved('Коригування проведено. Нові виплати очікують фактичної видачі.');
    break;
  }
  case 'settle-contract':{if(!confirm('Підтвердити остаточне нарахування? Дія незворотна.'))return;await api(`/contracts/${id}/settle`,'POST',{version:Number(t.dataset.version)});await afterSaved('Виплати проведено рівно один раз');break;}
  case 'capt-pay':{if(!confirm('Нарахувати CAPT-виплату за погодженим записом за поточною ставкою?'))return;const r=await api(`/capt-pay/${id}`,'POST');await afterSaved(`CAPT-виплату ${fmt(r.amount)} нараховано`);break;}
  case 'copy-template':{const rec=(await api('/records/templates')).items.find(x=>x.id===id);if(!rec)return;let content=rec.details||rec.title;for(const placeholder of ['час','місце','ім’я']){const key='{'+placeholder+'}';if(content.includes(key)){const value=prompt(`Значення для ${key}`, '')||'';content=content.replaceAll(key,value);}}await navigator.clipboard.writeText(content);toast('Текст скопійовано');break;}
  case 'export':{const result=await api(`/export?module=${mod}`);const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`grizzly-${mod}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Експорт створено');break;}
  case 'new-ledger':await preload();ledgerForm();break;
  case 'view-ledger':await ledgerModal();break;
  case 'finance-period':state.financeDays=Number(t.dataset.days)===30?30:7;await render();break;
  case 'finance-trend-period':state.financeTrendPeriod=t.dataset.value||'12w';await render();break;
  case 'finance-trend-tab':state.financeTrendTab=t.dataset.value||'chart';await render();break;
  case 'finance-empty-toggle':state.financeHideEmpty=document.getElementById('finance-hide-empty')?.checked!==false;await render();break;
  case 'finance-member-search':state.financeMemberSearch=document.getElementById('finance-member-search')?.value||'';await render();break;
  
  case 'finance-report-csv':{
    if(!can('finance:read')&&!can('finance:manage'))throw new Error('Недостатньо прав');
    const data=await api('/finance/analytics?days='+(state.financeDays||7));
    const q=v=>'"'+String(v??'').replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';
    const rows=[['GRIZZLY Finance',data.report.days+' днів'],['Період від',data.report.from],['Період до',data.report.to],['Надходження',data.report.treasury_income],['Витрати',data.report.expenses],['Зміна казни',data.report.net_change],['Контрактів',data.report.contracts_count],['Нараховано учасникам',data.report.member_earned],['Видано в грі',data.report.member_handed_over],[],['Учасник','Нараховано','Видано','Виплат'],...data.leaderboard.map(r=>[r.nickname||r.username,r.earned,r.handed_over,r.payout_count])];
    const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(q).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='grizzly-finance-report-'+data.report.days+'d.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Звіт CSV створено');break;
  }

  case 'ledger-filter':state.ledgerKind=document.getElementById('ledger-kind')?.value||'all';state.ledgerDays=document.getElementById('ledger-days')?.value||'all';await ledgerModal();break;
  case 'ledger-csv':financeCsv(financeRows((await api('/ledger')).items));toast('CSV створено');break;
  case 'confirm-payout':{if(!can('finance:manage'))throw new Error('Недостатньо прав');if(!confirm('Кошти вже фактично передані гравцю в GTA RP? Підтвердження незворотне.'))return;await api('/payouts/'+encodeURIComponent(id)+'/confirm','POST',{note:''});await render();toast('Фактичну видачу підтверджено');break;}

  case 'rsvp':await api(`/rsvp/${id}`,'POST',{response:t.dataset.value});await viewRecord('events',id);toast('Участь оновлено');break;
  case 'revoke-session':await api(`/auth/sessions/${id}`,'DELETE');await render();toast('Сесію завершено');break;
}}catch(err){toast(err.message,true);if(err.status===409)toast('Дані вже змінені. Оновіть розділ.',true);}});
// Keep public routes inside one document. Full navigations briefly display the
// crawler-friendly prerender shell, which looked like a broken loading screen.
const publicPathSet=new Set(Object.values(grPublicPaths));
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
  const url=new URL(link.href,location.href);
  if(url.origin!==location.origin||!publicPathSet.has(url.pathname)||url.hash||url.search)return;
  event.preventDefault();
  const target=url.pathname+(state.user?'?view=public':'');
  if(location.pathname+location.search!==target)history.pushState({grizzlyPublic:true},'',target);
  renderPublic();
});
window.addEventListener('popstate',()=>{
  if(!state.user||new URL(location.href).searchParams.get('view')==='public'||publicPathSet.has(location.pathname)&&location.pathname!=='/')renderPublic();
  else render();
});
window.addEventListener('hashchange',()=>{
  if(!state.user||new URL(location.href).searchParams.get('view')==='public')renderPublic();
});
initial();
