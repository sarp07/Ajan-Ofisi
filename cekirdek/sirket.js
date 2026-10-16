// Şirket deposu: ajanlar, kurallar, şef ve ayarlar tek bir JSON dosyasında, uygulamanın kendi veri klasöründe durur.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { benzersizKod, gorunusUret, RENKLER, ESYALAR, karma, rastgeleAd, gorunusCinsiyet } from './kimlik.js';
import { SEF_TALIMAT, BASLANGIC_KURALLARI, sablonBul, ESKI_TALIMATLAR } from './sablonlar.js';

export const MASA_SAYISI = 10; // şefin masası hariç
export const SES_TURLERI = ['yok', 'sistem', 'elevenlabs', 'openai'];
export const BEYIN_VARSAYILAN_AD = { tr: 'Beyin', en: 'Brain' };
const MODELLER = ['', 'sonnet', 'opus', 'haiku', 'fable'];
// bypassPermissions: hiçbir şey sorulmaz. Sahip Ayarlar'da uyarıyı görerek seçer.
const IZIN_MODLARI = ['', 'acceptEdits', 'auto', 'plan', 'bypassPermissions'];
const MOTOR_LISTESI = ['claude', 'codex', 'kimi', 'gemini'];
const MOTOR_SECIMLERI = ['otomatik', ...MOTOR_LISTESI];
// oturum kimliği: Claude ve Codex UUID, Kimi ve Gemini kendi biçimi
const OTURUM_KIMLIGI = /^[A-Za-z0-9_-](6, 80)$/;
const GIRIS_YONTEMLERI = ['abonelik', 'api'];
// Model düzeni: şef (koordinatör) güçlü modelle yönetir, çalışanlar daha az harcayan modelle iş yapar.
// Çalışanın ya da şefin kendi model seçimi boşsa buradaki değer kullanılır.
// Codex için boş değer: Codex'in model listesinden otomatik seçilir (bkz. motor.js codexVarsayilan).
export const VARSAYILAN_MODELLER = { claude: { koordinator: 'opus', calisan: 'sonnet' }, codex: { koordinator: '', calisan: '' } };
const codexModelMi = (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(v);

const metin = (v, sinir, vars = '') => (typeof v === 'string' ? v.slice(0, sinir) : vars);
const kimlik = () => crypto.randomBytes(5).toString('hex');
const kod10 = () => crypto.randomBytes(6).toString('hex').slice(0, 10);
const renkMi = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

// Şablondan gelip hiç değiştirilmemiş talimat, şablonun yeni sürümüne geçer
function guncelTalimat(t) {
  for (const [id, eskiler] of Object.entries(ESKI_TALIMATLAR)) {
    const i = eskiler.indexOf(t);
    if (i < 0) continue;
    const s = sablonBul(id);
    return (i === 1 ? s.en : s.tr).talimat;
  }
  return t;
}

export function varsayilanSirket(dil = 'tr') {
  const d = dil === 'en' ? 'en' : 'tr';
  return {
    surum: 2,
    ad: d === 'tr' ? 'Şirketim' : 'My Company',
    dil: d,
    kurulumBitti: false,
    // Beyin: sahiple konuşan, bedeni olmayan ana yönetici. Katların şefleriyle konuşur.
    beyin: { ad: BEYIN_VARSAYILAN_AD[d], ses: { tur: 'yok', ses: '' }, sahip: '', kuruldu: false },
    sef: {
      ad: 'Atlas',
      unvan: d === 'tr' ? 'Şef' : 'Chief',
      alanlar: d === 'tr' ? ['İş dağıtımı', 'Takip', 'Raporlama'] : ['Delegation', 'Follow up', 'Reporting'],
      talimat: SEF_TALIMAT[d],
      renk: '#F28C28',
      gorunus: { ten: '#E8B98F', sac: '#2A2422', stil: 'kisa', ek: 'gozluk', sakal: false, alt: '#2B303B' },
      model: '',
      codexModel: '',
    },
    kurallar: BASLANGIC_KURALLARI[d].map((m) => ({ id: kimlik(), metin: m })),
    ajanlar: [],
    kapaliSkiller: [],
    // katalogdaki önerilen skillerden kendiliğinden kurulmuş ya da görülmüş olanlar (silinen geri gelmez)
    skillGorulen: [],
    projeler: [],
    sonProje: null,
    takimModu: true,
    // otomatik: Claude güvenli işleri sormadan yapar, riskli işlerde sorar
    izinModu: 'auto',
    izinGecisi: 1,
    motor: 'otomatik',
    // özel sohbetlerin son oturumu: "kat:ajan" -> { oturum, motor }. Sürdürmek için.
    ozelOturumlar: {},
    tasarimOturumlari: {},
    giris: { claude: 'abonelik', codex: 'abonelik', kimi: 'abonelik', gemini: 'abonelik' },
    modeller: { claude: { ...VARSAYILAN_MODELLER.claude }, codex: { ...VARSAYILAN_MODELLER.codex } },
    claudeYolu: '',
    codexYolu: '',
    kimiYolu: '',
    geminiYolu: '',
    // yeni katların açılacağı klasör (boşsa uygulama seçer: ~/GitHub varsa orası, yoksa ~/Ajan Ofisi Projeler)
    projeKoku: '',
    otomatikGuncelleme: true,
    // tarayıcıda tıklama ve yazma her seferinde onay sorsun mu
    // ajanlar tarayıcıyı tam yetkiyle kullanır; dışarıya giden işler (paylaşım, mesaj) yine sahip_onayi ile sorulur
    tarayiciOnaysiz: true,
    tarayiciGecisi: 1,
    bildirim: true,
    bildirimSesi: true,
  };
}

function modellerNormalle(m) {
  const o = m && typeof m === 'object' ? m : {};
  // 0.2.1 sonrası kısa süre düz biçimde ({ koordinator, calisan }) tutuldu: Claude ayarı sayılır
  const c = o.claude && typeof o.claude === 'object' ? o.claude : 'koordinator' in o || 'calisan' in o ? o : {};
  const x = o.codex && typeof o.codex === 'object' ? o.codex : {};
  const cSec = (v, vars) => (MODELLER.includes(v) && v ? v : vars);
  const xSec = (v) => (codexModelMi(v) ? v : '');
  return {
    claude: { koordinator: cSec(c.koordinator, VARSAYILAN_MODELLER.claude.koordinator), calisan: cSec(c.calisan, VARSAYILAN_MODELLER.claude.calisan) },
    codex: { koordinator: xSec(x.koordinator), calisan: xSec(x.calisan) },
  };
}

function ozelNormalle(o, desen = /^[a-z0-9]{6,20}:[a-z0-9][a-z0-9-]{0,39}$/) {
  const sonuc = {};
  if (!o || typeof o !== 'object') return sonuc;
  for (const [k, v] of Object.entries(o).slice(0, 200)) {
    if (!desen.test(k) || !v || typeof v !== 'object') continue;
    if (typeof v.oturum === 'string' && OTURUM_KIMLIGI.test(v.oturum)) sonuc[k] = { oturum: v.oturum, motor: MOTOR_LISTESI.includes(v.motor) ? v.motor : 'claude' };
  }
  return sonuc;
}

function girisNormalle(g) {
  const o = g && typeof g === 'object' ? g : {};
  const sec = (v) => (GIRIS_YONTEMLERI.includes(v) ? v : 'abonelik');
  return Object.fromEntries(MOTOR_LISTESI.map((m) => [m, sec(o[m])]));
}

function alanNormalle(v) {
  const liste = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\n]/) : [];
  return [...new Set(liste.map((x) => metin(x, 40).trim()).filter(Boolean))].slice(0, 8);
}

