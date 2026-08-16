/* =========================================================
   ui.js — DOM bağlama
   ========================================================= */
const $ = id => document.getElementById(id);

window.UI = {
  ws: "solve",
  pickMode: false,
  picks: [],          // [{key, name, note}]
  pickR: [],          // [{key, name}]
  editing: null,
  seciliKonu: null,

  /* ================= AÇILIŞ ================= */
  async boot() {
    if (!Profiles.activeId() || !Profiles.active()) return this.showProfiles();
    await this.start();
  },

  async start() {
    $("profile-screen").hidden = true;
    const src = await Store.load();
    if (!Map81.svg) {
      await Map81.init();
      Map81.onCityClick  = (k, n, node) => Quiz.onCity(k, n, node);
      Map81.onRiverClick = (k, n) => Quiz.onRiver(k, n);
      this.bindAll();
    }
    this.applyPrefs();
    this.renderTopics();
    this.fillTopicSelect();
    this.setScore();
    this.setupCountdown();
    this.setProgressLabel("Bir konu seç");
    this.toggleActionButtons();
    this.paintAvatar();
    $("streak-section").hidden = !CFG.SHOW_STREAK;
    if (CFG.SHOW_STREAK) Stats.renderStreak();
    if (Store.session()) this.showResume(); else this.hideResume();
    if (src === "api") this.flash("C# API bağlı — veriler sunucudan geldi.");
  },

  bindAll() {
    this.bindSwitches(); this.bindWorkspace(); this.bindModes();
    this.bindBuilder();  this.bindTextImport(); this.bindMisc(); this.bindTopics();
  },

  /* ================= PROFİLLER ================= */
  showProfiles(yonet) {
    $("profile-screen").hidden = false;
    const grid = $("ps-grid"); grid.innerHTML = "";
    const list = Profiles.all();

    list.forEach(p => {
      const el = document.createElement("div");
      el.className = "ps-card";
      el.innerHTML = `
        <div class="ps-face" style="background:${p.color}">${esc(Profiles.bas(p.name))}</div>
        <span class="ps-name">${esc(p.name)}</span>
        ${yonet ? `<div class="ps-tools">
            <button class="ico" data-a="ren" title="Adını değiştir">✎</button>
            <button class="ico" data-a="clr" title="Verilerini temizle">⌫</button>
            <button class="ico danger" data-a="del" title="Kullanıcıyı sil">🗑</button>
          </div>` : ""}`;

      if (!yonet) el.onclick = () => { Profiles.setActive(p.id); this.start(); };
      else {
        el.querySelector('[data-a="ren"]').onclick = () => {
          const ad = prompt("Yeni ad:", p.name); if (!ad) return;
          Profiles.rename(p.id, ad); this.showProfiles(true);
        };
        el.querySelector('[data-a="clr"]').onclick = () => {
          if (!confirm(`“${p.name}” kullanıcısının tüm soruları, istatistikleri ve ilerlemesi silinecek. Kullanıcı kalacak.\n\nEmin misin?`)) return;
          Profiles.clearData(p.id); this.flash("Veriler temizlendi.");
        };
        el.querySelector('[data-a="del"]').onclick = () => {
          if (!confirm(`“${p.name}” kullanıcısı ve tüm verisi silinecek.\n\nEmin misin?`)) return;
          Profiles.remove(p.id); this.showProfiles(true);
        };
      }
      grid.appendChild(el);
    });

    const yeni = document.createElement("div");
    yeni.className = "ps-card add";
    yeni.innerHTML = `<div class="ps-face plus">+</div><span class="ps-name">Yeni kullanıcı</span>`;
    yeni.onclick = () => {
      const ad = prompt("Kullanıcı adı:"); if (!ad) return;
      const p = Profiles.add(ad);
      if (yonet) this.showProfiles(true);
      else { Profiles.setActive(p.id); this.start(); }
    };
    grid.appendChild(yeni);

    const btn = $("ps-manage");
    btn.textContent = yonet ? "Bitti" : "Düzenle";
    btn.hidden = !list.length;
    btn.onclick = () => this.showProfiles(!yonet);
  },

  paintAvatar() {
    const p = Profiles.active(); if (!p) return;
    const b = $("btn-profile");
    b.textContent = Profiles.bas(p.name);
    b.style.background = p.color;
    b.title = p.name + " — kullanıcı değiştir";
  },

  /* ================= TERCİHLER ================= */
  applyPrefs() {
    const p = Store.prefs();
    document.body.classList.toggle("blind", !!p.blind);
    Map81.setRegionsVisible(!!p.regions);
    Map81.setRiversVisible(!!p.rivers);
    Sfx.on = p.sound !== false;
    $("sw-blind").setAttribute("aria-pressed", !!p.blind);
    $("sw-regions").setAttribute("aria-pressed", !!p.regions);
    $("sw-rivers").setAttribute("aria-pressed", !!p.rivers);
    $("sw-sound").setAttribute("aria-pressed", Sfx.on);
  },

  bindSwitches() {
    const flip = (id, key, fn) => $(id).onclick = () => {
      const p = Store.prefs(); p[key] = !p[key]; Store.savePrefs(p);
      $(id).setAttribute("aria-pressed", !!p[key]); fn(p[key]);
    };
    flip("sw-blind",  "blind",   v => document.body.classList.toggle("blind", v));
    flip("sw-regions","regions", v => Map81.setRegionsVisible(v));
    flip("sw-rivers", "rivers",  v => {
      Map81.setRiversVisible(v);
      if (v && !Map81.hasRivers) this.flash("Akarsu verisi yüklü değil. akarsu-donustur.html ile üret.");
    });
    flip("sw-sound",  "sound",   v => { Sfx.on = v; if (v) Sfx.hint(); });

    $("btn-profile").onclick = () => {
      if (Quiz.active) Quiz.pause();
      Profiles.logout(); this.showProfiles();
    };
  },

  syncRiverSwitch(on) {
    const p = Store.prefs(); p.rivers = !!on; Store.savePrefs(p);
    $("sw-rivers").setAttribute("aria-pressed", !!on);
  },

  /* ================= ÇALIŞMA ALANI ================= */
  bindWorkspace() {
    document.querySelectorAll(".ws").forEach(b => b.onclick = () => this.setWorkspace(b.dataset.ws));
    document.querySelectorAll(".bt").forEach(b => b.onclick = () => {
      document.querySelectorAll(".bt").forEach(x => x.classList.toggle("is-on", x === b));
      $("bt-form").hidden = b.dataset.bt !== "form";
      $("bt-text").hidden = b.dataset.bt !== "text";
    });
  },

  setWorkspace(w) {
    this.ws = w;
    document.querySelectorAll(".ws").forEach(b => b.classList.toggle("is-on", b.dataset.ws === w));
    $("ws-solve").hidden = w !== "solve";
    $("ws-build").hidden = w !== "build";
    document.body.classList.toggle("build-mode", w === "build");

    if (w === "build") {
      if (Quiz.active) Quiz.pause();
      this.pickMode = true;
      Map81.clear(); Map81.clearRivers(); Map81.clearPopups();
      if (this.seciliKonu) $("cp-topic").value = this.seciliKonu;
      this.renderPicks(); this.renderQList();
    } else {
      this.pickMode = false;
      this.clearPicks();
    }
  },

  bindModes() {
    document.querySelectorAll(".mode[data-mode]").forEach(b => {
      b.onclick = () => {
        Quiz.mode = b.dataset.mode;
        this.setModeButtons(b.dataset.mode);
        if (Quiz.topicId) Quiz.startTopic(Quiz.topicId); else Quiz.stop();
      };
    });
    $("btn-exam").onclick = () => { this.setWorkspace("solve"); Quiz.startExam(); };
  },

  setModeButtons(m) {
    document.querySelectorAll(".mode[data-mode]").forEach(b =>
      b.classList.toggle("is-on", b.dataset.mode === m && m !== "exam"));
  },

  bindMisc() {
    $("btn-analysis").onclick     = () => Stats.toggleHeat();
    $("btn-skip").onclick   = () => Quiz.skip();
    $("btn-reveal").onclick = () => Quiz.reveal();
    $("btn-next").onclick   = () => Quiz.next();
    $("btn-pause").onclick  = () => Quiz.pause();
    $("btn-stop").onclick   = () => {
      if (confirm("Test bitirilsin mi? Kaydedilmemiş ilerleme silinir.")) Quiz.stop();
    };
    $("btn-resume").onclick  = () => { this.setWorkspace("solve"); Quiz.resume(); };
    $("btn-discard").onclick = () => { Store.clearSession(); this.hideResume(); };
    $("modal-x").onclick     = () => this.modalClose();
    $("modal-back").onclick  = e => { if (e.target === $("modal-back")) this.modalClose(); };

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") this.modalClose();
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if ((e.key === "Enter" || e.key === " ") &&
          (Quiz.waiting || (Quiz.active && Quiz.mode === "atlas"))) {
        e.preventDefault(); Quiz.next();
      }
    });
    window.addEventListener("beforeunload", () => { if (Quiz.active) Quiz.pause(); });
  },

  /* ================= GERİ SAYIM / SKOR ================= */
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
    upd(); clearInterval(this._cdT); this._cdT = setInterval(upd, 30000);
  },

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
    $("resume-text").textContent =
      `Yarım kalmış test: ${s.session.label} — ${s.idx + 1}. soruda kaldın, ${s.queue.length - s.idx} soru duruyor.`;
    $("resume-bar").hidden = false;
  },
  hideResume() { $("resume-bar").hidden = true; },

  /* ================= SORU GÖSTERİMİ ================= */
  renderQuestion(q) {
    $("q-options").hidden = true; $("q-options").innerHTML = "";
    if (!q) {
      $("q-topic").textContent = "—";
      $("q-text").textContent = "Aşağıdaki konulardan birine çift tıkla.";
      $("q-found").innerHTML = ""; this.setTimer(null);
      return;
    }
    $("q-topic").textContent = q.topicTitle || "";
    $("q-text").textContent  = q.q;
    this.renderFound(q, new Set(), false, new Set());
  },

  renderFound(q, found, hepsiniGoster, foundR) {
    found = found || new Set(); foundR = foundR || Quiz.foundR || new Set();
    const notes = q.notes || {};
    const il = new Set((q.a || []).map(cityKey)).size;
    const ak = new Set((q.ar || []).map(normTr)).size;

    let html = `<span class="chip">${found.size + foundR.size} / ${il + ak} bulundu</span>`;
    html += Array.from(found).map(k => {
      const n = notes[k];
      return `<span class="chip found">${esc(titleCaseTr(k))}${n ? " · " + esc(n) : ""}</span>`;
    }).join("");
    html += Array.from(foundR).map(k => `<span class="chip found riv">${esc(titleCaseTr(k))}</span>`).join("");

    if (hepsiniGoster) {
      (q.a || []).filter(c => !found.has(cityKey(c))).forEach(c => {
        const n = notes[cityKey(c)];
        html += `<span class="chip miss">${esc(c)}${n ? " · " + esc(n) : ""}</span>`;
      });
      (q.ar || []).filter(c => !foundR.has(normTr(c)))
        .forEach(c => html += `<span class="chip miss riv">${esc(c)}</span>`);
    }
    $("q-found").innerHTML = html;
  },

  renderReverse(q, options, onPick) {
    $("q-topic").textContent = q.topicTitle || "";
    $("q-text").textContent  = "Haritada yeşil yanan yerler hangi sorunun cevabı?";
    $("q-found").innerHTML   = `<span class="chip found">${esc((q.a || []).concat(q.ar || []).join(", "))}</span>`;
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
    $("q-text").textContent  = q.q.replace(/\?$/, "") + " → " + (q.a || []).concat(q.ar || []).join(", ");
    this.renderFound(q, new Set(), true, new Set());
    $("q-options").hidden = true;
  },

  /* ================= KONU LİSTESİ ================= */
  bindTopics() {
    $("btn-export-all").onclick = () =>
      saveBlob(new Blob([JSON.stringify(Store.topics, null, 2)], { type: "application/json" }),
               "cografya-konular.json");

    $("import-file").onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const icerik = r.result.trim();
        try {
          if (icerik.startsWith("[") || icerik.startsWith("{")) {
            let j = JSON.parse(icerik);
            if (!Array.isArray(j)) j = [j];
            j.forEach(t => Store.addTopic(t.title, t.desc, (t.qa || []).map(q => {
              const a = Array.isArray(q.a) ? q.a
                      : String(q.a || "").split(/[,;/]/).map(s => s.trim()).filter(Boolean);
              return { id: uid(), q: q.q, a, ar: q.ar || [],
                       notes: q.notes || notlariAyristir(q.note, a), media: null };
            })));
            this.flash(j.length + " konu içe aktarıldı.");
          } else {
            $("tx-input").value = icerik;
            this.setWorkspace("build");
            document.querySelector('[data-bt="text"]').click();
            this.parseText(false);
            this.flash("Metin yüklendi — denetle, sonra İçe aktar de.");
          }
          this.renderTopics(); this.fillTopicSelect(); this.renderQList();
        } catch (err) { alert("Dosya okunamadı: " + err.message); }
        e.target.value = "";
      };
      r.readAsText(f, "utf-8");
    };
  },

  renderTopics() {
    const box = $("topic-list"); box.innerHTML = "";
    if (!Store.topics.length) {
      box.innerHTML = `<p class="hint">Henüz konu yok. “Soru oluştur” sekmesinden ekleyebilirsin.</p>`;
      return;
    }
    Store.topics.forEach(t => {
      const el = document.createElement("div");
      el.className = "topic-row" + (Quiz.topicId === t.id ? " is-active" : "")
                                 + (this.seciliKonu === t.id ? " is-sel" : "");
      el.innerHTML = `
        <span class="t-title">${esc(t.title)}</span>
        <span class="t-count">${t.qa.length}</span>
        <button class="ico" data-a="export" title="Dışa aktar">⤓</button>
        <button class="ico danger" data-a="del" title="Sil">🗑</button>`;

      el.onclick = e => {
        if (e.target.closest("button")) return;
        this.seciliKonu = t.id;
        $("cp-topic").value = t.id;
        this.renderTopics();
      };
      el.ondblclick = e => {
        if (e.target.closest("button")) return;
        this.seciliKonu = t.id;
        Quiz.startTopic(t.id);
        this.renderTopics();
      };

      el.querySelector('[data-a="export"]').onclick = () => {
        if (!confirm(`“${t.title}” konusu JSON olarak indirilecek. Devam edilsin mi?`)) return;
        saveBlob(new Blob([JSON.stringify([t], null, 2)], { type: "application/json" }),
                 slug(t.title) + ".json");
      };
      el.querySelector('[data-a="del"]').onclick = () => {
        if (!confirm(`“${t.title}” konusu ve ${t.qa.length} sorusu silinecek.\n\nEmin misin?`)) return;
        Store.removeTopic(t.id);
        if (Quiz.topicId === t.id) Quiz.stop();
        if (this.seciliKonu === t.id) this.seciliKonu = null;
        this.renderTopics(); this.fillTopicSelect(); this.renderQList();
      };
      box.appendChild(el);
    });
  },

  fillTopicSelect() {
    const s = $("cp-topic"); const cur = s.value;
    s.innerHTML = Store.topics.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join("");
    if (cur && Store.topic(cur)) s.value = cur;
    else if (this.seciliKonu && Store.topic(this.seciliKonu)) s.value = this.seciliKonu;
  },

  /* ================= SORU OLUŞTUR ================= */
  bindBuilder() {
    $("btn-new-topic").onclick = () => {
      const ad = prompt("Konu adı:"); if (!ad) return;
      const t = Store.addTopic(ad, prompt("Kısa açıklama:") || "", []);
      this.seciliKonu = t.id;
      this.renderTopics(); this.fillTopicSelect();
      $("cp-topic").value = t.id; this.renderQList();
    };
    $("cp-topic").onchange = () => { this.seciliKonu = $("cp-topic").value; this.renderQList(); this.renderTopics(); };
    $("cp-cancel").onclick = () => this.resetForm();
    $("cp-add").onclick    = () => this.submitQuestion();
  },

  submitQuestion() {
    const topicId = $("cp-topic").value;
    const metin = $("cp-question").value.trim();
    if (!topicId) return alert("Önce bir konu oluştur.");
    if (!metin)   return alert("Soru metni boş.");
    if (!this.picks.length && !this.pickR.length) return alert("En az bir cevap seç.");

    const notes = {};
    this.picks.forEach(p => { if (p.note) notes[p.key] = p.note; });

    const veri = { q: metin, a: this.picks.map(p => p.name), ar: this.pickR.map(p => p.name), notes };

    if (this.editing) { Store.updateQuestion(topicId, this.editing, veri); this.flash("Soru güncellendi."); }
    else              { Store.addQuestion(topicId, veri);                  this.flash("Soru eklendi."); }

    this.resetForm(); this.renderQList(); this.renderTopics();
  },

  resetForm() {
    this.editing = null;
    $("cp-question").value = "";
    $("cp-add").textContent = "Ekle";
    $("cp-cancel").hidden = true;
    this.clearPicks();
  },

  editQuestion(qid) {
    const t = Store.topic($("cp-topic").value); if (!t) return;
    const q = t.qa.find(x => x.id === qid); if (!q) return;
    this.editing = qid;
    $("cp-question").value = q.q;
    $("cp-add").textContent = "Güncelle";
    $("cp-cancel").hidden = false;
    this.clearPicks();
    (q.a  || []).forEach(c => {
      this.pickCity(cityKey(c), c);
      const p = this.picks.find(x => x.key === cityKey(c));
      if (p && q.notes) p.note = q.notes[cityKey(c)] || "";
    });
    (q.ar || []).forEach(r => this.pickRiver(normTr(r), r));
    this.renderPicks();
    $("cp-question").scrollIntoView({ behavior: "smooth", block: "center" });
  },

  renderQList() {
    const t = Store.topic($("cp-topic").value);
    const box = $("qlist");
    if (!t) { box.innerHTML = ""; $("qlist-count").textContent = ""; return; }
    $("qlist-title").textContent = t.title;
    $("qlist-count").textContent = t.qa.length + " soru";
    if (!t.qa.length) { box.innerHTML = `<p class="hint">Bu konuda henüz soru yok.</p>`; return; }

    box.innerHTML = "";
    t.qa.forEach(q => {
      const el = document.createElement("div");
      el.className = "qrow" + (this.editing === q.id ? " is-editing" : "");
      const cevap = (q.a || []).map(c => {
        const n = (q.notes || {})[cityKey(c)];
        return c + (n ? " (" + n + ")" : "");
      }).concat((q.ar || []).map(r => "~" + r)).join(", ");
      el.innerHTML = `
        <div class="qrow-main">
          <span class="qrow-q">${esc(q.q)}</span>
          <span class="qrow-a">${esc(cevap)}</span>
        </div>
        <button class="ico" data-a="edit" title="Düzenle">✎</button>
        <button class="ico danger" data-a="del" title="Sil">🗑</button>`;
      el.querySelector('[data-a="edit"]').onclick = () => this.editQuestion(q.id);
      el.querySelector('[data-a="del"]').onclick = () => {
        if (!confirm("Bu soru silinsin mi?\n\n" + q.q)) return;
        Store.removeQuestion(t.id, q.id);
        if (this.editing === q.id) this.resetForm();
        this.renderQList(); this.renderTopics();
      };
      box.appendChild(el);
    });
  },

  /* ---- haritadan seçim ---- */
  pickCity(key, name) {
    const i = this.picks.findIndex(p => p.key === key);
    if (i >= 0) { this.picks.splice(i, 1); Map81.set(key, "is-picked", false); }
    else        { this.picks.push({ key, name, note: "" }); Map81.set(key, "is-picked", true); }
    this.renderPicks();
  },

  pickRiver(key, name) {
    const i = this.pickR.findIndex(p => p.key === key);
    if (i >= 0) { this.pickR.splice(i, 1); Map81.setRiver(key, "is-picked", false); }
    else        { this.pickR.push({ key, name }); Map81.setRiver(key, "is-picked", true); }
    this.renderPicks();
  },

  clearPicks() {
    this.picks.forEach(p => Map81.set(p.key, "is-picked", false));
    this.pickR.forEach(p => Map81.setRiver(p.key, "is-picked", false));
    this.picks = []; this.pickR = []; this.renderPicks();
  },

  renderPicks() {
    const box = $("cp-picks");
    if (!this.picks.length && !this.pickR.length) {
      box.innerHTML = `<span class="hint">— henüz seçim yok —</span>`; return;
    }
    box.innerHTML = "";

    this.picks.forEach(p => {
      const el = document.createElement("span");
      el.className = "chip found pickchip";
      el.innerHTML = `<span class="pc-name">${esc(p.name)}</span>` +
        (p.note ? `<span class="pc-note">${esc(p.note)}</span>` : "") +
        `<button class="pc-add" title="İlçe / not">${p.note ? "✎" : "+"}</button>` +
        `<button class="pc-x" title="Kaldır">×</button>`;
      el.querySelector(".pc-add").onclick = () => {
        const v = prompt(`${p.name} için ilçe veya not:`, p.note || "");
        if (v === null) return;
        p.note = v.trim(); this.renderPicks();
      };
      el.querySelector(".pc-x").onclick = () => this.pickCity(p.key, p.name);
      box.appendChild(el);
    });

    this.pickR.forEach(p => {
      const el = document.createElement("span");
      el.className = "chip found riv pickchip";
      el.innerHTML = `<span class="pc-name">~${esc(p.name)}</span><button class="pc-x">×</button>`;
      el.querySelector(".pc-x").onclick = () => this.pickRiver(p.key, p.name);
      box.appendChild(el);
    });
  },

  /* ================= METİNDEN TOPLU ================= */
  bindTextImport() {
    $("tx-help").onclick  = () => this.modal(TEXT_FORMAT_HELP);
    $("tx-check").onclick = () => this.parseText(false);
    $("tx-add").onclick   = () => this.parseText(true);
  },

  parseText(uygula) {
    const sonuc = parseSoruMetni($("tx-input").value);
    const rap = $("tx-report");
    rap.innerHTML = sonuc.hatalar.length
      ? `<b class="bad">${sonuc.hatalar.length} satır anlaşılmadı:</b><br>` +
        sonuc.hatalar.map(h => `${h.satir}. satır — ${esc(h.sebep)}<br><i>${esc(h.metin)}</i>`).join("<br>")
      : "";

    if (!sonuc.konular.length) { rap.innerHTML += `<br><b class="bad">Eklenecek soru bulunamadı.</b>`; return; }

    const ozet = sonuc.konular.map(k => `${k.title}: ${k.qa.length} soru`).join(" · ");
    if (!uygula) { rap.innerHTML += `<br><b class="ok">Denetim tamam →</b> ${esc(ozet)}`; return; }

    sonuc.konular.forEach(k => {
      const mevcut = Store.topics.find(t => normTr(t.title) === normTr(k.title));
      if (mevcut) k.qa.forEach(q => Store.addQuestion(mevcut.id, q));
      else Store.addTopic(k.title, k.desc, k.qa.map(q => ({ ...q, id: uid() })));
    });
    Store.save();
    $("tx-input").value = "";
    rap.innerHTML = `<b class="ok">Eklendi →</b> ${esc(ozet)}`;
    this.renderTopics(); this.fillTopicSelect(); this.renderQList();
    this.flash("İçe aktarma tamam.");
  },

  /* ================= MODAL & BİLDİRİM ================= */
  modal(html) { $("modal-body").innerHTML = html; $("modal-back").hidden = false; },
  modalClose() { $("modal-back").hidden = true; $("modal-body").innerHTML = ""; },
  legend(html) { $("legend").innerHTML = html; },

  flash(msg) {
    let el = document.querySelector(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add("on"));
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove("on"), 2200);
  }
};

