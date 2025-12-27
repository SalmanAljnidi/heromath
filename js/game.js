import {clamp, toArabicDigits} from './utils.js';

export class AudioFX{constructor(){this.ctx=null;this.enabled=true}
 _ensure(){if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C()}}
 _tone(freq,dur=0.12,type='sine',gain=0.08){if(!this.enabled)return;this._ensure();const t0=this.ctx.currentTime;const o=this.ctx.createOscillator();const g=this.ctx.createGain();
  o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,t0);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(g);g.connect(this.ctx.destination);o.start(t0);o.stop(t0+dur)}
 jump(){this._tone(520,0.10,'square',0.06);this._tone(780,0.08,'square',0.045)}
 coin(){this._tone(880,0.08,'triangle',0.05);this._tone(1320,0.07,'triangle',0.04)}
 hit(){this._tone(160,0.14,'sawtooth',0.06)}
 win(){this._tone(660,0.12,'triangle',0.06);setTimeout(()=>this._tone(880,0.12,'triangle',0.06),130);setTimeout(()=>this._tone(1100,0.14,'triangle',0.06),260)}
 beepGood(){this._tone(784,0.10,'triangle',0.07);setTimeout(()=>this._tone(988,0.12,'triangle',0.07),110)}
 beepBad(){this._tone(220,0.12,'sawtooth',0.06);setTimeout(()=>this._tone(180,0.14,'sawtooth',0.06),110)}
 beepTick(){this._tone(420,0.05,'square',0.03)}
}

class Entity{constructor(x,y,w,h){this.x=x;this.y=y;this.w=w;this.h=h;this.vx=0;this.vy=0}}

