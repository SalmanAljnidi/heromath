import {toArabicDigits, randInt, shuffle, clamp} from './utils.js';

export class Quiz {
  constructor(opts){
    this.overlay = opts.overlay;
    this.typeEl = opts.typeEl;
    this.timerEl = opts.timerEl;
    this.textEl = opts.textEl;
    this.choicesEl = opts.choicesEl;
    this.onResolve = opts.onResolve; // (isCorrect)=>{}
    this.audio = opts.audio;

    this.active = false;
    this.remaining = 20;
    this._t = null;
    this._locked = false;

    this.correct = 0;
    this.wrong = 0;
  }

  // حسب المرحلة: (٢) ضرب فقط ثم إدخال القسمة تدريجيًا
  _modeForLevel(level){
    // levels are 1-based
    if (level <= 3) return {mulMax:5, allowDiv:false, divMaxResult:0};
    if (level <= 6) return {mulMax:8, allowDiv:true, divMaxResult:5};
    return {mulMax:10, allowDiv:true, divMaxResult:10};
  }

  _makeMultiplication(mulMax){
    const a = randInt(1, mulMax);
    const b = randInt(1, 10);
    const ans = a*b;
    const text = `${toArabicDigits(a)} × ${toArabicDigits(b)} = ؟`;
    return {kind:'ضرب', text, answer:ans};
  }

  _makeDivision(maxResult){
    // نضمن قسمة صحيحة: (dividend ÷ divisor = result) حيث result 1..maxResult
    const result = randInt(1, maxResult);
    const divisor = randInt(1, 10);
    const dividend = result * divisor;
    const text = `${toArabicDigits(dividend)} ÷ ${toArabicDigits(divisor)} = ؟`;
    return {kind:'قسمة', text, answer:result};
  }

  _makeQuestion(level){
    const m = this._modeForLevel(level);
    const allowDiv = m.allowDiv;
    let q;
    if (!allowDiv){
      q = this._makeMultiplication(m.mulMax);
    } else {
      // مزيج (متوازن): 55% ضرب، 45% قسمة
      const chooseDiv = Math.random() < 0.45;
      q = chooseDiv ? this._makeDivision(m.divMaxResult) : this._makeMultiplication(m.mulMax);
    }
    return q;
  }

  _makeChoices(answer){
    // 4 options (unique)
    const opts = new Set([answer]);
    let guard = 0;
    while (opts.size < 4 && guard < 1000){
      guard++;
      // انحرافات معقولة حول الإجابة
      const delta = randInt(-9, 9);
      let cand = answer + delta;
      if (cand < 0) cand = Math.abs(cand) + 1;
      // لا نخليها كبيرة جدًا
      cand = clamp(cand, 0, 100);
      opts.add(cand);
    }
    const arr = shuffle(Array.from(opts));
    return arr;
  }

  show(level){
    if (this.active) return;
    this.active = true;
    this._locked = false;
    this.remaining = 20;
    const q = this._makeQuestion(level);
    this.current = q;

    this.typeEl.textContent = `سؤال ${q.kind}`;
    this.timerEl.textContent = toArabicDigits(this.remaining);
    this.textEl.textContent = q.text;

    // render choices
    this.choicesEl.innerHTML = '';
    const choices = this._makeChoices(q.answer);
    choices.forEach(v => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.type = 'button';
      btn.textContent = toArabicDigits(v);
      btn.addEventListener('click', () => this._pick(v, btn));
      this.choicesEl.appendChild(btn);
    });

    this.overlay.classList.add('show');

    // start timer
    this._t = setInterval(() => {
      this.remaining--;
      this.timerEl.textContent = toArabicDigits(Math.max(0,this.remaining));
      if (this.remaining <= 0){
        this._timeout();
      } else if (this.remaining <= 5){
        this.audio.beepTick();
      }
    }, 1000);
  }

  _pick(value, btn){
    if (!this.active || this._locked) return;
    this._locked = true;

    const correct = (value === this.current.answer);
    const buttons = Array.from(this.choicesEl.querySelectorAll('button.choice'));
    buttons.forEach(b => b.disabled = true);

    if (correct){
      btn.classList.add('good');
      this.correct++;
      this.audio.beepGood();
      setTimeout(() => this._close(true), 650);
    } else {
      btn.classList.add('bad');
      this.wrong++;
      this.audio.beepBad();
      // highlight correct option
      const corr = buttons.find(b => b.textContent === toArabicDigits(this.current.answer));
      if (corr) corr.classList.add('good');
      setTimeout(() => this._close(false), 900);
    }
  }

  _timeout(){
    if (!this.active || this._locked) return;
    this._locked = true;
    const buttons = Array.from(this.choicesEl.querySelectorAll('button.choice'));
    buttons.forEach(b => b.disabled = true);
    // highlight correct
    const corr = buttons.find(b => b.textContent === toArabicDigits(this.current.answer));
    if (corr) corr.classList.add('good');
    this.wrong++;
    this.audio.beepBad();
    setTimeout(() => this._close(false), 900);
  }

  _close(isCorrect){
    clearInterval(this._t);
    this._t = null;
    this.overlay.classList.remove('show');
    this.active = false;
    this.onResolve(isCorrect);
  }
}
