// Skill yönetimi: kurulu skiller uygulamanın veri klasöründe durur (skiller/<id>/SKILL.md).
// Kaynaklar: hazır katalog (GitHub'dan sabit sürümle indirilir), GitHub adresi, yerel klasör, elle yazılan.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { kod } from './kimlik.js';

const BURASI = path.dirname(fileURLToPath(import.meta.url));
const KATALOG_DOSYA = path.join(BURASI, '..', 'katalog', 'skiller.json');
const BOYUT_SINIRI = 60 * 1024 * 1024;
const DOSYA_SINIRI = 4000;
const ATLA = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__']);

export function katalogOku() {
  return JSON.parse(fs.readFileSync(KATALOG_DOSYA, 'utf8'));
}

// SKILL.md başlığından ad ve açıklamayı okur (basit YAML: tek satır ya da katlanmış değer)
export function skillBaslik(metin) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(metin);
  const sonuc = { ad: '', aciklama: '', lisans: '' };
  if (!m) return sonuc;
  const satirlar = m[1].split(/\r?\n/);
  const oku = (anahtar) => {
    const i = satirlar.findIndex((s) => new RegExp('^' + anahtar + '\\s*:').test(s));
    if (i < 0) return '';
    let v = satirlar[i].replace(new RegExp('^' + anahtar + '\\s*:\\s*'), '');
    if (/^[>|][+-]?\s*$/.test(v) || v === '') {
      const parca = [];
      for (let k = i + 1; k < satirlar.length && /^\s+\S/.test(satirlar[k]); k++) parca.push(satirlar[k].trim());
      v = parca.join(' ');
    }
    v = v.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  };
  sonuc.ad = oku('name');
  sonuc.aciklama = oku('description');
  sonuc.lisans = oku('license');
  return sonuc;
}

function boyutOlc(klasor) {
  let bayt = 0;
  let adet = 0;
  const gez = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (ATLA.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) gez(p);
      else if (e.isFile()) {
        bayt += fs.statSync(p).size;
        adet++;
      }
    }
  };
  gez(klasor);
  return { bayt, adet };
}

// Klasörü güvenli kopyalar: sembolik bağ yok, gereksiz klasör yok
function guvenliKopya(kaynak, hedef) {
  fs.mkdirSync(hedef, { recursive: true });
  for (const e of fs.readdirSync(kaynak, { withFileTypes: true })) {
    if (ATLA.has(e.name) || e.isSymbolicLink()) continue;
    const k = path.join(kaynak, e.name);
    const h = path.join(hedef, e.name);
    if (e.isDirectory()) guvenliKopya(k, h);
    else if (e.isFile()) fs.copyFileSync(k, h);
  }
}

// Bir klasörün altında SKILL.md içeren klasörleri bulur (en çok 4 seviye)
export function skillKlasorleriBul(kok, derinlik = 4) {
  const bulunan = [];
  const gez = (d, n) => {
    if (fs.existsSync(path.join(d, 'SKILL.md'))) {
      bulunan.push(d);
      return;
    }
    if (n <= 0) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.isSymbolicLink() || ATLA.has(e.name)) continue;
      gez(path.join(d, e.name), n - 1);
    }
  };
  gez(kok, derinlik);
  return bulunan;
}

const depoAdiMi = (r) => /^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9_][\w.-]*$/.test(String(r)) && !String(r).split('/').some((x) => x === '.' || x === '..');

// GitHub adresini çözer: "sahip/depo", "sahip/depo/yol", tam adres, /tree/dal/yol biçimleri
export function githubCoz(girdi) {
  let s = String(girdi || '').trim();
  s = s.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '');
  const p = s.split('/').filter(Boolean);
  if (p.length < 2 || !depoAdiMi(p[0] + '/' + p[1])) return null;
  let ref = '';
  let yol = p.slice(2);
  if (yol[0] === 'tree' || yol[0] === 'blob') {
    ref = yol[1] || '';
    yol = yol.slice(2);
  }
  if (yol[yol.length - 1] === 'SKILL.md') yol = yol.slice(0, -1);
  if (yol.some((x) => x === '..' || x === '.')) return null;
  return { repo: p[0] + '/' + p[1], yol: yol.join('/'), ref };
}

