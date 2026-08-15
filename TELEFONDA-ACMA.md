# Telefonda açmak — yayınlama rehberi

## Hangisi: GitHub Pages mi, Firebase mi?

| | GitHub Pages | Firebase Hosting | Cloudflare Pages |
|---|---|---|---|
| Ücret | Ücretsiz | Ücretsiz katman var | Ücretsiz |
| Kredi kartı | İstemez | İster (Blaze'e geçersen) | İstemez |
| Özel (private) depo | Ücretli planda | — | Ücretsizde destekler |
| Kurulum süresi | ~5 dakika | ~15 dakika (CLI + Node) | ~8 dakika |
| Cihazlar arası veri senkronu | Yok | Firestore eklersen var | Yok |

**Senin durumun için GitHub Pages.** Uygulama tamamen statik — sunucu tarafında hesaplanan hiçbir şey yok. Firebase Hosting de aynı işi yapar ama Node.js kurulumu, CLI girişi ve proje oluşturma adımları var; karşılığında hiçbir ek fayda almıyorsun.

Firebase ancak şunu istersen anlamlı olur: *bilgisayarda çözdüğüm denemeler telefonda da görünsün.* O zaman Hosting yetmez, Firestore + Authentication da gerekir. Şimdilik dışa/içe aktarma butonlarıyla JSON taşımak yeterli.

Soru bankanın herkese açık olmasını istemiyorsan **Cloudflare Pages** kullan — ücretsiz planda özel depoyu da yayınlıyor.

---

## GitHub Pages — adım adım

### 1. Hesap ve depo

github.com'da hesabın yoksa aç. Sağ üstteki **+** ➜ **New repository**.

- Repository name: `cografya-sahasi`
- **Public** seç (ücretsiz planda Pages sadece public depolarda çalışır)
- "Add a README file" kutusunu **işaretle**
- **Create repository**

### 2. Dosyaları yükle

Depo sayfasında **Add file** ➜ **Upload files**.

Bilgisayarındaki `kpss-cografya` klasörünü aç, **içindeki her şeyi** (klasörler dahil) tarayıcı penceresine sürükle. GitHub klasör yapısını korur.

Yüklenecekler:

```
index.html   manifest.json   sw.js   veri-donustur.html
css\     js\     vendor\     icons\     data\     csharp\
```

`js\tr-cities-data.js` dosyasının listede olduğundan emin ol — harita verisi o.

Altta **Commit changes** butonuna bas. Dosya sayısı fazla olduğu için 1-2 dakika sürebilir.

### 3. Pages'i aç

Depo sayfasında **Settings** ➜ sol menüde **Pages**.

- Source: **Deploy from a branch**
- Branch: **main**, klasör: **/ (root)**
- **Save**

1-2 dakika sonra sayfayı yenile, üstte adresin çıkacak:

```
https://KULLANICIADIN.github.io/cografya-sahasi/
```

### 4. Telefonda aç

Bu adresi iPhone'da **Safari** ile aç. (Chrome ile de açılır ama ana ekrana ekleme Safari'de daha sağlıklı çalışır.)

Alttaki **paylaş** ikonuna bas ➜ **Ana Ekrana Ekle** ➜ **Ekle**.

Artık ana ekranda "Coğrafya 81" ikonu var. Ona dokunduğunda Safari arayüzü olmadan, tam ekran açılır ve **internet olmasa bile çalışır** — service worker tüm dosyaları telefona indirdi.

---

## iOS'ta bilmen gereken üç şey

### 1. Veri silinebilir — bu ciddi

Safari'nin ITP (Intelligent Tracking Prevention) mekanizması, **7 gün boyunca açılmayan** sitelerin `localStorage` verisini siler. Yani iki hafta ara verirsen çalışma zincirin, deneme geçmişin ve eklediğin sorular gidebilir.

İki korunma yolu var:

**Ana ekrana ekle.** Ana ekrandan açılan PWA'lar bu temizlikten muaf tutuluyor. Bu yüzden Adım 4 isteğe bağlı değil, zorunlu sayılmalı.

**Düzenli yedek al.** "Tümünü dışa aktar" butonuyla JSON'u indir, iCloud Drive veya Dosyalar'a kaydet. Ayda bir yeterli. Kaybedersen "İçe aktar (JSON)" ile geri yüklersin.

**Terim:** *ITP*, Apple'ın reklam takibini engellemek için geliştirdiği mekanizma. Yan etkisi olarak sık kullanılmayan sitelerin yerel verisini de temizliyor. Chrome ve Firefox'ta böyle bir kısıt yok, sadece Safari'ye özgü.

### 2. Titreşim çalışmaz

`navigator.vibrate` iOS Safari'de hiç desteklenmiyor, Apple bilinçli olarak eklemedi. Kod hata vermiyor, sessizce geçiyor. Ses çalışıyor, dokunsal geri bildirim çalışmıyor. Android'de ikisi de var.

### 3. Ses ilk dokunuşta açılır

Tarayıcılar kullanıcı etkileşimi olmadan ses çalmaya izin vermez. İlk ile dokunduğunda `AudioContext` uyanıyor. iOS'ta ayrıca **sessize alma anahtarı** açıksa ses gelmez — telefonun yan tarafındaki fiziksel anahtarı kontrol et.

---

## Dosya güncellediğinde

Değişen dosyaları GitHub'a tekrar yükledikten sonra **`sw.js` içindeki sürüm numarasını artır**:

```javascript
const CACHE = "cografya-sahasi-v2";   // v1 idi
```

Bunu yapmazsan telefon eski kopyayı önbellekten göstermeye devam eder ve neden değişmediğini anlayamazsın. Bu, service worker kullanan projelerde en sık yapılan hata.

---

## Bilgisayar ile telefon arasında veri taşıma

Şu an ayrı ayrı çalışıyorlar. Manuel aktarım:

1. Bilgisayarda **Tümünü dışa aktar** ➜ `cografya-konular.json` iner
2. Dosyayı telefona at (WhatsApp, e-posta, iCloud, fark etmez)
3. Telefonda **İçe aktar (JSON)** ➜ dosyayı seç

Dikkat: içe aktarma **üzerine yazmaz, yeni kart olarak ekler.** Aynı dosyayı iki kez alırsan konular ikişer görünür. Eski kartları elle silmen gerekir.

Otomatik senkron istersen o zaman Firebase Firestore konuşuruz — ama o, üzerine ayrıca kimlik doğrulama katmanı ekleyeceğimiz ayrı bir iş.
