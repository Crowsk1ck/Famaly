import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('const galleryCategories=');
const end=source.indexOf('function loginModal(){',start);
assert.ok(start>=0&&end>start,'public renderer and helpers exist');

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compile=new Function('state','$','esc','URL','date','location',
  source.slice(start,end)+'\nreturn {renderPublic,renderPublicGallery,renderPublicAchievements,renderPublicTeam,publicPageFromHash,renderPublicNewsPreview,renderPublicCalendar,grCalendarMonthValue};'
);
function context({hash='#home',settings={},gallery=[],news=[],team=[],achievements=[],calendar=[],user=null}={}){
  const node={innerHTML:''};
  const state={public:{settings,gallery,news,team,achievements,calendar},user};
  const location={hash};
  const formatDate=v=>v?new Date(v).toLocaleDateString('uk-UA'):'—';
  const renderer=compile(state,selector=>selector==='#app'?node:null,esc,URL,formatDate,location);
  return {state,node,renderer,location};
}
function publicHtml(options={}){
  const {node,renderer}=context(options);
  renderer.renderPublic();
  return node.innerHTML;
}
test('homepage is compact and excludes the full content sections and application form',()=>{
  const html=publicHtml({settings:{tagline:'Сила в єдності',history:'Наша історія Grizzly'}});
  for(const id of ['home','home-intro','home-news','home-join'])
    assert.ok(html.includes('id="'+id+'"'),id);
  for(const id of ['about','team','rules','news','achievements','gallery','join'])
    assert.ok(!html.includes('id="'+id+'"'),id);
  assert.ok(!html.includes('id="apply-form"'));
  assert.ok(html.includes('Сила в єдності'));
  assert.ok(html.includes('Наша історія Grizzly'));
  assert.ok(html.includes('href="#join"'));
  assert.ok(html.includes('href="#about"'));
  assert.ok(html.includes('aria-current="page"'));
});
test('all dedicated public pages have own routes and no unnecessary sections',()=>{
  const map={
    '#about':['about','team','directions','rules'],
    '#news':['news'],
    '#achievements':['achievements'],
    '#gallery':['gallery'],
    '#calendar':['calendar'],
    '#join':['join']
  };
  for(const [hash,expected] of Object.entries(map)){
    const html=publicHtml({hash});
    for(const id of expected)assert.ok(html.includes('id="'+id+'"'),hash+' '+id);
    assert.ok(!html.includes('id="home"'),hash);
    assert.ok(!html.includes('id="home-intro"'),hash);
    assert.ok(html.includes('class="gr-footer"'),hash);
    assert.ok(html.includes('aria-current="page"'),hash);
  }
  assert.ok(publicHtml({hash:'#join'}).includes('id="apply-form"'));
  assert.ok(!publicHtml({hash:'#about'}).includes('id="apply-form"'));
});
test('backward compatible anchors for team, directions and rules show about page',()=>{
  const {renderer}=context();
  for(const hash of ['#team','#directions','#rules'])assert.equal(renderer.publicPageFromHash(hash),'about');
  assert.equal(renderer.publicPageFromHash('#unknown'),'home');
  assert.equal(renderer.publicPageFromHash('#home'),'home');
  assert.ok(publicHtml({hash:'#team'}).includes('id="team"'));
  assert.ok(publicHtml({hash:'#rules'}).includes('id="rules"'));
  assert.ok(source.includes("window.addEventListener('hashchange'"));
});
test('public application form still has all required fields on the join page',()=>{
  const html=publicHtml({hash:'#join'});
  for(const name of ['nickname','game_id','discord','experience','motivation'])
    assert.ok(html.includes('name="'+name+'"'),name);
  assert.ok(html.includes('id="apply-form"'));
  assert.ok(html.includes('required'));
  assert.ok(html.includes('type="submit"'));
});
test('authenticated users can preview public pages without logging out',()=>{
  const html=publicHtml({hash:'#gallery',user:{role:'leader',username:'test'}});
  assert.ok(html.includes('href="/#overview"'));
  assert.ok(!html.includes('data-action="show-login"'));
  assert.ok(html.includes('id="gallery"'));
});
test('public text remains escaped and Discord links are validated',()=>{
  const html=publicHtml({settings:{tagline:'<script>bad</script>',history:'<img src=x onerror=1>',discord_url:'javascript:alert(1)'}});
  assert.ok(!html.includes('<script>bad</script>'));
  assert.ok(!html.includes('<img src=x onerror=1>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&lt;script&gt;'));
});
test('home shows only three real news previews, while news page shows full list',()=>{
  const news=Array.from({length:5},(_,i)=>({
    id:'n'+i,title:'Новина '+i,details:'Подробиці події '+i,
    category:'news',updated_at:'2026-11-12T12:00:00Z'
  }));
  const home=publicHtml({news}),full=publicHtml({hash:'#news',news});
  for(let i=0;i<3;i++)assert.ok(home.includes('Новина '+i));
  assert.ok(!home.includes('Новина 3'));
  assert.ok(!home.includes('Новина 4'));
  for(let i=0;i<5;i++)assert.ok(full.includes('Новина '+i));
  assert.ok(full.includes('gr-news-grid'));
  assert.ok(!full.includes('gr-home-news-card'));
});
test('news page safely renders feature cards and recruitment call to action',()=>{
  const html=publicHtml({hash:'#news',news:[
    {id:'a',title:'Набір CAPT',details:'Запрошуємо до команди',category:'recruitment',featured:true,updated_at:'2026-11-12'},
    {id:'b',title:'<script>x</script>',details:'<img src=x>',category:'news',updated_at:'2026-11-11'}
  ]});
  assert.ok(html.includes('Набір CAPT'));
  assert.ok(html.includes('gr-news-featured'));
  assert.ok(html.includes('href="#join"'));
  assert.ok(!html.includes('<script>x</script>'));
  assert.ok(!html.includes('<img src=x>'));
});
test('gallery page filters direct ImgBB photos and escapes titles',()=>{
  const gallery=[
    {id:'p1',title:'CAPT кадр',details:'<img src=x onerror=1>',evidence:['https://i.ibb.co/test/capt.jpg'],extra:{gallery_category:'capt',featured:true}},
    {id:'p2',title:'Автомобіль',evidence:['https://i.ibb.co/test/car.webp'],extra:{gallery_category:'cars'}},
    {id:'p3',title:'Підробка',evidence:['https://i.ibb.co@evil.test/evil.jpg'],extra:{gallery_category:'other'}}
  ];
  const {renderer,state,node}=context({hash:'#gallery',gallery});
  renderer.renderPublic();
  assert.ok(node.innerHTML.includes('data-action="gallery-filter"'));
  assert.ok(node.innerHTML.includes('data-action="gallery-open"'));
  assert.ok(node.innerHTML.includes('gr-photo-featured'));
  assert.ok(node.innerHTML.includes('src="https://i.ibb.co/test/capt.jpg"'));
  assert.ok(!node.innerHTML.includes('src="https://i.ibb.co@evil.test'));
  assert.ok(!node.innerHTML.includes('<img src=x onerror=1>'));
  state.galleryFilter='capt';
  assert.ok(renderer.renderPublicGallery().includes('CAPT кадр'));
  assert.ok(!renderer.renderPublicGallery().includes('Автомобіль'));
});
test('about page renders leader cards and sanitized role details',()=>{
  const html=publicHtml({hash:'#about',team:[
    {id:'a',nickname:'Andrii Grizzly',position:'Лідер',bio:'Засновник GRIZZLY',photo:'https://i.ibb.co/test/leader.jpg'},
    {id:'b',nickname:'<script>x</script>',position:'<img src=x>',bio:'<svg onload=1>',photo:'javascript:alert(1)'}
  ]});
  assert.ok(html.includes('Andrii Grizzly'));
  assert.ok(html.includes('gr-team-portrait'));
  assert.ok(html.includes('src="https://i.ibb.co/test/leader.jpg"'));
  assert.ok(!html.includes('src="javascript:'));
  assert.ok(!html.includes('<script>x</script>'));
  assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('gr-team-placeholder'));
});
test('achievements page has filters, counts and safe photos',()=>{
  const achievements=[
    {id:'a1',title:'Перша перемога CAPT',description:'Здобуток',category:'capt',achieved_on:'2026-11-12',featured:true,photo:'https://i.ibb.co/test/win.jpg'},
    {id:'a2',title:'<script>x</script>',description:'<img src=x>',category:'award',achieved_on:'2026-10-01',featured:false,photo:'javascript:alert(1)'}
  ];
  const {state,renderer,node}=context({hash:'#achievements',achievements});
  renderer.renderPublic();
  assert.ok(node.innerHTML.includes('Перша перемога CAPT'));
  assert.ok(node.innerHTML.includes('data-action="achievement-filter"'));
  assert.ok(node.innerHTML.includes('gr-ach-featured'));
  assert.ok(node.innerHTML.includes('src="https://i.ibb.co/test/win.jpg"'));
  assert.ok(!node.innerHTML.includes('src="javascript:'));
  assert.ok(!node.innerHTML.includes('<script>x</script>'));
  assert.ok(!node.innerHTML.includes('<img src=x>'));
  state.achievementFilter='capt';
  assert.ok(renderer.renderPublicAchievements().includes('Перша перемога CAPT'));
});
test('empty dedicated pages show real empty states instead of fabricated entries',()=>{
  assert.ok(publicHtml({hash:'#gallery'}).includes('НАШІ НАЙКРАЩІ МОМЕНТИ'));
  assert.ok(publicHtml({hash:'#news'}).includes('НОВИНИ ГОТУЮТЬСЯ'));
  assert.ok(publicHtml({hash:'#about'}).includes('Профілі керівництва з’являться'));
  assert.ok(publicHtml({hash:'#achievements'}).includes('НАША ІСТОРІЯ ПИШЕТЬСЯ'));
  assert.ok(!publicHtml().includes('Перша перемога CAPT'));
});
test('canonical metadata points at the public GRIZZLY domain',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(html.includes('https://grizzly-family.online/'));
  assert.ok(html.includes('og:description'));
});

