// Kod haritası: her katın kodu Graphify (Graphify Labs, MIT / Apache-2.0) ile yerel olarak bir grafiğe çevrilir.
// Yalnızca tree-sitter ile çalışır: yapay zeka çağrısı, API anahtarı ya da dış servis yok (GRAPHIFY_BACKEND=none).
// Kullanıcıda Python olması gerekmez: uv (Astral, MIT / Apache-2.0) uygulamanın araçlar klasörüne bir kez indirilir
// (SHA-256 ile doğrulanır), Python'u ve graphifyy paketini o klasöre kendisi kurar. Kullanıcının kendi uv, Python ya da
// graphify kurulumları kullanılmaz: her makinede aynı sürüm çalışır, imzalı sürümde elle bir adım gerekmez.
// Grafik projenin graphify-out/ klasörüne yazılır ve .git/info/exclude ile depodan dışarıda tutulur.
// Ajanlar haritayı ofis araçlarıyla (harita_ara, harita_komsular, harita_yol, harita_ozet) okur; dosya taramaz.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { calistir } from './claude.js';

export const GRAPHIFY_PAKET = 'graphifyy==0.9.118';
export const UV_SURUM = '0.11.19';
const WIN = process.platform === 'win32';
const CIKTI = 'graphify-out';

// uv sürüm dosyaları ve SHA-256 özetleri (github.com/astral-sh/uv/releases/tag/0.11.19)
const UV_PAKETLER = {
  'darwin-arm64': ['uv-aarch64-apple-darwin.tar.gz', 'd8f59c38e8c4168ee468d423cd63184be12fa6995a4283d41ee1a14d003c9453'],
  'darwin-x64': ['uv-x86_64-apple-darwin.tar.gz', '1585f415cade9f061e7f00fe5b00030a79ccfac60c650242ce639ba946138d40'],
  'linux-x64': ['uv-x86_64-unknown-linux-gnu.tar.gz', '7035608168e106375b36d0c818d537a889c51a8625fe7f8f7cad5e62b947c368'],
  'linux-arm64': ['uv-aarch64-unknown-linux-gnu.tar.gz', '83b13ab184a45b7d9a3b0e4b10eaebd50ad41e66cb16dcce8e60aa7be13ae399'],
  'win32-x64': ['uv-x86_64-pc-windows-msvc.zip', '1665fc8e37b5d70a134820d6d7891747471a2ac8bc940ee7af0b69fd03b28d61'],
  'win32-arm64': ['uv-aarch64-pc-windows-msvc.zip', '5592a990a9d9901fd0d23992d872f2ec3ca91b7bbd3d5f0bb5e6f42b851493d8'],
};

const exe = (ad) => (WIN ? ad + '.exe' : ad);
export const graphifyKlasoru = (araclar) => path.join(araclar, 'graphify');
const binKlasoru = (araclar) => path.join(graphifyKlasoru(araclar), 'bin');
const uvYolu = (araclar) => path.join(graphifyKlasoru(araclar), 'uv', exe('uv'));
const surumDosyasi = (araclar) => path.join(graphifyKlasoru(araclar), 'surum.txt');

// uv her şeyi uygulamanın kendi klasörüne kurar; kullanıcının ~/.local ve Python kurulumlarına dokunmaz
export function uvOrtami(env, araclar) {
  const k = graphifyKlasoru(araclar);
  return {
    ...env,
    UV_TOOL_DIR: path.join(k, 'araclar'),
    UV_TOOL_BIN_DIR: binKlasoru(araclar),
    UV_PYTHON_INSTALL_DIR: path.join(k, 'python'),
    UV_CACHE_DIR: path.join(k, 'onbellek'),
    UV_PYTHON_PREFERENCE: 'only-managed',
    UV_NO_MODIFY_PATH: '1',
  };
}

// graphify çalışırken: yapay zeka yok, sorgu günlüğü yok
export function graphifyOrtami(env) {
  return { ...env, GRAPHIFY_BACKEND: 'none', GRAPHIFY_QUERY_LOG_DISABLE: '1' };
}

