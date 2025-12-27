import {Quiz} from './quiz.js';
import {Game, AudioFX} from './game.js';

const canvas = document.getElementById('game');

const ui = {
  level: document.getElementById('uiLevel'),
  score: document.getElementById('uiScore'),
  correct: document.getElementById('uiCorrect'),
  wrong: document.getElementById('uiWrong')
};

const audio = new AudioFX();

// PWA install status
const pwaStatus = document.getElementById('pwaStatus');
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  pwaStatus.textContent = 'يمكن تثبيتها الآن';
});
window.addEventListener('appinstalled', () => {
  pwaStatus.textContent = 'تم التثبيت ✅';
});

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try{
      await navigator.serviceWorker.register('./sw.js');
    }catch(e){
      // ignore
    }
  });
}

const game = new Game(canvas, ui, () => {
  // onLose
  quiz.show(game.levelIndex+1);
});

game.audio = audio;

const quiz = new Quiz({
  overlay: document.getElementById('quizOverlay'),
  typeEl: document.getElementById('quizType'),
  timerEl: document.getElementById('quizTimer'),
  textEl: document.getElementById('quizText'),
  choicesEl: document.getElementById('quizChoices'),
  audio,
  onResolve: (isCorrect) => {
    game.afterQuiz(isCorrect);
  }
});

// Controls
function bindKey(){
  window.addEventListener('keydown', (e) => {
    if (quiz.active) return; // pause controls during quiz
    if (e.code === 'ArrowLeft') game.setInput('left', true);
    if (e.code === 'ArrowRight') game.setInput('right', true);
    if (e.code === 'Space') { game.setInput('jump', true); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') game.setInput('left', false);
    if (e.code === 'ArrowRight') game.setInput('right', false);
    if (e.code === 'Space') game.setInput('jump', false);
  });
}

bindKey();

// Touch buttons
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnJump = document.getElementById('btnJump');

function bindTouch(btn, key){
  const down = () => game.setTouch(key,true);
  const up = () => game.setTouch(key,false);
  btn.addEventListener('touchstart', (e)=>{ if(!quiz.active){ down(); audio._ensure(); } e.preventDefault(); }, {passive:false});
  btn.addEventListener('touchend', (e)=>{ up(); e.preventDefault(); }, {passive:false});
  btn.addEventListener('touchcancel', (e)=>{ up(); e.preventDefault(); }, {passive:false});
  // also allow mouse
  btn.addEventListener('mousedown', ()=>{ if(!quiz.active){ down(); audio._ensure(); } });
  window.addEventListener('mouseup', up);
}
bindTouch(btnLeft,'left');
bindTouch(btnRight,'right');
bindTouch(btnJump,'jump');

// Start/Restart
document.getElementById('btnStart').addEventListener('click', () => {
  audio._ensure();
  if (!game.running) game.start();
});
document.getElementById('btnRestart').addEventListener('click', () => {
  audio._ensure();
  game.levelIndex = 0;
  game._resetLevel(true);
  if (!game.running) game.start();
});