export class SkillDeposu {
  // indir: (repo, ref) => arşiv dosyasının yolu. Sınamalarda değiştirilebilir.
  constructor(klasor, { indir } = {}) {
    this.klasor = klasor;
    this.indir = indir || varsayilanIndir;
    fs.mkdirSync(klasor, { recursive: true });
  }

  liste() {
    const sonuc = [];
    for (const e of fs.readdirSync(this.klasor, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const dir = path.join(this.klasor, e.name);
      const dosya = path.join(dir, 'SKILL.md');
      if (!fs.existsSync(dosya)) continue;
      const b = skillBaslik(fs.readFileSync(dosya, 'utf8'));
      let kayit = {};
      try {
        kayit = JSON.parse(fs.readFileSync(path.join(dir, '.ofis.json'), 'utf8'));
      } catch {
        kayit = {};
      }
      sonuc.push({ id: e.name, ad: b.ad || e.name, aciklama: b.aciklama, lisans: kayit.lisans || b.lisans || '', kaynak: kayit.kaynak || { tur: 'bilinmiyor' }, kurulum: kayit.kurulum || 0, klasor: dir });
    }
    return sonuc.sort((a, b) => a.id.localeCompare(b.id));
  }

  _yerlestir(kaynakKlasor, kayit, istenenId) {
    const dosya = path.join(kaynakKlasor, 'SKILL.md');
    if (!fs.existsSync(dosya)) throw new Error('SKILL.md bulunamadı');
    const olcu = boyutOlc(kaynakKlasor);
    if (olcu.bayt > BOYUT_SINIRI || olcu.adet > DOSYA_SINIRI) throw new Error('Skill çok büyük');
    const b = skillBaslik(fs.readFileSync(dosya, 'utf8'));
    const id = kod(istenenId || b.ad || path.basename(kaynakKlasor));
    const hedef = path.join(this.klasor, id);
    const gecici = hedef + '.yeni';
    fs.rmSync(gecici, { recursive: true, force: true });
    guvenliKopya(kaynakKlasor, gecici);
    fs.writeFileSync(path.join(gecici, '.ofis.json'), JSON.stringify({ ...kayit, kurulum: Date.now() }, null, 2));
    fs.rmSync(hedef, { recursive: true, force: true });
    fs.renameSync(gecici, hedef);
    return id;
  }

  klasordenEkle(kaynak) {
    const kok = path.resolve(kaynak);
    const bulunan = skillKlasorleriBul(kok);
    if (!bulunan.length) throw new Error('Bu klasörde SKILL.md bulunamadı');
    return bulunan.slice(0, 40).map((d) => this._yerlestir(d, { kaynak: { tur: 'klasor', yol: d } }));
  }

  async githubdanEkle({ repo, yol = '', ref = '', lisans = '', id = '' }) {
    if (!depoAdiMi(repo)) throw new Error('Geçersiz depo adı');
    const gecici = fs.mkdtempSync(path.join(os.tmpdir(), 'ofis-skill-'));
    try {
      const inen = await this.indir(repo, ref || 'HEAD', gecici);
      let acik;
      if (inen.klasor) {
        acik = inen.klasor;
      } else {
        acik = path.join(gecici, 'acik');
        fs.mkdirSync(acik);
        const tar = await import('tar');
        await tar.x({
          file: inen.arsiv,
          cwd: acik,
          strip: 1,
          // yalnızca düz dosya ve klasör: bağlar ve özel dosyalar alınmaz
          filter: (p, girdi) => girdi.type === 'File' || girdi.type === 'Directory',
        });
      }
      const kok = yol ? path.join(acik, ...yol.split('/')) : acik;
      if (!kok.startsWith(acik) || !fs.existsSync(kok)) throw new Error('Depoda bu yol yok: ' + yol);
      const bulunan = skillKlasorleriBul(kok);
      if (!bulunan.length) throw new Error('Depoda SKILL.md bulunamadı');
      return bulunan.slice(0, 40).map((d) =>
        this._yerlestir(d, { kaynak: { tur: 'github', repo, yol: path.relative(acik, d).split(path.sep).join('/'), ref }, lisans }, bulunan.length === 1 ? id : '')
      );
    } finally {
      fs.rmSync(gecici, { recursive: true, force: true });
    }
  }

  async katalogdanKur(id) {
    const k = katalogOku().find((x) => x.id === id);
    if (!k) throw new Error('Katalogda yok: ' + id);
    const kurulan = await this.githubdanEkle({ repo: k.repo, yol: k.yol, ref: k.ref, lisans: k.lisans, id: k.id });
    for (const ek of k.birlikte || []) kurulan.push(...(await this.katalogdanKur(ek)));
    return kurulan;
  }

  yeniYaz({ ad, aciklama, govde }) {
    const id = kod(ad);
    if (!id || !String(aciklama || '').trim()) throw new Error('Ad ve açıklama gerekli');
    const hedef = path.join(this.klasor, id);
    fs.mkdirSync(hedef, { recursive: true });
    const metin = `---\nname: ${id}\ndescription: ${JSON.stringify(String(aciklama).trim())}\n---\n\n${String(govde || '').trim()}\n`;
    fs.writeFileSync(path.join(hedef, 'SKILL.md'), metin);
    fs.writeFileSync(path.join(hedef, '.ofis.json'), JSON.stringify({ kaynak: { tur: 'elle' }, kurulum: Date.now() }, null, 2));
    return id;
  }

  // Kimlik yalnızca kendi klasörümüzdeki bir alt klasörü gösterebilir. Yol gibi görünen her şey reddedilir.
  yol(id) {
    const ad = String(id || '');
    if (!ad || kod(ad) !== ad) throw new Error('Geçersiz skill');
    return path.join(this.klasor, ad);
  }

  oku(id) {
    return fs.readFileSync(path.join(this.yol(id), 'SKILL.md'), 'utf8');
  }

  sil(id) {
    fs.rmSync(this.yol(id), { recursive: true, force: true });
  }
}

// Önce GitHub'ın arşiv sunucusu denenir. Ağ buna izin vermiyorsa ve git kuruluysa git ile alınır.
async function varsayilanIndir(repo, ref, gecici) {
  let ilkHata;
  try {
    const adres = `https://codeload.github.com/${repo}/tar.gz/${encodeURIComponent(ref)}`;
    const yanit = await fetch(adres, { redirect: 'follow' });
    if (!yanit.ok) throw new Error(`İndirilemedi (${yanit.status}): ${repo}`);
    const tampon = Buffer.from(await yanit.arrayBuffer());
    if (tampon.length > BOYUT_SINIRI * 3) throw new Error('Depo çok büyük');
    const dosya = path.join(gecici, 'arsiv.tgz');
    fs.writeFileSync(dosya, tampon);
    return { arsiv: dosya };
  } catch (e) {
    ilkHata = e;
  }
  const klasor = path.join(gecici, 'git');
  fs.mkdirSync(klasor);
  const git = (arg) =>
    new Promise((coz, reddet) => {
      execFile('git', arg, { cwd: klasor, timeout: 120000, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (hata) => (hata ? reddet(hata) : coz()));
    });
  try {
    await git(['init', '-q']);
    await git(['fetch', '-q', '--depth', '1', `https://github.com/${repo}.git`, ref]);
    await git(['-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD']);
    return { klasor };
  } catch {
    throw ilkHata;
  }
}
