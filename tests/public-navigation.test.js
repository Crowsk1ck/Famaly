import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8');
const deploy=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');

test('public navigation keeps the page loaded instead of following links to a prerender shell',()=>{
 assert.match(source,/const publicPathSet=new Set\(Object\.values\(grPublicPaths\)\)/);
 assert.match(source,/document\.addEventListener\('click',event=>\{/);
 assert.match(source,/event\.preventDefault\(\);\s*const target=url\.pathname/);
 assert.match(source,/history\.pushState\(\{grizzlyPublic:true\},'',target\)/);
 assert.match(source,/window\.addEventListener\('popstate'/);
 assert.match(source,/if\(url\.origin!==location\.origin\|\|!publicPathSet\.has\(url\.pathname\)\|\|url\.hash\|\|url\.search\)return/);
});

test('public prerender removes the duplicate root loading screen',()=>{
 assert.match(worker,/html=html\.replace\('<div class="boot"><div class="brand-mark big">🐻<\/div><span>GRIZZLY<\/span><\/div>',''\)/);
});

test('production deploy exercises a real public tab and browser Back in Chromium',()=>{
 assert.match(deploy,/Browser smoke test for public navigation/);
 assert.match(deploy,/waitForFunction\(\(\)=>location\.pathname==='\/join\/'/);
 assert.match(deploy,/page\.goBack/);
 assert.match(deploy,/state\.probe!=='persistent-document'/);
});
