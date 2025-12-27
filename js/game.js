import {clamp, randInt, toArabicDigits} from './utils.js';

export class AudioFX {
  constructor(){
    this.ctx = null;
    this.enabled = true;
  }
  _ensure(){
    if (!this.ctx){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    }
  }
  _tone(freq, dur=0.12, type='sine', gain=0.08){
    if (!this.enabled) return;
    this._ensure();
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t0);
    o.stop(t0 + dur);
  }
  jump(){ this._tone(520,0.10,'square',0.06); this._tone(780,0.08,'square',0.045); }
  coin(){ this._tone(880,0.08,'triangle',0.05); this._tone(1320,0.07,'triangle',0.04); }
  hit(){ this._tone(160,0.14,'sawtooth',0.06); }
  win(){ this._tone(660,0.12,'triangle',0.06); setTimeout(()=>this._tone(880,0.12,'triangle',0.06),130); setTimeout(()=>this._tone(1100,0.14,'triangle',0.06),260); }
  beepGood(){ this._tone(784,0.10,'triangle',0.07); setTimeout(()=>this._tone(988,0.12,'triangle',0.07),110); }
  beepBad(){ this._tone(220,0.12,'sawtooth',0.06); setTimeout(()=>this._tone(180,0.14,'sawtooth',0.06),110); }
  beepTick(){ this._tone(420,0.05,'square',0.03); }
}

class Entity {
  constructor(x,y,w,h){
    this.x=x; this.y=y; this.w=w; this.h=h;
    this.vx=0; this.vy=0;
  }
  aabb(other){
    return this.x < other.x+other.w && this.x+this.w > other.x &&
           this.y < other.y+other.h && this.y+this.h > other.y;
  }
}

export class Game {
  constructor(canvas, ui, onLose){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.onLose = onLose;

    this.keys = {left:false,right:false,jump:false};
    this.touch = {left:false,right:false,jump:false};

    this.gravity = 1800;
    this.speed = 360;
    this.jumpV = -720;

    this.score = 0;
    this.levelIndex = 0; // 0..7
    this.levels = this._makeLevels();
    this.running = false;

    this.correct = 0;
    this.wrong = 0;

    this._resetLevel(true);

    this._last = 0;
  }

  _makeLevels(){
    // Levels are in world units based on 960x540 reference
    const make = (i) => {
      const platforms = [];
      const coins = [];
      const enemies = [];
      const width = 2400 + i*180;
      // ground segments
      platforms.push({x:0,y:480,w:width,h:80, kind:'ground'});
      // some floating platforms
      const count = 6 + i;
      for (let k=0;k<count;k++){
        const px = 220 + k*260 + (k%2?90:0) + i*14;
        const py = 360 - (k%3)*60 - (i%2)*18;
        platforms.push({x:px,y:py,w:180,h:22, kind:'plat'});
        // coins above
        if (k%2===0){
          coins.push({x:px+70,y:py-26,r:10, taken:false});
        }
      }
      // pits (holes) by splitting ground into segments
      const holes = 2 + Math.floor(i/2);
      for (let h=0;h<holes;h++){
        const hx = 520 + h*700 + (i*35);
        const hw = 120 + (h%2)*60;
        platforms.push({x:hx,y:480,w:hw,h:80, kind:'hole', hole:true});
      }
      // enemies
      const eCount = 3 + i;
      for (let e=0;e<eCount;e++){
        const ex = 600 + e*380 + (i*25);
        const ey = 444;
        enemies.push({x:ex,y:ey,w:34,h:28, dir:(e%2?1:-1), speed:70+ i*6});
      }
      // finish flag
      const finish = {x:width-120,y:388,w:26,h:92};
      return {width, platforms, coins, enemies, finish, start:{x:80,y:420}};
    };
    return Array.from({length:8}, (_,i)=>make(i));
  }

  _resetLevel(full=false){
    const lvl = this.levels[this.levelIndex];
    this.cameraX = 0;
    this.player = new Entity(lvl.start.x, lvl.start.y, 34, 44);
    this.player.onGround = false;
    this.player.invuln = 0;
    // copy enemies & coins state
    this.enemies = lvl.enemies.map(e=>({...e, x0:e.x}));
    this.coins = lvl.coins.map(c=>({...c, taken:false}));
    if (full){
      this.score = 0;
      this.correct = 0;
      this.wrong = 0;
    }
    this._syncUI();
  }

  _syncUI(){
    if (!this.ui) return;
    this.ui.level.textContent = toArabicDigits(this.levelIndex+1);
    this.ui.score.textContent = toArabicDigits(this.score);
    this.ui.correct.textContent = toArabicDigits(this.correct);
    this.ui.wrong.textContent = toArabicDigits(this.wrong);
  }

  start(){
    this.running = true;
    this._last = performance.now();
    requestAnimationFrame((t)=>this._loop(t));
  }

  stop(){
    this.running = false;
  }

  setInput(kind, val){
    if (this.keys[kind] !== undefined) this.keys[kind] = val;
  }
  setTouch(kind, val){
    if (this.touch[kind] !== undefined) this.touch[kind] = val;
  }

  _loop(t){
    if (!this.running) return;
    const dt = Math.min(0.033, (t - this._last)/1000);
    this._last = t;
    this._update(dt);
    this._draw();
    requestAnimationFrame((tt)=>this._loop(tt));
  }

