// Kişisel kat: petek görünümü. Her kişi altıgen bir izometrik odada oturur; ortada beynin odası, kenarda yeni oda ekleme.
// Bir izometrik oda (zemin + iki arka duvar) önden bakınca altıgen görünür; odalar bal peteği gibi yan yana dizilir.
// Çizim ofis sahnesiyle aynı motoru (izo.js) ve aynı karakterleri (insanlar.js) kullanır.
import { iso, box, floorQuad, faceX, faceY, shade, alpha, mix, ellipseShadow, roundRect, HW, HH, HZ } from './izo.js';
import { Kisi, kisiCiz, MISAFIR_GORUNUS } from './insanlar.js';

const S = 4; // oda kenarı (dünya birimi)
const H = 3.1; // duvar yüksekliği
const KAL = 0.14; // duvar kalınlığı
const w = S * HW; // altıgenin yarı genişliği
const a = S * HH; // eğik kenarın dikey payı
const e = H * HZ; // dikey kenar
const BOSLUK = 0.955; // odalar arasında ince boşluk

// Oda temaları: zemin, iki duvar, vurgu ve eşyalar. Kişi nerede ve nasıl oturur.
const TEMA = {
  saglik: { zemin: '#CFE8D4', sol: '#EAF4EC', sag: '#D6EAD9', vurgu: '#57B26A', esya: ['yatak', 'bitki', 'masa'], kisi: 'masa' },
  destek: { zemin: '#E3DBF2', sol: '#F2EEF8', sag: '#E2DAF0', vurgu: '#8E7CC3', esya: ['kanepe', 'koltuk', 'bitki', 'hali'], kisi: 'koltuk' },
  koc: { zemin: '#CDEAE6', sol: '#EAF5F3', sag: '#D3ECE8', vurgu: '#17B8A6', esya: ['tahta', 'masa', 'bitki'], kisi: 'masa' },
  reklam: { zemin: '#F6D3D6', sol: '#FBEDEE', sag: '#F4D9DB', vurgu: '#D1495B', esya: ['tahta', 'masa', 'bitki'], kisi: 'masa' },
  tasarim: { zemin: '#F7D6E3', sol: '#FCEEF3', sag: '#F5DCE6', vurgu: '#E26D9A', esya: ['sovale', 'masa', 'bitki'], kisi: 'masa' },
  yazilim: { zemin: '#D3E3F4', sol: '#EDF3FA', sag: '#D7E5F4', vurgu: '#3D7DD8', esya: ['masa2', 'raf', 'bitki'], kisi: 'masa' },
  muhasebe: { zemin: '#F3E6C2', sol: '#FAF4E3', sag: '#F1E5C6', vurgu: '#D9A92B', esya: ['dolap', 'masa', 'bitki'], kisi: 'masa' },
  dil: { zemin: '#D5DEF7', sol: '#EEF1FB', sag: '#D9E0F6', vurgu: '#4F6FD6', esya: ['raf', 'kure', 'masa'], kisi: 'masa' },
  spor: { zemin: '#F9DEC8', sol: '#FCF0E5', sag: '#F7E0CE', vurgu: '#F28C28', esya: ['mat', 'dambil', 'bitki'], kisi: 'ayakta' },
  yazar: { zemin: '#E2E4E9', sol: '#F3F4F6', sag: '#E3E5EA', vurgu: '#7A8496', esya: ['raf', 'masa', 'lamba'], kisi: 'masa' },
  arastirma: { zemin: '#E9DDF5', sol: '#F5EFFA', sag: '#E8DEF4', vurgu: '#A266D6', esya: ['raf', 'masa', 'bitki'], kisi: 'masa' },
};
const VARSAYILAN = { zemin: '#DDE3EA', sol: '#F1F3F6', sag: '#DDE2E9', vurgu: '#5AA2E6', esya: ['masa', 'bitki'], kisi: 'masa' };
const BEYIN = { zemin: '#1E2A3F', sol: '#26344D', sag: '#1F2B40', vurgu: '#17B8A6' };

