// Kimlik yardımcıları: ad sadeleştirme, kısa kod üretme, renk ve görünüş seçimi.
// Hem ana süreç hem arayüz kullanır, Node bağımlılığı yoktur.
const TR = { ş: 's', Ş: 's', ı: 'i', İ: 'i', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };

export function sade(s) {
  return String(s ?? '')
    .replace(/[şŞıİğĞüÜöÖçÇ]/g, (ch) => TR[ch])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Claude Code ajan adı: küçük harf, rakam ve tire
export function kod(s) {
  const k = sade(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return k || 'ajan';
}

export function benzersizKod(istenen, mevcutlar) {
  const taban = kod(istenen);
  const yasak = new Set([...mevcutlar, 'sef', 'misafir', 'team-lead', 'lead', 'main']);
  if (!yasak.has(taban)) return taban;
  for (let i = 2; i < 500; i++) if (!yasak.has(taban + '-' + i)) return taban + '-' + i;
  return taban + '-' + Date.now();
}

// Eklenti öneki olan ajan türünü sadeleştirir: "ofis:backend" -> "backend"
export function turKodu(tur) {
  const s = String(tur ?? '');
  return sade(s.includes(':') ? s.slice(s.lastIndexOf(':') + 1) : s);
}

export const RENKLER = ['#F28C28', '#8E7CC3', '#57B26A', '#3F88C5', '#E86A92', '#17B8A6', '#C9A227', '#D1495B', '#7C8CA3', '#5B8DEF', '#A66DD4', '#3BA99C'];
export const TENLER = ['#F3D0B0', '#F0C8A0', '#E8B98F', '#C98E63', '#A9744F', '#8D5B3E'];
export const SACLAR = ['#1E1B1A', '#2A2422', '#3A2A1E', '#6B4423', '#A8502E', '#D9B26F', '#9A9A9A', '#C0392B'];
export const STILLER = ['kisa', 'uzun', 'topuz', 'kivircik', 'bere', 'sapka'];
export const EKLER = ['', 'gozluk', 'kulaklik', 'kapuson'];
export const ESYALAR = ['fincan', 'kitap', 'grafik', 'kasa', 'kartela', 'para', 'telefon', 'pano', 'sunucu', 'bitki'];

export function karma(s) {
  let h = 2166136261;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Addan tutarlı bir görünüş üretir (kullanıcı sonradan değiştirebilir)
export function gorunusUret(tohum) {
  const h = karma(tohum);
  const sec = (liste, kay) => liste[(h >>> kay) % liste.length];
  return {
    ten: sec(TENLER, 0),
    sac: sec(SACLAR, 3),
    stil: sec(STILLER, 6),
    ek: sec(EKLER, 9),
    sakal: ((h >>> 12) & 3) === 0,
    alt: sec(['#2B303B', '#3B4252', '#4A4E69', '#23272F'], 14),
  };
}

export const MISAFIR_ID = 'misafir';
export const SEF_ID = 'sef';
export const MISAFIR_RENK = '#A9B1BD';

export function basHarf(ad) {
  const p = String(ad || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  const ilk = [...p[0]];
  if (p.length === 1) return (ilk[0] + (ilk[1] || '')).toLocaleUpperCase('tr');
  return (ilk[0] + [...p[1]][0]).toLocaleUpperCase('tr');
}

// Claude Code'un kabul ettiği ajan renk adlarından en yakını
const CC_RENK = { red: [229, 72, 77], blue: [63, 136, 197], green: [87, 178, 106], yellow: [201, 162, 39], purple: [142, 124, 195], orange: [242, 140, 40], pink: [232, 106, 146], cyan: [23, 184, 166] };
export function ccRenk(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 'blue';
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  let en = 'blue';
  let enU = Infinity;
  for (const [ad, r] of Object.entries(CC_RENK)) {
    const u = (c[0] - r[0]) ** 2 + (c[1] - r[1]) ** 2 + (c[2] - r[2]) ** 2;
    if (u < enU) {
      enU = u;
      en = ad;
    }
  }
  return en;
}
