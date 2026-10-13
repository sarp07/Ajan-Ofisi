// Konuşma paneli: hook olaylarından sahibin görmesi gerekenler çıkarılır.
// Şefin cevapları, sana sorduğu sorular ve onay istekleri. Ekibin ara işleri terminalde ve canlı akışta kalır.
// Saf mantık: dosya ya da ağ erişimi yok. Claude Code ve Codex olayları aynı alan adlarını kullanır.
import { turKodu } from './kimlik.js';
import { sistemIstegiMi } from './kayit.js';

const SINIR = 200;
let sayac = 0;

const kes = (s, n) => {
  s = String(s ?? '').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

function kimAdi(ev, kat) {
  if (!ev.agent_id) return { kim: 'sef', ad: kat.sef.ad };
  const tur = turKodu(ev.agent_type || '');
  const a = kat.ajanlar.find((x) => x.id === tur);
  return { kim: 'uye', ad: a ? a.ad : tur || kat.sef.ad };
}

function onayOzet(ev) {
  const g = ev.tool_input && typeof ev.tool_input === 'object' ? ev.tool_input : {};
  const komut = Array.isArray(g.command) ? g.command.join(' ') : g.command || g.cmd;
  return kes(g.description || komut || g.file_path || g.url || ev.tool_name || '', 400);
}

function sorular(ev) {
  const g = ev.tool_input && typeof ev.tool_input === 'object' ? ev.tool_input : {};
  const liste = Array.isArray(g.questions) ? g.questions : g.question ? [g] : [];
  return liste
    .filter((q) => q && typeof q === 'object')
    .slice(0, 4)
    .map((q) => ({
      soru: kes(q.question || q.header || '', 600),
      secenekler: (Array.isArray(q.options) ? q.options : []).map((o) => kes(typeof o === 'string' ? o : o && (o.label || o.value), 120)).filter(Boolean).slice(0, 8),
    }))
    .filter((q) => q.soru);
}

function kapat(liste, kosul) {
  let degisti = false;
  for (const m of liste) {
    if (m.acik && kosul(m)) {
      m.acik = false;
      degisti = true;
    }
  }
  return degisti;
}

function ekle(liste, m, z) {
  liste.push({ id: 'm' + Date.now().toString(36) + (sayac++).toString(36), z, acik: false, ...m });
  if (liste.length > SINIR) liste.splice(0, liste.length - SINIR);
  return true;
}

// liste: katın konuşma geçmişi (yerinde değişir). kat: katın görünümü (şef ve ekip adları için).
// Döner: liste değiştiyse true.
export function sohbetIsle(liste, ev, kat, z = Date.now()) {
  if (!ev || typeof ev !== 'object') return false;
  const olay = ev.hook_event_name;
  switch (olay) {
    case 'UserPromptSubmit': {
      if (ev.agent_id) return false;
      const metin = kes(ev.prompt, 4000);
      if (!metin || sistemIstegiMi(metin)) return false;
      // kattan ya da WhatsApp'tan iletilen haber: sahibin yazdığı değildir
      const iletim = /^\[(Kat|WhatsApp|Telegram)[^\]]*\]/.exec(metin);
      if (iletim) return ekle(liste, { kim: 'iletim', ad: iletim[0].slice(1, -1), tur: 'mesaj', metin: metin.slice(iletim[0].length).trim() }, z);
      // sahip yazdıysa bekleyen soru ve onaylar cevaplanmış sayılır
      kapat(liste, () => true);
      return ekle(liste, { kim: 'sen', ad: '', tur: 'mesaj', metin }, z);
    }
    case 'PermissionRequest': {
      const { kim, ad } = kimAdi(ev, kat);
      return ekle(liste, { kim, ad, tur: 'onay', metin: onayOzet(ev), arac: String(ev.tool_name || ''), acik: true }, z);
    }
    case 'PreToolUse': {
      if (ev.tool_name !== 'AskUserQuestion') return false;
      const s = sorular(ev);
      if (!s.length) return false;
      const { kim, ad } = kimAdi(ev, kat);
      return ekle(liste, { kim, ad, tur: 'soru', metin: s.map((q) => q.soru).join('\n\n'), sorular: s, acik: true }, z);
    }
    case 'PostToolUse':
    case 'PostToolUseFailure':
    case 'PermissionDenied': {
      const arac = String(ev.tool_name || '');
      if (arac === 'AskUserQuestion') return kapat(liste, (m) => m.tur === 'soru');
      // aynı aracın en eski açık onayı kapanır
      const m = liste.find((x) => x.acik && x.tur === 'onay' && x.arac === arac);
      if (!m) return false;
      m.acik = false;
      if (olay === 'PermissionDenied') m.reddedildi = true;
      return true;
    }
    case 'Stop': {
      if (ev.agent_id) return false;
      kapat(liste, () => true);
      const metin = kes(ev.last_assistant_message, 8000);
      if (!metin) return true;
      const son = liste[liste.length - 1];
      if (son && son.kim === 'sef' && son.tur === 'mesaj' && son.metin === metin) return true;
      return ekle(liste, { kim: 'sef', ad: kat.sef.ad, tur: 'mesaj', metin }, z);
    }
    case 'StopFailure': {
      kapat(liste, () => true);
      return ekle(liste, { kim: 'sistem', ad: '', tur: 'hata', metin: kes(ev.error_details || ev.error || '', 600) }, z);
    }
    default:
      return false;
  }
}

export const bekleyenSayisi = (liste) => liste.filter((m) => m.acik).length;

// Konuşma panelinden yazılan metin terminale yapıştırılmış gibi gönderilir. Enter ayrıca, kısa bir aradan sonra gönderilir
// ki arayüz yapıştırmayı işlemeden gönderim tuşu gelmesin.
// Köşeli yapıştırma (bracketed paste) çok satırlı metnin satır satır gönderilmesini önler. Claude Code ve Codex ikisi de destekler.
export function terminaleMetin(metin) {
  const temiz = String(metin || '').replace(/\x1b/g, '').replace(/\r\n?/g, '\n').trim();
  if (!temiz) return '';
  return '\x1b[200~' + temiz + '\x1b[201~';
}

// Onay penceresinde Enter ilk seçeneği (izin ver), Esc ise reddi seçer. İki motorda da böyledir.
export const ONAY_TUSU = { evet: '\r', hayir: '\x1b' };

// Klasör güveni: yeni bir klasörde motor önce "bu klasöre güveniyor musun" diye sorar. Bu soru hook olayı üretmez,
// yalnızca terminalde görünür. Terminal çıktısından tanınır ve konuşma paneline taşınır.
// Claude Code'da seçili seçenek "Hayır, çık" olduğu için önce aşağı ok, sonra Enter gönderilir.
const GUVEN_KALIBI = { claude: /yes,itrustthisfolder/, codex: /(doyoutrust|trustthe(files|contents)|allowcodextowork)/ };
export const GUVEN_TUSLARI = { claude: ['\x1b[B', '\r'], codex: ['\r'] };

// Terminal çıktısını karşılaştırılabilir hale getirir: renk kodları ve boşluklar atılır (arayüz boşlukları imleç hareketiyle çizer)
export function duzMetin(veri) {
  return String(veri || '')
    .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?>=]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[@-_]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function guvenSorusuMu(motor, duz) {
  const k = GUVEN_KALIBI[motor];
  return !!k && k.test(duz);
}
