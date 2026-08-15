/* =========================================================
   audio.js — ses dosyası YOK. Web Audio API ile sentezleniyor.
   Sebep: offline pakete mp3 koymamak, boyutu 0 tutmak.
   İstersen sounds/ klasörüne mp3 koyup Sfx.play'i değiştirebilirsin.
   ========================================================= */
window.Sfx = {
  ctx: null,
  on: true,

  _ctx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },

  _tone(freq, dur, type, gain) {
    const c = this._ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.18, c.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur + 0.02);
  },

  correct() {
    if (!this.on) return;
    this._tone(880, 0.10, "sine", 0.16);
    setTimeout(() => this._tone(1318, 0.13, "sine", 0.12), 70);   // ince "ding"
    this.buzz(18);
  },

  wrong() {
    if (!this.on) return;
    this._tone(150, 0.20, "square", 0.10);                        // tok ses
    this.buzz([35, 45, 35]);
  },

  finish() {
    if (!this.on) return;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.16, "triangle", 0.13), i * 110));
    this.buzz([30, 60, 30, 60, 90]);
  },

  hint() { if (this.on) this._tone(660, 0.09, "triangle", 0.08); },

  /* navigator.vibrate: masaüstü tarayıcılarda ve iOS Safari'de yok sayılır,
     Android Chrome'da çalışır. Hata vermez, sessizce false döner. */
  buzz(p) { if (this.on && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
};
