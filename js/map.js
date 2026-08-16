/* =========================================================
   map.js — mevcut D3 v5 harita kodunun üzerine kuruldu.
   Korunanlar: d3.geoEqualEarth + fitSize + geoPath + centroid etiketleri.
   Eklenenler: katman mimarisi, zoom/pan, tooltip, durum sınıfları.
   Renkler CSS'ten gelir (class tabanlı) → gece modu bedava çalışır.
   ========================================================= */
window.Map81 = {
  svg: null, root: null, path: null, features: [],
  byKey: {},                 // "SİVAS"      -> {f, node}
  byRiver: {},               // "KIZILIRMAK" -> {node}
  onCityClick: null,
  onRiverClick: null,
  tip: null,

  async init() {
    const W = CFG.MAP.W;

    // 1. yol: js/tr-cities-data.js gömülü veri (file:// ile çalışır, CORS yok)
    // 2. yol: data/tr-cities.json fetch (sadece http:// veya WebView2 altında)
    let data = window.TR_CITIES;
    if (!data) {
      try { data = await d3.json("data/tr-cities.json"); }
      catch (e) {
        throw new Error("Harita verisi yok. veri-donustur.html ile tr-cities.json dosyanı " +
                        "js/tr-cities-data.js haline getirip index.html'in yanına koy.");
      }
    }
    this.features = data.features;

    // fitSize sabit bir kutuya sığdırdığı için Türkiye'nin üstünde ve altında
    // boşluk kalıyordu. fitWidth ile genişliğe oturtup yüksekliği veriden
    // hesaplıyoruz — panel tam haritanın oranında oluyor.
    const projection = d3.geoEqualEarth().fitWidth(W, data);
    const b0 = d3.geoPath().projection(projection).bounds(data);
    const H = Math.ceil(b0[1][1] - b0[0][1]);
    const t0 = projection.translate();
    projection.translate([t0[0], t0[1] - b0[0][1]]);   // üstteki boşluğu kırp

    this.W = W; this.H = H;
    this.path = d3.geoPath().projection(projection);

    this.svg = d3.select("#map_container").append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)                 // responsive: width/height CSS'te %100
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("id", "tr-map");

    this.root = this.svg.append("g").attr("id", "root");

    // --- KATMAN SIRASI (alttan üste) ---
    const gRegionFill = this.root.append("g").attr("id", "bolge-dolgu");
    const gCities     = this.root.append("g").attr("id", "iller");
    this.root.append("g").attr("id", "goller");        // placeholder
    this.root.append("g").attr("id", "akarsular");     // placeholder
    this.root.append("g").attr("id", "bolumler");      // 21 bölüm
    this.root.append("g").attr("id", "bolgeler");      // 7 bölge
    const gLabels     = this.root.append("g").attr("id", "etiketler");

    const self = this;

    gCities.selectAll("path")
      .data(this.features).enter().append("path")
      .attr("d", this.path)
      .attr("class", "city")
      .attr("data-city", d => cityKey(d.properties.name))
      .each(function (d) { self.byKey[cityKey(d.properties.name)] = { f: d, node: this }; })
      .on("mousemove", function (d) { self._tipShow(d.properties.name); })
      .on("mouseout",  function ()  { self._tipHide(); })
      .on("click", function (d) {
        if (self.onCityClick) self.onCityClick(cityKey(d.properties.name), d.properties.name, this);
      });

    gLabels.selectAll("text")
      .data(this.features).enter().append("text")
      .attr("class", "city-label")
      .attr("x", d => this.path.centroid(d)[0])
      .attr("y", d => this.path.centroid(d)[1])
      .text(d => d.properties.name);

    this._buildRegionFallback(gRegionFill);
    await this._loadRegionOutlines();
    this._loadRivers();
    this._initTip();
    return this;
  },

  /* Yakınlaştırma tamamen kaldırıldı — harita sabit. */

  /* ---------- tooltip ---------- */
  _initTip() {
    this.tip = document.createElement("div");
    this.tip.className = "map-tip";
    document.body.appendChild(this.tip);
  },
  _tipShow(name) {
    if (document.body.classList.contains("blind")) return;
    this.tip.textContent = name;
    this.tip.style.left = d3.event.clientX + "px";
    this.tip.style.top  = d3.event.clientY + "px";
    this.tip.classList.add("on");
  },
  _tipHide() { this.tip.classList.remove("on"); },

  /* ---------- bölge sınırları ----------
     data/tr-regions.json ve data/tr-bolumler.json varsa gerçek dış hat
     çizilir (mapshaper -dissolve ile üretilir, OFFLINE-KURULUM.md'de anlattım).
     Yoksa: iller bölge rengine göre şeffaf tonlanır (fallback). */
  async _loadRegionOutlines() {
    const gomulu = { bolgeler: window.TR_REGIONS, bolumler: window.TR_BOLUMLER };
    // file:// altında fetch CORS'a takılır ve Chrome hatayı try/catch'e rağmen
    // konsola basar. O yüzden isteği hiç yapmıyoruz — fallback zaten devrede.
    const fileMode = location.protocol === "file:";
    for (const [file, gid] of [["data/tr-regions.json","bolgeler"], ["data/tr-bolumler.json","bolumler"]]) {
      try {
        let gj = gomulu[gid];
        if (!gj && !fileMode) gj = await d3.json(file);
        if (!gj || !gj.features) continue;
        d3.select("#" + gid).selectAll("path").data(gj.features).enter()
          .append("path").attr("d", this.path);
        if (gid === "bolgeler") d3.select("#bolge-dolgu").style("display", "none");
      } catch (e) { /* dosya yok — fallback devrede */ }
    }
  },

  _buildRegionFallback(g) {
    const tint = ["#2B6C8F","#2E7D5B","#B4453C","#7A5AA6","#C08A2E","#3F8F86","#8F5A3F"];
    const idx = {}; Object.keys(REGIONS).forEach((r, i) => idx[r] = tint[i % tint.length]);
    g.attr("opacity", 0.16)
      .selectAll("path").data(this.features).enter().append("path")
      .attr("d", this.path)
      .attr("fill", d => {
        const r = CITY_REGION[cityKey(d.properties.name)];
        return r ? idx[r.bolge] : "none";
      })
      .attr("stroke", "none").style("pointer-events", "none");
    g.style("display", "none");
    this._fallbackFill = g;
  },

  setRegionsVisible(on) {
    const real = d3.select("#bolgeler").selectAll("path").size() > 0;
    document.body.classList.toggle("regions-on", on);
    if (!real && this._fallbackFill) this._fallbackFill.style("display", on ? "block" : "none");
  },

  /* ---------- durum boyama ---------- */
  clear(cls) {
    const sel = d3.selectAll(".city");
    if (cls) sel.classed(cls, false);
    else sel.attr("class", "city").style("fill", null);
  },
  set(key, cls, on) {
    const e = this.byKey[key]; if (!e) return;
    d3.select(e.node).classed(cls, on !== false);
  },
  paint(keys, cls) { (keys || []).forEach(k => this.set(cityKey(k), cls, true)); },

  flashWrong(node) {
    const s = d3.select(node);
    s.classed("is-wrong", true);
    setTimeout(() => s.classed("is-wrong", false), CFG.WRONG_FLASH_MS);
  },

  blink(keys, ms) {
    const list = (keys || []).map(k => this.byKey[cityKey(k)]).filter(Boolean);
    list.forEach(e => d3.select(e.node).classed("is-hint", true));
    setTimeout(() => list.forEach(e => d3.select(e.node).classed("is-hint", false)), ms || CFG.HINT_MS);
  },

  /* ---------- hata ısı haritası (inline style CSS'i ezer) ---------- */
  heat(map) {
    const vals = Object.values(map);
    const max = vals.length ? Math.max.apply(null, vals) : 0;
    if (!max) return 0;
    const scale = d3.scaleLinear().domain([0, max]).range([0.12, 1]);
    d3.selectAll(".city").style("fill", function () {
      const k = this.getAttribute("data-city");
      const v = map[k] || 0;
      return v ? d3.interpolateRgb("#F3D2CE", "#8E241B")(scale(v)) : null;
    });
    return max;
  },
  heatOff() { d3.selectAll(".city").style("fill", null); },

  /* ---------- PNG indir: html2canvas yerine saf SVG serileştirme ----------
     html2canvas SVG'yi bazen bozuk basar; bu yol piksel-tam ve bağımsız. */
  download(filename) {
    const svgEl = document.getElementById("tr-map");
    const clone = svgEl.cloneNode(true);
    // CSS değişkenleri clone'a taşınmıyor → hesaplanmış renkleri gömüyoruz
    const src = svgEl.querySelectorAll("*"), dst = clone.querySelectorAll("*");
    for (let i = 0; i < src.length; i++) {
      const cs = getComputedStyle(src[i]);
      dst[i].setAttribute("style",
        `fill:${cs.fill};stroke:${cs.stroke};stroke-width:${cs.strokeWidth};` +
        `opacity:${cs.opacity};display:${cs.display};font-size:${cs.fontSize};` +
        `font-family:${cs.fontFamily};text-anchor:${cs.textAnchor}`);
    }
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = this.W * 2; c.height = this.H * 2;            // 2x retina
      const ctx = c.getContext("2d");
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => saveBlob(b, filename || "harita.png"));
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }
};

