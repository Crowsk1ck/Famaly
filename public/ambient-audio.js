/* GRIZZLY FAMILY: original synthesized ambient loop, opt-in playback only. */
(()=>{'use strict';
 const AudioContextClass=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextClass||!document.body)return;
 let ctx=null,master=null,timer=null,playing=false,step=0;
 const chords=[
  {bass:110,notes:[220,261.63,329.63]},
  {bass:87.31,notes:[174.61,220,261.63]},
  {bass:130.81,notes:[196,261.63,329.63]},
  {bass:98,notes:[196,246.94,293.66]}
 ];
 const wrap=document.createElement('aside');
 wrap.className='gr-audio-dock';
 wrap.setAttribute('aria-label','Фонова музика GRIZZLY');
 wrap.innerHTML='<button class="gr-audio-toggle" type="button" aria-label="Увімкнути фонову музику" aria-pressed="false"><span aria-hidden="true">♫</span><span class="gr-audio-caption">Музика вимкнена</span></button><label class="gr-audio-volume-label"><span class="gr-audio-sr">Гучність музики</span><input type="range" min="0" max="100" step="1" value="18" aria-label="Гучність фонової музики"></label>';
 document.body.appendChild(wrap);
 const button=wrap.querySelector('button'),caption=wrap.querySelector('.gr-audio-caption'),volume=wrap.querySelector('input');
 try{const saved=Number(localStorage.getItem('grizzly-ambient-volume'));if(Number.isFinite(saved)&&saved>=0&&saved<=100)volume.value=String(saved)}catch{}
 const gainValue=()=>Math.pow(Number(volume.value)/100,1.5)*0.45;
 function playNote(freq,now,duration,loudness,wave){
   const osc=ctx.createOscillator(),env=ctx.createGain();
   osc.type=wave;osc.frequency.setValueAtTime(freq,now);
   const attack=Math.min(1.4,duration*.24),release=Math.min(2,duration*.3);
   env.gain.setValueAtTime(0.0001,now);
   env.gain.linearRampToValueAtTime(loudness,now+attack);
   env.gain.setValueAtTime(loudness,now+duration-release);
   env.gain.exponentialRampToValueAtTime(0.0001,now+duration);
   osc.connect(env);env.connect(master);osc.start(now);osc.stop(now+duration+.05);
   osc.onended=()=>{osc.disconnect();env.disconnect()};
 }
 function playChord(){
  if(!playing||!ctx)return;
  const chord=chords[step++%chords.length],now=ctx.currentTime+.04;
  chord.notes.forEach((f,i)=>playNote(f,now+i*.12,7.7,.20,'sine'));
  playNote(chord.bass,now,7.7,.17,'triangle');
  // Small, sparse bell motif; no external track or copyrighted recording.
  [0,2,1,2].forEach((n,i)=>playNote(chord.notes[n]*2,now+1+i*1.6,1.35,.045,'sine'));
 }
 function update(){
  button.setAttribute('aria-pressed',String(playing));
  button.setAttribute('aria-label',playing?'Вимкнути фонову музику':'Увімкнути фонову музику');
  caption.textContent=playing?'Музика увімкнена':'Музика вимкнена';
  wrap.classList.toggle('is-playing',playing);
 }
 async function stop(){
  playing=false;clearInterval(timer);timer=null;update();
  const previous=ctx;ctx=null;master=null;
  if(previous){try{await previous.close()}catch{}}
 }
 async function start(){
  if(playing)return;
  try{
   ctx=new AudioContextClass();
   master=ctx.createGain();master.gain.value=gainValue();master.connect(ctx.destination);
   await ctx.resume();playing=true;step=0;update();playChord();
   timer=setInterval(playChord,8000);
  }catch{await stop();caption.textContent='Звук недоступний у цьому браузері'}
 }
 button.addEventListener('click',()=>{if(playing)void stop();else void start()});
 volume.addEventListener('input',()=>{
  if(ctx&&master)master.gain.setTargetAtTime(gainValue(),ctx.currentTime,.08);
  try{localStorage.setItem('grizzly-ambient-volume',volume.value)}catch{}
 });
 window.addEventListener('pagehide',()=>{if(playing)void stop()});
 update();
})();
