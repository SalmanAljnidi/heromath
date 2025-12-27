import {toArabicDigits, randInt, shuffle, clamp} from './utils.js';
export class Quiz{
 constructor(o){this.overlay=o.overlay;this.typeEl=o.typeEl;this.timerEl=o.timerEl;this.textEl=o.textEl;this.choicesEl=o.choicesEl;this.onResolve=o.onResolve;this.audio=o.audio;
  this.active=false;this.remaining=20;this._t=null;this._locked=false;this.correct=0;this.wrong=0;}
 _modeForLevel(l){if(l<=3) return {mulMax:5,allowDiv:false,divMaxResult:0}; if(l<=6) return {mulMax:8,allowDiv:true,divMaxResult:5}; return {mulMax:10,allowDiv:true,divMaxResult:10};}
 _makeMultiplication(m){const a=randInt(1,m),b=randInt(1,10),ans=a*b;return {kind:'ضرب',text:`${toArabicDigits(a)} × ${toArabicDigits(b)} = ؟`,answer:ans};}
 _makeDivision(maxR){const res=randInt(1,maxR),div=randInt(1,10),dvd=res*div;return {kind:'قسمة',text:`${toArabicDigits(dvd)} ÷ ${toArabicDigits(div)} = ؟`,answer:res};}
 _makeQuestion(l){const m=this._modeForLevel(l); if(!m.allowDiv) return this._makeMultiplication(m.mulMax); return (Math.random()<0.45)?this._makeDivision(m.divMaxResult):this._makeMultiplication(m.mulMax);}
 _makeChoices(ans){const s=new Set([ans]);let g=0;while(s.size<4&&g++<1000){let c=ans+randInt(-9,9);if(c<0)c=Math.abs(c)+1;c=clamp(c,0,120);s.add(c);}return shuffle(Array.from(s));}
 show(level){if(this.active)return;this.active=true;this._locked=false;this.remaining=20;const q=this._makeQuestion(level);this.current=q;
  this.typeEl.textContent=`سؤال ${q.kind}`;this.timerEl.textContent=toArabicDigits(this.remaining);this.textEl.textContent=q.text;this.choicesEl.innerHTML='';
  this._makeChoices(q.answer).forEach(v=>{const b=document.createElement('button');b.className='choice';b.type='button';b.textContent=toArabicDigits(v);b.addEventListener('click',()=>this._pick(v,b));this.choicesEl.appendChild(b);});
  this.overlay.classList.add('show');
  this._t=setInterval(()=>{this.remaining--;this.timerEl.textContent=toArabicDigits(Math.max(0,this.remaining));if(this.remaining<=0)this._timeout();else if(this.remaining<=5)this.audio.beepTick();},1000);
 }
 _pick(v,btn){if(!this.active||this._locked)return;this._locked=true;const ok=(v===this.current.answer);const bs=Array.from(this.choicesEl.querySelectorAll('button.choice'));bs.forEach(b=>b.disabled=true);
  if(ok){btn.classList.add('good');this.correct++;this.audio.beepGood();setTimeout(()=>this._close(true),650);}
  else{btn.classList.add('bad');this.wrong++;this.audio.beepBad();const c=bs.find(b=>b.textContent===toArabicDigits(this.current.answer));if(c)c.classList.add('good');setTimeout(()=>this._close(false),900);}
 }
 _timeout(){if(!this.active||this._locked)return;this._locked=true;const bs=Array.from(this.choicesEl.querySelectorAll('button.choice'));bs.forEach(b=>b.disabled=true);
  const c=bs.find(b=>b.textContent===toArabicDigits(this.current.answer));if(c)c.classList.add('good');this.wrong++;this.audio.beepBad();setTimeout(()=>this._close(false),900);
 }
 _close(ok){clearInterval(this._t);this._t=null;this.overlay.classList.remove('show');this.active=false;this.onResolve(ok);}
}
