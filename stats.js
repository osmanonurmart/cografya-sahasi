/* =========================================================
   stats.js — karne, ısı haritası, çalışma takvimi
   ========================================================= */
window.Stats = {

  /* ---------------- sınav sonu karnesi ---------------- */
  showReport(s) {
    const sure = Math.round((Date.now() - s.started) / 1000);
    const toplam = s.correct + s.wrong;
    const oran = toplam ? Math.round(s.correct / toplam * 100) : 0;

    const zor = s.perQ.slice().sort((a, b) => b.wrong - a.wrong || b.ms - a.ms)[0];
    const zorIl = Object.entries(s.wrongCities).sort((a, b) => b[1] - a[1])[0];

    const html = `
      <h2 style="margin-bottom:10px">Karne — ${esc(s.label)}</h2>
      <div class="story-stats" style="font-size:15px">
        <div class="r"><span>Süre</span><b>${fmtSure(sure)}</b></div>
        <div class="r"><span>Doğru / Yanlış</span><b>${s.correct} / ${s.wrong}</b></div>
        <div class="r"><span>İsabet</span><b>%${oran}</b></div>
        <div class="r"><span>Soru başına ort.</span><b>${s.perQ.length ? (s.perQ.reduce((t,q)=>t+q.ms,0)/s.perQ.length/1000).toFixed(1) : 0} sn</b></div>
        <div class="r"><span>En çok zorlanılan soru</span><b>${zor ? esc(kisalt(zor.q, 34)) : "—"}</b></div>
        <div class="r"><span>En çok yanlış tıklanan il</span><b>${zorIl ? esc(titleTr(zorIl[0])) + " (" + zorIl[1] + ")" : "—"}</b></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="accent" id="rp-png">Karneyi görsel indir</button>
        <button class="ghost"  id="rp-again">Tekrar çöz</button>
        <button class="ghost"  id="rp-close">Kapat</button>
      </div>`;

    UI.modal(html);
    document.getElementById("rp-close").onclick = () => UI.modalClose();
    document.getElementById("rp-again").onclick = () => { UI.modalClose(); Quiz.startExam(); };
    document.getElementById("rp-png").onclick   = () => this.storyPng(s, sure, oran, zor, zorIl);
  },

  /* story formatı (540x960 → 2x = 1080x1920) */
  storyPng(s, sure, oran, zor, zorIl) {
    const card = document.getElementById("story-canvas-src");
    document.getElementById("st-title").textContent = s.label;

    // halka grafiği
    const R = 80, C = 2 * Math.PI * R;
    document.getElementById("st-ring").innerHTML = `
      <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--line)" stroke-width="16"/>
      <circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--ok)" stroke-width="16"
              stroke-linecap="round" stroke-dasharray="${C}"
              stroke-dashoffset="${C * (1 - oran / 100)}" transform="rotate(-90 100 100)"/>
      <text x="100" y="108" text-anchor="middle" font-size="42" font-weight="800"
            fill="var(--ink)" font-family="monospace">%${oran}</text>`;

    document.getElementById("st-stats").innerHTML = `
      <div class="r"><span>Süre</span><b>${fmtSure(sure)}</b></div>
      <div class="r"><span>Doğru</span><b>${s.correct}</b></div>
      <div class="r"><span>Yanlış</span><b>${s.wrong}</b></div>
      <div class="r"><span>Zorlanılan il</span><b>${zorIl ? esc(titleTr(zorIl[0])) : "—"}</b></div>`;

    const kalan = Math.ceil((new Date(CFG.TARGET_DATE) - Date.now()) / 864e5);
    document.getElementById("st-foot").innerHTML =
      `Sınava ${kalan} gün · ${new Date().toLocaleDateString("tr-TR")}<br>Coğrafya Sahası`;

    card.hidden = false;
    html2canvas(card, { scale: 2, backgroundColor: null, logging: false })
      .then(canvas => { card.hidden = true; canvas.toBlob(b => saveBlob(b, "karne.png")); })
      .catch(e => { card.hidden = true; alert("Görsel oluşturulamadı: " + e.message); });
  },

  /* ---------------- hata ısı haritası ---------------- */
  toggleHeat() {
    if (this._heatOn) { Map81.heatOff(); this._heatOn = false; UI.legend(""); return; }
    const max = Map81.heat(Store.wrongMap());
    if (!max) return UI.flash("Henüz yanlış kaydın yok.");
    this._heatOn = true;
    UI.legend(`<i style="background:#F3D2CE"></i>az <i style="background:#8E241B"></i>çok (maks ${max})`);
  },

  /* ---------------- GitHub tarzı çalışma takvimi ---------------- */
  renderStreak() {
    const days = Store.examDays();
    const end = new Date(CFG.TARGET_DATE);
    const start = new Date(end); start.setDate(start.getDate() - 364);
    // haftanın pazartesiden başlaması için hizala
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

    const cell = 11, gap = 2, cols = Math.ceil((end - start) / 864e5 / 7) + 1;
    const W = cols * (cell + gap) + 30, H = 7 * (cell + gap) + 20;
    const today = new Date().toISOString().slice(0, 10);

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
    ["Pzt","","Çar","","Cum","","Paz"].forEach((d, i) => {
      if (d) svg += `<text class="cal-label" x="0" y="${16 + i * (cell + gap)}">${d}</text>`;
    });

    let streak = 0, best = 0, run = 0, toplam = 0;
    for (let i = 0; i < cols * 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      if (d > end) break;
      const key = d.toISOString().slice(0, 10);
      const n = days[key] || 0;
      if (n) { toplam += n; run++; best = Math.max(best, run); } else if (key <= today) run = 0;
      const lvl = n === 0 ? "" : n === 1 ? " l1" : n === 2 ? " l2" : " l3";
      const cls = key > today ? "sq future" : "sq" + lvl;
      const x = 30 + Math.floor(i / 7) * (cell + gap), y = 8 + (i % 7) * (cell + gap);
      svg += `<rect class="${cls}" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2"><title>${key} — ${n} deneme</title></rect>`;
    }
    svg += "</svg>";
    document.getElementById("streak-cal").innerHTML = svg;

    // bugünden geriye kesintisiz zincir
    let c = 0, d = new Date();
    while (days[d.toISOString().slice(0, 10)]) { c++; d.setDate(d.getDate() - 1); }
    streak = c;
    document.getElementById("streak-info").textContent =
      `${toplam} deneme · güncel zincir ${streak} gün · en uzun ${best} gün`;
  }
};

/* ---- küçük yardımcılar ---- */
function fmtSure(sn) { const d = Math.floor(sn / 60), s = sn % 60; return d ? `${d} dk ${s} sn` : `${s} sn`; }
function kisalt(t, n) { return t.length > n ? t.slice(0, n - 1) + "…" : t; }
function esc(t) { const d = document.createElement("div"); d.textContent = t == null ? "" : t; return d.innerHTML; }
function titleTr(k) { return k.charAt(0) + k.slice(1).toLocaleLowerCase("tr-TR"); }
window.esc = esc;
