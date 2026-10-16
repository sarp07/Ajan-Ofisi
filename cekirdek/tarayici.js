// Tarayıcı odası: her bağlı hesap uygulamanın içinde kendi kalıcı Chromium profilinde açılır.
// Girişi sahip elle yapar, uygulama şifre görmez. Oturum çerezi o hesabın profilinde (persist:hesap-<kimlik>) durur.
// Ajanlar bu sekmeleri MCP araçlarıyla okur ve kullanır. Bu dosya yalnızca ana süreçte çalışır.
import { WebContentsView, BrowserWindow, session } from 'electron';

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

  // Ekranda gösterilmeyen sekmeler gizli bir pencerede durur: çizilmeye devam ederler, ajanlar ekran görüntüsü
  // alabilir, sayfa içi zamanlayıcılar yavaşlamaz.
  ev() {
    if (!this.gizliPencere || this.gizliPencere.isDestroyed()) {
      this.gizliPencere = new BrowserWindow({ show: false, width: 1280, height: 900, skipTaskbar: true, focusable: false, webPreferences: { backgroundThrottling: false } });
    }
    return this.gizliPencere;
  }

  // Ana pencere kapanınca gizli pencere de kapanır (yoksa uygulama kapanmaz)
  gizliKapat() {
    if (this.gizliPencere && !this.gizliPencere.isDestroyed()) this.gizliPencere.destroy();
    this.gizliPencere = null;
  }

  eveKoy(s) {
    const ev = this.ev();
    if (!ev.contentView.children.includes(s.view)) ev.contentView.addChildView(s.view);
    const c = CIHAZLAR[s.cihaz];
    s.view.setBounds({ x: 0, y: 0, width: c ? c.genislik : 1280, height: c ? c.yukseklik : 900 });
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
    const view = new WebContentsView({ webPreferences: { partition: bolme, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
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
    this.eveKoy(s);
    wc.loadURL(hesapAdresi(hesap));
    return s;
  }

  // Sekmeyi pencerenin içindeki bir dikdörtgende gösterir (arayüzdeki yer tutucunun yeri)
  goster(id, alan) {
    const s = this.sekmeler.get(id);
    if (!s || !this.pencere || this.pencere.isDestroyed()) return;
    if (this.gorunen && this.gorunen !== id) this.gizle();
    const cv = this.pencere.contentView;
    if (this.gizliPencere && !this.gizliPencere.isDestroyed() && this.gizliPencere.contentView.children.includes(s.view)) this.gizliPencere.contentView.removeChildView(s.view);
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
    else this.eveKoy(s);
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
    if (s) this.eveKoy(s);
    this.gorunen = null;
  }

  kapat(id) {
    const s = this.sekmeler.get(id);
    if (!s) return;
    if (this.gorunen === id) this.gizle();
    if (this.gizliPencere && !this.gizliPencere.isDestroyed() && this.gizliPencere.contentView.children.includes(s.view)) this.gizliPencere.contentView.removeChildView(s.view);
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

  // Ekran görüntüsü: sekme ekranda görünmüyorsa da çekilir (stayHidden). Boş gelirse sayfa yeniden çizdirilip denenir.
  async goruntu(id) {
    const wc = this.sekme(id);
    let img = null;
    for (let deneme = 0; deneme < 3; deneme++) {
      try {
        img = await wc.capturePage(undefined, { stayHidden: true });
      } catch {
        img = null;
      }
      if (img && !img.isEmpty() && img.getSize().width > 1) break;
      wc.invalidate();
      await new Promise((r) => setTimeout(r, 350));
    }
    if (!img || img.isEmpty()) throw new Error('Ekran görüntüsü alınamadı: sayfa henüz çizilmedi. Biraz bekleyip yeniden dene ya da tarayici_metin ile oku.');
    // görüntü sayfanın CSS genişliğine indirilir: görüntüdeki bir nokta tarayici_fare ile aynı koordinatla tıklanır
    let css = 0;
    try {
      css = Number(await wc.executeJavaScript('innerWidth')) || 0;
    } catch {
      css = 0;
    }
    const hedefEn = Math.min(1400, css || img.getSize().width);
    const kucuk = img.getSize().width !== hedefEn ? img.resize({ width: hedefEn }) : img;
    const s = this.sekmeler.get(id);
    if (s) s.olcek = css ? css / hedefEn : 1;
    const { width: en, height: boy } = kucuk.getSize();
    return { veri: kucuk.toPNG().toString('base64'), en, boy };
  }

  // Fare: ekran görüntüsündeki koordinatlarla gerçek fare olayı. eylem: tikla, cift, sag, uzerine, surukle (x2, y2'ye)
  async fare(id, { x, y, eylem = 'tikla', x2, y2 }) {
    const wc = this.sekme(id);
    const s = this.sekmeler.get(id);
    const k = (s && s.olcek) || 1;
    const X = Math.round(Number(x) * k);
    const Y = Math.round(Number(y) * k);
    if (!Number.isFinite(X) || !Number.isFinite(Y)) throw new Error('Geçersiz koordinat');
    const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
    wc.sendInputEvent({ type: 'mouseMove', x: X, y: Y });
    await bekle(40);
    if (eylem === 'uzerine') return { tamam: true, x: X, y: Y };
    if (eylem === 'surukle') {
      const X2 = Math.round(Number(x2) * k);
      const Y2 = Math.round(Number(y2) * k);
      wc.sendInputEvent({ type: 'mouseDown', x: X, y: Y, button: 'left', clickCount: 1 });
      for (let i = 1; i <= 12; i++) {
        wc.sendInputEvent({ type: 'mouseMove', x: Math.round(X + ((X2 - X) * i) / 12), y: Math.round(Y + ((Y2 - Y) * i) / 12), button: 'left', modifiers: ['leftButtonDown'] });
        await bekle(16);
      }
      wc.sendInputEvent({ type: 'mouseUp', x: X2, y: Y2, button: 'left', clickCount: 1 });
      return { tamam: true };
    }
    const tus = eylem === 'sag' ? 'right' : 'left';
    const say = eylem === 'cift' ? 2 : 1;
    for (let i = 1; i <= say; i++) {
      wc.sendInputEvent({ type: 'mouseDown', x: X, y: Y, button: tus, clickCount: i });
      wc.sendInputEvent({ type: 'mouseUp', x: X, y: Y, button: tus, clickCount: i });
      await bekle(30);
    }
    await bekle(200);
    return { tamam: true, x: X, y: Y };
  }

  // Sayfanın bütün çerçeveleri (ana sayfa ve iç çerçeveler). Sıra numarası öğe numarasının önekidir.
  cerceveler(id) {
    const wc = this.sekme(id);
    try {
      return wc.mainFrame.framesInSubtree.filter((f) => !f.detached);
    } catch {
      return [wc.mainFrame];
    }
  }

  // Etkileşilebilir öğeleri numaralandırır: alanlar, düğmeler, bağlantılar. Gölge DOM ve iç çerçeveler dahil.
  // Açık bir pencere (dialog) varsa onun içindekiler önce gelir. Ajan sonra öğeye numarasıyla tıklar ya da yazar.
  async alanlar(id) {
    const sonuc = [];
    const cerceveler = this.cerceveler(id);
    for (let fi = 0; fi < cerceveler.length; fi++) {
      try {
        const liste = await cerceveler[fi].executeJavaScript(TARA(fi));
        if (Array.isArray(liste)) sonuc.push(...liste);
      } catch {
        /* erişilemeyen çerçeve */
      }
    }
    sonuc.sort((a, b) => (b.pencerede ? 1 : 0) - (a.pencerede ? 1 : 0));
    return { adres: this.sekme(id).getURL(), ipucu: 'Öğeye tarayici_tikla ya da tarayici_yaz ile no vererek eriş. Sayfa değişince yeniden listele.', ogeler: sonuc.slice(0, 220) };
  }

  // Numara, CSS seçici ya da görünen yazı/etiketle öğeyi bulur ve hazırlar. Döner: { cerceve, fi, bilgi }
  async bul(id, { no, secici, metin, etiket }, eylem) {
    const cerceveler = this.cerceveler(id);
    const ara = { no: no ? String(no) : '', secici: secici || '', metin: String(metin || etiket || '').trim().toLowerCase() };
    const sira = ara.no ? [Number(String(ara.no).split('.')[0])] : cerceveler.map((_, i) => i);
    for (const fi of sira) {
      const f = cerceveler[fi];
      if (!f) continue;
      try {
        const bilgi = await f.executeJavaScript(BUL(fi, ara, eylem));
        if (bilgi && bilgi.bulundu) return { cerceve: f, fi, bilgi };
      } catch {
        /* erişilemeyen çerçeve */
      }
    }
    return null;
  }

  // Tıklar: önce gerçek fare tıklaması (ana çerçevede, cihaz modu kapalıyken), olmazsa sayfa içi tıklama
  async tikla(id, hedef) {
    const s = this.sekmeler.get(id);
    const wc = this.sekme(id);
    const b = await this.bul(id, hedef, 'tikla');
    if (!b) throw new Error('Tıklanacak öğe bulunamadı. tarayici_alanlar ile öğeleri listeleyip numarasıyla dene.');
    const gercek = b.fi === 0 && (!s || s.cihaz === 'masaustu') && b.bilgi.x >= 0 && b.bilgi.y >= 0;
    if (gercek) {
      const x = Math.round(b.bilgi.x);
      const y = Math.round(b.bilgi.y);
      wc.sendInputEvent({ type: 'mouseMove', x, y });
      wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    } else await b.cerceve.executeJavaScript(`(() => { const el = ${DERIN_BUL}(${JSON.stringify(b.bilgi.no)}); if (el) { el.focus && el.focus(); el.click(); } })()`);
    await new Promise((r) => setTimeout(r, 250));
    return { tamam: true, oge: b.bilgi.etiket, no: b.bilgi.no };
  }

  // Yazar: öğeye odaklanır, istenirse içini temizler, metni gerçek klavye girişi gibi ekler, sonra alanın değerini okur.
  // Metin alana düşmediyse React ve zengin metin kutularıyla uyumlu yedek yöntem kullanılır.
  async yaz(id, { no, secici, etiket, metin, temizle, enter }) {
    const s = this.sekmeler.get(id);
    const wc = this.sekme(id);
    const yazi = String(metin || '');
    let b = null;
    if (no || secici || etiket) {
      b = await this.bul(id, { no, secici, etiket }, temizle ? 'odaklaTemizle' : 'odakla');
      if (!b) throw new Error('Yazılacak alan bulunamadı. tarayici_alanlar ile alanları listeleyip numarasıyla dene.');
      // gerçek odak: ana çerçevede alana gerçek fare tıklaması (React ve LinkedIn gibi editörler seçimi buna göre kurar)
      if (b.fi === 0 && (!s || s.cihaz === 'masaustu') && b.bilgi.x >= 0 && b.bilgi.y >= 0) {
        const x = Math.round(b.bilgi.x);
        const y = Math.round(b.bilgi.y);
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
        await new Promise((r) => setTimeout(r, 80));
      }
    }
    if (temizle) {
      // tarayıcının kendi düzenleme komutları: tümünü seç ve sil (klavye kısayolu menüye takılmaz)
      wc.selectAll();
      await new Promise((r) => setTimeout(r, 40));
      wc.delete();
      await new Promise((r) => setTimeout(r, 80));
      if (b) await b.cerceve.executeJavaScript(BOSALT(b.bilgi.no));
    }
    if (yazi) await wc.insertText(yazi);
    await new Promise((r) => setTimeout(r, 120));
    let deger = '';
    if (b) {
      deger = await b.cerceve.executeJavaScript(YEDEK(b.bilgi.no, yazi, !!temizle));
    }
    if (enter) this.tus(id, 'Enter');
    const tam = String(deger || '');
    const uyusmuyor = b && temizle && tam.trim() !== yazi.trim();
    return { tamam: !uyusmuyor, alan: b ? b.bilgi.etiket : 'odaktaki alan', deger: tam.slice(0, 300), ...(uyusmuyor ? { uyari: 'Alanın son değeri yazılan metinle aynı değil; ekran görüntüsüyle kontrol et.' } : {}) };
  }

  // Klavye tuşu: Enter, Tab, Escape, Backspace, ok tuşları, PageDown; "Ctrl+A" ya da "Cmd+A" gibi birleşimler
  tus(id, tus) {
    const wc = this.sekme(id);
    const parca = String(tus).split('+');
    const ana = parca.pop();
    const mod = parca.map((m) => ({ cmd: 'meta', ctrl: 'control', alt: 'alt', shift: 'shift' })[m.toLowerCase()] || m.toLowerCase());
    // düzenleme kısayolları menüye takılır; tarayıcının kendi komutlarıyla yapılır
    if (mod.some((m) => m === 'meta' || m === 'control') && ana.length === 1) {
      const k = ana.toLowerCase();
      const komut = { a: 'selectAll', c: 'copy', x: 'cut', v: 'paste', z: mod.includes('shift') ? 'redo' : 'undo', y: 'redo' }[k];
      if (komut) {
        wc[komut]();
        return { tamam: true };
      }
    }
    const kod = { Enter: 'Enter', Tab: 'Tab', Escape: 'Escape', Esc: 'Escape', Backspace: 'Backspace', Delete: 'Delete', ArrowDown: 'Down', ArrowUp: 'Up', ArrowLeft: 'Left', ArrowRight: 'Right', PageDown: 'PageDown', PageUp: 'PageUp', Space: 'Space' }[ana] || ana;
    wc.sendInputEvent({ type: 'keyDown', keyCode: kod, modifiers: mod });
    if (ana === 'Enter' && !mod.length) wc.sendInputEvent({ type: 'char', keyCode: '\r' });
    // tek harf, rakam ya da işaret (oyun tuşları, "/" kısayolu): yazı olarak da sayfaya düşer
    else if ([...ana].length === 1 && !mod.some((m) => m === 'meta' || m === 'control' || m === 'alt')) wc.sendInputEvent({ type: 'char', keyCode: mod.includes('shift') ? ana.toUpperCase() : ana });
    wc.sendInputEvent({ type: 'keyUp', keyCode: kod, modifiers: mod });
    return { tamam: true };
  }

  // Kaydırır: açık pencere varsa onun içi, yoksa sayfa
  async kaydir(id, { yon = 'asagi', miktar = 600 } = {}) {
    const wc = this.sekme(id);
    const d = (yon === 'yukari' ? -1 : 1) * Math.max(50, Math.min(4000, Number(miktar) || 600));
    await wc.executeJavaScript(`(() => {
      const pencere = [...document.querySelectorAll('[role=dialog],[aria-modal=true],dialog[open]')].filter((x) => x.getClientRects().length).pop();
      const kap = pencere ? [pencere, ...pencere.querySelectorAll('*')].find((x) => x.scrollHeight > x.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(x).overflowY)) : null;
      (kap || window).scrollBy({ top: ${d}, behavior: 'instant' });
    })()`);
    return { tamam: true };
  }

  hepsiniKapat() {
    for (const id of [...this.sekmeler.keys()]) this.kapat(id);
    if (this.gizliPencere && !this.gizliPencere.isDestroyed()) this.gizliPencere.destroy();
  }
}

// ---------- sayfa içi betikler ----------
// Gölge DOM dahil derin arama
const DERIN = `((kok) => {
  const sonuc = [];
  const yuru = (d) => {
    for (const el of d.querySelectorAll('*')) {
      sonuc.push(el);
      if (el.shadowRoot) yuru(el.shadowRoot);
    }
  };
  yuru(kok);
  return sonuc;
})`;
const DERIN_BUL = `((no) => ${DERIN}(document).find((x) => x.getAttribute && x.getAttribute('data-ofis-no') === no))`;

const SECICI = 'input:not([type=hidden]), textarea, select, [contenteditable]:not([contenteditable=false]), button, a[href], [role=button], [role=textbox], [role=combobox], [role=checkbox], [role=radio], [role=tab], [role=menuitem], [role=option], [role=switch], [role=link]';

const ETIKET = `((el) => {
  const t = (x) => String(x || '').replace(/\\s+/g, ' ').trim();
  const al = el.getAttribute('aria-label');
  if (al) return t(al);
  const lb = el.getAttribute('aria-labelledby');
  if (lb) { const m = lb.split(' ').map((i) => (document.getElementById(i) || {}).innerText).filter(Boolean).join(' '); if (m) return t(m); }
  if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l && l.innerText) return t(l.innerText); }
  const ust = el.closest && el.closest('label');
  if (ust && ust.innerText) return t(ust.innerText);
  return t(el.placeholder || el.getAttribute('title') || el.name || (el.tagName === 'INPUT' ? el.value : el.innerText) || el.getAttribute('alt') || '');
})`;

function TARA(fi) {
  return `(() => {
    const hepsi = ${DERIN}(document).filter((el) => el.matches && el.matches(${JSON.stringify(SECICI)}));
    const gorunur = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
    const pencere = [...document.querySelectorAll('[role=dialog],[aria-modal=true],dialog[open]')].filter(gorunur).pop() || null;
    const sonuc = [];
    let i = 0;
    for (const el of hepsi) {
      if (!gorunur(el)) continue;
      const no = '${fi}.' + (++i);
      el.setAttribute('data-ofis-no', no);
      const tag = el.tagName.toLowerCase();
      const tur = el.getAttribute('role') || (tag === 'input' ? 'input:' + (el.type || 'text') : el.isContentEditable ? 'metin-kutusu' : tag);
      const deger = tag === 'input' || tag === 'textarea' || tag === 'select' ? el.value : el.isContentEditable ? el.innerText : '';
      sonuc.push({ no, tur, etiket: ${ETIKET}(el).slice(0, 90), deger: String(deger || '').slice(0, 90), pasif: !!el.disabled, pencerede: !!(pencere && pencere.contains(el)) });
      if (sonuc.length > 400) break;
    }
    return sonuc;
  })()`;
}

// Öğeyi bulur; eylem: tikla (konumunu döndürür), odakla, odaklaTemizle
function BUL(fi, ara, eylem) {
  return `(() => {
    const ara = ${JSON.stringify(ara)};
    const hepsi = ${DERIN}(document);
    let el = null;
    if (ara.no) el = hepsi.find((x) => x.getAttribute && x.getAttribute('data-ofis-no') === ara.no);
    if (!el && ara.secici) { try { el = hepsi.find((x) => x.matches && x.matches(ara.secici)); } catch {} }
    if (!el && ara.metin) {
      const adaylar = hepsi.filter((x) => x.matches && x.matches(${JSON.stringify(SECICI)}) && x.getClientRects().length);
      el = adaylar.find((x) => ${ETIKET}(x).toLowerCase() === ara.metin) || adaylar.find((x) => ${ETIKET}(x).toLowerCase().includes(ara.metin));
    }
    if (!el) return { bulundu: false };
    if (!el.getAttribute('data-ofis-no')) el.setAttribute('data-ofis-no', '${fi}.x' + Math.random().toString(36).slice(2, 7));
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const eylem = ${JSON.stringify(eylem)};
    if (eylem !== 'tikla') {
      el.focus();
      if (eylem === 'odaklaTemizle') {
        if ('select' in el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) el.select();
        else if (el.isContentEditable) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      } else if (el.isContentEditable) {
        const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      }
    }
    const r = el.getBoundingClientRect();
    return { bulundu: true, no: el.getAttribute('data-ofis-no'), etiket: ${ETIKET}(el).slice(0, 90), x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`;
}

// Yazı alana düştü mü: düşmediyse React uyumlu yedek (yerel value ayarlayıcı + input olayı) ya da execCommand
// Alanın içini boşaltır (tümünü seç ve sil yetmediyse): React uyumlu değer ayarlayıcı ya da seçip silme
function BOSALT(no) {
  return `(() => {
    const el = ${DERIN_BUL}(${JSON.stringify(no)});
    if (!el) return;
    el.focus();
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (!el.value) return;
      const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el.isContentEditable && el.innerText.trim()) {
      const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      document.execCommand('delete');
    }
  })()`;
}

function YEDEK(no, metin, tam = false) {
  return `(() => {
    const el = ${DERIN_BUL}(${JSON.stringify(no)});
    if (!el) return '';
    const metin = ${JSON.stringify(metin)};
    const tam = ${tam ? 'true' : 'false'};
    const oku = () => (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ? el.value : el.innerText) || '';
    // temizlenip yazıldıysa alan tam olarak metin olmalı; değilse metin olarak ayarlanır
    if (metin && (tam ? oku().trim() !== metin.trim() : !oku().includes(metin.slice(0, 40)))) {
      el.focus();
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const proto = el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, tam ? metin : oku() + metin);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.tagName === 'SELECT') {
        const o = [...el.options].find((x) => x.text.trim().toLowerCase() === metin.trim().toLowerCase() || x.value === metin);
        if (o) { el.value = o.value; el.dispatchEvent(new Event('change', { bubbles: true })); }
      } else if (el.isContentEditable) {
        if (tam) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        document.execCommand('insertText', false, metin);
      }
    }
    return oku();
  })()`;
}
