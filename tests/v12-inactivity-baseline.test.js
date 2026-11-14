import test from 'node:test';
import assert from 'node:assert/strict';
import {inactivityRows} from '../worker/index.js';

const ago=days=>new Date(Date.now()-days*86400000).toISOString();
const record=(overrides={})=>({
 id:'test-user',nickname:'Test',department_id:'capt',role:'member',
 joined_at:ago(1).slice(0,10),last_action:null,actions_7:0,actions_30:0,absence:null,...overrides
});

test('new participants are not overdue before their grace-period threshold',()=>{
 const rows=inactivityRows({items:[record()]},7);
 assert.equal(rows[0].overdue,false);
 assert.equal(rows[0].activity_baseline,'joined_at');
 assert.ok(rows[0].days_since_action<=2);
});
test('established participants with no audited work are overdue after threshold',()=>{
 const rows=inactivityRows({items:[record({joined_at:ago(40).slice(0,10)})]},14);
 assert.equal(rows[0].overdue,true);
 assert.ok(rows[0].days_since_action>=39);
});
test('last audited action takes precedence over join date and recent work is active',()=>{
 const rows=inactivityRows({items:[record({joined_at:ago(60).slice(0,10),last_action:ago(2)})]},7);
 assert.equal(rows[0].overdue,false);
 assert.equal(rows[0].activity_baseline,'last_action');
});
test('approved leave prevents overdue status and unknown dates are not fabricated',()=>{
 const result=inactivityRows({items:[
  record({joined_at:ago(40).slice(0,10),absence:'vacation'}),
  record({joined_at:null,last_action:null})
 ]},7);
 assert.equal(result[0].approved_absence,true);
 assert.equal(result[0].overdue,false);
 assert.equal(result[1].activity_baseline,'unknown');
 assert.equal(result[1].days_since_action,null);
 assert.equal(result[1].overdue,false);
});
