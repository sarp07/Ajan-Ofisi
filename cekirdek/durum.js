// Durum motoru: Claude Code hook olaylarını ofis durumuna çevirir.
// Saf mantık, dosya ya da ağ erişimi yok. Alan adları Claude Code hook girdileriyle aynıdır
// (session_id, agent_id, agent_type, tool_name, tool_input, teammate_name, task_id ...).
import { sade, turKodu, MISAFIR_ID, SEF_ID, MISAFIR_RENK } from './kimlik.js';
import { MOTOR, cevirici } from './dil.js';

const WEB = new Set(['WebSearch', 'WebFetch']);
const AKIS_SINIR = 200;
const GECMIS_SINIR = 30;

export function yeniDurum() {
  return {
    ajanlar: new Map(), // anahtar -> ofisteki kişi
    kimlik: new Map(), // agent_id -> anahtar
    uyeAd: new Map(), // agent_id -> takım dosyasındaki ad
    bekleyenDogum: [], // şefin Agent çağrısıyla adını verdiği, henüz başlamamış kişiler
    gorevler: new Map(),
    oturumlar: new Map(),
    akis: [],
    olayZamanlari: [],
    sonOlay: 0,
    surum: 0,
    tanimlar: new Map(), // şirketteki ajan tanımları: id -> { id, ad, renk }
    sef: { ad: 'Şef', renk: '#F28C28' },
    t: cevirici(MOTOR, 'tr'),
  };
}

// Şirket değişince çağrılır: adlar, renkler ve dil güncellenir
export function sirketAyarla(d, sirket) {
  d.tanimlar = new Map(sirket.ajanlar.map((a) => [a.id, { id: a.id, ad: a.ad, renk: a.renk }]));
  d.sef = { ad: sirket.sef.ad, renk: sirket.sef.renk };
  d.t = cevirici(MOTOR, sirket.dil);
  for (const a of d.ajanlar.values()) {
    if (a.sef) a.ad = a.ikinci ? d.sef.ad + ' · ' + a.ikinci : d.sef.ad;
    else if (d.tanimlar.has(a.rol)) a.ad = d.tanimlar.get(a.rol).ad;
  }
  d.surum++;
}

const kes = (s, n) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const dosyaAdi = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || '';

// Ajan türünü ya da adını şirketteki tanıma eşler. Bulamazsa misafir.
export function rolCoz(d, ...adaylar) {
  for (const aday of adaylar) {
    const k = turKodu(aday);
    if (k && d.tanimlar.has(k)) return k;
  }
  for (const aday of adaylar) {
    const k = sade(aday);
    if (!k) continue;
    for (const t of d.tanimlar.values()) if (sade(t.ad) === k) return t.id;
  }
  return MISAFIR_ID;
}

// Araç çağrısının kısa özeti
export function aracOzet(t, ad, girdi) {
  const g = girdi && typeof girdi === 'object' ? girdi : {};
  switch (ad) {
    case 'Bash':
    case 'PowerShell':
      return kes(g.description || g.command || t('arac.komut'), 70);
    case 'Read':
      return t('arac.oku', { x: dosyaAdi(g.file_path) });
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return t('arac.duzenle', { x: dosyaAdi(g.file_path || g.notebook_path) });
    case 'Write':
      return t('arac.yaz', { x: dosyaAdi(g.file_path) });
    case 'Grep':
      return t('arac.ara', { x: kes(g.pattern, 40) });
    case 'Glob':
      return t('arac.dosyaAra', { x: kes(g.pattern, 40) });
    case 'WebSearch':
      return t('arac.web', { x: kes(g.query, 60) });
    case 'WebFetch': {
      let host = '';
      try {
        host = new URL(g.url).hostname;
      } catch {
        host = kes(g.url, 40);
      }
      return t('arac.sayfa', { x: host });
    }
    case 'Agent':
    case 'Task':
      return t('arac.ajan', { x: kes(g.name || turKodu(g.subagent_type) || g.description, 40) });
    case 'SendMessage':
      return t('arac.mesaj', { x: kes(g.to || g.recipient || '', 30) });
    case 'TaskCreate':
      return t('arac.gorevAc', { x: kes(g.subject, 50) });
    case 'TaskUpdate':
      return t('arac.gorevGuncelle');
    case 'TaskList':
    case 'TaskGet':
      return t('arac.gorevBak');
    case 'TodoWrite':
      return t('arac.yapilacak');
    case 'WaitAgent':
      return t('arac.bekle');
    case 'AskUserQuestion':
      return t('arac.soru');
    case 'ExitPlanMode':
      return t('arac.plan');
    case 'Skill':
      return t('arac.skill', { x: kes(turKodu(g.skill || g.name || ''), 40) });
    default:
      if (ad && ad.startsWith('mcp__')) {
        const p = ad.split('__');
        return p[1] + ': ' + (p[2] || '');
      }
      return ad || '';
  }
}

