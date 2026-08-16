/* =========================================================
   data.js — tek veri kapısı
   YENİ: profil sistemi. Her kullanıcının verisi ayrı anahtarda tutulur:
         cs.<profilId>.topics, cs.<profilId>.srs ...
   YENİ: notes — ilçe bilgisi il başına saklanır, soru başına değil.
   ========================================================= */

window.SEED_TOPICS = [
  {
    id: "t1", title: "Madenler", desc: "Hangi maden nerede çıkarılır?",
    qa: [
      { id:"t1q1", q:"Demir madeni hangi illerimizde çıkarılır?",  a:["Sivas","Malatya","Kayseri","Adana"],
        notes:{ "SİVAS":"Divriği", "MALATYA":"Hekimhan", "KAYSERİ":"Karamadazı" } },
      { id:"t1q2", q:"Krom madeni hangi illerimizde çıkarılır?",   a:["Elazığ","Muğla","Bursa","Denizli"],
        notes:{ "ELAZIĞ":"Guleman" } },
      { id:"t1q3", q:"Bor madeni hangi illerimizde çıkarılır?",    a:["Eskişehir","Balıkesir","Kütahya","Bursa"],
        notes:{ "ESKİŞEHİR":"Kırka", "BALIKESİR":"Bigadiç, Susurluk", "KÜTAHYA":"Emet" } },
      { id:"t1q4", q:"Taş kömürü hangi ilimizde çıkarılır?",       a:["Zonguldak","Bartın","Karabük"],
        notes:{ "ZONGULDAK":"Kozlu, Kilimli, Üzülmez" } },
      { id:"t1q5", q:"Bakır madeni hangi illerimizde çıkarılır?",  a:["Artvin","Kastamonu","Elazığ","Rize"],
        notes:{ "ARTVİN":"Murgul", "KASTAMONU":"Küre", "ELAZIĞ":"Maden" } }
    ]
  },
  {
    id: "t2", title: "Ovalar", desc: "Önemli ovalar hangi ilde?",
    qa: [
      { id:"t2q1", q:"Çukurova hangi illerimizde yer alır?", a:["Adana","Mersin","Osmaniye"] },
      { id:"t2q2", q:"Konya Ovası hangi ilimizdedir?",       a:["Konya"] },
      { id:"t2q3", q:"Bafra ve Çarşamba ovaları hangi ilimizdedir?", a:["Samsun"],
        notes:{ "SAMSUN":"Bafra (Kızılırmak), Çarşamba (Yeşilırmak)" } }
    ]
  },
  {
    id: "t3", title: "Barajlar", desc: "Baraj – il eşleştirmesi",
    qa: [
      { id:"t3q1", q:"Atatürk Barajı hangi illerimiz sınırındadır?", a:["Şanlıurfa","Adıyaman"],
        notes:{ "ŞANLIURFA":"Bozova", "ADIYAMAN":"Kâhta" } },
      { id:"t3q2", q:"Keban Barajı hangi ilimizdedir?", a:["Elazığ"], notes:{ "ELAZIĞ":"Keban" } },
      { id:"t3q3", q:"Ilısu Barajı hangi ilimizdedir?", a:["Mardin","Şırnak"], notes:{ "MARDİN":"Dargeçit" } }
    ]
  }
];

const _ls = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch(e){ return def; } },
  set(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ console.warn("LS dolu:", e); } }
};
const uid = () => "x" + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

/* =========================================================
   Profiller
   ========================================================= */
window.Profiles = {
  LIST: "cs.profiles",
  ACTIVE: "cs.activeProfile",

  all()      { return _ls.get(this.LIST, []); },
  activeId() { return localStorage.getItem(this.ACTIVE) || null; },
  active()   { const id = this.activeId(); return this.all().find(p => p.id === id) || null; },

  add(name, renk) {
    const list = this.all();
    const p = { id: uid(), name: (name || "Kullanıcı").trim().slice(0, 24),
                color: renk || this.renkSec(list.length), created: Date.now() };
    list.push(p); _ls.set(this.LIST, list);
    return p;
  },

  rename(id, name) {
    const list = this.all(); const p = list.find(x => x.id === id);
    if (p) { p.name = name.trim().slice(0, 24); _ls.set(this.LIST, list); }
  },

  setActive(id) { localStorage.setItem(this.ACTIVE, id); },
  logout()      { localStorage.removeItem(this.ACTIVE); },

  /* profilin tüm çalışma verisini siler, profili bırakır */
  clearData(id) {
    Object.keys(localStorage)
      .filter(k => k.indexOf("cs." + id + ".") === 0)
      .forEach(k => localStorage.removeItem(k));
  },

  /* profili tamamen siler */
  remove(id) {
    this.clearData(id);
    _ls.set(this.LIST, this.all().filter(p => p.id !== id));
    if (this.activeId() === id) this.logout();
  },

  renkSec(i) {
    const p = ["#2B6C8F","#2E7D5B","#B4453C","#7A5AA6","#C08A2E","#3F8F86","#8F5A3F","#4A6FA5"];
    return p[i % p.length];
  },

  bas(ad) {                       // baş harf(ler)
    const par = (ad || "?").trim().split(/\s+/);
    return (par.length > 1 ? par[0][0] + par[1][0] : par[0].slice(0, 2)).toLocaleUpperCase("tr-TR");
  }
};

/* =========================================================
   C# LOCAL API ŞABLONLARI
   ========================================================= */
