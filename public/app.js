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
const permissionNames={'members:read':'Перегляд складу','members:write':'Керування складом','tasks:manage':'Завдання','reports:review':'Перевірка звітів','promotions:review':'Підвищення','events:manage':'Заходи','capt:manage':'CAPT','fleet:manage':'Автопарк','recruitment:manage':'Рекрутинг','notices:manage':'Оголошення','content:manage':'Публічний контент','finance:read':'Перегляд фінансів','finance:manage':'Нарахування й фінанси','discipline:manage':'Дисципліна','stats:read':'Статистика'};
const nav=[
  {id:'overview',text:'Огляд',icon:'◫',group:'РОБОТА'},
  {id:'members',text:'Склад сім’ї',icon:'♟',group:'РОБОТА'},
  {id:'ranks',text:'Ранги та підвищення',icon:'⬡',group:'РОБОТА'},
  {id:'departments',text:'Напрямки',icon:'▦',group:'РОБОТА'},
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
  public_achievements:['Досягнення сайту','Опубліковані перемоги CAPT, нагороди та визначні події','content:manage']
};
const groupRoutes={capt:['capt_matches','capt_training','capt_attendance'],fleet:['vehicles','vehicle_loans'],discipline:['discipline','blacklist'],announcements:['notices','templates'],reports:['reports','promotions']};
const state={user:null,route:'overview',sub:{},search:'',sort:'new',period:'week',settingsVersions:{},public:null,users:[],departments:[],ranks:[],notifications:[],filter:'',menu:false};
function can(p){return state.user?.role==='leader'||state.user?.permissions?.includes('*')||state.user?.permissions?.includes(p);}
function toast(msg,error=false){const div=document.createElement('div');div.className='toast'+(error?' error':'');div.textContent=msg;$('#toast-root').append(div);setTimeout(()=>div.remove(),4500);}
async function api(path,method='GET',payload){const h={'X-Grizzly-Client':'1'};if(payload!==undefined)h['Content-Type']='application/json';const r=await fetch('/api'+path,{method,credentials:'same-origin',headers:h,body:payload===undefined?undefined:JSON.stringify(payload),cache:'no-store'});let o;try{o=await r.json();}catch{o={error:'Невірна відповідь сервера'};}if(!r.ok){const err=new Error(o.error||`Помилка ${r.status}`);err.status=r.status;throw err;}return o;}
async function preload(){const [users,deps,ranks]=await Promise.all([api('/users'),api('/departments'),api('/ranks')]);state.users=users.items;state.departments=deps.items;state.ranks=ranks.items;state.rankTemplates=ranks.templates||[];}
function userName(id){const x=state.users.find(y=>y.id===id);return x?(x.nickname||x.username):id?'Учасник':'—';}
function departmentName(id){return state.departments.find(x=>x.id===id)?.title||'—';}
function rankName(id){return state.ranks.find(x=>x.id===Number(id))?.title||'—';}
function badge(s){const cls=['Погоджено','Завершено','active','Так'].includes(s)?'green':['Відхилено','blocked','Ні'].includes(s)?'red':['На перевірці','Заплановано'].includes(s)?'yellow':'blue';return `<span class="badge ${cls}">${esc(s||'—')}</span>`;}
function intro(title,description='',right=''){return `<div class="page-intro"><div><div class="overline">GRIZZLY / FAMILY PANEL</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${right}</div>`;}
function empty(label='Тут поки немає записів',desc='Створіть перший запис або змініть параметри пошуку.'){return `<div class="empty"><div><div class="empty-icon">◇</div><strong>${esc(label)}</strong>${esc(desc)}</div></div>`;}
function itemText(obj){return esc(JSON.stringify(obj));}
const galleryCategories=[['all','Усі фото'],['capt','CAPT'],['cars','Автомобілі'],['meetings','Збори'],['events','Івенти'],['other','Інше']];
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
  return category==='all'?gallery:gallery.filter(r=>galleryCategory(r)===category);
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
  return filters+(items.length?'<div class="gr-gallery-grid">'+items.map(publicPhotoCard).join('')+'</div>':'<div class="gr-gallery-filter-empty">У цій категорії ще немає фотографій.</div>');
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
const newsTypes=[['news','Новина'],['event','Подія'],['recruitment','Набір'],['achievement','Досягнення']];
function newsTypeLabel(key){return newsTypes.find(([id])=>id===key)?.[1]||'Новина';}
function renderPublicNews(){
  const rows=Array.isArray(state.public?.news)?state.public.news:[];
  if(!rows.length)return '<div class="gr-news-empty"><span class="gr-small-label">GRIZZLY / NEWS</span><h3>НОВИНИ ГОТУЮТЬСЯ.</h3><p>Нові публікації з’являться тут після підтвердження керівництвом.</p></div>';
  return '<div class="gr-news-grid">'+rows.slice(0,9).map((post,i)=>{
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
  const shown=category==='all'?list:list.filter(a=>a.category===category);
  const counts={all:list.length,capt:list.filter(a=>a.category==='capt').length,milestone:list.filter(a=>a.category==='milestone').length,event:list.filter(a=>a.category==='event').length,award:list.filter(a=>a.category==='award').length};
  const tabs='<div class="gr-ach-filters" role="group" aria-label="Фільтр досягнень">'+achievementTypes.filter(([id])=>id==='all'||counts[id]).map(([id,name])=>
    '<button type="button" class="gr-ach-filter'+(id===category?' active':'')+'" data-action="achievement-filter" data-category="'+id+'" aria-pressed="'+(id===category)+'">'+esc(name)+' <span>'+counts[id]+'</span></button>').join('')+'</div>';
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
  return '<div class="gr-ach-stats"><div><strong>'+counts.all+'</strong><span>Опублікованих досягнень</span></div>'+
    '<div><strong>'+counts.capt+'</strong><span>Здобутків CAPT</span></div>'+
    '<div><strong>'+counts.award+'</strong><span>Нагород</span></div></div>'+
    tabs+(shown.length?'<div class="gr-ach-grid">'+cards+'</div>':'<div class="gr-ach-empty"><p>У цій категорії поки немає записів.</p></div>');
}
function renderPublic(){
  const settings=state.public?.settings||{};
  const gallery=Array.isArray(state.public?.gallery)?state.public.gallery:[];
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
  const navLinks='<a href="#about">Про сім’ю</a><a href="#team">Керівництво</a><a href="#directions">Напрямки</a><a href="#rules">Кодекс</a><a href="#news">Новини</a><a href="#achievements">Досягнення</a><a href="#gallery">Галерея</a><a href="#join">Вступити</a>'+discordLink;
  $('#app').innerHTML=
  '<div class="gr-public">'+
  '<div class="gr-topline"><div class="gr-container"><span><i></i> GTA 5 ROLEPLAY · LOS SANTOS</span><span>GRIZZLY FAMILY / COMMUNITY</span></div></div>'+
  '<header class="gr-header"><div class="gr-container gr-header-inner">'+
    '<a href="#home" class="gr-logo" aria-label="GRIZZLY — на головну"><span class="gr-logo-mark" aria-hidden="true">G<span>.</span></span><span class="gr-logo-copy"><strong>GRIZZLY</strong><small>FAMILY / GTA V RP</small></span></a>'+
    '<nav class="gr-nav" aria-label="Основна навігація">'+navLinks+'</nav>'+
    '<div class="gr-header-actions">'+(state.user?'<a class="gr-login-btn" href="/#overview">Відкрити панель <span>↗</span></a>':'<button class="gr-login-btn" data-action="show-login" type="button">Особистий кабінет <span>↗</span></button>')+
    '<details class="gr-mobile-menu"><summary aria-label="Відкрити навігацію">☰</summary><nav aria-label="Мобільна навігація">'+navLinks+'</nav></details></div>'+
  '</div></header>'+
  '<main>'+
  '<section class="gr-hero" id="home"><div class="gr-hero-grid" aria-hidden="true"></div><div class="gr-container gr-hero-inner">'+
    '<div class="gr-hero-content"><div class="gr-eyebrow"><span class="gr-red-dot"></span> УКРАЇНСЬКА GTA 5 RP СІМ’Я <span class="gr-eyebrow-rule"></span> LOS SANTOS</div>'+
      '<h1>БІЛЬШЕ НІЖ<br><em>СІМ’Я.</em><span> GRIZZLY.</span></h1>'+
      '<p class="gr-hero-description">'+esc(introText)+'</p>'+
      '<div class="gr-hero-buttons"><a class="gr-button gr-button-primary" href="#join">Стати частиною GRIZZLY <span aria-hidden="true">↗</span></a><a class="gr-button gr-button-outline" href="#about">Наша історія <span aria-hidden="true">→</span></a></div>'+
      '<div class="gr-hero-values"><span><b>01</b> Братерство</span><span><b>02</b> Дисципліна</span><span><b>03</b> Розвиток</span></div>'+
    '</div>'+
    '<div class="gr-hero-art" aria-label="Емблема GRIZZLY"><div class="gr-art-grid"></div><span class="gr-art-corner gr-art-corner-top">GRZ / 001</span><div class="gr-art-round"><span class="gr-art-arc"></span>'+
      '<svg class="gr-paw" viewBox="0 0 240 240" role="img" aria-label="Символ ведмежої лапи">'+
       '<ellipse cx="48" cy="80" rx="18" ry="27" transform="rotate(-27 48 80)" fill="currentColor"/>'+
       '<ellipse cx="90" cy="50" rx="19" ry="28" transform="rotate(-8 90 50)" fill="currentColor"/>'+
       '<ellipse cx="140" cy="48" rx="19" ry="29" transform="rotate(8 140 48)" fill="currentColor"/>'+
       '<ellipse cx="184" cy="79" rx="18" ry="27" transform="rotate(25 184 79)" fill="currentColor"/>'+
       '<path d="M120 91c-24 0-35 19-48 34-17 18-35 29-31 51 4 19 22 31 41 27 14-3 23-11 38-11s24 8 39 11c19 4 37-8 40-27 4-22-14-33-31-51-14-15-25-34-48-34Z" fill="currentColor"/>'+
      '</svg></div><span class="gr-art-word">STAY LOYAL.</span><span class="gr-art-corner gr-art-corner-bottom">EST. IN LOS SANTOS</span></div>'+
    '</div><div class="gr-hero-footer"><div class="gr-container"><span>SCROLL TO EXPLORE <b>↓</b></span><span>GRIZZLY · STRENGTH IN UNITY</span></div></div></section>'+
  '<section class="gr-section gr-about" id="about"><div class="gr-container"><div class="gr-section-heading"><span class="gr-kicker">01 — НАША ІСТОРІЯ</span><h2>ПОВАГА НЕ ДАЄТЬСЯ.<br><span>ЇЇ ЗАСЛУГОВУЮТЬ.</span></h2></div>'+
   '<div class="gr-about-layout"><div class="gr-about-identity"><div class="gr-identity-symbol" aria-hidden="true">G<span>✦</span></div><p>ЄДНІСТЬ <em>·</em> ВІДДАНІСТЬ <em>·</em> СИЛА</p></div>'+
   '<div class="gr-about-story"><span class="gr-small-label">ХТО МИ</span><p class="gr-story-preview">'+esc(preview)+'</p>'+
   (history.length>480?'<details class="gr-story-expand"><summary>Читати повну історію <span>＋</span></summary><div class="gr-story-full">'+esc(history)+'</div></details>':'')+
   '<a class="gr-text-link" href="#directions">Дізнайся, чим живе сім’я <span>↗</span></a></div></div></div></section>'+
  '<section class="gr-section gr-team" id="team"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">02 — КЕРІВНИЦТВО</span><h2>ЛЮДИ, ЯКІ<br><span>ВЕДУТЬ GRIZZLY.</span></h2></div><p>Ігрові профілі представників сім’ї. Кожна посада — відповідальність перед командою.</p></div>'+renderPublicTeam()+'</div></section>'+
  '<section class="gr-section gr-directions" id="directions"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">03 — НАШІ НАПРЯМКИ</span><h2>ОДНА СІМ’Я.<br><span>БАГАТО МОЖЛИВОСТЕЙ.</span></h2></div><p>У кожного своя сильна сторона. Разом ми досягаємо більшого.</p></div>'+
   '<div class="gr-direction-grid">'+
     '<article class="gr-direction-card"><span class="gr-direction-index">01 / CAPT</span><div class="gr-direction-icon" aria-hidden="true">✧</div><h3>CAPT СКЛАД</h3><p>Командні бої, тренування, тактика й злагоджена гра.</p><span class="gr-direction-footer">КОМАНДА / НАВИЧКИ</span></article>'+
     '<article class="gr-direction-card"><span class="gr-direction-index">02 / DEVELOPMENT</span><div class="gr-direction-icon" aria-hidden="true">▥</div><h3>ФАРМ І РОЗВИТОК</h3><p>Контракти, спільна активність та підтримка розвитку сім’ї.</p><span class="gr-direction-footer">АКТИВНІСТЬ / ПРОГРЕС</span></article>'+
     '<article class="gr-direction-card"><span class="gr-direction-index">03 / COMMUNITY</span><div class="gr-direction-icon" aria-hidden="true">◎</div><h3>СІМ’Я ТА ІВЕНТИ</h3><p>Збори, спільні виїзди, події та взаємодопомога.</p><span class="gr-direction-footer">ЄДНІСТЬ / ДОВІРА</span></article>'+
   '</div></div></section>'+
  '<section class="gr-section gr-rules" id="rules"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">04 — НАШ КОДЕКС</span><h2>СИЛА — У ПОРЯДКУ.</h2></div><p>Прозорі правила для тих, хто грає в команді.</p></div>'+
    '<div class="gr-rules-grid"><article class="gr-rules-card"><div class="gr-rules-top"><span>01</span><strong>ПРАВИЛА СІМ’Ї</strong><span>↗</span></div><p class="gr-rule-copy">'+esc(rules)+'</p></article>'+
    '<article class="gr-rules-card"><div class="gr-rules-top"><span>02</span><strong>ВИМОГИ ДО УЧАСНИКІВ</strong><span>↗</span></div><p class="gr-rule-copy">'+esc(requirements)+'</p></article></div>'+
  '</div></section>'+
  '<section class="gr-section gr-news" id="news"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">05 — ЖИТТЯ СІМ’Ї</span><h2>НОВИНИ<br><span>GRIZZLY.</span></h2></div><p>Офіційні повідомлення, події та досягнення нашої сім’ї.</p></div>'+renderPublicNews()+'</div></section>'+
  '<section class="gr-section gr-achievements" id="achievements"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">06 — НАША ГОРДІСТЬ</span><h2>ДОСЯГНЕННЯ<br><span>GRIZZLY.</span></h2></div><p>Перемоги, нагороди й визначні моменти, які формують нашу історію.</p></div><div id="gr-achievements-content">'+renderPublicAchievements()+'</div></div></section>'+
  '<section class="gr-section gr-gallery" id="gallery"><div class="gr-container"><div class="gr-section-heading gr-heading-row"><div><span class="gr-kicker">07 — ЗАКАРБОВАНІ МОМЕНТИ</span><h2>НАША ІСТОРІЯ<br><span>У КАДРАХ.</span></h2></div><p>Моменти з життя сім’ї GRIZZLY — від командних боїв до спільних зустрічей.</p></div>'+
   '<div id="gr-gallery-content">'+renderPublicGallery()+'</div>'+
  '</div></section>'+
  '<section class="gr-section gr-join" id="join"><div class="gr-container gr-join-layout"><div class="gr-join-info"><span class="gr-kicker">08 — ПРИЄДНАЙСЯ ДО НАС</span><h2>ТВОЄ МІСЦЕ<br><span>СЕРЕД СВОЇХ.</span></h2><p>Готовий стати частиною GRIZZLY? Заповни анкету — рекрутер розгляне твою заявку.</p><div class="gr-join-steps"><div><span>01</span><p>Заповни анкету</p></div><div><span>02</span><p>Дочекайся розгляду</p></div><div><span>03</span><p>Приєднайся до команди</p></div></div></div>'+
    '<div class="gr-join-form"><div class="gr-form-header"><span>ЗАЯВКА НА ВСТУП</span><small>GRIZZLY / RECRUITMENT</small></div>'+
     '<form id="apply-form" class="formgrid">'+
       '<div class="field"><label for="gr-nick">Ігровий нікнейм *</label><input id="gr-nick" class="input" name="nickname" required maxlength="80" autocomplete="off" placeholder="Наприклад, Player Grizzly"></div>'+
       '<div class="field"><label for="gr-game-id">Ігровий ID *</label><input id="gr-game-id" class="input" name="game_id" required maxlength="40" placeholder="Ваш ID у грі"></div>'+
       '<div class="field"><label for="gr-discord">Discord</label><input id="gr-discord" class="input" name="discord" maxlength="120" autocomplete="off" placeholder="Ваш Discord"></div>'+
       '<div class="field"><label for="gr-experience">Досвід GTA RP</label><input id="gr-experience" class="input" name="experience" maxlength="700" placeholder="Де грали раніше"></div>'+
       '<div class="field full"><label for="gr-motivation">Чому хочеш вступити? *</label><textarea id="gr-motivation" class="textarea" name="motivation" required minlength="10" maxlength="1400" placeholder="Розкажи про себе, свій досвід та цілі"></textarea></div>'+
       '<button class="gr-button gr-button-primary gr-submit full" type="submit">Надіслати заявку <span>↗</span></button>'+
       '<p class="gr-form-note full">Заявка не створює акаунт автоматично. Дані доступу видає керівництво після рішення.</p>'+
     '</form></div></div></section>'+
  '</main>'+
  '<footer class="gr-footer"><div class="gr-container"><div class="gr-footer-top"><a href="#home" class="gr-footer-brand">GRIZZLY<span>.</span></a><p>Сила в єдності.<br>Повага — у вчинках.</p><a href="#home" class="gr-back-top">НАГОРУ ↑</a></div><div class="gr-footer-bottom"><span>© '+new Date().getFullYear()+' GRIZZLY FAMILY · GTA 5 RP</span><span>MADE FOR THE FAMILY. BUILT ON LOYALTY.</span>'+(discord?'<a href="'+esc(discord)+'" target="_blank" rel="noopener noreferrer">DISCORD ↗</a>':'<a href="#join">ВСТУПИТИ ↗</a>')+'</div></div></footer>'+
  '</div>';
}
function loginModal(){modal('Вхід до панелі',`<p class="modal-desc">Логін і пароль видає керівник сім’ї. Реєстрація після заявки не відбувається автоматично.</p><form id="login-form" class="stack"><div class="field"><label>Логін</label><input class="input" name="username" autocomplete="username" required autofocus></div><div class="field"><label>Пароль</label><input class="input" type="password" name="password" autocomplete="current-password" required></div><button type="submit" class="btn">Увійти →</button></form>`);}
function modal(title,html){$('#modal-root').innerHTML=`<div class="modal-backdrop" data-backdrop="1"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h3>${esc(title)}</h3><button type="button" data-action="close-modal" class="iconbtn">✕</button></div><div class="modal-body">${html}</div></div></div>`;const first=$('#modal-root input:not([type=hidden])');if(first)setTimeout(()=>first.focus(),20);}
function closeModal(){$('#modal-root').innerHTML='';state.galleryLightboxId=null;}
function visible(n){if(['audit','settings'].includes(n.id)&&state.user.role!=='leader')return false;if(n.id==='applications'&&!can('recruitment:manage'))return false;if(['public_news','public_team','public_achievements'].includes(n.id)&&!can('content:manage'))return false;if(n.id==='discipline'&&!can('discipline:manage'))return false;if(n.id==='contracts'&&!can('finance:read')&&!can('finance:manage'))return true;return true;}
function sidebar(){let current='';return `<aside class="sidebar"><div class="sidebrand"><div class="brand"><span class="brand-mark">🐻</span>GRIZZLY</div><span class="sub">FAMILY CONTROL</span></div><nav class="side-scroll"><a class="sideitem" href="/?view=public#home"><span class="ni">↗</span> Публічний сайт</a>${nav.filter(visible).map(n=>{let group='';if(n.group!==current){current=n.group;group=`<div class="nav-group">${esc(current)}</div>`;}return `${group}<a href="#${n.id}" class="sideitem ${state.route===n.id?'active':''}" data-route="${n.id}"><span class="ni">${n.icon}</span>${esc(n.text)}</a>`;}).join('')}</nav><div class="side-bottom"><div class="row"><div class="avatar">${esc((state.user.nickname||state.user.username).slice(0,1).toUpperCase())}</div><div style="min-width:0"><strong class="small">${esc(state.user.nickname||state.user.username)}</strong><div class="muted small">${esc(roles[state.user.role])}</div></div></div><button class="btn ghost tiny sidebar-logout" data-action="logout">Вийти ↗</button></div></aside>`;}
function shell(content){const unread=state.notifications.filter(x=>!x.read_at).length;$('#app').innerHTML=`<div class="shell ${state.menu?'menu-open':''}">${sidebar()}<div class="app-main"><header class="topbar"><div class="row"><button class="iconbtn mobile-menu" data-action="toggle-menu">☰</button><div><small>GRIZZLY / ${esc(roles[state.user.role])}</small><h2>${esc(nav.find(n=>n.id===state.route)?.text||'Огляд')}</h2></div></div><div class="row"><div class="notif-menu"><button class="iconbtn" data-action="notifications" aria-label="Сповіщення">♧${unread?'<span class="alert-dot"></span>':''}</button><div id="notif-pop" class="notif-pop hide"></div></div><button class="iconbtn" data-route="profile" title="Мій профіль">◌</button></div></header><div class="app-content">${content}</div></div></div>`;}
function notifyPopup(){const el=$('#notif-pop');if(!el)return;el.classList.toggle('hide');el.innerHTML=`<div class="card-head"><h3>Сповіщення</h3><span class="pill">${state.notifications.filter(x=>!x.read_at).length} нових</span></div>${state.notifications.length?state.notifications.slice(0,12).map(n=>`<div class="notif-item"><div class="row space"><strong class="small">${esc(n.title)}</strong>${n.read_at?'':`<button class="btn tiny ghost" data-action="read-notification" data-id="${esc(n.id)}">✓</button>`}</div><div class="muted small">${esc(n.details)}</div><div class="muted small">${date(n.created_at)}</div></div>`).join(''):empty('Немає сповіщень','Нові події з’являться тут.')}`;}
function table(headers,rows){return rows.length?`<div class="tablewrap"><table><thead><tr>${headers.map(s=>`<th>${esc(s)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:empty();}
function searchBar(){return `<input id="search-input" class="input" aria-label="Пошук" placeholder="⌕  Пошук за назвою, ніком, ID…" value="${esc(state.search)}">`;}
function filterControls(){return `<div class="row wrap"><select class="select" style="width:auto" id="status-filter"><option value="">Усі статуси</option>${statuses.map(x=>`<option ${state.filter===x?'selected':''}>${x}</option>`).join('')}</select><select class="select" style="width:auto" id="sort-select"><option value="new" ${state.sort==='new'?'selected':''}>Спочатку нові</option><option value="old" ${state.sort==='old'?'selected':''}>Спочатку старі</option><option value="name" ${state.sort==='name'?'selected':''}>За назвою</option></select></div>`;}
function applyFilters(items){return items.filter(x=>!state.filter||x.status===state.filter).sort((a,b)=>state.sort==='name'?String(a.title||a.nickname||'').localeCompare(String(b.title||b.nickname||''),'uk'):state.sort==='old'?String(a.created_at||'').localeCompare(String(b.created_at||'')):String(b.created_at||'').localeCompare(String(a.created_at||'')));}
function exportButton(mod){return `<button class="btn tiny ghost" data-action="export" data-module="${esc(mod)}">↓ Експорт JSON</button>`;}

function searchMatch(...fields){return !state.search||fields.some(x=>String(x||'').toLowerCase().includes(state.search.toLowerCase()));}
function selectOptions(items,val,emptyName='Не призначено'){return `<option value="">${esc(emptyName)}</option>${items.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(val)?'selected':''}>${esc(x.title||x.nickname||x.username)}</option>`).join('')}`;}
function field(label,name,value='',type='text',full=false,other=''){return `<div class="field ${full?'full':''}"><label>${esc(label)}</label>${type==='textarea'?`<textarea class="textarea" name="${name}" ${other}>${esc(value)}</textarea>`:`<input class="input" type="${type}" name="${name}" value="${esc(value)}" ${other}>`}</div>`;}
function selectField(label,name,items,value='',full=false){return `<div class="field ${full?'full':''}"><label>${esc(label)}</label><select name="${name}" class="select">${selectOptions(items,value)}</select></div>`;}
function statusField(value){return `<div class="field"><label>Статус</label><select class="select" name="status">${statuses.map(s=>`<option ${s===value?'selected':''}>${s}</option>`).join('')}</select></div>`;}
function formatDateField(v){return (v||'').slice(0,16);}
async function overview(){const [st,fin,taskList,reportList,eventList]=await Promise.all([api('/stats'),api('/finance'),api('/records/tasks'),api('/records/reports'),api('/records/events')]);const stats=st;const upcoming=eventList.items.filter(e=>e.starts_at&&new Date(e.starts_at).getTime()>=Date.now()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,4);return `${intro('Вітаємо в Grizzly',`Панель керування сім’єю · ${date(new Date().toISOString())}`)}<div class="stack"><div class="dashboard-welcome"><div><div class="overline">FAMILY OPERATIONS</div><h2>Разом сильніші. 🐻</h2><p>Твої завдання, звіти та активність в одному місці.</p></div><span class="bear">🐻</span></div><div class="cards"><div class="card stat"><span class="stat-symbol">♟</span><div class="muted small">Учасники</div><div class="number">${stats.members===null?'—':fmt(stats.members)}</div></div><div class="card stat"><span class="stat-symbol">☑</span><div class="muted small">Активні завдання</div><div class="number">${fmt(stats.tasks_active)}</div></div><div class="card stat"><span class="stat-symbol">☷</span><div class="muted small">На перевірці</div><div class="number">${fmt(stats.reports_review)}</div></div><div class="card stat"><span class="stat-symbol">◈</span><div class="muted small">Найближчі заходи</div><div class="number">${fmt(stats.events_upcoming)}</div></div></div><div class="grid2"><div class="card"><div class="card-head"><h3>Найближчі заходи</h3><button class="btn tiny secondary" data-route="events">Усі заходи ↗</button></div>${upcoming.length?upcoming.map(x=>`<div class="row space mb"><div><strong>${esc(x.title)}</strong><div class="muted small">${esc(x.starts_at.replace('T',' '))} · ${esc(x.details.slice(0,90))}</div></div>${badge(x.status)}</div>`).join(''):empty('Заходів ще не заплановано')}</div><div class="card"><div class="card-head"><h3>Швидкі дії</h3></div><div class="stack"><button class="btn secondary" data-action="new-record" data-module="reports">＋ Подати звіт</button><button class="btn secondary" data-route="tasks">☑ Переглянути завдання</button><button class="btn secondary" data-route="finance">₴ Мої виплати: ${fmt(fin.own_total)}</button>${can('members:write')?'<button class="btn secondary" data-action="new-user">♟ Створити акаунт</button>':''}</div></div></div><div class="card"><div class="card-head"><h3>Останні завдання</h3><button class="btn tiny ghost" data-route="tasks">Переглянути →</button></div>${taskList.items.length?table(['Назва','Виконавець','Статус'],taskList.items.slice(0,5).map(x=>`<tr><td class="table-title">${esc(x.title)}</td><td>${esc(userName(x.assignee_id))}</td><td>${badge(x.status)}</td></tr>`)):empty('Немає завдань')}</div></div>`;}
async function members(){const list=applyFilters(state.users.filter(u=>searchMatch(u.nickname,u.username,u.game_id,u.discord,departmentName(u.department_id))));return `${intro('Склад сім’ї','Акаунти створює керівництво. Роль доступу та ігровий ранг — окремі параметри.',can('members:write')?'<button class="btn" data-action="new-user">＋ Додати учасника</button>':'')}<div class="toolbar">${searchBar()}<span class="muted small">${list.length} учасників</span>${exportButton('users')}</div>${table(['Учасник','Роль / ранг','Напрямок','Ігровий ID','Активність','Дії'],list.map(u=>`<tr><td><strong>${esc(u.nickname||u.username)}</strong><div class="muted">@${esc(u.username)} · ${esc(u.discord||'без Discord')}</div></td><td>${esc(roles[u.role])}<div class="muted">${esc(rankName(u.rank_id))}</div></td><td>${esc(departmentName(u.department_id))}</td><td>${esc(u.game_id||'—')}</td><td>${badge(u.status)}<div class="muted">${esc(u.activity)}</div></td><td><button class="btn tiny secondary" data-action="edit-user" data-id="${esc(u.id)}">Особова справа</button></td></tr>`))}`;}
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
async function ranks(){const entries=state.ranks.filter(r=>searchMatch(r.title,r.requirements));const placeholders=state.ranks.filter(r=>Number(r.is_example)===1&&r.title===`Ранг ${String(r.id).padStart(2,'0')} — приклад`);return `${intro('15 рангів Grizzly','Ігрова ієрархія не визначає права доступу до сайту. Усі початкові назви — редаговані приклади.',state.user.role==='leader'&&placeholders.length?'<button class="btn" data-action="preview-rank-templates">🐻 Заповнити ранги Grizzly</button>':'')}<div class="toolbar">${searchBar()}<span class="pill">${entries.length} рангів</span></div><div class="grid3">${entries.map(r=>`<div class="card"><div class="card-head"><span class="overline">РАНГ ${String(r.id).padStart(2,'0')}</span>${r.is_example?'<span class="pill">Приклад</span>':''}</div><h3>${esc(r.title)}</h3><p class="muted small mt longtext">${esc(r.requirements)}</p>${JSON.parse(r.checklist||'[]').length?`<div class="mt small muted">${JSON.parse(r.checklist).map(x=>`✓ ${esc(x)}`).join(' · ')}</div>`:''}${state.user.role==='leader'?`<button class="btn tiny secondary mt" data-action="edit-rank" data-id="${r.id}">Налаштувати →</button>`:''}</div>`).join('')}</div>`;}
function rankForm(id){const r=state.ranks.find(x=>x.id===Number(id));modal(`Редагування рангу ${id}`,`<form id="rank-form" data-id="${id}" class="formgrid">${field('Назва рангу','title',r.title,'text',true,'required')}${field('Умови підвищення','requirements',r.requirements,'textarea',true)}${field('Чекліст (кожна вимога з нового рядка)','checklist',JSON.parse(r.checklist||'[]').join('\n'),'textarea',true)}<div class="full form-actions"><button class="btn" type="submit">Зберегти ранг</button></div></form>`);}
async function departments(){const list=state.departments;return `${intro('Напрямки сім’ї','Керівники напрямків працюють лише зі своїм підрозділом.')}<div class="grid3">${list.map(d=>`<div class="card"><span class="overline">ПІДРОЗДІЛ</span><h3 class="mt">${esc(d.title)}</h3><p class="muted small mt">Відповідальний: ${esc(userName(d.head_id))}</p><p class="muted small">Учасників: ${state.users.filter(u=>u.department_id===d.id).length}</p>${state.user.role==='leader'?`<button class="btn tiny secondary mt" data-action="edit-department" data-id="${esc(d.id)}">Налаштувати →</button>`:''}</div>`).join('')}</div>`;}
function departmentForm(id){const d=state.departments.find(x=>x.id===id);modal('Налаштувати напрямок',`<form id="department-form" data-id="${esc(id)}" class="formgrid">${field('Назва напрямку','title',d.title,'text',true,'required')}${selectField('Керівник','head_id',state.users,d.head_id,true)}<div class="full form-actions"><button class="btn" type="submit">Зберегти</button></div></form>`);}
const evidenceText=r=>(r?.evidence||[]).join('\n');
function links(r){return (r.evidence||[]).length?`<div class="row wrap">${r.evidence.map((v,i)=>`<a class="small gallery-link" href="${esc(v)}" target="_blank" rel="noopener noreferrer">Доказ ${i+1} ↗</a>`).join('')}</div>`:'<span class="muted small">Без доказів</span>';}
async function renderModule(mod){const cfg=moduleInfo[mod];if(!cfg)return empty('Розділ відсутній');if(mod==='blacklist'&&!can('discipline:manage'))return empty('Недостатньо прав');const data=await api(`/records/${mod}`);const list=applyFilters(data.items.filter(x=>searchMatch(x.title,x.details,x.status,userName(x.assignee_id))));const create=can(cfg[2])||['reports','promotions','capt_attendance','vehicle_loans'].includes(mod);return `${intro(cfg[0],cfg[1],create?`<button class="btn" data-action="new-record" data-module="${mod}">＋ Додати запис</button>`:'')}<div class="toolbar">${searchBar()}${filterControls()}${exportButton(mod)}<span class="muted small">${list.length} записів</span></div>${table(['Назва / опис','Відповідальний','Статус','Дата','Дії'],list.map(x=>`<tr><td class="table-title">${esc(x.title)}<div class="muted wordwrap" style="max-width:330px">${esc(x.details.slice(0,110))}</div></td><td>${esc(userName(x.assignee_id||x.owner_id))}<div class="muted">${esc(departmentName(x.department_id))}</div></td><td>${badge(x.status)}</td><td>${date(x.starts_at||x.created_at)}</td><td><button class="btn tiny secondary" data-action="view-record" data-id="${esc(x.id)}" data-module="${mod}">Відкрити ↗</button></td></tr>`))}`;}
function recordExtraFields(mod,r){const ex=r?.extra||{};const text=(label,key)=>field(label,`extra_${key}`,ex[key]||'');const area=(label,key)=>field(label,`extra_${key}`,Array.isArray(ex[key])?ex[key].join('\n'):ex[key]||'','textarea',true);const pick=(label,key,opts)=>`<div class="field"><label>${esc(label)}</label><select class="select" name="extra_${key}">${opts.map(([v,t])=>`<option value="${v}" ${ex[key]===v?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`;
 switch(mod){
 case 'promotions':return `<div class="field full"><label>Цільовий ранг *</label><select name="extra_requested_rank_id" class="select" required><option value="">Оберіть ранг</option>${state.ranks.map(rank=>`<option value="${rank.id}" ${Number(ex.requested_rank_id)===rank.id?'selected':''}>${esc(rank.title)}</option>`).join('')}</select><small>Перевірте умови рангу у розділі «Ранги»</small></div>${area('Виконані умови / чекліст (по одному пункту)','checklist_completed')}`;
 case 'capt_matches':return `${text('Суперник','opponent')}${text('Місце проведення','place')}${field('Кількість місць в основному складі (1–50)','extra_lineup_limit',ex.lineup_limit??8,'number',false,'min="1" max="50" step="1"')}${area('Ручні примітки щодо складу (не впливають на автоматичний набір)','lineup')}<div class="field"><label>Підсумок бою (для статистики)</label><select class="select" name="extra_outcome">${[['','Не вказано'],['win','Перемога'],['loss','Поразка'],['draw','Нічия'],['cancelled','Скасовано']].map(([v,label])=>`<option value="${v}" ${ex.outcome===v?'selected':''}>${label}</option>`).join('')}</select></div>${text('Результат / рахунок','result')}`;
 case 'capt_training':return `${text('Тема тренування','topic')}${text('Інструктор','instructor')}`;
 case 'capt_attendance':return `${pick('Тип участі','attendance_type',[['battle','Бій'],['afk','AFK']])}${text('ID бою / тренування','match_id')}${text('Відмітка відвідування','attendance_note')}`;
 case 'vehicles':return `${text('Номер транспорту','plate')}${text('Марка / модель','model')}${text('Стан (справний / ремонт)','condition')}${text('Відповідальний (нік)','responsible')}`;
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
function moduleForm(mod,r){const cfg=moduleInfo[mod],isEdit=!!r;const canManage=can(cfg[2]);const x=r||{};const fields=`<form id="record-form" data-module="${mod}" data-id="${esc(r?.id||'')}" class="formgrid">${field('Назва / тема *','title',x.title,'text',true,'required maxlength="160"')}${field('Опис / RP-звіт','details',x.details,'textarea',true)}${recordExtraFields(mod,r)}${canManage?`${statusField(x.status||'Заплановано')}${selectField('Виконавець','assignee_id',state.users,x.assignee_id)}${selectField('Напрямок','department_id',state.departments,x.department_id)}${field('Сума / винагорода (ігрова валюта)','amount',x.amount||0,'number',false,'min="0" step="1"')}${field('Початок','starts_at',formatDateField(x.starts_at),'datetime-local')}${field('Термін / завершення','ends_at',formatDateField(x.ends_at),'datetime-local')}`:''}${field('Докази ImgBB (кожне посилання з нового рядка)','evidence',evidenceText(x),'textarea',true)}${canManage?field('Додаткові дані (JSON: склад, номер ТЗ, стан, чекліст тощо)','extra',JSON.stringify(x.extra||{},null,2),'textarea',true):''}<div class="full form-actions"><button type="button" class="btn ghost" data-action="close-modal">Скасувати</button><button type="submit" class="btn">${isEdit?'Зберегти':'Створити'}</button></div></form>`;modal(`${isEdit?'Редагувати':'Створити'} · ${cfg[0]}`,`${isEdit?`<div class="notice mb">Запис із перевіркою версії: чужі зміни не будуть перезаписані.</div>`:''}${fields}`);}
async function viewRecord(mod,id){const rows=(await api(`/records/${mod}`)).items;const r=rows.find(x=>x.id===id);if(!r)return toast('Запис недоступний',true);const payoutState=mod==='capt_attendance'?(await api('/capt/overview')).attendance.find(x=>x.id===id):null;const canManage=can(moduleInfo[mod][2])&&(state.user.role!=='head'||r.department_id===state.user.department_id);const canEdit=canManage||((r.owner_id===state.user.id||r.assignee_id===state.user.id)&&['reports','promotions','capt_attendance','vehicle_loans','tasks'].includes(mod));const review=canManage&&['reports','promotions'].includes(mod)&&r.owner_id!==state.user.id;const status=mod==='events'?`<div class="hr"></div><div id="rsvp-content" class="muted small">Завантаження учасників…</div>`:'';modal(r.title,`<div class="stack"><div class="row space">${badge(r.status)}<span class="muted small">v${r.version} · ${date(r.updated_at)}</span></div><div class="longtext">${esc(r.details||'Опис не додано')}</div><div class="small muted">Відповідальний: ${esc(userName(r.assignee_id||r.owner_id))} · ${esc(departmentName(r.department_id))}</div>${r.amount?`<div class="small">Винагорода: <strong>${fmt(r.amount)}</strong></div>`:''}${r.starts_at?`<div class="small">Початок: ${esc(r.starts_at.replace('T',' '))}</div>`:''}${links(r)}${Object.keys(r.extra||{}).length?`<div class="card flat"><strong>Додаткова інформація</strong><div class="stack mt small">${Object.entries(r.extra).filter(([k])=>k!=='review_nonce').map(([k,v])=>`<div><span class="muted">${esc(({requested_rank_id:'Цільовий ранг',checklist_completed:'Виконані умови',opponent:'Суперник',place:'Місце',lineup:'Склад на бій',result:'Результат',attendance_type:'Тип участі',match_id:'Бій / тренування',plate:'Номер ТЗ',condition:'Стан',responsible:'Відповідальний',review_comment:'Коментар керівника'})[k]||k)}:</span> <strong>${esc(Array.isArray(v)?v.join(', '):v)}</strong></div>`).join('')}</div></div>`:''}${status}${mod==='capt_matches'?'<div class="hr"></div><section id="capt-signup-panel" class="stack"><p class="muted">Завантаження списку учасників…</p></section>':''}<div class="form-actions">${review?`<button class="btn secondary" data-action="review-record" data-module="${mod}" data-id="${id}">Перевірити</button>`:''}${canEdit?`<button class="btn" data-action="edit-record" data-module="${mod}" data-id="${id}">Редагувати</button>`:''}${mod==='templates'?`<button class="btn secondary" data-action="copy-template" data-id="${id}">Копіювати текст</button>`:''}${mod==='capt_attendance'&&payoutState?.paid===true?'<span class="pill">CAPT-виплату проведено</span>':mod==='capt_attendance'&&r.status==='Погоджено'&&can('finance:manage')?`<button class="btn" data-action="capt-pay" data-id="${id}">₴ Нарахувати CAPT</button>`:''}${canManage?`<button class="btn danger" data-action="delete-record" data-module="${mod}" data-id="${id}">Видалити</button>`:''}</div></div>`);if(mod==='capt_matches')await renderCaptSignupPanel(id);if(mod==='events'){try{const rs=await api(`/rsvp/${id}`);const el=$('#rsvp-content');if(el)el.innerHTML=`<div class="row wrap"><strong>Моя участь: ${esc(rs.own||'Не підтверджено')}</strong><span class="muted">Так: ${rs.counts.yes} · Ні: ${rs.counts.no}</span></div><div class="row mt"><button class="btn tiny" data-action="rsvp" data-id="${id}" data-value="Так">✓ Буду</button><button class="btn tiny ghost" data-action="rsvp" data-id="${id}" data-value="Ні">Не зможу</button></div>${rs.items.length?`<div class="muted small mt">${rs.items.map(i=>`${esc(userName(i.user_id))}: ${esc(i.response)}`).join(' · ')}</div>`:''}`;}catch(e){toast(e.message,true);}}}
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
function reviewModal(mod,id){modal('Рішення керівництва',`<form id="review-form" data-module="${mod}" data-id="${id}" class="stack"><div class="field"><label>Рішення</label><select name="status" class="select"><option>Погоджено</option><option>На доопрацювання</option><option>Відхилено</option></select></div>${field('Коментар керівника','comment','','textarea',true)}<button class="btn" type="submit">Зберегти рішення</button></form>`);}
function grouped(mods,title,description){const active=state.sub[state.route]||mods[0];return `<div class="tabs mb">${mods.map(m=>`<button data-action="change-sub" data-value="${m}" class="tab ${m===active?'active':''}">${esc(moduleInfo[m][0])}</button>`).join('')}</div>`;}
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

async function applications(){const list=applyFilters((await api('/applications')).items.filter(x=>searchMatch(x.nickname,x.game_id,x.status)));return `${intro('Заявки на вступ','Перегляд кандидатів і рішення рекрутера. Акаунти створюються окремо.')}<div class="toolbar">${searchBar()}${filterControls()}${exportButton('applications')}<span class="muted small">${list.length} заявок</span></div>${table(['Кандидат','Досвід','Статус','Дата','Дії'],list.map(a=>`<tr><td class="table-title">${esc(a.nickname)}<div class="muted">ID: ${esc(a.game_id)} · ${esc(a.discord||'Без Discord')}</div></td><td class="wordwrap">${esc(a.experience.slice(0,80))}</td><td>${badge(a.status)}</td><td>${date(a.created_at)}</td><td><button class="btn tiny secondary" data-action="review-app" data-id="${esc(a.id)}">Розглянути</button></td></tr>`))}`;}
async function appReview(id){const app=(await api('/applications')).items.find(a=>a.id===id);if(!app)return;modal('Заявка · '+app.nickname,`<div class="stack"><div class="card flat"><div><strong>Ігровий ID: ${esc(app.game_id)}</strong></div><div>Discord: ${esc(app.discord||'—')}</div><div>Досвід: ${esc(app.experience)}</div><div class="hr"></div><div class="longtext">${esc(app.motivation)}</div></div><form id="app-review-form" data-id="${esc(id)}" class="stack"><div class="field"><label>Статус</label><select class="select" name="status">${statuses.map(s=>`<option ${s===app.status?'selected':''}>${s}</option>`).join('')}</select></div>${field('Коментар рекрутера','comment',app.comment,'textarea',true)}<button class="btn" type="submit">Зберегти рішення</button></form><div class="notice">Погодження заявки не створює акаунт. За потреби лідер видає логін і пароль вручну.</div></div>`);}
async function contracts(){const list=applyFilters((await api('/contracts')).items.filter(x=>searchMatch(x.title,x.status,x.details)));return `${intro('Контракти','До виплати — точний розрахунок; після підтвердження — захист від повторного нарахування.',can('finance:manage')?'<button class="btn" data-action="new-contract">＋ Новий контракт</button>':'')}<div class="notice mb">Правило за замовчуванням: 20% до казни, решта порівну між учасниками. Відсоток задається керівником; округлення додається до казни.</div><div class="toolbar">${searchBar()}${filterControls()}${exportButton('contracts')}<span class="muted small">${list.length} контрактів</span></div>${table(['Контракт','Сума','Учасники','Казна','Статус','Дії'],list.map(c=>`<tr><td class="table-title">${esc(c.title)}<div class="muted">${esc(c.details.slice(0,85))}</div></td><td class="mono">${fmt(c.amount)}</td><td>${c.participant_ids.length}</td><td>${c.treasury_percent}%</td><td>${badge(c.status)}</td><td><button class="btn tiny secondary" data-action="view-contract" data-id="${c.id}">Деталі ↗</button></td></tr>`))}`;}
async function contractForm(id){const old=id?(await api('/contracts')).items.find(c=>c.id===id):null;const s=await api('/settings');const c=old||{participant_ids:[],treasury_percent:s.items.treasury_percent||20};const checks=state.users.map(u=>`<label class="row small" style="gap:7px"><input type="checkbox" name="participant" value="${esc(u.id)}" ${c.participant_ids.includes(u.id)?'checked':''}>${esc(u.nickname||u.username)} (${esc(u.username)})</label>`).join('')||empty('Додайте учасників спочатку');modal(old?'Редагувати контракт':'Новий контракт',`<form id="contract-form" data-id="${esc(id||'')}" class="formgrid">${field('Назва *','title',c.title,'text',true,'required')}${field('Опис','details',c.details,'textarea',true)}${field('Сума (ціле число)','amount',c.amount??0,'number',false,'required min="0" step="1"')}${field('Відсоток казни','treasury_percent',c.treasury_percent,'number',false,'min="0" max="100"')}${statusField(c.status||'Заплановано')}<div class="field full"><label>Учасники контракту *</label><div class="card flat stack" style="max-height:220px;overflow:auto">${checks}</div></div>${field('Докази ImgBB (за рядками)','evidence',(c.evidence||[]).join('\n'),'textarea',true)}<div class="full form-actions"><button class="btn" type="submit">Зберегти контракт</button></div></form>`);}
async function contractView(id){const c=(await api('/contracts')).items.find(x=>x.id===id);if(!c)return;const p=(await api(`/contracts/${id}/preview`)).preview;modal('Контракт · '+c.title,`<div class="stack"><div class="row space">${badge(c.status)}<span class="muted small">Версія: ${c.version}</span></div><p class="longtext">${esc(c.details)}</p><div class="grid2"><div class="card flat"><div class="muted small">Загальна сума</div><h2>${fmt(p.amount)}</h2></div><div class="card flat"><div class="muted small">Казна (${p.treasury_percent}%)</div><h2>${fmt(p.treasury)}</h2></div><div class="card flat"><div class="muted small">На учасника (${p.participants})</div><h2>${fmt(p.per_member)}</h2></div><div class="card flat"><div class="muted small">Залишок округлення → казна</div><h2>${fmt(p.rounding_remainder)}</h2></div></div><div class="card flat"><h3>Розподіл</h3><div class="stack mt">${p.allocations.map(a=>`<div class="row space small"><span>${esc(userName(a.user_id))}</span><strong>${fmt(a.amount)}</strong></div>`).join('')}</div></div>${links(c)}${c.settled_at?'<div class="notice">Виплати вже проведено. Повторне нарахування неможливе.</div>':''}${can('finance:manage')?`<div class="form-actions">${!c.settled_at?`<button class="btn secondary" data-action="edit-contract" data-id="${c.id}">Редагувати</button>`:''}${c.status==='Погоджено'&&!c.settled_at?`<button class="btn" data-action="settle-contract" data-id="${c.id}" data-version="${c.version}">✓ Підтвердити нарахування</button>`:''}</div>`:''}</div>`);}
async function finance(){const f=await api('/finance');const allowed=can('finance:read')||can('finance:manage');return `${intro('Фінанси та виплати',allowed?'Казна, надходження, витрати і нарахування учасникам.':'Тільки ваш власний баланс та підтверджені виплати.',can('finance:manage')?'<button class="btn" data-action="new-ledger">＋ Додати операцію</button>':'')}<div class="cards"><div class="card stat"><div class="muted small">Мої виплати</div><div class="number">${fmt(f.own_total)}</div></div>${allowed?`<div class="card stat"><div class="muted small">Баланс казни</div><div class="number">${fmt(f.treasury_balance)}</div></div><div class="card stat"><div class="muted small">Виплати за контрактами</div><div class="number">${fmt(f.payout_total)}</div></div><div class="card stat"><div class="muted small">Внески</div><div class="number">${fmt(f.totals.contribution||0)}</div></div>`:''}</div><div class="grid2 mt"><div class="card"><div class="card-head"><h3>Мої контрактні виплати</h3></div>${table(['Контракт','Сума','Дата'],f.own_payouts.map(p=>`<tr><td class="table-title">${esc(p.contract_title)}</td><td class="mono success">+${fmt(p.amount)}</td><td>${date(p.created_at)}</td></tr>`))}</div><div class="card"><div class="card-head"><h3>CAPT та премії</h3></div>${table(['Тип','Сума','Дата'],(f.own_extra||[]).map(p=>`<tr><td>${p.kind==='capt'?'CAPT':'Премія'}<div class="muted">${esc(p.description)}</div></td><td class="mono success">+${fmt(p.amount)}</td><td>${date(p.created_at)}</td></tr>`))}</div></div>${allowed?`<div class="card mt"><div class="card-head"><h3>Журнал казни</h3><button class="btn tiny secondary" data-action="view-ledger">Відкрити</button></div><div class="grid3">${Object.entries(f.totals).map(([k,v])=>`<div><span class="muted small">${esc(({treasury:'Контракти → казна',contribution:'Внески',expense:'Витрати',bonus:'Премії',capt:'CAPT'})[k]||k)}</span><h3 class="mono">${fmt(v)}</h3></div>`).join('')}</div></div>`:''}`;}
async function ledgerModal(){const l=(await api('/ledger')).items;modal('Журнал фінансових операцій',`${table(['Тип','Сума','Кому','Опис / дата'],l.map(r=>`<tr><td>${esc(r.kind)}</td><td class="mono">${fmt(r.amount)}</td><td>${esc(userName(r.recipient_id))}</td><td class="wordwrap">${esc(r.description)}<div class="muted">${date(r.created_at)}</div></td></tr>`))}`);}
function ledgerForm(){modal('Нова фінансова операція',`<form id="ledger-form" class="formgrid"><div class="field"><label>Тип операції</label><select class="select" name="kind"><option value="contribution">Внесок до казни</option><option value="expense">Витрата</option><option value="bonus">Премія учаснику</option><option value="capt">Виплата CAPT</option></select></div>${field('Сума','amount','0','number',false,'required min="1" step="1"')}${selectField('Отримувач (обов’язковий для премій та CAPT)','recipient_id',state.users,'',true)}${field('Підстава / коментар','description','','textarea',true)}<div class="notice full">CAPT-ставки змінюються керівником у налаштуваннях. Не дублюйте вже проведені виплати.</div><div class="full form-actions"><button class="btn" type="submit">Провести операцію</button></div></form>`);}
async function stats(){const s=await api('/stats');const leaderboard=(state.period==='month'?s.leaderboard_month:s.leaderboard_week)||s.leaderboard||[];return `${intro('Статистика сім’ї','Активність за останні 7 і 30 днів. Рейтинг враховує погоджені й завершені записи.')}<div class="grid2"><div class="card"><h3>За 7 днів</h3><div class="grid3 mt">${Object.entries(s.week).map(([k,v])=>`<div><span class="muted small">${esc(({tasks:'Завдання',reports:'Звіти',events:'Заходи',income:'Надходження'})[k])}</span><h2>${fmt(v)}</h2></div>`).join('')}</div></div><div class="card"><h3>За 30 днів</h3><div class="grid3 mt">${Object.entries(s.month).map(([k,v])=>`<div><span class="muted small">${esc(({tasks:'Завдання',reports:'Звіти',events:'Заходи',income:'Надходження'})[k])}</span><h2>${fmt(v)}</h2></div>`).join('')}</div></div></div><div class="card mt"><div class="card-head"><h3>Рейтинг активності</h3><select id="period-filter" class="select" style="width:auto"><option value="week" ${state.period==='week'?'selected':''}>За 7 днів</option><option value="month" ${state.period==='month'?'selected':''}>За 30 днів</option></select></div>${table(['Учасник','Завершено','Бали'],leaderboard.map((x,i)=>`<tr><td>${i+1}. ${esc(userName(x.user_id))}</td><td>${x.completed}</td><td class="mono">${x.points}</td></tr>`))}</div>`;}
async function auditPage(){const a=(await api('/audit')).items;return `${intro('Журнал змін','Хто, коли й що змінював. Доступ лише лідеру.')}<div class="toolbar">${searchBar()}</div>${table(['Дата','Користувач','Дія','Розділ','ID'],a.filter(x=>searchMatch(x.actor_name,x.action,x.entity,x.detail)).map(x=>`<tr><td>${esc(x.created_at.replace('T',' ').slice(0,19))}</td><td>${esc(x.actor_name)}</td><td>${esc(x.action)}<div class="muted">${esc(x.detail.slice(0,110))}</div></td><td>${esc(x.entity)}</td><td><span class="muted small">${esc(short(x.entity_id))}</span></td></tr>`))}`;}
async function settingsPage(){const response=await api('/settings');const s=response.items;state.settingsVersions=response.versions||{};return `${intro('Налаштування Grizzly','Редагування публічного сайту, правил, Discord та фінансових параметрів.')}<div class="card"><form id="settings-form" class="formgrid">${field('Назва сім’ї','family_name',s.family_name)}${field('Гасло','tagline',s.tagline)}${field('Історія сім’ї','history',s.history,'textarea',true)}${field('Посилання Discord','discord_url',s.discord_url,'url',true,'placeholder="https://discord.gg/..."')}${field('Правила','rules',s.rules,'textarea',true)}${field('Вимоги до кандидатів','requirements',s.requirements,'textarea',true)}${field('Відсоток казни від контрактів','treasury_percent',s.treasury_percent,'number',false,'min="0" max="100"')}${field('CAPT — ставка AFK','capt_afk_rate',s.capt_afk_rate,'number',false,'min="0"')}${field('CAPT — ставка за бій','capt_battle_rate',s.capt_battle_rate,'number',false,'min="0"')}<div class="full form-actions"><button class="btn" type="submit">Зберегти налаштування</button></div></form></div><div class="notice mt">Ставки CAPT застосовуються вручну при створенні виплат, щоб керівник контролював підставу нарахування. Права заступників задаються в особових справах.</div>`;}
async function profile(){const u=state.user;const sessions=(await api('/auth/sessions')).items;return `${intro('Мій профіль','Особисті дані, пароль та активні сесії.')}<div class="grid2"><div class="card"><h3>${esc(u.nickname||u.username)}</h3><div class="stack mt"><div>Логін: <strong>${esc(u.username)}</strong></div><div>Роль доступу: <strong>${esc(roles[u.role])}</strong></div><div>Ігровий ранг: <strong>${esc(rankName(u.rank_id))}</strong></div><div>Напрямок: <strong>${esc(departmentName(u.department_id))}</strong></div><div>Ігровий ID: <strong>${esc(u.game_id||'—')}</strong></div><div>Discord: <strong>${esc(u.discord||'—')}</strong></div></div><button class="btn tiny secondary mt" data-action="edit-user" data-id="${u.id}">Редагувати профіль</button></div><div class="card"><h3>Зміна пароля</h3><form id="password-form" class="stack mt">${field('Поточний пароль','old_password','','password',true,'required')}${field('Новий пароль (12–128 символів)','new_password','','password',true,'minlength="12" required')}<button class="btn" type="submit">Змінити пароль і завершити сесії</button></form></div></div><div class="card mt"><div class="card-head"><h3>Сесії</h3><span class="muted small">Завершення доступу з інших пристроїв</span></div>${table(['Створено','Термін дії','Пристрій','Дія'],sessions.map(x=>`<tr><td>${date(x.created_at)}</td><td>${date(x.expires_at)}</td><td class="wordwrap">${esc(x.user_agent.slice(0,100))}</td><td>${x.revoked_at?badge('Завершено'):`<button class="btn tiny danger" data-action="revoke-session" data-id="${esc(x.id)}">Завершити</button>`}</td></tr>`))}</div>`;}
async function render(){state.menu=false;let content='';try{if(!state.user){renderPublic();return;}if(['members','ranks','departments','contracts','settings','profile'].includes(state.route))await preload();switch(state.route){case'overview':content=await overview();break;case'members':content=await members();break;case'ranks':content=await ranks();break;case'departments':content=await departments();break;case'tasks':content=await renderModule('tasks');break;case'events':content=await renderModule('events');break;case'gallery':content=await galleryManager();break;case'public_news':content=await newsManager();break;case'public_team':content=await teamManager();break;case'public_achievements':content=await achievementsManager();break;case'contracts':content=await contracts();break;case'capt':content=await captPage();break;case'fleet':case'discipline':case'announcements':case'reports':content=await groupPage(state.route);break;case'finance':content=await finance();break;case'applications':content=await applications();break;case'stats':content=await stats();break;case'audit':content=await auditPage();break;case'settings':content=await settingsPage();break;case'profile':content=await profile();break;default:state.route='overview';content=await overview();}shell(content);}catch(e){if(e.status===401){state.user=null;state.route='overview';renderPublic();toast('Сесію завершено. Увійдіть повторно.',true);return;}shell(intro('Помилка завантаження',e.message)+`<button class="btn mt" data-action="refresh">Повторити</button>`);toast(e.message,true);}}
async function navigate(route){const url=new URL(location.href);if(url.searchParams.has('view')){url.searchParams.delete('view');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}state.route=route;state.search='';state.sort='new';state.filter='';state.menu=false;location.hash=route;await render();}
async function initial(){try{state.public=await api('/public');}catch(e){state.public={settings:{tagline:'Сила в єдності.'},gallery:[]};toast('Не вдалося отримати публічні дані. Перевірте D1 та міграції.',true);}try{state.user=(await api('/auth/me')).user;}catch{state.user=null;}if(state.user){try{state.notifications=(await api('/notifications')).items;await preload();}catch(e){toast(e.message,true);}state.route=location.hash.replace('#','')||'overview';}if(new URL(location.href).searchParams.get('view')==='public'){renderPublic();return;}await render();}
const lines=s=>String(s||'').split(/\n/).map(x=>x.trim()).filter(Boolean);
function formData(f){return Object.fromEntries(new FormData(f).entries());}
async function afterSaved(msg='Збережено'){closeModal();toast(msg);if(state.user){state.notifications=(await api('/notifications')).items;await preload();}if(['gallery','public_news','public_team','public_achievements'].includes(state.route))state.public=await api('/public');await render();}
async function handleSubmit(e){const f=e.target;if(!f.id)return;e.preventDefault();const b=formData(f);const submit=f.querySelector('[type=submit]');if(submit)submit.disabled=true;try{switch(f.id){
  case 'apply-form':await api('/apply','POST',b);f.reset();toast('Заявку надіслано. Очікуйте рішення рекрутера.');return;
  case 'login-form':state.user=(await api('/auth/login','POST',b)).user;closeModal();state.notifications=(await api('/notifications')).items;await preload();await navigate('overview');toast('Вхід успішний');return;
  case 'user-form':{const id=f.dataset.id,old=state.users.find(u=>u.id===id);let payload={...b};if(!id){delete payload.activity;delete payload.status;}else{payload.version=old.version;if(state.user.role==='leader'){payload.permissions=lines((b.permissions||'').replace(/,/g,'\n'));}else delete payload.permissions;}
    const result=await api(id?`/users/${id}`:'/users',id?'PATCH':'POST',payload);if(!id){closeModal();await preload();await render();credentialReceipt(result.item.username,b.password,result.item.nickname);return;}await afterSaved('Особову справу оновлено');return;}
  case 'rank-form':{const r=state.ranks.find(x=>x.id===Number(f.dataset.id));await api(`/ranks/${r.id}`,'PATCH',{title:b.title,requirements:b.requirements,checklist:lines(b.checklist),version:r.version});await afterSaved('Ранг оновлено');return;}
  case 'department-form':{const d=state.departments.find(x=>x.id===f.dataset.id);await api(`/departments/${d.id}`,'PATCH',{...b,version:d.version});await afterSaved();return;}
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
    if(!b.starts_at)delete payload.starts_at;if(!b.ends_at)delete payload.ends_at;await api(id?`/records/${mod}/${id}`:`/records/${mod}`,id?'PATCH':'POST',payload);await afterSaved('Запис збережено');return;}
  case 'review-form':{const mod=f.dataset.module,id=f.dataset.id,r=(await api(`/records/${mod}`)).items.find(x=>x.id===id);await api(`/records/${mod}/${id}/review`,'POST',{...b,version:r.version});await afterSaved('Рішення записано');return;}
  case 'contract-form':{const id=f.dataset.id,old=id?(await api('/contracts')).items.find(x=>x.id===id):null;const participant_ids=[...f.querySelectorAll('[name=participant]:checked')].map(x=>x.value);await api(id?`/contracts/${id}`:'/contracts',id?'PATCH':'POST',{...b,participant_ids,amount:Number(b.amount),treasury_percent:Number(b.treasury_percent),evidence:lines(b.evidence),version:old?.version});await afterSaved('Контракт збережено');return;}
  case 'app-review-form':{const a=(await api('/applications')).items.find(x=>x.id===f.dataset.id);await api(`/applications/${a.id}`,'PATCH',{...b,version:a.version});await afterSaved('Рішення щодо кандидата збережено');return;}
  case 'ledger-form':await api('/ledger','POST',{...b,amount:Number(b.amount)});await afterSaved('Операцію проведено');return;
  case 'settings-form':await api('/settings','PATCH',{...b,__versions:state.settingsVersions});state.public=await api('/public');await afterSaved('Налаштування оновлено');return;
  case 'password-form':await api('/auth/password','POST',b);state.user=null;closeModal();renderPublic();toast('Пароль змінено. Увійдіть повторно.');return;
  case 'reset-password-form':{const target=state.users.find(u=>u.id===f.dataset.id);await api(`/users/${f.dataset.id}/reset-password`,'POST',b);closeModal();await preload();await render();credentialReceipt(target?.username||'',b.password,target?.nickname||'',true);return;}
} }catch(err){toast(err.message,true);if(err.status===409)toast('Оновіть сторінку перед повторним редагуванням.',true);}finally{if(submit)submit.disabled=false;}}
document.addEventListener('submit',handleSubmit);
document.addEventListener('input',e=>{if(e.target.name==='photo_url'&&e.target.closest('#gallery-form'))updateGalleryFormPreview();if(e.target.name==='photo_url'&&e.target.closest('#team-form'))updateTeamFormPreview();if(e.target.id==='search-input'){state.search=e.target.value;const start=e.target.selectionStart;render().then(()=>{const v=$('#search-input');if(v){v.focus();try{v.setSelectionRange(start,start);}catch{}}});}});
document.addEventListener('change',e=>{if(e.target.id==='status-filter'){state.filter=e.target.value;render();}if(e.target.id==='sort-select'){state.sort=e.target.value;render();}if(e.target.id==='period-filter'){state.period=e.target.value;render();}});
document.addEventListener('click',async e=>{const back=e.target.closest('[data-backdrop]');if(back&&e.target===back){closeModal();return;}const t=e.target.closest('[data-action],[data-route]');if(!t)return;e.preventDefault();try{if(t.dataset.route){await navigate(t.dataset.route);return;}const act=t.dataset.action,id=t.dataset.id,mod=t.dataset.module;switch(act){
  case 'show-login':loginModal();break;
  case 'close-modal':closeModal();break;
  case 'toggle-menu':$('.shell')?.classList.toggle('menu-open');break;
  case 'refresh':await render();break;
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
  case 'edit-rank':rankForm(id);break;
  case 'edit-department':departmentForm(id);break;
  case 'new-record':await preload();if(mod==='gallery')galleryForm();else if(mod==='public_news')newsForm();else if(mod==='public_team')teamForm();else moduleForm(mod);break;
  case 'edit-record':{const r=(await api(`/records/${mod}`)).items.find(x=>x.id===id);await preload();if(mod==='gallery')galleryForm(r);else if(mod==='public_news')newsForm(r);else if(mod==='public_team')teamForm(r);else moduleForm(mod,r);break;}
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
  case 'review-record':reviewModal(mod,id);break;
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
  case 'review-app':await appReview(id);break;
  case 'new-contract':await preload();await contractForm();break;
  case 'edit-contract':await preload();await contractForm(id);break;
  case 'view-contract':await preload();await contractView(id);break;
  case 'settle-contract':{if(!confirm('Підтвердити остаточне нарахування? Дія незворотна.'))return;await api(`/contracts/${id}/settle`,'POST',{version:Number(t.dataset.version)});await afterSaved('Виплати проведено рівно один раз');break;}
  case 'capt-pay':{if(!confirm('Нарахувати CAPT-виплату за погодженим записом за поточною ставкою?'))return;const r=await api(`/capt-pay/${id}`,'POST');await afterSaved(`CAPT-виплату ${fmt(r.amount)} нараховано`);break;}
  case 'copy-template':{const rec=(await api('/records/templates')).items.find(x=>x.id===id);if(!rec)return;let content=rec.details||rec.title;for(const placeholder of ['час','місце','ім’я']){const key='{'+placeholder+'}';if(content.includes(key)){const value=prompt(`Значення для ${key}`, '')||'';content=content.replaceAll(key,value);}}await navigator.clipboard.writeText(content);toast('Текст скопійовано');break;}
  case 'export':{const result=await api(`/export?module=${mod}`);const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`grizzly-${mod}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Експорт створено');break;}
  case 'new-ledger':await preload();ledgerForm();break;
  case 'view-ledger':await ledgerModal();break;
  case 'rsvp':await api(`/rsvp/${id}`,'POST',{response:t.dataset.value});await viewRecord('events',id);toast('Участь оновлено');break;
  case 'revoke-session':await api(`/auth/sessions/${id}`,'DELETE');await render();toast('Сесію завершено');break;
}}catch(err){toast(err.message,true);if(err.status===409)toast('Дані вже змінені. Оновіть розділ.',true);}});
initial();
