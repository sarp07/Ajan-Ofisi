// Playwright CLI: ekibin web sitelerini bir insan gibi gezip test ettiği ayrı tarayıcı (Microsoft, Apache-2.0).
// Kabukta yoksa uygulamanın kendi klasörüne npm ile bir kez kurulur ve oturumların PATH'ine eklenir.
import fs from 'node:fs';
import path from 'node:path';
import { yolAra, calistir } from './claude.js';

export const PLAYWRIGHT_PAKET = '@playwright/cli@0.1.22';
const WIN = process.platform === 'win32';

export function playwrightKlasoru(klasor) {
  return path.join(klasor, 'node_modules', '.bin');
}

function kurulu(klasor) {
  return fs.existsSync(path.join(playwrightKlasoru(klasor), WIN ? 'playwright-cli.cmd' : 'playwright-cli'));
}

// Oturum ortamı: uygulamanın kurduğu playwright-cli PATH'in başına eklenir
export function playwrightOrtami(env, klasor) {
  if (!env || !kurulu(klasor)) return env;
  const anahtar = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  const bin = playwrightKlasoru(klasor);
  const parcalar = (env[anahtar] || '').split(path.delimiter).filter((p) => p && p !== bin);
  return { ...env, [anahtar]: [bin, ...parcalar].join(path.delimiter) };
}

// Döner: 'kabuk' (kullanıcıda zaten var), 'kurulu', 'kuruldu', 'npmYok' ya da hata fırlatır
export async function playwrightKur(env, klasor) {
  if (yolAra(env, 'playwright-cli')) return 'kabuk';
  if (kurulu(klasor)) return 'kurulu';
  const npm = yolAra(env, 'npm');
  if (!npm) return 'npmYok';
  fs.mkdirSync(klasor, { recursive: true });
  const paket = path.join(klasor, 'package.json');
  if (!fs.existsSync(paket)) fs.writeFileSync(paket, JSON.stringify({ name: 'ajan-ofisi-araclar', private: true }, null, 2));
  const s = await calistir(npm, ['install', '--prefix', klasor, PLAYWRIGHT_PAKET, '--no-audit', '--no-fund', '--loglevel=error'], { env, cwd: klasor, zamanAsimi: 300000 });
  if (s.kod !== 0 || !kurulu(klasor)) throw new Error((s.hata || s.cikti).trim().split('\n').pop() || 'npm install başarısız');
  return 'kuruldu';
}
