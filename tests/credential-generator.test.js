import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../public/credential-generator.js', import.meta.url), 'utf8');
const context = vm.createContext({crypto:webcrypto});
vm.runInContext(source,context);
const {generateLogin,generatePassword} = context.GrizzlyCredentials;

test('generated passwords are 20 random characters with all four character classes',()=>{
  const seen=new Set();
  for(let i=0;i<200;i++){
    const password=generatePassword();
    assert.equal(password.length,20);
    assert.match(password,/[A-Z]/);
    assert.match(password,/[a-z]/);
    assert.match(password,/[2-9]/);
    assert.match(password,/[!@#$%*_?-]/);
    assert.match(password,/^[A-Za-z2-9!@#$%*_?-]{20}$/);
    seen.add(password);
  }
  assert.equal(seen.size,200);
});
test('login generator transliterates Ukrainian nicknames safely',()=>{
  const username=generateLogin('Марьянa_Ґрізлі');
  assert.match(username,/^grz_[a-z0-9_]+_[a-z2-9]{5}$/);
  assert.ok(username.length<=50);
  assert.ok(username.includes('grizli'));
});
test('empty nicknames are handled and two generated logins are distinct',()=>{
  const first=generateLogin('');const next=generateLogin('Нік');
  assert.match(first,/^grz_user_[a-z2-9]{5}$/);
  assert.match(next,/^grz_nik_[a-z2-9]{5}$/);
});
test('checks known username collisions',()=>{
  const original=generateLogin('Гравець');
  const generated=generateLogin('Гравець',[original]);
  assert.notEqual(original,generated);
});