  _update(dt){
    const lvl = this.levels[this.levelIndex];
    const p = this.player;

    const left = this.keys.left || this.touch.left;
    const right = this.keys.right || this.touch.right;
    const jump = this.keys.jump || this.touch.jump;

    p.vx = 0;
    if (left) p.vx = -this.speed;
    if (right) p.vx = this.speed;

    // jump
    if (jump && p.onGround){
      p.vy = this.jumpV;
      p.onGround = false;
      this.audio.jump();
    }

    // gravity
    p.vy += this.gravity * dt;

    // integrate X
    p.x += p.vx * dt;
    p.x = clamp(p.x, 0, lvl.width - p.w);

    // integrate Y with collision
    p.y += p.vy * dt;
    p.onGround = false;

    // collide with platforms except holes
    const solids = lvl.platforms.filter(pl => !pl.hole);
    for (const pl of solids){
      if (this._rectsOverlap(p, pl)){
        // resolve
        const prevY = p.y - p.vy*dt;
        const prevBottom = prevY + p.h;
        if (prevBottom <= pl.y + 2 && p.vy >= 0){
          p.y = pl.y - p.h;
          p.vy = 0;
          p.onGround = true;
        } else if (prevY >= pl.y + pl.h - 2 && p.vy < 0){
          p.y = pl.y + pl.h;
          p.vy = 0;
        }
      }
    }

    // holes: falling below screen -> lose
    if (p.y > 560){
      this._lose();
      return;
    }

    // coins
    for (const c of this.coins){
      if (c.taken) continue;
      const dx = (p.x+p.w/2) - c.x;
      const dy = (p.y+p.h/2) - c.y;
      if (dx*dx+dy*dy < (c.r+18)*(c.r+18)){
        c.taken = true;
        this.score += 10;
        this.audio.coin();
        this._syncUI();
      }
    }

    // enemies movement & collision
    for (const e of this.enemies){
      e.x += e.dir * e.speed * dt;
      // bounce within range
      if (e.x > e.x0 + 160){ e.dir = -1; }
      if (e.x < e.x0 - 160){ e.dir = 1; }

      if (p.invuln <= 0 && this._rectsOverlap(p, e)){
        // if player is falling and hits top -> defeat enemy
        const pBottom = p.y + p.h;
        if (p.vy > 0 && pBottom - e.y < 18){
          // stomp
          e.dead = true;
          p.vy = this.jumpV*0.6;
          this.score += 20;
          this.audio.coin();
          this._syncUI();
        } else {
          this._lose();
          return;
        }
      }
    }
    this.enemies = this.enemies.filter(e=>!e.dead);

    // finish
    if (this._rectsOverlap(p, lvl.finish)){
      this.audio.win();
      this._advanceLevel();
      return;
    }

    // invuln
    if (p.invuln > 0) p.invuln -= dt;

    // camera follow
    const target = p.x - 380;
    this.cameraX += (target - this.cameraX) * (1 - Math.pow(0.001, dt));
    this.cameraX = clamp(this.cameraX, 0, Math.max(0, lvl.width - 960));
  }

  _advanceLevel(){
    if (this.levelIndex < this.levels.length - 1){
      this.levelIndex++;
      this._resetLevel(false);
    } else {
      // completed all
      this.levelIndex = 0;
      this._resetLevel(true);
    }
  }

  _lose(){
    if (!this.running) return;
    this.running = false;
    this.onLose();
  }

  afterQuiz(correct){
    // Called by main after quiz resolve
    if (correct){
      this.correct++;
      // continue from same spot with 2 sec invulnerability
      this.player.invuln = 2.0;
      this.running = true;
      this._last = performance.now();
      this._syncUI();
      requestAnimationFrame((t)=>this._loop(t));
    } else {
      this.wrong++;
      // restart level
      this._resetLevel(false);
      this.running = true;
      this._last = performance.now();
      this._syncUI();
      requestAnimationFrame((t)=>this._loop(t));
    }
  }

  _rectsOverlap(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x &&
           a.y < b.y+b.h && a.y+a.h > b.y;
  }

  _draw(){
    const ctx = this.ctx;
    const lvl = this.levels[this.levelIndex];

    // clear
    ctx.clearRect(0,0,960,540);

    // background stars
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    for (let i=0;i<70;i++){
      const x = (i*137 % 960);
      const y = (i*53 % 540);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // platforms
    for (const pl of lvl.platforms){
      if (pl.hole) continue;
      ctx.fillStyle = (pl.kind==='ground') ? '#1c2a55' : '#243566';
      ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
      // top highlight
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.fillRect(pl.x, pl.y, pl.w, 4);
    }

    // holes (visual)
    for (const pl of lvl.platforms.filter(p=>p.hole)){
      ctx.fillStyle = '#070a12';
      ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(pl.x, pl.y, pl.w, 6);
    }

    // coins
    for (const c of this.coins){
      if (c.taken) continue;
      ctx.beginPath();
      ctx.fillStyle = '#fbbf24';
      ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // finish flag
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(lvl.finish.x, lvl.finish.y, 6, lvl.finish.h);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(lvl.finish.x+6, lvl.finish.y+10, lvl.finish.w-6, 26);

    // enemies
    for (const e of this.enemies){
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.fillRect(e.x+6, e.y+8, 6, 6);
      ctx.fillRect(e.x+e.w-12, e.y+8, 6, 6);
    }

    // player
    const p = this.player;
    // blink if invuln
    const blink = p.invuln > 0 && Math.floor(performance.now()/120)%2===0;
    if (!blink){
      // body
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // visor
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillRect(p.x+7, p.y+10, p.w-14, 10);
      // boots
      ctx.fillStyle = '#111827';
      ctx.fillRect(p.x, p.y+p.h-10, p.w, 10);
    }

    ctx.restore();

    // HUD top-left (in Arabic digits)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`المرحلة: ${toArabicDigits(this.levelIndex+1)}   النقاط: ${toArabicDigits(this.score)}`, 14, 24);
    ctx.restore();
  }
}
