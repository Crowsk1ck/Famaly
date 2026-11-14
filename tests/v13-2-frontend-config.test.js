import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const config=read('public/app-config.js');
const entry=read('public/app.js');

test('each public HTML page loads the shared app config before the SPA entrypoint',()=>{
 for(const name of ['','about/','news/','achievements/','gallery/','calendar/','join/']){
  const html=read('public/'+name+'index.html');
  const configAt=html.indexOf('<script defer src="/app-config.js"></script>');
  const appAt=html.indexOf('<script defer src="/app.js"></script>');
  assert.ok(configAt>0&&appAt>configAt,name);
 }
});
test('extracted UI config preserves family role names and department module mapping',()=>{
 const sandbox={window:{}};
 vm.runInNewContext(config,sandbox);
 const ui=sandbox.window.GRIZZLY_UI_CONFIG;
 assert.ok(ui);
 assert.equal(ui.roles.leader,'Лідер');
 assert.equal(ui.roles.head,'Керівник напрямку');
 assert.equal(ui.permissionNames['finance:manage'],'Нарахування й фінанси');
 assert.deepEqual(Array.from(ui.groupRoutes.capt),['capt_matches','capt_training','capt_attendance']);
 assert.equal(ui.moduleInfo.tasks[2],'tasks:manage');
 assert.equal(ui.statuses.length,7);
 assert.match(entry,/window\.GRIZZLY_UI_CONFIG/);
 assert.doesNotMatch(entry,/const moduleInfo=\{/);
});