test('calendar is an independent page, not extra content on compact homepage',()=>{
  const home=publicHtml({hash:'#home'}),calendar=publicHtml({hash:'#calendar'});
  assert.ok(home.includes('href="#calendar"'));
  assert.ok(!home.includes('id="calendar"'));
  assert.ok(calendar.includes('id="calendar"'));
  assert.ok(calendar.includes('data-action="public-calendar-prev"'));
  assert.ok(calendar.includes('data-action="public-calendar-next"'));
  assert.ok(calendar.includes('data-action="public-calendar-filter"'));
  assert.ok(calendar.includes('Europe/Kyiv'));
  assert.ok(!calendar.includes('id="apply-form"'));
});
test('calendar renders valid scheduled events, week days and filters, escaping public text',()=>{
  const calendar=[
    {id:'e1',title:'Збори GRIZZLY',description:'На маєтку',starts_at:'2026-12-05T19:00',
      ends_at:'2026-12-05T20:00',category:'meeting',location:'Маєток'},
    {id:'e2',title:'<script>alert(1)</script>',description:'<img src=x>',starts_at:'2026-12-10T21:30',
      ends_at:'',category:'capt',location:'Аеропорт'}
  ];
  const {state,renderer,node}=context({hash:'#calendar',calendar});
  state.calendarMonth='2026-12';
  renderer.renderPublic();
  assert.ok(node.innerHTML.includes('Збори GRIZZLY'));
  assert.ok(node.innerHTML.includes('19:00–20:00'));
  assert.ok(node.innerHTML.includes('Маєток'));
  assert.ok(node.innerHTML.includes('gr-cal-count'));
  assert.ok(!node.innerHTML.includes('<script>alert(1)</script>'));
  assert.ok(!node.innerHTML.includes('<img src=x>'));
  assert.ok(node.innerHTML.includes('&lt;script&gt;'));
  state.calendarCategory='meeting';
  const filtered=renderer.renderPublicCalendar();
  assert.ok(filtered.includes('Збори GRIZZLY'));
  assert.ok(!filtered.includes('&lt;script&gt;'));
  state.calendarMonth='2027-01';
  assert.ok(renderer.renderPublicCalendar().includes('немає опублікованих заходів'));
});
