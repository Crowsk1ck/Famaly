'use strict';
/* Static UI labels and record-module navigation. Loaded before app.js. */
(()=>{
const roles={leader:'Лідер',deputy:'Заступник',head:'Керівник напрямку',member:'Учасник'};
const statuses=['Заплановано','У роботі','На перевірці','На доопрацювання','Погоджено','Відхилено','Завершено'];
const applicationStatuses=['Очікує','Прийнято','Відхилено'];
const permissionNames={'members:read':'Перегляд складу','members:write':'Керування складом','tasks:manage':'Завдання','reports:review':'Перевірка звітів','promotions:review':'Підвищення','events:manage':'Заходи','capt:manage':'CAPT','fleet:manage':'Автопарк','recruitment:manage':'Рекрутинг','notices:manage':'Оголошення','content:manage':'Публічний контент','finance:read':'Перегляд фінансів','finance:manage':'Нарахування й фінанси','discipline:manage':'Дисципліна','stats:read':'Статистика'};
const moduleInfo={
  tasks:['Завдання','Створення та виконання завдань','tasks:manage'],
  reports:['Звіти','Особисті й командні рапорти з доказами','reports:review'],
  promotions:['Підвищення','Заявки на підвищення з чеклістами','promotions:review'],
  events:['Заходи','Збори, виїзди, тренування та підтвердження участі','events:manage'],
  capt_matches:['CAPT — бої','Склад, розклад та результати CAPT','capt:manage'],
  capt_training:['CAPT — тренування','Розклад і програма тренувань','capt:manage'],
  capt_attendance:['CAPT — відвідування','Запис на бій, облік участі та AFK','capt:manage'],
  vehicles:['Транспорт','Автопарк сім’ї','fleet:manage'],
  vehicle_loans:['Видача й повернення','Журнал переміщення транспорту','fleet:manage'],
  discipline:['Порушення','Попередження й дисциплінарні рішення','discipline:manage'],
  blacklist:['Чорний список','Обмежений доступ для керівництва','discipline:manage'],
  notices:['Оголошення','Повідомлення для учасників','notices:manage'],
  templates:['Шаблони','Тексти з {час}, {місце}, {ім’я}','notices:manage'],
  gallery:['Галерея','Публікація фото за посиланнями ImgBB','content:manage'],
  public_news:['Новини сайту','Публічні оголошення для головної сторінки','content:manage'],
  public_team:['Керівництво сайту','Публічні ігрові профілі керівництва','content:manage'],
  public_achievements:['Досягнення сайту','Опубліковані перемоги CAPT, нагороди та визначні події','content:manage'],
  public_calendar:['Календар сайту','Публічні збори, тренування та івенти','content:manage']
};
const groupRoutes={capt:['capt_matches','capt_training','capt_attendance'],fleet:['vehicles'],discipline:['discipline','blacklist'],announcements:['notices','templates'],reports:['reports','promotions']};
window.GRIZZLY_UI_CONFIG=Object.freeze({roles,statuses,applicationStatuses,permissionNames,moduleInfo,groupRoutes});
})();
