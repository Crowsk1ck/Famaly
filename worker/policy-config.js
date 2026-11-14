/** Shared, static family access-policy and record-module configuration. */
export const STATUSES = ['Заплановано', 'У роботі', 'На перевірці', 'На доопрацювання', 'Погоджено', 'Відхилено', 'Завершено'];
export const ROLES = ['leader','deputy','head','member'];
export const DEFAULT_PERMISSIONS = {
  leader: ['*'],
  deputy: ['members:read','members:write','tasks:manage','reports:review','promotions:review','events:manage','capt:manage','fleet:manage','recruitment:manage','notices:manage','content:manage','finance:read','stats:read'],
  head: ['members:read','tasks:manage','reports:review','promotions:review','stats:read'],
  member: []
};
export const HEAD_DEPARTMENT_PERMISSIONS = Object.freeze({
  capt:['capt:manage'],
  farm:[],
  fleet:['fleet:manage'],
  discipline:['discipline:manage'],
  recruitment:['recruitment:manage'],
  events:['events:manage','notices:manage']
});
export const MODULES = {
  tasks: {manage:'tasks:manage', memberRead:true, memberUpdate:true},
  reports: {manage:'reports:review', memberRead:true, memberCreate:true, review:true},
  promotions: {manage:'promotions:review', memberRead:true, memberCreate:true, review:true},
  events: {manage:'events:manage', memberRead:true},
  capt_matches: {manage:'capt:manage', memberRead:true},
  capt_training: {manage:'capt:manage', memberRead:true},
  capt_attendance: {manage:'capt:manage', memberRead:true, memberCreate:true},
  vehicles: {manage:'fleet:manage', memberRead:true},
  vehicle_loans: {manage:'fleet:manage', memberRead:true, memberCreate:true},
  discipline: {manage:'discipline:manage', ownerRead:true},
  blacklist: {manage:'discipline:manage', restricted:true},
  notices: {manage:'notices:manage', memberRead:true},
  gallery: {manage:'content:manage', memberRead:true},
  public_news: {manage:'content:manage'},
  public_team: {manage:'content:manage'},
  public_achievements: {manage:'content:manage'},
  public_calendar: {manage:'content:manage'},
  templates: {manage:'notices:manage', memberRead:true},
  contributions: {manage:'finance:manage', restricted:true},
  expenses: {manage:'finance:manage', restricted:true},
  bonuses: {manage:'finance:manage', restricted:true},
  capt_payments: {manage:'finance:manage', restricted:true}
};
