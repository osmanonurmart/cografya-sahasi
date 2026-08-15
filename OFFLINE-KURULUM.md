# Offline kurulum

## 1. Kütüphaneleri indir (2 dosya, toplam ~300 KB)

Ağı olan bir makinede bir kez indir, `vendor/` içine at:

| Dosya | Adres | Boyut |
|---|---|---|
| `vendor/d3.v5.min.js` | `https://d3js.org/d3.v5.min.js` | ~240 KB |
| `vendor/html2canvas.min.js` | `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` | ~50 KB |

Komut satırıyla:

```bash
curl -L -o vendor/d3.v5.min.js https://d3js.org/d3.v5.min.js
curl -L -o vendor/html2canvas.min.js https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
```

PowerShell:

```powershell
iwr https://d3js.org/d3.v5.min.js -OutFile vendor\d3.v5.min.js
iwr https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js -OutFile vendor\html2canvas.min.js
```

**FileSaver.js'i sildim.** Senin HTML'indeki `cdn.jsdelivr.net/g/filesaver.js` adresi ölü — jsDelivr `/g/` birleştirme servisini 2019'da kapattı, o satır sessizce 404 dönüyordu. Yerine `js/map.js` içindeki 6 satırlık `saveBlob()` fonksiyonu var; `URL.createObjectURL` + `<a download>` ile aynı işi bağımlılıksız yapıyor.

## 2. Harita verisi

`data/tr-cities.json` — 81 ili içeren GeoJSON. Mevcut projendeki dosyayı buraya kopyala. Beklenen yapı:

```json
{ "type":"FeatureCollection",
  "features":[ { "type":"Feature",
                 "properties":{ "name":"Sivas" },
                 "geometry":{ "type":"Polygon", "coordinates":[...] } } ] }
```

İl adı `properties.name` altında değilse `js/map.js` içinde 3 yerde geçen `d.properties.name` ifadesini değiştir.

## 3. Bölge ve bölüm sınırları (isteğe bağlı ama önerilir)

Şu an dosya yoksa **fallback** devrede: iller bölgeye göre şeffaf renklerle tonlanıyor. Gerçek kalın dış hat istiyorsan illeri birleştirmen (dissolve) gerekir. En ucuz yol [mapshaper](https://mapshaper.org) — web sürümü tamamen tarayıcıda çalışır, kurulum yok:

1. `tr-cities.json` dosyasını mapshaper.org'a sürükle.
2. Konsola (sağ üstteki **Console**) sırayla yaz:

```
-each 'bolge = require("./bolge-tablosu.json")[name]'
-dissolve bolge
-o tr-regions.json format=geojson
```

Tablo yüklemek istemiyorsan daha basit yol: `js/config.js` içindeki `REGIONS` tablosunu kullanarak mapshaper konsolunda tek tek filtreleyip birleştir:

```
-filter '["Sivas","Yozgat","Kayseri"].indexOf(name) > -1' + name=yk
-dissolve target=yk -o tr-bolum-yk.json
```

Sonra çıkan parçaları tek bir FeatureCollection'da birleştirip `data/tr-regions.json` ve `data/tr-bolumler.json` olarak kaydet. Dosyalar varsa uygulama otomatik olarak onları kullanır, fallback kapanır.

**Terim:** *dissolve* = komşu poligonları ortak bir alan alanına göre birleştirip aradaki iç sınırları silme işlemi. Bölge sınırı çizmenin tek doğru yolu bu; sadece kalın çizgi çekersen il sınırları da kalın görünür.

## 4. Çalıştırma

`index.html`'i çift tıklayıp `file://` ile açarsan **harita yüklenmez.** Sebep: `d3.json()` altta `fetch` kullanır, `file://` kökeni tarayıcıda `null` sayılır ve CORS politikası isteği keser.

Üç çözüm var, artan sağlamlık sırasıyla:

**a) Geliştirme sırasında tek satır sunucu**

```bash
python -m http.server 8080      # sonra http://localhost:8080
```

**b) VS Code kullanıyorsan** Live Server eklentisi aynı işi yapar.

**c) Nihai masaüstü çözümü — WebView2 sanal alan adı**
`csharp/LocalApiServer.cs` dosyasının altındaki yorum bloğunda tam kodu var. Özet:

```csharp
_web.CoreWebView2.SetVirtualHostNameToFolderMapping(
    "app.local", wwwroot, CoreWebView2HostResourceAccessKind.Allow);
_web.CoreWebView2.Navigate("https://app.local/index.html");
```

**Terim:** *SetVirtualHostNameToFolderMapping*, WebView2'nin bir yerel klasörü sahte bir HTTPS alan adına bağlamasını sağlar. Tarayıcı açısından sayfa artık `https://app.local/` kökenindedir; CORS, `localStorage`, Service Worker, `fetch` hepsi normal bir site gibi çalışır. Ayrıca ayrı bir HTTP sunucusu portu açmadığın için güvenlik duvarı uyarısı da çıkmaz.

## 5. C# API'yi açmak

1. `csharp/LocalApiServer.cs` dosyasını projene ekle, `new LocalApiServer(5099).Start();` çağır.
2. `js/config.js` içinde `USE_API: true` yap.

Bu andan itibaren `Store.load()` önce `/api/ping` atar; sunucu ayaktaysa veriyi oradan çeker, değilse sessizce `localStorage`'a düşer. Yani API kapalıyken uygulama yine tam çalışır.

Veri dosyaları: `%LOCALAPPDATA%\CografyaSahasi\topics.json` ve `stats.jsonl`.

## 6. Klasör yapısı

```
kpss-cografya/
├── index.html
├── css/style.css
├── js/  config.js  data.js  audio.js  map.js  quiz.js  stats.js  ui.js
├── vendor/  d3.v5.min.js  html2canvas.min.js      ← sen indireceksin
├── data/    tr-cities.json                         ← sen koyacaksın
│            tr-regions.json  tr-bolumler.json      ← isteğe bağlı
├── images/  (atlas görselleri)
└── csharp/  LocalApiServer.cs
```
