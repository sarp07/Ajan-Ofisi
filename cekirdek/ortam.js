// Proje ortam değişkenleri (env). Bir katta tek repo, çoklu repo ya da monorepo olabilir; her biri "birim" olur:
// her deponun kökü, workspace paketleri (apps/web, packages/api …) ve .env.example taşıyan alt klasörler.
// Değerler işletim sisteminin şifreli deposunda durur; yalnızca ilgili klasörün .env dosyasına yazılır.
// Bilinen değerler kendiliğinden bağlanır: DATABASE_URL ortak Postgres'ten, PORT katın port bloğundan,
// başka bir birimin adresi (API_URL gibi) o birimin portundan. Port değişse de dosyalar doğru kalır.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

export const ORNEK_DOSYALAR = ['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.local.example', '.env.development.example', 'example.env'];
const MEVCUT_DOSYALAR = ['.env', '.env.local', '.env.development', '.env.development.local'];
const ATLA = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.expo', '.turbo', '.vercel', 'coverage', 'vendor', 'Pods', 'ios', 'android', '.venv', 'venv', '__pycache__', 'target', 'tmp', '.cache']);
const ANAHTAR = /^[A-Za-z_][A-Za-z0-9_.-]{0,120}$/;
const GIZLI = /(SECRET|TOKEN|PASSWORD|PASSWD|PASS$|PRIVATE|_KEY$|^KEY$|API_KEY|ACCESS_KEY|DSN|CREDENTIAL|AUTH|SALT|SIGNING|WEBHOOK)/i;
const ACIK_ONEK = /^(NEXT_PUBLIC_|VITE_|EXPO_PUBLIC_|PUBLIC_|REACT_APP_|NUXT_PUBLIC_)/;
const YER_TUTUCU = /^(|x+|your[-_ ].*|changeme|change[-_]me|replace[-_]?me|todo|<.*>|\.\.\.|xxx.*|sk-\.\.\.|\*+)$/i;
const DB_ANAHTAR = /^(DATABASE_URL|POSTGRES_URL|POSTGRES_PRISMA_URL|DB_URL|PG_URL|POSTGRESQL_URL|DATABASE_URI)$/;
const ADRES_ANAHTAR = /(API|BACKEND|SERVER|SERVICE|GRAPHQL|WS|SOCKET)_?(BASE_)?(URL|URI|ORIGIN|HOST|ENDPOINT)$/;
export const PROFILLER = ['gelistirme', 'test'];

export const anahtarGecerli = (a) => ANAHTAR.test(String(a || ''));
export const gizliMi = (a) => !ACIK_ONEK.test(a) && GIZLI.test(a);

// .env metnini ayrıştırır: export önekleri, tırnaklar, satır sonu yorumları
export function envAyristir(metin) {
  const sonuc = [];
  let yorum = '';
  for (const ham of String(metin || '').split(/\r?\n/)) {
    const satir = ham.trim();
    if (!satir) {
      yorum = '';
      continue;
    }
    if (satir.startsWith('#')) {
      yorum = satir.replace(/^#+\s*/, '').slice(0, 200);
      continue;
    }
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/.exec(satir);
    if (!m) continue;
    let deger = m[2];
    const q = deger[0];
    if ((q === '"' || q === "'" || q === '`') && deger.lastIndexOf(q) > 0) {
      deger = deger.slice(1, deger.lastIndexOf(q));
      if (q === '"') deger = deger.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } else {
      deger = deger.replace(/\s+#.*$/, '').trim();
    }
    sonuc.push({ anahtar: m[1], deger, yorum });
    yorum = '';
  }
  return sonuc;
}

const tirnakla = (v) => (/^[A-Za-z0-9_./:@%+,=-]*$/.test(v) ? v : JSON.stringify(v));

// Var olan dosyadaki satırları korur; yönetilen anahtarların değerini değiştirir, olmayanları sona ekler
export function envBirlestir(mevcut, degerler) {
  const kalan = new Map(Object.entries(degerler));
  const satirlar = String(mevcut || '')
    .split(/\r?\n/)
    .map((s) => {
      const m = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_.-]*)(\s*=).*$/.exec(s);
      if (!m || !kalan.has(m[2])) return s;
      const v = kalan.get(m[2]);
      kalan.delete(m[2]);
      return `${m[1]}${m[2]}${m[3]}${tirnakla(v)}`;
    });
  while (satirlar.length && satirlar[satirlar.length - 1] === '') satirlar.pop();
  if (kalan.size) {
    if (satirlar.length) satirlar.push('');
    if (!satirlar.some((s) => s.startsWith('# Ajan Ofisi'))) satirlar.push('# Ajan Ofisi: değerler uygulamada şifreli durur, buradan da düzenleyebilirsin');
    for (const [a, v] of kalan) satirlar.push(`${a}=${tirnakla(v)}`);
  }
  return satirlar.join('\n') + '\n';
}

