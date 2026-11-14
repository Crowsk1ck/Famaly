import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
test('production smoke covers responsive public menu and join flow',()=>{
 assert.match(workflow,/width:390,height:844/);
 assert.match(workflow,/\.gr-mobile-menu summary/);
 assert.match(workflow,/\.gr-mobile-menu a\[href="\/join\/"\]/);
 assert.match(workflow,/mobile\.visibleApplication/);
 assert.match(workflow,/document\.documentElement\.scrollWidth/);
 assert.match(workflow,/if\(mobile\.documentWidth>mobile\.width\+4\)/);
});
