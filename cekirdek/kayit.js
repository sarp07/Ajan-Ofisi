// Kayıt defteri: her projede kimden ne istendi, kim ne teslim etti, hangi görev açık kaldı.
// Oturum kapansa da durur. Yeni oturumda şefe kısa bir "kaldığın yer" özeti olarak verilir,
// böylece eski konuşmanın tamamını yeniden yüklemeye (ve o kadar jeton harcamaya) gerek kalmaz.
import fs from 'node:fs';
import path from 'node:path';
import { turKodu, sade } from './kimlik.js';

const SINIR = { istek: 1500, sonuc: 2000, teslim: 1200, atama: 300, gorev: 300, gorevBitti: 300, hata: 400, oturum: 40 };
const EN_BUYUK = 1_500_000; // bayt
const TUTULAN = 1500; // satır

const kes = (s, n) => {
  const m = String(s ?? '').replace(/\s+\n/g, '\n').trim();
  return m.length > n ? m.slice(0, n - 1).trimEnd() + '…' : m;
};
const tekSatir = (s, n) => kes(String(s ?? '').replace(/\s+/g, ' '), n);

export class KayitDefteri {
  constructor(klasor) {
    this.klasor = klasor;
  }

  dosya(projeId) {
    const id = String(projeId || '');
    if (!/^[a-z0-9]{6,20}$/.test(id)) throw new Error('Geçersiz proje');
    return path.join(this.klasor, id + '.jsonl');
  }

  ekle(projeId, kayit) {
    const tur = String(kayit.tur || '');
    if (!(tur in SINIR)) return null;
    const satir = {
      z: Number.isFinite(kayit.z) ? kayit.z : Date.now(),
      tur,
      kim: kayit.kim ? String(kayit.kim).slice(0, 60) : undefined,
      metin: kes(kayit.metin, SINIR[tur]),
      gorev: kayit.gorev ? String(kayit.gorev).slice(0, 40) : undefined,
      oturum: kayit.oturum ? String(kayit.oturum).slice(0, 40) : undefined,
    };
    if (!satir.metin && tur !== 'oturum') return null;
    const dosya = this.dosya(projeId);
    fs.mkdirSync(this.klasor, { recursive: true });
    fs.appendFileSync(dosya, JSON.stringify(satir) + '\n');
    try {
      if (fs.statSync(dosya).size > EN_BUYUK) {
        const satirlar = fs.readFileSync(dosya, 'utf8').split('\n').filter(Boolean).slice(-TUTULAN);
        fs.writeFileSync(dosya + '.tmp', satirlar.join('\n') + '\n');
        fs.renameSync(dosya + '.tmp', dosya);
      }
    } catch {
      /* küçültme başarısızsa kayıt yine de yazıldı */
    }
    return satir;
  }

  oku(projeId, adet = 400) {
    let ham;
    try {
      ham = fs.readFileSync(this.dosya(projeId), 'utf8');
    } catch {
      return [];
    }
    const cikti = [];
    for (const s of ham.split('\n')) {
      if (!s) continue;
      try {
        const k = JSON.parse(s);
        if (k && typeof k === 'object' && k.tur in SINIR) cikti.push(k);
      } catch {
        /* yarım satır atlanır */
      }
    }
    return cikti.slice(-adet);
  }

  sil(projeId) {
    fs.rmSync(this.dosya(projeId), { force: true });
  }
}

function kisiAdi(sirket, ...adaylar) {
  for (const aday of adaylar) {
    const k = turKodu(aday);
    const a = k && sirket.ajanlar.find((x) => x.id === k);
    if (a) return a.ad;
  }
  for (const aday of adaylar) {
    const k = sade(aday);
    const a = k && sirket.ajanlar.find((x) => sade(x.ad) === k);
    if (a) return a.ad;
  }
  return String(adaylar.find(Boolean) || '').replace(/^.*:/, '').slice(0, 40);
}

// Claude Code olayından deftere yazılacak kaydı çıkarır. Yazılmayacaksa null döner.
const pastedSoy = (m) => String(m || '').replace(/<\/?pasted_content[^>]*>/g, '').trim();

