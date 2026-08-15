/* =========================================================
   data.js — tek veri kapısı.
   Kural: uygulamanın hiçbir yeri localStorage'a doğrudan dokunmaz,
   hep Store üzerinden geçer. Böylece CFG.USE_API=true yapıldığında
   sadece bu dosya değişir, geri kalan kod aynen çalışır.
   ========================================================= */

/* ---- Gömülü başlangıç verisi (offline ilk açılış) ---- */
window.SEED_TOPICS = [
  {
    id: "t1", title: "Madenler", desc: "Hangi maden nerede çıkarılır?",
    qa: [
      { id:"t1q1", q:"Demir madeni hangi illerimizde çıkarılır?",  a:["Sivas","Malatya","Kayseri","Adana"], note:"Sivas–Divriği, Malatya–Hekimhan", isImportant:true },
      { id:"t1q2", q:"Krom madeni hangi illerimizde çıkarılır?",   a:["Elazığ","Muğla","Bursa","Denizli"] },
      { id:"t1q3", q:"Bor madeni hangi illerimizde çıkarılır?",    a:["Eskişehir","Balıkesir","Kütahya","Bursa"], isImportant:true },
      { id:"t1q4", q:"Taş kömürü hangi ilimizde çıkarılır?",       a:["Zonguldak","Bartın","Karabük"], note:"Zonguldak–Kozlu, Kilimli, Üzülmez" },
      { id:"t1q5", q:"Bakır madeni hangi illerimizde çıkarılır?",  a:["Artvin","Kastamonu","Elazığ","Rize"] }
    ]
  },
  {
    id: "t2", title: "Ovalar", desc: "Önemli ovalar hangi ilde?",
    qa: [
      { id:"t2q1", q:"Çukurova hangi illerimizde yer alır?",       a:["Adana","Mersin","Osmaniye"], isImportant:true },
      { id:"t2q2", q:"Konya Ovası hangi ilimizdedir?",             a:["Konya"] },
      { id:"t2q3", q:"Bafra ve Çarşamba ovaları hangi ilimizdedir?", a:["Samsun"], isImportant:true }
    ]
  },
  {
    id: "t3", title: "Barajlar", desc: "Baraj – il eşleştirmesi",
    qa: [
      { id:"t3q1", q:"Atatürk Barajı hangi illerimiz sınırındadır?", a:["Şanlıurfa","Adıyaman"], isImportant:true },
      { id:"t3q2", q:"Keban Barajı hangi ilimizdedir?",              a:["Elazığ"] },
      { id:"t3q3", q:"Ilısu Barajı hangi ilimizdedir?",              a:["Mardin","Şırnak"] }
    ]
  }
];

/* ---- Küçük yardımcılar ---- */
const _ls = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch(e){ return def; } },
  set(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ console.warn("LS dolu:", e); } }
};
const uid = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

/* =========================================================
   C# LOCAL API ŞABLONLARI
   CFG.USE_API=true ise Store bunları kullanır.
   Sunucu tarafı: csharp/LocalApiServer.cs
   ========================================================= */
window.Api = {
  async getTopics() {
    const r = await fetch(`${CFG.API_BASE}/api/topics`, { headers:{ "Accept":"application/json" } });
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  },
  async putTopics(topics) {
    const r = await fetch(`${CFG.API_BASE}/api/topics`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(topics)
    });
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  },
  async postQuestion(topicId, question) {
    const r = await fetch(`${CFG.API_BASE}/api/topics/${encodeURIComponent(topicId)}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(question)
    });
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  },
  async postStats(payload) {          // deneme sonucu / SRS senkronu
    const r = await fetch(`${CFG.API_BASE}/api/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return r.ok ? r.json() : null;
  },
  async ping() {
    try { const r = await fetch(`${CFG.API_BASE}/api/ping`, { cache:"no-store" }); return r.ok; }
    catch(e){ return false; }
  }
};