// Kullanılacak graphify: yalnızca uygulamanın kurduğu, sürümü bilinen kopya
export function graphifyYolu(_env, araclar) {
  const kendi = path.join(binKlasoru(araclar), exe('graphify'));
  try {
    if (fs.readFileSync(surumDosyasi(araclar), 'utf8').trim() === GRAPHIFY_PAKET && fs.existsSync(kendi)) return kendi;
  } catch {
    /* kurulmadı */
  }
  return null;
}

async function uvIndir(araclar, getir = fetch) {
  const p = UV_PAKETLER[`${process.platform}-${process.arch}`];
  if (!p) throw new Error(`uv bu sistemde yok: ${process.platform}-${process.arch}`);
  const [ad, ozet] = p;
  const y = await getir(`https://github.com/astral-sh/uv/releases/download/${UV_SURUM}/${ad}`, { redirect: 'follow' });
  if (!y.ok) throw new Error(`uv indirilemedi (${y.status})`);
  const veri = Buffer.from(await y.arrayBuffer());
  const gercek = crypto.createHash('sha256').update(veri).digest('hex');
  if (gercek !== ozet) throw new Error('uv indirmesinin özeti tutmuyor, kurulmadı');
  const hedef = path.dirname(uvYolu(araclar));
  const gecici = hedef + '.gecici';
  fs.rmSync(gecici, { recursive: true, force: true });
  fs.mkdirSync(gecici, { recursive: true });
  const arsiv = path.join(gecici, ad);
  fs.writeFileSync(arsiv, veri);
  // tar macOS, Linux ve Windows 10+ ile gelir; Windows'taki bsdtar zip de açar
  const s = await calistir(WIN ? 'tar.exe' : 'tar', ['-xf', arsiv, '-C', gecici], { zamanAsimi: 120000 });
  if (s.kod !== 0) throw new Error('uv arşivi açılamadı: ' + (s.hata || s.cikti).trim());
  const bul = (d, derinlik = 0) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const t = path.join(d, e.name);
      if (e.isFile() && e.name === exe('uv')) return t;
      if (e.isDirectory() && derinlik < 2) {
        const r = bul(t, derinlik + 1);
        if (r) return r;
      }
    }
    return null;
  };
  const ikili = bul(gecici);
  if (!ikili) throw new Error('uv arşivinde uv bulunamadı');
  fs.rmSync(hedef, { recursive: true, force: true });
  fs.mkdirSync(hedef, { recursive: true });
  fs.copyFileSync(ikili, uvYolu(araclar));
  if (!WIN) fs.chmodSync(uvYolu(araclar), 0o755);
  fs.rmSync(gecici, { recursive: true, force: true });
  return uvYolu(araclar);
}

// Döner: 'kurulu', 'kuruldu' ya da hata fırlatır. Yarım kalan kurulum bir sonraki denemede baştan yapılır.
export async function graphifyKur(env, araclar, { getir } = {}) {
  const kendi = path.join(binKlasoru(araclar), exe('graphify'));
  if (graphifyYolu(env, araclar)) return 'kurulu';
  fs.mkdirSync(graphifyKlasoru(araclar), { recursive: true });
  fs.rmSync(surumDosyasi(araclar), { force: true });
  let uv = uvYolu(araclar);
  if (!fs.existsSync(uv) || (await calistir(uv, ['--version'], { zamanAsimi: 20000 })).kod !== 0) uv = await uvIndir(araclar, getir);
  const s = await calistir(uv, ['tool', 'install', '--force', '--python', '3.12', GRAPHIFY_PAKET], { env: uvOrtami(env, araclar), cwd: graphifyKlasoru(araclar), zamanAsimi: 900000 });
  if (s.kod !== 0 || !fs.existsSync(kendi)) throw new Error((s.hata || s.cikti).trim().split('\n').pop() || 'graphify kurulamadı');
  fs.writeFileSync(surumDosyasi(araclar), GRAPHIFY_PAKET + '\n');
  // indirme önbelleği (~135 MB) kurulumdan sonra gerekmez
  fs.rmSync(uvOrtami(env, araclar).UV_CACHE_DIR, { recursive: true, force: true });
  return 'kuruldu';
}