// Motorun kendi ürettiği istekler (arka plan görev bildirimi, sistem notu, komut çıktısı) sahibin isteği sayılmaz
export const sistemIstegiMi = (m) => /^\s*(<(task-notification|system-reminder|command-|local-command|bash-|user-memory|ide_|agent-message|teammate-message)|\[Subagent )/i.test(String(m || ''));

export function olaydanKayit(ev, sirket) {
  if (!ev || typeof ev !== 'object') return null;
  const alt = !!ev.agent_id; // ekip üyesinden gelen olay
  const girdi = ev.tool_input && typeof ev.tool_input === 'object' ? ev.tool_input : {};
  switch (ev.hook_event_name) {
    case 'UserPromptSubmit': {
      // çok satırlı yapıştırma sarmalı (<pasted_content id=…>) deftere girmez
      const m = pastedSoy(ev.prompt);
      if (alt || !m || m.startsWith('/') || sistemIstegiMi(m)) return null;
      return { tur: 'istek', metin: m };
    }
    case 'Stop':
      if (alt || !ev.last_assistant_message) return null;
      return { tur: 'sonuc', kim: sirket.sef.ad, metin: ev.last_assistant_message };
    case 'SubagentStop':
      if (!ev.last_assistant_message) return null;
      return { tur: 'teslim', kim: kisiAdi(sirket, ev.agent_type), metin: ev.last_assistant_message };
    case 'PreToolUse':
      if (alt || (ev.tool_name !== 'Agent' && ev.tool_name !== 'Task')) return null;
      return { tur: 'atama', kim: kisiAdi(sirket, girdi.subagent_type, girdi.name), metin: tekSatir(girdi.description || girdi.prompt, SINIR.atama) };
    case 'TaskCreated':
      return { tur: 'gorev', gorev: ev.task_id, kim: ev.teammate_name ? kisiAdi(sirket, ev.teammate_name) : undefined, metin: tekSatir(ev.task_subject, SINIR.gorev) };
    case 'TaskCompleted':
      return { tur: 'gorevBitti', gorev: ev.task_id, kim: ev.teammate_name ? kisiAdi(sirket, ev.teammate_name) : undefined, metin: tekSatir(ev.task_subject, SINIR.gorev) };
    case 'StopFailure':
      return { tur: 'hata', metin: tekSatir(ev.error_details || ev.error, SINIR.hata) };
    default:
      return null;
  }
}

// Defterden "nerede kalındı" bilgisini çıkarır: son istekler ve sonuçları, açık görevler, son teslimler.
export function durumCikar(kayitlar) {
  const istekler = [];
  let acik = null;
  for (const k of kayitlar) {
    // eski sürümde deftere girmiş sistem istekleri atlanır
    if (k.tur === 'istek' && !sistemIstegiMi(k.metin)) {
      acik = { z: k.z, istek: pastedSoy(k.metin), sonuc: '', onceki: '', sonucZ: 0 };
      istekler.push(acik);
    } else if (k.tur === 'sonuc' && acik) {
      // Takım modunda şef aynı istek için birkaç kez söz alır: son iki söz tutulur
      acik.onceki = acik.sonuc;
      acik.sonuc = k.metin;
      acik.sonucZ = k.z;
    }
  }
  // açık görevler: yalnızca görev açılan son oturuma bakılır
  const gorevler = new Map();
  let gorevOturumu = null;
  for (const k of kayitlar) {
    if (k.tur !== 'gorev' && k.tur !== 'gorevBitti') continue;
    if (k.oturum !== gorevOturumu && k.tur === 'gorev') {
      gorevOturumu = k.oturum;
      gorevler.clear();
    }
    if (k.tur === 'gorev') gorevler.set(k.gorev || k.metin, k);
    else gorevler.delete(k.gorev || k.metin);
  }
  const teslimler = kayitlar.filter((k) => k.tur === 'teslim').slice(-3);
  const son = kayitlar.length ? kayitlar[kayitlar.length - 1].z : 0;
  return { istekler: istekler.slice(-3), acikGorevler: [...gorevler.values()].slice(0, 8), teslimler, sonZaman: son, kayitSayisi: kayitlar.length };
}

const D = {
  tr: {
    baslik: 'Kaldığın yer',
    giris: 'Bu bölüm bu projenin kayıt defterinden çıkarıldı, önceki oturumlarda olanların özetidir. Kullanıcı devam et derse buradan sürdür. Biten işi yeniden yapma, aynı dosyaları baştan tarama. Emin olmadığın yerde kullanıcıya sor.',
    son: 'Son çalışma',
    istekler: 'Son istekler ve sonuçları',
    istek: 'İstek',
    sonuc: 'Sonuç',
    sonra: 'Sonra',
    yarim: 'sonuç kaydı yok, iş yarım kalmış olabilir',
    gorevler: 'Açık kalan görevler',
    teslimler: 'Ekipten son teslimler',
  },
  en: {
    baslik: 'Where you left off',
    giris: 'This section comes from the work log of this project and summarises earlier sessions. If the user says continue, pick up from here. Do not redo finished work or rescan the same files. Ask the user when unsure.',
    son: 'Last activity',
    istekler: 'Latest requests and results',
    istek: 'Request',
    sonuc: 'Result',
    sonra: 'Then',
    yarim: 'no result recorded, the work may be unfinished',
    gorevler: 'Open tasks',
    teslimler: 'Latest handoffs from the team',
  },
};

function tarih(z, dil) {
  try {
    return new Date(z).toLocaleString(dil === 'en' ? 'en-GB' : 'tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return new Date(z).toISOString();
  }
}

// Şefin başlangıç talimatına eklenecek kısa devir notu. Kayıt yoksa boş döner.
export function devirOzeti(kayitlar, dil = 'tr') {
  const m = D[dil] || D.tr;
  const d = durumCikar(kayitlar);
  if (!d.istekler.length && !d.acikGorevler.length && !d.teslimler.length) return '';
  const b = [`## ${m.baslik}`, m.giris, `${m.son}: ${tarih(d.sonZaman, dil)}`];
  if (d.istekler.length) {
    b.push(
      `### ${m.istekler}\n\n` +
        d.istekler
          .map((i, n) => `${n + 1}. ${m.istek}: ${tekSatir(i.istek, 320)}\n   ${m.sonuc}: ${i.sonuc ? (i.onceki ? tekSatir(i.onceki, 300) + ' ' + m.sonra + ': ' : '') + tekSatir(i.sonuc, 420) : m.yarim}`)
          .join('\n')
    );
  }
  if (d.acikGorevler.length) b.push(`### ${m.gorevler}\n\n` + d.acikGorevler.map((g) => `- ${g.metin}${g.kim ? ' (' + g.kim + ')' : ''}`).join('\n'));
  if (d.teslimler.length) b.push(`### ${m.teslimler}\n\n` + d.teslimler.map((t) => `- ${t.kim || '?'}: ${tekSatir(t.metin, 260)}`).join('\n'));
  return b.join('\n\n');
}