function gorunusNormalle(g, tohum) {
  const u = gorunusUret(tohum);
  if (!g || typeof g !== 'object') return u;
  return {
    ten: renkMi(g.ten) ? g.ten : u.ten,
    sac: renkMi(g.sac) ? g.sac : u.sac,
    stil: typeof g.stil === 'string' ? g.stil : u.stil,
    ek: typeof g.ek === 'string' ? g.ek : u.ek,
    sakal: !!g.sakal,
    alt: renkMi(g.alt) ? g.alt : u.alt,
  };
}

// Şef kartı. v: varsayılan değerler (şirketin şef şablonu)
function sefNormalle(sef, v) {
  const o = sef && typeof sef === 'object' ? sef : {};
  return {
    ad: metin(o.ad, 40).trim() || v.ad,
    unvan: metin(o.unvan, 80).trim() || v.unvan,
    alanlar: Array.isArray(o.alanlar) ? alanNormalle(o.alanlar) : v.alanlar,
    talimat: typeof o.talimat === 'string' ? o.talimat.slice(0, 20000) : v.talimat,
    renk: renkMi(o.renk) ? o.renk : v.renk,
    gorunus: gorunusNormalle(o.gorunus || v.gorunus, 'sef'),
    model: MODELLER.includes(o.model) ? o.model : '',
    codexModel: codexModelMi(o.codexModel) ? o.codexModel : '',
  };
}

