// Motorlar: oturumu çalıştıran komut satırı aracı. Claude Code, OpenAI Codex, Kimi Code ya da Gemini CLI.
// Uygulama giriş bilgisini görmez. Abonelik girişi aracın kendi giriş akışıyla yapılır,
// API anahtarı ise uygulamada işletim sisteminin şifreli deposunda tutulur ve yalnızca ortam değişkeni olarak verilir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { yolAra, calistir } from './claude.js';
import { EK_MOTORLAR, EK_KURULUM, ekGirisDurumu, ekGirisKomutu, ekAnahtarOrtami, EK_ANAHTAR_DEGISKENI } from './ek-motorlar.js';

export const MOTORLAR = ['claude', 'codex', ...EK_MOTORLAR];
export const MOTOR_SECIMLERI = ['otomatik', ...MOTORLAR];
export const GIRIS_YONTEMLERI = ['abonelik', 'api'];
// Ortamdaki anahtar değişkenleri: abonelik seçiliyken kullanıcının kabuğundaki anahtar girişi ezmesin diye silinir
export const ANAHTAR_DEGISKENI = { claude: 'ANTHROPIC_API_KEY', codex: 'OPENAI_API_KEY', ...EK_ANAHTAR_DEGISKENI };

const WIN = process.platform === 'win32';

// Codex genelde PATH'te olmaz: ChatGPT masaüstü uygulaması kendi içinde getirir
function codexAdaylari() {
  const ev = os.homedir();
  if (process.platform === 'darwin') {
    return [
      '/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex',
      '/Applications/Codex.app/Contents/Resources/codex-cli/bin/codex',
      path.join(ev, 'Applications', 'ChatGPT.app', 'Contents', 'Resources', 'codex-cli', 'bin', 'codex'),
    ];
  }
  if (WIN) {
    const yerel = process.env.LOCALAPPDATA || path.join(ev, 'AppData', 'Local');
    return [path.join(yerel, 'Programs', 'codex', 'codex.exe')];
  }
  return [];
}

async function surumOku(yol, env) {
  try {
    if (!fs.statSync(yol).isFile()) return null;
  } catch {
    return null;
  }
  const s = await calistir(yol, ['--version'], { env, zamanAsimi: 20000 });
  const m = /(\d+\.\d+\.\d+)/.exec(s.cikti);
  return s.kod === 0 && m ? { yol, surum: m[1] } : null;
}

export async function codexBul(env, elleYol = '') {
  const adaylar = [elleYol, yolAra(env, 'codex'), ...codexAdaylari()].filter(Boolean);
  for (const yol of [...new Set(adaylar)]) {
    const b = await surumOku(yol, env);
    if (b) return b;
  }
  return null;
}

export function kurulumKomutlari() {
  return {
    claude: WIN ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash',
    codex: 'npm install -g @openai/codex',
    ...EK_KURULUM,
  };
}

// Abonelik girişi var mı. Hesap e-postası yalnızca sahibine gösterilmek için okunur.
export async function girisDurumu(motor, yol, env) {
  if (!yol) return { girisli: false };
  if (EK_MOTORLAR.includes(motor)) return ekGirisDurumu(motor);
  if (motor === 'claude') {
    const s = await calistir(yol, ['auth', 'status'], { env, zamanAsimi: 20000 });
    try {
      const j = JSON.parse(s.cikti);
      return { girisli: !!j.loggedIn, yontem: typeof j.authMethod === 'string' ? j.authMethod : '', hesap: typeof j.email === 'string' ? j.email : '' };
    } catch {
      return { girisli: false, bilinmiyor: true };
    }
  }
  const s = await calistir(yol, ['login', 'status'], { env, zamanAsimi: 20000 });
  const metin = (s.cikti + '\n' + s.hata).trim();
  const girisli = s.kod === 0 && /logged in/i.test(metin) && !/not logged in/i.test(metin);
  const yontem = /chatgpt/i.test(metin) ? 'chatgpt' : /api key/i.test(metin) ? 'api' : '';
  return { girisli, yontem };
}

export function girisKomutu(motor) {
  if (EK_MOTORLAR.includes(motor)) return ekGirisKomutu(motor);
  return motor === 'claude' ? ['auth', 'login'] : ['login'];
}