function akisEkle(d, z, ajan, tur, metin) {
  d.akis.push({ z, id: ajan ? ajan.id : null, ad: ajan ? ajan.ad : d.t('ofis'), rol: ajan ? ajan.rol : null, tur, metin });
  if (d.akis.length > AKIS_SINIR) d.akis.splice(0, d.akis.length - AKIS_SINIR);
}

function durumYap(a, durum, z) {
  if (a.durum !== durum) {
    a.durum = durum;
    a.durumZamani = z;
  }
}

function gecmis(a, z, metin) {
  a.gecmis.push({ z, metin });
  if (a.gecmis.length > GECMIS_SINIR) a.gecmis.shift();
}

function yeniKisi(d, id, alan, z) {
  const a = {
    id,
    ad: alan.ad,
    rol: alan.rol,
    tur: alan.tur || null,
    agentId: alan.agentId || null,
    oturum: alan.oturum || null,
    kalici: !!alan.kalici, // iş bitince ofiste kalır (şirket çalışanı ya da takım arkadaşı)
    sef: !!alan.sef,
    ikinci: alan.ikinci || null,
    durum: alan.durum || 'bosta',
    durumZamani: z,
    gelis: z,
    arac: null,
    ozet: '',
    sonOlay: z,
    aracSayisi: 0,
    mesaj: null,
    gecmis: [],
  };
  d.ajanlar.set(id, a);
  return a;
}

function sefAl(d, ev, z) {
  const oturum = ev.session_id || 'oturum';
  const id = SEF_ID + '@' + oturum;
  let a = d.ajanlar.get(id);
  if (!a) {
    // aynı anda ikinci bir oturum açıksa onun lideri misafir masasına oturur
    const baskaSef = [...d.ajanlar.values()].some((x) => x.sef);
    const klasor = dosyaAdi(ev.cwd);
    const ikinci = baskaSef && klasor ? klasor : null;
    a = yeniKisi(d, id, { ad: ikinci ? d.sef.ad + ' · ' + ikinci : d.sef.ad, rol: SEF_ID, tur: turKodu(ev.agent_type) || null, oturum, sef: true, kalici: true, ikinci }, z);
    akisEkle(d, z, a, 'durum', klasor ? d.t('geldiKlasor', { x: klasor }) : d.t('geldi'));
  }
  return a;
}

// Şirket çalışanı ya da adı bilinen takım arkadaşı
function kisiAl(d, { ad, tur, ev }, z) {
  const rol = rolCoz(d, tur, ad);
  const tanim = d.tanimlar.get(rol);
  const id = 'a:' + (tanim ? rol : sade(ad || turKodu(tur) || 'ajan'));
  let a = d.ajanlar.get(id);
  if (!a) {
    // takım dışı adlı yardımcılar (ör. "cem-final", "zeynep-2") kalıcı değildir: işi bitince ofisten ayrılır
    a = yeniKisi(d, id, { ad: tanim ? tanim.ad : String(ad || turKodu(tur)), rol, tur: turKodu(tur) || null, oturum: ev.session_id, kalici: !!tanim }, z);
    akisEkle(d, z, a, 'durum', d.t('geldi'));
  }
  return a;
}

