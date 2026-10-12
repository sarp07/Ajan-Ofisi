// GitHub ve git: giriş GitHub CLI'nin (gh) kendi tarayıcı akışıyla yapılır, uygulama şifre ya da jeton görmez.
// Repo durumu salt okunur komutlarla okunur (git status, git log, gh pr list). Hiçbir şey değiştirilmez.
import fs from 'node:fs';
import path from 'node:path';
import { yolAra, calistir } from './claude.js';

const WIN = process.platform === 'win32';

export function ghBul(env) {
  const adaylar = [yolAra(env, 'gh'), ...(WIN ? [] : ['/opt/homebrew/bin/gh', '/usr/local/bin/gh', '/usr/bin/gh'])].filter(Boolean);
  return adaylar.find((y) => {
    try {
      return fs.statSync(y).isFile();
    } catch {
      return false;
    }
  }) || null;
}

export function gitBul(env) {
  return yolAra(env, 'git');
}

export function ghKurulumKomutu() {
  return WIN ? 'winget install --id GitHub.cli' : process.platform === 'darwin' ? 'brew install gh' : 'sudo apt install gh';
}

// Döner: { girisli, hesap }
export async function ghDurum(yol, env) {
  if (!yol) return { girisli: false };
  const s = await calistir(yol, ['auth', 'status', '--hostname', 'github.com'], { env, zamanAsimi: 20000 });
  const metin = s.cikti + '\n' + s.hata;
  const m = /account\s+(\S+)/i.exec(metin);
  return { girisli: s.kod === 0 && /logged in/i.test(metin), hesap: m ? m[1] : '' };
}

export const ghGirisArg = ['auth', 'login', '--web', '--hostname', 'github.com', '--git-protocol', 'https'];

// Projenin git ve GitHub durumu. Klasör git deposu değilse { depo: false }.
export async function repoDurumu({ git, gh, env, klasor }) {
  if (!git || !klasor) return { depo: false };
  const calis = (arg) => calistir(git, ['-C', klasor, ...arg], { env, zamanAsimi: 15000 });
  const kok = await calis(['rev-parse', '--show-toplevel']);
  if (kok.kod !== 0) return { depo: false };
  const [dal, uzak, durum, kayitlar, fark] = await Promise.all([
    calis(['branch', '--show-current']),
    calis(['remote', 'get-url', 'origin']),
    calis(['status', '--porcelain']),
    calis(['log', '-8', '--pretty=format:%h%x09%an%x09%ar%x09%s']),
    calis(['rev-list', '--left-right', '--count', '@{upstream}...HEAD']),
  ]);
  const [geride, ileride] = fark.kod === 0 ? fark.cikti.trim().split(/\s+/).map(Number) : [null, null];
  const sonuc = {
    depo: true,
    kok: kok.cikti.trim(),
    dal: dal.cikti.trim(),
    uzak: uzak.kod === 0 ? uzak.cikti.trim() : '',
    degisen: durum.cikti.split('\n').filter(Boolean).length,
    geride,
    ileride,
    kayitlar: kayitlar.cikti
      .split('\n')
      .filter(Boolean)
      .map((x) => {
        const [kisa, yazar, zaman, ...konu] = x.split('\t');
        return { kisa, yazar, zaman, konu: konu.join('\t') };
      }),
    prler: [],
    githubAdres: '',
  };
  const m = /github\.com[:/]([^/]+\/[^/.]+?)(\.git)?$/.exec(sonuc.uzak);
  if (m) sonuc.githubAdres = 'https://github.com/' + m[1];
  if (gh && m) {
    const pr = await calistir(gh, ['pr', 'list', '--repo', m[1], '--json', 'number,title,headRefName,url,isDraft,author', '--limit', '10'], { env, cwd: klasor, zamanAsimi: 20000 });
    if (pr.kod === 0) {
      try {
        sonuc.prler = JSON.parse(pr.cikti).map((p) => ({ no: p.number, baslik: p.title, dal: p.headRefName, adres: p.url, taslak: !!p.isDraft, yazar: p.author && p.author.login }));
      } catch {
        sonuc.prler = [];
      }
    } else sonuc.prHata = (pr.hata || '').trim().split('\n').pop();
  }
  return sonuc;
}

export const klasorVar = (k) => {
  try {
    return fs.statSync(path.resolve(k)).isDirectory();
  } catch {
    return false;
  }
};