function jsonOku(dosya) {
  try {
    return JSON.parse(fs.readFileSync(dosya, 'utf8'));
  } catch {
    return null;
  }
}

// Birimin çatısı: hangi .env dosyasını okuduğunu belirler
export function catiBul(klasor) {
  const pj = jsonOku(path.join(klasor, 'package.json'));
  const bag = pj ? { ...pj.dependencies, ...pj.devDependencies } : {};
  if (bag.next) return 'next';
  if (bag.expo) return 'expo';
  if (bag.vite || bag['@vitejs/plugin-react']) return 'vite';
  if (bag.astro) return 'astro';
  if (bag.nuxt) return 'nuxt';
  if (bag['@remix-run/node'] || bag['@react-router/dev']) return 'remix';
  if (bag['@nestjs/core']) return 'nest';
  if (bag['react-native']) return 'react-native';
  if (pj) return 'node';
  if (fs.existsSync(path.join(klasor, 'pyproject.toml')) || fs.existsSync(path.join(klasor, 'requirements.txt'))) return 'python';
  if (fs.existsSync(path.join(klasor, 'go.mod'))) return 'go';
  return '';
}

// Çatının geliştirmede okuduğu dosya. Next, Vite, Expo, Astro, Nuxt .env.local'i okur; dotenv yalnızca .env'i.
export function varsayilanDosya(cati) {
  return ['next', 'vite', 'expo', 'astro', 'nuxt'].includes(cati) ? '.env.local' : '.env';
}

