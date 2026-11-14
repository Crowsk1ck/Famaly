import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/deploy-production.yml', import.meta.url), 'utf8');

test('production browser smoke captures uncaught errors instead of only logging them', () => {
  assert.match(workflow, /const pageErrors=\[\];/);
  assert.match(workflow, /page\.on\('pageerror',e=>\{ pageErrors\.push\(e\.message\);/);
  assert.match(workflow, /if\(pageErrors\.length\)throw new Error\('Desktop JavaScript errors:/);
  assert.match(workflow, /if\(pageErrors\.length\)throw new Error\('Public JavaScript errors during browser smoke:/);
});

test('public navigation and mobile overflow checks remain in deploy smoke', () => {
  assert.match(workflow, /persistent-document/);
  assert.match(workflow, /page\.goBack/);
  assert.match(workflow, /\.gr-mobile-menu summary/);
  assert.match(workflow, /mobile\.documentWidth>mobile\.width\+4/);
});
