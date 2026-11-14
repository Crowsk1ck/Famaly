import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STATUSES,ROLES,DEFAULT_PERMISSIONS,HEAD_DEPARTMENT_PERMISSIONS,MODULES} from '../worker/policy-config.js';

const entry=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
test('Worker imports a single static policy configuration module',()=>{
 assert.match(entry,/from '\.\/policy-config\.js'/);
 assert.doesNotMatch(entry,/const DEFAULT_PERMISSIONS\s*=/);
 assert.doesNotMatch(entry,/const MODULES\s*=/);
});
test('all original role boundaries and department head permissions remain intact',()=>{
 assert.deepEqual(ROLES,['leader','deputy','head','member']);
 assert.deepEqual(DEFAULT_PERMISSIONS.leader,['*']);
 assert.deepEqual(DEFAULT_PERMISSIONS.member,[]);
 assert.ok(DEFAULT_PERMISSIONS.deputy.includes('finance:read'));
 assert.ok(!DEFAULT_PERMISSIONS.deputy.includes('finance:manage'));
 assert.ok(!HEAD_DEPARTMENT_PERMISSIONS.farm.includes('finance:manage'));
 assert.ok(HEAD_DEPARTMENT_PERMISSIONS.capt.includes('capt:manage'));
 assert.ok(HEAD_DEPARTMENT_PERMISSIONS.discipline.includes('discipline:manage'));
 assert.equal(STATUSES.length,7);
});
test('record-module restrictions do not broaden access to finance or blacklist',()=>{
 for(const mod of ['contributions','expenses','bonuses','capt_payments']){
  assert.equal(MODULES[mod].manage,'finance:manage');
  assert.equal(MODULES[mod].restricted,true);
 }
 assert.equal(MODULES.blacklist.restricted,true);
 assert.equal(MODULES.tasks.memberRead,true);
 assert.equal(MODULES.promotions.review,true);
});
