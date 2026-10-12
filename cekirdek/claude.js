// Claude Code ile konuşan katman: kurulu mu, nerede, hangi ortamla çalışır, taslak üretimi.
// Uygulama kimlik bilgisi tutmaz. Giriş Claude Code'un kendi /login akışıyla, kullanıcının terminalinde yapılır.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const WIN = process.platform === 'win32';

// Masaüstünden açılan uygulama kabuğun PATH değerini almaz. Giriş kabuğundan ortamı bir kez okuruz.
export function kabukOrtami(zamanAsimi = 6000) {
  return new Promise((coz) => {
    const taban = { ...process.env };
    const ekle = (env) => {
      const ev = os.homedir();
      const ekler = WIN
        ? [path.join(ev, '.local', 'bin'), path.join(process.env.APPDATA || '', 'npm')]
        : [path.join(ev, '.local', 'bin'), path.join(ev, '.claude', 'local'), '/opt/homebrew/bin', '/usr/local/bin', path.join(ev, '.npm-global', 'bin'), path.join(ev, '.bun', 'bin')];
      const anahtar = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
      const mevcut = (env[anahtar] || '').split(path.delimiter).filter(Boolean);
      for (const e of ekler) if (e && !mevcut.includes(e)) mevcut.push(e);
      env[anahtar] = mevcut.join(path.delimiter);
      return env;
    };
    if (WIN) return coz(ekle(taban));
    const kabuk = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
    let cikti = '';
    let bitti = false;
    const son = (env) => {
      if (bitti) return;
      bitti = true;
      coz(ekle(env));
    };
    try {
      const c = spawn(kabuk, ['-ilc', 'printf "__OFIS_BAS__\\n"; env; printf "__OFIS_SON__\\n"'], { stdio: ['ignore', 'pipe', 'ignore'], env: taban, detached: true });
      const z = setTimeout(() => {
        try {
          process.kill(-c.pid);
        } catch {
          /* zaten bitmiş */
        }
        son(taban);
      }, zamanAsimi);
      c.stdout.on('data', (d) => (cikti += d));
      c.on('error', () => {
        clearTimeout(z);
        son(taban);
      });
      c.on('close', () => {
        clearTimeout(z);
        const m = /__OFIS_BAS__\n([\s\S]*?)__OFIS_SON__/.exec(cikti);
        if (!m) return son(taban);
        const env = {};
        let sonAnahtar = null;
        for (const satir of m[1].split('\n')) {
          const e = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(satir);
          if (e) {
            sonAnahtar = e[1];
            env[sonAnahtar] = e[2];
          } else if (sonAnahtar && satir) {
            env[sonAnahtar] += '\n' + satir;
          }
        }
        son(Object.keys(env).length > 3 ? { ...taban, ...env } : taban);
      });
    } catch {
      son(taban);
    }
  });
}

export function yolAra(env, ad = 'claude') {
  const adlar = WIN ? [ad + '.exe', ad + '.cmd', ad + '.bat'] : [ad];
  const anahtar = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  for (const dir of (env[anahtar] || '').split(path.delimiter).filter(Boolean)) {
    for (const ad of adlar) {
      const p = path.join(dir, ad);
      try {
        if (fs.statSync(p).isFile()) return p;
      } catch {
        /* yok */
      }
    }
  }
  return null;
}

// .cmd dosyaları Windows'ta kabuk üzerinden çalışır
export function komutHazirla(yol, arg) {
  if (WIN && /\.(cmd|bat)$/i.test(yol)) return { dosya: process.env.ComSpec || 'cmd.exe', arg: ['/d', '/s', '/c', yol, ...arg] };
  return { dosya: yol, arg };
}

export function calistir(yol, arg, { env, cwd, girdi, zamanAsimi = 20000 } = {}) {
  return new Promise((coz) => {
    const k = komutHazirla(yol, arg);
    let cikti = '';
    let hata = '';
    let c;
    try {
      c = spawn(k.dosya, k.arg, { env, cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) {
      return coz({ kod: -1, cikti: '', hata: String(e.message || e) });
    }
    const z = setTimeout(() => {
      try {
        c.kill();
      } catch {
        /* bitmiş */
      }
    }, zamanAsimi);
    c.stdout.on('data', (d) => (cikti += d));
    c.stderr.on('data', (d) => (hata += d));
    c.on('error', (e) => {
      clearTimeout(z);
      coz({ kod: -1, cikti, hata: String(e.message || e) });
    });
    c.on('close', (kod) => {
      clearTimeout(z);
      coz({ kod, cikti, hata });
    });
    if (girdi != null) c.stdin.end(girdi);
    else c.stdin.end();
  });
}

// Claude Code'u bulur ve sürümünü okur. Bulamazsa null.
export async function claudeBul(env, elleYol = '') {
  const adaylar = [];
  if (elleYol) adaylar.push(elleYol);
  const bulunan = yolAra(env);
  if (bulunan) adaylar.push(bulunan);
  for (const yol of adaylar) {
    try {
      if (!fs.statSync(yol).isFile()) continue;
    } catch {
      continue;
    }
    const s = await calistir(yol, ['--version'], { env, zamanAsimi: 20000 });
    const m = /(\d+\.\d+\.\d+)/.exec(s.cikti);
    if (s.kod === 0 && m) return { yol, surum: m[1] };
  }
  return null;
}

export function kurulumKomutu() {
  return WIN ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash';
}

// Yanıttaki ilk JSON nesnesini ayıklar
export function jsonAyikla(metin) {
  const s = String(metin || '');
  const bas = s.indexOf('{');
  if (bas < 0) return null;
  let derinlik = 0;
  let dizede = false;
  let kacis = false;
  for (let i = bas; i < s.length; i++) {
    const ch = s[i];
    if (dizede) {
      if (kacis) kacis = false;
      else if (ch === '\\') kacis = true;
      else if (ch === '"') dizede = false;
    } else if (ch === '"') dizede = true;
    else if (ch === '{') derinlik++;
    else if (ch === '}') {
      derinlik--;
      if (derinlik === 0) {
        try {
          return JSON.parse(s.slice(bas, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Tek seferlik, araçsız bir istek: şefin taslak yazması için. Kullanıcının kendi Claude Code girişiyle çalışır.
export async function taslakIste({ yol, env, istem, cwd }) {
  const calisma = cwd || fs.mkdtempSync(path.join(os.tmpdir(), 'ofis-taslak-'));
  const s = await calistir(yol, ['-p', '--output-format', 'json', '--model', 'sonnet'], { env, cwd: calisma, girdi: istem, zamanAsimi: 180000 });
  if (!cwd) fs.rmSync(calisma, { recursive: true, force: true });
  let dis = null;
  try {
    dis = JSON.parse(s.cikti);
  } catch {
    dis = null;
  }
  if (!dis || dis.is_error || typeof dis.result !== 'string') {
    const neden = (dis && typeof dis.result === 'string' && dis.result) || s.hata.trim().split('\n').pop() || s.cikti.trim().slice(0, 200) || 'yanıt alınamadı';
    throw new Error(neden);
  }
  const nesne = jsonAyikla(dis.result);
  if (!nesne) throw new Error('Yanıt beklenen biçimde değil');
  return nesne;
}