/* =========================================================
   Store — konular + istatistik + SRS
   ========================================================= */
window.Store = {
  topics: [],

  async load() {
    if (CFG.USE_API && await Api.ping()) {
      try { this.topics = await Api.getTopics(); this._normalize(); return "api"; }
      catch (e) { console.warn("API okunamadı, localStorage'a düşülüyor", e); }
    }
    this.topics = _ls.get(CFG.LS.topics, null) || JSON.parse(JSON.stringify(SEED_TOPICS));
    this._normalize();
    return "local";
  },

  save() {
    _ls.set(CFG.LS.topics, this.topics);
    if (CFG.USE_API) Api.putTopics(this.topics).catch(e => console.warn("API yazılamadı", e));
  },

  /* Eski format toleransı: a:"Sivas" → a:["Sivas"], eksik id üret */
  _normalize() {
    this.topics.forEach(t => {
      t.id = t.id || uid();
      t.qa = (t.qa || []).map(q => ({
        id: q.id || uid(),
        q: q.q,
        a: Array.isArray(q.a) ? q.a : String(q.a || "").split(/[,;/]/).map(s => s.trim()).filter(Boolean),
        note: q.note || "",               // ilçe / ek bilgi — örn. "Divriği"
        isImportant: !!q.isImportant,
        media: q.media || null            // { type:"image"|"video", src:"images/..." }
      }));
    });
  },

  topic(id)   { return this.topics.find(t => t.id === id); },
  allQuestions() {
    const out = [];
    this.topics.forEach(t => t.qa.forEach(q => out.push({ ...q, topicId: t.id, topicTitle: t.title })));
    return out;
  },

  addTopic(title, desc, qa) {
    const t = { id: uid(), title: title || "Yeni konu", desc: desc || "", qa: qa || [] };
    this.topics.push(t); this.save(); return t;
  },
  removeTopic(id) { this.topics = this.topics.filter(t => t.id !== id); this.save(); },

  addQuestion(topicId, q) {
    const t = this.topic(topicId); if (!t) return null;
    const item = { id: uid(), q: q.q, a: q.a, note: q.note || "",
                   isImportant: !!q.isImportant, media: null };
    t.qa.push(item);
    this.save();
    if (CFG.USE_API) Api.postQuestion(topicId, item).catch(()=>{});
    return item;
  },

  /* ---- SRS (Anki benzeri) ---- */
  srs()          { return _ls.get(CFG.LS.srs, {}); },
  srsSave(o)     { _ls.set(CFG.LS.srs, o); },

  /* ---- yanlış tıklanan il sayacı (ısı haritası için) ---- */
  wrongMap()     { return _ls.get(CFG.LS.wrong, {}); },
  bumpWrongCity(city) {
    const m = this.wrongMap(); const k = cityKey(city);
    m[k] = (m[k] || 0) + 1; _ls.set(CFG.LS.wrong, m);
  },

  /* ---- deneme çözülen günler ---- */
  examDays()     { return _ls.get(CFG.LS.days, {}); },
  markExamDay(score) {
    const d = new Date(), key = d.toISOString().slice(0,10);
    const m = this.examDays();
    m[key] = (m[key] || 0) + 1;
    _ls.set(CFG.LS.days, m);
    if (CFG.USE_API) Api.postStats({ date:key, score }).catch(()=>{});
  },

  prefs()        { return _ls.get(CFG.LS.prefs, { dark:true, blind:false, regions:false, sound:true, zoom:false }); },
  savePrefs(p)   { _ls.set(CFG.LS.prefs, p); },

  /* ---- yarım kalan test ---- */
  session()      { return _ls.get(CFG.LS.session, null); },
  saveSession(s) { _ls.set(CFG.LS.session, s); },
  clearSession() { localStorage.removeItem(CFG.LS.session); },

  wipe() { Object.values(CFG.LS).forEach(k => localStorage.removeItem(k)); }
};
window.uid = uid;
