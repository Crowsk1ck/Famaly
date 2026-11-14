import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');

const start=app.indexOf('function canCreateRosterAccount(){');
const end=app.indexOf('function memberStatusLabel(',start);
const formStart=app.indexOf('function userForm(id){');
const formEnd=app.indexOf('function rankRequirementsMissing(',formStart);
assert.ok(start>0&&end>start&&formStart>0&&formEnd>formStart);

function rights(role,permissions=[]){
 const state={user:{id:role+'-own',role,permissions}};
 const can=perm=>role==='leader'||permissions.includes('*')||permissions.includes(perm);
 return runInNewContext(app.slice(start,end)+
  '\n({canCreateRosterAccount,canEditRosterAccount})',{state,can});
}

test('v16.0 all four roles show editable accounts only when the Worker can save them',()=>{
 const leader=rights('leader',['*']);
 const deputy=rights('deputy',['members:read','members:write']);
 const head=rights('head',['members:read']);
 const member=rights('member',[]);
 const user={id:'other',role:'member'};
 const familyLeader={id:'family-leader',role:'leader'};
 assert.equal(leader.canCreateRosterAccount(),true);
 assert.equal(leader.canEditRosterAccount(familyLeader),true);
 assert.equal(leader.canEditRosterAccount(user),true);
 assert.equal(deputy.canCreateRosterAccount(),true);
 assert.equal(deputy.canEditRosterAccount(user),true);
 assert.equal(deputy.canEditRosterAccount(familyLeader),false,'Deputy cannot edit the leader');
 assert.equal(head.canCreateRosterAccount(),false);
 assert.equal(head.canEditRosterAccount(user),false);
 assert.equal(head.canEditRosterAccount({id:'head-own',role:'head'}),true);
 assert.equal(member.canCreateRosterAccount(),false);
 assert.equal(member.canEditRosterAccount(user),false);
 assert.equal(member.canEditRosterAccount({id:'member-own',role:'member'}),true);
 assert.equal(member.canEditRosterAccount(null),false);
});

test('v16.0 head remains read-only for teammates even with incorrectly granted write permission',()=>{
 const head=rights('head',['*','members:write']);
 assert.equal(head.canCreateRosterAccount(),false);
 assert.equal(head.canEditRosterAccount({id:'staff',role:'member'}),false);
 assert.equal(head.canEditRosterAccount({id:'head-own',role:'head'}),true);
 const customMember=rights('member',['members:write']);
 assert.equal(customMember.canCreateRosterAccount(),true,'Custom access should follow server rules');
 assert.equal(customMember.canEditRosterAccount({id:'staff',role:'member'}),true);
 assert.equal(customMember.canEditRosterAccount({id:'leader',role:'leader'}),false);
});

test('v16.0 unauthorized edit modals are rejected before displaying any account fields',()=>{
 const alerts=[],modals=[];
 const state={user:{id:'head-own',role:'head',permissions:['members:read']},users:[
  {id:'head-own',role:'head',nickname:'Head'},
  {id:'teammate',role:'member',nickname:'Teammate'}
 ]};
 const can=perm=>state.user.permissions.includes(perm);
 const field=(label)=>'<label>'+label+'</label>';
 const selectField=(label)=>'<label>'+label+'</label>';
 const runtime=runInNewContext(app.slice(start,end)+app.slice(formStart,formEnd)+
  '\n({userForm})',{state,can,toast:message=>alerts.push(message),
  modal:(title,body)=>modals.push({title,body}),field,selectField,
  roles:{head:'Керівник',member:'Учасник'},esc:v=>String(v)});
 runtime.userForm('teammate');
 runtime.userForm('nonexistent');
 runtime.userForm(undefined);
 assert.equal(modals.length,0);
 assert.equal(alerts.length,3);
 runtime.userForm('head-own');
 assert.equal(modals.length,1,'A head may update their own nonprivileged profile fields');
 assert.ok(!modals[0].body.includes('Статус акаунта'));
 assert.ok(!modals[0].body.includes('Роль доступу'));
});

test('v16.0 member roster buttons and action handlers enforce the same role matrix',()=>{
 const members=app.slice(app.indexOf('async function members(){'),app.indexOf('function viewMember('));
 assert.match(members,/state\.users\.some\(account=>account\.id===u\.id\)&&canEditRosterAccount\(u\)/);
 assert.match(members,/canCreateRosterAccount\(\)\?'<button class="btn" data-action="new-user"/);
 assert.match(app,/case 'new-user':if\(!canCreateRosterAccount\(\)\)/);
 assert.match(app,/case 'edit-user':await preload\(\);if\(!canEditRosterAccount\(state\.users\.find/);
 assert.match(app,/case 'reset-password':if\(state\.user\?\.role!=='leader'\)/);
 assert.match(app,/case 'user-form':\{const id=f\.dataset\.id,old=state\.users\.find\(u=>u\.id===id\);if\(id\?!canEditRosterAccount\(old\):!canCreateRosterAccount\(\)\)/);
 assert.match(members,/class="member-desktop-table"/);
 assert.match(members,/class="member-mobile-list"/);
});

test('v16.0 acceptance smoke preserves public calendar, session cleanup, form state and mobile navigation',()=>{
 assert.match(app,/function grUpcomingEventWindow\(/);
 assert.match(app,/data-action="public-calendar-jump"/);
 assert.match(app,/function stopNotificationPolling\(/);
 assert.match(app,/case 'logout':await api\('\/auth\/logout','POST'\);stopNotificationPolling\(\)/);
 assert.match(app,/if\(f\.dataset\.saving==='true'\)return/);
 assert.match(app,/formSavingState\(f,true\)/);
 assert.match(app,/case 'toggle-menu':\{/);
 assert.match(app,/case 'close-menu':\{/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(css,/\.member-mobile-list\{display:block\}/);
});
