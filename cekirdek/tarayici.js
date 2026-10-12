// Tarayıcı odası: her bağlı hesap uygulamanın içinde kendi kalıcı Chromium profilinde açılır.
// Girişi sahip elle yapar, uygulama şifre görmez. Oturum çerezi o hesabın profilinde (persist:hesap-<kimlik>) durur.
// Ajanlar bu sekmeleri MCP araçlarıyla okur ve kullanır. Bu dosya yalnızca ana süreçte çalışır.
import { WebContentsView, session } from 'electron';

export const BASLANGIC = {
  telegram: 'https://web.telegram.org/',
  gmail: 'https://mail.google.com/',
  google: 'https://accounts.google.com/',
  instagram: 'https://www.instagram.com/',
  x: 'https://x.com/',
  tiktok: 'https://www.tiktok.com/',
  youtube: 'https://studio.youtube.com/',
  linkedin: 'https://www.linkedin.com/',
  facebook: 'https://www.facebook.com/',
  discord: 'https://discord.com/app',
  github: 'https://github.com/',
  vercel: 'https://vercel.com/dashboard',
  cloudflare: 'https://dash.cloudflare.com/',
  supabase: 'https://supabase.com/dashboard',
  appledev: 'https://developer.apple.com/account',
  apple: 'https://appstoreconnect.apple.com/',
  playconsole: 'https://play.google.com/console',
  firebase: 'https://console.firebase.google.com/',
  expo: 'https://expo.dev/',
};

const guvenliAdres = (u) => {
  try {
    const x = new URL(String(u));
    return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null;
  } catch {
    return null;
  }
};