function beyinNormalle(b, dil) {
  const o = b && typeof b === 'object' ? b : {};
  const ses = o.ses && typeof o.ses === 'object' ? o.ses : {};
  return {
    ad: metin(o.ad, 40).trim() || BEYIN_VARSAYILAN_AD[dil],
    ses: { tur: SES_TURLERI.includes(ses.tur) ? ses.tur : 'yok', ses: metin(ses.ses, 120).trim() },
    // sahibe nasıl hitap edileceği (boşsa adsız hitap)
    sahip: metin(o.sahip, 40).trim(),
    // sahibin WhatsApp'taki numarası ya da sohbet adı: yalnızca bu sohbetten gelen mesajlar beyne iletilir
    whatsapp: metin(o.whatsapp, 60).trim(),
    // Telegram: sahibin sohbet kimliği (bağlantı koduyla bir kez bağlanır) ve tek kullanımlık bağlantı kodu
    telegram: (() => {
      const t = o.telegram && typeof o.telegram === 'object' ? o.telegram : {};
      return { sahipId: /^-?\d{1,20}$/.test(String(t.sahipId || '')) ? String(t.sahipId) : '', sahipAd: metin(t.sahipAd, 60).trim(), kod: /^[a-z0-9]{6,20}$/.test(String(t.kod || '')) ? t.kod : kod10() };
    })(),
    kuruldu: !!o.kuruldu,
  };
}

function ekipNormalle(liste) {
  const kodlar = new Set();
  const masalar = new Set();
  return Array.isArray(liste) ? liste.filter((a) => a && typeof a === 'object').slice(0, 40).map((a) => ajanNormalle(a, kodlar, masalar)) : [];
}

function ajanNormalle(a, mevcutKodlar, doluMasalar) {
  const ad = metin(a.ad, 60).trim() || 'Ajan';
  let id = typeof a.id === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(a.id) && !mevcutKodlar.has(a.id) && a.id !== 'sef' && a.id !== 'misafir' ? a.id : benzersizKod(ad, mevcutKodlar);
  mevcutKodlar.add(id);
  let masa = Number.isInteger(a.masa) && a.masa >= 0 && a.masa < MASA_SAYISI && !doluMasalar.has(a.masa) ? a.masa : -1;
  if (masa < 0) for (let i = 0; i < MASA_SAYISI; i++) if (!doluMasalar.has(i)) { masa = i; break; }
  if (masa >= 0) doluMasalar.add(masa);
  const h = karma(id);
  return {
    id,
    ad,
    unvan: metin(a.unvan, 80).trim(),
    alanlar: alanNormalle(a.alanlar),
    cagri: metin(a.cagri, 600).trim(),
    talimat: guncelTalimat(metin(a.talimat, 20000)),
    kurallar: Array.isArray(a.kurallar) ? a.kurallar.map((k) => metin(k, 600).trim()).filter(Boolean).slice(0, 40) : [],
    skiller: Array.isArray(a.skiller) ? [...new Set(a.skiller.filter((s) => typeof s === 'string'))].slice(0, 30) : [],
    model: MODELLER.includes(a.model) ? a.model : '',
    codexModel: codexModelMi(a.codexModel) ? a.codexModel : '',
    // kişisel kattaki oda: hangi şablondan geldiği ve çalışma modu (sohbet: yalnızca konuşur, calisma: oda klasöründe dosya üretir)
    oda: typeof a.oda === 'string' && /^[a-z0-9-]{1,30}$/.test(a.oda) ? a.oda : '',
    mod: a.mod === 'calisma' ? 'calisma' : 'sohbet',
    hafiza: a.hafiza !== false,
    renk: renkMi(a.renk) ? a.renk : RENKLER[h % RENKLER.length],
    gorunus: gorunusNormalle(a.gorunus, id),
    esya: ESYALAR.includes(a.esya) ? a.esya : ESYALAR[(h >>> 5) % ESYALAR.length],
    masa, // -1: masası yok, ortak masada oturur
    olusturma: Number.isFinite(a.olusturma) ? a.olusturma : Date.now(),
  };
}

