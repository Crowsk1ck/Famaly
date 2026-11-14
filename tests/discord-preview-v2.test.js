import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const get=path=>readFileSync(fileURLToPath(new URL('../'+path,import.meta.url)),'utf8');
const bannerUrl='https://grizzly-family.online/grizzly-social-v2.png';

test('Discord embeds use new versioned 1200x630 PNG on every public page',()=>{
 for(const slug of ['', 'about/','news/','gallery/','achievements/','calendar/','join/']){
   const html=get('public/'+slug+'index.html');
   assert.ok(html.includes('<meta property="og:image" content="'+bannerUrl+'" />'),slug);
   assert.ok(html.includes('<meta property="og:image:width" content="1200" />'),slug);
   assert.ok(html.includes('<meta property="og:image:height" content="630" />'),slug);
   assert.ok(html.includes('<meta name="twitter:image" content="'+bannerUrl+'" />'),slug);
   assert.ok(html.includes('<meta property="og:image:type" content="image/png" />'),slug);
   assert.doesNotMatch(html,/grizzly-social\.png/);
 }
});

test('social preview source is branded paw art without old G block',()=>{
 const svg=get('public/grizzly-social-v2.svg');
 assert.match(svg,/GRIZZLY FAMILY/);
 assert.match(svg,/GTA 5 RP/);
 assert.match(svg,/<g fill="#f6dfe4"/);
 assert.doesNotMatch(svg,/>G<\/text>/);
});

test('production builds and checks PNG before finishing deployment',()=>{
 const pkg=JSON.parse(get('package.json'));
 const workflow=get('.github/workflows/deploy-production.yml');
 const builder=get('scripts/build-social-preview.mjs');
 assert.equal(pkg.scripts['build:social'],'node scripts/build-social-preview.mjs');
 assert.ok(pkg.devDependencies.sharp);
 assert.match(workflow,/npm run build:social/);
 assert.ok(workflow.includes('https://grizzly-family.online/grizzly-social-v2.png'));
 assert.match(builder,/resize\(1200,630/);
 assert.match(builder,/\.png\(/);
});