/* =========================================================
   Metin ayrıştırıcı
   # Konu | açıklama
   soru? = il1, il2, ~Akarsu | Sivas–Divriği, Malatya–Hekimhan
   ========================================================= */
function parseSoruMetni(ham) {
  const konular = [], hatalar = [];
  let aktif = null;

  (ham || "").split(/\r?\n/).forEach((satir, i) => {
    const t = satir.trim();
    if (!t) return;

    if (t.startsWith("#")) {
      const [ad, aciklama] = t.slice(1).split("|").map(x => (x || "").trim());
      if (!ad) return hatalar.push({ satir: i + 1, metin: t, sebep: "konu adı boş" });
      aktif = { title: ad, desc: aciklama || "", qa: [] };
      konular.push(aktif);
      return;
    }

    if (t.indexOf("=") === -1)
      return hatalar.push({ satir: i + 1, metin: t, sebep: "“=” işareti yok" });

    if (!aktif) { aktif = { title: "İçe aktarılan", desc: "", qa: [] }; konular.push(aktif); }

    const kesim = t.indexOf("=");
    const soru = t.slice(0, kesim).trim();
    let kalan = t.slice(kesim + 1).trim().replace(/\*+$/, "").trim();   // eski * işaretini yut

    const parca = kalan.split("|");
    const cevaplar = parca[0].split(",").map(x => x.trim()).filter(Boolean);
    const notMetni = (parca[1] || "").trim();

    if (!soru)            return hatalar.push({ satir: i + 1, metin: t, sebep: "soru metni boş" });
    if (!cevaplar.length) return hatalar.push({ satir: i + 1, metin: t, sebep: "cevap yok" });

    const iller = [], akarsular = [];
    cevaplar.forEach(c => c.startsWith("~") ? akarsular.push(c.slice(1).trim()) : iller.push(c));

    aktif.qa.push({ q: soru, a: iller, ar: akarsular, notes: notlariAyristir(notMetni, iller) });
  });

  return { konular: konular.filter(k => k.qa.length), hatalar };
}

