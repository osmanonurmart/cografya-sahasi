/* =========================================================
   config.js — sabitler, Türkçe normalizasyon, bölge tablosu
   ========================================================= */
window.CFG = {
  TARGET_DATE: "2026-10-11T10:00:00",   // hedef sınav: buradan değiştir
  SHOW_TIMER: true,                     // soru üstündeki saniye sayacı
  SHOW_COUNTDOWN: true,                 // üstteki "sınava X gün" bloğu
  SHOW_EXAM_TIME: true,                 // karnede süre satırları
  MAP: { W: 1200, H: 760 },
  EXAM_SIZE: 18,
  HINT_AFTER_WRONG: 3,                  // kaç yanlıştan sonra ipucu
  HINT_MS: 1500,
  WRONG_FLASH_MS: 420,
  NEXT_DELAY_MS: 620,                   // doğru bilindiğinde otomatik geçiş gecikmesi
  API_BASE: "http://localhost:5099",    // C# Local API; kapalıysa localStorage'a düşer
  USE_API: false,                       // true yaparsan tüm okuma/yazma API'ye gider
  LS: {                                 // localStorage anahtarları tek yerde
    topics:  "cs.topics",
    srs:     "cs.srs",
    wrong:   "cs.wrongMap",
    days:    "cs.examDays",
    prefs:   "cs.prefs",
    session: "cs.session"               // yarım kalan test
  }
};

/* --- Türkçe güvenli normalizasyon ---------------------------------
   JS'te "İSTANBUL".toLowerCase() → "i̇stanbul" (araya U+0307 girer).
   Bu yüzden karşılaştırmayı locale'li uppercase + alias ile yapıyoruz. */
window.normTr = function (s) {
  if (!s) return "";
  return String(s).trim().toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ")
    .replace(/[’'`]/g, "");
};

/* GeoJSON'daki yazımla soru bankasındaki yazım tutmazsa buraya ekle */
window.CITY_ALIAS = {
  "AFYON": "AFYONKARAHISAR",
  "AFYONKARAHISAR": "AFYONKARAHISAR",
  "İÇEL": "MERSIN",
  "ICEL": "MERSIN",
  "MERSIN": "MERSIN",
  "K.MARAS": "KAHRAMANMARAŞ",
  "KMARAŞ": "KAHRAMANMARAŞ",
  "MARAŞ": "KAHRAMANMARAŞ",
  "URFA": "ŞANLIURFA",
  "ANTEP": "GAZIANTEP",
  "HAKKARI": "HAKKÂRİ",
  "HAKKÂRI": "HAKKÂRİ"
};

window.cityKey = function (name) {
  const n = normTr(name);
  return CITY_ALIAS[n] || n;
};

/* --- 7 bölge / 21 bölüm tablosu ------------------------------------
   NOT: Bazı iller kaynaklara göre farklı bölümde gösterilebilir
   (özellikle Bilecik, Çankırı, Kayseri, Ağrı, Aksaray). KPSS kaynağını
   esas alıp burayı düzeltmen yeterli — kod tabloyu okur. */
window.REGIONS = {
  "Marmara": {
    "Yıldız (Istranca)":  ["Kırklareli"],
    "Ergene":             ["Edirne","Tekirdağ"],
    "Çatalca-Kocaeli":    ["İstanbul","Kocaeli","Sakarya"],
    "Güney Marmara":      ["Bursa","Balıkesir","Çanakkale","Yalova","Bilecik"]
  },
  "Ege": {
    "Asıl Ege (Kıyı)":    ["İzmir","Aydın","Manisa","Muğla","Denizli"],
    "İç Batı Anadolu":    ["Kütahya","Uşak","Afyonkarahisar"]
  },
  "Akdeniz": {
    "Antalya":            ["Antalya","Isparta","Burdur"],
    "Adana (Çukurova)":   ["Adana","Mersin","Osmaniye","Hatay","Kahramanmaraş"]
  },
  "Karadeniz": {
    "Batı Karadeniz":     ["Bolu","Düzce","Zonguldak","Bartın","Karabük","Kastamonu"],
    "Orta Karadeniz":     ["Sinop","Samsun","Çorum","Amasya","Tokat","Ordu"],
    "Doğu Karadeniz":     ["Giresun","Trabzon","Rize","Artvin","Gümüşhane","Bayburt"]
  },
  "İç Anadolu": {
    "Konya":              ["Konya","Karaman","Aksaray"],
    "Yukarı Sakarya":     ["Eskişehir","Ankara"],
    "Orta Kızılırmak":    ["Kırşehir","Nevşehir","Niğde","Kırıkkale","Çankırı"],
    "Yukarı Kızılırmak":  ["Sivas","Yozgat","Kayseri"]
  },
  "Doğu Anadolu": {
    "Yukarı Fırat":       ["Elazığ","Malatya","Tunceli","Erzincan","Bingöl"],
    "Erzurum-Kars":       ["Erzurum","Kars","Ardahan","Ağrı","Iğdır"],
    "Yukarı Murat-Van":   ["Van","Muş","Bitlis"],
    "Hakkâri":            ["Hakkâri"]
  },
  "Güneydoğu Anadolu": {
    "Orta Fırat":         ["Gaziantep","Adıyaman","Şanlıurfa","Kilis"],
    "Dicle":              ["Diyarbakır","Mardin","Batman","Siirt","Şırnak"]
  }
};

/* il → {bolge, bolum} ters indeksi (bir kez kurulur) */
window.CITY_REGION = (function () {
  const m = {};
  for (const bolge in REGIONS)
    for (const bolum in REGIONS[bolge])
      REGIONS[bolge][bolum].forEach(il => { m[cityKey(il)] = { bolge, bolum }; });
  return m;
})();