// Olayın ait olduğu kişiyi bulur ya da oluşturur
function ajanAl(d, ev, z) {
  if (!ev.agent_id) return sefAl(d, ev, z);
  const bilinen = d.kimlik.get(ev.agent_id);
  if (bilinen && d.ajanlar.has(bilinen)) return d.ajanlar.get(bilinen);

  let ad = null;
  if (String(ev.agent_id).includes('@')) ad = String(ev.agent_id).split('@')[0];
  if (!ad && d.uyeAd.has(ev.agent_id)) ad = d.uyeAd.get(ev.agent_id);
  if (!ad) {
    const i = d.bekleyenDogum.findIndex((b) => z - b.z < 120000 && (!b.tur || !ev.agent_type || turKodu(b.tur) === turKodu(ev.agent_type)));
    if (i >= 0) {
      ad = d.bekleyenDogum[i].ad;
      d.bekleyenDogum.splice(i, 1);
    }
  }
  let a;
  if (ad || rolCoz(d, ev.agent_type) !== MISAFIR_ID) {
    a = kisiAl(d, { ad, tur: ev.agent_type, ev }, z);
  } else {
    // şirkette tanımı olmayan tek seferlik yardımcı
    a = yeniKisi(d, 's:' + ev.agent_id, { ad: turKodu(ev.agent_type) || d.t('yardimci'), rol: MISAFIR_ID, tur: turKodu(ev.agent_type), oturum: ev.session_id }, z);
    akisEkle(d, z, a, 'durum', d.t('geldi'));
  }
  a.agentId = ev.agent_id;
  if (ev.agent_type && !a.tur) a.tur = turKodu(ev.agent_type);
  d.kimlik.set(ev.agent_id, a.id);
  return a;
}

function ajanCikar(d, a, z, neden) {
  if (!d.ajanlar.has(a.id)) return;
  d.ajanlar.delete(a.id);
  for (const [k, v] of d.kimlik) if (v === a.id) d.kimlik.delete(k);
  akisEkle(d, z, a, 'durum', neden || d.t('ayrildi'));
}

function isimdenBul(d, ad) {
  if (!ad) return null;
  const s = sade(ad);
  if (s === 'team-lead' || s === 'lead' || s === 'main') return [...d.ajanlar.values()].find((x) => x.sef) || null;
  const rol = rolCoz(d, ad);
  if (rol !== MISAFIR_ID && d.ajanlar.has('a:' + rol)) return d.ajanlar.get('a:' + rol);
  return d.ajanlar.get('a:' + s) || [...d.ajanlar.values()].find((x) => sade(x.ad) === s || sade(x.tur) === s) || null;
}

const GOREV_DURUM = { pending: 'bekliyor', in_progress: 'suruyor', completed: 'bitti' };

// Uygulama oturumu kendisi açtığında çağrılır: şef hemen ofise gelir
export function oturumAc(d, { oturumId, cwd }, z = Date.now()) {
  d.surum++;
  d.oturumlar.set(oturumId, { id: oturumId, bas: z, cwd, son: z, yerel: true });
  for (const [k, g] of d.gorevler) if (g.oturum === oturumId) d.gorevler.delete(k);
  return sefAl(d, { session_id: oturumId, cwd }, z);
}

export function oturumKapat(d, oturumId, z = Date.now()) {
  d.surum++;
  for (const a of [...d.ajanlar.values()]) if (a.oturum === oturumId) ajanCikar(d, a, z, d.t('oturumKapandi'));
  for (const [k, g] of d.gorevler) if (g.oturum === oturumId) d.gorevler.delete(k);
  d.oturumlar.delete(oturumId);
}

