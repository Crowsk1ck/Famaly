import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const script=read('public/ambient-audio.js');
const favicon=read('public/favicon.svg');
const css=read('public/style.css');

test('all public documents include exact bear favicon and optional audio control',()=>{
 for(const slug of ['', 'about/', 'news/', 'achievements/', 'gallery/', 'calendar/', 'join/']){
  const html=read('public/'+slug+'index.html');
  assert.match(html,/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
  assert.match(html,/<script defer src="\/ambient-audio\.js"><\/script>/);
 }
 assert.match(favicon,/>🐻<\/text>/);
});

test('Grizzly Street Sirens replaces the synthesized soundtrack with opt-in MP3 loop',()=>{
 assert.match(script,/new Audio\(TRACK\)/);
 assert.match(script,/grizzly-street-sirens\.mp3/);
 assert.match(script,/audio\.loop=true/);
 assert.match(script,/button\.addEventListener\('click',/);
 assert.match(script,/async function start\(\)/);
 assert.match(script,/function stop\(\)/);
 assert.match(script,/aria-pressed="false"/);
 assert.doesNotMatch(script,/AudioContext|createOscillator|setInterval\(playChord/);
 assert.doesNotMatch(script,/<audio.*autoplay/i);
});

test('audio volume, accessibility and phone layout are maintained',()=>{
 assert.match(script,/aria-label="Гучність фонової музики"/);
 assert.match(script,/localStorage\.setItem\('grizzly-ambient-volume'/);
 assert.match(script,/wrap\.classList\.toggle\('is-playing',playing\)/);
 assert.match(script,/window\.addEventListener\('pagehide',stop\)/);
 assert.match(css,/\.gr-audio-toggle:focus-visible/);
 assert.match(css,/@media\(max-width:520px\)/);
});