// Workspace kalıpları: package.json workspaces ve pnpm-workspace.yaml
function workspaceKaliplari(kok) {
  const pj = jsonOku(path.join(kok, 'package.json'));
  let k = [];
  if (pj && Array.isArray(pj.workspaces)) k = pj.workspaces;
  else if (pj && pj.workspaces && Array.isArray(pj.workspaces.packages)) k = pj.workspaces.packages;
  try {
    const y = fs.readFileSync(path.join(kok, 'pnpm-workspace.yaml'), 'utf8');
    const blok = /packages\s*:\s*\n((?:\s*-\s*.+\n?)+)/.exec(y);
    if (blok) k = k.concat(blok[1].split('\n').map((s) => s.replace(/^\s*-\s*/, '').replace(/['"]/g, '').trim()).filter(Boolean));
  } catch {}
  return k.filter((x) => typeof x === 'string' && !x.startsWith('!'));
}

function kaliptanKlasorler(kok, kalip) {
  const temiz = kalip.replace(/\/\*\*?$/, '').replace(/^\.\//, '');
  const tam = path.join(kok, temiz);
  if (!tam.startsWith(kok)) return [];
  if (/\*/.test(temiz)) return [];
  if (/\/\*\*?$/.test(kalip)) {
    try {
      return fs
        .readdirSync(tam, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !ATLA.has(e.name) && !e.name.startsWith('.'))
        .map((e) => path.join(tam, e.name))
        .filter((d) => fs.existsSync(path.join(d, 'package.json')));
    } catch {
      return [];
    }
  }
  return fs.existsSync(path.join(tam, 'package.json')) ? [tam] : [];
}

// .env örneği taşıyan alt klasörler (en çok 3 kat derin)
function ornekTasiyanlar(kok, derinlik = 3) {
  const bulunan = [];
  const gez = (d, k) => {
    if (k > derinlik || bulunan.length > 40) return;
    let girdiler;
    try {
      girdiler = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    if (d !== kok && girdiler.some((e) => e.isFile() && ORNEK_DOSYALAR.includes(e.name))) bulunan.push(d);
    for (const e of girdiler) if (e.isDirectory() && !ATLA.has(e.name) && !e.name.startsWith('.')) gez(path.join(d, e.name), k + 1);
  };
  gez(kok, 0);
  return bulunan;
}

function dosyaOku(klasor, adlar) {
  const sonuc = [];
  for (const ad of adlar) {
    try {
      const metin = fs.readFileSync(path.join(klasor, ad), 'utf8');
      sonuc.push({ dosya: ad, satirlar: envAyristir(metin) });
    } catch {}
  }
  return sonuc;
}

const uygulamaMi = (klasor, cati) => {
  if (['next', 'vite', 'expo', 'nest', 'astro', 'nuxt', 'remix', 'react-native'].includes(cati)) return true;
  const pj = jsonOku(path.join(klasor, 'package.json'));
  return !!(pj && pj.scripts && (pj.scripts.start || pj.scripts.dev));
};

// depolar: [{ id, ad, klasor }]. Döner: birimler (kök her zaman, sonra paketler)
export function birimleriBul(depolar) {
  const birimler = [];
  const cokDepo = depolar.length > 1;
  for (const d of depolar) {
    if (!d.klasor || !fs.existsSync(d.klasor)) continue;
    const kok = path.resolve(d.klasor);
    const klasorler = new Set([kok]);
    for (const k of workspaceKaliplari(kok)) for (const x of kaliptanKlasorler(kok, k)) klasorler.add(x);
    for (const x of ornekTasiyanlar(kok)) klasorler.add(x);
    for (const klasor of [...klasorler].slice(0, 40)) {
      const yol = path.relative(kok, klasor).split(path.sep).join('/') || '.';
      const cati = catiBul(klasor);
      const ornek = dosyaOku(klasor, ORNEK_DOSYALAR);
      const mevcut = dosyaOku(klasor, MEVCUT_DOSYALAR);
      // monorepo kökü kendi env'i yoksa gösterilmez: değişkenler paketlerdedir
      if (yol === '.' && klasorler.size > 1 && !ornek.length && !mevcut.length) continue;
      // paket olup env örneği ya da env dosyası olmayan birim gösterilmez (kök hariç)
      // ve kütüphane paketleri (ui-kit gibi) gösterilmez: yalnızca çalışan uygulamalar
      if (yol !== '.' && !ornek.length && !mevcut.length && !uygulamaMi(klasor, cati)) continue;
      const kisa = yol === '.' ? d.ad : path.basename(klasor);
      birimler.push({
        id: `${d.id}:${yol}`,
        depoId: d.id,
        depo: d.ad,
        yol,
        klasor,
        ad: yol === '.' ? d.ad : cokDepo ? `${d.ad}/${yol}` : yol,
        kisa: kisa.toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
        cati,
        ornek: ornek.flatMap((o) => o.satirlar.map((s) => ({ ...s, dosya: o.dosya }))),
        mevcut: mevcut.flatMap((o) => o.satirlar.map((s) => ({ ...s, dosya: o.dosya }))),
      });
    }
  }
  return birimler;
}

// Kayıtlı veri: { genel: { KEY: { deger, test?, gizli } }, birimler: { id: { dosya?, degiskenler: { KEY: {...} } } } }
export function bosVeri() {
  return { genel: {}, birimler: {} };
}

export function veriDuzelt(ham) {
  const v = bosVeri();
  if (!ham || typeof ham !== 'object') return v;
  const dd = (o) => {
    const c = {};
    for (const [a, x] of Object.entries(o || {})) {
      if (!anahtarGecerli(a) || !x || typeof x !== 'object') continue;
      c[a] = { deger: String(x.deger ?? ''), gizli: !!x.gizli, ...(typeof x.test === 'string' ? { test: x.test } : {}) };
    }
    return c;
  };
  v.genel = dd(ham.genel);
  for (const [id, b] of Object.entries(ham.birimler || {})) {
    if (!b || typeof b !== 'object') continue;
    v.birimler[id] = { degiskenler: dd(b.degiskenler), ...(typeof b.dosya === 'string' && /^\.env[\w.-]*$|^[\w-]+\.env$/.test(b.dosya) ? { dosya: b.dosya } : {}) };
  }
  return v;
}

// Kayıtlı değeri olmayan bir anahtar için kendiliğinden bağ önerisi (ifade)
export function otomatikIfade(anahtar, birim, birimler) {
  if (DB_ANAHTAR.test(anahtar)) return '${db}';
  if (anahtar === 'PORT') return '${port:' + birim.kisa + '}';
  if (ADRES_ANAHTAR.test(anahtar.replace(ACIK_ONEK, ''))) {
    const hedef = birimler.find((b) => b.id !== birim.id && /^(api|server|backend|service|gateway)/.test(b.kisa));
    if (hedef) return 'http://localhost:${port:' + hedef.kisa + '}';
  }
  return '';
}

const ornekDeger = (v) => (YER_TUTUCU.test(String(v || '').trim()) ? '' : String(v));

// Bir birimin bütün değişkenleri ve durumu (arayüz ve ajan aracı için; değer gösterilmez)
export function birimDurumu(birim, veri, birimler) {
  const kayitli = (veri.birimler[birim.id] && veri.birimler[birim.id].degiskenler) || {};
  const anahtarlar = new Map();
  const ekle = (a, alan) => anahtarlar.set(a, { ...(anahtarlar.get(a) || {}), ...alan });
  for (const o of birim.ornek) ekle(o.anahtar, { ornekte: true, ornekDeger: ornekDeger(o.deger), aciklama: o.yorum || '' });
  for (const m of birim.mevcut) ekle(m.anahtar, { dosyada: true });
  for (const a of Object.keys(veri.genel)) if (anahtarlar.has(a)) ekle(a, { genelden: true });
  for (const a of Object.keys(kayitli)) ekle(a, { kayitli: true });
  const liste = [];
  for (const [anahtar, x] of anahtarlar) {
    const k = kayitli[anahtar] || (x.genelden ? veri.genel[anahtar] : null);
    const ifade = otomatikIfade(anahtar, birim, birimler);
    let durum;
    let deger = '';
    if (k && k.deger !== '') {
      durum = x.kayitli ? 'kayitli' : 'genel';
      deger = k.deger;
    } else if (ifade) {
      durum = 'otomatik';
      deger = ifade;
    } else if (x.ornekDeger) {
      durum = 'ornek';
      deger = x.ornekDeger;
    } else if (x.dosyada) {
      durum = 'dosyada';
    } else durum = 'eksik';
    const gizli = k ? !!k.gizli : gizliMi(anahtar);
    const bag = /\$\{(db|port|env)/.test(deger);
    liste.push({
      anahtar,
      durum,
      gizli,
      aciklama: x.aciklama || '',
      ornekte: !!x.ornekte,
      dosyada: !!x.dosyada,
      testFarkli: !!(k && typeof k.test === 'string'),
      // gizli olmayan ve bağ ifadeleri görünür, gizli değerler yalnızca maskelenir
      gorunen: bag || !gizli ? deger : deger ? '•'.repeat(Math.min(12, Math.max(6, deger.length))) : '',
    });
  }
  liste.sort((a, b) => (b.durum === 'eksik') - (a.durum === 'eksik') || a.anahtar.localeCompare(b.anahtar));
  return liste;
}

// İfadeleri çözer: ${db}, ${db:test}, ${port:ad}, ${env:KEY}
export async function ifadeCoz(deger, { db, testDb, port, genel }, profil) {
  const parcalar = [];
  const re = /\$\{(db|port|env)(?::([A-Za-z0-9_.-]+))?\}/g;
  let son = 0;
  let m;
  while ((m = re.exec(deger))) {
    parcalar.push(deger.slice(son, m.index));
    if (m[1] === 'db') parcalar.push(profil === 'test' || m[2] === 'test' ? await testDb() : await db());
    else if (m[1] === 'port') parcalar.push(String(await port(m[2] || 'app')));
    else parcalar.push(genel[m[2]] ? genel[m[2]].deger : '');
    son = re.lastIndex;
  }
  parcalar.push(deger.slice(son));
  return parcalar.join('');
}

function gitYoksay(depoKok, dosyaYolu) {
  return new Promise((coz) => {
    execFile('git', ['-C', depoKok, 'check-ignore', '-q', dosyaYolu], { timeout: 8000 }, (hata) => {
      if (!hata) return coz('yoksayiliyor');
      coz(hata.code === 1 ? 'izleniyor' : 'git-yok');
    });
  });
}

// Birimlerin env dosyalarını yazar. bag: { db(), testDb(), port(ad) }. Döner: rapor
export async function dosyalariYaz(birimler, depolar, veri, bag, profil = 'gelistirme') {
  const rapor = [];
  for (const b of birimler) {
    const kayit = veri.birimler[b.id] || { degiskenler: {} };
    const durum = birimDurumu(b, veri, birimler);
    const degerler = {};
    const eksik = [];
    for (const d of durum) {
      const k = kayit.degiskenler[d.anahtar] || (veri.genel[d.anahtar] && d.durum === 'genel' ? veri.genel[d.anahtar] : null);
      let ham = '';
      if (k) ham = profil === 'test' && typeof k.test === 'string' ? k.test : k.deger;
      else if (d.durum === 'otomatik') ham = otomatikIfade(d.anahtar, b, birimler);
      else if (d.durum === 'ornek') ham = d.gorunen;
      if (d.durum === 'eksik') eksik.push(d.anahtar);
      if (!ham) continue;
      try {
        degerler[d.anahtar] = await ifadeCoz(ham, { ...bag, genel: veri.genel }, profil);
      } catch (e) {
        eksik.push(d.anahtar);
        rapor.push({ birim: b.ad, hata: `${d.anahtar}: ${e.message || e}` });
      }
    }
    // kayıtlı ya da bağlanmış hiçbir değer yoksa dosyaya dokunulmaz
    const yonetilen = Object.keys(degerler).filter((a) => kayit.degiskenler[a] || veri.genel[a] || otomatikIfade(a, b, birimler));
    if (!yonetilen.length) {
      rapor.push({ birim: b.ad, dosya: null, yazilan: 0, eksik });
      continue;
    }
    const dosya = profil === 'test' ? '.env.test' : kayit.dosya || varsayilanDosya(b.cati);
    const tam = path.join(b.klasor, dosya);
    let mevcut = '';
    try {
      mevcut = fs.readFileSync(tam, 'utf8');
    } catch {}
    const yazilacak = {};
    for (const a of yonetilen) yazilacak[a] = degerler[a];
    const yeni = envBirlestir(mevcut, yazilacak);
    if (yeni !== mevcut) fs.writeFileSync(tam, yeni, { mode: 0o600 });
    // dosya git'e girmesin: deponun kökündeki .gitignore'a eklenir
    const depo = depolar.find((d) => d.id === b.depoId);
    let git = 'git-yok';
    if (depo) {
      git = await gitYoksay(depo.klasor, tam);
      if (git === 'izleniyor') {
        const gi = path.join(depo.klasor, '.gitignore');
        const satir = path.relative(depo.klasor, tam).split(path.sep).join('/');
        let eski = '';
        try {
          eski = fs.readFileSync(gi, 'utf8');
        } catch {}
        fs.writeFileSync(gi, eski + (eski && !eski.endsWith('\n') ? '\n' : '') + `# Ajan Ofisi: ortam dosyası\n${satir}\n`);
        git = 'eklendi';
      }
    }
    rapor.push({ birim: b.ad, dosya: path.relative(depo ? depo.klasor : b.klasor, tam), yazilan: yonetilen.length, eksik, git });
  }
  return rapor;
}

// ---------- ajan araçları ----------
const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });

// ops: { liste(), koy(birim, anahtar, deger, gizli), yaz(profil) }
export function ortamAraclari(ops) {
  return {
    ortam_listele: {
      aciklama: 'Katın ortam değişkenlerini birim birim listeler (her repo kökü ve monorepo paketi bir birimdir): hangi anahtar dolu, hangisi otomatik bağlı (veritabanı, port), hangisi eksik. Gizli değerler gösterilmez.',
      sema: nesne({}),
      calistir: async () => ops.liste(),
    },
    ortam_yaz: {
      aciklama: 'Bir birime ortam değişkeni kaydeder ve .env dosyasını günceller. Değer şifreli saklanır. ${db} ortak veritabanını, ${port:api} katın api portunu, ${env:KEY} genel değeri bağlar. birim boşsa ya da "genel" ise bütün birimlere gider. Gizli değeri sohbete ya da rapora yazma.',
      sema: nesne({ birim: yazi('Birim adı ya da kimliği (ortam_listele çıktısındaki), boşsa genel'), anahtar: yazi('Değişken adı, ör. STRIPE_SECRET_KEY'), deger: yazi('Değer ya da ${db}, ${port:ad} ifadesi'), gizli: { type: 'boolean' } }, ['anahtar', 'deger']),
      calistir: async (g) => ops.koy(String(g.birim || 'genel'), String(g.anahtar), String(g.deger), g.gizli),
    },
    ortam_uygula: {
      aciklama: 'Bütün birimlerin .env dosyalarını kayıtlı değerlerden yeniden yazar (gelistirme: .env ya da .env.local, test: .env.test). Port ya da veritabanı değiştiğinde çalıştır.',
      sema: nesne({ profil: { type: 'string', enum: PROFILLER } }),
      calistir: async (g) => ops.yaz(g.profil === 'test' ? 'test' : 'gelistirme'),
    },
  };
}

export const ORTAM_ARAC_ADLARI = ['ortam_listele', 'ortam_yaz', 'ortam_uygula'];
