/* GRIZZLY FAMILY: opt-in background soundtrack, provided by the family. */
(()=>{'use strict';
 if(!document.body)return;
 const TRACK='/grizzly-street-sirens.mp3';
 const audio=new Audio(TRACK);
 audio.preload='none';
 audio.loop=true;
 let playing=false;
 const wrap=document.createElement('aside');
 wrap.className='gr-audio-dock';
 wrap.setAttribute('aria-label','Фонова музика GRIZZLY');
 wrap.innerHTML='<button class="gr-audio-toggle" type="button" aria-label="Увімкнути фонову музику" aria-pressed="false"><span aria-hidden="true">♫</span><span class="gr-audio-caption">Музика вимкнена</span></button><label class="gr-audio-volume-label"><span class="gr-audio-sr">Гучність музики</span><input type="range" min="0" max="100" step="1" value="18" aria-label="Гучність фонової музики"></label>';
 document.body.appendChild(wrap);
 const button=wrap.querySelector('button'),caption=wrap.querySelector('.gr-audio-caption'),volume=wrap.querySelector('input');
 try{const saved=Number(localStorage.getItem('grizzly-ambient-volume'));if(Number.isFinite(saved)&&saved>=0&&saved<=100)volume.value=String(saved)}catch{}
 const gainValue=()=>Math.pow(Number(volume.value)/100,1.5);
 audio.volume=gainValue();
 function update(){
  button.setAttribute('aria-pressed',String(playing));
  button.setAttribute('aria-label',playing?'Вимкнути фонову музику':'Увімкнути фонову музику');
  caption.textContent=playing?'Grizzly Street Sirens':'Музика вимкнена';
  wrap.classList.toggle('is-playing',playing);
 }
 function stop(){playing=false;audio.pause();update()}
 async function start(){
  if(playing)return;
  try{await audio.play();playing=true;update()}
  catch{playing=false;update();caption.textContent='Не вдалося відтворити музику'}
 }
 button.addEventListener('click',()=>{if(playing)stop();else void start()});
 volume.addEventListener('input',()=>{
  audio.volume=gainValue();
  try{localStorage.setItem('grizzly-ambient-volume',volume.value)}catch{}
 });
 audio.addEventListener('error',()=>{stop();caption.textContent='Музичний файл недоступний'});
 window.addEventListener('pagehide',stop);
 update();
})();
