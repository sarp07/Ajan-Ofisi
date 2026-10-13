// Alt ajan sınırı: bir katta her çalışan aynı anda en fazla bir yardımcı alabilir (kendisi ve bir kopyası).
// Takım dışı yardımcıların (genel amaçlı, "z2", "yedek" gibi) toplamı da ekip sayısını geçemez; ekip yoksa şef bir
// yardımcı alabilir. Sınır aşılınca ajan açma isteği gerekçesiyle reddedilir, şef işi mevcut ekibe dağıtır.
import { turKodu, MISAFIR_ID } from './kimlik.js';
import { rolCoz } from './durum.js';

const ESKIME = 2 * 60 * 60 * 1000; // Stop olayı kaçarsa kayıt 2 saat sonra düşer

// calisanlar: Map(agent_id -> { rol, z }) şu an çalışan alt ajanlar
export function altAjanIzle(d, calisanlar, ev, z = Date.now()) {
  for (const [k, v] of calisanlar) if (z - v.z > ESKIME) calisanlar.delete(k);
  if (!ev.agent_id) return;
  if (ev.hook_event_name === 'SubagentStart') calisanlar.set(ev.agent_id, { rol: rolCoz(d, ev.agent_type), z });
  else if (ev.hook_event_name === 'SubagentStop') calisanlar.delete(ev.agent_id);
}

const METIN = {
  tr: {
    uye: (ad) => `${ad} zaten bir yardımcıyla çalışıyor (her çalışan en fazla bir yardımcı alabilir). Yeni kopya açma: işi SendMessage ile mevcut ${ad} ya da yardımcısına ver, ya da biri bitince yeniden dene.`,
    misafir: (n) => `Takım dışı yardımcı sınırı doldu (en fazla ${n}, ekip sayısı kadar). Yeni yardımcı açma: işi ekipteki birine ver ya da bir yardımcı bitince yeniden dene.`,
  },
  en: {
    uye: (ad) => `${ad} is already working with one helper (each member can have at most one). Do not open another copy: give the work to the existing ${ad} or its helper with SendMessage, or try again when one finishes.`,
    misafir: (n) => `The limit for helpers outside the team is reached (at most ${n}, one per team member). Do not open a new helper: give the work to a team member or try again when a helper finishes.`,
  },
};

// Döner: null (izin) ya da { neden } (ret). uyeSayisi: kattaki ekip üyesi sayısı.
export function altAjanKarari(d, calisanlar, ev, { uyeSayisi = 0, dil = 'tr' } = {}) {
  if (ev.hook_event_name !== 'PreToolUse' || ev.agent_id) return null; // yalnızca şefin açtığı ajanlar sayılır
  if (ev.tool_name !== 'Agent' && ev.tool_name !== 'Task') return null;
  const g = ev.tool_input && typeof ev.tool_input === 'object' ? ev.tool_input : {};
  const m = METIN[dil] || METIN.tr;
  const rol = rolCoz(d, g.subagent_type, g.name);
  const aktif = [...calisanlar.values()];
  if (rol !== MISAFIR_ID) {
    if (aktif.filter((x) => x.rol === rol).length >= 2) return { neden: m.uye((d.tanimlar.get(rol) || {}).ad || turKodu(g.subagent_type) || rol) };
    return null;
  }
  const sinir = Math.max(1, uyeSayisi);
  if (aktif.filter((x) => x.rol === MISAFIR_ID).length >= sinir) return { neden: m.misafir(sinir) };
  return null;
}

// Claude Code ve Codex PreToolUse ret cevabı
export const retCevabi = (neden) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: neden } });
