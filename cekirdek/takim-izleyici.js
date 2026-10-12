// ~/.claude/teams/*/config.json dosyalarını izler: kim ekipte, ajan kimliği hangi ada ait.
// Bu dosyanın biçimi Claude Code'un iç yapısıdır, o yüzden alan adlarını esnek okur ve
// okuyamazsa sessizce boş döner. Asıl veri kaynağı hook olaylarıdır.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KOK = path.join(os.homedir(), '.claude', 'teams');

function uyeOku(u) {
  if (!u || typeof u !== 'object') return null;
  const ad = u.name ?? u.teammateName ?? u.teammate_name;
  if (typeof ad !== 'string' || !ad) return null;
  const agentId = u.agentId ?? u.agent_id ?? u.id ?? null;
  const tur = u.agentType ?? u.agent_type ?? u.type ?? null;
  return { ad, agentId: typeof agentId === 'string' ? agentId : null, tur: typeof tur === 'string' ? tur : null };
}

export function takimlariOku(kok = KOK) {
  const sonuc = [];
  let klasorler = [];
  try {
    klasorler = fs.readdirSync(kok, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return sonuc;
  }
  for (const k of klasorler) {
    try {
      const ham = JSON.parse(fs.readFileSync(path.join(kok, k.name, 'config.json'), 'utf8'));
      const liste = Array.isArray(ham.members) ? ham.members : [];
      const uyeler = liste.map(uyeOku).filter(Boolean);
      sonuc.push({ ad: k.name, oturum: null, uyeler });
    } catch {
      /* henüz yazılmamış ya da okunamayan dosya */
    }
  }
  return sonuc;
}

export function takimIzle(degisti, aralik = 2000, kok = KOK) {
  let onceki = '';
  const bak = () => {
    const t = takimlariOku(kok);
    const iz = JSON.stringify(t);
    if (iz !== onceki) {
      onceki = iz;
      degisti(t);
    }
  };
  bak();
  const z = setInterval(bak, aralik);
  return () => clearInterval(z);
}
