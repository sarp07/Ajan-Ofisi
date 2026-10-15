// Ek motorlar: Kimi Code (Moonshot) ve Gemini CLI (Google). Claude ve Codex gibi kat, beyin ve özel odaları çalıştırır.
// Kullanıcının kendi ~/.kimi-code ve ~/.gemini ayarlarına yazılmaz: her oturum kendi ayar klasörünü (ev) alır.
// Ev, kullanıcının girişini (kimlik dosyaları) bağlantıyla paylaşır, ayarlarını kopyalar ve üstüne ofisin kancalarını,
// MCP sunucusunu, talimatını, ekibini ve skillerini ekler.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { yolAra, calistir } from './claude.js';
import { sefMetni, ajanGovde, ajanTanimi, skillKopyala, temizle, olayAdresi, codexKancaKomutu, EKLENTI_ADI } from './derle.js';

export const EK_MOTORLAR = ['kimi', 'gemini'];
const WIN = process.platform === 'win32';
const EV = () => os.homedir();
export const kimiKlasoru = (env = process.env) => env.KIMI_CODE_HOME || path.join(EV(), '.kimi-code');
export const geminiKlasoru = (env = process.env) => path.join(env.GEMINI_CLI_HOME || EV(), '.gemini');

// ---------- bulma ----------
function adaylar(motor) {
  const ev = EV();
  if (motor === 'kimi') return [path.join(ev, '.local', 'bin', 'kimi'), path.join(ev, '.kimi-code', 'bin', 'kimi'), '/opt/homebrew/bin/kimi', '/usr/local/bin/kimi', ...(WIN ? [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'kimi-code', 'kimi.exe')] : [])];
  return ['/opt/homebrew/bin/gemini', '/usr/local/bin/gemini', path.join(ev, '.npm-global', 'bin', 'gemini'), path.join(ev, '.local', 'bin', 'gemini'), ...(WIN ? [path.join(process.env.APPDATA || '', 'npm', 'gemini.cmd')] : [])];
}

async function surumOku(yol, env) {
  try {
    if (!fs.statSync(yol).isFile()) return null;
  } catch {
    return null;
  }
  const s = await calistir(yol, ['--version'], { env, zamanAsimi: 20000 });
  const m = /(\d+\.\d+\.\d+)/.exec(s.cikti + ' ' + s.hata);
  return s.kod === 0 && m ? { yol, surum: m[1] } : null;
}

export async function ekBul(motor, env, elleYol = '') {
  for (const yol of [...new Set([elleYol, yolAra(env, motor), ...adaylar(motor)].filter(Boolean))]) {
    const b = await surumOku(yol, env);
    if (b) return b;
  }
  return null;
}

export const EK_KURULUM = {
  kimi: WIN ? 'irm https://code.kimi.com/kimi-code/install.ps1 | iex' : 'curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash',
  gemini: 'npm install -g @google/gemini-cli',
};

// Giriş: Kimi'de "kimi login" (cihaz kodu), Gemini'de aracın kendi /auth ekranı (Google ile giriş)
export const ekGirisKomutu = (motor) => (motor === 'kimi' ? ['login'] : []);

const doluMu = (klasor) => {
  try {
    return fs.readdirSync(klasor).some((f) => f.endsWith('.json'));
  } catch {
    return false;
  }
};
const oku = (dosya) => {
  try {
    return fs.readFileSync(dosya, 'utf8');
  } catch {
    return '';
  }
};

// Abonelik ya da kendi ayarlarındaki anahtarla giriş var mı (dosyalardan; ağa çıkılmaz)
export function ekGirisDurumu(motor) {
  if (motor === 'kimi') {
    const k = kimiKlasoru();
    if (doluMu(path.join(k, 'credentials'))) return { girisli: true, yontem: 'oauth' };
    if (/\[providers\.[^\]]+\][\s\S]*?api_key(_env)?\s*=/.test(oku(path.join(k, 'config.toml')))) return { girisli: true, yontem: 'api' };
    return { girisli: false };
  }
  const g = geminiKlasoru();
  if (fs.existsSync(path.join(g, 'oauth_creds.json'))) return { girisli: true, yontem: 'oauth' };
  let ayar = {};
  try {
    ayar = JSON.parse(oku(path.join(g, 'settings.json')) || '{}');
  } catch {
    ayar = {};
  }
  const tur = (ayar.security && ayar.security.auth && ayar.security.auth.selectedType) || (ayar.selectedAuthType || '');
  if (/api-key/.test(tur) && /GEMINI_API_KEY\s*=/.test(oku(path.join(g, '.env')))) return { girisli: true, yontem: 'api' };
  if (/vertex|cloud-shell|compute/.test(tur)) return { girisli: true, yontem: tur };
  return { girisli: false };
}

