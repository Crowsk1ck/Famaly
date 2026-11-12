-- Normalize recruitment application statuses independently from generic work-record states.
-- Preserve approved/declined decisions; other legacy workflow states become pending.
-- Increment version to invalidate stale moderation forms after migration.
UPDATE applications
SET status=CASE
  WHEN status IN ('Погоджено','Завершено','Прийнято') THEN 'Прийнято'
  WHEN status='Відхилено' THEN 'Відхилено'
  ELSE 'Очікує'
END,
version=version+1
WHERE status NOT IN ('Очікує','Прийнято','Відхилено');