// ---------- proje açma ve git işlemleri ----------
// Klasör adı: harf, rakam, tire. Türkçe karakterler sadeleşir.
export function klasorAdi(ad) {
  const tr = { ş: 's', Ş: 's', ı: 'i', İ: 'i', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
  return String(ad || '')
    .replace(/[şŞıİğĞüÜöÖçÇ]/g, (c) => tr[c])
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function repoListesi({ gh, env }) {
  if (!gh) throw new Error('GitHub CLI (gh) bulunamadı');
  const s = await calistir(gh, ['repo', 'list', '--limit', '200', '--json', 'nameWithOwner,name,description,isPrivate,updatedAt'], { env, zamanAsimi: 30000 });
  if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').pop() || 'Repolar okunamadı');
  return JSON.parse(s.cikti)
    .map((r) => ({ tam: r.nameWithOwner, ad: r.name, aciklama: r.description || '', gizli: !!r.isPrivate, z: r.updatedAt }))
    .sort((a, b) => String(b.z).localeCompare(String(a.z)));
}

export async function repoKlonla({ gh, env, repo, hedef }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(String(repo))) throw new Error('Geçersiz repo adı');
  if (fs.existsSync(hedef) && fs.readdirSync(hedef).length) throw new Error('Hedef klasör dolu: ' + hedef);
  const s = await calistir(gh, ['repo', 'clone', repo, hedef], { env, zamanAsimi: 600000 });
  if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').pop() || 'Klonlanamadı');
  return hedef;
}

// Yeni boş proje: klasör, istenirse git deposu ve GitHub reposu
export async function yeniProje({ git, gh, env, hedef, gitBaslat, githubOlustur, gizli = true }) {
  if (fs.existsSync(hedef) && fs.readdirSync(hedef).length) throw new Error('Klasör zaten var ve dolu: ' + hedef);
  fs.mkdirSync(hedef, { recursive: true });
  if (!gitBaslat && !githubOlustur) return { hedef };
  if (!git) throw new Error('git bulunamadı');
  const calis = async (arg) => {
    const s = await calistir(git, ['-C', hedef, ...arg], { env, zamanAsimi: 30000 });
    if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').pop());
    return s;
  };
  await calis(['init', '-b', 'main']);
  fs.writeFileSync(path.join(hedef, 'README.md'), `# ${path.basename(hedef)}\n`);
  await calis(['add', '-A']);
  const ilk = await calistir(git, ['-C', hedef, 'commit', '-m', 'İlk commit'], { env, zamanAsimi: 30000 });
  if (ilk.kod !== 0) throw new Error('İlk commit yapılamadı. git kullanıcı adın ve e-postan ayarlı mı? ' + (ilk.hata || '').trim().split('\n').pop());
  if (githubOlustur) {
    if (!gh) throw new Error('GitHub CLI (gh) bulunamadı');
    const s = await calistir(gh, ['repo', 'create', path.basename(hedef), gizli ? '--private' : '--public', '--source', hedef, '--remote', 'origin', '--push'], { env, cwd: hedef, zamanAsimi: 120000 });
    if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').pop() || 'GitHub reposu oluşturulamadı');
  }
  return { hedef };
}

// Sahibin düğmeyle başlattığı git işlemleri. Yalnızca bu liste çalışır.
export async function gitIslem({ git, gh, env, klasor, islem, deger = '' }) {
  if (!git) throw new Error('git bulunamadı');
  const calis = (arg, z = 120000) => calistir(git, ['-C', klasor, ...arg], { env, zamanAsimi: z });
  const sonuc = (s) => {
    const metin = (s.cikti + '\n' + s.hata).trim();
    if (s.kod !== 0) throw new Error(metin.split('\n').slice(-3).join(' ') || 'git hatası');
    return metin.split('\n').slice(-6).join('\n');
  };
  switch (islem) {
    case 'pull':
      return sonuc(await calis(['pull', '--ff-only']));
    case 'push': {
      const yukari = await calis(['rev-parse', '--abbrev-ref', '@{upstream}'], 10000);
      return sonuc(await calis(yukari.kod === 0 ? ['push'] : ['push', '-u', 'origin', 'HEAD']));
    }
    case 'commit': {
      const mesaj = String(deger || '').trim();
      if (!mesaj) throw new Error('Commit mesajı boş');
      sonuc(await calis(['add', '-A']));
      return sonuc(await calis(['commit', '-m', mesaj]));
    }
    case 'dallar': {
      const s = await calis(['branch', '--format=%(refname:short)'], 10000);
      return s.cikti.split('\n').filter(Boolean);
    }
    case 'dalDegistir':
      if (!/^[\w./-]+$/.test(deger)) throw new Error('Geçersiz dal adı');
      return sonuc(await calis(['switch', deger]));
    case 'dalOlustur':
      if (!/^[\w./-]+$/.test(deger)) throw new Error('Geçersiz dal adı');
      return sonuc(await calis(['switch', '-c', deger]));
    case 'githubaBagla': {
      if (!gh) throw new Error('GitHub CLI (gh) bulunamadı');
      const s = await calistir(gh, ['repo', 'create', path.basename(klasor), '--private', '--source', klasor, '--remote', 'origin', '--push'], { env, cwd: klasor, zamanAsimi: 120000 });
      return sonuc(s);
    }
    default:
      throw new Error('Bilinmeyen git işlemi');
  }
}
