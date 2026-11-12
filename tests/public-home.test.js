import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('const galleryCategories=');
const end=source.indexOf('function loginModal(){',start);
assert.ok(start>=0&&end>start,'public renderer and helpers exist');

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compile=new Function('state','$','esc','URL','date',source.slice(start,end)+'\nreturn {renderPublic,renderPublicGallery,renderPublicAchievements,renderPublicTeam};');
function context({settings={},gallery=[],news=[],team=[],achievements=[],user=null}={}){
  const node={innerHTML:''};
  const state={public:{settings,gallery,news,team,achievements},user};
  const date=v=>v?new Date(v).toLocaleDateString('uk-UA'):'—';
  const renderer=compile(state,sel=>sel==='#app'?node:null,esc,URL,date);
  return {state,node,renderer};
}
function publicHtml(options={}){
  const {node,renderer}=context(options);
  renderer.renderPublic();
  return node.innerHTML;
}

test('public site renders every section, including achievements, without changing the application form',()=>{
  const html=publicHtml({settings:{tagline:'Сила в єдності',history:'Наша історія',rules:'Правила',requirements:'Вимоги'}});
  for(const id of ['home','about','team','directions','rules','news','achievements','gallery','join']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  for(const field of ['nickname','game_id','discord','experience','motivation']){
    assert.ok(html.includes('name="'+field+'"'),field);
  }
  assert.ok(html.includes('id="apply-form"'));
  assert.ok(html.includes('data-action="show-login"'));
  assert.ok(html.includes('Сила в єдності'));
  assert.ok(html.includes('Наша історія'));
});

test('authenticated users preview the public page without needing to sign in again',()=>{
  const html=publicHtml({user:{role:'leader',username:'demo'}});
  assert.ok(html.includes('href="/#overview"'));
  assert.ok(!html.includes('data-action="show-login"'));
});

test('public settings escape HTML and disallow untrusted Discord URLs',()=>{
  const html=publicHtml({settings:{
    tagline:'<script>alert(1)</script>',
    history:'<img src=x onerror=1>',
    discord_url:'javascript:alert(1)'
  }});
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x onerror=1>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('gallery filters by approved public categories and allows direct ImgBB images only',()=>{
  const data=[
    {id:'p1',title:'CAPT кадр',evidence:['https://i.ibb.co/test/capt.jpg'],extra:{gallery_category:'capt',featured:true}},
    {id:'p2',title:'Автомобіль',evidence:['https://i.ibb.co/test/car.webp'],extra:{gallery_category:'cars'}},
    {id:'p3',title:'Небезпека',evidence:['https://i.ibb.co@evil.test/fake.jpg'],extra:{gallery_category:'other'}}
  ];
  const {renderer,state,node}=context({gallery:data});
  renderer.renderPublic();
  assert.ok(node.innerHTML.includes('data-action="gallery-filter"'));
  assert.ok(node.innerHTML.includes('data-action="gallery-open"'));
  assert.ok(node.innerHTML.includes('gr-photo-featured'));
  assert.ok(node.innerHTML.includes('src="https://i.ibb.co/test/capt.jpg"'));
  assert.ok(!node.innerHTML.includes('src="https://i.ibb.co@evil.test'));
  state.galleryFilter='capt';
  const filtered=renderer.renderPublicGallery();
  assert.ok(filtered.includes('CAPT кадр'));
  assert.ok(!filtered.includes('Автомобіль'));
});

test('gallery descriptions and photo names are escaped',()=>{
  const html=publicHtml({gallery:[
    {id:'evil',title:'<script>bad</script>',details:'<img src=x onerror=1>',evidence:['https://i.ibb.co/ok.jpg']}
  ]});
  assert.ok(!html.includes('<script>bad</script>'));
  assert.ok(!html.includes('<img src=x onerror=1>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('empty gallery, news, team and achievements show honest empty states',()=>{
  const html=publicHtml();
  assert.ok(html.includes('Галерея')||html.includes('НАШІ НАЙКРАЩІ МОМЕНТИ'));
  assert.ok(html.includes('НОВИНИ ГОТУЮТЬСЯ'));
  assert.ok(html.includes('Профілі керівництва з’являться після публікації'));
  assert.ok(html.includes('НАША ІСТОРІЯ ПИШЕТЬСЯ'));
  assert.ok(!html.includes('Перша перемога CAPT'));
});

test('news cards render categories, dates and escape HTML',()=>{
  const html=publicHtml({news:[
    {id:'n1',title:'Набір CAPT',details:'Запрошуємо до сім’ї',category:'recruitment',featured:true,updated_at:'2026-11-12T12:00:00Z'},
    {id:'n2',title:'<svg onload=1>',details:'<img src=x>',category:'news',updated_at:'2026-11-11T12:00:00Z'}
  ]});
  assert.ok(html.includes('Набір CAPT'));
  assert.ok(html.includes('gr-news-featured'));
  assert.ok(html.includes('href="#join"'));
  assert.ok(!html.includes('<svg onload=1>'));
  assert.ok(!html.includes('<img src=x>'));
});

test('public team renders safe role profiles and no unsafe image URLs',()=>{
  const html=publicHtml({team:[
    {id:'a',nickname:'Andrii Grizzly',position:'Лідер',bio:'Засновник GRIZZLY',photo:'https://i.ibb.co/test/leader.jpg'},
    {id:'b',nickname:'<script>unsafe</script>',position:'<img src=x>',bio:'<svg onload=1>',photo:'javascript:alert(1)'}
  ]});
  assert.ok(html.includes('Andrii Grizzly'));
  assert.ok(html.includes('gr-team-portrait'));
  assert.ok(html.includes('src="https://i.ibb.co/test/leader.jpg"'));
  assert.ok(!html.includes('src="javascript:'));
  assert.ok(!html.includes('<script>unsafe</script>'));
  assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('gr-team-placeholder'));
});

test('achievements render published counts, filters, photos and escaped descriptions',()=>{
  const data=[
    {id:'a1',title:'Перша перемога CAPT',description:'Команда перемогла у бою',category:'capt',
      achieved_on:'2026-11-12',featured:true,photo:'https://i.ibb.co/test/capt-win.webp'},
    {id:'a2',title:'<script>bad</script>',description:'<img src=x>',category:'award',
      achieved_on:'2026-10-01',featured:false,photo:'javascript:alert(1)'}
  ];
  const {renderer,state,node}=context({achievements:data});
  renderer.renderPublic();
  assert.ok(node.innerHTML.includes('id="achievements"'));
  assert.ok(node.innerHTML.includes('href="#achievements"'));
  assert.ok(node.innerHTML.includes('data-action="achievement-filter"'));
  assert.ok(node.innerHTML.includes('gr-ach-featured'));
  assert.ok(node.innerHTML.includes('src="https://i.ibb.co/test/capt-win.webp"'));
  assert.ok(!node.innerHTML.includes('src="javascript:'));
  assert.ok(!node.innerHTML.includes('<script>bad</script>'));
  assert.ok(!node.innerHTML.includes('<img src=x>'));
  state.achievementFilter='capt';
  const filtered=renderer.renderPublicAchievements();
  assert.ok(filtered.includes('Перша перемога CAPT'));
  assert.ok(!filtered.includes('gr-ach-card-top"><span>Нагороди'));
});

test('canonical metadata points at the real Grizzly host',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(html.includes('https://grizzly-family.online/'));
  assert.ok(html.includes('og:description'));
});