// ---------- eşyalar (dünya koordinatı, oda içinde 0..S) ----------
const MASA = '#E7D3B1';
const KOYU = '#2B303B';
// masa y ekseni boyunca uzanır; ekran(lar) uzak kenarda, kişiye (−x yönüne) bakar
function masa(ctx, x, y, cift) {
  box(ctx, x, y, 0, 0.85, 1.7, 0.72, MASA, { top: '#F1E2C7' });
  box(ctx, x + 0.62, y + 0.3, 0.72, 0.08, 0.55, 0.42, KOYU);
  if (cift) box(ctx, x + 0.62, y + 0.95, 0.72, 0.08, 0.55, 0.42, KOYU);
  box(ctx, x + 0.18, y + 0.55, 0.72, 0.2, 0.45, 0.03, '#C9CED8');
}
function sandalye(ctx, x, y) {
  box(ctx, x - 0.25, y - 0.25, 0.38, 0.5, 0.5, 0.08, '#3B4252');
  box(ctx, x - 0.3, y - 0.25, 0.46, 0.08, 0.5, 0.5, '#3B4252');
}
function bitki(ctx, x, y) {
  box(ctx, x, y, 0, 0.42, 0.42, 0.36, '#D9774A');
  const [sx, sy] = iso(x + 0.21, y + 0.21, 0.9);
  for (const [dx, dy, r, c] of [[0, 0, 15, '#3F9B6B'], [-9, 7, 11, '#2F7F58'], [9, 6, 11, '#2F7F58'], [0, -10, 10, '#4DB07A']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(sx + dx, sy + dy, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
function kanepe(ctx, x, y, renk) {
  box(ctx, x, y, 0, 0.9, 1.9, 0.38, renk);
  box(ctx, x, y, 0.38, 0.25, 1.9, 0.4, shade(renk, -0.08));
  box(ctx, x, y, 0.38, 0.9, 0.2, 0.18, shade(renk, -0.04));
  box(ctx, x, y + 1.7, 0.38, 0.9, 0.2, 0.18, shade(renk, -0.04));
}
// koltuk bize (+y) dönük: arkalığı −y tarafında
function koltuk(ctx, x, y, renk) {
  box(ctx, x, y, 0, 0.85, 0.85, 0.36, renk);
  box(ctx, x, y, 0.36, 0.85, 0.2, 0.45, shade(renk, -0.08));
}
function raf(ctx, x, y) {
  box(ctx, x, y, 0, 0.45, 1.4, 1.9, '#9A6A48');
  const renkler = ['#D1495B', '#EDAE49', '#3D7DD8', '#57B26A', '#8E7CC3', '#F28C28'];
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 5; i++) box(ctx, x + 0.45, y + 0.12 + i * 0.25, 0.25 + r * 0.6, 0.02, 0.18, 0.4, renkler[(i + r * 2) % renkler.length]);
}
function dolap(ctx, x, y) {
  box(ctx, x, y, 0, 0.55, 1.2, 1.25, '#B9C1CC');
  for (let i = 0; i < 3; i++) box(ctx, x + 0.55, y + 0.15, 0.2 + i * 0.38, 0.02, 0.9, 0.05, '#7B8594');
}
function yatak(ctx, x, y) {
  box(ctx, x, y, 0, 1.0, 2.0, 0.5, '#F4F1EA', { top: '#FFFFFF' });
  box(ctx, x + 0.1, y + 0.1, 0.5, 0.8, 0.45, 0.12, '#CFE8D4');
}
function tahta(ctx, x, y, vurgu) {
  // duvara dayalı beyaz tahta (y sabit duvar önünde)
  box(ctx, x, y, 0.8, 1.7, 0.06, 1.1, '#FBFBFA', { top: '#E6E8EC' });
  faceY(ctx, x, y + 0.06, 1.8, (c) => {
    c.fillStyle = vurgu;
    c.fillRect(20, 20, 50, 8);
    c.fillRect(20, 40, 90, 6);
    c.fillStyle = alpha(vurgu, 0.55);
    c.fillRect(110, 30, 14, 50);
    c.fillRect(130, 50, 14, 30);
    c.fillRect(150, 20, 14, 60);
  });
}
function sovale(ctx, x, y, vurgu) {
  box(ctx, x + 0.3, y + 0.3, 0, 0.08, 0.08, 1.4, '#8D5F40');
  box(ctx, x, y + 0.2, 0.7, 0.9, 0.06, 0.8, '#FBFBFA');
  faceY(ctx, x, y + 0.26, 1.45, (c) => {
    c.fillStyle = vurgu;
    c.beginPath();
    c.arc(45, 35, 18, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#EDAE49';
    c.fillRect(20, 52, 50, 10);
  });
}
function kure(ctx, x, y) {
  box(ctx, x, y, 0, 0.5, 0.5, 0.7, '#9A6A48');
  const [sx, sy] = iso(x + 0.25, y + 0.25, 1.05);
  const g = ctx.createRadialGradient(sx - 4, sy - 5, 2, sx, sy, 15);
  g.addColorStop(0, '#9EC9F5');
  g.addColorStop(1, '#3D7DD8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#57B26A';
  ctx.beginPath();
  ctx.ellipse(sx + 3, sy - 2, 6, 4, 0.4, 0, Math.PI * 2);
  ctx.fill();
}
function mat(ctx, x, y, vurgu) {
  floorQuad(ctx, x, y, 1.2, 2.2, vurgu, 0.03);
  floorQuad(ctx, x + 0.08, y + 0.08, 1.04, 2.04, shade(vurgu, 0.18), 0.04);
}
function dambil(ctx, x, y) {
  for (const dy of [0, 0.5]) {
    box(ctx, x, y + dy, 0, 0.18, 0.18, 0.18, KOYU);
    box(ctx, x + 0.18, y + dy + 0.06, 0.05, 0.4, 0.06, 0.06, '#8C96A6');
    box(ctx, x + 0.58, y + dy, 0, 0.18, 0.18, 0.18, KOYU);
  }
}
function lamba(ctx, x, y) {
  box(ctx, x, y, 0, 0.3, 0.3, 0.05, KOYU);
  box(ctx, x + 0.12, y + 0.12, 0.05, 0.06, 0.06, 1.3, KOYU);
  box(ctx, x - 0.05, y - 0.05, 1.35, 0.4, 0.4, 0.25, '#EDAE49');
}
function hali(ctx, renk) {
  floorQuad(ctx, 0.8, 0.8, 2.6, 2.6, alpha(renk, 0.35), 0.01);
}

// Odanın eşyaları: derinlik sırasıyla (arka önce) çizilecek parçalar ve kişinin yeri
function yerlesim(tema, kisi) {
  const parcalar = [];
  // sıralama anahtarı: parçanın merkezi (arkadakiler önce)
  const ekle = (x, y, fn) => parcalar.push({ d: x + y, fn });
  let yer = null;
  for (const es of tema.esya) {
    if (es === 'masa' || es === 'masa2') {
      // kişi masanın solunda oturur, yüzü masaya ve bize (+x) dönük; masa onun önünde çizilir
      ekle(1.75 + 0.42, 0.7 + 0.85, (c) => masa(c, 1.75, 0.7, es === 'masa2'));
      if (tema.kisi === 'masa' && !yer) yer = { x: 1.3, y: 1.4, yon: '+x', poz: 'yaz', otur: 0.42, sandalye: true };
    } else if (es === 'bitki') ekle(0.35, 3.2, (c) => bitki(c, 0.35, 3.2));
    else if (es === 'kanepe') ekle(0.3, 0.9, (c) => kanepe(c, 0.3, 0.9, tema.vurgu));
    else if (es === 'koltuk') {
      ekle(2.6, 2.3, (c) => koltuk(c, 2.6, 2.3, shade(tema.vurgu, 0.15)));
      if (tema.kisi === 'koltuk' && !yer) yer = { x: 3.02, y: 2.78, yon: '+y', poz: 'oku', otur: 0.4 };
    } else if (es === 'raf') ekle(0.15, 1.2, (c) => raf(c, 0.15, 1.2));
    else if (es === 'dolap') ekle(0.15, 1.3, (c) => dolap(c, 0.15, 1.3));
    else if (es === 'yatak') ekle(0.3, 1.6, (c) => yatak(c, 0.3, 1.6));
    else if (es === 'tahta') ekle(1.1, 0.05, (c) => tahta(c, 1.1, 0.06, tema.vurgu));
    else if (es === 'sovale') ekle(2.8, 1.0, (c) => sovale(c, 2.8, 1.0, tema.vurgu));
    else if (es === 'kure') ekle(3.1, 2.9, (c) => kure(c, 3.1, 2.9));
    else if (es === 'mat') ekle(1.3, 1.0, (c) => mat(c, 1.3, 1.0, tema.vurgu));
    else if (es === 'dambil') ekle(3.0, 0.6, (c) => dambil(c, 3.0, 0.6));
    else if (es === 'lamba') ekle(3.3, 0.5, (c) => lamba(c, 3.3, 0.5));
  }
  if (!yer) yer = tema.kisi === 'ayakta' ? { x: 1.9, y: 2.1, yon: '+y', poz: 'ayakta', otur: 0 } : { x: 2.1, y: 2.4, yon: '+y', poz: 'ayakta', otur: 0 };
  if (kisi) {
    if (yer.sandalye) ekle(yer.x - 0.5, yer.y - 0.3, (c) => sandalye(c, yer.x, yer.y));
    ekle(yer.x, yer.y + 0.01, (c, t) => kisiCiz(c, kisi, t));
  }
  return { parcalar: parcalar.sort((p, q) => p.d - q.d), yer };
}

// ---------- oda ----------
function duvarlar(ctx, tema) {
  // sol duvar (x = 0) ve sağ duvar (y = 0): iç yüzler bize bakar
  box(ctx, -KAL, 0, 0, KAL, S, H, tema.sol, { right: tema.sol, left: shade(tema.sol, -0.25), top: shade(tema.sol, -0.08) });
  box(ctx, -KAL, -KAL, 0, S + KAL, KAL, H, tema.sag, { left: tema.sag, right: shade(tema.sag, -0.25), top: shade(tema.sag, -0.08) });
  // pencere sol duvarda, saat ya da pano sağ duvarda
  faceX(ctx, 0, S - 0.5, H - 0.55, (c) => {
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, 0, 150, 120);
    c.fillStyle = '#A7D8F0';
    c.fillRect(8, 8, 64, 104);
    c.fillRect(78, 8, 64, 104);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillRect(14, 14, 18, 92);
  });
}

function pano(ctx, tema) {
  faceY(ctx, 2.75, 0, H - 0.6, (c) => {
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, 0, 90, 64);
    c.fillStyle = tema.vurgu;
    c.fillRect(10, 40, 12, 16);
    c.fillRect(28, 28, 12, 28);
    c.fillRect(46, 18, 12, 38);
    c.fillStyle = alpha(tema.vurgu, 0.4);
    c.fillRect(64, 32, 12, 24);
  });
}

function beyinOdasi(ctx, t, vurgu) {
  // bedeni yok: ortada nabız gibi atan bir ışık küresi ve çevresinde halkalar
  const [cx, cy] = iso(S / 2, S / 2, 0);
  floorQuad(ctx, 1.2, 1.2, 1.6, 1.6, alpha(vurgu, 0.18), 0.01);
  box(ctx, 1.55, 1.55, 0, 0.9, 0.9, 0.35, '#2F3D57', { top: '#3A4A68' });
  const [ox, oy] = iso(S / 2, S / 2, 1.45);
  const nabiz = 1 + Math.sin(t * 2.2) * 0.06;
  for (let i = 3; i >= 1; i--) {
    ctx.strokeStyle = alpha(vurgu, 0.12 * i);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2, 34 * i * 0.55 * nabiz + 10, 17 * i * 0.55 * nabiz + 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(ox - 6, oy - 8, 2, ox, oy, 30 * nabiz);
  g.addColorStop(0, '#E9FFFB');
  g.addColorStop(0.35, mix(vurgu, '#FFFFFF', 0.35));
  g.addColorStop(1, alpha(vurgu, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(ox, oy, 30 * nabiz, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix(vurgu, '#FFFFFF', 0.2);
  ctx.beginPath();
  ctx.arc(ox, oy, 12, 0, Math.PI * 2);
  ctx.fill();
}

// Altıgen sınırı (oda yerel ekran koordinatı)
function altigen() {
  return [iso(0, 0, H), iso(S, 0, H), iso(S, 0, 0), iso(S, S, 0), iso(0, S, 0), iso(0, S, H)].map(([x, y]) => [x, y]);
}
const KOSE = altigen();
const MERKEZ_Y = (KOSE[0][1] + KOSE[3][1]) / 2;

function yolCiz(ctx, olcek = 1) {
  ctx.beginPath();
  KOSE.forEach(([x, y], i) => {
    const px = x * olcek;
    const py = MERKEZ_Y + (y - MERKEZ_Y) * olcek;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.closePath();
}

function isimlik(ctx, o, renk) {
  const [bx, by] = iso(S, S, 0);
  const y = by - 34;
  ctx.font = '600 13px -apple-system, "SF Pro Text", "Segoe UI", sans-serif';
  const g1 = ctx.measureText(o.ad).width;
  ctx.font = '11px -apple-system, "SF Pro Text", "Segoe UI", sans-serif';
  const g2 = ctx.measureText(o.alt || '').width;
  const gen = Math.max(g1 + (o.acik ? 14 : 0), g2) + 20;
  roundRect(ctx, bx - gen / 2, y - 16, gen, o.alt ? 36 : 24, 8);
  ctx.fillStyle = 'rgba(18,21,28,0.86)';
  ctx.fill();
  ctx.strokeStyle = alpha(renk, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#E9ECF2';
  ctx.font = '600 13px -apple-system, "SF Pro Text", "Segoe UI", sans-serif';
  ctx.fillText(o.ad, bx + (o.acik ? 7 : 0), y);
  if (o.acik) {
    ctx.fillStyle = '#57B26A';
    ctx.beginPath();
    ctx.arc(bx - g1 / 2 - 2, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.alt) {
    ctx.fillStyle = '#98A0B2';
    ctx.font = '11px -apple-system, "SF Pro Text", "Segoe UI", sans-serif';
    ctx.fillText(o.alt, bx, y + 14);
  }
}

// ---------- petek ----------
// Altıgen ızgara: merkez ve çevresindeki halkalar (eksenel koordinat, sivri tepeli altıgen)
const YONLER = [
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
];
// halka sırası: sol üstten başlayıp saat yönünde (sağ üst, sağ, sağ alt, sol alt, sol)
function yerler(n) {
  const sonuc = [[0, 0]];
  for (let r = 1; sonuc.length < n; r++) {
    let q = 0;
    let s = -r;
    for (const k of [2, 3, 4, 5, 0, 1])
      for (let i = 0; i < r; i++) {
        sonuc.push([q, s]);
        q += YONLER[k][0];
        s += YONLER[k][1];
      }
  }
  return sonuc.slice(0, n);
}
const ekran = ([q, r]) => [2 * w * (q + r / 2), (e + a) * r];

// odalar: [{ anahtar, tur: 'beyin' | 'kisi' | 'ekle', ad, alt, oda, renk, gorunus, acik }]
// tikla(oda): odaya tıklanınca
export function petek(kok, { tikla, etiket }) {
  const tuval = document.createElement('canvas');
  tuval.className = 'petekTuval';
  tuval.setAttribute('role', 'img');
  if (etiket) tuval.setAttribute('aria-label', etiket);
  kok.append(tuval);
  const ctx = tuval.getContext('2d');
  let odalar = [];
  let konum = []; // her odanın ekran merkezi
  let olcek = 1;
  let kaydir = [0, 0];
  // sığdırma (temel) ve kamera: tekerlekle yakınlaşma, sürükleyerek gezinme, çift tıkla sıfırlama
  let temel = { olcek: 1, kaydir: [0, 0] };
  const kamera = { z: 1, x: 0, y: 0 };
  let surukle = null;
  const uygula = () => {
    olcek = temel.olcek * kamera.z;
    kaydir = [temel.kaydir[0] * kamera.z + kamera.x, temel.kaydir[1] * kamera.z + kamera.y];
  };
  let ustteki = -1;
  let istek = 0;
  let son = 0;
  let t = 0;
  const kisiler = new Map();

  function kisiAl(o) {
    let k = kisiler.get(o.anahtar);
    if (!k) {
      k = new Kisi(o.anahtar, 'oda', { x: 0, y: 0 });
      k.alfa = 1;
      kisiler.set(o.anahtar, k);
    }
    k.bilgi = { renk: o.renk || '#A9B1BD', gorunus: o.gorunus || MISAFIR_GORUNUS };
    return k;
  }

  function boyutla() {
    const gen = kok.clientWidth || 800;
    const yerl = yerler(odalar.length);
    const ham = yerl.map(ekran);
    const xs = ham.map((p) => p[0]);
    const ys = ham.map((p) => p[1]);
    const minX = Math.min(...xs) - w;
    const maxX = Math.max(...xs) + w;
    const minY = Math.min(...ys) + (KOSE[0][1] - MERKEZ_Y) - 6;
    const maxY = Math.max(...ys) + (KOSE[3][1] - MERKEZ_Y) + 6;
    const bw = maxX - minX;
    const bh = maxY - minY;
    // tuval kabın tamamını kaplar; petek oda sayısı arttıkça büyür ve ilk açılışta ekrana sığdırılır
    const cw = Math.max(320, gen);
    const ch = Math.max(360, kok.clientHeight || 560);
    const s = Math.min(1.1, (cw - 24) / bw, (ch - 24) / bh);
    const dpr = window.devicePixelRatio || 1;
    tuval.style.width = cw + 'px';
    tuval.style.height = ch + 'px';
    tuval.width = Math.round(cw * dpr);
    tuval.height = Math.round(ch * dpr);
    temel = { olcek: s, kaydir: [cw / 2 - ((minX + maxX) / 2) * s, ch / 2 - ((minY + maxY) / 2) * s] };
    uygula();
    konum = ham;
  }

  function ciz() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, tuval.width, tuval.height);
    // arkadakiler önce: üst sıradan alta
    const sira = odalar.map((o, i) => i).sort((i, j) => konum[i][1] - konum[j][1] || konum[i][0] - konum[j][0]);
    for (const i of sira) {
      const o = odalar[i];
      const [px, py] = konum[i];
      ctx.save();
      ctx.translate(kaydir[0] + px * olcek, kaydir[1] + py * olcek);
      ctx.scale(olcek, olcek);
      ctx.translate(0, -MERKEZ_Y);
      // odanın dışı kırpılır, odalar arasında ince boşluk kalır
      ctx.save();
      yolCiz(ctx, BOSLUK);
      ctx.clip();
      if (o.tur === 'ekle') {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(-w, -e - a, 2 * w, 2 * (e + a) + 2 * a);
      } else {
        const tema = o.tur === 'beyin' ? BEYIN : TEMA[o.oda] || { ...VARSAYILAN, vurgu: o.renk || VARSAYILAN.vurgu };
        floorQuad(ctx, 0, 0, S, S, tema.zemin);
        // zemin karoları
        ctx.strokeStyle = alpha('#000000', 0.05);
        ctx.lineWidth = 1;
        for (let i = 1; i < S; i++) {
          const [x1, y1] = iso(i, 0, 0);
          const [x2, y2] = iso(i, S, 0);
          const [x3, y3] = iso(0, i, 0);
          const [x4, y4] = iso(S, i, 0);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.moveTo(x3, y3);
          ctx.lineTo(x4, y4);
          ctx.stroke();
        }
        duvarlar(ctx, tema);
        if (o.tur === 'beyin') beyinOdasi(ctx, t, tema.vurgu);
        else {
          pano(ctx, tema);
          if (tema.esya.includes('hali')) hali(ctx, tema.vurgu);
          const { parcalar } = yerlesim(tema, kisiAl(o));
          const k = kisiler.get(o.anahtar);
          const yer = yerlesim(tema, null).yer;
          k.x = yer.x;
          k.y = yer.y;
          k.yon = yer.yon;
          k.poz = yer.poz;
          k.oturZ = yer.otur;
          k.aktif = !!o.acik;
          for (const p of parcalar) p.fn(ctx, t);
        }
      }
      ctx.restore();
      // çerçeve: üzerine gelince vurgu rengi
      yolCiz(ctx, BOSLUK);
      const vurgu = o.tur === 'beyin' ? BEYIN.vurgu : o.tur === 'ekle' ? '#98A0B2' : (TEMA[o.oda] || {}).vurgu || o.renk || '#5AA2E6';
      if (o.tur === 'ekle') {
        ctx.setLineDash([8, 7]);
        ctx.strokeStyle = ustteki === i ? '#E9ECF2' : 'rgba(152,160,178,0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        const [mx, my] = [0, MERKEZ_Y];
        ctx.strokeStyle = ustteki === i ? '#E9ECF2' : '#98A0B2';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mx - 16, my - 10);
        ctx.lineTo(mx + 16, my - 10);
        ctx.moveTo(mx, my - 26);
        ctx.lineTo(mx, my + 6);
        ctx.stroke();
        ctx.fillStyle = ustteki === i ? '#E9ECF2' : '#98A0B2';
        ctx.font = '600 13px -apple-system, "SF Pro Text", "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(o.ad, mx, my + 34);
      } else {
        ctx.strokeStyle = ustteki === i ? vurgu : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = ustteki === i ? 3 : 1;
        ctx.stroke();
      }
      ctx.restore();
    }
    // isimlikler en üstte: alt sıradaki odalar üst sıranın etiketini örtmesin
    for (const i of sira) {
      const o = odalar[i];
      if (o.tur === 'ekle') continue;
      const [px, py] = konum[i];
      ctx.save();
      ctx.translate(kaydir[0] + px * olcek, kaydir[1] + py * olcek);
      ctx.scale(olcek, olcek);
      ctx.translate(0, -MERKEZ_Y);
      isimlik(ctx, o, o.tur === 'beyin' ? BEYIN.vurgu : (TEMA[o.oda] || {}).vurgu || o.renk || '#5AA2E6');
      ctx.restore();
    }
  }

  function dongu(z) {
    istek = requestAnimationFrame(dongu);
    if (!tuval.isConnected || kok.offsetParent === null) return;
    const dt = son ? Math.min(0.1, (z - son) / 1000) : 0;
    // saniyede ~24 kare yeterli: odalar sakin
    if (son && z - son < 40) return;
    son = z;
    t += dt;
    for (const k of kisiler.values()) k.faz += dt;
    ciz();
  }

  function hangisi(ev) {
    const r = tuval.getBoundingClientRect();
    const mx = ev.clientX - r.left;
    const my = ev.clientY - r.top;
    for (let i = odalar.length - 1; i >= 0; i--) {
      const [px, py] = konum[i];
      // yerel koordinata çevir ve altıgen içinde mi bak
      const lx = (mx - kaydir[0] - px * olcek) / olcek;
      const ly = (my - kaydir[1] - py * olcek) / olcek + MERKEZ_Y;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      yolCiz(ctx, BOSLUK);
      const ic = ctx.isPointInPath(lx, ly);
      ctx.restore();
      if (ic) return i;
    }
    return -1;
  }

  tuval.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = tuval.getBoundingClientRect();
    const mx = ev.clientX - r.left;
    const my = ev.clientY - r.top;
    // dokunmatik yüzeyde iki parmakla kaydırma gezinir, ctrl ya da çimdikle yakınlaşır; farenin tekerleği yakınlaşır
    if (!ev.ctrlKey && Math.abs(ev.deltaX) > Math.abs(ev.deltaY) * 0.5 && ev.deltaMode === 0 && Math.abs(ev.deltaY) < 40) {
      kamera.x -= ev.deltaX;
      kamera.y -= ev.deltaY;
    } else {
      const z2 = Math.max(0.4, Math.min(3.5, kamera.z * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0018))));
      kamera.x = mx - ((mx - kamera.x) * z2) / kamera.z;
      kamera.y = my - ((my - kamera.y) * z2) / kamera.z;
      kamera.z = z2;
    }
    uygula();
    ciz();
  }, { passive: false });
  tuval.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    surukle = { x: ev.clientX, y: ev.clientY, kx: kamera.x, ky: kamera.y, oynadi: false };
  });
  window.addEventListener('mousemove', (ev) => {
    if (!surukle) return;
    const dx = ev.clientX - surukle.x;
    const dy = ev.clientY - surukle.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) surukle.oynadi = true;
    if (!surukle.oynadi) return;
    kamera.x = surukle.kx + dx;
    kamera.y = surukle.ky + dy;
    tuval.style.cursor = 'grabbing';
    uygula();
    ciz();
  });
  window.addEventListener('mouseup', () => {
    if (surukle && surukle.oynadi) setTimeout(() => (surukle = null), 0);
    else surukle = null;
    if (tuval.style.cursor === 'grabbing') tuval.style.cursor = 'grab';
  });
  tuval.addEventListener('dblclick', () => {
    kamera.z = 1;
    kamera.x = 0;
    kamera.y = 0;
    uygula();
    ciz();
  });
  tuval.addEventListener('mousemove', (ev) => {
    if (surukle && surukle.oynadi) return;
    const i = hangisi(ev);
    if (i !== ustteki) {
      ustteki = i;
      tuval.style.cursor = i >= 0 ? 'pointer' : 'grab';
      tuval.title = i >= 0 ? odalar[i].ipucu || odalar[i].ad : '';
    }
  });
  tuval.addEventListener('mouseleave', () => (ustteki = -1));
  tuval.addEventListener('click', (ev) => {
    if (surukle && surukle.oynadi) return; // sürükleme bitişi tıklama sayılmaz
    const i = hangisi(ev);
    if (i >= 0) tikla(odalar[i]);
  });
  const gozlemci = new ResizeObserver(() => (boyutla(), ciz()));
  gozlemci.observe(kok);

  return {
    tuval,
    guncelle(yeni) {
      odalar = yeni;
      boyutla();
      ciz();
      if (!istek) istek = requestAnimationFrame(dongu);
    },
    durdur() {
      cancelAnimationFrame(istek);
      istek = 0;
      gozlemci.disconnect();
    },
  };
}