// Cihaz modları: sayfa o cihazın ekran boyutu ve kimliğiyle açılır (responsive tasarım testi)
export const CIHAZLAR = {
  masaustu: null,
  iphone: { genislik: 390, yukseklik: 844, olcek: 3, kimlik: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  ipad: { genislik: 820, yukseklik: 1180, olcek: 2, kimlik: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  android: { genislik: 412, yukseklik: 915, olcek: 2.625, kimlik: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' },
};
const KONSOL_SINIR = 300;

export const hesapAdresi = (h) => guvenliAdres(h.adres) || BASLANGIC[h.platform] || 'https://www.google.com/';

// Bazı siteler (WhatsApp Web gibi) Electron kimliğini görünce açılmaz: sıradan Chrome gibi görünülür
function chromeKimligi(ua) {
  return String(ua).replace(/\s(Electron|ajan-ofis|AjanOfisi|Ajan Ofisi)\/\S+/gi, '');
}

export class TarayiciOdasi {
  // pencere: ana BrowserWindow. degisti(id, bilgi): sekme durumu değişince
  constructor({ pencere, degisti, konsolDegisti }) {
    this.pencere = pencere;
    this.degisti = degisti;
    this.konsolDegisti = konsolDegisti;
    this.sekmeler = new Map(); // hesap kimliği -> { view, hesap }
    this.gorunen = null;
  }

  pencereAyarla(p) {
    this.pencere = p;
  }

  bilgi(id) {
    const s = this.sekmeler.get(id);
    if (!s) return { id, acik: false };
    const wc = s.view.webContents;
    const hata = s.konsol.filter((k) => k.seviye === 'error').length;
    const uyari = s.konsol.filter((k) => k.seviye === 'warning').length;
    return { id, acik: true, adres: wc.getURL(), baslik: wc.getTitle(), yukleniyor: wc.isLoading(), geri: wc.navigationHistory.canGoBack(), ileri: wc.navigationHistory.canGoForward(), cihaz: s.cihaz, hata, uyari };
  }

  liste() {
    return [...this.sekmeler.keys()].map((id) => this.bilgi(id));
  }

  // Sekmeyi açar (yoksa oluşturur). Görünür yapmaz.
  ac(hesap) {
    let s = this.sekmeler.get(hesap.id);
    if (s) return s;
    const bolme = 'persist:hesap-' + hesap.id;
    const ses = session.fromPartition(bolme);
    ses.setUserAgent(chromeKimligi(ses.getUserAgent()));
    // izinler: kamera, mikrofon, konum gibi istekler reddedilir. Bildirim ve panoya yazma serbest.
    ses.setPermissionRequestHandler((_wc, izin, karar) => karar(['notifications', 'clipboard-sanitized-write', 'fullscreen'].includes(izin)));
    const view = new WebContentsView({ webPreferences: { partition: bolme, sandbox: true, contextIsolation: true, nodeIntegration: false } });
    view.setBackgroundColor('#ffffff');
    const wc = view.webContents;
    // yeni pencere açmak isteyen bağlantılar aynı sekmede açılır
    wc.setWindowOpenHandler(({ url }) => {
      const g = guvenliAdres(url);
      if (g) wc.loadURL(g);
      return { action: 'deny' };
    });
    const bildir = () => this.degisti(hesap.id, this.bilgi(hesap.id));
    for (const olay of ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page', 'page-title-updated']) wc.on(olay, bildir);
    s = { view, hesap, cihaz: 'masaustu', kimlik: ses.getUserAgent(), konsol: [], alan: null };
    // konsol: sayfanın hata, uyarı ve günlükleri; yüklenemeyen adresler ve çöken sayfa da buraya düşer
    const konsolaEkle = (k) => {
      s.konsol.push({ z: Date.now(), ...k });
      if (s.konsol.length > KONSOL_SINIR) s.konsol.splice(0, s.konsol.length - KONSOL_SINIR);
      if (k.seviye === 'error' || k.seviye === 'warning') bildir();
      this.konsolDegisti && this.konsolDegisti(hesap.id);
    };
    wc.on('console-message', (e) => {
      const mesaj = String(e.message ?? '');
      // Electron'un geliştirme sırasında sayfaya yazdığı güvenlik uyarısı sayfanın kendi kaydı değildir
      if (mesaj.includes('Electron Security Warning')) return;
      konsolaEkle({ seviye: typeof e.level === 'string' ? e.level : 'info', mesaj: mesaj.slice(0, 2000), kaynak: String(e.sourceId ?? ''), satir: Number(e.lineNumber) || 0 });
    });
    // ağ hataları: 4xx ve 5xx yanıtlar ve hiç tamamlanamayan istekler (Chrome'daki "Failed to load resource").
    // Her hesabın oturumu ayrıdır, bu yüzden sekme kimliği gelmeyen istek de bu sekmenindir.
    const filtre = { urls: ['http://*/*', 'https://*/*'] };
    ses.webRequest.onCompleted(filtre, (d) => {
      if ((d.webContentsId === undefined || d.webContentsId === wc.id) && d.statusCode >= 400) konsolaEkle({ seviye: 'error', mesaj: `HTTP ${d.statusCode} ${d.method} ${d.url}`, kaynak: d.url, satir: 0 });
    });
    ses.webRequest.onErrorOccurred(filtre, (d) => {
      if ((d.webContentsId === undefined || d.webContentsId === wc.id) && d.error !== 'net::ERR_ABORTED') konsolaEkle({ seviye: 'error', mesaj: `${d.error} ${d.method} ${d.url}`, kaynak: d.url, satir: 0 });
    });
    wc.on('did-fail-load', (_e, kod, aciklama, adres, anaCerceve) => {
      if (kod === -3) return; // kullanıcı ya da yönlendirme iptali
      konsolaEkle({ seviye: 'error', mesaj: `${anaCerceve ? 'Sayfa' : 'Kaynak'} yüklenemedi: ${aciklama} (${kod})`, kaynak: adres, satir: 0 });
    });
    wc.on('render-process-gone', (_e, d) => konsolaEkle({ seviye: 'error', mesaj: 'Sayfa çöktü: ' + (d && d.reason), kaynak: wc.getURL(), satir: 0 }));
    this.sekmeler.set(hesap.id, s);
    wc.loadURL(hesapAdresi(hesap));
    return s;
  }

  // Sekmeyi pencerenin içindeki bir dikdörtgende gösterir (arayüzdeki yer tutucunun yeri)
  goster(id, alan) {
    const s = this.sekmeler.get(id);
    if (!s || !this.pencere || this.pencere.isDestroyed()) return;
    if (this.gorunen && this.gorunen !== id) this.gizle();
    const cv = this.pencere.contentView;
    if (!cv.children.includes(s.view)) cv.addChildView(s.view);
    s.alan = alan;
    s.view.setBounds(this.sinir(s, alan));
    this.gorunen = id;
  }

  // Mobil cihaz modunda sayfa, cihaz genişliğinde ve yer tutucunun ortasında durur
  sinir(s, alan) {
    const c = CIHAZLAR[s.cihaz];
    let { x, y, width, height } = alan;
    if (c) {
      const w = Math.min(width, c.genislik);
      const h = Math.min(height, c.yukseklik);
      x += (width - w) / 2;
      y += Math.max(0, (height - h) / 2);
      width = w;
      height = h;
    }
    return { x: Math.round(x), y: Math.round(y), width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }

  cihazSec(id, cihaz) {
    const s = this.sekmeler.get(id);
    if (!s) throw new Error('Tarayıcı açık değil');
    if (!(cihaz in CIHAZLAR)) throw new Error('Bilinmeyen cihaz');
    const c = CIHAZLAR[cihaz];
    const wc = s.view.webContents;
    s.cihaz = cihaz;
    if (c) {
      wc.enableDeviceEmulation({ screenPosition: 'mobile', screenSize: { width: c.genislik, height: c.yukseklik }, viewSize: { width: c.genislik, height: c.yukseklik }, deviceScaleFactor: c.olcek, viewPosition: { x: 0, y: 0 }, scale: 1 });
      wc.setUserAgent(c.kimlik);
    } else {
      wc.disableDeviceEmulation();
      wc.setUserAgent(s.kimlik);
    }
    if (this.gorunen === id && s.alan) s.view.setBounds(this.sinir(s, s.alan));
    wc.reload();
    this.degisti(id, this.bilgi(id));
    return this.bilgi(id);
  }

  konsol(id, { seviye = '' } = {}) {
    const s = this.sekmeler.get(id);
    if (!s) return [];
    return seviye ? s.konsol.filter((k) => k.seviye === seviye) : s.konsol.slice();
  }

  konsolTemizle(id) {
    const s = this.sekmeler.get(id);
    if (!s) return;
    s.konsol.length = 0;
    this.degisti(id, this.bilgi(id));
    this.konsolDegisti && this.konsolDegisti(id);
  }

  gizle() {
    if (!this.gorunen || !this.pencere || this.pencere.isDestroyed()) return (this.gorunen = null);
    const s = this.sekmeler.get(this.gorunen);
    if (s && this.pencere.contentView.children.includes(s.view)) this.pencere.contentView.removeChildView(s.view);
    this.gorunen = null;
  }

  kapat(id) {
    const s = this.sekmeler.get(id);
    if (!s) return;
    if (this.gorunen === id) this.gizle();
    s.view.webContents.close();
    this.sekmeler.delete(id);
    this.degisti(id, { id, acik: false });
  }

  async gezin(id, adres) {
    const s = this.sekmeler.get(id);
    const g = guvenliAdres(adres);
    if (!s) throw new Error('Tarayıcı açık değil');
    if (!g) throw new Error('Geçersiz adres');
    await s.view.webContents.loadURL(g).catch(() => {});
    return this.bilgi(id);
  }

  git(id, yon) {
    const s = this.sekmeler.get(id);
    if (!s) return;
    const n = s.view.webContents.navigationHistory;
    if (yon === 'geri' && n.canGoBack()) n.goBack();
    else if (yon === 'ileri' && n.canGoForward()) n.goForward();
    else if (yon === 'yenile') s.view.webContents.reload();
  }

  // ---------- ajanların kullandığı işlemler ----------
  sekme(id) {
    const s = this.sekmeler.get(id);
    if (!s) throw new Error('Bu hesabın tarayıcısı açık değil. Önce tarayici_ac çağır.');
    return s.view.webContents;
  }

  // Sayfanın okunur metni: başlık, adres ve görünen yazı (uzunluk sınırlı)
  async metin(id, sinir = 12000) {
    const wc = this.sekme(id);
    const yazi = await wc.executeJavaScript(`(() => { const t = document.body ? document.body.innerText : ''; return t.replace(/\\n{3,}/g, '\\n\\n').slice(0, ${Number(sinir) | 0}); })()`, true);
    return { adres: wc.getURL(), baslik: wc.getTitle(), metin: String(yazi || '') };
  }

  async goruntu(id) {
    const wc = this.sekme(id);
    const img = await wc.capturePage();
    const kucuk = img.getSize().width > 1400 ? img.resize({ width: 1400 }) : img;
    return kucuk.toPNG().toString('base64');
  }

  // Görünen yazısı ya da CSS seçicisi verilen öğeye tıklar
  async tikla(id, { metin, secici }) {
    const wc = this.sekme(id);
    const sonuc = await wc.executeJavaScript(
      `(() => {
        const secici = ${JSON.stringify(secici || '')};
        const aranan = ${JSON.stringify(String(metin || '').trim().toLowerCase())};
        let el = null;
        if (secici) el = document.querySelector(secici);
        if (!el && aranan) {
          const adaylar = [...document.querySelectorAll('button, a, [role=button], [role=link], [role=tab], [role=menuitem], input[type=submit], label, span, div')];
          el = adaylar.find((x) => (x.innerText || x.value || x.getAttribute('aria-label') || '').trim().toLowerCase() === aranan)
            || adaylar.find((x) => (x.innerText || x.getAttribute('aria-label') || '').trim().toLowerCase().includes(aranan));
        }
        if (!el) return { bulundu: false };
        el.scrollIntoView({ block: 'center' });
        el.click();
        return { bulundu: true, etiket: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 80) };
      })()`,
      true
    );
    if (!sonuc || !sonuc.bulundu) throw new Error('Tıklanacak öğe bulunamadı');
    return sonuc;
  }

  // Seçilen alana yazar. Alan verilmezse odaktaki alana yazılır. enter: yazdıktan sonra Enter'a basar.
  async yaz(id, { secici, metin, enter }) {
    const wc = this.sekme(id);
    if (secici) {
      const ok = await wc.executeJavaScript(`(() => { const el = document.querySelector(${JSON.stringify(secici)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.focus(); return true; })()`, true);
      if (!ok) throw new Error('Yazılacak alan bulunamadı');
    }
    // insertText hem düz alanlarda hem zengin metin kutularında (WhatsApp, LinkedIn) çalışır
    await wc.insertText(String(metin || ''));
    if (enter) {
      wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      wc.sendInputEvent({ type: 'char', keyCode: '\r' });
      wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
    }
    return { tamam: true };
  }

  hepsiniKapat() {
    for (const id of [...this.sekmeler.keys()]) this.kapat(id);
  }
}