// ---------- Codex modelleri ----------
// Codex kendi model listesini önbelleğe yazar. Liste okunamazsa model seçimi boş kalır ve Codex kendi varsayılanını kullanır.
export function codexKlasoru(env = process.env) {
  return env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

export function codexModelleri(klasor) {
  try {
    const ham = JSON.parse(fs.readFileSync(path.join(klasor, 'models_cache.json'), 'utf8'));
    const liste = Array.isArray(ham.models) ? ham.models : [];
    return liste
      .filter((m) => m && typeof m.slug === 'string' && m.visibility !== 'hide')
      .map((m) => ({ slug: m.slug, ad: typeof m.display_name === 'string' ? m.display_name : m.slug, aciklama: typeof m.description === 'string' ? m.description : '', oncelik: Number.isFinite(m.priority) ? m.priority : 99 }))
      .sort((a, b) => a.oncelik - b.oncelik)
      .slice(0, 30);
  } catch {
    return [];
  }
}

// Koordinatör için en güçlü model, çalışan için en öndeki genel model.
// Açıklamalar Codex'in kendi listesinden gelir. Eşleşme yoksa sıradaki ilk model kullanılır.
export function codexVarsayilan(liste) {
  if (!liste.length) return { koordinator: '', calisan: '' };
  const guclu = liste.find((m) => /frontier|most demanding|most capable/i.test(m.aciklama));
  const genel = liste.find((m) => /workhorse|everyday/i.test(m.aciklama)) || liste[0];
  return { koordinator: (guclu || liste[0]).slug, calisan: genel.slug };
}

// ---------- seçim ----------
// durumlar: { claude: { yol, giris: { girisli } } | null, codex: ... }, anahtarVar: { claude, codex }
export function hazirMi(motor, sirket, durumlar, anahtarVar) {
  const d = durumlar[motor];
  if (!d) return false;
  return sirket.giris[motor] === 'api' ? !!anahtarVar[motor] : !!(d.giris && d.giris.girisli);
}

export function motorCoz(sirket, durumlar, anahtarVar) {
  if (sirket.motor !== 'otomatik') return durumlar[sirket.motor] ? sirket.motor : null;
  for (const m of MOTORLAR) if (hazirMi(m, sirket, durumlar, anahtarVar)) return m;
  for (const m of MOTORLAR) if (durumlar[m]) return m;
  return null;
}

// Oturum ortamı: seçilen giriş yöntemine göre anahtar eklenir ya da silinir
export function motorOrtami(motor, sirket, ortam, anahtar, { codexApiKlasoru } = {}) {
  const env = { ...ortam };
  // Uygulama bir Claude Code ya da Codex oturumunun içinden açıldıysa o oturumun işaretleri ekibe geçmesin
  for (const k of Object.keys(env)) if (/^(CLAUDECODE|CLAUDE_CODE_(CHILD_SESSION|ENTRYPOINT|SSE_PORT)|CODEX_(THREAD_ID|SANDBOX.*))$/.test(k)) delete env[k];
  const degisken = ANAHTAR_DEGISKENI[motor];
  delete env[degisken];
  // Gemini kabuktaki anahtarı Google girişinin önüne koyar; Kimi'nin KIMI_MODEL_* değişkenleri girişi ezer
  if (motor === 'gemini') for (const k of ['GEMINI_API_KEY', 'GOOGLE_API_KEY']) delete env[k];
  if (motor === 'kimi') for (const k of Object.keys(env)) if (/^KIMI_MODEL_/.test(k)) delete env[k];
  // sahibin onayını bekleyen MCP araçları için uzun zaman aşımı (ms)
  if (motor === 'claude' && !env.MCP_TOOL_TIMEOUT) env.MCP_TOOL_TIMEOUT = '900000';
  if (sirket.giris[motor] === 'api' && anahtar && EK_MOTORLAR.includes(motor)) Object.assign(env, ekAnahtarOrtami(motor, anahtar));
  else if (sirket.giris[motor] === 'api' && anahtar) {
    env[degisken] = anahtar;
    // Codex anahtarla girişi kendi klasörüne yazar. Kullanıcının ~/.codex girişi bozulmasın diye ayrı klasör kullanılır.
    if (motor === 'codex' && codexApiKlasoru) env.CODEX_HOME = codexApiKlasoru;
  }
  return env;
}

// Codex ile tek seferlik, salt okunur taslak isteği. Son mesaj dosyaya yazdırılır.
export async function codexTaslak({ yol, env, istem, model = '' }) {
  const calisma = fs.mkdtempSync(path.join(os.tmpdir(), 'ofis-taslak-'));
  const cikis = path.join(calisma, 'yanit.txt');
  try {
    const arg = ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', calisma, '-o', cikis];
    if (model) arg.push('-m', model);
    arg.push('-');
    const s = await calistir(yol, arg, { env, cwd: calisma, girdi: istem, zamanAsimi: 180000 });
    let metin = '';
    try {
      metin = fs.readFileSync(cikis, 'utf8');
    } catch {
      metin = '';
    }
    if (!metin.trim()) throw new Error(s.hata.trim().split('\n').pop() || 'yanıt alınamadı');
    return metin;
  } finally {
    fs.rmSync(calisma, { recursive: true, force: true });
  }
}

// Codex anahtarla girişi kendi klasörüne bir kez yapılır. Anahtar değişince yeniden yapılır.
export async function codexAnahtarGirisi({ yol, env, klasor, anahtar, iz }) {
  fs.mkdirSync(klasor, { recursive: true });
  const isaret = path.join(klasor, '.ofis-anahtar');
  let onceki = '';
  try {
    onceki = fs.readFileSync(isaret, 'utf8');
  } catch {
    onceki = '';
  }
  if (onceki === iz && fs.existsSync(path.join(klasor, 'auth.json'))) return;
  const s = await calistir(yol, ['login', '--with-api-key'], { env: { ...env, CODEX_HOME: klasor }, girdi: anahtar + '\n', zamanAsimi: 30000 });
  if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').pop() || 'Codex anahtarla giriş yapılamadı');
  fs.writeFileSync(isaret, iz);
}