// API anahtarıyla çalışırken oturuma verilen ortam
export function ekAnahtarOrtami(motor, anahtar) {
  if (motor === 'kimi') return { KIMI_MODEL_NAME: 'kimi-k2.6', KIMI_MODEL_API_KEY: anahtar, KIMI_MODEL_BASE_URL: 'https://api.moonshot.ai/v1', KIMI_MODEL_PROVIDER_TYPE: 'kimi', KIMI_MODEL_CAPABILITIES: 'image_in,thinking' };
  return { GEMINI_API_KEY: anahtar };
}
export const EK_ANAHTAR_DEGISKENI = { kimi: 'KIMI_MODEL_API_KEY', gemini: 'GEMINI_API_KEY' };

// ---------- olaylar ----------
// Kimi olay adları Claude ile aynıdır. Gemini'nin adları ve araç adları çevrilir.
export const KIMI_OLAYLAR = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'Interrupt', 'Notification'];
export const GEMINI_OLAYLAR = ['SessionStart', 'BeforeAgent', 'AfterAgent', 'BeforeTool', 'AfterTool', 'Notification'];

const GEMINI_ARAC = {
  run_shell_command: 'Bash',
  write_file: 'Write',
  replace: 'Edit',
  read_file: 'Read',
  read_many_files: 'Read',
  glob: 'Glob',
  search_file_content: 'Grep',
  grep_search: 'Grep',
  list_directory: 'LS',
  google_web_search: 'WebSearch',
  web_fetch: 'WebFetch',
  write_todos: 'TodoWrite',
  save_memory: 'Memory',
};

export function geminiUyarla(ev) {
  if (!ev || typeof ev !== 'object') return ev;
  const ad = ev.hook_event_name;
  const arac = (ham, girdi) => {
    const t = String(ham || '');
    const m = /^mcp_([^_]+)_(.+)$/.exec(t);
    if (m) return { tool_name: `mcp__${m[1]}__${m[2]}`, tool_input: girdi };
    const yeni = GEMINI_ARAC[t];
    if (!yeni) return { tool_name: t, tool_input: girdi };
    const g = girdi && typeof girdi === 'object' ? girdi : {};
    const ti = yeni === 'Bash' ? { command: g.command || '' } : ['Write', 'Edit', 'Read'].includes(yeni) ? { file_path: g.file_path || g.absolute_path || g.path || '' } : g;
    return { tool_name: yeni, tool_input: ti };
  };
  if (ad === 'BeforeAgent') return { ...ev, hook_event_name: 'UserPromptSubmit', prompt: ev.prompt || '' };
  if (ad === 'AfterAgent') return { ...ev, hook_event_name: 'Stop', last_assistant_message: ev.prompt_response || '' };
  if (ad === 'BeforeTool') return { ...ev, hook_event_name: 'PreToolUse', ...arac(ev.tool_name, ev.tool_input) };
  if (ad === 'AfterTool') return { ...ev, hook_event_name: 'PostToolUse', ...arac(ev.tool_name, ev.tool_input) };
  if (ad === 'Notification') return { ...ev, hook_event_name: 'Notification', notification_type: ev.notification_type === 'ToolPermission' ? 'permission_prompt' : ev.notification_type, message: ev.message || '' };
  return ev;
}

