// Public registration browser acceptance. Local synthetic API; never sends
// credentials or requests to the live GRIZZLY domain.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import puppeteer from 'puppeteer-core';

const root=resolve('public'),posts=[];
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/public'){
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({settings:{family_name:'GRIZZLY'},gallery:[],news:[],team:[],achievements:[],calendar:[]}));
  return;
 }
 if(path==='/api/auth/me'){
  res.writeHead(401,{'content-type':'application/json'});
  res.end('{"error":"Увійдіть"}');return;
 }
 if(path==='/api/register'&&req.method==='POST'){
  let raw='';
  for await(const chunk of req)raw+=chunk.toString();
  posts.push(JSON.parse(raw));
  res.writeHead(202,{'content-type':'application/json'});
  res.end('{"ok":true,"message":"Реєстрацію отримано. Очікуйте схвалення лідером."}');
  return;
 }
 if(path.startsWith('/api/')){
  res.writeHead(403,{'content-type':'application/json'});
  res.end('{"error":"Mock API: forbidden"}');return;
 }
 const filename=(path==='/'||path==='/register/')?'index.html':decodeURIComponent(path.slice(1));
 const absolute=resolve(root,filename);
 if(!absolute.startsWith(root+sep)&&absolute!==resolve(root,'index.html')){
  res.writeHead(403);res.end();return;
 }
 try{
  const bytes=await readFile(absolute);
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml'}[extname(absolute)]||'application/octet-stream';
  res.writeHead(200,{'content-type':mime,'cache-control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage();
  const exceptions=[];
  page.on('pageerror',err=>exceptions.push(err.message));
  await page.setViewport(mobile?{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1}:{width:1366,height:900});
  try{
   await page.goto(origin+'/register/',{waitUntil:'networkidle0',timeout:30000});
   await page.waitForSelector('#register-form',{timeout:10000});
   const fields=await page.evaluate(()=>({
    names:Array.from(document.querySelectorAll('#register-form [name]')).map(x=>x.name),
    title:document.querySelector('#gr-register-title')?.textContent,
    width:innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    status:document.querySelector('.gr-register-lead')?.textContent
   }));
   for(const name of ['username','password','nickname','game_id','discord','telegram'])assert.ok(fields.names.includes(name),'Missing '+name);
   assert.match(fields.title,/РЕЄСТРАЦІЯ/);
   assert.ok(fields.scrollWidth<=fields.width+4,'Mobile horizontal overflow '+JSON.stringify(fields));
   assert.match(fields.status,/схвалення/i);
   const candidate=(mobile?'mobile':'desktop')+'_grizzly172';
   await page.type('#reg-username',candidate);
   await page.type('#reg-password','only-local-test-password-123');
   await page.type('#reg-nickname','Demo Grizzly');
   await page.type('#reg-game-id','10452');
   await page.type('#reg-discord','demo_grizzly');
   await page.type('#reg-telegram','@demo_grizzly');
   await page.click('.gr-register-submit');
   await page.waitForSelector('.gr-register-success',{timeout:15000});
   assert.match(await page.$eval('.gr-register-success',el=>el.textContent),/схвалення/);
   const sent=posts.find(x=>x.username===candidate);
   assert.ok(sent,'Client did not POST signup data to the local mock API');
   assert.equal(sent.password,'only-local-test-password-123');
   assert.equal(sent.game_id,'10452');
   assert.equal(sent.telegram,'@demo_grizzly');
   assert.equal(exceptions.length,0,exceptions.join(' / '));
   console.log('PASS GRIZZLY registration '+(mobile?'mobile 390px':'desktop 1366px')+'; all six fields; pending state');
  }finally{await page.close();}
 }
 assert.equal(posts.length,2);
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