/* ---------- akarsular ve göller ---------- */
Map81._loadRivers = function () {
  const data = window.TR_AKARSULAR;
  if (!data || !data.features || !data.features.length) return;

  const self = this;
  const g = d3.select("#akarsular");

  // görünmez kalın vuruş katmanı — ince çizgiye parmakla isabet zor
  g.selectAll("path.river-hit").data(data.features).enter().append("path")
    .attr("class", "river-hit")
    .attr("d", this.path)
    .attr("data-river", d => normTr(d.properties.name))
    .on("click", function (d) {
      if (self.onRiverClick) self.onRiverClick(normTr(d.properties.name), d.properties.name, this);
    })
    .on("mousemove", function (d) { self._tipShow(d.properties.name); })
    .on("mouseout", function () { self._tipHide(); });

  // görünen ince çizgi
  g.selectAll("path.river").data(data.features).enter().append("path")
    .attr("class", "river")
    .attr("d", this.path)
    .attr("data-river", d => normTr(d.properties.name))
    .each(function (d) {
      const k = normTr(d.properties.name);
      (self.byRiver[k] = self.byRiver[k] || { nodes: [] }).nodes.push(this);
    });

  // her akarsu için tek bir küçük nokta + etiket (ilden daha silik)
  const seen = {};
  data.features.forEach(d => {
    const k = normTr(d.properties.name);
    if (!k || seen[k]) return;
    seen[k] = 1;
    const c = self.path.centroid(d);
    if (!c || isNaN(c[0])) return;
    g.append("circle").attr("class", "river-dot").attr("cx", c[0]).attr("cy", c[1]).attr("r", 2.2);
    g.append("text").attr("class", "river-label").attr("x", c[0]).attr("y", c[1] - 5)
      .text(d.properties.name);
  });

  if (window.TR_GOLLER && TR_GOLLER.features) {
    d3.select("#goller").selectAll("path").data(TR_GOLLER.features).enter()
      .append("path").attr("class", "lake").attr("d", this.path);
  }
  this.hasRivers = true;
};

