/* =========================================================
   quiz.js — soru motoru
   Modlar: normal | reverse (tersten) | atlas | exam (18'lik deneme)
   ========================================================= */
window.Quiz = {
  mode: "normal",
  topicId: null,
  queue: [], idx: -1, cur: null,
  found: null, wrongInQ: 0, qStartedAt: 0,
  session: null,
  active: false,
  _tick: null,

  /* ---------------- oturum başlatma ---------------- */
  startTopic(topicId) {
    const t = Store.topic(topicId); if (!t || !t.qa.length) return;
    if (this.mode === "exam") { this.mode = "normal"; UI.setModeButtons("normal"); }
    this.topicId = topicId;
    this.queue = shuffle(t.qa.map(q => ({ ...q, topicId: t.id, topicTitle: t.title })));
    this._begin(t.title);
  },

  startExam() {
    const pool = Store.allQuestions();
    if (!pool.length) return alert("Havuzda soru yok.");
    this.mode = "exam"; this.topicId = null;
    this.queue = Srs.pick(pool, Math.min(CFG.EXAM_SIZE, pool.length));
    this._begin("18'lik Deneme");
    UI.setModeButtons("exam");
  },

  _begin(label) {
    this.idx = -1;
    this.active = true;
    this.session = { label, correct: 0, wrong: 0, started: Date.now(), perQ: [], wrongCities: {} };
    UI.setProgressLabel(label);
    UI.toggleActionButtons(true);
    this.next();
  },

  stop(silent) {
    this.active = false;
    clearInterval(this._tick);
    Map81.clear();
    UI.toggleActionButtons(false);
    UI.renderQuestion(null);
    if (!silent && this.session) UI.setProgressLabel("Bir konu seç");
  },

  /* ---------------- akış ---------------- */
  next() {
    if (!this.active) return;
    this.idx++;
    if (this.idx >= this.queue.length) return this._finish();

    this.cur = this.queue[this.idx];
    this.found = new Set();
    this.wrongInQ = 0;
    this.qStartedAt = Date.now();

    Map81.clear();
    UI.setProgress(this.idx, this.queue.length);

    if (this.mode === "reverse")    this._renderReverse();
    else if (this.mode === "atlas") this._renderAtlas();
    else                            UI.renderQuestion(this.cur, this.mode);

    this._startTimer();
  },

  _startTimer() {
    clearInterval(this._tick);
    if (this.mode === "atlas") return UI.setTimer(null);
    this._tick = setInterval(() => {
      UI.setTimer((Date.now() - this.qStartedAt) / 1000);
    }, 100);
  },

  _finish() {
    clearInterval(this._tick);
    this.active = false;
    UI.setProgress(this.queue.length, this.queue.length);
    UI.toggleActionButtons(false);
    Sfx.finish();
    if (this.mode === "exam") Store.markExamDay(this.session.correct);
    Stats.showReport(this.session);
    Stats.renderStreak();
  },

  /* ---------------- harita tıklaması ---------------- */
  onCity(key, name, node) {
    if (UI.pickMode) return UI.pickCity(key, name, node);   // soru ekleme modu
    if (!this.active || this.mode === "atlas" || this.mode === "reverse") return;

    const answers = this.cur.a.map(cityKey);
    if (answers.indexOf(key) === -1) {
      // YANLIŞ: anlık kırmızı, sonra orijinale döner (harita temiz kalır)
      Map81.flashWrong(node);
      Sfx.wrong();
      this.wrongInQ++;
      this.session.wrong++;
      this.session.wrongCities[key] = (this.session.wrongCities[key] || 0) + 1;
      Store.bumpWrongCity(key);
      UI.setScore();
      if (this.wrongInQ > 0 && this.wrongInQ % CFG.HINT_AFTER_WRONG === 0) {
        const kalan = answers.filter(a => !this.found.has(a));
        Map81.blink(kalan, CFG.HINT_MS);
        Sfx.hint();
        UI.flash("İpucu: aranan iller sarı yandı");
      }
      return;
    }

    if (this.found.has(key)) return;                        // aynı ili ikinci kez saymayız
    this.found.add(key);
    Map81.set(key, "is-correct", true);                     // soru bitene kadar yeşil kalır
    Sfx.correct();
    this.session.correct++;
    UI.setScore();
    UI.renderFound(this.cur, this.found);

    if (this.found.size === new Set(answers).size) this._questionDone(true);
  },

  _questionDone(solved) {
    const ms = Date.now() - this.qStartedAt;
    Srs.record(this.cur.id, solved && this.wrongInQ === 0, ms, this.wrongInQ);
    this.session.perQ.push({
      id: this.cur.id, q: this.cur.q, topic: this.cur.topicTitle,
      ms, wrong: this.wrongInQ, solved: !!solved
    });
    setTimeout(() => this.next(), 620);
  },

  skip() {
    if (!this.active) return;
    if (this.mode === "atlas") return this.next();
    this._questionDone(false);
  },

  reveal() {
    if (!this.active || !this.cur) return;
    Map81.paint(this.cur.a, "is-correct");
    UI.flash("Cevap: " + this.cur.a.join(", "));
    this._questionDone(false);
  },

  /* ---------------- tersten mod ----------------
     Haritada cevap illeri yeşil yanar, alt kısımda "burası neresi?" şıkları. */
  _renderReverse() {
    Map81.paint(this.cur.a, "is-correct");
    const pool = this.topicId
      ? Store.topic(this.topicId).qa
      : Store.allQuestions().filter(q => q.topicId === this.cur.topicId);
    const distractors = shuffle(pool.filter(q => q.id !== this.cur.id)).slice(0, 3);
    const options = shuffle([this.cur].concat(distractors));
    UI.renderReverse(this.cur, options, (picked, btn) => {
      const ok = picked.id === this.cur.id;
      btn.classList.add(ok ? "ok" : "no");
      if (ok) { Sfx.correct(); this.session.correct++; }
      else    { Sfx.wrong();   this.session.wrong++; this.wrongInQ++; }
      UI.setScore();
      UI.lockOptions();
      this._questionDone(ok);
    });
  },

  /* ---------------- görsel atlas ---------------- */
  _renderAtlas() {
    Map81.paint(this.cur.a, "is-atlas");
    UI.renderAtlas(this.cur);
  }
};

