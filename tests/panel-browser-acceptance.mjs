// v16.1/v17.0 browser acceptance: local assets and synthetic API fixtures only.
// Never sends credentials, writes, or traffic to the live D1 database.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import puppeteer from 'puppeteer-core';

const publicDir=resolve('public');
const people=[
 {id:'lead',role:'leader',nickname:'Grizzly Leader',username:'lead',status:'active',department_id:'capt',game_id:'1',rank_id:15,version:1},
 {id:'dep',role:'deputy',nickname:'Grizzly Deputy',username:'dep',status:'active',department_id:'capt',game_id:'2',rank_id:12,version:1},
 {id:'head',role:'head',nickname:'CAPT Head',username:'head',status:'active',department_id:'capt',game_id:'3',rank_id:10,version:1},
 {id:'member',role:'member',nickname:'Grizzly Member',username:'member',status:'active',department_id:'capt',game_id:'4',rank_id:1,version:1}
];
const grants={leader:['*'],deputy:['members:read','members:write','stats:read'],head:['members:read','stats:read'],member:[]};
let role='leader';
function userFor(p){return {...p,permissions:grants[p.role],joined_at:'2026-11-01'};}
function respond(res,status,payload){
 res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
 res.end(JSON.stringify(payload));
}
const web=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path.startsWith('/api/')){
  const user=userFor(people.find(p=>p.role===role));
  if(path==='/api/auth/me')return respond(res,200,{user});
  if(path==='/api/public')return respond(res,200,{settings:{family_name:'GRIZZLY',tagline:'Сила в єдності.',history:'Історія сім’ї',rules:'Правила',requirements:'Вимоги'},gallery:[],news:[],calendar:[],team:[],achievements:[]});
  if(path==='/api/notifications')return respond(res,200,{items:[{id:'n1',title:'Тестове сповіщення',details:'Перевірка',read_at:null,created_at:'2026-11-14T12:00:00Z'}]});
  if(path==='/api/users')return respond(res,200,{items:people.filter(p=>role==='leader'||role==='deputy'||p.id===user.id||role==='head'&&p.department_id===user.department_id).map(userFor)});
  if(path==='/api/members')return respond(res,200,{items:people.map(userFor).map(({id,nickname,role,rank_id,department_id,game_id,status,joined_at})=>({id,nickname,role,rank_id,department_id,game_id,status,joined_at}))});
  if(path==='/api/departments')return respond(res,200,{items:[{id:'capt',title:'CAPT',head_id:'head',version:1}]});
  if(path==='/api/ranks')return respond(res,200,{items:[{id:1,title:'Новачок',checklist:'[]'},{id:10,title:'Каптан',checklist:'[]'},{id:12,title:'Заступник',checklist:'[]'},{id:15,title:'Лідер',checklist:'[]'}],templates:[]});
  if(path==='/api/auth/sessions')return respond(res,200,{items:[]});
  return respond(res,403,{error:'Mock API: access denied'});
 }
 let filename=path==='/'?'index.html':decodeURIComponent(path.slice(1));
 const absolute=resolve(publicDir,filename);
 if(!absolute.startsWith(publicDir+sep)&&absolute!==resolve(publicDir,'index.html')){
  res.writeHead(403);res.end();return;
 }
 try{
  const bytes=await readFile(absolute);
  const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg'}[extname(absolute)]||'application/octet-stream';
  res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>web.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+web.address().port;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let checked=0;
try{
 for(const candidate of ['leader','deputy','head','member']){
  for(const mobile of [false,true]){
   role=candidate;
   const page=await browser.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   if(mobile)await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
   else await page.setViewport({width:1366,height:900,deviceScaleFactor:1});
   try{
    await page.goto(base+'/#members',{waitUntil:'networkidle0',timeout:30000});
    await page.waitForSelector('#members-selected-count',{timeout:15000});
    const before=await page.evaluate(()=>({
     count:document.querySelectorAll('[data-member-select]').length,
     editIds:[...new Set(Array.from(document.querySelectorAll('[data-action="edit-user"]')).map(x=>x.dataset.id))],
     scroll:document.documentElement.scrollWidth,
     width:innerWidth,
     title:document.querySelector('.page-intro h1')?.textContent
    }));
    assert.equal(before.title,'Склад сім’ї',candidate+' '+mobile);
    assert.equal(before.count,8,'Both mobile and table selection present');
    const expectIds=candidate==='leader'?['lead','dep','head','member']:candidate==='deputy'?['dep','head','member']:[candidate];
    assert.deepEqual(before.editIds.slice().sort(),expectIds.slice().sort(),candidate+' edit permissions');
    if(mobile)assert.ok(before.scroll<=before.width+8,'Horizontal overflow '+candidate+' '+JSON.stringify(before));
    await page.click('#members-select-page');
    await page.waitForFunction(()=>document.getElementById('members-selected-count')?.textContent==='4 вибрано');
    await page.select('#members-role-filter','member');
    await page.waitForFunction(()=>document.getElementById('members-selected-count')?.textContent==='0 вибрано');
    if(mobile){
     await page.click('[data-action="toggle-menu"]');
     await page.waitForFunction(()=>document.querySelector('.shell')?.classList.contains('menu-open'));
     await page.keyboard.press('Escape');
     await page.waitForFunction(()=>!document.querySelector('.shell')?.classList.contains('menu-open'));
    }
    await page.click('.topbar [data-route="profile"]');
    await page.waitForSelector('#password-form',{timeout:15000});
    assert.equal(await page.$eval('#password-form [type="submit"]',x=>x.disabled),false);
    await page.click('.app-content [data-action="edit-user"]');
    await page.waitForSelector('#user-form',{timeout:15000});
    if(candidate==='head'||candidate==='member'){
     assert.equal(await page.$('#user-form select[name="role"]'),null,'Unprivileged self edit exposes no role editor');
     assert.equal(await page.$('#user-form select[name="status"]'),null,'Unprivileged self edit exposes no status editor');
    }
    assert.equal(errors.length,0,candidate+' '+(mobile?'mobile':'desktop')+' '+errors.join(' | '));
    checked++;
    console.log('PASS panel role='+candidate+' viewport='+(mobile?'390x844':'1366x900')+' roster/filters/drawer/profile');
   }finally{await page.close();}
  }
 }
 assert.equal(checked,8);
 console.log('PASS v16.1 browser acceptance: 8 signed-in role/viewport combinations, mock-only.');
}finally{
 await browser.close();
 await new Promise(resolve=>web.close(resolve));
}
