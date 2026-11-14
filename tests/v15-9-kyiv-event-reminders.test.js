import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const start=app.indexOf('function grCalendarDayOffset(');
const end=app.indexOf('function grCalendarMonthValue(){',start);
assert.ok(start>=0&&end>start,'v15.9 calendar reminder helpers exist');
const helpers=runInNewContext(app.slice(start,end)+
 '\n({grCalendarDayOffset,grUpcomingEventWindow,grCalendarReminderLabel})',{
 kyivWallDate:v=>String(v||'').slice(0,16).replace(' ','T'),Date
});

test('v15.9 Kyiv day labels remain correct across month, year and DST boundaries',()=>{
 assert.equal(helpers.grCalendarDayOffset('2027-01-01T00:10','2026-12-31T23:30'),1);
 assert.equal(helpers.grCalendarReminderLabel('2026-12-31T23:55','2026-12-31T23:30'),'Сьогодні');
 assert.equal(helpers.grCalendarReminderLabel('2027-01-01T08:00','2026-12-31T23:30'),'Завтра');
 assert.equal(helpers.grCalendarDayOffset('2027-03-29T09:00','2027-03-28T12:00'),1);
 assert.equal(helpers.grCalendarDayOffset('2026-02-30T19:00','2026-02-28T12:00'),null);
 assert.equal(helpers.grCalendarReminderLabel('2026-12-03T18:00','2026-12-01T09:00'),'Через 2 дн.');
});

test('v15.9 next-week reminders contain only confirmed future events in chronological order',()=>{
 const events=[
  {id:'past-today',starts_at:'2026-11-14T10:00',status:'Погоджено'},
  {id:'cancelled',starts_at:'2026-11-14T15:00',status:'Скасовано'},
  {id:'today',starts_at:'2026-11-14T18:00',status:'Погоджено'},
  {id:'next-day',starts_at:'2026-11-15T11:00',status:'Заплановано'},
  {id:'day-seven',starts_at:'2026-11-20T12:00',status:'Погоджено'},
  {id:'outside',starts_at:'2026-11-21T12:00',status:'Погоджено'},
  {id:'invalid',starts_at:'fake',status:'Погоджено'},
  {id:'rejected',starts_at:'2026-11-14T16:00',status:'Відхилено'},
  {id:'completed',starts_at:'2026-11-15T09:00',status:'Завершено'}
 ];
 const before=events.map(x=>x.id);
 const week=helpers.grUpcomingEventWindow(events,'2026-11-14T12:00',7);
 assert.deepEqual(Array.from(week,x=>x.id),['today','next-day','day-seven']);
 assert.deepEqual(events.map(x=>x.id),before,'Filtering must never mutate the API response');
 assert.deepEqual(Array.from(helpers.grUpcomingEventWindow(events,'2026-11-14T12:00',2),x=>x.id),['today','next-day']);
});

test('v15.9 public calendar renders week preview from already filtered published records',()=>{
 const slice=app.slice(app.indexOf('function renderPublicCalendar(){'),app.indexOf('function renderPublic(){'));
 assert.match(slice,/const calendar=grCalendarEvents\(\)/);
 assert.match(slice,/grUpcomingEventWindow\(calendar,kyivNowLocal\(\),7\)\.slice\(0,5\)/);
 assert.match(slice,/grCalendarReminderLabel\(start,kyivNowLocal\(\)\)/);
 assert.match(slice,/data-action="public-calendar-jump"/);
 assert.match(slice,/esc\(event\.title\)/);
 assert.match(slice,/esc\(event\.location\)/);
 assert.match(slice,/weekPreview\+'<div class="gr-cal-filterbar"/);
 assert.match(slice,/На найближчі 7 днів підтверджених заходів немає/);
});

test('v15.9 calendar month follows Kyiv time and jump only accepts valid months',()=>{
 const month=app.slice(app.indexOf('function grCalendarMonthValue(){'),app.indexOf('function grCalendarEvents(){'));
 assert.match(month,/return kyivNowLocal\(\)\.slice\(0,7\)/);
 const action=app.slice(app.indexOf("case 'public-calendar-jump':"),app.indexOf("case 'achievement-new':"));
 assert.match(action,/if\(!\/\^\\d\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$\/\.test\(month\)\)break/);
 assert.match(action,/state\.calendarMonth=month/);
 assert.match(action,/renderPublicCalendar\(\)/);
 assert.match(action,/getElementById\('cal-events'\)\?\.scrollIntoView/);
});

test('v15.9 overview reminder uses only authorized events and mobile controls stay readable',()=>{
 const overview=app.slice(app.indexOf('async function overview(){'),app.indexOf('function memberStatusLabel('));
 assert.match(overview,/const imminentEvents=grUpcomingEventWindow\(events,kyivNowLocal\(\),2\)/);
 assert.match(overview,/Нагадування: заходи сьогодні або завтра/);
 assert.match(overview,/route:'events'/);
 assert.match(css,/\.gr-cal-week-preview\{/);
 assert.match(css,/\.gr-cal-week-list\{display:grid/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/\.gr-cal-week-go\{flex:1 1 100%;min-height:44px\}/);
});
