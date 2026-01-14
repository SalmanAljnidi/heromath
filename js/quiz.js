import {toArabicDigits, randInt, shuffle, clamp} from './utils.js';

export class Quiz{
  constructor(o){
    this.overlay=o.overlay;
    this.typeEl=o.typeEl;
    this.timerEl=o.timerEl;
    this.textEl=o.textEl;
    this.vizEl=o.vizEl; // optional (not used here)
    this.choicesEl=o.choicesEl;
    this.onResolve=o.onResolve;
    this.audio=o.audio;

    this.active=false;
    this.remaining=20;
    this._t=null;
    this._locked=false;

    this.correct=0;
    this.wrong=0;
    this.current=null;
  }

  _makeMul(){
    const a = randInt(0,10);
    const b = randInt(0,10);
    return {kind:'ضرب', op:'×', a, b, answer:a*b, text:`${toArabicDigits(a)} × ${toArabicDigits(b)} = ؟`};
  }

  _makeDiv(){
    const divisor = randInt(1,10);      // المقسوم عليه عدد واحد
    const quotient = randInt(0,10);     // الناتج عدد واحد
    const dividend = divisor * quotient;
    return {kind:'قسمة', op:'÷', a:dividend, b:divisor, answer:quotient, text:`${toArabicDigits(dividend)} ÷ ${toArabicDigits(divisor)} = ؟`};
  }

  _question(level){
    // Mix division a bit more as levels progress
    const divBias = Math.min(0.60, 0.25 + level*0.03);
    return (Math.random()<divBias) ? this._makeDiv() : this._makeMul();
  }

  _choices(answer, q){
    const s=new Set([answer]);
    let guard=0;
    const max = (q && q.op==='×') ? 100 : 10;   // الضرب حتى 100، القسمة الناتج 0-10
    const span = (max===100) ? 12 : 3;

    while(s.size<4 && guard++<800){
      let c = answer + randInt(-span, span);
      c = clamp(c,0,max);
      s.add(c);
    }
    while(s.size<4) s.add(randInt(0,max));
    return shuffle([...s]).slice(0,4);
  }

  _clearViz(){
    if(!this.vizEl) return;
    this.vizEl.innerHTML='';
  }

  show(level){
    if(this.active) return;
    if(!this.overlay || !this.typeEl || !this.timerEl || !this.textEl || !this.choicesEl){
      try{ this.onResolve(false); }catch{}
      return;
    }

    this.active=true;
    this._locked=false;
    this.remaining=20;

    const q=this._question(level);
    this.current=q;

    this.typeEl.textContent=`سؤال ${q.kind}`;
    this.timerEl.textContent=toArabicDigits(this.remaining);
    this.textEl.textContent=q.text;
    this._clearViz();

    this.choicesEl.innerHTML='';
    this._choices(q.answer, q).forEach(v=>{
      const btn=document.createElement('button');
      btn.className='choice';
      btn.type='button';
      btn.textContent=toArabicDigits(v);
      btn.addEventListener('click',()=>this._pick(v,btn));
      this.choicesEl.appendChild(btn);
    });

    this.overlay.classList.add('show');

    this._t=setInterval(()=>{
      this.remaining--;
      this.timerEl.textContent=toArabicDigits(Math.max(0,this.remaining));
      if(this.remaining<=0) this._timeout();
      else if(this.remaining<=5) this.audio?.tick?.();
    },1000);
  }

  _pick(value, btn){
    if(!this.active || this._locked) return;
    this._locked=true;

    const ok = (value===this.current.answer);
    const buttons=[...this.choicesEl.querySelectorAll('button.choice')];
    buttons.forEach(b=>b.disabled=true);

    if(ok){
      btn.classList.add('good');
      this.correct++;
      this.audio?.good?.();
      setTimeout(()=>this._close(true),650);
    }else{
      btn.classList.add('bad');
      this.wrong++;
      this.audio?.bad?.();
      const corr=buttons.find(b=>b.textContent===toArabicDigits(this.current.answer));
      if(corr) corr.classList.add('good');
      setTimeout(()=>this._close(false),900);
    }
  }

  _timeout(){
    if(!this.active || this._locked) return;
    this._locked=true;
    const buttons=[...this.choicesEl.querySelectorAll('button.choice')];
    buttons.forEach(b=>b.disabled=true);
    const corr=buttons.find(b=>b.textContent===toArabicDigits(this.current.answer));
    if(corr) corr.classList.add('good');
    this.wrong++;
    this.audio?.bad?.();
    setTimeout(()=>this._close(false),900);
  }

  _close(ok){
    clearInterval(this._t); this._t=null;
    this.overlay.classList.remove('show');
    this.active=false;
    try{ this.onResolve(ok); }catch{}
  }
}
