import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('function publicPhotoCard(');
const end=source.indexOf('function loginModal(){',start);
assert.ok(start>=0&&end>start,'public renderer exists');

const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const compile=new Function('state','$','esc','URL',source.slice(start,end)+'\nreturn renderPublic;');

function publicHtml(settings={},gallery=[],user=null){
  const app={innerHTML:''};
  const state={public:{settings,gallery},user};
  const render=compile(state,s=>s==='#app'?app:null,escapeHtml,URL);
  render();
  return app.innerHTML;
}
test('public landing page has navigation, safe sections and working application fields',()=>{
  const html=publicHtml({tagline:'Разом сильніші',history:'Наш шлях',rules:'Правила',requirements:'Умови'});
  for(const section of ['home','about','directions','rules','gallery','join'])assert.ok(html.includes('id="'+section+'"'),section);
  for(const field of ['nickname','game_id','discord','experience','motivation'])assert.ok(html.includes('name="'+field+'"'),field);
  assert.ok(html.includes('id="apply-form"'));
  assert.ok(html.includes('data-action="show-login"'));
  assert.ok(html.includes('Разом сильніші'));
  assert.ok(html.includes('Наш шлях'));
  assert.ok(html.includes('Фото')===false||html.length>1000);
});
test('published direct ImgBB gallery image renders while non-image links do not',()=>{
  const html=publicHtml({},[
    {title:'Командна гра',details:'Спільний виїзд',evidence:['https://i.ibb.co/grizzly.jpg']},
    {title:'Підозрілий URL',evidence:['javascript:alert(1)']}
  ]);
  assert.ok(html.includes('src="https://i.ibb.co/grizzly.jpg"'));
  assert.ok(html.includes('Командна гра'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('src="javascript:'));
});
test('injected text and untrusted Discord URLs cannot become markup',()=>{
  const html=publicHtml({history:'<img src=x onerror=alert(1)>',tagline:'<script>bad</script>',discord_url:'javascript:alert(1)'});
  assert.ok(!html.includes('<script>bad</script>'));
  assert.ok(!html.includes('<img src=x onerror='));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&lt;script&gt;'));
});
test('authenticated visitors can preview the homepage and go back to their panel',()=>{
  const html=publicHtml({},[],{id:'leader'});
  assert.ok(html.includes('href="/#overview"'));
  assert.ok(!html.includes('data-action="show-login"'));
});
test('metadata has correct canonical host and indexable public description',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(html.includes('https://grizzly-family.online/'));
  assert.ok(html.includes('og:description'));
});