// Codex araç adlarını Claude Code karşılıklarına çevirir, böylece ofisin geri kalanı tek dil konuşur.
// Codex bazı araçları ad alanıyla birleştirerek gönderir ("collaborationspawn_agent").
export function codexUyarla(ev) {
  const ad = typeof ev.tool_name === 'string' ? ev.tool_name : '';
  if (!ad || /^[A-Z]/.test(ad) || ad.startsWith('mcp__')) return ev;
  const g = ev.tool_input && typeof ev.tool_input === 'object' ? ev.tool_input : {};
  const yeni = (tool_name, tool_input) => ({ ...ev, tool_name, tool_input });
  if (ad.endsWith('spawn_agent')) return yeni('Agent', { subagent_type: g.agent_type || '', description: g.task_name || '' });
  if (ad.endsWith('wait_agent') || ad.endsWith('wait')) return yeni('WaitAgent', {});
  if (/(^|_)(exec_command|shell|local_shell|unified_exec|container\.exec)$/.test(ad)) {
    const komut = Array.isArray(g.command) ? g.command.join(' ') : g.cmd || g.command || '';
    return yeni('Bash', { command: String(komut), description: g.justification || '' });
  }
  if (ad.endsWith('apply_patch')) {
    const metin = typeof g.input === 'string' ? g.input : typeof g.patch === 'string' ? g.patch : '';
    const m = /\*\*\* (?:Update|Add|Delete) File: (.+)/.exec(metin);
    return yeni('Edit', { file_path: m ? m[1].trim() : '' });
  }
  if (ad.endsWith('web_search')) return yeni('WebSearch', { query: g.query || '' });
  if (ad.endsWith('view_image')) return yeni('Read', { file_path: g.path || '' });
  if (ad.endsWith('update_plan')) return yeni('TodoWrite', {});
  return ev;
}