const TEXT_FORMAT_HELP = `
<h2 style="margin-bottom:8px">Metin biçimi</h2>
<pre class="fmt"># Barajlar | Baraj – il eşleştirmesi
Atatürk Barajı hangi illerimizdedir? = Şanlıurfa, Adıyaman | Şanlıurfa–Bozova, Adıyaman–Kâhta
Keban Barajı hangi ilimizdedir? = Elazığ, ~Fırat | Elazığ–Keban
Hirfanlı Barajı hangi ilimizdedir? = Kırşehir</pre>
<ul style="font-size:.88rem;line-height:1.6">
  <li><b>#</b> ile başlayan satır konu başlığıdır. <b>|</b> sonrası açıklama, isteğe bağlı.</li>
  <li><b>=</b> işaretinden önce soru, sonra virgülle ayrılmış cevaplar.</li>
  <li><b>~</b> ile başlayan cevap akarsudur (<code>~Fırat</code>). Diğerleri il sayılır.</li>
  <li>İkinci <b>|</b> sonrası ilçe notlarıdır. Biçim: <code>İl–ilçe</code>, virgülle ayrılır.
      Böylece her ilin notu sadece o il bulunduğunda çıkar.</li>
  <li>Tek bir il varsa <code>| Divriği</code> yazman da yeter, o ile bağlanır.</li>
  <li>Aynı adda konu varsa sorular onun üstüne eklenir, yeni kart açılmaz.</li>
</ul>`;

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