// graphify-out/ depoya girmesin: yerel dışlama dosyasına yazılır (.gitignore değişmez, commit'e bir şey girmez)
export function gitDisla(klasor) {
  let git = path.join(klasor, '.git');
  try {
    const st = fs.statSync(git);
    if (st.isFile()) {
      // worktree ya da alt modül: ".git" dosyası asıl klasörü gösterir
      const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(git, 'utf8'));
      if (!m) return false;
      git = path.resolve(klasor, m[1].trim());
      const ortak = path.join(git, 'commondir');
      if (fs.existsSync(ortak)) git = path.resolve(git, fs.readFileSync(ortak, 'utf8').trim());
    } else if (!st.isDirectory()) return false;
  } catch {
    return false;
  }
  const dosya = path.join(git, 'info', 'exclude');
  let metin = '';
  try {
    metin = fs.readFileSync(dosya, 'utf8');
  } catch {
    /* dosya yoksa oluşturulur */
  }
  if (metin.split(/\r?\n/).some((s) => s.trim() === `${CIKTI}/` || s.trim() === CIKTI || s.trim() === `/${CIKTI}/`)) return true;
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  fs.writeFileSync(dosya, metin + (metin && !metin.endsWith('\n') ? '\n' : '') + `# Ajan Ofisi kod haritası\n${CIKTI}/\n`);
  return true;
}

// ---------- grafiği okuma ----------

const satirNo = (s) => {
  const m = /L(\d+)/.exec(String(s || ''));
  return m ? Number(m[1]) : undefined;
};

// graph.json'dan arama ve komşuluk için dizin çıkarır
export function grafikDizini(g) {
  const dugumler = Array.isArray(g && g.nodes) ? g.nodes.filter((n) => n && n.id != null) : [];
  const kimlik = new Map(dugumler.map((n) => [String(n.id), n]));
  const komsu = new Map();
  const ekle = (a, b, bag) => {
    if (!komsu.has(a)) komsu.set(a, []);
    komsu.get(a).push(bag);
  };
  const yonlu = !!(g && g.directed);
  for (const e of Array.isArray(g && (g.links || g.edges)) ? g.links || g.edges : []) {
    const a = String(e.source);
    const b = String(e.target);
    if (!kimlik.has(a) || !kimlik.has(b)) continue;
    const ortak = { iliski: e.relation || 'bağlı', dosya: e.source_file, satir: satirNo(e.source_location) };
    ekle(a, b, { ...ortak, hedef: b, yon: 'giden' });
    ekle(b, a, { ...ortak, hedef: a, yon: yonlu ? 'gelen' : 'giden' });
  }
  return { dugumler, kimlik, komsu };
}

const kucuk = (s) => String(s || '').toLocaleLowerCase('tr').replace(/\(\)$/, '');

// Sorguya göre düğüm puanı: ad tam eşleşme > ad başlangıcı > ad içinde > dosya yolunda
export function puanla(n, sorgu) {
  const q = kucuk(sorgu).trim();
  if (!q) return 0;
  const ad = kucuk(n.label);
  const yol = kucuk(n.source_file);
  if (ad === q || String(n.id) === sorgu) return 100;
  let p = 0;
  if (ad.startsWith(q)) p = 60;
  else if (ad.includes(q)) p = 40;
  else if (yol.endsWith('/' + q) || yol === q) p = 35;
  else if (yol.includes(q)) p = 20;
  else {
    // birden çok kelime: hepsi ad ya da yolda geçiyorsa
    const parcalar = q.split(/\s+/).filter(Boolean);
    if (parcalar.length > 1 && parcalar.every((k) => ad.includes(k) || yol.includes(k))) p = 25;
  }
  return p;
}

export class KodHaritasi {
  // yol: () => graphify yolu ya da null; env: () => kabuk ortamı; gunluk: (…) => void
  constructor({ yol, env, gunluk = () => {} }) {
    this.yol = yol;
    this.env = env;
    this.gunluk = gunluk;
    this.isler = new Map(); // klasör -> { zamanlayici, calisiyor, bekliyor, sonHata, sonZaman }
    this.onbellek = new Map(); // klasör -> { mtime, dizin }
  }