// Tek bir hook olayını işler
export function olayIsle(d, ev, z = Date.now()) {
  if (!ev || typeof ev !== 'object' || !ev.hook_event_name) return false;
  ev = codexUyarla(ev);
  // Uygulamanın açtığı tek oturum varsa gelen her olay ona aittir (eklenti yalnızca o oturumda yüklü).
  // Claude Code olaylarda farklı bir oturum kimliği kullansa bile şef ikiye bölünmez.
  const yerel = [...d.oturumlar.values()].filter((o) => o.yerel);
  if (yerel.length === 1 && ev.session_id !== yerel[0].id) ev = { ...ev, session_id: yerel[0].id };
  const t = d.t;
  d.sonOlay = z;
  d.surum++;
  d.olayZamanlari.push(z);
  if (d.olayZamanlari.length > 400) d.olayZamanlari.splice(0, 200);
  const olay = ev.hook_event_name;

  if (ev.session_id && olay !== 'SessionEnd') {
    const o = d.oturumlar.get(ev.session_id) || { id: ev.session_id, bas: z };
    o.cwd = ev.cwd || o.cwd;
    o.son = z;
    o.olayGeldi = true;
    if (ev.model) o.model = ev.model;
    d.oturumlar.set(ev.session_id, o);
  }

  switch (olay) {
    case 'SessionStart': {
      if (ev.agent_id) break;
      sefAl(d, ev, z).sonOlay = z;
      break;
    }
    case 'SessionEnd': {
      oturumKapat(d, ev.session_id, z);
      break;
    }
    case 'UserPromptSubmit': {
      const a = sefAl(d, ev, z);
      a.sonOlay = z;
      durumYap(a, 'calisiyor', z);
      a.arac = null;
      a.ozet = t('okuyor');
      akisEkle(d, z, a, 'istek', t(ev.source && ev.source !== 'user' ? 'otomatik' : 'yeniIstek', { x: kes(ev.prompt, 90) }));
      gecmis(a, z, t('istekAldi'));
      break;
    }
    case 'PreToolUse': {
      const a = ajanAl(d, ev, z);
      a.sonOlay = z;
      a.aracSayisi++;
      a.arac = ev.tool_name;
      a.ozet = aracOzet(t, ev.tool_name, ev.tool_input);
      durumYap(a, WEB.has(ev.tool_name) ? 'arastiriyor' : 'calisiyor', z);
      gecmis(a, z, a.ozet);
      const g = ev.tool_input && typeof ev.tool_input === 'object' ? ev.tool_input : {};
      if (ev.tool_name === 'SendMessage') {
        const kimeAd = g.to || g.recipient || '';
        const hedef = isimdenBul(d, kimeAd);
        const metin = kes(g.summary || g.message || g.content || '', 80);
        a.mesaj = { kime: hedef ? hedef.ad : String(kimeAd), kimeId: hedef ? hedef.id : null, metin, zaman: z };
        // satırda da kişinin adı görünsün ("team-lead" yerine şefin adı)
        a.ozet = t('arac.mesaj', { x: kes(a.mesaj.kime, 30) });
        akisEkle(d, z, a, 'mesaj', '→ ' + a.mesaj.kime + ': ' + metin);
      } else if (ev.tool_name === 'Agent' || ev.tool_name === 'Task') {
        const rol = rolCoz(d, g.subagent_type, g.name);
        const kim = rol !== MISAFIR_ID ? d.tanimlar.get(rol).ad : g.name || turKodu(g.subagent_type) || t('yardimci');
        if (g.name) {
          d.bekleyenDogum.push({ ad: g.name, tur: g.subagent_type || null, z });
          if (d.bekleyenDogum.length > 30) d.bekleyenDogum.shift();
        }
        a.ozet = t('arac.ajan', { x: kim });
        akisEkle(d, z, a, 'arac', t('cagiriyor', { x: kim }));
      } else {
        akisEkle(d, z, a, 'arac', (ev.tool_name === 'Bash' ? 'Bash · ' : '') + a.ozet);
      }
      break;
    }
    case 'PostToolUse':
    case 'PostToolUseFailure': {
      const a = ajanAl(d, ev, z);
      a.sonOlay = z;
      if (a.durum === 'onay' || a.durum === 'hata') durumYap(a, 'calisiyor', z);
      const g = ev.tool_input && typeof ev.tool_input === 'object' ? ev.tool_input : {};
      if (olay === 'PostToolUseFailure') {
        if (!ev.is_interrupt) akisEkle(d, z, a, 'hata', t('basarisiz', { a: ev.tool_name, x: kes(ev.error, 80) }));
        break;
      }
      if (ev.tool_name === 'TaskUpdate' && g.taskId != null) {
        const k = String(g.taskId);
        if (g.status === 'deleted') {
          d.gorevler.delete(k);
        } else {
          const gv = d.gorevler.get(k) || { id: k, baslik: g.subject || t('gorev', { x: k }), durum: 'bekliyor', sahip: null, z, oturum: ev.session_id };
          if (g.subject) gv.baslik = g.subject;
          if (g.status && GOREV_DURUM[g.status]) gv.durum = GOREV_DURUM[g.status];
          if (g.owner !== undefined) gv.sahip = g.owner || null;
          else if (g.status === 'in_progress' && !gv.sahip && !a.sef) gv.sahip = a.ad;
          gv.guncel = z;
          d.gorevler.set(k, gv);
          if (g.status === 'in_progress') akisEkle(d, z, a, 'gorev', t('goreveBasladi', { x: kes(gv.baslik, 70) }));
        }
      } else if (ev.tool_name === 'TaskCreate') {
        const tk = ev.tool_response && ev.tool_response.task;
        if (tk && tk.id != null && !d.gorevler.has(String(tk.id))) {
          d.gorevler.set(String(tk.id), { id: String(tk.id), baslik: tk.subject || g.subject || t('gorev', { x: tk.id }), durum: 'bekliyor', sahip: null, z, oturum: ev.session_id });
        }
      }
      break;
    }
    case 'PermissionRequest': {
      const a = ajanAl(d, ev, z);
      a.sonOlay = z;
      a.arac = ev.tool_name;
      a.ozet = aracOzet(t, ev.tool_name, ev.tool_input);
      durumYap(a, 'onay', z);
      akisEkle(d, z, a, 'onay', t('onayBekliyor', { x: a.ozet }));
      gecmis(a, z, t('onayIstedi', { x: a.ozet }));
      break;
    }
    case 'PermissionDenied': {
      const a = ajanAl(d, ev, z);
      a.sonOlay = z;
      durumYap(a, 'calisiyor', z);
      akisEkle(d, z, a, 'onay', t('izinYok', { x: aracOzet(t, ev.tool_name, ev.tool_input) }));
      break;
    }
    case 'Notification': {
      const tip = ev.notification_type;
      if (tip === 'permission_prompt' || tip === 'agent_needs_input' || tip === 'elicitation_dialog') {
        const bekleyen = [...d.ajanlar.values()].some((x) => x.durum === 'onay');
        if (!bekleyen) {
          const a = ajanAl(d, ev, z);
          durumYap(a, 'onay', z);
          a.ozet = kes(ev.message, 70);
          akisEkle(d, z, a, 'onay', kes(ev.message, 100));
        }
      }
      break;
    }
    case 'Stop': {
      const a = ajanAl(d, ev, z);
      a.sonOlay = z;
      durumYap(a, 'bosta', z);
      a.arac = null;
      a.ozet = '';
      akisEkle(d, z, a, 'durum', t('turBitti'));
      gecmis(a, z, t('turBitti'));
      break;
    }
    case 'StopFailure': {
      const a = ajanAl(d, ev, z);
      a.sonOlay = z;
      durumYap(a, 'hata', z);
      const h = typeof ev.error === 'string' ? ev.error : (ev.error && (ev.error.type || ev.error.message)) || t('bilinmeyenHata');
      a.ozet = kes(h, 60);
      akisEkle(d, z, a, 'hata', t('durdu', { x: kes(ev.error_details || h, 100) }));
      gecmis(a, z, t('hata', { x: a.ozet }));
      break;
    }
    case 'SubagentStart': {
      const a = ajanAl(d, ev, z);
      a.sonOlay = z;
      durumYap(a, 'calisiyor', z);
      a.ozet = t('iseBasliyor');
      gecmis(a, z, t('iseBasladi'));
      break;
    }
    case 'SubagentStop': {
      const a = ajanAl(d, ev, z);
      a.sonOlay = z;
      if (a.sef) break;
      if (a.kalici) {
        durumYap(a, 'bosta', z);
        a.arac = null;
        a.ozet = '';
        akisEkle(d, z, a, 'durum', t('isiBitti'));
        gecmis(a, z, t('isiBitti'));
      } else {
        ajanCikar(d, a, z, t('bitirdiAyrildi'));
      }
      break;
    }
    case 'TeammateIdle': {
      const tAd = ev.teammate_name || turKodu(ev.agent_type) || 'ajan';
      const hedefId = 'a:' + (rolCoz(d, ev.agent_type, tAd) !== MISAFIR_ID ? rolCoz(d, ev.agent_type, tAd) : sade(tAd));
      if (!d.ajanlar.has(hedefId)) {
        // adını bilmeden yardımcı olarak tanıdığımız takım arkadaşı: kaydı adına taşı
        const aday = [...d.ajanlar.values()].filter((x) => x.id.startsWith('s:') && sade(x.tur) === sade(tAd));
        if (aday.length === 1) {
          const x = aday[0];
          d.ajanlar.delete(x.id);
          x.id = hedefId;
          x.ad = String(tAd);
          d.ajanlar.set(x.id, x);
          for (const [k, v] of d.kimlik) if (v.startsWith('s:') && !d.ajanlar.has(v)) d.kimlik.set(k, x.id);
        }
      }
      const a = kisiAl(d, { ad: tAd, tur: ev.agent_type, ev }, z);
      a.sonOlay = z;
      if (ev.agent_id) {
        a.agentId = ev.agent_id;
        d.kimlik.set(ev.agent_id, a.id);
      }
      durumYap(a, 'bosta', z);
      a.arac = null;
      a.ozet = '';
      akisEkle(d, z, a, 'durum', t('bosaDustu'));
      gecmis(a, z, t('bosaDustu'));
      break;
    }
    case 'TaskCreated': {
      const k = String(ev.task_id);
      const gv = d.gorevler.get(k) || { id: k, durum: 'bekliyor', sahip: null, z, oturum: ev.session_id };
      gv.baslik = ev.task_subject || gv.baslik || t('gorev', { x: k });
      gv.aciklama = ev.task_description || gv.aciklama || '';
      d.gorevler.set(k, gv);
      const a = ev.teammate_name ? isimdenBul(d, ev.teammate_name) : ev.agent_id ? ajanAl(d, ev, z) : [...d.ajanlar.values()].find((x) => x.sef && x.oturum === ev.session_id) || null;
      akisEkle(d, z, a, 'gorev', t('yeniGorev', { x: kes(gv.baslik, 80) }));
      break;
    }
    case 'TaskCompleted': {
      const k = String(ev.task_id);
      const gv = d.gorevler.get(k) || { id: k, sahip: null, z, oturum: ev.session_id };
      gv.baslik = ev.task_subject || gv.baslik || t('gorev', { x: k });
      gv.durum = 'bitti';
      gv.guncel = z;
      if (ev.teammate_name && !gv.sahip) gv.sahip = ev.teammate_name;
      d.gorevler.set(k, gv);
      const a = ev.teammate_name ? isimdenBul(d, ev.teammate_name) : ev.agent_id ? ajanAl(d, ev, z) : null;
      akisEkle(d, z, a, 'gorev', t('gorevBitti', { x: kes(gv.baslik, 80) }));
      break;
    }
    default:
      break;
  }
  return true;
}