// ---------- oturum evi ----------
// Kullanıcının kimlik dosyası/klasörü evde bağlantı olarak durur: giriş yenilenince her iki yer de güncel kalır.
function bagla(kaynak, hedef) {
  try {
    fs.rmSync(hedef, { recursive: true, force: true });
  } catch {
    /* yoksa sorun değil */
  }
  try {
    fs.symlinkSync(kaynak, hedef, !fs.existsSync(kaynak) || fs.statSync(kaynak).isDirectory() ? (WIN ? 'junction' : 'dir') : 'file');
  } catch {
    /* bağlantı kurulamazsa kopyalanır (Windows'ta izin yoksa) */
    try {
      fs.cpSync(kaynak, hedef, { recursive: true });
    } catch {
      /* kaynak yok */
    }
  }
}

const tomlYazi = (s) => JSON.stringify(String(s));

// mcpAdres: bu oturumun MCP adresi (kapsamıyla). talimatEk: beyin ya da özel oda talimatı (verilirse şef metninin yerine)
export function ekDerle(motor, sirket, { hedef, skiller = [], port, anahtar, etiket = '', proje = null, devir = '', mcpAdres, araclar = [], apiModu = false }) {
  const kok = path.join(hedef, motor === 'kimi' ? 'kimi-ev' : 'gemini-ev');
  // oturum geçmişi (sürdürme için) korunur; ofisin yazdığı dosyalar her açılışta yeniden kurulur
  fs.mkdirSync(kok, { recursive: true });
  const kanca = codexKancaKomutu(olayAdresi(port, anahtar, etiket));
  const skillBilgi = Object.fromEntries(skiller.map((s) => [s.id, s]));
  if (motor === 'kimi') {
    const kullanici = kimiKlasoru();
    // kullanıcının klasörüne dokunulmaz: giriş yoksa bağlantı boşa düşer, "kimi login" sonrası kendiliğinden dolar
    bagla(path.join(kullanici, 'credentials'), path.join(kok, 'credentials'));
    // kullanıcının ayarları (sağlayıcılar, varsayılan model) + ofisin kancaları
    const ayar = oku(path.join(kullanici, 'config.toml'));
    const kancalar = KIMI_OLAYLAR.map((o) => `[[hooks]]\nevent = ${tomlYazi(o)}\ncommand = ${tomlYazi(kanca)}\ntimeout = 5\n`).join('\n');
    fs.writeFileSync(path.join(kok, 'config.toml'), `${ayar.trim()}\n\n# Ajan Ofisi: oturum olayları\n${kancalar}`);
    let mcp = {};
    try {
      mcp = JSON.parse(oku(path.join(kullanici, 'mcp.json')) || '{}');
    } catch {
      mcp = {};
    }
    mcp.mcpServers = { ...(mcp.mcpServers || {}), [EKLENTI_ADI]: { url: mcpAdres, toolTimeoutMs: 900000 } };
    fs.writeFileSync(path.join(kok, 'mcp.json'), JSON.stringify(mcp, null, 2));
    const ajanlar = path.join(kok, 'agents');
    temizle(ajanlar);
    fs.mkdirSync(ajanlar, { recursive: true });
    const skillKlasoru = path.join(kok, 'skills');
    temizle(skillKlasoru);
    skillKopyala(skiller, skillKlasoru);
    for (const a of sirket.ajanlar) fs.writeFileSync(path.join(ajanlar, a.id + '.md'), `---\nname: ${a.id}\ndescription: ${JSON.stringify(ajanTanimi(sirket, a))}\n---\n\n${ajanGovde(sirket, a, skillBilgi, proje, { motor: 'kimi', skillKlasoru })}\n`);
    const sefDosya = path.join(kok, 'AGENTS.md');
    fs.writeFileSync(sefDosya, sefMetni(sirket, { proje, devir, motor: 'kimi' }));
    return { motor, ev: kok, sefDosya, env: { KIMI_CODE_HOME: kok, KIMI_CODE_TRUST_WORKSPACE: '1', KIMI_DISABLE_TELEMETRY: '1' } };
  }
  // Gemini: GEMINI_CLI_HOME/.gemini altında ayar, talimat (GEMINI.md) ve ekip
  const g = path.join(kok, '.gemini');
  fs.mkdirSync(g, { recursive: true });
  const kullanici = geminiKlasoru();
  for (const f of ['oauth_creds.json', 'google_accounts.json', 'installation_id', 'user_id', '.env']) if (fs.existsSync(path.join(kullanici, f))) bagla(path.join(kullanici, f), path.join(g, f));
  let ayar = {};
  try {
    ayar = JSON.parse(oku(path.join(kullanici, 'settings.json')) || '{}');
  } catch {
    ayar = {};
  }
  const hooks = { ...(ayar.hooks || {}) };
  for (const o of GEMINI_OLAYLAR) hooks[o] = [...(hooks[o] || []), { hooks: [{ type: 'command', command: kanca, name: 'ajan-ofisi', timeout: 5000 }] }];
  const yeni = {
    ...ayar,
    hooks,
    hooksConfig: { ...(ayar.hooksConfig || {}), enabled: true },
    mcpServers: { ...(ayar.mcpServers || {}), [EKLENTI_ADI]: { httpUrl: mcpAdres, timeout: 900000 } },
    tools: { ...(ayar.tools || {}), sandbox: false },
    security: {
      ...(ayar.security || {}),
      folderTrust: { ...((ayar.security && ayar.security.folderTrust) || {}), enabled: false },
      // giriş yöntemi önceden seçilir: Gemini açılışta sormasın (anahtar varsa anahtar, yoksa Google girişi)
      auth: { ...((ayar.security && ayar.security.auth) || {}), selectedType: apiModu ? 'gemini-api-key' : (ayar.security && ayar.security.auth && ayar.security.auth.selectedType) || 'oauth-personal' },
    },
  };
  fs.writeFileSync(path.join(g, 'settings.json'), JSON.stringify(yeni, null, 2));
  const ajanlar = path.join(g, 'agents');
  temizle(ajanlar);
  fs.mkdirSync(ajanlar, { recursive: true });
  const skillKlasoru = path.join(kok, 'skills');
  temizle(skillKlasoru);
  skillKopyala(skiller, skillKlasoru);
  for (const a of sirket.ajanlar) fs.writeFileSync(path.join(ajanlar, a.id + '.md'), `---\nname: ${a.id}\ndescription: ${JSON.stringify(ajanTanimi(sirket, a))}\nkind: local\n---\n\n${ajanGovde(sirket, a, skillBilgi, proje, { motor: 'gemini', skillKlasoru })}\n`);
  const sefDosya = path.join(g, 'GEMINI.md');
  fs.writeFileSync(sefDosya, sefMetni(sirket, { proje, devir, motor: 'gemini' }));
  return { motor, ev: kok, sefDosya, env: { GEMINI_CLI_HOME: kok, GEMINI_CLI_TRUST_WORKSPACE: 'true', GEMINI_SANDBOX: 'false' } };
}

