// Ajan Ofisi ana süreç: pencere, şirket verisi, gömülü Claude Code oturumu, canlı olay alıcısı.
import { app, BrowserWindow, ipcMain, dialog, protocol, Menu, nativeImage, shell, Notification, safeStorage, session, screen, net } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { yeniDurum, olayIsle, takimIsle, goruntu, temizle, sirketAyarla, oturumAc, oturumKapat } from './cekirdek/durum.js';
import { sohbetIsle, bekleyenSayisi, terminaleMetin, ONAY_TUSU, GUVEN_TUSLARI, duzMetin, guvenSorusuMu } from './cekirdek/sohbet.js';
import { codexUyarla } from './cekirdek/durum.js';
import { kancaSunucu } from './cekirdek/kanca-sunucu.js';
import { takimIzle } from './cekirdek/takim-izleyici.js';
import { SirketDeposu, MASA_SAYISI, katGorunumu } from './cekirdek/sirket.js';
import { SkillDeposu, katalogOku, githubCoz } from './cekirdek/skiller.js';
import { derle, oturumArgumanlari, codexArgumanlari, ozelMetni } from './cekirdek/derle.js';
import { kabukOrtami, claudeBul, kurulumKomutu, taslakIste, jsonAyikla } from './cekirdek/claude.js';
import { MOTORLAR, codexBul, girisDurumu, girisKomutu, kurulumKomutlari, codexKlasoru, codexModelleri, codexVarsayilan, motorCoz, hazirMi, motorOrtami, codexTaslak, codexAnahtarGirisi } from './cekirdek/motor.js';
import { AnahtarDeposu } from './cekirdek/anahtarlar.js';
import { mcpIsle } from './cekirdek/mcp.js';
import { Guncelleyici } from './cekirdek/guncelleme.js';
import { testAraclari, TEST_ARAC_ADLARI, testDurumu, iosAc, iosKapat, iosGoruntu, androidBaslat, androidGoruntu } from './cekirdek/test-alani.js';
import { ghBul, gitBul, ghDurum, ghGirisArg, ghKurulumKomutu, repoDurumu, klasorAdi, repoListesi, repoKlonla, yeniProje, gitIslem } from './cekirdek/github.js';
import { sesListesi, sesUret, yaziyaCevir } from './cekirdek/ses.js';
import { beyinAraclari, beyinTalimati, MCP_ADI } from './cekirdek/beyin.js';
import { sablonBul } from './cekirdek/sablonlar.js';
import { ODA_SABLONLARI, odaSablonu } from './cekirdek/odalar.js';
import { TarayiciOdasi } from './cekirdek/tarayici.js';
import { tarayiciAraclari, ONAYSIZ_ARACLAR, ONAYLI_ARACLAR } from './cekirdek/tarayici-araclari.js';
import { sade } from './cekirdek/kimlik.js';
import { Oturum } from './cekirdek/oturum.js';
import { SABLONLAR } from './cekirdek/sablonlar.js';
import * as taslak from './cekirdek/taslak.js';
import { KayitDefteri, olaydanKayit, devirOzeti, durumCikar } from './cekirdek/kayit.js';
import { MOTOR, cevirici } from './cekirdek/dil.js';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const SINAMA = !!process.env.AJAN_OFIS_EKRAN;

// Sınamalarda veri klasörü ayrı tutulur
if (process.env.AJAN_OFIS_VERI) app.setPath('userData', process.env.AJAN_OFIS_VERI);

let pencere = null;
let depo = null;
let skiller = null;
let ortam = null;
let claude = null;
let codex = null;
const girisler = { claude: null, codex: null };
let codexListe = [];
const github = { yol: null, git: null, durum: { girisli: false } };
let anahtarlar = null;
let port = 0;
let kancaAnahtari = '';
let sunucuHata = null;
let kayit = null;
let oda = null;
let guncelleyici = null;
let guncellemePenceresi = null;
let yenilikler = null;