export class Game{
 constructor(canvas,ui,onLose){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.ui=ui;this.onLose=onLose;
  this.keys={left:false,right:false,jump:false};this.touchAxis=0;this.touchJump=false;
  this.gravity=1900;this.baseSpeed=420;this.jumpV=-760;
  this.score=0;this.levelIndex=0;this.levels=this._makeLevels();this.running=false;
  this.correct=0;this.wrong=0;
  this._resetLevel(true);this._last=0;this._time=0;this.dead=false;this.checkpoint={x:0,y:0};
 }
 _makeLevels(){
  const levels=[];
  for(let i=0;i<8;i++){
   const width=2600+i*220;const holes=[];const plats=[];const coins=[];const enemies=[];const groundY=476;
   const holeCount=3+Math.floor(i/2);
   for(let h=0;h<holeCount;h++){const hx=520+h*(620+i*18)+(i*60);const hw=130+(h%2)*70+(i%3)*10;holes.push({x:hx,w:hw})}
   holes.sort((a,b)=>a.x-b.x);
   let cursor=0;
   for(const ho of holes){const segW=Math.max(0,ho.x-cursor);if(segW>0) plats.push({x:cursor,y:groundY,w:segW,h:80,kind:'ground'});cursor=ho.x+ho.w}
   if(cursor<width) plats.push({x:cursor,y:groundY,w:width-cursor,h:80,kind:'ground'});
   if(i%3===0){
    for(let k=0;k<7+i;k++){const px=220+k*250+(k%2)*60;const py=380-(k%4)*45;plats.push({x:px,y:py,w:200,h:22,kind:'plat'});if(k%2===0) coins.push({x:px+95,y:py-28,r:10,taken:false})}
   }else if(i%3===1){
    for(let k=0;k<6+i;k++){const px=260+k*290;const py=320-(k%2)*70-(k%3)*20;plats.push({x:px,y:py,w:180,h:22,kind:'plat'});if(k%3===0) coins.push({x:px+80,y:py-28,r:10,taken:false})}
    plats.push({x:1100+i*40,y:250,w:160,h:22,kind:'move',range:220,speed:110,x0:1100+i*40});
   }else{
    for(let k=0;k<5+i;k++){const px=240+k*320;const py=360-(k%3)*55;plats.push({x:px,y:py,w:150+(k%2)*60,h:22,kind:'plat'});coins.push({x:px+70,y:py-28,r:10,taken:false});if(k%2===1) coins.push({x:px+105,y:py-28,r:10,taken:false})}
   }
   const eCount=3+i;
   for(let e=0;e<eCount;e++){const ex=650+e*360+(i*30);const ey=groundY-32;const kind=(e%3===0&&i>=2)?'bat':'slime';enemies.push({x:ex,y:ey,w:38,h:28,dir:(e%2?1:-1),speed:85+i*8,kind,x0:ex,phase:e*0.7,dead:false})}
   const finish={x:width-140,y:groundY-92,w:28,h:92};
   levels.push({width,groundY,holes,platforms:plats,coins,enemies,finish,start:{x:90,y:groundY-56},theme:i});
  }
  return levels;
 }
 _resetLevel(full=false){
  const lvl=this.levels[this.levelIndex];
  this.cameraX=0;
  this.player=new Entity(lvl.start.x,lvl.start.y,40,52);
  this.player.onGround=false;this.player.invuln=0;this.player.facing=1;
  this.checkpoint={x:this.player.x,y:this.player.y};
  this.dead=false;
  this.enemies=lvl.enemies.map(e=>({...e,dead:false}));this.coins=lvl.coins.map(c=>({...c,taken:false}));
  if(full){this.score=0;this.correct=0;this.wrong=0}
  this._syncUI();
 }
 _syncUI(){if(!this.ui)return;this.ui.level.textContent=toArabicDigits(this.levelIndex+1);this.ui.score.textContent=toArabicDigits(this.score);
  this.ui.correct.textContent=toArabicDigits(this.correct);this.ui.wrong.textContent=toArabicDigits(this.wrong)}
 start(){this.running=true;this._last=performance.now();requestAnimationFrame(t=>this._loop(t))}
 setInput(k,v){if(this.keys[k]!==undefined)this.keys[k]=v}
 setTouchAxis(v){this.touchAxis=clamp(v,-1,1)}
 setTouchJump(v){this.touchJump=!!v}
 _loop(t){if(!this.running)return;const dt=Math.min(0.033,(t-this._last)/1000);this._last=t;this._time+=dt;this._update(dt);this._draw();requestAnimationFrame(tt=>this._loop(tt))}
 _update(dt){
  const lvl=this.levels[this.levelIndex];const p=this.player;
  const axis=(Math.abs(this.touchAxis)>0.01)?this.touchAxis:0;
  const left=this.keys.left||axis<-0.15;const right=this.keys.right||axis>0.15;const jump=this.keys.jump||this.touchJump;
  const speed=this.baseSpeed*(axis!==0?(0.55+0.45*Math.abs(axis)):1);
  p.vx=0;if(left){p.vx=-speed;p.facing=-1}if(right){p.vx=speed;p.facing=1}
  if(jump&&p.onGround){p.vy=this.jumpV;p.onGround=false;this.audio.jump()}
  p.vy+=this.gravity*dt;
  p.x+=p.vx*dt;p.x=clamp(p.x,0,lvl.width-p.w);
  for(const pl of lvl.platforms){if(pl.kind==='move'){pl.x=pl.x0+Math.sin(this._time*pl.speed/60)*pl.range}}
  const prevY=p.y;p.y+=p.vy*dt;p.onGround=false;
  for(const pl of lvl.platforms){
   if(!this._rectOverlap(p,pl)) continue;
   const prevBottom=prevY+p.h;
   if(prevBottom<=pl.y+2&&p.vy>=0){p.y=pl.y-p.h;p.vy=0;p.onGround=true;this.checkpoint={x:p.x,y:p.y}}
   else if(prevY>=pl.y+pl.h-2&&p.vy<0){p.y=pl.y+pl.h;p.vy=0}
  }
  if(p.y>580){this._lose();return}
  for(const c of this.coins){if(c.taken) continue;const dx=(p.x+p.w/2)-c.x;const dy=(p.y+p.h/2)-c.y;
   if(dx*dx+dy*dy<(c.r+18)*(c.r+18)){c.taken=true;this.score+=10;this.audio.coin();this._syncUI()}}
  for(const e of this.enemies){
   if(e.dead) continue;
   if(e.kind==='slime'){e.x+=e.dir*e.speed*dt;if(e.x>e.x0+180)e.dir=-1;if(e.x<e.x0-180)e.dir=1}
   else{e.x+=e.dir*(e.speed*1.05)*dt;e.y=(lvl.groundY-210)+Math.sin(this._time*2+e.phase)*60;if(e.x>e.x0+220)e.dir=-1;if(e.x<e.x0-220)e.dir=1}
   if(p.invuln<=0&&this._rectOverlap(p,e)){
    const pBottom=p.y+p.h;
    if(e.kind==='slime'&&p.vy>0&&pBottom-e.y<18){e.dead=true;p.vy=this.jumpV*0.55;this.score+=25;this.audio.coin();this._syncUI()}
    else{this._lose();return}
   }
  }
  this.enemies=this.enemies.filter(e=>!e.dead);
  if(this._rectOverlap(p,lvl.finish)){this.audio.win();this._advanceLevel();return}
  if(p.invuln>0)p.invuln-=dt;
  const target=p.x-380;this.cameraX+= (target-this.cameraX)*(1-Math.pow(0.001,dt));this.cameraX=clamp(this.cameraX,0,Math.max(0,lvl.width-960));
 }
 _advanceLevel(){if(this.levelIndex<this.levels.length-1){this.levelIndex++;this._resetLevel(false)}else{this.levelIndex=0;this._resetLevel(true)}}
 _lose(){if(!this.running||this.dead)return;this.dead=true;this.running=false;this.onLose()}
 afterQuiz(ok){
  // called once after the quiz resolves
  if(ok){
    this.correct++;
    // revive to last safe checkpoint so we don't instantly die again (e.g., fell into a pit)
    const p=this.player;
    p.x = this.checkpoint.x;
    p.y = this.checkpoint.y;
    p.vx = 0; p.vy = 0;
    p.invuln = 2.0;
  }else{
    this.wrong++;
    this._resetLevel(false);
  }
  this.dead=false;
  this.running=true;
  this._last=performance.now();
  this._syncUI();
  requestAnimationFrame(t=>this._loop(t));
}else{this.wrong++;this._resetLevel(false)}this.running=true;this._last=performance.now();this._syncUI();requestAnimationFrame(t=>this._loop(t))}
 _rectOverlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
 _draw(){
  const ctx=this.ctx;const lvl=this.levels[this.levelIndex];ctx.clearRect(0,0,960,540);
  const t=this._time;const theme=lvl.theme;
  const gr=ctx.createLinearGradient(0,0,0,540);
  const top=['#102a5a','#1a2f62','#0f3559','#14315c','#0f2a58','#10214e','#101d44','#0f1e43'][theme];
  gr.addColorStop(0,top);gr.addColorStop(1,'#070b16');ctx.fillStyle=gr;ctx.fillRect(0,0,960,540);
  ctx.save();ctx.globalAlpha=0.18;ctx.fillStyle='#fff';for(let i=0;i<90;i++){const x=(i*151)%960;const y=(i*61)%420;ctx.fillRect(x,y,2,2)}ctx.restore();
  const par1=-this.cameraX*0.18;ctx.save();ctx.translate(par1,0);ctx.globalAlpha=0.7;ctx.fillStyle='#0d224a';this._drawHills(ctx,0,410,140,22,7);ctx.restore();
  const par2=-this.cameraX*0.28;ctx.save();ctx.translate(par2,0);ctx.globalAlpha=0.22;ctx.fillStyle='#fff';for(let i=0;i<6;i++){const cx=120+i*220+(Math.sin(t*0.25+i)*20);const cy=90+(i%2)*40;this._cloud(ctx,cx,cy,70,28)}ctx.restore();
  ctx.save();ctx.translate(-this.cameraX,0);
  for(const ho of lvl.holes){ctx.fillStyle='#05070f';ctx.fillRect(ho.x,lvl.groundY,ho.w,80);ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(ho.x,lvl.groundY,ho.w,6)}
  for(const pl of lvl.platforms){
   if(pl.kind==='ground') this._tileRect(ctx,pl.x,pl.y,pl.w,pl.h,'#1b2f5d','#243e78');
   else if(pl.kind==='move'){this._tileRect(ctx,pl.x,pl.y,pl.w,pl.h,'#23406d','#2b5590');ctx.fillStyle='rgba(96,165,250,.18)';ctx.fillRect(pl.x,pl.y-4,pl.w,4)}
   else this._tileRect(ctx,pl.x,pl.y,pl.w,pl.h,'#223b6b','#2c4f8a');
   ctx.fillStyle='rgba(255,255,255,.10)';ctx.fillRect(pl.x,pl.y,pl.w,3);
  }
  for(const c of this.coins){if(c.taken) continue;ctx.save();ctx.translate(c.x,c.y+Math.sin(t*6+c.x*0.01)*2);
   ctx.beginPath();ctx.fillStyle='#fbbf24';ctx.arc(0,0,c.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.22)';ctx.lineWidth=2;ctx.stroke();
   ctx.globalAlpha=0.35;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-3,-3,4,0,Math.PI*2);ctx.fill();ctx.restore();}
  ctx.fillStyle='#60a5fa';ctx.fillRect(lvl.finish.x,lvl.finish.y,6,lvl.finish.h);ctx.fillStyle='#22c55e';ctx.fillRect(lvl.finish.x+6,lvl.finish.y+10,lvl.finish.w-6,26);
  ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(lvl.finish.x+6,lvl.finish.y+10,(lvl.finish.w-6)*0.35,26);
  for(const e of this.enemies){if(e.kind==='slime') this._drawSlime(ctx,e,t); else this._drawBat(ctx,e,t)}
  this._drawHero(ctx,this.player,t);
  ctx.restore();
  ctx.save();ctx.fillStyle='rgba(255,255,255,.88)';ctx.font='16px system-ui';ctx.textAlign='left';
  ctx.fillText(`المرحلة: ${toArabicDigits(this.levelIndex+1)}   النقاط: ${toArabicDigits(this.score)}`,14,24);ctx.restore();
 }
 _drawHills(ctx,x0,yBase,amp,step,count){ctx.beginPath();ctx.moveTo(x0,540);ctx.lineTo(x0,yBase);
  for(let i=0;i<count;i++){const x=x0+i*step*10;const y=yBase+Math.sin(i*0.8)*amp*0.25;ctx.quadraticCurveTo(x+step*5,y-amp*0.35,x+step*10,y)}
  ctx.lineTo(x0+count*step*10,540);ctx.closePath();ctx.fill();}
 _cloud(ctx,x,y,w,h){ctx.beginPath();ctx.ellipse(x,y,w*0.45,h*0.55,0,0,Math.PI*2);ctx.ellipse(x+w*0.25,y-h*0.10,w*0.35,h*0.45,0,0,Math.PI*2);
  ctx.ellipse(x-w*0.25,y-h*0.05,w*0.30,h*0.40,0,0,Math.PI*2);ctx.fill();}
 _tileRect(ctx,x,y,w,h,c1,c2){ctx.fillStyle=c1;ctx.fillRect(x,y,w,h);ctx.save();ctx.globalAlpha=0.35;ctx.strokeStyle=c2;ctx.lineWidth=2;
  const tile=34;for(let yy=y+8;yy<y+h;yy+=tile){for(let xx=x+8;xx<x+w;xx+=tile){const off=((Math.floor((yy-y)/tile))%2)*tile/2;ctx.strokeRect(xx+off,yy,tile-10,tile-16)}}ctx.restore();}
 _drawHero(ctx,p,t){
  const run=Math.abs(p.vx)>10&&p.onGround;const bob=run?Math.sin(t*14)*2:(p.onGround?0:-1);const leg=run?Math.sin(t*14):0;const arm=run?Math.sin(t*14+Math.PI):(p.onGround?0:0.8);
  const x=p.x,y=p.y+bob,w=p.w,h=p.h;
  ctx.save();ctx.globalAlpha=0.18;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(x+w/2,p.y+h+6,18,6,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.globalAlpha=0.55;ctx.fillStyle='#ef4444';ctx.beginPath();const fx=x+(p.facing>0?-6:w+6);
  ctx.moveTo(x+w/2,y+16);ctx.quadraticCurveTo(fx,y+26,x+w/2+(p.facing>0?-20:20),y+46);ctx.quadraticCurveTo(x+w/2,y+44,x+w/2,y+16);ctx.fill();ctx.restore();
  ctx.save();const blink=p.invuln>0&&Math.floor(performance.now()/120)%2===0;if(blink)ctx.globalAlpha=0.25;
  ctx.fillStyle='#8b5cf6';ctx.beginPath();ctx.roundRect(x+6,y+16,w-12,h-22,10);ctx.fill();
  ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.roundRect(x+10,y+4,w-20,18,9);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.75)';ctx.beginPath();ctx.roundRect(x+12,y+10,w-24,7,6);ctx.fill();
  ctx.strokeStyle='#fbbf24';ctx.lineWidth=6;ctx.lineCap='round';const ax=x+w/2,ay=y+24;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax+(p.facing*10),ay+arm*6);ctx.stroke();
  ctx.strokeStyle='#111827';ctx.lineWidth=7;const lx=x+w/2-6,rx=x+w/2+6,ly=y+h-10;ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(lx+leg*6,ly+10);ctx.moveTo(rx,ly);ctx.lineTo(rx-leg*6,ly+10);ctx.stroke();
  ctx.restore();
 }
 _drawSlime(ctx,e,t){const bounce=Math.sin(t*8+e.x*0.02)*2;const x=e.x,y=e.y+bounce,w=e.w,h=e.h;ctx.save();
  ctx.fillStyle='#22c55e';ctx.beginPath();ctx.roundRect(x,y,w,h,12);ctx.fill();
  ctx.globalAlpha=0.35;ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x+w*0.35,y+h*0.35,5,4,0,0,Math.PI*2);ctx.ellipse(x+w*0.65,y+h*0.35,5,4,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;ctx.fillStyle='#052e16';ctx.beginPath();ctx.ellipse(x+w*0.35,y+h*0.40,2.6,2.6,0,0,Math.PI*2);ctx.ellipse(x+w*0.65,y+h*0.40,2.6,2.6,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 _drawBat(ctx,e,t){const flap=(Math.sin(t*12+e.phase)+1)/2;const x=e.x,y=e.y,w=e.w,h=e.h;ctx.save();ctx.translate(x+w/2,y+h/2);
  ctx.fillStyle='#ef4444';ctx.beginPath();ctx.ellipse(0,0,10,8,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fb7185';const wingY=-2+flap*6;ctx.beginPath();ctx.moveTo(-6,0);ctx.quadraticCurveTo(-22,wingY,-30,8);ctx.quadraticCurveTo(-18,4,-6,0);ctx.fill();
  ctx.beginPath();ctx.moveTo(6,0);ctx.quadraticCurveTo(22,wingY,30,8);ctx.quadraticCurveTo(18,4,6,0);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.ellipse(-4,-2,2.2,2.2,0,0,Math.PI*2);ctx.ellipse(4,-2,2.2,2.2,0,0,Math.PI*2);ctx.fill();ctx.restore();}
}