// Takım dosyasından gelen üye listesi (yalnızca ad eşlemesi ve varlık için)
export function takimIsle(d, takimlar, z = Date.now()) {
  let degisti = false;
  const gorulen = new Set();
  for (const tk of takimlar) {
    for (const u of tk.uyeler) {
      if (!u.ad) continue;
      if (u.agentId && d.uyeAd.get(u.agentId) !== u.ad) {
        d.uyeAd.set(u.agentId, u.ad);
        degisti = true;
      }
      if (sade(u.tur) === 'team-lead') continue;
      const rol = rolCoz(d, u.tur, u.ad);
      const id = 'a:' + (rol !== MISAFIR_ID ? rol : sade(u.ad));
      gorulen.add(id);
      let a = d.ajanlar.get(id);
      if (!a) {
        a = kisiAl(d, { ad: u.ad, tur: u.tur, ev: { session_id: tk.oturum || null } }, z);
        degisti = true;
      }
      a.dosyadan = true;
      if (u.agentId) d.kimlik.set(u.agentId, id);
    }
  }
  // takım dosyasından silinen üyeler ofisten ayrılır
  for (const a of [...d.ajanlar.values()]) {
    if (a.dosyadan && !gorulen.has(a.id)) {
      ajanCikar(d, a, z, d.t('ekiptenAyrildi'));
      degisti = true;
    }
  }
  if (degisti) d.surum++;
  return degisti;
}

