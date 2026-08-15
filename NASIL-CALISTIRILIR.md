# NASIL ÇALIŞTIRILIR

Sunucu, Node, Python, kurulum yok. Sadece 3 dosya indireceksin, sonra `index.html`'e çift tıklayacaksın.

---

## Adım 1 — İki kütüphaneyi indir

Tarayıcıda şu iki adresi aç, **Ctrl+S** ile kaydet:

| Adres | Nereye kaydet |
|---|---|
| `https://d3js.org/d3.v5.min.js` | `vendor/d3.v5.min.js` |
| `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` | `vendor/html2canvas.min.js` |

Dosya adları **birebir** bu olmalı, yoksa `index.html` bulamaz.

> Not: Chrome bazen `.js` dosyasını `d3.v5.min.js.txt` diye kaydeder. Kaydettikten sonra adına bak, `.txt` varsa sil.

Windows'ta daha hızlısı — PowerShell'i proje klasöründe aç:

```powershell
iwr https://d3js.org/d3.v5.min.js -OutFile vendor\d3.v5.min.js
iwr https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js -OutFile vendor\html2canvas.min.js
```

---

## Adım 2 — Harita verisini JS'e çevir

Elindeki `tr-cities.json` dosyasına ihtiyacın var. Eski TurkeyVisited projendeki dosya birebir uygun.

1. `veri-donustur.html` dosyasına çift tıkla (bu tek başına çalışır, hiçbir şey gerekmez).
2. `tr-cities.json` dosyasını sayfaya sürükle.
3. Ekranda kaç il bulduğunu ve il adının hangi alanda olduğunu yazar. 81 yazıyorsa iyi.
4. **tr-cities-data.js indir** butonuna bas.
5. İnen dosyayı `js/` klasörüne at.

**Neden bu adım var:** Tarayıcı, `file://` ile açılmış bir sayfanın `fetch` ile yerel dosya okumasını güvenlik gereği engeller. Ama `<script src="...">` etiketiyle yerel `.js` yüklemeyi engellemez. Veriyi `.json` yerine `.js` içine koyunca engel ortadan kalkıyor — sunucuya gerek kalmıyor.

Dönüştürücü ayrıca il adı alanını otomatik buluyor (`name`, `NAME_1`, `il_adi` vb. hangisiyse) ve hepsini `name` altına çekiyor. Yani bana sorduğum soruyu cevaplaman gerekmiyor, araç kendi hallediyor.

---

## Adım 3 — Aç

`index.html` ➜ çift tık. Bu kadar.

Klasör son hali:

```
kpss-cografya/
├── index.html              ← çift tıkladığın dosya
├── veri-donustur.html      ← sadece bir kez kullanılır
├── css/style.css
├── js/
│   ├── tr-cities-data.js   ← Adım 2'de üretildi
│   ├── config.js  data.js  audio.js  map.js  quiz.js  stats.js  ui.js
├── vendor/
│   ├── d3.v5.min.js        ← Adım 1
│   └── html2canvas.min.js  ← Adım 1
├── data/ornek-konu.json    ← içe aktarmayı denemek için
└── csharp/LocalApiServer.cs
```

---

## Sorun çıkarsa

Ekranda kırmızı hata mesajı görürsen **F12** ile konsolu aç, ilk kırmızı satıra bak.

| Konsoldaki mesaj | Sebep | Çözüm |
|---|---|---|
| `d3 is not defined` | vendor dosyası yok veya adı yanlış | Adım 1'i tekrarla, dosya adını kontrol et |
| `TR_CITIES yok` / harita boş | Adım 2 atlandı | `js/tr-cities-data.js` var mı bak |
| `html2canvas is not defined` | ikinci kütüphane eksik | Karne PNG'si dışında her şey yine çalışır |
| Harita çiziliyor ama iller yeşile dönmüyor | il adları soru bankasıyla tutmuyor | `js/config.js` içindeki `CITY_ALIAS` tablosuna eşleşmeyi ekle |

---

## file:// altında bilmen gereken 2 sınırlama

**localStorage paylaşımlı.** Chrome'da `file://` kökeni tüm yerel sayfalar için ortaktır. Aynı bilgisayarda başka bir yerel HTML projesi de `localStorage` kullanıyorsa anahtarlar aynı kutuda durur. Bu yüzden tüm anahtarları `cs.` önekiyle yazdım (`cs.topics`, `cs.srs`…), çakışma olmaz.

**Ses ilk tıklamada açılır.** Tarayıcılar kullanıcı etkileşimi olmadan ses çalmaya izin vermez. İlk tıklamanda `AudioContext` otomatik uyanıyor, sonraki seslerde gecikme olmaz.

---

## İleride masaüstü uygulamasına gömerken

`file://` yerine WebView2'nin sanal alan adı özelliğini kullanacaksın — o zaman gömülü `.js` numarasına gerek kalmaz, normal `fetch` de çalışır:

```csharp
_web.CoreWebView2.SetVirtualHostNameToFolderMapping(
    "app.local", wwwroot, CoreWebView2HostResourceAccessKind.Allow);
_web.CoreWebView2.Navigate("https://app.local/index.html");
```

Kod her iki durumu da destekliyor: `window.TR_CITIES` varsa onu kullanır, yoksa `data/tr-cities.json`'ı fetch eder. Yani şimdi yaptığın kurulum masaüstüne geçince bozulmaz.
