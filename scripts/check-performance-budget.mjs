// v16.5: explicit lightweight frontend size budget for every PR and deployment.
// Alert on accidental giant bundles, while allowing planned UX additions.
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';

const budgets=[
 {path:'public/app.js',raw:380_000,gzip:105_000},
 {path:'public/style.css',raw:140_000,gzip:35_000},
 {path:'public/app-config.js',raw:100_000,gzip:30_000}
];
for(const budget of budgets){
 const content=readFileSync(budget.path);
 const raw=content.byteLength,gzip=gzipSync(content,{level:9}).byteLength;
 assert.ok(raw<=budget.raw,budget.path+' raw size '+raw+' > '+budget.raw);
 assert.ok(gzip<=budget.gzip,budget.path+' gzip size '+gzip+' > '+budget.gzip);
 console.log(budget.path+': '+raw+' B raw, '+gzip+' B gzip (budget OK)');
}
console.log('GRIZZLY frontend performance budgets passed');