export function temizle(d) {
  d.ajanlar.clear();
  d.kimlik.clear();
  d.gorevler.clear();
  d.oturumlar.clear();
  d.bekleyenDogum.length = 0;
  d.surum++;
}

// Arayüze giden anlık görüntü
export function goruntu(d, z = Date.now()) {
  const sira = new Map([...d.tanimlar.keys()].map((k, i) => [k, i + 1]));
  sira.set(SEF_ID, 0);
  const ajanlar = [...d.ajanlar.values()]
    .sort((a, b) => (sira.get(a.rol) ?? 999) - (sira.get(b.rol) ?? 999) || a.gelis - b.gelis)
    .map((a) => ({
      id: a.id,
      ad: a.ad,
      rol: a.rol,
      tur: a.tur,
      kalici: a.kalici,
      sef: a.sef,
      durum: a.durum,
      durumZamani: a.durumZamani,
      gelis: a.gelis,
      arac: a.arac,
      ozet: a.ozet,
      sonOlay: a.sonOlay,
      aracSayisi: a.aracSayisi,
      mesaj: a.mesaj && z - a.mesaj.zaman < 15000 ? a.mesaj : null,
      gecmis: a.gecmis.slice(-12),
    }));
  const gorevler = [...d.gorevler.values()]
    .sort((a, b) => a.z - b.z)
    .map((g) => {
      const sahip = g.sahip ? isimdenBul(d, g.sahip) : null;
      const rol = sahip ? sahip.rol : g.sahip ? rolCoz(d, g.sahip) : null;
      const renk = rol === SEF_ID ? d.sef.renk : rol && d.tanimlar.has(rol) ? d.tanimlar.get(rol).renk : rol ? MISAFIR_RENK : null;
      const ad = sahip ? sahip.ad : rol && d.tanimlar.has(rol) ? d.tanimlar.get(rol).ad : g.sahip;
      return { id: g.id, baslik: g.baslik, durum: g.durum, sahip: ad, renk };
    });
  const son10 = d.olayZamanlari.filter((x) => z - x < 10000).length;
  return {
    zaman: z,
    sonOlay: d.sonOlay,
    yogunluk: Math.min(1, son10 / 25),
    oturumlar: [...d.oturumlar.values()].map((o) => ({ id: o.id, cwd: o.cwd, model: o.model, son: o.son, olayGeldi: !!o.olayGeldi })),
    ajanlar,
    gorevler,
    akis: d.akis.slice(-80),
  };
}