window.Api = {
  async getTopics() {
    const r = await fetch(`${CFG.API_BASE}/api/topics`, { headers:{ "Accept":"application/json" } });
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  },
  async putTopics(topics) {
    const r = await fetch(`${CFG.API_BASE}/api/topics`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(topics)
    });
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  },
  async postQuestion(topicId, question) {
    const r = await fetch(`${CFG.API_BASE}/api/topics/${encodeURIComponent(topicId)}/questions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(question)
    });
    if (!r.ok) throw new Error("API " + r.status);
    return r.json();
  },
  async postStats(payload) {
    const r = await fetch(`${CFG.API_BASE}/api/stats`, {
      method: "POST", headers: { "Content-Type": "application/json" },
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
   Store — konular + istatistik + SRS (aktif profile bağlı)
   ========================================================= */
window.Store = {
  topics: [],

  _k(ad) { return "cs." + (Profiles.activeId() || "yok") + "." + ad; },

  async load() {
    if (CFG.USE_API && await Api.ping()) {
      try { this.topics = await Api.getTopics(); this._normalize(); return "api"; }
      catch (e) { console.warn("API okunamadı, localStorage'a düşülüyor", e); }
    }
    this.topics = _ls.get(this._k("topics"), null) || JSON.parse(JSON.stringify(SEED_TOPICS));
    this._normalize();
    return "local";
  },

  save() {
    _ls.set(this._k("topics"), this.topics);
    if (CFG.USE_API) Api.putTopics(this.topics).catch(e => console.warn("API yazılamadı", e));
  },

  /* Eski formatları sessizce yeni şemaya çevirir */
  _normalize() {
    this.topics.forEach(t => {
      t.id = t.id || uid();
      t.qa = (t.qa || []).map(q => {
        const a = Array.isArray(q.a) ? q.a
                : String(q.a || "").split(/[,;/]/).map(s => s.trim()).filter(Boolean);
        let notes = q.notes && typeof q.notes === "object" ? q.notes : {};
        // eski tek satırlık note alanını il bazlı nota çevirmeye çalış
        if (q.note && !Object.keys(notes).length) notes = notlariAyristir(q.note, a);
        return {
          id: q.id || uid(),
          q: q.q,
          a,
          ar: Array.isArray(q.ar) ? q.ar : [],
          notes,                                   // { "SİVAS": "Divriği", ... }
          media: q.media || null
        };
      });
    });
  },

  topic(id) { return this.topics.find(t => t.id === id); },
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
  renameTopic(id, title, desc) {
    const t = this.topic(id); if (!t) return;
    t.title = title; if (desc != null) t.desc = desc;
    this.save();
  },

  addQuestion(topicId, q) {
    const t = this.topic(topicId); if (!t) return null;
    const item = { id: uid(), q: q.q, a: q.a || [], ar: q.ar || [],
                   notes: q.notes || {}, media: null };
    t.qa.push(item);
    this.save();
    if (CFG.USE_API) Api.postQuestion(topicId, item).catch(()=>{});
    return item;
  },

  updateQuestion(topicId, qid, patch) {
    const t = this.topic(topicId); if (!t) return null;
    const q = t.qa.find(x => x.id === qid); if (!q) return null;
    Object.assign(q, patch); this.save(); return q;
  },

  removeQuestion(topicId, qid) {
    const t = this.topic(topicId); if (!t) return;
    t.qa = t.qa.filter(x => x.id !== qid);
    this.save();
  },

  /* ---- SRS ---- */
  srs()      { return _ls.get(this._k("srs"), {}); },
  srsSave(o) { _ls.set(this._k("srs"), o); },

  /* ---- yanlış tıklanan il sayacı ---- */
  wrongMap() { return _ls.get(this._k("wrongMap"), {}); },
  bumpWrongCity(city) {
    const m = this.wrongMap(); const k = cityKey(city);
    m[k] = (m[k] || 0) + 1; _ls.set(this._k("wrongMap"), m);
  },

  /* ---- deneme çözülen günler ---- */
  examDays() { return _ls.get(this._k("examDays"), {}); },
  markExamDay(score) {
    const key = new Date().toISOString().slice(0,10);
    const m = this.examDays(); m[key] = (m[key] || 0) + 1;
    _ls.set(this._k("examDays"), m);
    if (CFG.USE_API) Api.postStats({ date:key, score }).catch(()=>{});
  },

  prefs()      { return _ls.get(this._k("prefs"), { blind:false, regions:false, sound:true, rivers:false }); },
  savePrefs(p) { _ls.set(this._k("prefs"), p); },

  /* ---- yarım kalan test ---- */
  session()      { return _ls.get(this._k("session"), null); },
  saveSession(s) { _ls.set(this._k("session"), s); },
  clearSession() { localStorage.removeItem(this._k("session")); },

  wipe() { Profiles.clearData(Profiles.activeId()); }
};

/* "Sivas–Divriği, Malatya–Hekimhan"  →  { SİVAS:"Divriği", MALATYA:"Hekimhan" }
   Eşleşme kurulamazsa ilk cevabın notu sayılır. */
function notlariAyristir(metin, iller) {
  const out = {};
  if (!metin) return out;
  const parcalar = metin.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  let eslesenVar = false;

  parcalar.forEach(p => {
    const m = p.split(/[–—-]/);
    if (m.length >= 2) {
      const il = cityKey(m[0]);
      if ((iller || []).map(cityKey).indexOf(il) > -1) {
        out[il] = (out[il] ? out[il] + ", " : "") + m.slice(1).join("-").trim();
        eslesenVar = true;
      }
    }
  });

  if (!eslesenVar && iller && iller.length) out[cityKey(iller[0])] = metin;
  return out;
}

window.uid = uid;
window.notlariAyristir = notlariAyristir;