  grafikDosyasi(klasor) {
    return path.join(klasor, CIKTI, 'graph.json');
  }

  durum(klasor) {
    const i = this.isler.get(klasor) || {};
    let hazir = false;
    try {
      hazir = fs.statSync(this.grafikDosyasi(klasor)).isFile();
    } catch {
      /* henüz yok */
    }
    return { hazir, calisiyor: !!i.calisiyor, sonHata: i.sonHata || '', sonZaman: i.sonZaman || 0, graphify: !!this.yol() };
  }

  // Haritayı arka planda yeniler. gecikme: art arda gelen istekler tek güncellemede toplanır.
  guncelle(klasor, gecikme = 3000) {
    if (!klasor) return;
    const i = this.isler.get(klasor) || {};
    this.isler.set(klasor, i);
    if (i.calisiyor) {
      i.bekliyor = true;
      return;
    }
    clearTimeout(i.zamanlayici);
    i.zamanlayici = setTimeout(() => this.#calistir(klasor), gecikme);
    if (i.zamanlayici.unref) i.zamanlayici.unref();
  }

  // Hemen yeniler ve bitmesini bekler (harita_guncelle aracı için)
  async simdiGuncelle(klasor) {
    const i = this.isler.get(klasor) || {};
    this.isler.set(klasor, i);
    clearTimeout(i.zamanlayici);
    if (i.calisiyor) {
      i.bekliyor = true;
      await i.calisiyor;
      return this.durum(klasor);
    }
    await this.#calistir(klasor);
    return this.durum(klasor);
  }

  async #calistir(klasor) {
    const i = this.isler.get(klasor);
    const graphify = this.yol();
    if (!graphify) {
      i.sonHata = 'graphify henüz kurulmadı';
      return;
    }
    try {
      if (!fs.statSync(klasor).isDirectory()) return;
    } catch {
      return;
    }
    let bitti;
    i.calisiyor = new Promise((c) => (bitti = c));
    try {
      gitDisla(klasor);
      // --force: kod silindiğinde düğüm sayısı azalır; otomatik güncellemede bu meşrudur
      const s = await calistir(graphify, ['update', '.', '--force'], { env: graphifyOrtami(this.env()), cwd: klasor, zamanAsimi: 900000 });
      if (s.kod === 0) {
        i.sonHata = '';
        i.sonZaman = Date.now();
        this.onbellek.delete(klasor);
      } else {
        i.sonHata = (s.hata || s.cikti).trim().split('\n').pop() || 'graphify update başarısız';
        this.gunluk('harita', path.basename(klasor), i.sonHata);
      }
    } catch (e) {
      i.sonHata = String((e && e.message) || e);
      this.gunluk('harita', path.basename(klasor), i.sonHata);
    } finally {
      const tekrar = i.bekliyor;
      i.bekliyor = false;
      i.calisiyor = null;
      bitti();
      if (tekrar) this.guncelle(klasor, 1000);
    }
  }

  dizin(klasor) {
    const dosya = this.grafikDosyasi(klasor);
    let st;
    try {
      st = fs.statSync(dosya);
    } catch {
      return null;
    }
    const o = this.onbellek.get(klasor);
    if (o && o.mtime === st.mtimeMs) return o.dizin;
    const dizin = grafikDizini(JSON.parse(fs.readFileSync(dosya, 'utf8')));
    this.onbellek.set(klasor, { mtime: st.mtimeMs, dizin });
    return dizin;
  }

  rapor(klasor, sinir = 6000) {
    try {
      const m = fs.readFileSync(path.join(klasor, CIKTI, 'GRAPH_REPORT.md'), 'utf8');
      return m.length > sinir ? m.slice(0, sinir).trimEnd() + '\n…' : m;
    } catch {
      return '';
    }
  }
}

// ---------- ajan araçları ----------

const dugumOzeti = (n, d, depo) => ({
  dugum: String(n.id),
  ad: n.label,
  dosya: n.source_file,
  satir: satirNo(n.source_location),
  bolum: n.community_name,
  baglanti: (d.komsu.get(String(n.id)) || []).length,
  ...(depo ? { depo } : {}),
});