// İzin modları: '' her seferinde sor, acceptEdits düzenlemeler kendiliğinden, auto ve bypassPermissions sormadan
const KIMI_IZIN = { '': [], acceptEdits: ['--yolo'], auto: ['--yolo'], plan: ['--plan'], bypassPermissions: ['--auto'] };
const GEMINI_IZIN = { '': [], acceptEdits: ['--approval-mode', 'auto_edit'], auto: ['--approval-mode', 'yolo'], plan: [], bypassPermissions: ['--approval-mode', 'yolo'] };

export function ekArgumanlari(motor, sirket, { surdur = '', ekKlasorler = [], model = '' }) {
  const izin = sirket.izinModu || '';
  if (motor === 'kimi') {
    const arg = surdur ? ['--session', surdur] : [];
    // sürdürülen oturumda izin modu değiştirilebilir, plan değiştirilemez
    arg.push(...(surdur && izin === 'plan' ? [] : KIMI_IZIN[izin] || []));
    for (const d of ekKlasorler) arg.push('--add-dir', d);
    if (model) arg.push('-m', model);
    return arg;
  }
  const arg = surdur ? ['--resume', surdur] : [];
  arg.push(...(GEMINI_IZIN[izin] || []));
  if (ekKlasorler.length) arg.push('--include-directories', ekKlasorler.join(','));
  if (model) arg.push('-m', model);
  return arg;
}