const klasorAdi = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';
export const PLATFORMLAR = ['appledev', 'apple', 'playconsole', 'github', 'vercel', 'cloudflare', 'supabase', 'firebase', 'expo', 'google', 'gmail', 'telegram', 'instagram', 'x', 'tiktok', 'youtube', 'linkedin', 'facebook', 'discord', 'diger'];

// Proje kartı: klasör, alan adları, bağlı hesaplar (yalnızca etiket, şifre asla), test bilgisi ve notlar.
function projeNormalle(p, kimlikler, sefSablon) {
  const ham = typeof p === 'string' ? { klasor: p } : p && typeof p === 'object' ? p : {};
  const klasor = metin(ham.klasor, 1000).trim();
  let id = typeof ham.id === 'string' && /^[a-z0-9]{6,20}$/.test(ham.id) && !kimlikler.has(ham.id) ? ham.id : kimlik();
  while (kimlikler.has(id)) id = kimlik();
  kimlikler.add(id);
  const test = ham.test && typeof ham.test === 'object' ? ham.test : {};
  return {
    id,
    ad: metin(ham.ad, 60).trim() || klasorAdi(klasor) || 'Proje',
    klasor,
    aciklama: metin(ham.aciklama, 600).trim(),
    alanAdlari: [...new Set((Array.isArray(ham.alanAdlari) ? ham.alanAdlari : []).map((x) => metin(x, 120).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')).filter(Boolean))].slice(0, 20),
    hesaplar: (Array.isArray(ham.hesaplar) ? ham.hesaplar : [])
      // WhatsApp tarayıcıda tutulmaz (beyne doğrudan bağlıdır): eski WhatsApp Web sekmeleri kayıttan düşer
      .filter((x) => x && typeof x === 'object' && x.platform !== 'whatsapp' && !/whatsapp\.(com|net)/i.test(String(x.adres || '')))
      .map((x) => ({
        id: typeof x.id === 'string' && x.id ? x.id.slice(0, 20) : kimlik(),
        platform: PLATFORMLAR.includes(x.platform) ? x.platform : 'diger',
        ad: metin(x.ad, 80).trim(),
        not: metin(x.not, 200).trim(),
        // tarayıcı odasında açılacak adres (boşsa platformun adresi)
        adres: /^https?:\/\//i.test(String(x.adres || '')) ? metin(x.adres, 500).trim() : '',
      }))
      .filter((x) => x.ad)
      .slice(0, 30),
    // WhatsApp kişileri: sahibin bu proje için eklediği insanlar (eş, testçi, müşteri). Beyin onlarla yalnızca bu proje
    // hakkında konuşur. tanitildi: tanışma mesajı gönderildi mi.
    kisiler: (Array.isArray(ham.kisiler) ? ham.kisiler : [])
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({
        id: typeof x.id === 'string' && /^[a-z0-9]{6,20}$/.test(x.id) ? x.id : kimlik(),
        ad: metin(x.ad, 40).trim(),
        // kanal: whatsapp (numarayla) ya da telegram (kişi bota bağlantı koduyla bir kez yazar)
        kanal: x.kanal === 'telegram' ? 'telegram' : 'whatsapp',
        numara: metin(x.numara, 30).replace(/[^\d+ ]/g, '').trim(),
        telegramId: /^-?\d{1,20}$/.test(String(x.telegramId || '')) ? String(x.telegramId) : '',
        kod: /^[a-z0-9]{6,20}$/.test(String(x.kod || '')) ? x.kod : kod10(),
        rol: metin(x.rol, 60).trim(),
        tanitildi: !!x.tanitildi,
      }))
      .filter((x) => x.ad && (x.kanal === 'telegram' || x.numara.replace(/\D/g, '').length >= 7))
      .slice(0, 20),
    // Ek depolar: katın ana klasörü dışındaki depolar (ör. api, web, admin ayrı repolar). Ana klasör ilk depodur.
    depolar: (() => {
      const gorulen = new Set([path.resolve(klasor || '.')]);
      return (Array.isArray(ham.depolar) ? ham.depolar : [])
        .filter((x) => x && typeof x === 'object' && typeof x.klasor === 'string' && path.isAbsolute(x.klasor))
        .map((x) => ({ id: typeof x.id === 'string' && /^[a-z0-9]{6,20}$/.test(x.id) ? x.id : kimlik(), ad: metin(x.ad, 40).trim() || path.basename(x.klasor), klasor: path.resolve(metin(x.klasor, 1000)) }))
        .filter((x) => !gorulen.has(x.klasor) && gorulen.add(x.klasor))
        .slice(0, 12);
    })(),
    // Port bloğu: katın kalıcı 100'lük port aralığı (0: henüz verilmedi) ve servislere ayrılan portlar
    portBlok: Number.isInteger(ham.portBlok) && ham.portBlok > 0 && ham.portBlok < 600 ? ham.portBlok : 0,
    portlar: Object.fromEntries(
      Object.entries(ham.portlar && typeof ham.portlar === 'object' ? ham.portlar : {})
        .filter(([k, v]) => /^[\w.-]{1,40}$/.test(k) && Number.isInteger(v) && v > 1024 && v < 65536)
        .slice(0, 50)
    ),
    // Servisler: katın compose dosyası, düşerse kendiliğinden kaldırılsın mı, kap başına bellek (MB) ve CPU sınırı
    servis: (() => {
      const s = ham.servis && typeof ham.servis === 'object' ? ham.servis : {};
      return {
        compose: metin(s.compose, 1000).trim(),
        acikTut: !!s.acikTut,
        bellekMb: Number.isFinite(Number(s.bellekMb)) ? Math.max(0, Math.min(65536, Math.round(Number(s.bellekMb)))) : 0,
        cpu: Number.isFinite(Number(s.cpu)) ? Math.max(0, Math.min(64, Math.round(Number(s.cpu) * 10) / 10)) : 0,
      };
    })(),
    test: {
      komut: metin(test.komut, 300).trim(),
      adres: metin(test.adres, 300).trim(),
      sorumlu: metin(test.sorumlu, 40),
      zorunlu: !!test.zorunlu,
    },
    notlar: metin(ham.notlar, 4000),
    olusturma: Number.isFinite(ham.olusturma) ? ham.olusturma : Date.now(),
    sonAcilis: Number.isFinite(ham.sonAcilis) ? ham.sonAcilis : 0,
    sonOturum: typeof ham.sonOturum === 'string' && OTURUM_KIMLIGI.test(ham.sonOturum) ? ham.sonOturum : '',
    // son oturumu hangi motor açtı: başka motorla sürdürülemez
    sonMotor: MOTOR_LISTESI.includes(ham.sonMotor) ? ham.sonMotor : 'claude',
    // kişisel kat: şefi yoktur (şefi beyindir), her üyenin ayrı odası vardır ve onlarla yalnızca özel sohbet edilir
    tur: ham.tur === 'kisisel' ? 'kisisel' : 'proje',
    // kat: bu projenin şefi ve ekibi. Ekipler projeye özeldir.
    sef: sefNormalle(ham.sef, sefSablon),
    ajanlar: ekipNormalle(ham.ajanlar),
  };
}

// Dışarıdan gelen her veriyi (dosya, arayüz, içe aktarma) güvenli biçime sokar
export function normalle(ham) {
  const v = varsayilanSirket(ham && ham.dil);
  const s = ham && typeof ham === 'object' ? ham : {};
  // şirketin şefi artık yeni katların şef şablonudur
  let sefSablon = sefNormalle(s.sef, v.sef);
  let ekipHavuzu = ekipNormalle(s.ajanlar);
  let hamProjeler = (Array.isArray(s.projeler) ? s.projeler : []).slice(0, 40);
  let beyin = s.beyin;
  // 0.2.x verisi (surum 1): tek ortak ekip vardı. Ekip ve şef her projenin katına kopyalanır,
  // şefin adı beyne geçer. Hiç proje yoksa ekip havuzda bekler ve ilk kata taşınır.
  if (!(s.surum >= 2)) {
    if (!beyin && s.kurulumBitti) {
      beyin = { ad: sefSablon.ad, ses: { tur: 'yok', ses: '' }, kuruldu: true };
      // eski şef beyin oldu: katların şefi varsayılan adla başlar, aynı ad iki kişide olmasın
      if (sefSablon.ad !== v.sef.ad) sefSablon = { ...sefSablon, ad: v.sef.ad };
    }
    if (ekipHavuzu.length && hamProjeler.length) {
      hamProjeler = hamProjeler.map((p) => (p && typeof p === 'object' && !Array.isArray(p.ajanlar) ? { ...p, ajanlar: ekipHavuzu, sef: p.sef || sefSablon } : p));
      ekipHavuzu = [];
    }
  }
  const projeKimlik = new Set();
  const projeler = hamProjeler.map((p) => projeNormalle(p, projeKimlik, sefSablon));
  // her katın şefi farklı bir ad taşır: aynı adı alan (ör. hepsi varsayılan "Atlas") şefe katına bağlı kalıcı bir ad verilir
  {
    const sade = (x) => String(x || '').trim().toLocaleLowerCase('tr');
    const kullanilan = new Set([sade(beyinNormalle(beyin, v.dil).ad)]);
    for (const p of projeler) for (const a of p.ajanlar) kullanilan.add(sade(a.ad));
    const sefler = new Set();
    for (const p of projeler) {
      if (p.tur === 'kisisel') continue;
      if (sefler.has(sade(p.sef.ad)) || sade(p.sef.ad) === [...kullanilan][0]) {
        const r = rastgeleAd(v.dil, new Set([...kullanilan, ...sefler]), { tohum: p.id });
        p.sef = { ...p.sef, ad: r.ad, gorunus: gorunusCinsiyet(gorunusUret(p.id + r.ad), r.kadin) };
      }
      sefler.add(sade(p.sef.ad));
    }
  }
  // eski sürümde son proje klasör yoluyla tutuluyordu
  const son = projeler.find((p) => p.id === s.sonProje) || projeler.find((p) => p.klasor && p.klasor === s.sonProje);
  return {
    surum: 2,
    ad: metin(s.ad, 60).trim() || v.ad,
    dil: v.dil,
    kurulumBitti: !!s.kurulumBitti,
    beyin: beyinNormalle(beyin, v.dil),
    sef: sefSablon,
    kurallar: Array.isArray(s.kurallar)
      ? s.kurallar
          .map((k) => ({ id: typeof k.id === 'string' ? k.id : kimlik(), metin: metin(typeof k === 'string' ? k : k.metin, 800).trim() }))
          .filter((k) => k.metin)
          .slice(0, 60)
      : v.kurallar,
    // eski sürümden kalan, henüz bir kata taşınmamış ekip
    ajanlar: ekipHavuzu,
    kapaliSkiller: Array.isArray(s.kapaliSkiller) ? s.kapaliSkiller.filter((x) => typeof x === 'string') : [],
    skillGorulen: Array.isArray(s.skillGorulen) ? s.skillGorulen.filter((x) => typeof x === 'string') : [],
    projeler,
    sonProje: son ? son.id : null,
    takimModu: s.takimModu !== false,
    // bir kerelik geçiş: varsayılanda kalan "her seferinde sor" otomatik karara geçer (sahip sonra yine seçebilir)
    izinModu: s.izinGecisi !== 1 && !s.izinModu ? 'auto' : IZIN_MODLARI.includes(s.izinModu) ? s.izinModu : '',
    izinGecisi: 1,
    motor: MOTOR_SECIMLERI.includes(s.motor) ? s.motor : 'otomatik',
    ozelOturumlar: ozelNormalle(s.ozelOturumlar),
    // tasarım odasının sürdürülebilir oturumu (kat kimliği → oturum)
    tasarimOturumlari: ozelNormalle(s.tasarimOturumlari, /^[a-z0-9]{6,20}$/),
    giris: girisNormalle(s.giris),
    modeller: modellerNormalle(s.modeller),
    claudeYolu: metin(s.claudeYolu, 1000),
    codexYolu: metin(s.codexYolu, 1000),
    kimiYolu: metin(s.kimiYolu, 1000),
    geminiYolu: metin(s.geminiYolu, 1000),
    otomatikGuncelleme: s.otomatikGuncelleme !== false,
    tarayiciOnaysiz: s.tarayiciGecisi !== 1 ? true : !!s.tarayiciOnaysiz,
    tarayiciGecisi: 1,
    projeKoku: path.isAbsolute(metin(s.projeKoku, 1000)) ? metin(s.projeKoku, 1000) : '',
    bildirim: s.bildirim !== false,
    bildirimSesi: s.bildirimSesi !== false,
  };
}

// Bir katın (projenin) görünümü: şirket ayarları + o katın şefi ve ekibi.
// Derleyici, durum motoru ve arayüz şirketi hep bu görünümle okur.
export function katGorunumu(sirket, proje) {
  if (!proje) return { ...sirket, sef: sirket.sef, ajanlar: [], katId: null };
  return { ...sirket, sef: proje.sef, ajanlar: proje.ajanlar, katId: proje.id };
}

export class SirketDeposu {
  constructor(klasor) {
    this.klasor = klasor;
    this.dosya = path.join(klasor, 'sirket.json');
    this.veri = null;
    this.yeni = false;
  }

  yukle(varsayilanDil = 'tr') {
    fs.mkdirSync(this.klasor, { recursive: true });
    try {
      this.veri = normalle(JSON.parse(fs.readFileSync(this.dosya, 'utf8')));
    } catch (e) {
      if (fs.existsSync(this.dosya)) {
        // okunamayan dosyayı ezme: kenara al
        fs.copyFileSync(this.dosya, this.dosya + '.bozuk');
      }
      this.veri = varsayilanSirket(varsayilanDil);
      this.yeni = true;
      this.yaz();
    }
    return this.veri;
  }

  yaz() {
    const gecici = this.dosya + '.tmp';
    fs.writeFileSync(gecici, JSON.stringify(this.veri, null, 2) + '\n');
    fs.renameSync(gecici, this.dosya);
  }

  // Kısmi güncelleme: yalnızca verilen üst düzey alanlar değişir
  guncelle(yama) {
    this.veri = normalle({ ...this.veri, ...yama });
    this.yaz();
    return this.veri;
  }

  // Ekip işlemleri bir kata (projeye) yapılır. projeId verilmezse seçili kat kullanılır.
  katId(projeId) {
    const id = projeId || this.veri.sonProje;
    if (!id || !this.proje(id)) throw new Error('Önce bir kat (proje) seç');
    return id;
  }

  // Şirkette kullanılan bütün adlar (küçük harf): beyin, şefler ve bütün katların ekipleri
  kullanilanAdlar() {
    const sade = (x) => String(x || '').trim().toLocaleLowerCase('tr');
    const k = new Set([sade(this.veri.beyin.ad)]);
    for (const p of this.veri.projeler) {
      if (p.tur !== 'kisisel') k.add(sade(p.sef.ad));
      for (const a of p.ajanlar) k.add(sade(a.ad));
    }
    return k;
  }

  ajanKaydet(tanim, projeId) {
    const id = this.katId(projeId);
    const liste = this.proje(id).ajanlar.slice();
    const i = tanim.id ? liste.findIndex((a) => a.id === tanim.id) : -1;
    if (i >= 0) liste[i] = { ...liste[i], ...tanim };
    else liste.push({ ...tanim, id: undefined, olusturma: Date.now() });
    const onceki = new Set(this.proje(id).ajanlar.map((a) => a.id));
    this.projeKaydet({ id, ajanlar: liste });
    const yeni = this.proje(id).ajanlar;
    return i >= 0 ? yeni[i] : yeni.find((a) => !onceki.has(a.id)) || yeni[yeni.length - 1];
  }

  ajanSil(ajanId, projeId) {
    const id = this.katId(projeId);
    this.projeKaydet({ id, ajanlar: this.proje(id).ajanlar.filter((a) => a.id !== ajanId) });
  }

  sefKaydet(sef, projeId) {
    const id = this.katId(projeId);
    this.projeKaydet({ id, sef: { ...this.proje(id).sef, ...sef } });
    return this.proje(id).sef;
  }

  proje(id) {
    return this.veri.projeler.find((p) => p.id === id) || null;
  }

  projeKaydet(tanim) {
    const liste = this.veri.projeler.slice();
    const i = tanim.id ? liste.findIndex((p) => p.id === tanim.id) : -1;
    let havuz = null;
    if (i >= 0) liste[i] = { ...liste[i], ...tanim };
    else {
      // eski sürümden havuzda kalan ekip ilk kata taşınır
      if (!liste.length && this.veri.ajanlar.length && !Array.isArray(tanim.ajanlar)) havuz = this.veri.ajanlar;
      liste.push({ ...tanim, ...(havuz ? { ajanlar: havuz } : {}), id: undefined, olusturma: Date.now() });
    }
    if (havuz) this.veri = { ...this.veri, ajanlar: [] };
    const onceki = new Set(this.veri.projeler.map((p) => p.id));
    this.guncelle({ projeler: liste });
    return i >= 0 ? this.veri.projeler[i] : this.veri.projeler.find((p) => !onceki.has(p.id));
  }

  // Klasör zaten bir projeye bağlıysa onu döndürür, değilse yeni proje açar
  projeKlasorden(klasor) {
    return this.veri.projeler.find((p) => p.klasor === klasor) || this.projeKaydet({ klasor });
  }

  projeSil(id) {
    this.guncelle({ projeler: this.veri.projeler.filter((p) => p.id !== id), sonProje: this.veri.sonProje === id ? null : this.veri.sonProje });
  }

  sablondanEkle(sablonId, projeId, { ad: istenen = '' } = {}) {
    const s = sablonBul(sablonId);
    if (!s) throw new Error('Şablon bulunamadı');
    const d = s[this.veri.dil] || s.tr;
    // şablonun adı yerine şirkette kullanılmayan rastgele bir ad (cinsiyet şablonun görünüşüne uyar)
    const kadin = ['uzun', 'topuz'].includes(s.gorunus && s.gorunus.stil);
    const ad = istenen || rastgeleAd(this.veri.dil, this.kullanilanAdlar(), { kadin }).ad;
    return this.ajanKaydet({ ad, unvan: d.unvan, alanlar: d.alanlar, cagri: d.cagri, talimat: d.talimat, renk: s.renk, gorunus: s.gorunus, esya: s.esya }, projeId);
  }

  dilDegistir(dil) {
    // Şef talimatı ve başlangıç kuralları hiç değiştirilmemişse yeni dile çevrilir
    const eski = this.veri.dil;
    const yeni = dil === 'en' ? 'en' : 'tr';
    if (eski === yeni) return this.veri;
    const yama = { dil: yeni };
    const sef = { ...this.veri.sef };
    if (sef.talimat === SEF_TALIMAT[eski]) sef.talimat = SEF_TALIMAT[yeni];
    const eskiV = varsayilanSirket(eski).sef;
    const yeniV = varsayilanSirket(yeni).sef;
    if (sef.unvan === eskiV.unvan) sef.unvan = yeniV.unvan;
    if (JSON.stringify(sef.alanlar) === JSON.stringify(eskiV.alanlar)) sef.alanlar = yeniV.alanlar;
    yama.sef = sef;
    // katların şefleri de varsayılan haldeyse çevrilir
    yama.projeler = this.veri.projeler.map((p) => {
      const ps = { ...p.sef };
      if (ps.talimat === SEF_TALIMAT[eski]) ps.talimat = SEF_TALIMAT[yeni];
      if (ps.unvan === eskiV.unvan) ps.unvan = yeniV.unvan;
      if (JSON.stringify(ps.alanlar) === JSON.stringify(eskiV.alanlar)) ps.alanlar = yeniV.alanlar;
      return { ...p, sef: ps };
    });
    if (this.veri.beyin.ad === BEYIN_VARSAYILAN_AD[eski]) yama.beyin = { ...this.veri.beyin, ad: BEYIN_VARSAYILAN_AD[yeni] };
    const eskiKural = BASLANGIC_KURALLARI[eski];
    if (this.veri.kurallar.length === eskiKural.length && this.veri.kurallar.every((k, i) => k.metin === eskiKural[i])) {
      yama.kurallar = BASLANGIC_KURALLARI[yeni].map((m) => ({ id: kimlik(), metin: m }));
    }
    if (this.veri.ad === (eski === 'tr' ? 'Şirketim' : 'My Company')) yama.ad = yeni === 'tr' ? 'Şirketim' : 'My Company';
    this.veri = normalle({ ...this.veri, ...yama, dil: yeni });
    this.yaz();
    return this.veri;
  }
}
