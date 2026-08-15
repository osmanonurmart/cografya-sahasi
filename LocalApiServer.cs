// =====================================================================
//  LocalApiServer.cs  —  bağımlılıksız yerel JSON API (HttpListener)
//  .NET Framework 4.8 / .NET 6+ WinForms & WPF ile çalışır.
//  NuGet gerekmez (System.Text.Json .NET Core'da yerleşik; 4.8 için
//  Newtonsoft.Json'a çevirmen yeterli).
//
//  Uç noktalar:
//    GET  /api/ping
//    GET  /api/topics
//    PUT  /api/topics
//    POST /api/topics/{id}/questions
//    POST /api/stats
// =====================================================================
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace CografyaSahasi
{
    public class LocalApiServer : IDisposable
    {
        private readonly HttpListener _listener = new HttpListener();
        private readonly string _dataDir;
        private readonly string _topicsPath;
        private readonly string _statsPath;
        private CancellationTokenSource _cts;

        public int Port { get; }

        public LocalApiServer(int port = 5099, string dataDir = null)
        {
            Port = port;
            _dataDir = dataDir ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CografyaSahasi");
            Directory.CreateDirectory(_dataDir);
            _topicsPath = Path.Combine(_dataDir, "topics.json");
            _statsPath  = Path.Combine(_dataDir, "stats.jsonl");

            // Sadece localhost'a bağlan → yönetici hakkı gerekmez, dışarı açılmaz.
            _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
            _listener.Prefixes.Add($"http://localhost:{port}/");
        }

        public void Start()
        {
            _cts = new CancellationTokenSource();
            _listener.Start();
            Task.Run(() => Loop(_cts.Token));
        }

        private async Task Loop(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                HttpListenerContext ctx;
                try { ctx = await _listener.GetContextAsync(); }
                catch { break; }
                _ = Task.Run(() => Handle(ctx));
            }
        }

        private void Handle(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var res = ctx.Response;

            // ---- CORS: file:// kökeni "null" gönderir, onu da kabul ediyoruz ----
            res.AddHeader("Access-Control-Allow-Origin", req.Headers["Origin"] ?? "*");
            res.AddHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
            res.AddHeader("Access-Control-Allow-Headers", "Content-Type");
            res.AddHeader("Cache-Control", "no-store");

            if (req.HttpMethod == "OPTIONS") { res.StatusCode = 204; res.Close(); return; }

            try
            {
                string path = req.Url.AbsolutePath.TrimEnd('/');
                string body = req.HasEntityBody
                    ? new StreamReader(req.InputStream, Encoding.UTF8).ReadToEnd()
                    : "";

                if (path == "/api/ping")
                {
                    Write(res, "{\"ok\":true}");
                }
                else if (path == "/api/topics" && req.HttpMethod == "GET")
                {
                    Write(res, File.Exists(_topicsPath) ? File.ReadAllText(_topicsPath, Encoding.UTF8) : "[]");
                }
                else if (path == "/api/topics" && req.HttpMethod == "PUT")
                {
                    AtomicWrite(_topicsPath, body);
                    Write(res, "{\"ok\":true}");
                }
                else if (path.StartsWith("/api/topics/") && path.EndsWith("/questions") && req.HttpMethod == "POST")
                {
                    string topicId = path.Split('/')[3];
                    AppendQuestion(topicId, body);
                    Write(res, "{\"ok\":true}");
                }
                else if (path == "/api/stats" && req.HttpMethod == "POST")
                {
                    File.AppendAllText(_statsPath, body + Environment.NewLine, Encoding.UTF8);
                    Write(res, "{\"ok\":true}");
                }
                else
                {
                    res.StatusCode = 404;
                    Write(res, "{\"error\":\"not found\"}");
                }
            }
            catch (Exception ex)
            {
                res.StatusCode = 500;
                Write(res, JsonSerializer.Serialize(new { error = ex.Message }));
            }
        }

        // Soruyu ilgili konunun qa dizisine ekler.
        private void AppendQuestion(string topicId, string questionJson)
        {
            var json = File.Exists(_topicsPath) ? File.ReadAllText(_topicsPath, Encoding.UTF8) : "[]";
            var topics = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json)
                         ?? new List<Dictionary<string, JsonElement>>();

            foreach (var t in topics)
            {
                if (t.TryGetValue("id", out var idEl) && idEl.GetString() == topicId)
                {
                    var list = new List<JsonElement>();
                    if (t.TryGetValue("qa", out var qaEl) && qaEl.ValueKind == JsonValueKind.Array)
                        foreach (var q in qaEl.EnumerateArray()) list.Add(q);
                    list.Add(JsonDocument.Parse(questionJson).RootElement.Clone());
                    t["qa"] = JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(list));
                    break;
                }
            }

            AtomicWrite(_topicsPath, JsonSerializer.Serialize(topics,
                new JsonSerializerOptions { WriteIndented = true }));
        }

        // Yazma sırasında elektrik giderse dosya bozulmasın diye önce .tmp'ye yaz.
        private static void AtomicWrite(string path, string content)
        {
            var tmp = path + ".tmp";
            File.WriteAllText(tmp, content, new UTF8Encoding(false));
            if (File.Exists(path)) File.Replace(tmp, path, null);
            else File.Move(tmp, path);
        }

        private static void Write(HttpListenerResponse res, string json)
        {
            var buf = Encoding.UTF8.GetBytes(json);
            res.ContentType = "application/json; charset=utf-8";
            res.ContentLength64 = buf.Length;
            res.OutputStream.Write(buf, 0, buf.Length);
            res.Close();
        }

        public void Dispose()
        {
            _cts?.Cancel();
            if (_listener.IsListening) _listener.Stop();
            _listener.Close();
        }
    }
}

/* =====================================================================
   WinForms + WebView2 gömme şablonu
   NuGet: Microsoft.Web.WebView2
   ---------------------------------------------------------------------
using System;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

namespace CografyaSahasi
{
    public partial class MainForm : Form
    {
        private WebView2 _web;
        private LocalApiServer _api;

        public MainForm()
        {
            InitializeComponent();
            _api = new LocalApiServer(5099);
            _api.Start();

            _web = new WebView2 { Dock = DockStyle.Fill };
            Controls.Add(_web);
            InitAsync();
        }

        private async void InitAsync()
        {
            await _web.EnsureCoreWebView2Async(null);

            // ---- KRİTİK ----
            // Uygulama klasörünü sanal bir https alan adına bağlıyoruz.
            // Böylece file:// yerine https://app.local/ üzerinden açılır ve
            // fetch / d3.json / localStorage CORS'a takılmadan çalışır.
            string wwwroot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
            _web.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local", wwwroot,
                Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind.Allow);

            _web.CoreWebView2.Navigate("https://app.local/index.html");

            // Geliştirme bittiğinde sağ tık menüsünü ve DevTools'u kapatmak istersen:
            // _web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            // _web.CoreWebView2.Settings.AreDevToolsEnabled = false;
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            _api?.Dispose();
            base.OnFormClosed(e);
        }
    }
}
   ===================================================================== */
