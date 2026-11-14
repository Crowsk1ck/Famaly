import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

test('v9 has 7/30 day activity and vacation/absence pages in the family panel',()=>{
 assert.match(app,/id:'activity',text:'Активність 7\/30 днів'/);
 assert.match(app,/id:'absences',text:'Відпустки та неактив'/);
 assert.match(app,/case'activity':content=await activityPage\(\);break/);
 assert.match(app,/case'absences':content=await absencesPage\(\);break/);
 assert.match(app,/id:'activity',title:'Активність 7\/30'/);
 assert.match(app,/id:'absences',title:'Відпустки \/ неактив'/);
 assert.match(css,/\.gr-activity-stats\{/);
});
test('activity is based on actual audited operations and does not infer game online',()=>{
 assert.match(worker,/\/api\/activity/);
 assert.match(worker,/COUNT\(\*\) AS count_30/);
 assert.match(worker,/CASE WHEN created_at>=\? THEN 1 ELSE 0 END/);
 assert.match(worker,/action IN \('create','update','review','submit'\)/);
 assert.match(worker,/не час у GTA 5/);
 assert.match(app,/Статистика за 7 і 30 днів лише за діями в панелі GRIZZLY/);
});
test('leave decisions are server-scoped and do not change treasury or existing contracts',()=>{
 assert.match(worker,/ABSENCE_MODULE='absence_requests'/);
 assert.match(worker,/function canReviewAbsence\(/);
 assert.match(worker,/head_appointed&&!!record.department_id/);
 assert.match(worker,/owner_id=\? AND deleted_at IS NULL/);
 assert.match(worker,/status IN \('На перевірці','Погоджено'\)/);
 assert.match(worker,/if\(!ownCancel&&!canReviewAbsence\(user,old\)\)fail\(403/);
 assert.match(worker,/version=version\+1/);
 assert.match(app,/case 'absence-request-form'/);
 assert.match(app,/case 'absence-review-form'/);
 assert.doesNotMatch(app,/absence-pay|absence-ledger/);
});
