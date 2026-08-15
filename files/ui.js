/* =========================================================
   ui.js — DOM bağlama. Tüm event listener'lar burada.
   ========================================================= */
const $ = id => document.getElementById(id);

window.UI = {
  pickMode: false,
  picks: [],

  async boot() {
    const src = await Store.load();
    await Map81.init();
    Map81.onCityClick = (k, n, node) => Quiz.onCity(k, n, node);

    this.applyPrefs();
    this.bindSwitches();
    this.bindModes();
    this.bindPool();
    this.bindComposer();
    this.bindMisc();
    this.renderCards();
    this.setScore();
    this.setupCountdown();
    Stats.renderStreak();
    this.setProgressLabel("Bir konu seç");
    this.toggleActionButtons();
    if (Store.session()) this.showResume();
    if (src === "api") this.flash("C# API bağlı — veriler sunucudan geldi.");
  },

  /* ---------------- tercihler & şalterler ---------------- */
  applyPrefs() {
    const p = Store.prefs();
    document.documentElement.dataset.theme = p.dark === false ? "light" : "dark";
    document.body.classList.toggle("blind", !!p.blind);
    Map81.setRegionsVisible(!!p.regions);
    Map81.setZoom(!!p.zoom);
    Sfx.on = p.sound !== false;
    $("sw-theme").setAttribute("aria-pressed", p.dark !== false);
    $("sw-blind").setAttribute("aria-pressed", !!p.blind);
    $("sw-regions").setAttribute("aria-pressed", !!p.regions);
    $("sw-sound").setAttribute("aria-pressed", Sfx.on);
    this._paintZoomBtn(!!p.zoom);
  },

  bindSwitches() {
    const flip = (id, key, fn) => $(id).onclick = () => {
      const p = Store.prefs(); p[key] = !p[key]; Store.savePrefs(p);
      $(id).setAttribute("aria-pressed", !!p[key]); fn(p[key]);
    };
    flip("sw-theme",  "dark",    v => document.documentElement.dataset.theme = v ? "dark" : "light");
    flip("sw-blind",  "blind",   v => document.body.classList.toggle("blind", v));
    flip("sw-regions","regions", v => Map81.setRegionsVisible(v));
    flip("sw-sound",  "sound",   v => { Sfx.on = v; if (v) Sfx.hint(); });

    $("btn-zoom-toggle").onclick = () => {
      const p = Store.prefs(); p.zoom = !p.zoom; Store.savePrefs(p);
      Map81.setZoom(p.zoom);
      this._paintZoomBtn(p.zoom);
      this.flash(p.zoom ? "Yakınlaştırma açık — tekerlek ve iki parmak çalışır"
                        : "Yakınlaştırma kapalı");
    };
  },

  _paintZoomBtn(on) {
    const b = $("btn-zoom-toggle");
    b.setAttribute("aria-pressed", !!on);
    b.textContent = on ? "Yakınlaştırma: açık" : "Yakınlaştırma: kapalı";
    $("btn-zoom-reset").hidden = !on;
  },

  bindModes() {
    document.querySelectorAll(".mode[data-mode]").forEach(b => {
      b.onclick = () => {
        Quiz.mode = b.dataset.mode;
        this.setModeButtons(b.dataset.mode);
        if (Quiz.topicId) Quiz.startTopic(Quiz.topicId); else Quiz.stop();
      };
    });
    $("btn-exam").onclick = () => Quiz.startExam();
  },

  setModeButtons(m) {
    document.querySelectorAll(".mode[data-mode]").forEach(b =>
      b.classList.toggle("is-on", b.dataset.mode === m && m !== "exam"));
  },

  bindMisc() {
    $("btn-analysis").onclick     = () => Stats.toggleHeat();
    $("btn-download-map").onclick = () => Map81.download("cografya-harita.png");
    $("btn-skip").onclick   = () => Quiz.skip();
    $("btn-reveal").onclick = () => Quiz.reveal();
    $("btn-next").onclick   = () => Quiz.next();
    $("btn-pause").onclick  = () => Quiz.pause();
    $("btn-stop").onclick   = () => {
      if (confirm("Test bitirilsin mi? Kaydedilmemiş ilerleme silinir.")) Quiz.stop();
    };
    $("btn-resume").onclick  = () => Quiz.resume();
    $("btn-discard").onclick = () => { Store.clearSession(); this.hideResume(); };

    $("modal-x").onclick    = () => this.modalClose();
    $("modal-back").onclick = e => { if (e.target === $("modal-back")) this.modalClose(); };
    $("btn-wipe").onclick   = () => {
      if (confirm("Tüm ilerleme, istatistik ve eklediğin sorular silinecek. Emin misin?")) {
        Store.wipe(); location.reload();
      }
    };

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") this.modalClose();
      if (e.key === "Enter" || e.key === " ") {
        if (Quiz.waiting || (Quiz.active && Quiz.mode === "atlas")) { e.preventDefault(); Quiz.next(); }
      }
    });

    // sekme kapanırken açık testi kaybetme
    window.addEventListener("beforeunload", () => { if (Quiz.active) Quiz.pause(); });
  },

  /* ---------------- geri sayım ---------------- */
  setupCountdown() {
    const box = $("countdown");
    if (!CFG.SHOW_COUNTDOWN) { box.hidden = true; return; }
    box.hidden = false;
    const t = new Date(CFG.TARGET_DATE);
    const upd = () => {
      const ms = t - Date.now();
      if (ms <= 0) { $("cd-days").textContent = "0"; $("cd-clock").textContent = "geçti"; return; }
      $("cd-days").textContent = Math.floor(ms / 864e5);
      const s = Math.floor(ms / 36e5) % 24, d = Math.floor(ms / 6e4) % 60;
      $("cd-clock").textContent = `${String(s).padStart(2,"0")}:${String(d).padStart(2,"0")}`;
    };
    upd(); setInterval(upd, 30000);
  },

  /* ---------------- skor & ilerleme ---------------- */
  setScore() {
    const s = Quiz.session || { correct: 0, wrong: 0 };
    const tp = s.correct + s.wrong;
    $("sc-correct").textContent = s.correct;
    $("sc-wrong").textContent   = s.wrong;
    $("sc-rate").textContent    = tp ? "%" + Math.round(s.correct / tp * 100) : "—";
  },
  setProgress(i, n) {
    $("pg-count").textContent = `${Math.min(i + (Quiz.active ? 1 : 0), n)} / ${n}`;
    $("pg-fill").style.width = n ? (i / n * 100) + "%" : "0%";
  },
  setProgressLabel(t) { $("pg-label").textContent = t; },
  setTimer(sec) {
    const el = $("q-timer");
    if (sec == null || !CFG.SHOW_TIMER) { el.hidden = true; return; }
    el.hidden = false; el.textContent = sec.toFixed(1) + " sn";
  },

  /* Buton görünürlüğü tek yerden yönetiliyor — durum karmaşası çıkmasın */
  toggleActionButtons() {
    const a = Quiz.active, w = Quiz.waiting, atlas = Quiz.mode === "atlas";
    $("btn-next").hidden   = !(a && (w || atlas));
    $("btn-skip").hidden   = !(a && !w && !atlas);
    $("btn-reveal").hidden = !(a && !w && !atlas && Quiz.mode !== "reverse");
    $("btn-pause").hidden  = !a;
    $("btn-stop").hidden   = !a;
    $("btn-next").textContent = atlas && !w ? "Sonraki →" : "Sonraki soru →";
  },

  showResume() {
    const s = Store.session(); if (!s) return;
    const kalan = s.queue.length - s.idx;
    $("resume-text").textContent =
      `Yarım kalmış test: ${s.session.label} — ${s.idx + 1}. soruda kaldın, ${kalan} soru duruyor.`;
    $("resume-bar").hidden = false;
  },
  hideResume() { $("resume-bar").hidden = true; },

  /* ---------------- soru gösterimi ---------------- */
  renderQuestion(q) {
    $("q-options").hidden = true; $("q-options").innerHTML = "";
    if (!q) {
      $("q-topic").textContent = "—";
      $("q-text").textContent = "Aşağıdan bir konu kartı seçip “Teste başla” de.";
      $("q-badge").hidden = true; $("q-found").innerHTML = ""; this.setTimer(null);
      return;
    }
    $("q-topic").textContent = q.topicTitle || "";
    $("q-text").textContent  = q.q;
    $("q-badge").hidden      = !q.isImportant;
    this.renderFound(q, new Set());
  },

  /* notuGoster=true ise ilçe/ek bilgi rozeti açılır */
  renderFound(q, found, notuGoster) {
    const n = new Set(q.a.map(cityKey)).size;
    let html = `<span class="chip">${found.size} / ${n} il bulundu</span>`;
    html += Array.from(found).map(k => `<span class="chip found">${esc(titleCase(k))}</span>`).join("");
    if (notuGoster) {
      const eksik = q.a.filter(c => !found.has(cityKey(c)));
      if (eksik.length) html += eksik.map(c => `<span class="chip miss">${esc(c)}</span>`).join("");
      if (q.note) html += `<span class="chip note">📍 ${esc(q.note)}</span>`;
    }
    $("q-found").innerHTML = html;
  },

  renderReverse(q, options, onPick) {
    $("q-topic").textContent = q.topicTitle || "";
    $("q-text").textContent  = "Haritada yeşil yanan iller hangi sorunun cevabı?";
    $("q-badge").hidden      = !q.isImportant;
    $("q-found").innerHTML   = `<span class="chip found">${esc(q.a.join(", "))}</span>`;
    const box = $("q-options"); box.hidden = false; box.innerHTML = "";
    options.forEach(o => {
      const b = document.createElement("button");
      b.textContent = o.q;
      b.onclick = () => onPick(o, b);
      box.appendChild(b);
    });
  },

  lockOptions() { $("q-options").querySelectorAll("button").forEach(b => b.onclick = null); },

  renderAtlas(q) {
    $("q-topic").textContent = q.topicTitle || "";
    $("q-text").textContent  = q.q.replace(/\?$/, "") + " → " + q.a.join(", ");
    $("q-badge").hidden      = !q.isImportant;
    let html = q.note ? `<span class="chip note">📍 ${esc(q.note)}</span>` : "";
    html += q.media ? `<button class="ghost" id="atlas-media">Görsel / video aç</button>`
                    : `<span class="hint">Görsel eklenmemiş.</span>`;
    $("q-found").innerHTML = html;
    $("q-options").hidden = true;
    if (q.media) $("atlas-media").onclick = () => this.modal(
      q.media.type === "video"
        ? `<video src="${esc(q.media.src)}" controls style="width:100%"></video>`
        : `<img src="${esc(q.media.src)}" alt="" style="width:100%">`);
  },

  /* ---------------- konu kartları ---------------- */
  renderCards() {
    const wrap = $("topic-cards"); wrap.innerHTML = "";
    Store.topics.forEach(t => {
      const el = document.createElement("div");
      el.className = "card" + (Quiz.topicId === t.id ? " is-active" : "");
      const yildiz = t.qa.filter(q => q.isImportant).length;
      el.innerHTML = `
        <h3>${esc(t.title)}</h3>
        <p class="desc">${esc(t.desc || "")}</p>
        <span class="meta">${t.qa.length} soru${yildiz ? " · " + yildiz + " ★" : ""}</span>
        <div class="row">
          <button class="accent" data-a="start">Teste başla</button>
          <button class="ghost"  data-a="export">Dışa aktar</button>
          <button class="ghost danger" data-a="del">Sil</button>
        </div>`;
      el.querySelector('[data-a="start"]').onclick = () => {
        Quiz.startTopic(t.id); this.renderCards();
      };
      el.querySelector('[data-a="export"]').onclick = () => {
        saveBlob(new Blob([JSON.stringify([t], null, 2)], { type: "application/json" }),
                 slug(t.title) + ".json");
      };
      el.querySelector('[data-a="del"]').onclick = () => {
        if (!confirm(`“${t.title}” konusu ve ${t.qa.length} sorusu silinecek. Emin misiniz?`)) return;
        Store.removeTopic(t.id);
        if (Quiz.topicId === t.id) Quiz.stop();
        this.renderCards();
      };
      wrap.appendChild(el);
    });
    this.fillTopicSelect();
  },

  bindPool() {
    $("btn-new-topic").onclick = () => {
      const ad = prompt("Konu adı:"); if (!ad) return;
      Store.addTopic(ad, prompt("Kısa açıklama:") || "", []);
      this.renderCards();
    };
    $("btn-export-all").onclick = () =>
      saveBlob(new Blob([JSON.stringify(Store.topics, null, 2)], { type: "application/json" }),
               "cografya-konular.json");

    $("import-file").onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          let j = JSON.parse(r.result);
          if (!Array.isArray(j)) j = [j];
          j.forEach(t => Store.addTopic(t.title, t.desc, (t.qa || []).map(q => ({
            id: uid(), q: q.q,
            a: Array.isArray(q.a) ? q.a : String(q.a).split(/[,;/]/).map(s => s.trim()).filter(Boolean),
            note: q.note || "",
            isImportant: !!q.isImportant, media: q.media || null
          }))));
          this.renderCards();
          this.flash(j.length + " konu içe aktarıldı.");
        } catch (err) { alert("JSON okunamadı: " + err.message); }
        e.target.value = "";
      };
      r.readAsText(f, "utf-8");
    };
  },

  /* ---------------- hızlı soru ekleme ---------------- */
  fillTopicSelect() {
    const s = $("cp-topic"); const cur = s.value;
    s.innerHTML = Store.topics.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("");
    if (cur) s.value = cur;
  },

  bindComposer() {
    $("cp-pickmode").onclick = () => {
      this.pickMode = !this.pickMode;
      $("cp-pickmode").classList.toggle("is-on", this.pickMode);
      $("cp-hint").textContent = this.pickMode
        ? "Seçim modu AÇIK — haritadan illere tıkla. Test tıklamaları durdu."
        : "Cevap illerini haritadan tıklayarak seç (seçim modu kapalı).";
      if (!this.pickMode) Map81.clear("is-picked");
    };

    $("cp-add").onclick = () => {
      const topicId = $("cp-topic").value;
      const metin = $("cp-question").value.trim();
      if (!topicId) return alert("Önce bir konu oluştur.");
      if (!metin)   return alert("Soru metni boş.");
      if (!this.picks.length) return alert("En az bir cevap ili seç.");
      Store.addQuestion(topicId, {
        q: metin,
        a: this.picks.map(p => p.name),
        note: $("cp-note").value.trim(),
        isImportant: $("cp-important").checked
      });
      $("cp-question").value = ""; $("cp-note").value = "";
      $("cp-important").checked = false;
      this.picks.forEach(p => Map81.set(p.key, "is-picked", false));
      this.picks = []; this.renderPicks(); this.renderCards();
      this.flash("Soru eklendi.");
    };
  },

  pickCity(key, name) {
    const i = this.picks.findIndex(p => p.key === key);
    if (i >= 0) { this.picks.splice(i, 1); Map81.set(key, "is-picked", false); }
    else        { this.picks.push({ key, name }); Map81.set(key, "is-picked", true); }
    this.renderPicks();
  },

  renderPicks() {
    $("cp-picks").innerHTML = this.picks.map(p => `<span class="chip found">${esc(p.name)}</span>`).join("");
  },

  /* ---------------- modal & bildirim ---------------- */
  modal(html) { $("modal-body").innerHTML = html; $("modal-back").hidden = false; },
  modalClose() { $("modal-back").hidden = true; $("modal-body").innerHTML = ""; },
  legend(html) { $("legend").innerHTML = html; },

  flash(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div"); el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add("on"));
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove("on"), 2200);
  }
};

function titleCase(k) { return k.charAt(0) + k.slice(1).toLocaleLowerCase("tr-TR"); }
function slug(s) {
  return normTr(s).toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, c => ({ "ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u" }[c]))
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "konu";
}

document.addEventListener("DOMContentLoaded", () => {
  UI.boot().catch(e => {
    console.error(e);
    document.getElementById("map_container").innerHTML =
      `<p style="padding:20px;color:var(--bad)"><b>Harita yüklenemedi.</b><br>${e.message}<br>
       <small style="color:var(--ink-soft)">1) js/tr-cities-data.js var mı?<br>
       2) vendor/d3.v5.min.js indirildi mi?<br>
       3) F12 → Console'daki kırmızı satır ne diyor?</small></p>`;
  });
});
