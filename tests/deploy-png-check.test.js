import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/deploy-production.yml',import.meta.url),'utf8');
test('production checks the true PNG signature without retaining newline bytes',()=>{
 assert.match(workflow,/od -An -tx1 -N8 \/tmp\/grizzly-preview \| tr -d '\[:space:\]'/);
 assert.match(workflow,/89504e470d0a1a0a/);
 assert.doesNotMatch(workflow,/tr -d ' \\\\n'/);
});