Map81.setRiversVisible = function (on) {
  document.body.classList.toggle("rivers-on", !!on);
};

Map81.setRiver = function (key, cls, on) {
  const e = this.byRiver[normTr(key)]; if (!e) return;
  e.nodes.forEach(n => d3.select(n).classed(cls, on !== false));
};

Map81.paintRivers = function (names, cls) {
  (names || []).forEach(n => this.setRiver(n, cls, true));
};

Map81.clearRivers = function (cls) {
  const sel = d3.selectAll(".river");
  if (cls) sel.classed(cls, false);
  else sel.attr("class", "river");
};

/* ---------- il üstü balon (ilçe bilgisi) ---------- */
Map81.popup = function (items, ms) {
  const layer = document.getElementById("popup-layer");
  const svg = document.getElementById("tr-map");
  if (!layer || !svg) return;
  this.clearPopups();

  const vb = svg.viewBox.baseVal;            // SVG iç koordinatları
  const rect = svg.getBoundingClientRect();  // ekrandaki gerçek boyut
  const box = layer.getBoundingClientRect();
  const sx = rect.width / vb.width, sy = rect.height / vb.height;

  items.forEach(it => {
    const e = this.byKey[cityKey(it.key)]; if (!e) return;
    const c = this.path.centroid(e.f);
    const el = document.createElement("div");
    el.className = "map-popup";
    el.innerHTML = `<b>${it.title}</b>${it.text ? "<span>" + it.text + "</span>" : ""}`;
    el.style.left = (rect.left - box.left + c[0] * sx) + "px";
    el.style.top  = (rect.top  - box.top  + c[1] * sy) + "px";
    layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add("on"));
  });

  clearTimeout(this._popT);
  this._popT = setTimeout(() => this.clearPopups(), ms || CFG.POPUP_MS);
};

Map81.clearPopups = function () {
  const layer = document.getElementById("popup-layer");
  if (layer) layer.innerHTML = "";
  clearTimeout(this._popT);
};

/* FileSaver.js yerine native indirme — bir bağımlılık eksildi */
window.saveBlob = function (blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
