// Beynin notları: kalıcı hafıza. Her not düz bir Markdown dosyasıdır; [[Başlık]] ile başka notlara bağlanır.
// Klasör Obsidian'da da açılabilir. Klasörler: Projeler/<Proje>, Kararlar, Kişiler, Dersler, Hatalar, Günlük.
import fs from 'node:fs';
import path from 'node:path';

export const NOT_TURLERI = { karar: 'Kararlar', kisi: 'Kişiler', ders: 'Dersler', hata: 'Hatalar', gunluk: 'Günlük', proje: 'Projeler', diger: 'Notlar' };
const BAG = /\[\[([^\]|#\n]{1,120})(?:[|#][^\]\n]*)?\]\]/g;
const ATLA = new Set(['.obsidian', '.git', '.trash']);

// dosya adı: başlıktan güvenli bir ad (Türkçe harfler kalır, yol karakterleri gider)
export function dosyaAdi(baslik) {
  const ad = String(baslik || '')
    .replace(/[\\/:*?"<>|\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return ad || 'Adsız not';
}

function onBilgi(metin) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(metin);
  if (!m) return { bilgi: {}, govde: metin };
  const bilgi = {};
  for (const satir of m[1].split('\n')) {
    const k = /^(\w+):\s*(.*)$/.exec(satir);
    if (k) bilgi[k[1]] = k[2].replace(/^["']|["']$/g, '');
  }
  return { bilgi, govde: metin.slice(m[0].length) };
}

export const baglar = (metin) => [...new Set([...String(metin || '').matchAll(BAG)].map((m) => m[1].trim()))];

export class BeyinNotlari {
  constructor(klasor) {
    this.klasor = klasor;
    fs.mkdirSync(klasor, { recursive: true });
  }

  // klasörün içinde kalan güvenli yol
  yol(goreli) {
    const tam = path.resolve(this.klasor, String(goreli || ''));
    if (!tam.startsWith(path.resolve(this.klasor) + path.sep)) throw new Error('Geçersiz not yolu');
    return tam;
  }

  liste() {
    const sonuc = [];
    const gez = (d, derinlik) => {
      if (derinlik > 4) return;
      let girdiler = [];
      try {
        girdiler = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of girdiler) {
        if (ATLA.has(e.name) || e.name.startsWith('.')) continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) gez(p, derinlik + 1);
        else if (e.isFile() && e.name.endsWith('.md') && sonuc.length < 3000) {
          try {
            const metin = fs.readFileSync(p, 'utf8');
            const { bilgi, govde } = onBilgi(metin);
            const st = fs.statSync(p);
            sonuc.push({
              id: path.relative(this.klasor, p).split(path.sep).join('/'),
              baslik: e.name.slice(0, -3),
              klasor: path.relative(this.klasor, d).split(path.sep).join('/'),
              tur: bilgi.tur || '',
              proje: bilgi.proje || '',
              baglar: baglar(govde),
              ozet: govde.replace(BAG, '$1').replace(/[#>*_`-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160),
              z: st.mtimeMs,
            });
          } catch {
            /* okunamayan not atlanır */
          }
        }
      }
    };
    gez(this.klasor, 0);
    return sonuc.sort((a, b) => b.z - a.z);
  }

  oku(id) {
    const metin = fs.readFileSync(this.yol(id), 'utf8');
    const { bilgi, govde } = onBilgi(metin);
    return { id, baslik: path.basename(id, '.md'), bilgi, metin: govde, baglar: baglar(govde) };
  }

  // Yazar ya da günceller. ekle true ise var olan notun sonuna eklenir. Döner: not kimliği
  yaz({ baslik, metin, tur = 'diger', proje = '', ekle = false }) {
    const ad = dosyaAdi(baslik);
    const turAd = NOT_TURLERI[tur] ? tur : 'diger';
    const klasor = turAd === 'proje' && proje ? path.join(NOT_TURLERI.proje, dosyaAdi(proje)) : NOT_TURLERI[turAd];
    // aynı başlıkta not başka klasördeyse oraya yazılır (bağlar kopmasın)
    const var_ = this.liste().find((n) => n.baslik.toLocaleLowerCase('tr') === ad.toLocaleLowerCase('tr'));
    const goreli = var_ ? var_.id : path.join(klasor, ad + '.md').split(path.sep).join('/');
    const tam = this.yol(goreli);
    fs.mkdirSync(path.dirname(tam), { recursive: true });
    const bugun = new Date().toISOString().slice(0, 10);
    const govde = String(metin || '').trim().slice(0, 20000);
    if (var_ && ekle) {
      fs.appendFileSync(tam, `\n\n## ${bugun}\n\n${govde}\n`);
    } else {
      const ust = ['---', `tur: ${turAd}`, proje ? `proje: ${String(proje).replace(/\n/g, ' ').slice(0, 80)}` : '', `tarih: ${bugun}`, '---', ''].filter((x) => x !== '').join('\n');
      fs.writeFileSync(tam, `${ust}\n# ${ad}\n\n${govde}${proje && !govde.includes(`[[${proje}]]`) ? `\n\nProje: [[${proje}]]` : ''}\n`);
    }
    return goreli;
  }

  // Basit arama: başlık eşleşmesi önde, sonra metin geçen notlar
  ara(sorgu, enCok = 12) {
    const q = String(sorgu || '').toLocaleLowerCase('tr').trim();
    if (!q) return [];
    const kelimeler = q.split(/\s+/).filter(Boolean);
    const puanli = [];
    for (const n of this.liste()) {
      let metin = '';
      try {
        metin = fs.readFileSync(this.yol(n.id), 'utf8').toLocaleLowerCase('tr');
      } catch {
        continue;
      }
      const b = n.baslik.toLocaleLowerCase('tr');
      let puan = 0;
      for (const k of kelimeler) {
        if (b.includes(k)) puan += 5;
        const say = metin.split(k).length - 1;
        puan += Math.min(5, say);
      }
      if (puan) puanli.push({ ...n, puan });
    }
    return puanli.sort((a, b) => b.puan - a.puan).slice(0, enCok);
  }
}

// ---------- beynin araçları ----------
const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });

export function beyinNotAraclari(notlar, olay) {
  return {
    beyin_yaz: {
      aciklama: 'Kalıcı hafızana (beyin klasörü) bir not yazar ya da var olan notu günceller. Önemli kararları, öğrendiğin dersleri, kişileri, çözülen hataları ve proje bilgisini buraya yaz ki sonraki oturumlarda hatırla. Başka notlara [[Başlık]] ile bağla (ör. [[HarDress]], [[Stripe]]). Gizli değer (şifre, anahtar) yazma.',
      sema: nesne({ baslik: yazi('Notun başlığı, kısa ve aranabilir'), metin: yazi('Markdown metin; [[bağlantılar]] kullan'), tur: { type: 'string', enum: Object.keys(NOT_TURLERI) }, proje: yazi('İlgili proje (kat) adı, varsa'), ekle: { type: 'boolean', description: 'true: var olan notun sonuna tarihle ekle' } }, ['baslik', 'metin']),
      calistir: async (g) => {
        const id = notlar.yaz({ baslik: g.baslik, metin: g.metin, tur: g.tur, proje: g.proje || '', ekle: !!g.ekle });
        olay && olay({ tur: 'ani', proje: g.proje || '', metin: String(g.baslik) });
        return `Not kaydedildi: ${id}`;
      },
    },
    beyin_ara: {
      aciklama: 'Kalıcı hafızanda (beyin klasörü) arar. Bir işe başlamadan, karar vermeden ya da sahip geçmişten bir şey sorduğunda önce burada ara.',
      sema: nesne({ sorgu: yazi('Aranacak kelimeler') }, ['sorgu']),
      calistir: async (g) => {
        olay && olay({ tur: 'ara', metin: String(g.sorgu) });
        const r = notlar.ara(String(g.sorgu));
        return r.length ? r.map((n) => ({ id: n.id, baslik: n.baslik, ozet: n.ozet, baglar: n.baglar })) : 'Bu konuda not yok.';
      },
    },
    beyin_oku: {
      aciklama: 'Beyin klasöründen bir notun tamamını okur (beyin_ara sonucundaki id ya da başlık).',
      sema: nesne({ not: yazi('Not kimliği ya da başlığı') }, ['not']),
      calistir: async (g) => {
        const ara = String(g.not);
        const n = notlar.liste().find((x) => x.id === ara || x.baslik.toLocaleLowerCase('tr') === ara.toLocaleLowerCase('tr'));
        if (!n) throw new Error('Not bulunamadı: ' + ara);
        const r = notlar.oku(n.id);
        return `# ${r.baslik}\n\n${r.metin}`;
      },
    },
  };
}

export const BEYIN_NOT_ARAC_ADLARI = ['beyin_yaz', 'beyin_ara', 'beyin_oku'];