/* =========================================================
   Srs — Anki benzeri ağırlıklandırma (SM-2'nin sadeleştirilmiş hali)
   Kayıt: { n, wrong, streak, avgMs, last }
   Ağırlık = tekrar edilme olasılığı. Yanlış ve yavaş sorular yukarı çıkar.
   ========================================================= */
window.Srs = {
  record(qid, perfect, ms, wrongCount) {
    const db = Store.srs();
    const r = db[qid] || { n: 0, wrong: 0, streak: 0, avgMs: ms, last: 0 };
    r.n++;
    r.wrong += wrongCount;
    r.streak = perfect ? r.streak + 1 : 0;
    r.avgMs = Math.round(r.avgMs * 0.7 + ms * 0.3);   // üstel hareketli ortalama
    r.last = Date.now();
    db[qid] = r;
    Store.srsSave(db);
  },

  weight(qid) {
    const r = Store.srs()[qid];
    if (!r) return 3.0;                               // hiç görülmemiş → öncelikli
    let w = 1.0;
    w += r.wrong * 1.4;                               // hata cezası
    w -= Math.min(r.streak, 4) * 0.45;                // üst üste doğru → seyrekleşir
    if (r.avgMs > 15000) w += 1.2;                    // 15 sn üstü = "yavaş" sayılır
    const gunGecti = (Date.now() - r.last) / 864e5;
    w += Math.min(gunGecti * 0.25, 2.0);              // unutma eğrisi telafisi
    return Math.max(0.25, w);
  },

  /* ağırlıklı, tekrarsız örnekleme */
  pick(pool, n) {
    const items = pool.map(q => ({ q, w: this.weight(q.id) }));
    const out = [];
    while (out.length < n && items.length) {
      const total = items.reduce((s, i) => s + i.w, 0);
      let r = Math.random() * total, k = 0;
      while (k < items.length - 1 && (r -= items[k].w) > 0) k++;
      out.push(items[k].q);
      items.splice(k, 1);
    }
    return out;
  }
};

window.shuffle = function (arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