protocol.registerSchemesAsPrivileged([{ scheme: 'ofis', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const gonder = (kanal, veri) => {
  if (pencere && !pencere.isDestroyed()) pencere.webContents.send(kanal, veri);
};

// Seçili katın görünümü: arayüz ve derleyici şirketi hep böyle görür
const gorunum = (projeId) => katGorunumu(depo.veri, depo.proje(projeId || depo.veri.sonProje));

// ---------- katlar ----------
// Her katın (projenin) kendi oturumu, canlı durumu ve konuşma geçmişi vardır. Katlar aynı anda çalışabilir.
// Anahtar proje kimliğidir. "giris" anahtarı abonelik girişi için açılan geçici terminaldir.
const katlar = new Map();

function katAl(anahtar) {
  let k = katlar.get(anahtar);
  if (k) return k;
  k = { anahtar, durum: yeniDurum(), sohbet: [], sonGonderilen: -1, duz: '' };
  k.oturum = new Oturum({
    veri: (d) => {
      gonder('pty:veri', { kat: anahtar, d });
      k.sonCikti = Date.now();
      kesmeIzle(k, d);
      terminalIzle(k, d);
    },
    cikis: (kod, bilgi) => oturumBitti(k, kod, bilgi),
  });
  if (anahtar !== 'giris') sirketAyarla(k.durum, katGorunum(k));
  katlar.set(anahtar, k);
  return k;
}

// Beynin görünümü: konuşmada ve olaylarda "şef" beynin kendisidir, ekibi yoktur
const beyinGorunumu = () => ({ ...depo.veri, sef: { ...depo.veri.sef, ad: depo.veri.beyin.ad, unvan: depo.veri.dil === 'en' ? 'Brain' : 'Beyin' }, ajanlar: [], katId: 'beyin' });
const katGorunum = (k) => (k.anahtar === 'beyin' ? beyinGorunumu() : k.anahtar.startsWith('ozel:') ? ozelGorunumu(k.anahtar) : gorunum(k.anahtar !== 'giris' ? k.anahtar : null));

function oturumBilgi(k) {
  if (!k) return { acik: false };
  const temel = { kat: k.anahtar, bekleyen: bekleyenSayisi(k.sohbet) };
  return k.oturum.acik ? { acik: true, ...temel, ...k.oturum.bilgi } : { acik: false, ...temel };
}

function oturumlarBilgi() {
  const o = {};
  for (const [a, k] of katlar) o[a] = oturumBilgi(k);
  return o;
}

const oturumlariYayinla = () => gonder('oturum', oturumlarBilgi());

function durumGonder(k, zorla = false) {
  if (!zorla && k.durum.surum === k.sonGonderilen) return;
  k.sonGonderilen = k.durum.surum;
  gonder('durum', { kat: k.anahtar, ...goruntu(k.durum) });
}

function sohbetGonder(k) {
  gonder('sohbet', { kat: k.anahtar, liste: k.sohbet });
  oturumlariYayinla();
}

function sirketYayinla() {
  for (const k of katlar.values()) {
    if (k.anahtar === 'giris') continue;
    sirketAyarla(k.durum, katGorunum(k));
    durumGonder(k, true);
  }
  gonder('sirket', gorunum());
}

// İstem Esc ile kesilince motor Stop olayı göndermez: terminaldeki "interrupted" yazısından anlaşılır
function kesmeIzle(k, d) {
  const b = k.oturum.bilgi;
  if (!b || !b.mesgul) return;
  k.kesme = ((k.kesme || '') + duzMetin(d)).slice(-400);
  if (!k.kesme.includes('interrupted')) return;
  k.kesme = '';
  b.mesgul = false;
  kutuyuGonder(k);
}

// Terminalde olay üretmeyen ama sahibin cevabını bekleyen ekranlar: şimdilik klasör güveni
function terminalIzle(k, d) {
  const b = k.oturum.bilgi;
  if (!b || b.giris || b.guvenSoruldu) return;
  k.duz = (k.duz + duzMetin(d)).slice(-3000);
  if (!guvenSorusuMu(b.motor, k.duz)) return;
  b.guvenSoruldu = true;
  k.sohbet.push({ id: 'g' + Date.now().toString(36), z: Date.now(), kim: 'sistem', ad: '', tur: 'onay', arac: 'guven', metin: b.proje || '', acik: true });
  sohbetGonder(k);
}

function oturumBitti(k, kod, bilgi) {
  if (bilgi && bilgi.giris) {
    // giriş penceresi kapandı: giriş durumunu yeniden oku
    motorlarYenile().catch(() => {});
  } else if (bilgi && bilgi.beyin) {
    oturumKapat(k.durum, bilgi.oturumId);
  } else if (bilgi) {
    oturumKapat(k.durum, bilgi.oturumId);
    try {
      kayit.ekle(bilgi.projeId, { tur: 'oturum', metin: 'bitti', oturum: bilgi.oturumId });
      gonder('kayit', { projeId: bilgi.projeId });
    } catch {
      /* proje silinmiş olabilir */
    }
  }
  durumGonder(k, true);
  gonder('pty:cikis', { kat: k.anahtar, kod });
  oturumlariYayinla();
}

function kuruluSkiller() {
  const kapali = new Set(depo.veri.kapaliSkiller);
  return skiller.liste().map((s) => ({ id: s.id, ad: s.ad, aciklama: s.aciklama, lisans: s.lisans, kaynak: s.kaynak, kurulum: s.kurulum, etkin: !kapali.has(s.id) }));
}

function baslangic() {
  return {
    sirket: gorunum(),
    skiller: kuruluSkiller(),
    katalog: katalogOku(),
    sablonlar: SABLONLAR,
    odaSablonlari: ODA_SABLONLARI,
    oturumlar: oturumlarBilgi(),
    guncelleme: guncelleyici ? { ...guncelleyici.durum } : null,
    yenilikler,
    bilgi: {
      surum: app.getVersion(),
      platform: process.platform,
      veriKlasoru: app.getPath('userData'),
      claude,
      kurulumKomutu: kurulumKomutu(),
      motorlar: motorBilgi(),
      github: { var: !!github.yol, ...github.durum, kurulum: ghKurulumKomutu() },
      sunucuHata,
      masaSayisi: MASA_SAYISI,
    },
  };
}

async function claudeYenile() {
  claude = await claudeBul(ortam, depo.veri.claudeYolu);
  return claude;
}

// ---------- motorlar ----------
const durumlar = () => ({ claude: claude && { ...claude, giris: girisler.claude }, codex: codex && { ...codex, giris: girisler.codex } });
const codexApiKlasoru = () => path.join(app.getPath('userData'), 'codex-api');

function codexModelCoz() {
  const v = codexVarsayilan(codexListe);
  const m = depo.veri.modeller.codex;
  return { koordinator: m.koordinator || v.koordinator, calisan: m.calisan || v.calisan };
}

function motorBilgi() {
  const d = durumlar();
  const anahtarVar = anahtarlar ? anahtarlar.durum() : { claude: false, codex: false, elevenlabs: false };
  const secilen = depo ? motorCoz(depo.veri, d, anahtarVar) : null;
  return {
    claude: d.claude,
    codex: d.codex,
    anahtarVar,
    sifreliDepo: anahtarlar ? anahtarlar.kullanilabilir() : false,
    secilen,
    hazir: secilen ? hazirMi(secilen, depo.veri, d, anahtarVar) : false,
    codexModeller: codexListe,
    codexVarsayilan: codexVarsayilan(codexListe),
    kurulum: kurulumKomutlari(),
  };
}

// Kurulu araçları ve abonelik girişlerini yeniden okur. Abonelik durumu okunurken ortamdaki anahtar çıkarılır.
async function motorlarYenile() {
  const [c, x] = await Promise.all([claudeBul(ortam, depo.veri.claudeYolu), codexBul(ortam, depo.veri.codexYolu)]);
  claude = c;
  codex = x;
  const temiz = (motor) => motorOrtami(motor, { giris: { [motor]: 'abonelik' } }, ortam, '');
  const [gc, gx] = await Promise.all([claude ? girisDurumu('claude', claude.yol, temiz('claude')) : null, codex ? girisDurumu('codex', codex.yol, temiz('codex')) : null]);
  girisler.claude = gc;
  girisler.codex = gx;
  github.yol = ghBul(ortam);
  github.git = gitBul(ortam);
  github.durum = await ghDurum(github.yol, ortam);
  codexListe = codexModelleri(codexKlasoru(ortam));
  if (!codexListe.length) codexListe = codexModelleri(codexApiKlasoru());
  gonder('bilgi', baslangic().bilgi);
  return motorBilgi();
}

// ---------- masaüstü bildirimi ----------
// Pencere öndeyken bildirim çıkmaz. Aynı türden bildirimler arka arkaya yağmaz.
const sonBildirim = new Map();
function masaustuBildir(tur, baslik, govde) {
  if (!depo.veri.bildirim || SINAMA || !Notification.isSupported()) return;
  if (pencere && !pencere.isDestroyed() && pencere.isFocused()) return;
  const z = Date.now();
  if (z - (sonBildirim.get(tur) || 0) < 4000) return;
  sonBildirim.set(tur, z);
  const b = new Notification({ title: baslik, body: String(govde || '').replace(/\s+/g, ' ').slice(0, 220), silent: false });
  b.on('click', () => {
    if (!pencere) return;
    if (pencere.isMinimized()) pencere.restore();
    pencere.show();
    pencere.focus();
  });
  b.show();
}

function olaydanBildir(ev, kat) {
  const t = cevirici(MOTOR, depo.veri.dil);
  const sef = kat.sef.ad;
  const kim = ev.agent_id ? (kat.ajanlar.find((a) => a.id === String(ev.agent_type || '').replace(/^.*:/, '')) || {}).ad || sef : sef;
  switch (ev.hook_event_name) {
    case 'Stop':
      if (!ev.agent_id) masaustuBildir('bitti', t('bildirim.bitti', { x: sef }), ev.last_assistant_message);
      break;
    case 'PermissionRequest':
      masaustuBildir('onay', t('bildirim.onay', { x: kim }), (ev.tool_input && (ev.tool_input.description || ev.tool_input.command || ev.tool_input.file_path)) || ev.tool_name);
      break;
    case 'StopFailure':
      masaustuBildir('hata', t('bildirim.hata', { x: sef }), ev.error_details || ev.error);
      break;
  }
}

// Geliştirici aracı: AJAN_OFIS_OLAY_KAYDI bir dosya yolu ise gelen ham olaylar oraya satır satır yazılır.
// Olaylar etiketle gelir: etiket, olayı gönderen oturumun uygulamadaki kimliğidir. Kapanmış oturumdan gelen geç olay atılır.
function olayGeldi(ev, etiket = '') {
  const ham = process.env.AJAN_OFIS_OLAY_KAYDI;
  if (ham) fs.appendFile(ham, JSON.stringify(ev) + '\n', () => {});
  if (!etiket) return;
  const k = [...katlar.values()].find((x) => x.oturum.acik && x.oturum.bilgi && x.oturum.bilgi.oturumId === etiket);
  if (!k) return;
  const b = k.oturum.bilgi;
  // Codex oturum kimliğini kendisi üretir: sürdürmek için ilk olaydan alınır
  if (b.motor === 'codex' && !b.codexOturum && typeof ev.session_id === 'string' && /^[0-9a-f-]{36}$/.test(ev.session_id)) {
    b.codexOturum = ev.session_id;
    if (b.projeId) {
      depo.projeKaydet({ id: b.projeId, sonOturum: ev.session_id, sonMotor: 'codex' });
      gonder('sirket', gorunum());
    } else if (b.ozel) {
      depo.guncelle({ ozelOturumlar: { ...depo.veri.ozelOturumlar, [`${b.katId}:${b.ajanId}`]: { oturum: ev.session_id, motor: 'codex' } } });
    }
  }
  ev = { ...ev, session_id: etiket };
  mesguliyetIzle(k, ev);
  const kat = katGorunum(k);
  // beynin kayıt defteri yoktur, katların defteri vardır
  if (b.projeId) {
    try {
      const kd = olaydanKayit(ev, kat);
      if (kd && kayit.ekle(b.projeId, { ...kd, oturum: b.oturumId })) gonder('kayit', { projeId: b.projeId });
    } catch {
      /* kayıt yazılamadıysa oturum yine de sürer */
    }
  }
  olaydanBildir(ev, kat);
  if (sohbetIsle(k.sohbet, codexUyarla(ev), kat)) sohbetGonder(k);
  if (b.projeId) beyneIlet(k, ev, kat);
  if (olayIsle(k.durum, ev)) durumGonder(k);
}

// Kat → beyin: beynin bir işi verdiği katta şef işini bitirince, soru sorunca ya da onay bekleyince
// beyne kendiliğinden haber verilir. Beyin cevabı görmek için katı yoklamak zorunda kalmaz.
const beyinBekleyen = new Map(); // kat kimliği -> beynin mesajı gönderdiği an
function beyneIlet(k, ev, kat) {
  const beyin = katlar.get('beyin');
  if (!beyin || !beyin.oturum.acik || !beyinBekleyen.has(k.anahtar) || ev.agent_id) return;
  const ad = `${kat.sef.ad} · ${depo.proje(k.anahtar)?.ad || ''}`;
  let metin = '';
  if (ev.hook_event_name === 'Stop' && ev.last_assistant_message) {
    metin = `[Kat: ${ad}] İşi bitirdi ve şunu yazdı:\n${String(ev.last_assistant_message).slice(0, 4000)}`;
    beyinBekleyen.delete(k.anahtar);
  } else if (ev.hook_event_name === 'PermissionRequest') {
    metin = `[Kat: ${ad}] Sahibin onayını bekliyor: ${ev.tool_name || ''}. Sahibe söyle, onayı katın konuşma panelinden verebilir.`;
  } else if (ev.hook_event_name === 'PreToolUse' && ev.tool_name === 'AskUserQuestion') {
    const q = (ev.tool_input && Array.isArray(ev.tool_input.questions) ? ev.tool_input.questions : []).map((x) => x.question).filter(Boolean).join(' / ');
    metin = `[Kat: ${ad}] Sahibe soru soruyor: ${q.slice(0, 800)}. Sahibe ilet, cevabını kat_sefine_yaz ile gönder.`;
  }
  if (metin) oturumaYaz(beyin, metin).catch(() => {});
}

function kayitOku(projeId) {
  const kayitlar = kayit.oku(String(projeId));
  return { kayitlar: kayitlar.slice(-250), durum: durumCikar(kayitlar) };
}

// ---------- oturum ----------
async function oturumBaslat({ projeId, surdur, sutun, satir }) {
  projeId = String(projeId || '');
  if (katlar.get(projeId)?.oturum.acik) return { hata: 'acik' };
  if (sunucuHata) return { hata: 'sunucu', ayrinti: sunucuHata };
  if (!claude && !codex) await motorlarYenile();
  const sirket = gorunum(String(projeId || ''));
  const motor = motorCoz(sirket, durumlar(), anahtarlar.durum());
  if (!motor) return { hata: sirket.motor === 'otomatik' ? 'motorYok' : sirket.motor === 'codex' ? 'codexYok' : 'claudeYok' };
  const yol = motor === 'claude' ? claude.yol : codex.yol;
  const apiModu = sirket.giris[motor] === 'api';
  const anahtar = apiModu ? anahtarlar.al(motor) : '';
  if (apiModu && !anahtar) return { hata: 'anahtarYok' };
  const proje = depo.proje(String(projeId || ''));
  if (!proje) return { hata: 'projeYok' };
  if (proje.tur === 'kisisel') return { hata: 'kisiselKat' };
  let klasor;
  try {
    klasor = path.resolve(proje.klasor);
    if (!proje.klasor || !fs.statSync(klasor).isDirectory()) throw new Error('klasör değil');
  } catch {
    return { hata: 'klasorYok' };
  }
  // Sürdürme: eski konuşma olduğu gibi geri gelir. Yeni oturum: yalnızca kısa devir notu verilir.
  // Bir motorun oturumu öbür motorla sürdürülemez.
  const eski = surdur && proje.sonOturum && proje.sonMotor === motor ? proje.sonOturum : '';
  const devir = eski ? '' : devirOzeti(kayit.oku(proje.id), sirket.dil);
  const kapali = new Set(sirket.kapaliSkiller);
  const etkin = skiller.liste().filter((s) => !kapali.has(s.id));
  // Uygulamanın kendi oturum kimliği: olaylar bu etiketle gelir. Claude'da oturum kimliğiyle aynıdır.
  const oturumId = motor === 'claude' && eski ? eski : crypto.randomUUID();
  let cikti;
  try {
    // her katın derlemesi ayrı klasörde: açık bir katın dosyaları başka katın derlemesiyle ezilmez
    cikti = derle(sirket, { hedef: path.join(app.getPath('userData'), 'calisma', proje.id), skiller: etkin, port, anahtar: kancaAnahtari, etiket: oturumId, proje, devir, motor, codexModel: motor === 'codex' ? codexModelCoz() : null });
  } catch (e) {
    return { hata: 'derleme', ayrinti: String(e.message || e) };
  }
  const env = motorOrtami(motor, sirket, ortam, anahtar, { codexApiKlasoru: codexApiKlasoru() });
  let arg;
  if (motor === 'claude') {
    arg = [...oturumArgumanlari(sirket, { ...cikti, oturumId, surdur: eski, ad: `${sirket.ad} · ${proje.ad}` }), ...mcpBayraklari('claude', { adres: mcpAdresi() + '/' + proje.id, hedef: path.join(app.getPath('userData'), 'calisma', proje.id) })];
    env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = sirket.takimModu ? '1' : '0';
  } else {
    if (apiModu) {
      try {
        await codexAnahtarGirisi({ yol, env: ortam, klasor: codexApiKlasoru(), anahtar, iz: crypto.createHash('sha256').update(anahtar).digest('hex') });
      } catch (e) {
        return { hata: 'anahtarGiris', ayrinti: String(e.message || e) };
      }
    }
    arg = [...codexArgumanlari(sirket, cikti, { klasor, surdur: eski }), ...mcpBayraklari('codex', { adres: mcpAdresi() + '/' + proje.id })];
  }
  const k = katAl(proje.id);
  k.sohbet.length = 0;
  try {
    k.oturum.baslat({ yol, arg, cwd: klasor, env, sutun, satir, bilgi: { oturumId, motor, codexOturum: motor === 'codex' && eski ? eski : '', projeId: proje.id, projeAd: proje.ad, proje: klasor, surdurulen: !!eski, devirVar: !!devir, baslangic: Date.now() } });
  } catch (e) {
    return { hata: 'baslatma', ayrinti: String(e.message || e) };
  }
  depo.projeKaydet(motor === 'claude' ? { id: proje.id, sonOturum: oturumId, sonMotor: 'claude', sonAcilis: Date.now() } : { id: proje.id, sonAcilis: Date.now() });
  depo.guncelle({ sonProje: proje.id });
  gonder('sirket', gorunum());
  kayit.ekle(proje.id, { tur: 'oturum', metin: eski ? 'surduruldu' : 'basladi', oturum: oturumId });
  gonder('kayit', { projeId: proje.id });
  sirketAyarla(k.durum, sirket);
  oturumAc(k.durum, { oturumId, cwd: klasor });
  durumGonder(k, true);
  sohbetGonder(k);
  return { tamam: true, ...oturumBilgi(k), komut: [yol, ...arg] };
}

// Abonelik girişi: aracın kendi giriş akışı gömülü terminalde açılır. Uygulama giriş bilgisini görmez.
function girisBaslat({ motor, sutun, satir }) {
  const k = katAl('giris');
  if (k.oturum.acik) return { hata: 'acik' };
  // GitHub girişi: gh kendi tarayıcı akışını açar, terminalde tek kullanımlık kod gösterir
  if (motor === 'github') {
    if (!github.yol) return { hata: 'ghYok' };
    try {
      k.oturum.baslat({ yol: github.yol, arg: ghGirisArg, cwd: app.getPath('home'), env: { ...ortam }, sutun, satir, bilgi: { giris: true, motor: 'github', baslangic: Date.now() } });
    } catch (e) {
      return { hata: 'baslatma', ayrinti: String(e.message || e) };
    }
    oturumlariYayinla();
    return { tamam: true, ...oturumBilgi(k) };
  }
  if (!MOTORLAR.includes(motor)) return { hata: 'genel' };
  const arac = motor === 'claude' ? claude : codex;
  if (!arac) return { hata: motor === 'claude' ? 'claudeYok' : 'codexYok' };
  const env = motorOrtami(motor, { giris: { [motor]: 'abonelik' } }, ortam, '');
  try {
    k.oturum.baslat({ yol: arac.yol, arg: girisKomutu(motor), cwd: app.getPath('home'), env, sutun, satir, bilgi: { giris: true, motor, baslangic: Date.now() } });
  } catch (e) {
    return { hata: 'baslatma', ayrinti: String(e.message || e) };
  }
  oturumlariYayinla();
  return { tamam: true, ...oturumBilgi(k) };
}

// ---------- beyin ----------
const beyinKlasoru = () => path.join(app.getPath('userData'), 'beyin');
const mcpAdresi = () => `http://127.0.0.1:${port}/mcp/${kancaAnahtari}`;

async function beyinBaslat({ sutun, satir }) {
  const k = katAl('beyin');
  if (k.oturum.acik) return { hata: 'acik' };
  if (sunucuHata) return { hata: 'sunucu', ayrinti: sunucuHata };
  if (!claude && !codex) await motorlarYenile();
  const sirket = beyinGorunumu();
  const motor = motorCoz(sirket, durumlar(), anahtarlar.durum());
  if (!motor) return { hata: sirket.motor === 'otomatik' ? 'motorYok' : sirket.motor === 'codex' ? 'codexYok' : 'claudeYok' };
  const yol = motor === 'claude' ? claude.yol : codex.yol;
  const apiModu = sirket.giris[motor] === 'api';
  const anahtar = apiModu ? anahtarlar.al(motor) : '';
  if (apiModu && !anahtar) return { hata: 'anahtarYok' };
  const klasor = beyinKlasoru();
  fs.mkdirSync(klasor, { recursive: true });
  const oturumId = crypto.randomUUID();
  const hedef = path.join(app.getPath('userData'), 'calisma', 'beyin');
  let cikti;
  try {
    cikti = derle(sirket, { hedef, skiller: [], port, anahtar: kancaAnahtari, etiket: oturumId, motor, codexModel: motor === 'codex' ? codexModelCoz() : null });
  } catch (e) {
    return { hata: 'derleme', ayrinti: String(e.message || e) };
  }
  // beynin talimatı şef talimatının yerine geçer
  const talimat = beyinTalimati(depo.veri);
  const env = motorOrtami(motor, sirket, ortam, anahtar, { codexApiKlasoru: codexApiKlasoru() });
  let arg;
  if (motor === 'claude') {
    fs.writeFileSync(cikti.sefDosya, talimat);
    arg = [...oturumArgumanlari(sirket, { ...cikti, oturumId, ad: `${sirket.ad} · ${sirket.beyin.ad}` }), ...mcpBayraklari('claude', { adres: mcpAdresi(), hedef, beyin: true })];
  } else {
    if (apiModu) {
      try {
        await codexAnahtarGirisi({ yol, env: ortam, klasor: codexApiKlasoru(), anahtar, iz: crypto.createHash('sha256').update(anahtar).digest('hex') });
      } catch (e) {
        return { hata: 'anahtarGiris', ayrinti: String(e.message || e) };
      }
    }
    arg = [...codexArgumanlari(sirket, { ...cikti, talimat }, { klasor }), ...mcpBayraklari('codex', { adres: mcpAdresi(), hedef, beyin: true })];
  }
  k.sohbet.length = 0;
  try {
    k.oturum.baslat({ yol, arg, cwd: klasor, env, sutun, satir, bilgi: { oturumId, motor, beyin: true, proje: klasor, baslangic: Date.now() } });
  } catch (e) {
    return { hata: 'baslatma', ayrinti: String(e.message || e) };
  }
  sirketAyarla(k.durum, sirket);
  oturumAc(k.durum, { oturumId, cwd: klasor });
  durumGonder(k, true);
  sohbetGonder(k);
  return { tamam: true, ...oturumBilgi(k) };
}

// ---------- oturuma yazma ----------
// Motora metin göndermenin tek yolu terminaline yazmaktır. Yanlış anda yazılan metin kutuda kalır ya da açık bir
// izin sorusunun cevabı olur. Bu yüzden metinler sıraya girer ve yalnızca motor boştayken gönderilir:
// UserPromptSubmit gelince motor meşguldür, Stop gelince boşa çıkar ve sıradaki metin gönderilir.
// Enter, terminal yapıştırılan metni çizmeyi bitirince basılır. Gönderimi motorun UserPromptSubmit olayı doğrular.
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

function oturumaYaz(k, metin) {
  const veri = terminaleMetin(metin);
  if (!veri) return Promise.resolve();
  if (!k.oturum.acik) return Promise.reject(new Error('Oturum kapandı'));
  return new Promise((coz, red) => {
    (k.kutu ||= []).push({ veri, coz, red });
    kutuyuGonder(k);
  });
}

// Terminal çıktısı belli bir süre durgun kalana kadar bekler: motor ekranı çizmeyi bitirmiştir
async function cizimBitsin(k, durgun, sinir) {
  const bas = Date.now();
  while (Date.now() - bas < sinir && Date.now() - (k.sonCikti || 0) < durgun) await bekle(50);
}

function istemBekle(k, sinir) {
  return new Promise((coz) => {
    const z = setTimeout(() => ((k.istemBekleyen = null), coz(false)), sinir);
    k.istemBekleyen = () => (clearTimeout(z), (k.istemBekleyen = null), coz(true));
  });
}

// Motor boşta mı: açık bir istem yok, klasör güveni sorusu açık değil, ilk açılışta ekran çizilmiş
function oturumBosta(k) {
  const b = k.oturum.bilgi || {};
  if (b.mesgul) return false;
  if (k.sohbet.some((m) => m.arac === 'guven' && m.acik)) return false;
  return Date.now() - (b.baslangic || 0) > 2500 && Date.now() - (k.sonCikti || 0) > 800;
}

async function kutuyuGonder(k) {
  if (k.gonderiyor) return;
  k.gonderiyor = true;
  try {
    while (k.kutu && k.kutu.length) {
      if (!k.oturum.acik) {
        for (const m of k.kutu.splice(0)) m.red(new Error('Oturum kapandı'));
        return;
      }
      if (!oturumBosta(k)) {
        // meşgulse Stop olayı kutuyu yeniden çalıştırır; ilk açılışta ekranın çizilmesi beklenir
        if (!(k.oturum.bilgi || {}).mesgul) setTimeout(() => kutuyuGonder(k), 500);
        return;
      }
      const m = k.kutu.shift();
      k.oturum.yaz(m.veri);
      await cizimBitsin(k, 250, 4000);
      let alindi = istemBekle(k, 4000);
      k.oturum.yaz('\r');
      // Enter çizimin son anına denk gelip kaybolduysa metin kutuda durur; motor almadığını bildirmiş olur
      if (!(await alindi) && k.oturum.acik && !(k.oturum.bilgi || {}).mesgul) {
        await cizimBitsin(k, 250, 2000);
        alindi = istemBekle(k, 4000);
        k.oturum.yaz('\r');
        await alindi;
      }
      m.coz();
    }
  } finally {
    k.gonderiyor = false;
  }
}

// Motor olaylarından meşguliyet: kat ana oturumunun istemi başlar ve biter (alt ajanların Stop'u sayılmaz)
function mesguliyetIzle(k, ev) {
  const b = k.oturum.bilgi;
  if (!b) return;
  if (ev.hook_event_name === 'UserPromptSubmit') {
    b.mesgul = true;
    k.kesme = '';
    if (k.istemBekleyen) k.istemBekleyen();
  } else if ((ev.hook_event_name === 'Stop' || ev.hook_event_name === 'StopFailure') && !ev.agent_id) {
    b.mesgul = false;
    kutuyuGonder(k);
  }
}

const beyinIslemleri = {
  dil: () => depo.veri.dil,
  katlar: () =>
    depo.veri.projeler.map((p) => {
      const k = katlar.get(p.id);
      return {
        kat_id: p.id,
        ad: p.ad,
        tur: p.tur,
        klasor: p.klasor,
        aciklama: p.aciklama,
        sef: p.sef.ad,
        ekip: p.ajanlar.map((a) => (a.unvan ? `${a.ad} (${a.unvan})` : a.ad)),
        oturum_acik: !!(k && k.oturum.acik),
        bekleyen: k ? bekleyenSayisi(k.sohbet) : 0,
      };
    }),
  katKlasoru: (id) => {
    const p = depo.proje(id);
    if (!p) throw new Error('Kat bulunamadı: ' + id);
    return p.klasor;
  },
  katKur: ({ klasor, ad, aciklama }) => {
    // klasör verilmezse ya da yalnızca ad verilirse projeler klasörünün altına açılır
    if (!klasor || !path.isAbsolute(klasor)) {
      const k = klasorAdi(klasor || ad);
      if (!k) throw new Error('Klasörün tam yolunu ya da katın adını ver');
      klasor = path.join(projeKoku(), k);
    }
    const tam = path.resolve(klasor);
    fs.mkdirSync(tam, { recursive: true });
    const onceki = depo.veri.projeler.find((p) => p.klasor === tam);
    let p = depo.projeKlasorden(tam);
    const yama = {};
    if (ad) yama.ad = ad;
    if (aciklama) yama.aciklama = aciklama;
    if (Object.keys(yama).length) p = depo.projeKaydet({ id: p.id, ...yama });
    if (!depo.veri.sonProje) depo.guncelle({ sonProje: p.id });
    sirketYayinla();
    return { kat_id: p.id, ad: p.ad, klasor: p.klasor, yeni: !onceki, sef: p.sef.ad, ekip: p.ajanlar.map((a) => a.ad) };
  },
  ekipKur: (katId, sef, uyeler) => {
    if (!depo.proje(katId)) throw new Error('Kat bulunamadı: ' + katId);
    if (sef && (sef.ad || sef.unvan)) depo.sefKaydet({ ...(sef.ad ? { ad: String(sef.ad) } : {}), ...(sef.unvan ? { unvan: String(sef.unvan) } : {}) }, katId);
    for (const u of uyeler.slice(0, 10)) {
      if (!u || !u.ad) continue;
      const sablon = u.sablon ? sablonBul(String(u.sablon)) : null;
      const taban = sablon ? { ...(sablon[depo.veri.dil] || sablon.tr), renk: sablon.renk, gorunus: sablon.gorunus, esya: sablon.esya } : {};
      const mevcut = depo.proje(katId).ajanlar.find((a) => sade(a.ad) === sade(u.ad));
      const tanim = { ...taban, ad: String(u.ad) };
      for (const alan of ['unvan', 'cagri', 'talimat']) if (u[alan]) tanim[alan] = String(u[alan]);
      if (Array.isArray(u.alanlar) && u.alanlar.length) tanim.alanlar = u.alanlar.map(String);
      depo.ajanKaydet(mevcut ? { ...tanim, id: mevcut.id } : tanim, katId);
    }
    sirketYayinla();
    const p = depo.proje(katId);
    return { kat_id: p.id, sef: `${p.sef.ad} (${p.sef.unvan})`, ekip: p.ajanlar.map((a) => `${a.ad} (${a.unvan})`) };
  },
  klonla: async (repo) => {
    const p = await klonKat(String(repo));
    return { kat_id: p.id, ad: p.ad, klasor: p.klasor };
  },
  projeKoku: () => projeKoku(),
  kisiselKat: () => {
    const p = kisiselKatKur();
    return { kat_id: p.id, ad: p.ad, tur: p.tur, ekip: p.ajanlar.map((a) => a.ad) };
  },
  oturumBaslat: async (katId) => {
    if (depo.proje(katId)?.tur === 'kisisel') throw new Error('Kişisel katta şef ve kat oturumu yoktur. Oradaki kişilerle sahip kendi odalarında özel konuşur.');
    if (katlar.get(katId)?.oturum.acik) return 'Kat oturumu zaten açık.';
    const r = await oturumBaslat({ projeId: katId, sutun: 120, satir: 36 });
    if (!r || r.hata) throw new Error('Kat oturumu başlatılamadı: ' + ((r && (r.ayrinti || r.hata)) || ''));
    return 'Kat oturumu başladı. Kat ilk kez açılıyorsa sahibin klasör güveni onayı gerekebilir, kat_sohbeti ile kontrol et.';
  },
  sefeYaz: async (katId, mesaj) => {
    if (depo.proje(katId)?.tur === 'kisisel') throw new Error('Kişisel katın şefi yoktur.');
    const k = katlar.get(katId);
    if (!k || !k.oturum.acik) throw new Error('Kat oturumu kapalı. Önce kat_oturumunu_baslat çağır.');
    if (k.sohbet.some((m) => m.acik && m.arac === 'guven')) throw new Error('Kat, sahibin klasör güveni onayını bekliyor. Sahibe o katın konuşma panelinden onay vermesini söyle.');
    const mesgul = !!(k.oturum.bilgi || {}).mesgul;
    oturumaYaz(k, `[${depo.veri.beyin.ad}] ${mesaj}`).catch(() => {});
    beyinBekleyen.set(katId, Date.now());
    return (mesgul ? 'Şef şu an çalışıyor: mesajın sıraya alındı, elindeki işi bitirince ona iletilecek. ' : 'Mesaj kat şefine iletildi.') + ' Şef işi bitirince, soru sorunca ya da onay beklerken sana kendiliğinden "[Kat: ...]" diye başlayan bir mesajla haber gelecek. Beklerken katı yoklama, başka işine devam et.';
  },
  sohbet: (katId, son) => {
    const p = depo.proje(katId);
    if (!p) throw new Error('Kat bulunamadı: ' + katId);
    const k = katlar.get(katId);
    const liste = k ? k.sohbet.slice(-son) : [];
    return {
      kat: p.ad,
      oturum_acik: !!(k && k.oturum.acik),
      bekleyen: liste.filter((m) => m.acik).map((m) => ({ tur: m.tur, kim: m.ad, metin: m.metin })),
      mesajlar: liste.map((m) => ({ zaman: new Date(m.z).toISOString(), kim: m.kim === 'sen' ? 'sahip ya da beyin' : m.ad || m.kim, tur: m.tur, metin: m.metin, acik: m.acik })),
    };
  },
};

// ---------- özel sohbet ve kişisel kat ----------
// Özel sohbet anahtarı "ozel:<kat>:<ajan>". Konuşma beyne ve şefe görünmez, kayıt defterine yazılmaz.
const ozelAnahtar = (katId, ajanId) => `ozel:${katId}:${ajanId}`;
function ozelCoz(anahtar) {
  const m = /^ozel:([a-z0-9]{6,20}):([a-z0-9][a-z0-9-]{0,39})$/.exec(String(anahtar || ''));
  return m ? { katId: m[1], ajanId: m[2] } : null;
}

// Özel sohbetin görünümü: konuşmadaki "şef" sohbet edilen kişidir
function ozelGorunumu(anahtar) {
  const o = ozelCoz(anahtar);
  const p = o && depo.proje(o.katId);
  const a = p && p.ajanlar.find((x) => x.id === o.ajanId);
  const taban = gorunum(o ? o.katId : null);
  return { ...taban, sef: a ? { ...taban.sef, ad: a.ad, unvan: a.unvan, renk: a.renk, gorunus: a.gorunus } : taban.sef, ajanlar: [], katId: anahtar };
}

async function ozelBaslat({ katId, ajanId, surdur, sutun, satir }) {
  const anahtar = ozelAnahtar(String(katId || ''), String(ajanId || ''));
  const o = ozelCoz(anahtar);
  const p = o && depo.proje(o.katId);
  const ajan = p && p.ajanlar.find((x) => x.id === o.ajanId);
  if (!ajan) return { hata: 'ajanYok' };
  const k = katAl(anahtar);
  if (k.oturum.acik) return { hata: 'acik' };
  if (sunucuHata) return { hata: 'sunucu', ayrinti: sunucuHata };
  if (!claude && !codex) await motorlarYenile();
  const sirket = ozelGorunumu(anahtar);
  const motor = motorCoz(sirket, durumlar(), anahtarlar.durum());
  if (!motor) return { hata: sirket.motor === 'otomatik' ? 'motorYok' : sirket.motor === 'codex' ? 'codexYok' : 'claudeYok' };
  const yol = motor === 'claude' ? claude.yol : codex.yol;
  const apiModu = sirket.giris[motor] === 'api';
  const anahtarDeger = apiModu ? anahtarlar.al(motor) : '';
  if (apiModu && !anahtarDeger) return { hata: 'anahtarYok' };
  // her kişinin kendi odası (klasörü): proje klasörüne dokunulmaz
  const klasor = odaHazirla(o.katId, o.ajanId);
  const calisma = ajan.mod === 'calisma';
  const kayitli = depo.veri.ozelOturumlar[`${o.katId}:${o.ajanId}`];
  const eski = surdur && kayitli && kayitli.motor === motor ? kayitli.oturum : '';
  const oturumId = motor === 'claude' && eski ? eski : crypto.randomUUID();
  const hedef = path.join(app.getPath('userData'), 'calisma', 'ozel-' + o.katId + '-' + o.ajanId);
  // kişinin kendi modeli, yoksa çalışan modeli
  const modelli = { ...sirket, sef: { ...sirket.sef, model: ajan.model || sirket.modeller.claude.calisan, codexModel: ajan.codexModel || '' } };
  let cikti;
  try {
    cikti = derle(modelli, { hedef, skiller: [], port, anahtar: kancaAnahtari, etiket: oturumId, motor, codexModel: motor === 'codex' ? { ...codexModelCoz(), koordinator: ajan.codexModel || codexModelCoz().calisan } : null });
  } catch (e) {
    return { hata: 'derleme', ayrinti: String(e.message || e) };
  }
  const talimat = ozelMetni(gorunum(o.katId), ajan, { klasor, calisma });
  const env = motorOrtami(motor, sirket, ortam, anahtarDeger, { codexApiKlasoru: codexApiKlasoru() });
  let arg;
  if (motor === 'claude') {
    fs.writeFileSync(cikti.sefDosya, talimat);
    // sohbet odası yalnızca okur (eklenen dosyalar). Çalışma odası kendi klasörüne yazar, komutlar onaya düşer.
    arg = oturumArgumanlari({ ...modelli, izinModu: calisma ? 'acceptEdits' : '' }, { ...cikti, oturumId, surdur: eski, ad: `${sirket.ad} · ${ajan.ad}` });
    if (!calisma) arg.push('--disallowedTools', 'Bash,Edit,Write,MultiEdit,NotebookEdit,PowerShell');
  } else {
    if (apiModu) {
      try {
        await codexAnahtarGirisi({ yol, env: ortam, klasor: codexApiKlasoru(), anahtar: anahtarDeger, iz: crypto.createHash('sha256').update(anahtarDeger).digest('hex') });
      } catch (e) {
        return { hata: 'anahtarGiris', ayrinti: String(e.message || e) };
      }
    }
    arg = codexArgumanlari({ ...modelli, izinModu: calisma ? 'acceptEdits' : 'plan' }, { ...cikti, talimat }, { klasor, surdur: eski });
  }
  k.sohbet.length = 0;
  try {
    k.oturum.baslat({ yol, arg, cwd: klasor, env, sutun, satir, bilgi: { oturumId, motor, ozel: true, katId: o.katId, ajanId: o.ajanId, codexOturum: motor === 'codex' && eski ? eski : '', proje: klasor, surdurulen: !!eski, baslangic: Date.now() } });
  } catch (e) {
    return { hata: 'baslatma', ayrinti: String(e.message || e) };
  }
  if (motor === 'claude') depo.guncelle({ ozelOturumlar: { ...depo.veri.ozelOturumlar, [`${o.katId}:${o.ajanId}`]: { oturum: oturumId, motor: 'claude' } } });
  sirketAyarla(k.durum, sirket);
  oturumAc(k.durum, { oturumId, cwd: klasor });
  durumGonder(k, true);
  sohbetGonder(k);
  return { tamam: true, ...oturumBilgi(k) };
}

// Kişisel kat: uygulamanın veri klasöründe durur, tek tanedir
function kisiselKatKur() {
  const var_ = depo.veri.projeler.find((p) => p.tur === 'kisisel');
  if (var_) return var_;
  const klasor = path.join(app.getPath('userData'), 'kisisel');
  fs.mkdirSync(klasor, { recursive: true });
  const p = depo.projeKaydet({ klasor, ad: depo.veri.dil === 'en' ? 'Personal' : 'Kişisel', tur: 'kisisel' });
  sirketYayinla();
  return p;
}

// ---------- odalar: ekler, çıktılar, dışa aktarma ----------
const odaKlasoru = (katId, ajanId) => path.join(app.getPath('userData'), 'ozel', katId, ajanId);

function odaHazirla(katId, ajanId) {
  const k = odaKlasoru(katId, ajanId);
  for (const alt of ['ekler', 'ciktilar']) fs.mkdirSync(path.join(k, alt), { recursive: true });
  return k;
}

function odaDosyalari(katId, ajanId) {
  const k = odaKlasoru(katId, ajanId);
  const oku = (alt) => {
    try {
      return fs
        .readdirSync(path.join(k, alt), { withFileTypes: true })
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
        .map((e) => {
          const yol = path.join(k, alt, e.name);
          const st = fs.statSync(yol);
          return { ad: e.name, yol, boyut: st.size, z: st.mtimeMs };
        })
        .sort((a, b) => b.z - a.z)
        .slice(0, 100);
    } catch {
      return [];
    }
  };
  return { klasor: k, ekler: oku('ekler'), ciktilar: oku('ciktilar') };
}

// Kişisel kata şablonlardan oda kurar. Aynı şablondan ikinci oda açılmaz.
function odalariKur(katId, sablonIdler) {
  const p = depo.proje(katId);
  if (!p) throw new Error('Kat bulunamadı');
  const dil = depo.veri.dil;
  const kurulan = [];
  for (const id of sablonIdler.slice(0, 20)) {
    const o = odaSablonu(String(id));
    if (!o || depo.proje(katId).ajanlar.some((a) => a.oda === o.id)) continue;
    const d = o[dil] || o.tr;
    const a = depo.ajanKaydet({ ad: d.ad, unvan: d.unvan, alanlar: d.alanlar, talimat: d.talimat, renk: o.renk, oda: o.id, mod: o.mod }, katId);
    odaHazirla(katId, a.id);
    kurulan.push(a.id);
  }
  sirketYayinla();
  return kurulan;
}

const kacis = (m) => String(m).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Konuşmayı Markdown ya da PDF olarak kaydeder
async function sohbetDisaAktar(anahtar, bicim) {
  const k = katlar.get(anahtar);
  const liste = k ? k.sohbet.filter((m) => m.tur === 'mesaj') : [];
  if (!liste.length) return { hata: 'bosSohbet' };
  const g = katGorunum(k);
  const baslik = `${g.sef.ad} · ${new Date().toLocaleDateString(depo.veri.dil === 'en' ? 'en-GB' : 'tr-TR')}`;
  const kim = (m) => (m.kim === 'sen' ? depo.veri.beyin.sahip || (depo.veri.dil === 'en' ? 'You' : 'Sen') : m.ad || g.sef.ad);
  const s = await dialog.showSaveDialog(pencere, { defaultPath: `${g.sef.ad}-${new Date().toISOString().slice(0, 10)}.${bicim === 'pdf' ? 'pdf' : 'md'}`, filters: [bicim === 'pdf' ? { name: 'PDF', extensions: ['pdf'] } : { name: 'Markdown', extensions: ['md'] }] });
  if (s.canceled || !s.filePath) return { iptal: true };
  if (bicim !== 'pdf') {
    const md = `# ${baslik}\n\n` + liste.map((m) => `**${kim(m)}** · ${new Date(m.z).toLocaleTimeString()}\n\n${m.metin}\n`).join('\n---\n\n');
    fs.writeFileSync(s.filePath, md);
    return { tamam: true, yol: s.filePath };
  }
  const govde = liste
    .map((m) => `<section class="${m.kim === 'sen' ? 'sen' : 'o'}"><h3>${kacis(kim(m))} <time>${kacis(new Date(m.z).toLocaleTimeString())}</time></h3><p>${kacis(m.metin).replace(/\n/g, '<br>')}</p></section>`)
    .join('');
  const html = `<!doctype html><meta charset="utf-8"><style>body{font:13px/1.55 -apple-system,'Segoe UI',sans-serif;color:#1d2230;margin:32px}h1{font-size:20px;margin:0 0 20px}section{padding:10px 14px;border-radius:10px;margin:0 0 10px;background:#f2f4f8}section.sen{background:#e3f5f2}h3{font-size:12px;margin:0 0 4px}time{color:#7a8193;font-weight:400}p{margin:0}</style><h1>${kacis(baslik)}</h1>${govde}`;
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    fs.writeFileSync(s.filePath, await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4' }));
  } finally {
    w.destroy();
  }
  return { tamam: true, yol: s.filePath };
}

// ---------- proje açma ----------
// Yeni katların açılacağı kök: ayarlardaki, yoksa ~/GitHub, yoksa ~/Ajan Ofisi Projeler
function projeKoku() {
  if (depo.veri.projeKoku) return depo.veri.projeKoku;
  const ev = app.getPath('home');
  const gh = path.join(ev, 'GitHub');
  try {
    if (fs.statSync(gh).isDirectory()) return gh;
  } catch {
    /* yok */
  }
  return path.join(ev, depo.veri.dil === 'en' ? 'Ajan Ofisi Projects' : 'Ajan Ofisi Projeler');
}

// Klasörü projeye bağlar, katı seçili yapar ve yayınlar
function katAc(klasor, yama = {}) {
  let p = depo.projeKlasorden(klasor);
  if (Object.keys(yama).length) p = depo.projeKaydet({ id: p.id, ...yama });
  depo.guncelle({ sonProje: p.id });
  sirketYayinla();
  return p;
}

async function yeniKat({ ad, gitBaslat = true, githubOlustur = false, gizli = true }) {
  const klasorAd = klasorAdi(ad);
  if (!klasorAd) throw new Error('Geçerli bir ad yaz');
  const hedef = path.join(projeKoku(), klasorAd);
  await yeniProje({ git: github.git, gh: github.yol, env: ortam, hedef, gitBaslat, githubOlustur, gizli });
  return katAc(hedef, { ad: String(ad).trim().slice(0, 60) });
}

async function klonKat(repo) {
  const hedef = path.join(projeKoku(), klasorAdi(String(repo).split('/').pop()));
  fs.mkdirSync(projeKoku(), { recursive: true });
  await repoKlonla({ gh: github.yol, env: ortam, repo, hedef });
  return katAc(hedef);
}

// ---------- WhatsApp dinleyici ----------
// Açık WhatsApp Web sekmelerinde sahibin sohbeti yapay zekâ kullanmadan izlenir. Okunmamış yeni mesaj gelince
// yalnızca o mesaj beyne iletilir. Beynin WhatsApp'ı sürekli okuyup jeton harcamasına gerek kalmaz.
const rakamlar = (x) => String(x || '').replace(/\D/g, '');
function sahipSohbetiMi(baslik) {
  const sahip = depo.veri.beyin.whatsapp || '';
  if (!sahip) return false;
  const r = rakamlar(sahip);
  if (r.length >= 7) return rakamlar(baslik).endsWith(r.slice(-10));
  return String(baslik).trim().toLowerCase() === sahip.trim().toLowerCase();
}

const whatsappSon = new Map(); // hesap kimliği -> görülmüş mesaj kimlikleri
async function whatsappIzle() {
  try {
    const beyin = katlar.get('beyin');
    if (beyin && beyin.oturum.acik && depo.veri.beyin.whatsapp && oda) {
      for (const h of tumHesaplar().filter((x) => x.platform === 'whatsapp' && oda.sekmeler.has(x.id))) {
        const iletilen = whatsappSon.get(h.id);
        const ilkBakis = !iletilen;
        const gorulen = iletilen || new Set();
        whatsappSon.set(h.id, gorulen);
        const yeni = [];
        let baslik = '';
        // 1) Sahibin sohbeti açıksa: gelen mesajları kimliğiyle izle (açık sohbette okunmamış rozeti çıkmaz)
        const acik = await oda.whatsappAcikSohbet(h.id).catch(() => null);
        if (acik && sahipSohbetiMi(acik.baslik)) {
          baslik = acik.baslik;
          for (const m of acik.gelen) if (!gorulen.has(m.id)) (gorulen.add(m.id), yeni.push(m.metin));
        } else {
          // 2) Kapalıysa: sohbet listesinde okunmamış rozeti ve son mesaj önizlemesi
          const s = (await oda.whatsappSohbetler(h.id).catch(() => [])).find((x) => sahipSohbetiMi(x.baslik));
          if (s && s.okunmamis && s.onizleme) {
            baslik = s.baslik;
            const iz = 'liste:' + s.onizleme;
            if (!gorulen.has(iz)) (gorulen.add(iz), yeni.push(s.onizleme));
          }
        }
        // ilk bakışta eski mesajları yeniden iletme, yalnızca hafızaya al
        if (ilkBakis || !yeni.length) continue;
        oturumaYaz(beyin, `[WhatsApp · ${baslik}] ${yeni.join('\n')}\n(Sahibin WhatsApp mesajı. Cevabı whatsapp_yaz ile hesap_id ${h.id}, sohbet "${baslik}" olarak gönder. Sayfayı ayrıca okumana gerek yok: yeni mesajlar sana kendiliğinden gelir.)`).catch(() => {});
      }
    }
  } catch {
    /* sayfa değişmiş olabilir, bir sonraki turda yeniden denenir */
  }
  setTimeout(whatsappIzle, 4000);
}

// ---------- tarayıcı odası ----------
// Bütün katların bağlı hesapları. Kişisel hesaplar da bir katta durur (ör. "Kişisel" adlı kat).
// Projenin test adresi varsa o katta "Test" sekmesi de olur: web testleri burada yapılır.
const tumHesaplar = () =>
  depo.veri.projeler.flatMap((p) => [
    ...p.hesaplar.map((h) => ({ ...h, katId: p.id, kat: p.ad })),
    ...(/^https?:\/\//i.test(p.test.adres) ? [{ id: 'test-' + p.id, platform: 'diger', ad: 'Test', not: p.test.adres, adres: p.test.adres, katId: p.id, kat: p.ad, test: true }] : []),
  ]);

function kapsamHesaplari(kapsam) {
  const hepsi = tumHesaplar();
  return kapsam === 'beyin' ? hepsi : hepsi.filter((h) => h.katId === kapsam);
}

// Sahibin onayı: konuşma paneline onay kartı düşer, sahip tıklayınca söz çözülür
const bekleyenOnaylar = new Map();
function sahipOnayi(katAnahtar, soru) {
  const k = katAl(katAnahtar);
  const kat = katGorunum(k);
  const m = { id: 'o' + crypto.randomBytes(5).toString('hex'), z: Date.now(), kim: 'sef', ad: kat.sef.ad, tur: 'onay', arac: 'sahip', metin: soru.slice(0, 1200), acik: true };
  k.sohbet.push(m);
  sohbetGonder(k);
  masaustuBildir('onay', cevirici(MOTOR, depo.veri.dil)('bildirim.onay', { x: kat.sef.ad }), soru);
  return new Promise((coz) => {
    const z = setTimeout(() => onayCoz(k, m.id, false), 10 * 60 * 1000);
    bekleyenOnaylar.set(m.id, (evet) => {
      clearTimeout(z);
      coz(evet);
    });
  });
}

function onayCoz(k, mesajId, evet) {
  const coz = bekleyenOnaylar.get(mesajId);
  if (!coz) return false;
  bekleyenOnaylar.delete(mesajId);
  const m = k.sohbet.find((x) => x.id === mesajId);
  if (m) {
    m.acik = false;
    if (!evet) m.reddedildi = true;
    sohbetGonder(k);
  }
  coz(evet);
  return true;
}

function tarayiciIslemleri(kapsam) {
  const hesap = (id) => {
    const h = kapsamHesaplari(kapsam).find((x) => x.id === id);
    if (!h) throw new Error('Bu hesaba erişimin yok ya da hesap bulunamadı: ' + id);
    return h;
  };
  return {
    hesaplar: () =>
      kapsamHesaplari(kapsam).map((h) => {
        const b = oda ? oda.bilgi(h.id) : { acik: false };
        return { hesap_id: h.id, kat: h.kat, platform: h.platform, ad: h.ad, not: h.not, acik: b.acik, adres: b.adres || '' };
      }),
    ac: async (id, adres) => {
      const h = hesap(id);
      oda.ac(h);
      if (adres) await oda.gezin(id, adres);
      else await new Promise((r) => setTimeout(r, 1500));
      return oda.bilgi(id);
    },
    git: (id, adres) => (hesap(id), oda.gezin(id, adres)),
    metin: (id) => (hesap(id), oda.metin(id)),
    goruntu: (id) => (hesap(id), oda.goruntu(id)),
    konsol: (id, seviye) => (hesap(id), oda.konsol(id, { seviye }).slice(-80).map((k) => ({ seviye: k.seviye, mesaj: k.mesaj, kaynak: k.kaynak, satir: k.satir }))),
    cihaz: (id, ad) => (hesap(id), oda.cihazSec(id, ad)),
    tikla: (id, hedef) => (hesap(id), oda.tikla(id, hedef)),
    yaz: (id, girdi) => (hesap(id), oda.yaz(id, girdi)),
    onay: (soru) => sahipOnayi(kapsam === 'beyin' ? 'beyin' : kapsam, soru),
    whatsappYaz: async (id, sohbet, metin) => {
      hesap(id);
      // sahibin kendi numarası dışındaki herkese yazmak sahibin onayına bağlıdır
      if (!sahipSohbetiMi(sohbet) && !(await sahipOnayi(kapsam === 'beyin' ? 'beyin' : kapsam, `WhatsApp'ta "${sohbet}" sohbetine şu mesaj gönderilsin mi?\n\n${metin}`))) return 'Sahip onaylamadı, mesaj gönderilmedi.';
      if (!oda.sekmeler.has(id)) oda.ac(hesap(id));
      await oda.whatsappYaz(id, sohbet, metin);
      return 'Mesaj gönderildi.';
    },
  };
}

// MCP kapsamı: boş ise beyin (katlar + bütün hesaplar), değilse o katın şefi (yalnızca kendi hesapları)
function mcpAraclari(kapsam) {
  if (!kapsam) return { ...beyinAraclari(beyinIslemleri), ...tarayiciAraclari(tarayiciIslemleri('beyin')) };
  if (!depo.proje(kapsam)) return {};
  return { ...tarayiciAraclari(tarayiciIslemleri(kapsam)), ...testAraclari({ env: ortam }) };
}

// Motorlara verilecek MCP bağlantı bayrakları. Onaylı araçlar (tıkla, yaz) her seferinde motorun onay penceresinden geçer.
function mcpBayraklari(motor, { adres, hedef, beyin }) {
  // sahip tarayıcı onayını kapattıysa tıklama ve yazma da serbesttir
  const onaysiz = !!depo.veri.tarayiciOnaysiz;
  const serbest = [...(beyin ? Object.keys(beyinAraclari(beyinIslemleri)) : TEST_ARAC_ADLARI), ...ONAYSIZ_ARACLAR, ...(onaysiz ? ONAYLI_ARACLAR : [])];
  if (motor === 'claude') {
    const dosya = path.join(hedef, 'mcp.json');
    fs.mkdirSync(hedef, { recursive: true });
    fs.writeFileSync(dosya, JSON.stringify({ mcpServers: { [MCP_ADI]: { type: 'http', url: adres } } }, null, 2));
    return ['--mcp-config', dosya, '--allowedTools', serbest.map((a) => `mcp__${MCP_ADI}__${a}`).join(',')];
  }
  // sahip_onayi sahibin cevabını 10 dakikaya kadar bekler: araç zaman aşımı buna göre uzatılır (varsayılan 60 sn)
  const arg = ['-c', `mcp_servers.${MCP_ADI}.url=${JSON.stringify(adres)}`, '-c', `mcp_servers.${MCP_ADI}.default_tools_approval_mode="approve"`, '-c', `mcp_servers.${MCP_ADI}.tool_timeout_sec=900`];
  if (!onaysiz) for (const a of ONAYLI_ARACLAR) arg.push('-c', `mcp_servers.${MCP_ADI}.tools.${a}.approval_mode="prompt"`);
  return arg;
}

// ---------- taslaklar ----------
// Taslağı seçili motor yazar. Hazır değilse öbür hazır motor kullanılır.
async function taslakCalistir(istem, temizle_) {
  if (!claude && !codex) await motorlarYenile();
  const sirket = depo.veri;
  const d = durumlar();
  const anahtarVar = anahtarlar.durum();
  const secilen = motorCoz(sirket, d, anahtarVar);
  const sira = [secilen, ...MOTORLAR.filter((m) => m !== secilen)].filter((m) => m && d[m]);
  const motor = sira.find((m) => hazirMi(m, sirket, d, anahtarVar)) || sira[0];
  if (!motor) return { hata: 'motorYok' };
  const anahtar = sirket.giris[motor] === 'api' ? anahtarlar.al(motor) : '';
  const env = motorOrtami(motor, sirket, ortam, anahtar, { codexApiKlasoru: codexApiKlasoru() });
  try {
    if (motor === 'claude') return { tamam: true, sonuc: temizle_(await taslakIste({ yol: claude.yol, env, istem })) };
    if (anahtar) await codexAnahtarGirisi({ yol: codex.yol, env: ortam, klasor: codexApiKlasoru(), anahtar, iz: crypto.createHash('sha256').update(anahtar).digest('hex') });
    const nesne = jsonAyikla(await codexTaslak({ yol: codex.yol, env, istem, model: codexModelCoz().calisan }));
    if (!nesne) throw new Error('Yanıt beklenen biçimde değil');
    return { tamam: true, sonuc: temizle_(nesne) };
  } catch (e) {
    return { hata: 'taslak', ayrinti: String(e.message || e) };
  }
}

function ipcKur() {
  const dene = (fn) => async (_e, ...arg) => {
    try {
      return await fn(...arg);
    } catch (e) {
      return { hata: 'istisna', ayrinti: String(e.message || e) };
    }
  };
  const h = (kanal, fn) => ipcMain.handle(kanal, dene(fn));

  // "neler yeni" yalnızca bir kez verilir
  h('baslangic', () => {
    const b = baslangic();
    yenilikler = null;
    return b;
  });
  // kat verilmezse seçili kat
  const katAnahtari = (kat) => String(kat || depo.veri.sonProje || '');
  h('durum:al', (kat) => {
    const k = katlar.get(katAnahtari(kat));
    return k ? goruntu(k.durum) : goruntu(yeniDurum());
  });
  h('sohbet:al', (kat) => (katlar.get(katAnahtari(kat)) || { sohbet: [] }).sohbet);
  // Konuşma panelinden yazılan metin katın terminaline gönderilir
  h('sohbet:yaz', (kat, metin) => {
    const k = katlar.get(katAnahtari(kat));
    if (!k || !k.oturum.acik) return { hata: 'oturumYok' };
    oturumaYaz(k, metin).catch(() => {});
    return { tamam: true };
  });
  h('sohbet:onay', (kat, evet, mesajId) => {
    const k = katlar.get(katAnahtari(kat));
    if (k && bekleyenOnaylar.has(mesajId)) {
      onayCoz(k, mesajId, !!evet);
      return { tamam: true };
    }
    if (!k || !k.oturum.acik) return { hata: 'oturumYok' };
    const m = k.sohbet.find((x) => x.id === mesajId);
    // sahip_onayi aracının sorusu: terminale tuş gitmez, bekleyen araç çağrısı cevaplanır
    if (m && m.arac === 'sahip') {
      onayCoz(k, mesajId, !!evet);
      return { tamam: true };
    }
    if (m && m.arac === 'guven') {
      // klasör güveni: motorun kendi tuş dizisi, aralıklarla
      const tuslar = evet ? GUVEN_TUSLARI[k.oturum.bilgi.motor] || ['\r'] : [ONAY_TUSU.hayir];
      tuslar.forEach((t, i) => setTimeout(() => k.oturum.acik && k.oturum.yaz(t), i * 120));
      m.acik = false;
      if (!evet) m.reddedildi = true;
      sohbetGonder(k);
      return { tamam: true };
    }
    k.oturum.yaz(evet ? ONAY_TUSU.evet : ONAY_TUSU.hayir);
    return { tamam: true };
  });

  h('sirket:guncelle', (yama) => {
    const izinli = ['ad', 'kurallar', 'kurulumBitti', 'takimModu', 'izinModu', 'claudeYolu', 'codexYolu', 'sonProje', 'bildirim', 'motor', 'giris', 'modeller', 'beyin', 'projeKoku', 'otomatikGuncelleme', 'tarayiciOnaysiz'];
    const temiz = {};
    for (const k of izinli) if (yama && k in yama) temiz[k] = yama[k];
    if (temiz.beyin) temiz.beyin = { ...depo.veri.beyin, ...temiz.beyin };
    depo.guncelle(temiz);
    // şef seçili katın şefidir. Hiç kat yoksa yeni katların şablonu değişir.
    if (yama && yama.sef && typeof yama.sef === 'object') {
      if (depo.veri.sonProje && depo.proje(depo.veri.sonProje)) depo.sefKaydet(yama.sef);
      else depo.guncelle({ sef: { ...depo.veri.sef, ...yama.sef } });
    }
    sirketYayinla();
    // motor ya da giriş yöntemi değişince hangi motorun seçileceği de değişir
    if ('motor' in temiz || 'giris' in temiz) gonder('bilgi', baslangic().bilgi);
    if ('otomatikGuncelleme' in temiz && guncelleyici) guncelleyici.otomatik(depo.veri.otomatikGuncelleme);
    return gorunum();
  });
  h('sirket:dil', (dil) => {
    depo.dilDegistir(dil);
    sirketYayinla();
    return gorunum();
  });
  h('ajan:kaydet', (tanim, projeId) => {
    const a = depo.ajanKaydet(tanim || {}, projeId);
    sirketYayinla();
    return { tamam: true, ajan: a };
  });
  h('ajan:sil', (id, projeId) => {
    depo.ajanSil(String(id), projeId);
    sirketYayinla();
    return { tamam: true };
  });
  h('ajan:sablon', (sablonId, projeId) => {
    const a = depo.sablondanEkle(String(sablonId), projeId);
    sirketYayinla();
    return { tamam: true, ajan: a };
  });

  h('skill:liste', () => kuruluSkiller());
  h('skill:katalogKur', async (idler) => {
    const sonuc = [];
    for (const id of Array.isArray(idler) ? idler.slice(0, 40) : []) {
      gonder('skill:ilerleme', { id, durum: 'iniyor' });
      try {
        await skiller.katalogdanKur(String(id));
        gonder('skill:ilerleme', { id, durum: 'tamam' });
        sonuc.push({ id, tamam: true });
      } catch (e) {
        gonder('skill:ilerleme', { id, durum: 'hata', ayrinti: String(e.message || e) });
        sonuc.push({ id, hata: String(e.message || e) });
      }
    }
    return { sonuc, skiller: kuruluSkiller() };
  });
  h('skill:github', async (adres) => {
    const c = githubCoz(adres);
    if (!c) return { hata: 'adres' };
    const kurulan = await skiller.githubdanEkle(c);
    return { tamam: true, kurulan, skiller: kuruluSkiller() };
  });
  h('skill:klasor', async () => {
    const s = await dialog.showOpenDialog(pencere, { properties: ['openDirectory'] });
    if (s.canceled || !s.filePaths[0]) return { iptal: true };
    const kurulan = skiller.klasordenEkle(s.filePaths[0]);
    return { tamam: true, kurulan, skiller: kuruluSkiller() };
  });
  h('skill:yeni', (tanim) => {
    const id = skiller.yeniYaz(tanim || {});
    return { tamam: true, id, skiller: kuruluSkiller() };
  });
  h('skill:oku', (id) => ({ tamam: true, metin: skiller.oku(String(id)) }));
  h('skill:sil', (id) => {
    skiller.sil(String(id));
    depo.guncelle({ kapaliSkiller: depo.veri.kapaliSkiller.filter((x) => x !== id) });
    return { tamam: true, skiller: kuruluSkiller() };
  });
  h('skill:etkin', (id, etkin) => {
    const kume = new Set(depo.veri.kapaliSkiller);
    if (etkin) kume.delete(String(id));
    else kume.add(String(id));
    depo.guncelle({ kapaliSkiller: [...kume] });
    return { tamam: true, skiller: kuruluSkiller() };
  });

  h('taslak:ajan', (tarif) => taslakCalistir(taslak.ajanIstemi(gorunum(), tarif), taslak.temizAjan));
  h('taslak:kural', (tarif) => taslakCalistir(taslak.kuralIstemi(gorunum(), tarif), taslak.temizKurallar));
  h('taslak:skill', (tarif) => taslakCalistir(taslak.skillIstemi(gorunum(), tarif), taslak.temizSkill));
  h('taslak:egitim', ({ id, geriBildirim }) => {
    const kat = gorunum();
    const a = kat.ajanlar.find((x) => x.id === id);
    if (!a) return { hata: 'ajanYok' };
    return taslakCalistir(taslak.egitimIstemi(kat, a, geriBildirim), taslak.temizKurallar);
  });

  // Klasör seçtirir. Klasör bir projeye bağlı değilse yeni proje açar ve onu etkin yapar.
  h('proje:sec', async () => {
    const s = await dialog.showOpenDialog(pencere, { properties: ['openDirectory', 'createDirectory'] });
    if (s.canceled || !s.filePaths[0]) return { iptal: true };
    const proje = depo.projeKlasorden(s.filePaths[0]);
    depo.guncelle({ sonProje: proje.id });
    gonder('sirket', gorunum());
    return { tamam: true, proje };
  });
  h('proje:klasorSec', async () => {
    const s = await dialog.showOpenDialog(pencere, { properties: ['openDirectory', 'createDirectory'] });
    if (s.canceled || !s.filePaths[0]) return { iptal: true };
    return { tamam: true, klasor: s.filePaths[0] };
  });
  h('proje:kaydet', (tanim) => {
    const t = tanim && typeof tanim === 'object' ? { ...tanim } : {};
    delete t.sonOturum;
    delete t.sonAcilis;
    const proje = depo.projeKaydet(t);
    if (!depo.veri.sonProje) depo.guncelle({ sonProje: proje.id });
    gonder('sirket', gorunum());
    return { tamam: true, proje };
  });
  // Yalnızca uygulamadaki kayıt silinir. Klasöre ve içindeki dosyalara dokunulmaz.
  h('proje:sil', (id) => {
    if (katlar.get(String(id))?.oturum.acik) return { hata: 'acik' };
    depo.projeSil(String(id));
    kayit.sil(String(id));
    gonder('sirket', gorunum());
    return { tamam: true };
  });
  h('kayit:oku', (projeId) => kayitOku(projeId));
  h('kayit:temizle', (projeId) => {
    kayit.sil(String(projeId));
    depo.projeKaydet({ id: String(projeId), sonOturum: '' });
    gonder('sirket', gorunum());
    gonder('kayit', { projeId });
    return { tamam: true };
  });

  h('oturum:baslat', (secenek) => {
    const s = secenek || {};
    if (s.beyin) return beyinBaslat(s);
    if (s.ozel) return ozelBaslat({ ...s.ozel, surdur: s.surdur, sutun: s.sutun, satir: s.satir });
    return oturumBaslat(s);
  });
  h('oda:kur', (katId, sablonlar) => ({ tamam: true, kurulan: odalariKur(String(katId), Array.isArray(sablonlar) ? sablonlar : []) }));
  const odaCozIpc = (anahtar) => {
    const o = ozelCoz(anahtar);
    if (!o || !depo.proje(o.katId)?.ajanlar.some((a) => a.id === o.ajanId)) throw new Error('Oda bulunamadı');
    return o;
  };
  h('oda:dosyalar', (anahtar) => {
    const o = odaCozIpc(anahtar);
    return odaDosyalari(o.katId, o.ajanId);
  });
  // Dosya ekleme: seçilen dosyalar odanın ekler klasörüne kopyalanır, kişi oradan okur
  h('oda:ekle', async (anahtar, yollar) => {
    const o = odaCozIpc(anahtar);
    let kaynak = Array.isArray(yollar) ? yollar.filter((y) => typeof y === 'string') : null;
    if (!kaynak || !kaynak.length) {
      const s = await dialog.showOpenDialog(pencere, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Belge ve görsel', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'md', 'csv', 'json', 'docx', 'xlsx'] }, { name: '*', extensions: ['*'] }] });
      if (s.canceled) return { iptal: true };
      kaynak = s.filePaths;
    }
    const hedef = path.join(odaHazirla(o.katId, o.ajanId), 'ekler');
    const eklenen = [];
    for (const y of kaynak.slice(0, 10)) {
      try {
        const st = fs.statSync(y);
        if (!st.isFile() || st.size > 50 * 1024 * 1024) continue;
        let ad = path.basename(y).replace(/[^\w.\- ğüşıöçĞÜŞİÖÇ]/g, '_');
        if (fs.existsSync(path.join(hedef, ad))) ad = Date.now().toString(36) + '-' + ad;
        fs.copyFileSync(y, path.join(hedef, ad));
        eklenen.push({ ad, yol: path.join(hedef, ad) });
      } catch {
        /* okunamayan dosya atlanır */
      }
    }
    return { tamam: true, eklenen };
  });
  h('oda:ac', (anahtar, yol) => {
    const o = odaCozIpc(anahtar);
    const tam = path.resolve(String(yol || ''));
    // yalnızca odanın kendi klasöründeki dosyalar açılır
    if (!tam.startsWith(odaKlasoru(o.katId, o.ajanId) + path.sep)) return { hata: 'genel' };
    return shell.openPath(tam).then((h_) => (h_ ? { hata: 'genel', ayrinti: h_ } : { tamam: true }));
  });
  h('oda:klasor', (anahtar) => {
    const o = odaCozIpc(anahtar);
    return shell.openPath(odaHazirla(o.katId, o.ajanId));
  });
  h('oda:disaAktar', (anahtar, bicim) => sohbetDisaAktar(String(anahtar), bicim === 'pdf' ? 'pdf' : 'md'));
  h('kat:kisisel', () => {
    const p = kisiselKatKur();
    return { tamam: true, proje: p };
  });
  h('oturum:durdur', (kat) => {
    const k = katlar.get(katAnahtari(kat));
    if (k) k.oturum.durdur();
    return { tamam: true };
  });
  h('oturum:tampon', (kat) => {
    const k = katlar.get(katAnahtari(kat));
    return k ? { ...oturumBilgi(k), tampon: k.oturum.tampon } : { acik: false, tampon: '' };
  });
  ipcMain.on('oturum:yaz', (_e, kat, veri) => {
    const k = katlar.get(katAnahtari(kat));
    if (k && typeof veri === 'string' && veri.length < 200000) k.oturum.yaz(veri);
  });
  ipcMain.on('oturum:boyut', (_e, kat, sutun, satir) => {
    const k = katlar.get(katAnahtari(kat));
    if (k) k.oturum.boyut(Number(sutun), Number(satir));
  });

  h('claude:yenile', async () => {
    ortam = await kabukOrtami();
    await motorlarYenile();
    return { claude, motorlar: motorBilgi() };
  });
  h('claude:yolSec', async (motor = 'claude') => {
    const s = await dialog.showOpenDialog(pencere, { properties: ['openFile'] });
    if (s.canceled || !s.filePaths[0]) return { iptal: true };
    depo.guncelle(motor === 'codex' ? { codexYolu: s.filePaths[0] } : { claudeYolu: s.filePaths[0] });
    gonder('sirket', gorunum());
    await motorlarYenile();
    return { claude, motorlar: motorBilgi() };
  });
  h('motor:giris', (secenek) => girisBaslat(secenek || {}));
  h('github:repolar', async () => {
    try {
      return { tamam: true, liste: await repoListesi({ gh: github.durum.girisli ? github.yol : null, env: ortam }) };
    } catch (e) {
      return { hata: 'genel', ayrinti: String(e.message || e) };
    }
  });
  h('kat:koku', () => ({ yol: projeKoku() }));
  h('kat:kokuSec', async () => {
    const s_ = await dialog.showOpenDialog(pencere, { properties: ['openDirectory', 'createDirectory'], defaultPath: projeKoku() });
    if (s_.canceled || !s_.filePaths[0]) return { iptal: true };
    depo.guncelle({ projeKoku: s_.filePaths[0] });
    sirketYayinla();
    return { yol: projeKoku() };
  });
  h('kat:yeni', async (secenek) => {
    try {
      return { tamam: true, proje: await yeniKat(secenek || {}) };
    } catch (e) {
      return { hata: 'genel', ayrinti: String(e.message || e) };
    }
  });
  h('kat:klonla', async (repo) => {
    try {
      return { tamam: true, proje: await klonKat(String(repo || '')) };
    } catch (e) {
      return { hata: 'genel', ayrinti: String(e.message || e) };
    }
  });
  h('git:islem', async (projeId, islem, deger) => {
    const p = depo.proje(String(projeId || ''));
    if (!p) return { hata: 'projeYok' };
    try {
      return { tamam: true, sonuc: await gitIslem({ git: github.git, gh: github.durum.girisli ? github.yol : null, env: ortam, klasor: p.klasor, islem: String(islem), deger: String(deger || '') }) };
    } catch (e) {
      return { hata: 'genel', ayrinti: String(e.message || e) };
    }
  });
  h('github:repo', async (projeId) => {
    const p = depo.proje(String(projeId || ''));
    if (!p) return { depo: false };
    return repoDurumu({ git: github.git, gh: github.durum.girisli ? github.yol : null, env: ortam, klasor: p.klasor });
  });
  // Anahtar boş gelirse silinir. Anahtar hiçbir zaman arayüze geri gönderilmez.
  // Beynin sesi. OpenAI sesi OpenAI API anahtarını (Codex anahtarı) kullanır.
  const sesAnahtari = (tur) => (tur === 'elevenlabs' ? anahtarlar.al('elevenlabs') : tur === 'openai' ? anahtarlar.al('codex') : '');
  h('ses:liste', async (tur) => {
    try {
      return { tamam: true, liste: await sesListesi({ tur, anahtar: sesAnahtari(tur) }) };
    } catch (e) {
      return { hata: 'ses', ayrinti: String(e.message || e) };
    }
  });
  h('ses:uret', async (metin, secim) => {
    const ses = secim && typeof secim === 'object' ? secim : depo.veri.beyin.ses;
    try {
      return { tamam: true, ...(await sesUret({ tur: ses.tur, ses: ses.ses, metin, anahtar: sesAnahtari(ses.tur) })) };
    } catch (e) {
      return { hata: 'ses', ayrinti: String(e.message || e) };
    }
  });
  // konuşarak yazma: arayüz kaydı gönderir, yazıya çevrilmiş metin döner
  h('ses:yaziya', async (veri, mime) => {
    try {
      const ses = Buffer.from(String(veri || ''), 'base64');
      if (!ses.length || ses.length > 25 * 1024 * 1024) return { hata: 'genel' };
      return { tamam: true, metin: await yaziyaCevir({ ses, mime: String(mime || 'audio/webm'), dil: depo.veri.dil, openaiAnahtar: anahtarlar.al('codex'), elevenAnahtar: anahtarlar.al('elevenlabs') }) };
    } catch (e) {
      return { hata: 'ses', ayrinti: String(e.message || e) };
    }
  });
  h('ses:yaziyaVar', () => ({ var: anahtarlar.var('codex') || anahtarlar.var('elevenlabs') }));
  h('motor:anahtar', ({ motor, deger }) => {
    if (motor === 'elevenlabs') {
      anahtarlar.koy('elevenlabs', deger);
      gonder('bilgi', baslangic().bilgi);
      return { tamam: true, motorlar: motorBilgi() };
    }
    if (!MOTORLAR.includes(motor)) return { hata: 'genel' };
    anahtarlar.koy(motor, deger);
    gonder('bilgi', baslangic().bilgi);
    return { tamam: true, motorlar: motorBilgi() };
  });
  // ---------- tarayıcı odası ----------
  h('tarayici:liste', () => tumHesaplar().map((x) => ({ ...x, ...oda.bilgi(x.id) })));
  const hesapBul = (id) => {
    const x = tumHesaplar().find((y) => y.id === id);
    if (!x) throw new Error('Hesap bulunamadı');
    return x;
  };
  h('tarayici:ac', (id) => {
    oda.ac(hesapBul(String(id)));
    return oda.bilgi(String(id));
  });
  h('tarayici:goster', (id, alan) => oda.goster(String(id), alan || {}));
  h('tarayici:gizle', () => oda.gizle());
  h('tarayici:gezin', (id, adres) => oda.gezin(String(id), String(adres || '')));
  h('tarayici:git', (id, yon) => oda.git(String(id), String(yon)));
  h('tarayici:kapat', (id) => oda.kapat(String(id)));
  h('tarayici:cihaz', (id, cihaz) => oda.cihazSec(String(id), String(cihaz)));
  h('tarayici:konsol', (id) => oda.konsol(String(id)));
  h('tarayici:konsolTemizle', (id) => oda.konsolTemizle(String(id)));
  h('tarayici:hesapEkle', ({ katId, platform, ad, adres }) => {
    const p = depo.proje(String(katId || ''));
    if (!p) return { hata: 'projeYok' };
    const once = new Set(p.hesaplar.map((x) => x.id));
    depo.projeKaydet({ id: p.id, hesaplar: [...p.hesaplar, { platform, ad, adres }] });
    gonder('sirket', gorunum());
    const yeni = depo.proje(p.id).hesaplar.find((x) => !once.has(x.id));
    return yeni ? { tamam: true, hesap: { ...yeni, katId: p.id } } : { hata: 'genel' };
  });
  // Hesap silinince tarayıcı profili de (çerezler, oturum) silinir
  h('tarayici:hesapSil', async (katId, id) => {
    const p = depo.proje(String(katId || ''));
    if (!p) return { hata: 'projeYok' };
    if (String(id).startsWith('test-')) return { hata: 'genel' };
    oda.kapat(String(id));
    depo.projeKaydet({ id: p.id, hesaplar: p.hesaplar.filter((x) => x.id !== id) });
    await session.fromPartition('persist:hesap-' + id).clearStorageData();
    gonder('sirket', gorunum());
    return { tamam: true };
  });
  h('veri:ac', () => shell.openPath(app.getPath('userData')));
  h('baglanti:durum', () => ({ cevrimici }));
  // ---------- test alanı ----------
  const testIs = (fn) => async (...a) => {
    try {
      return { tamam: true, sonuc: await fn(...a) };
    } catch (e) {
      return { hata: 'genel', ayrinti: String(e.message || e).split('\n')[0] };
    }
  };
  h('test:durum', testIs(() => testDurumu({ env: ortam })));
  h('test:iosAc', testIs((udid) => iosAc(ortam, udid)));
  h('test:iosKapat', testIs((udid) => iosKapat(ortam, udid)));
  h('test:iosGoruntu', testIs((udid) => iosGoruntu(ortam, udid)));
  h('test:androidBaslat', testIs((avd) => androidBaslat(ortam, avd)));
  h('test:androidGoruntu', testIs((seri) => androidGoruntu(ortam, seri)));
  // seçilen katın şefine test işi verir (kat oturumu açık olmalı)
  h('test:sefeVer', testIs(async (katId, cihaz) => {
    const k = katlar.get(String(katId));
    if (!k || !k.oturum.acik) throw new Error('Katın oturumu kapalı. Önce Ofis sayfasından başlat.');
    oturumaYaz(k, `Uygulamayı ${cihaz} üzerinde test et: kur, başlat, ana akışları dene, ekran görüntüleriyle kontrol et, hataları düzelttir ve kısa bir test raporu yaz.`).catch(() => {});
    return true;
  }));
  h('guncelleme:durum', () => ({ ...guncelleyici.durum }));
  h('guncelleme:kontrol', () => guncelleyici.kontrol());
  h('guncelleme:indir', () => guncelleyici.indir());
  h('guncelleme:kur', () => ({ tamam: guncelleyici.kur() }));
  h('guncelleme:sonra', () => {
    guncelleyici.sonra();
    guncellemePenceresiniKapat();
    return { tamam: true };
  });
  h('guncelleme:atla', () => {
    guncelleyici.atla();
    guncellemePenceresiniKapat();
    return { tamam: true };
  });
  // küçük pencereden "uygulamada aç": ana pencere öne gelir, güncelleme orada gösterilir
  h('guncelleme:uygulamadaAc', () => {
    guncellemePenceresiniKapat();
    if (pencere && !pencere.isDestroyed()) {
      if (pencere.isMinimized()) pencere.restore();
      pencere.show();
      pencere.focus();
      gonder('guncelleme:goster', { ...guncelleyici.durum });
    }
    return { tamam: true };
  });
  // Yedek: şirket (beyin, katlar, ekipler, kurallar, ayarlar) ve kayıt defterleri tek JSON dosyasında.
  // API anahtarları ve tarayıcı oturumları yedeğe girmez: başka bilgisayarda anlamsızdır ve gizlidir.
  h('yedek:al', async () => {
    const s_ = await dialog.showSaveDialog(pencere, { defaultPath: `ajan-ofisi-yedek-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (s_.canceled || !s_.filePath) return { iptal: true };
    const kayitlar = {};
    for (const p of depo.veri.projeler) kayitlar[p.id] = kayit.oku(p.id, 5000);
    fs.writeFileSync(s_.filePath, JSON.stringify({ tur: 'ajan-ofisi-yedek', surum: 1, uygulama: app.getVersion(), tarih: new Date().toISOString(), sirket: depo.veri, kayitlar }, null, 2));
    return { tamam: true, yol: s_.filePath };
  });
  h('yedek:yukle', async () => {
    if ([...katlar.values()].some((k) => k.oturum.acik)) return { hata: 'acik' };
    const s_ = await dialog.showOpenDialog(pencere, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (s_.canceled || !s_.filePaths[0]) return { iptal: true };
    let y;
    try {
      y = JSON.parse(fs.readFileSync(s_.filePaths[0], 'utf8'));
    } catch {
      return { hata: 'yedekBozuk' };
    }
    if (!y || y.tur !== 'ajan-ofisi-yedek' || !y.sirket || typeof y.sirket !== 'object') return { hata: 'yedekBozuk' };
    // mevcut şirket ezilmeden önce kenara alınır
    fs.copyFileSync(depo.dosya, depo.dosya + '.onceki-' + Date.now());
    depo.veri = null;
    fs.writeFileSync(depo.dosya, JSON.stringify(y.sirket));
    depo.yukle(depo.veri ? depo.veri.dil : 'tr');
    for (const [id, satirlar] of Object.entries(y.kayitlar || {})) {
      if (!depo.proje(id) || !Array.isArray(satirlar)) continue;
      kayit.sil(id);
      for (const k of satirlar) kayit.ekle(id, k);
    }
    sirketYayinla();
    gonder('bilgi', baslangic().bilgi);
    return { tamam: true, katSayisi: depo.veri.projeler.length };
  });
  // İzinleri baştan ister: macOS korumalı klasörlere ilk erişimde sorar. Hepsi bir kerede, kurulumda sorulsun diye
  // klasörler sırayla okunur (salt okunur, içerik saklanmaz) ve bir deneme bildirimi gösterilir.
  // Ekibin çalıştırdığı araçlar uygulamanın izniyle çalışır, böylece iş sırasında yeniden sorulmaz.
  h('izin:iste', async () => {
    const klasorler = {};
    if (process.platform === 'darwin') {
      for (const ad of ['Desktop', 'Documents', 'Downloads']) {
        try {
          await fs.promises.readdir(path.join(app.getPath('home'), ad));
          klasorler[ad] = true;
        } catch {
          klasorler[ad] = false;
        }
      }
    }
    if (Notification.isSupported() && !SINAMA) {
      const t = cevirici(MOTOR, depo.veri.dil);
      new Notification({ title: t('bildirim.denemeBaslik'), body: t('bildirim.deneme') }).show();
    }
    return { tamam: true, platform: process.platform, klasorler };
  });
  h('izin:tamDisk', () => process.platform === 'darwin' && shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'));
  h('ofis:bosalt', () => {
    const k = katlar.get(katAnahtari());
    if (!k) return { tamam: true };
    if (k.oturum.acik) return { hata: 'acik' };
    temizle(k.durum);
    k.sohbet.length = 0;
    durumGonder(k, true);
    sohbetGonder(k);
    return { tamam: true };
  });
}

// ---------- pencere ----------
const TURLER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function protokolKur() {
  // Arayüz dosyaları yalnızca uygulamanın kendi klasöründen sunulur
  const izinli = [
    path.join(KOK, 'arayuz') + path.sep,
    path.join(KOK, 'cekirdek', 'kimlik.js'),
    path.join(KOK, 'cekirdek', 'dil.js'),
    path.join(KOK, 'node_modules', '@xterm', 'xterm', 'lib', 'xterm.js'),
    path.join(KOK, 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css'),
    path.join(KOK, 'node_modules', '@xterm', 'addon-fit', 'lib', 'addon-fit.js'),
  ];
  protocol.handle('ofis', async (istek) => {
    const u = new URL(istek.url);
    const p = path.normalize(path.join(KOK, decodeURIComponent(u.pathname)));
    if (!izinli.some((i) => p === i || (i.endsWith(path.sep) && p.startsWith(i)))) return new Response('', { status: 403 });
    try {
      const veri = await fs.promises.readFile(p);
      return new Response(veri, { headers: { 'content-type': TURLER[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' } });
    } catch {
      return new Response('', { status: 404 });
    }
  });
}

function menuKur() {
  const mac = process.platform === 'darwin';
  const tr = depo.veri.dil === 'tr';
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(mac ? [{ role: 'appMenu' }] : []),
      { role: 'editMenu' },
      {
        label: tr ? 'Görünüm' : 'View',
        submenu: [
          { label: tr ? 'Yeniden yükle' : 'Reload', accelerator: 'CmdOrCtrl+R', click: () => pencere?.reload() },
          { label: tr ? 'Geliştirici araçları' : 'Developer tools', accelerator: mac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', click: () => pencere?.webContents.toggleDevTools() },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
    ])
  );
}

// ---------- internet bağlantısı ----------
// Ağ kartının açık olması yetmez: küçük bir istekle gerçekten dışarı çıkılabiliyor mu bakılır.
// Bağlantı yokken 3 saniyede, varken 10 saniyede bir kontrol edilir. Durum değişince arayüze bildirilir.
let cevrimici = true;
async function baglantiDene() {
  if (!net.isOnline()) return false;
  const kontrol = new AbortController();
  const z = setTimeout(() => kontrol.abort(), 5000);
  try {
    const r = await net.fetch('https://cloudflare.com/cdn-cgi/trace', { method: 'HEAD', signal: kontrol.signal, cache: 'no-store' });
    return r.ok || r.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(z);
  }
}

async function baglantiIzle() {
  // geliştirme aracı: AJAN_OFIS_CEVRIMDISI=1 ise bağlantı yok sayılır (oyunu denemek için)
  const simdi = process.env.AJAN_OFIS_CEVRIMDISI ? false : await baglantiDene();
  if (simdi !== cevrimici) {
    cevrimici = simdi;
    gonder('baglanti', { cevrimici });
  }
  setTimeout(baglantiIzle, cevrimici ? 10000 : 3000);
}

// ---------- güncelleme ----------
// Uygulama öndeyse güncelleme penceresi içeride açılır. Arkadaysa ekranın sağ üstünde, odağı çalmayan küçük bir pencere belirir.
function guncellemeDikkat(durum) {
  // ekran görüntüsü sınamalarında pencere açılmaz, sahte güncelleme denenirken açılır
  if (SINAMA && !process.env.AJAN_OFIS_GUNCELLEME_SINAMA) return;
  if (pencere && !pencere.isDestroyed() && pencere.isFocused()) {
    gonder('guncelleme:goster', durum);
    return;
  }
  if (process.platform === 'darwin' && app.dock) app.dock.bounce('informational');
  else if (pencere && !pencere.isDestroyed()) pencere.flashFrame(true);
  if (guncellemePenceresi && !guncellemePenceresi.isDestroyed()) {
    guncellemePenceresi.webContents.send('guncelleme', durum);
    guncellemePenceresi.showInactive();
    return;
  }
  const alan = screen.getPrimaryDisplay().workArea;
  const g = 400;
  const y = 230;
  guncellemePenceresi = new BrowserWindow({
    width: g,
    height: y,
    x: alan.x + alan.width - g - 18,
    y: alan.y + 18,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#171b24',
    webPreferences: { preload: path.join(KOK, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  guncellemePenceresi.webContents.on('will-navigate', (e) => e.preventDefault());
  guncellemePenceresi.loadURL('ofis://uygulama/arayuz/guncelleme.html');
  guncellemePenceresi.once('ready-to-show', () => guncellemePenceresi && guncellemePenceresi.showInactive());
  guncellemePenceresi.on('closed', () => (guncellemePenceresi = null));
}

function guncellemePenceresiniKapat() {
  if (guncellemePenceresi && !guncellemePenceresi.isDestroyed()) guncellemePenceresi.close();
}

function pencereAc() {
  pencere = new BrowserWindow({
    width: 1500,
    height: 960,
    // en küçük boyut: altında yan panel ve konuşma paneli sığmaz
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#12151C',
    title: 'Ajan Ofisi',
    icon: process.platform === 'linux' ? path.join(KOK, 'arayuz', 'ikon.png') : undefined,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 19 },
    show: false,
    webPreferences: {
      preload: path.join(KOK, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  pencere.once('ready-to-show', () => pencere.show());
  pencere.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  pencere.webContents.on('will-navigate', (e) => e.preventDefault());
  pencere.loadURL('ofis://uygulama/arayuz/index.html');
  pencere.on('closed', () => (pencere = null));
  if (oda) oda.pencereAyarla(pencere);

  if (SINAMA) {
    pencere.webContents.on('console-message', (e) => {
      if (e.level === 'error' || e.level === 'warning') console.log('ARAYUZ', e.level, e.message);
    });
    if (process.env.AJAN_OFIS_EKRAN !== 'yok') {
      pencere.webContents.once('did-finish-load', () => {
        setTimeout(async () => {
          const img = await pencere.webContents.capturePage();
          fs.writeFileSync(process.env.AJAN_OFIS_EKRAN, img.toPNG());
          app.quit();
        }, Number(process.env.AJAN_OFIS_BEKLE || 6000));
      });
    }
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (pencere) {
      if (pencere.isMinimized()) pencere.restore();
      pencere.focus();
    }
  });

  app.whenReady().then(async () => {
    const veri = app.getPath('userData');
    depo = new SirketDeposu(path.join(veri, 'sirket'));
    depo.yukle(app.getLocale().toLowerCase().startsWith('tr') ? 'tr' : 'en');
    skiller = new SkillDeposu(path.join(veri, 'skiller'));
    kayit = new KayitDefteri(path.join(veri, 'kayit'));
    anahtarlar = new AnahtarDeposu(path.join(veri, 'anahtarlar.json'), {
      kullanilabilir: () => safeStorage.isEncryptionAvailable(),
      sifrele: (m) => safeStorage.encryptString(m),
      coz: (b) => safeStorage.decryptString(b),
    });
    // canlı olay alıcısı: yalnızca bu makine, her açılışta yeni gizli anahtar
    kancaAnahtari = crypto.randomBytes(18).toString('hex');
    for (let p = 47821; p < 47841; p++) {
      try {
        await kancaSunucu({ port: p, anahtar: kancaAnahtari, olay: olayGeldi, mcp: (govde, kapsam) => mcpIsle(govde, mcpAraclari(kapsam), { surum: app.getVersion() }) });
        port = p;
        break;
      } catch (e) {
        sunucuHata = String(e.message || e);
      }
    }
    if (port) sunucuHata = null;

    takimIzle((takimlar) => {
      for (const k of katlar.values()) if (k.oturum.acik && k.oturum.bilgi.motor === 'claude' && takimIsle(k.durum, takimlar)) durumGonder(k);
    });

    protokolKur();
    ipcKur();
    menuKur();

    const ikon = path.join(KOK, 'arayuz', 'ikon.png');
    if (process.platform === 'darwin' && app.dock && fs.existsSync(ikon) && !app.isPackaged) app.dock.setIcon(nativeImage.createFromPath(ikon));

    guncelleyici = new Guncelleyici({
      app,
      dosya: path.join(veri, 'guncelleme.json'),
      degisti: (d) => {
        gonder('guncelleme', d);
        if (guncellemePenceresi && !guncellemePenceresi.isDestroyed()) guncellemePenceresi.webContents.send('guncelleme', d);
      },
      dikkat: guncellemeDikkat,
    });
    yenilikler = guncelleyici.yenilikler();
    guncelleyici.baslat({ otomatik: depo.veri.otomatikGuncelleme });
    pencereAc();
    baglantiIzle();
    whatsappIzle();
    oda = new TarayiciOdasi({ pencere, degisti: (_id, b) => gonder('tarayici', b), konsolDegisti: (id) => gonder('tarayici:konsol', { id }) });
    setInterval(() => {
      for (const k of katlar.values()) if (k.oturum.acik) durumGonder(k, true);
    }, 1000);

    // Claude Code'u arka planda bul: pencere beklemesin
    kabukOrtami().then(async (env) => {
      ortam = env;
      await motorlarYenile();
    });
    ortam = { ...process.env };

    app.on('activate', () => {
      if (!pencere) pencereAc();
    });
  });

  app.on('before-quit', () => {
    for (const k of katlar.values()) k.oturum.durdur();
  });
  app.on('window-all-closed', () => {
    app.quit();
  });
}
