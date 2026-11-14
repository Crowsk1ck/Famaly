import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const logo=readFileSync(new URL('../public/grizzly-header-logo.svg',import.meta.url),'utf8');
test('GRIZZLY public header displays branded paw crest instead of the old G badge',()=>{
 assert.match(app,/<img class="gr-logo-image" src="\/grizzly-header-logo\.svg" alt="" width="48" height="48"/);
 assert.doesNotMatch(app,/<span class="gr-logo-mark" aria-hidden="true">G<span>\.<\/span><\/span>/);
 assert.match(logo,/GRIZZLY FAMILY — лапа ведмедя/);
 assert.match(logo,/<g fill="#f4dce2">/);
});
test('paw logo retains proportional sizing and mobile treatment',()=>{
 assert.match(css,/\.gr-public \.gr-logo-image\{/);
 assert.match(css,/object-fit:contain/);
 assert.match(css,/@media\(max-width:650px\)/);
});