export const HARITA_ARAC_ADLARI = ['harita_ara', 'harita_komsular', 'harita_yol', 'harita_ozet', 'harita_guncelle'];

// depolar: () => [{ ad, klasor }] (katın ana klasörü ve ek depoları); harita: KodHaritasi
export function haritaAraclari({ depolar, harita }) {
  const coklu = () => depolar().length > 1;
  const sec = (depoAdi) => {
    const l = depolar();
    if (!depoAdi) return l;
    const d = l.find((x) => x.ad.toLowerCase() === String(depoAdi).toLowerCase());
    if (!d) throw new Error(`Bu katta "${depoAdi}" adlı depo yok. Depolar: ${l.map((x) => x.ad).join(', ')}`);
    return [d];
  };
  const hazirlar = (l) => {
    const sonuc = [];
    for (const d of l) {
      const dz = harita.dizin(d.klasor);
      if (dz) sonuc.push({ ...d, dz });
    }
    if (!sonuc.length) {
      const s = l.map((d) => harita.durum(d.klasor));
      if (s.some((x) => x.calisiyor)) throw new Error('Kod haritası şu an çıkarılıyor, bir dakika sonra yeniden dene. Bu arada dosyaları normal yoldan okuyabilirsin.');
      const h = s.find((x) => x.sonHata);
      throw new Error(`Bu katın kod haritası henüz yok${h ? ' (' + h.sonHata + ')' : ''}. harita_guncelle ile çıkarmayı dene; olmazsa dosyaları normal yoldan oku.`);
    }
    return sonuc;
  };
  const bul = (l, sorgu) => {
    let en = null;
    for (const d of l) {
      for (const n of d.dz.dugumler) {
        const p = puanla(n, sorgu);
        if (p && (!en || p > en.p || (p === en.p && (d.dz.komsu.get(String(n.id)) || []).length > (en.d.dz.komsu.get(String(en.n.id)) || []).length))) en = { p, n, d };
      }
    }
    return en;
  };
  const depoSema = { depo: { type: 'string', description: 'Çok depolu katta yalnızca bu depoda ara (ör. api, web). Boşsa hepsinde.' } };
  return {
    harita_ara: {
      aciklama: 'Kod haritasında ara: dosya, sınıf, fonksiyon ya da bileşen adıyla nerede tanımlandığını (dosya ve satır) ve hangi bölüme ait olduğunu verir. Grep ve dosya taramasından önce bunu kullan.',
      sema: { type: 'object', properties: { sorgu: { type: 'string', description: 'Ad ya da adın bir parçası (ör. "TradeWindow", "oturum.js", "kayıt defteri")' }, adet: { type: 'number', description: 'En çok kaç sonuç (varsayılan 20)' }, ...depoSema }, required: ['sorgu'] },
      calistir: async ({ sorgu, adet, depo }) => {
        const l = hazirlar(sec(depo));
        const n = Math.min(Math.max(Number(adet) || 20, 1), 100);
        const sonuc = [];
        for (const d of l) for (const x of d.dz.dugumler) {
          const p = puanla(x, sorgu);
          if (p) sonuc.push({ p, x, d });
        }
        sonuc.sort((a, b) => b.p - a.p || (b.d.dz.komsu.get(String(b.x.id)) || []).length - (a.d.dz.komsu.get(String(a.x.id)) || []).length);
        if (!sonuc.length) return `"${sorgu}" haritada bulunamadı. Başka bir ad dene ya da harita_ozet ile bölümlere bak.`;
        return { toplam: sonuc.length, sonuclar: sonuc.slice(0, n).map((s) => dugumOzeti(s.x, s.d.dz, coklu() ? s.d.ad : '')) };
      },
    },
    harita_komsular: {
      aciklama: 'Bir düğümün bağlantılarını verir: neyi çağırıyor, neyi içeriyor, kim onu kullanıyor (dosya ve satırla). Bir değişikliğin neyi etkileyeceğini görmek için kullan.',
      sema: { type: 'object', properties: { dugum: { type: 'string', description: 'harita_ara sonucundaki dugum kimliği ya da ad' }, adet: { type: 'number', description: 'En çok kaç bağlantı (varsayılan 40)' }, ...depoSema }, required: ['dugum'] },
      calistir: async ({ dugum, adet, depo }) => {
        const l = hazirlar(sec(depo));
        const en = bul(l, dugum);
        if (!en) return `"${dugum}" haritada bulunamadı. Önce harita_ara ile ara.`;
        const n = Math.min(Math.max(Number(adet) || 40, 1), 200);
        const baglar = (en.d.dz.komsu.get(String(en.n.id)) || []).slice(0, n).map((b) => {
          const h = en.d.dz.kimlik.get(b.hedef);
          return { iliski: b.iliski, yon: b.yon, ad: h.label, dugum: b.hedef, dosya: h.source_file, satir: satirNo(h.source_location) };
        });
        return { ...dugumOzeti(en.n, en.d.dz, coklu() ? en.d.ad : ''), baglar };
      },
    },
    harita_yol: {
      aciklama: 'İki düğüm arasındaki en kısa bağlantı zincirini verir (ör. bir arayüz penceresinden sunucu koduna nasıl ulaşıldığı).',
      sema: { type: 'object', properties: { baslangic: { type: 'string' }, hedef: { type: 'string' }, ...depoSema }, required: ['baslangic', 'hedef'] },
      calistir: async ({ baslangic, hedef, depo }) => {
        const l = hazirlar(sec(depo));
        const a = bul(l, baslangic);
        const b = bul(l, hedef);
        if (!a || !b) return `${!a ? baslangic : hedef} haritada bulunamadı.`;
        if (a.d !== b.d) return 'İki düğüm farklı depolarda; depolar arası yol yok.';
        const dz = a.d.dz;
        const bas = String(a.n.id);
        const son = String(b.n.id);
        const onceki = new Map([[bas, null]]);
        let sira = [bas];
        for (let derinlik = 0; derinlik < 12 && sira.length && !onceki.has(son); derinlik++) {
          const yeni = [];
          for (const u of sira) for (const k of dz.komsu.get(u) || []) {
            if (onceki.has(k.hedef)) continue;
            onceki.set(k.hedef, { u, iliski: k.iliski });
            yeni.push(k.hedef);
          }
          sira = yeni;
        }
        if (!onceki.has(son)) return 'Bu iki düğüm arasında 12 adımda bir bağlantı bulunamadı.';
        const zincir = [];
        for (let v = son; v; v = onceki.get(v) && onceki.get(v).u) {
          const n = dz.kimlik.get(v);
          zincir.unshift({ ad: n.label, dosya: n.source_file, satir: satirNo(n.source_location), iliski: onceki.get(v) ? onceki.get(v).iliski : undefined });
        }
        return { adim: zincir.length - 1, zincir };
      },
    },
    harita_ozet: {
      aciklama: 'Kod haritasının özeti: ana bölümler, en çok bağlantısı olan düğümler ve öne çıkan ilişkiler. Bir projeye başlarken ilk bunu oku.',
      sema: { type: 'object', properties: { ...depoSema } },
      calistir: async ({ depo }) => {
        const l = sec(depo);
        const parca = l.map((d) => {
          const r = harita.rapor(d.klasor, l.length > 1 ? 4000 : 8000);
          return (l.length > 1 ? `# ${d.ad}\n\n` : '') + (r || 'Bu depo için harita henüz yok.');
        });
        return parca.join('\n\n');
      },
    },
    harita_guncelle: {
      aciklama: 'Kod haritasını hemen yeniler ve bitmesini bekler. Harita ajanlar dosya değiştirdikçe kendiliğinden güncellenir; bunu yalnızca büyük bir yeniden düzenlemeden sonra ya da harita yoksa kullan.',
      sema: { type: 'object', properties: { ...depoSema } },
      calistir: async ({ depo }) => {
        const l = sec(depo);
        const sonuc = [];
        for (const d of l) {
          const s = await harita.simdiGuncelle(d.klasor);
          sonuc.push(`${d.ad}: ${s.hazir && !s.sonHata ? 'güncel' : 'güncellenemedi' + (s.sonHata ? ' (' + s.sonHata + ')' : '')}`);
        }
        return sonuc.join('\n');
      },
    },
  };
}
