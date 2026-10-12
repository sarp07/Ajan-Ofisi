// Ofisin yerleşimi: zemin, duvarlar, mobilyalar, oturma noktaları ve yürüme ızgarası.
import { iso, box, floorQuad, faceY, faceX, faceTop, shade, alpha, mix, ellipseShadow, roundRect, HW, HH, HZ } from './izo.js';

export const W = 26;
export const D = 18;
export const WALL_H = 3.3;

const C = {
  sap: '#C4B69E',
  mese: '#DDBF95',
  mese2: '#D4B387',
  ceviz: '#9A6A48',
  ceviz2: '#8D5F40',
  karo: '#ECE7DC',
  karo2: '#C5D6CF',
  hali: '#2C7D85',
  siva: '#EFE8DB',
  yesilDuvar: '#2F4F47',
  masa: '#E7D3B1',
  masaAyak: '#3B4252',
  koyu: '#2B303B',
  metal: '#8C96A6',
  raf: '#7A5236',
  yaprak: '#3F9B6B',
  yaprak2: '#2F7F58',
  saksi: '#D9774A',
  tezgah: '#F3EFE8',
  tezgahGovde: '#31525B',
  kanepe: '#E9843B',
  pong: '#1F6FB2',
};

const KITAP = ['#D1495B', '#EDAE49', '#3F88C5', '#57B26A', '#8E7CC3', '#F2E8CF', '#17B8A6', '#E86A92', '#2B303B', '#F28C28'];

// sabit sözde rastgele
function rnd(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ---------- gökyüzü ----------
export function gokyuzu(saat) {
  // saat: ondalıklı yerel saat
  const P = {
    gece: { ust: '#0C1530', alt: '#22335E', deniz: '#12264A', dag: '#0A1126', isik: 0.34, yildiz: 1 },
    safak: { ust: '#7C8FC9', alt: '#F7C3A2', deniz: '#6E9FC4', dag: '#5B6C99', isik: 0.12, yildiz: 0 },
    gunduz: { ust: '#58B5EE', alt: '#C9EBFB', deniz: '#2793C4', dag: '#7FA6C4', isik: 0, yildiz: 0 },
    aksam: { ust: '#5E5A9E', alt: '#F9A65A', deniz: '#B5647A', dag: '#4A3F73', isik: 0.16, yildiz: 0 },
  };
  if (saat < 5.5 || saat >= 20) return P.gece;
  if (saat < 7.5) return P.safak;
  if (saat < 17.5) return P.gunduz;
  return P.aksam;
}

function pencere(c, u, v, w, h, sky, bolme) {
  // çerçeve
  c.fillStyle = '#FBF8F1';
  c.fillRect(u - 8, v - 8, w + 16, h + 16);
  const g = c.createLinearGradient(0, v, 0, v + h);
  g.addColorStop(0, sky.ust);
  g.addColorStop(0.72, sky.alt);
  c.fillStyle = g;
  c.fillRect(u, v, w, h);
  c.save();
  c.beginPath();
  c.rect(u, v, w, h);
  c.clip();
  if (sky.yildiz) {
    const r = rnd(w + u);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 26; i++) c.fillRect(u + r() * w, v + r() * h * 0.55, 2.2, 2.2);
    c.fillStyle = '#F4EBC9';
    c.beginPath();
    c.arc(u + w * 0.78, v + h * 0.24, 9, 0, Math.PI * 2);
    c.fill();
  }
  // Beydağları silüeti
  c.fillStyle = sky.dag;
  c.beginPath();
  c.moveTo(u, v + h * 0.74);
  const tepe = [0.08, 0.62, 0.18, 0.5, 0.3, 0.6, 0.42, 0.44, 0.55, 0.58, 0.68, 0.5, 0.8, 0.63, 0.92, 0.56, 1, 0.66];
  for (let i = 0; i < tepe.length; i += 2) c.lineTo(u + w * tepe[i], v + h * tepe[i + 1]);
  c.lineTo(u + w, v + h * 0.76);
  c.lineTo(u, v + h * 0.76);
  c.fill();
  // deniz
  c.fillStyle = sky.deniz;
  c.fillRect(u, v + h * 0.75, w, h * 0.25);
  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.fillRect(u, v + h * 0.8, w, 2);
  c.fillRect(u + w * 0.2, v + h * 0.9, w * 0.5, 2);
  // cam yansıması
  c.fillStyle = 'rgba(255,255,255,0.10)';
  c.beginPath();
  c.moveTo(u + w * 0.1, v);
  c.lineTo(u + w * 0.3, v);
  c.lineTo(u + w * 0.08, v + h);
  c.lineTo(u - w * 0.12, v + h);
  c.fill();
  c.restore();
  // bölmeler
  c.fillStyle = '#FBF8F1';
  for (let i = 1; i < bolme; i++) c.fillRect(u + (w * i) / bolme - 3, v, 6, h);
  c.fillRect(u, v + h * 0.33 - 2.5, w, 5);
  // denizlik
  c.fillStyle = '#E3DACA';
  c.fillRect(u - 14, v + h + 8, w + 28, 7);
}

function doseme(ctx, x0, y0, w, d, a, b, kalin = 0.5) {
  const n = Math.round(d / kalin);
  const r = rnd(x0 * 7 + y0 * 13 + 3);
  for (let i = 0; i < n; i++) {
    const t = r();
    floorQuad(ctx, x0, y0 + i * kalin, w, kalin, t < 0.5 ? a : t < 0.8 ? b : mix(a, b, 0.5));
  }
  // tahta ek yerleri
  faceTop(ctx, x0, y0, 0.001, (c) => {
    c.strokeStyle = 'rgba(70,45,20,0.16)';
    c.lineWidth = 1.2;
    const rr = rnd(x0 + y0 * 5 + 9);
    for (let i = 0; i < n; i++) {
      c.beginPath();
      c.moveTo(0, i * kalin * 100);
      c.lineTo(w * 100, i * kalin * 100);
      c.stroke();
      let px = rr() * 220;
      while (px < w * 100) {
        c.beginPath();
        c.moveTo(px, i * kalin * 100);
        c.lineTo(px, (i + 1) * kalin * 100);
        c.stroke();
        px += 170 + rr() * 200;
      }
    }
  });
}

function zeminYazi(ctx, x, y, metin, renk) {
  faceTop(ctx, x, y, 0.002, (c) => {
    c.font = '700 26px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
    c.fillStyle = renk;
    c.textBaseline = 'top';
    let px = 0;
    for (const ch of metin) {
      c.fillText(ch, px, 0);
      px += c.measureText(ch).width + 7;
    }
  });
}

// ---------- sabit katman ----------
export function sabitCiz(ctx, sky, t) {
  // gölge ve döşeme plağı
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 34;
  box(ctx, 0, 0, -0.45, W, D, 0.45, '#8F8676');
  ctx.restore();
  box(ctx, -0.25, -0.25, -0.45, W + 0.25, D + 0.25, 0.45, '#A39A89', { top: C.sap, left: '#8F8676', right: '#766E60' });

  // zeminler
  doseme(ctx, 0, 0, W, D, C.mese, C.mese2);
  doseme(ctx, 15.2, 0, W - 15.2, 8.2, C.ceviz, C.ceviz2);
  // kahve alanı karosu
  for (let i = 0; i < 17; i++) {
    for (let j = 0; j < 14; j++) {
      floorQuad(ctx, i * 0.5, 11 + j * 0.5, 0.5, 0.5, (i + j) % 2 ? C.karo : C.karo2);
    }
  }
  // oyun alanı halısı
  floorQuad(ctx, 10, 9.4, 16, 8.6, C.hali);
  const hr = rnd(77);
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 9; j++) {
      const v = hr();
      if (v < 0.42) floorQuad(ctx, 10 + i, 9.4 + j * (8.6 / 9), 1, 8.6 / 9, v < 0.21 ? shade(C.hali, 0.05) : shade(C.hali, -0.06));
    }
  }

  // kilimler
  faceTop(ctx, 21.9, 2.3, 0.004, (c) => {
    roundRect(c, 0, 0, 330, 420, 14);
    c.fillStyle = '#C8553D';
    c.fill();
    c.strokeStyle = '#F2E8CF';
    c.lineWidth = 8;
    roundRect(c, 20, 20, 290, 380, 8);
    c.stroke();
    c.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.moveTo(60, 80 + i * 66);
      c.lineTo(165, 50 + i * 66);
      c.lineTo(270, 80 + i * 66);
      c.stroke();
    }
  });
  faceTop(ctx, 17.6, 10.5, 0.004, (c) => {
    roundRect(c, 0, 0, 600, 330, 18);
    c.fillStyle = '#F2E8CF';
    c.fill();
    c.fillStyle = '#E9843B';
    for (let i = 0; i < 7; i++) c.fillRect(30 + i * 82, 22, 46, 286);
    c.fillStyle = '#F2E8CF';
    c.fillRect(0, 150, 600, 30);
  });

  // alan adları
  zeminYazi(ctx, 1.0, 10.15, t('alan.calisma'), 'rgba(95,65,30,0.42)');
  zeminYazi(ctx, 16.0, 7.35, t('alan.kutuphane'), 'rgba(255,232,205,0.42)');
  zeminYazi(ctx, 2.2, 17.25, t('alan.kahve'), 'rgba(60,90,85,0.5)');
  zeminYazi(ctx, 10.5, 17.25, t('alan.oyun'), 'rgba(255,255,255,0.4)');

  // duvarlar
  box(ctx, -0.25, -0.25, 0, 0.25, D + 0.25, WALL_H, C.siva, { top: '#FBF8F1', right: shade(C.siva, -0.07) });
  box(ctx, 0, -0.25, 0, W, 0.25, WALL_H, C.siva, { top: '#FBF8F1', right: shade(C.siva, -0.2) });

  // A duvarı (y = 0)
  faceY(ctx, 0, 0, WALL_H, (c) => {
    // kütüphane duvarı
    c.fillStyle = C.yesilDuvar;
    c.fillRect(1520, 0, (W - 15.2) * 100, WALL_H * 100);
    // süpürgelik
    c.fillStyle = '#D8CDBA';
    c.fillRect(0, WALL_H * 100 - 14, 1520, 14);
    // pencere
    pencere(c, 990, 70, 400, 170, sky, 3);
  });

  // B duvarı (x = 0), u = (D - y) * 100
  faceX(ctx, 0, D, WALL_H, (c) => {
    const U = (y) => (D - y) * 100;
    c.fillStyle = 'rgba(0,0,0,0.035)';
    c.fillRect(0, 0, D * 100, WALL_H * 100);
    // kahve alanı fayansı
    const u0 = U(18);
    const u1 = U(11.2);
    c.fillStyle = '#F6F2EA';
    c.fillRect(u0, 110, u1 - u0, 130);
    c.strokeStyle = 'rgba(49,82,91,0.22)';
    c.lineWidth = 1.5;
    for (let x = u0; x <= u1; x += 20) {
      c.beginPath();
      c.moveTo(x, 110);
      c.lineTo(x, 240);
      c.stroke();
    }
    for (let y = 110; y <= 240; y += 20) {
      c.beginPath();
      c.moveTo(u0, y);
      c.lineTo(u1, y);
      c.stroke();
    }
    c.fillStyle = C.tezgahGovde;
    c.fillRect(u0, 0, u1 - u0, 34);
    // pencereler
    pencere(c, U(4.4), 70, 300, 170, sky, 2);
    pencere(c, U(8.4), 70, 300, 170, sky, 2);
    // kapı
    const ku = U(10.6);
    c.fillStyle = '#FBF8F1';
    c.fillRect(ku - 9, 86, 138, 244);
    c.fillStyle = '#B8734A';
    c.fillRect(ku, 95, 120, 235);
    c.fillStyle = '#A5653F';
    c.fillRect(ku + 14, 112, 92, 92);
    c.fillRect(ku + 14, 220, 92, 92);
    c.fillStyle = '#E8C36B';
    c.beginPath();
    c.arc(ku + 104, 215, 5, 0, Math.PI * 2);
    c.fill();
    // süpürgelik
    c.fillStyle = '#CFC4B0';
    c.fillRect(U(11.2), WALL_H * 100 - 14, U(0) - U(11.2), 14);
  });
}

// ---------- hareketli duvar öğeleri ----------
const NOT_RENK = '#F6D55C';
export function duvarCiz(ctx, env) {
  // görev panosu
  faceY(ctx, 2.2, 0, 2.86, (c) => {
    const w = 560;
    const h = 176;
    c.fillStyle = '#9CA3AF';
    c.fillRect(-7, -7, w + 14, h + 14);
    c.fillStyle = '#FBFBF8';
    c.fillRect(0, 0, w, h);
    const kol = [
      [env.t_('pano.bekliyor'), 'bekliyor', '#8C96A6'],
      [env.t_('pano.suruyor'), 'suruyor', '#3F88C5'],
      [env.t_('pano.bitti'), 'bitti', '#57B26A'],
    ];
    const kw = w / 3;
    c.textBaseline = 'top';
    kol.forEach(([ad, anahtar, renk], i) => {
      const liste = env.gorevler.filter((g) => g.durum === anahtar);
      const x0 = i * kw;
      if (i) {
        c.fillStyle = '#E3E5E8';
        c.fillRect(x0 - 1, 8, 2, h - 16);
      }
      c.fillStyle = renk;
      c.font = '800 15px -apple-system, "Helvetica Neue", Arial, sans-serif';
      c.fillText(ad, x0 + 12, 9);
      c.textAlign = 'right';
      c.fillStyle = '#4B5563';
      c.fillText(String(liste.length), x0 + kw - 12, 9);
      c.textAlign = 'left';
      c.fillStyle = renk;
      c.fillRect(x0 + 12, 29, kw - 24, 3);
      const sig = 15;
      liste.slice(-sig).forEach((g, k) => {
        const nx = x0 + 12 + (k % 5) * 33;
        const ny = 40 + Math.floor(k / 5) * 43;
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.fillRect(nx + 2, ny + 3, 28, 36);
        c.fillStyle = g.renk || NOT_RENK;
        c.fillRect(nx, ny, 28, 36);
        c.fillStyle = 'rgba(0,0,0,0.28)';
        c.fillRect(nx + 4, ny + 8, 20, 2.5);
        c.fillRect(nx + 4, ny + 15, 14, 2.5);
        c.fillRect(nx + 4, ny + 22, 17, 2.5);
      });
    });
    // kalem rafı
    c.fillStyle = '#9CA3AF';
    c.fillRect(120, h + 7, 320, 7);
  });

  // duvar saati (gerçek saat)
  faceY(ctx, 8.5, 0, 2.75, (c) => {
    c.fillStyle = '#2B303B';
    c.beginPath();
    c.arc(40, 40, 42, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#FBF8F1';
    c.beginPath();
    c.arc(40, 40, 36, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2B303B';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.fillRect(40 + Math.sin(a) * 30 - 1.5, 40 - Math.cos(a) * 30 - 1.5, 3, 3);
    }
    const d = env.simdi;
    const sa = ((d.getHours() % 12) + d.getMinutes() / 60) / 12;
    const dk = d.getMinutes() / 60;
    c.strokeStyle = '#2B303B';
    c.lineCap = 'round';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(40, 40);
    c.lineTo(40 + Math.sin(sa * Math.PI * 2) * 18, 40 - Math.cos(sa * Math.PI * 2) * 18);
    c.stroke();
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(40, 40);
    c.lineTo(40 + Math.sin(dk * Math.PI * 2) * 27, 40 - Math.cos(dk * Math.PI * 2) * 27);
    c.stroke();
    c.strokeStyle = '#F28C28';
    c.lineWidth = 1.5;
    const sn = d.getSeconds() / 60;
    c.beginPath();
    c.moveTo(40, 40);
    c.lineTo(40 + Math.sin(sn * Math.PI * 2) * 29, 40 - Math.cos(sn * Math.PI * 2) * 29);
    c.stroke();
  });
}

// ---------- ekran içerikleri ----------
const KOD_RENK = ['#7AA2F7', '#9ECE6A', '#E0AF68', '#BB9AF7', '#F7768E', '#7DCFFF', '#A9B1D6'];
function ekranCiz(c, w, h, mod, t, seed) {
  if (mod === 'kapali') {
    c.fillStyle = '#171A21';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,0.04)';
    c.beginPath();
    c.moveTo(w * 0.55, 0);
    c.lineTo(w * 0.8, 0);
    c.lineTo(w * 0.5, h);
    c.lineTo(w * 0.25, h);
    c.fill();
    return;
  }
  c.save();
  c.beginPath();
  c.rect(0, 0, w, h);
  c.clip();
  if (mod === 'bekle') {
    c.fillStyle = '#141B2D';
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(122,162,247,0.5)';
    const px = (Math.sin(t * 0.6 + seed) * 0.35 + 0.5) * w;
    const py = (Math.cos(t * 0.45 + seed) * 0.3 + 0.5) * h;
    c.fillRect(px - 6, py - 4, 12, 8);
  } else if (mod === 'web') {
    c.fillStyle = '#F4F6FA';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#D5DAE3';
    c.fillRect(0, 0, w, 7);
    c.fillStyle = '#3F88C5';
    c.fillRect(6, 12, w * 0.5, 5);
    c.fillStyle = '#B4BCC9';
    for (let i = 0; i < 5; i++) c.fillRect(6, 22 + i * 6, w * (0.5 + ((i * 37 + seed) % 40) / 100), 2.6);
  } else {
    const term = mod === 'terminal';
    c.fillStyle = term ? '#0D1117' : '#151A26';
    c.fillRect(0, 0, w, h);
    if (!term) {
      c.fillStyle = '#1D2434';
      c.fillRect(0, 0, 13, h);
    }
    const sat = 5.2;
    const kay = (t * (term ? 5 : 2.4)) % sat;
    const bas = Math.floor(t * (term ? 5 : 2.4) / sat);
    for (let i = -1; i < h / sat + 1; i++) {
      const r = rnd(seed * 31 + i + bas);
      const y = i * sat - kay + 3;
      let x = (term ? 4 : 17) + Math.floor(r() * 3) * 5;
      const adet = 1 + Math.floor(r() * 3);
      for (let k = 0; k < adet; k++) {
        const len = 6 + r() * 20;
        c.fillStyle = term ? (r() < 0.25 ? '#3FB950' : '#8B949E') : KOD_RENK[Math.floor(r() * KOD_RENK.length)];
        if (x + len < w - 3) c.fillRect(x, y, len, 2.3);
        x += len + 3;
      }
    }
  }
  c.fillStyle = 'rgba(255,255,255,0.06)';
  c.beginPath();
  c.moveTo(w * 0.6, 0);
  c.lineTo(w * 0.85, 0);
  c.lineTo(w * 0.55, h);
  c.lineTo(w * 0.3, h);
  c.fill();
  c.restore();
}

function monitor(ctx, x, y, z, w, mod, t, seed) {
  box(ctx, x + w / 2 - 0.16, y - 0.04, z, 0.32, 0.2, 0.025, '#2B303B');
  box(ctx, x + w / 2 - 0.04, y + 0.02, z, 0.08, 0.05, 0.16, '#3B4252');
  box(ctx, x, y, z + 0.14, w, 0.05, 0.54, '#23272F');
  faceY(ctx, x + 0.03, y + 0.05, z + 0.14 + 0.51, (c) => ekranCiz(c, (w - 0.06) * 100, 48, mod, t, seed));
}

function bitki(ctx, x, y, boy = 1, seed = 1, saksi = C.saksi) {
  ellipseShadow(ctx, x + 0.05, y + 0.05, 17 * boy, 8 * boy, 0.18);
  const s = 0.2 * boy;
  box(ctx, x - s, y - s, 0, s * 2, s * 2, 0.34 * boy, saksi);
  const r = rnd(seed);
  const [cx, cy] = iso(x, y, 0.34 * boy);
  const n = Math.round(9 + 6 * boy);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.5;
    const len = (16 + r() * 24) * boy;
    const ex = cx + Math.cos(a) * len * 0.75;
    const ey = cy + Math.sin(a) * len;
    ctx.save();
    ctx.translate((cx + ex) / 2, (cy + ey) / 2);
    ctx.rotate(Math.atan2(ey - cy, ex - cx));
    ctx.fillStyle = r() < 0.5 ? C.yaprak : r() < 0.6 ? '#57B783' : C.yaprak2;
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, (4.5 + r() * 2.5) * boy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function fincan(ctx, x, y, z, renk = '#FBF8F1') {
  box(ctx, x, y, z, 0.09, 0.09, 0.1, renk);
}

// ---------- ofisi kur ----------
// Şef hariç on masa yeri: [x, y]
export const MASA_YERLERI = [
  [1.2, 1.9],
  [10.8, 1.9],
  [1.2, 4.9],
  [4.4, 4.9],
  [7.6, 4.9],
  [10.8, 4.9],
  [1.2, 7.9],
  [4.4, 7.9],
  [7.6, 7.9],
  [10.8, 7.9],
];
const SEF_MASA = [5.1, 1.9];

export function ofisKur(sirket) {
  const dil = sirket.dil;
  const props = []; // { k, ciz(ctx, env) }
  const blok = []; // [x, y, w, d]
  const P = (k, ciz) => props.push({ k, ciz });
  const B = (x, y, w, d) => blok.push([x, y, w, d]);

  const nokta = { masa: {}, misafir: [], raf: [], koltuk: [], kahve: [], pong: [], ps: [], kapi: { x: 0.9, y: 9.9 } };
  const masaYer = {};

  // ----- file tipi sandalye (sırtı bize dönük, -y yönüne bakar) -----
  function sandalye(cx, cy, renk) {
    P(cx + cy - 0.03, (ctx) => {
      ellipseShadow(ctx, cx, cy + 0.04, 15, 7.5, 0.2);
      box(ctx, cx - 0.04, cy - 0.04, 0.04, 0.08, 0.08, 0.36, '#4A5262');
      box(ctx, cx - 0.25, cy - 0.24, 0.4, 0.5, 0.5, 0.09, '#3A4150');
    });
    P(cx + cy + 0.28, (ctx) => {
      // sırt: ince çerçeve + yarı saydam file
      const y = cy + 0.25;
      const p1 = iso(cx - 0.23, y, 1.02);
      const p2 = iso(cx + 0.23, y, 1.02);
      const p3 = iso(cx + 0.23, y, 0.55);
      const p4 = iso(cx - 0.23, y, 0.55);
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.lineTo(p4[0], p4[1]);
      ctx.closePath();
      ctx.fillStyle = alpha(renk, 0.36);
      ctx.fill();
      ctx.strokeStyle = '#2F3542';
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      box(ctx, cx - 0.03, y - 0.02, 0.46, 0.06, 0.05, 0.12, '#2F3542');
    });
  }

  // ----- masa eşyaları -----
  function esyaCiz(ctx, tip, x, y, z, w, env, acik, renk) {
    const sx = x + w - 0.42;
    if (tip === 'kitap') {
      box(ctx, x + 0.12, y + 0.4, z, 0.3, 0.38, 0.05, KITAP[0]);
      box(ctx, x + 0.14, y + 0.42, z + 0.05, 0.28, 0.34, 0.05, KITAP[2]);
      box(ctx, x + 0.13, y + 0.44, z + 0.1, 0.26, 0.32, 0.04, KITAP[5]);
      fincan(ctx, sx + 0.1, y + 0.5, z);
    } else if (tip === 'grafik') {
      for (let i = 0; i < 4; i++) box(ctx, x + 0.12 + i * 0.09, y + 0.52, z, 0.06, 0.06, 0.07 + i * 0.07, i === 3 ? '#57B26A' : '#A7D7B2');
      fincan(ctx, sx + 0.12, y + 0.52, z);
    } else if (tip === 'kasa') {
      box(ctx, x + 0.1, y + 0.2, z, 0.22, 0.46, 0.5, '#2B303B');
      const p = iso(x + 0.21, y + 0.66, z + 0.4);
      ctx.fillStyle = !acik ? '#4B5563' : Math.sin(env.t * 7) > 0 ? '#3FB950' : '#1F6F35';
      ctx.fillRect(p[0] - 1.5, p[1], 3, 3);
      fincan(ctx, sx + 0.12, y + 0.5, z, renk);
    } else if (tip === 'kartela') {
      ['#E86A92', '#F28C28', '#F6D55C', '#17B8A6'].forEach((k, i) => box(ctx, x + w - 0.5 + i * 0.1, y + 0.3, z, 0.08, 0.3, 0.012, k));
      box(ctx, x + w - 0.5, y + 0.66, z, 0.36, 0.2, 0.012, '#2B303B');
    } else if (tip === 'para') {
      box(ctx, x + 0.14, y + 0.5, z, 0.12, 0.26, 0.03, '#2B303B');
      const p = iso(x + w - 0.3, y + 0.55, z + 0.02);
      ctx.fillStyle = '#C9A227';
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] + 2, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F6D55C';
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (tip === 'telefon') {
      box(ctx, x + 0.16, y + 0.42, z, 0.14, 0.04, 0.26, '#2B303B');
      box(ctx, x + 0.36, y + 0.42, z, 0.14, 0.04, 0.26, '#EDEFF3');
      fincan(ctx, sx + 0.14, y + 0.5, z, renk);
    } else if (tip === 'pano') {
      box(ctx, x + 0.12, y + 0.42, z, 0.28, 0.38, 0.02, '#B8734A');
      box(ctx, x + 0.14, y + 0.45, z + 0.02, 0.24, 0.33, 0.008, '#FBF8F1');
      fincan(ctx, sx + 0.14, y + 0.5, z, renk);
    } else if (tip === 'sunucu') {
      box(ctx, x + 0.1, y + 0.3, z, 0.34, 0.3, 0.12, '#3B4252');
      box(ctx, x + 0.1, y + 0.3, z + 0.13, 0.34, 0.3, 0.12, '#3B4252');
      for (let i = 0; i < 2; i++) {
        const p = iso(x + 0.16, y + 0.6, z + 0.08 + i * 0.13);
        ctx.fillStyle = !acik ? '#4B5563' : Math.sin(env.t * 5 + i * 2) > 0 ? '#7DCFFF' : '#2A5F7A';
        ctx.fillRect(p[0], p[1], 3, 2.5);
      }
    } else if (tip === 'bitki') {
      box(ctx, x + 0.14, y + 0.46, z, 0.16, 0.16, 0.14, '#F2E8CF');
      const p = iso(x + 0.22, y + 0.54, z + 0.14);
      ctx.fillStyle = C.yaprak;
      ctx.beginPath();
      ctx.ellipse(p[0] - 4, p[1] - 6, 3.5, 7, -0.5, 0, Math.PI * 2);
      ctx.ellipse(p[0] + 4, p[1] - 6, 3.5, 7, 0.5, 0, Math.PI * 2);
      ctx.ellipse(p[0], p[1] - 9, 3.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      fincan(ctx, sx + 0.12, y + 0.5, z, renk);
    } else {
      fincan(ctx, x + 0.16, y + 0.52, z, renk);
      box(ctx, sx, y + 0.48, z, 0.26, 0.34, 0.015, '#FBF8F1');
    }
  }

  // ----- çalışma masası -----
  function masa(kisi, x, y, w = 2.0) {
    const d = 0.92;
    const id = kisi.id;
    const seed = 2 + (masaSayac++ % 9);
    const cx = x + w / 2;
    const cy = y + 1.27;
    masaYer[id] = { x, y, w, d };
    nokta.masa[id] = { x: cx, y: cy, yon: '-y', otur: 0.49, poz: 'yaz' };
    B(x - 0.05, y - 0.05, w + 0.1, d + 0.1);
    B(cx - 0.3, cy - 0.3, 0.6, 0.6);
    const etiket = String(kisi.ad || '').toLocaleUpperCase(dil === 'tr' ? 'tr' : 'en').slice(0, 14);
    P(x + y + w / 2 + 0.2, (ctx, env) => {
      const m = env.masa[id] || { mod: 'kapali' };
      const acik = m.mod !== 'kapali';
      ellipseShadow(ctx, cx + 0.15, y + 0.6, w * 30, 15, 0.13);
      box(ctx, x + 0.04, y + 0.06, 0, 0.07, d - 0.12, 0.72, C.masaAyak);
      box(ctx, x + w - 0.11, y + 0.06, 0, 0.07, d - 0.12, 0.72, C.masaAyak);
      box(ctx, x + 0.11, y + 0.1, 0.34, w - 0.22, 0.04, 0.36, shade(C.masaAyak, 0.08));
      box(ctx, x, y, 0.72, w, d, 0.06, C.masa, { left: shade(kisi.renk, -0.05), right: shade(C.masa, -0.22) });
      const z = 0.78;
      if (kisi.sef) {
        monitor(ctx, x + 0.28, y + 0.14, z, 0.95, m.mod, env.t, seed);
        monitor(ctx, x + 1.34, y + 0.14, z, 0.95, acik ? 'bekle' : 'kapali', env.t, seed + 5);
        fincan(ctx, x + 0.1, y + 0.55, z, kisi.renk);
        box(ctx, x + w - 0.36, y + 0.48, z, 0.26, 0.34, 0.015, '#FBF8F1');
      } else {
        monitor(ctx, x + w / 2 - 0.47, y + 0.14, z, 0.94, m.mod, env.t, seed);
        esyaCiz(ctx, kisi.esya, x, y, z, w, env, acik, kisi.renk);
      }
      box(ctx, cx - 0.27, y + 0.56, z, 0.54, 0.17, 0.02, '#D9DCE2');
      box(ctx, cx + 0.38, y + 0.6, z, 0.08, 0.12, 0.025, '#EDEFF3');
      // masa isimliği
      const np = iso(x + 0.24, y + d, 0.76);
      ctx.save();
      ctx.transform(1, 0.5, 0, 1, np[0], np[1]);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '800 7.5px -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(etiket, 0, 0);
      ctx.restore();
    });
    sandalye(cx, cy, kisi.renk);
  }

  let masaSayac = 0;
  masa({ id: 'sef', ad: sirket.sef.ad, renk: sirket.sef.renk, sef: true }, SEF_MASA[0], SEF_MASA[1], 2.6);
  const dolu = new Set();
  for (const a of sirket.ajanlar) {
    if (a.masa < 0 || a.masa >= MASA_YERLERI.length) continue;
    dolu.add(a.masa);
    masa(a, MASA_YERLERI[a.masa][0], MASA_YERLERI[a.masa][1]);
  }
  // boş masa yerleri: tıklanınca yeni çalışan eklenir
  const bosYerler = MASA_YERLERI.map((yer, i) => ({ i, x: yer[0], y: yer[1], w: 2.0, d: 2.0 })).filter((b) => !dolu.has(b.i));

  // ----- sunucu kabini -----
  B(13.0, 8.3, 0.9, 0.9);
  P(13.05 + 8.35 + 0.8, (ctx, env) => {
    ellipseShadow(ctx, 13.5, 8.9, 26, 12, 0.2);
    box(ctx, 13.05, 8.35, 0, 0.8, 0.8, 1.95, '#2B303B');
    faceY(ctx, 13.1, 9.15, 1.9, (c) => {
      c.fillStyle = '#12151C';
      c.fillRect(0, 0, 70, 180);
      for (let i = 0; i < 9; i++) {
        c.fillStyle = '#232936';
        c.fillRect(4, 6 + i * 19, 62, 14);
        for (let k = 0; k < 4; k++) {
          const hiz = 1.5 + env.yogunluk * 9;
          const acik = Math.sin(env.t * hiz + i * 1.7 + k * 2.3) > 0.2;
          c.fillStyle = env.yogunluk > 0 ? (acik ? (k === 3 ? '#F28C28' : '#3FB950') : '#1C3A25') : '#3A4150';
          c.fillRect(8 + k * 7, 10 + i * 19, 4, 4);
        }
      }
    });
  });

  // ----- bölücü alçak raf (çalışma ile kütüphane arası) -----
  B(14.35, 0.3, 0.7, 6.5);
  P(14.4 + 3.5 + 0.2, (ctx) => {
    box(ctx, 14.4, 0.4, 0, 0.55, 6.3, 0.95, '#E7D3B1', { right: C.raf });
    faceX(ctx, 14.95, 6.7, 0.9, (c) => {
      for (let b = 0; b < 4; b++) {
        c.fillStyle = '#5C3D28';
        c.fillRect(8 + b * 157, 6, 146, 36);
        c.fillRect(8 + b * 157, 48, 146, 36);
        const r = rnd(b + 40);
        for (let s = 0; s < 2; s++) {
          let u = 12 + b * 157;
          while (u < 8 + b * 157 + 132) {
            const kw = 6 + r() * 7;
            const kh = 22 + r() * 11;
            c.fillStyle = KITAP[Math.floor(r() * KITAP.length)];
            c.fillRect(u, 6 + s * 42 + 36 - kh, kw, kh);
            u += kw + 1 + (r() < 0.12 ? 14 : 0);
          }
        }
      }
    });
  });
  P(14.4 + 1.2 + 0.25, (ctx) => bitki(ctx, 14.68, 1.0, 0.75, 5, '#F2E8CF'));
  P(14.4 + 3.6 + 0.25, (ctx) => bitki(ctx, 14.68, 3.5, 0.6, 6, '#31525B'));
  P(14.4 + 6.0 + 0.25, (ctx) => bitki(ctx, 14.68, 6.1, 0.8, 7, '#F2E8CF'));
  // bölücü üstündeki bitkiler rafın üstünde dursun
  props.slice(-3).forEach((p) => {
    const eski = p.ciz;
    p.ciz = (ctx) => {
      ctx.save();
      ctx.translate(0, -0.95 * HZ);
      eski(ctx);
      ctx.restore();
    };
  });

  // köşe bitkileri
  B(0.2, 0.2, 0.9, 0.9);
  P(0.7 + 0.7, (ctx) => bitki(ctx, 0.7, 0.7, 1.5, 11));
  B(13.2, 0.3, 0.8, 0.8);
  P(13.6 + 0.7, (ctx) => bitki(ctx, 13.6, 0.7, 1.2, 12, '#31525B'));

  // askılık
  B(0.25, 8.4, 0.5, 0.5);
  P(0.5 + 8.65, (ctx) => {
    ellipseShadow(ctx, 0.5, 8.65, 10, 5, 0.2);
    box(ctx, 0.47, 8.62, 0, 0.06, 0.06, 1.75, '#5C3D28');
    box(ctx, 0.3, 8.62, 1.6, 0.4, 0.06, 0.05, '#5C3D28');
    box(ctx, 0.3, 8.6, 1.05, 0.14, 0.12, 0.55, '#3F88C5');
    box(ctx, 0.58, 8.6, 1.15, 0.12, 0.12, 0.45, '#E9843B');
  });

  // =================== KÜTÜPHANE ===================
  for (let i = 0; i < 6; i++) {
    const x = 15.55 + i * 1.72;
    P(x + 0.3, (ctx) => {
      box(ctx, x, 0.02, 0, 1.64, 0.46, 2.72, C.raf);
      faceY(ctx, x, 0.48, 2.72, (c) => {
        const r = rnd(i * 17 + 3);
        for (let s = 0; s < 6; s++) {
          const y0 = 10 + s * 43;
          c.fillStyle = '#4A2F1E';
          c.fillRect(8, y0, 148, 37);
          let u = 11;
          while (u < 146) {
            const kw = 5 + r() * 8;
            const kh = 22 + r() * 13;
            if (r() < 0.1) {
              u += 12;
              continue;
            }
            c.fillStyle = KITAP[Math.floor(r() * KITAP.length)];
            c.fillRect(u, y0 + 37 - kh, kw, kh);
            if (kw > 9) {
              c.fillStyle = 'rgba(255,255,255,0.35)';
              c.fillRect(u + 2, y0 + 37 - kh + 5, kw - 4, 2);
            }
            u += kw + 1;
          }
        }
      });
    });
  }
  B(15.4, 0, 10.6, 0.6);
  // merdiven
  P(22.6 + 0.9, (ctx) => {
    const a1 = iso(22.45, 1.05, 0);
    const a2 = iso(22.45, 0.5, 2.5);
    const b1 = iso(22.95, 1.05, 0);
    const b2 = iso(22.95, 0.5, 2.5);
    ctx.strokeStyle = '#D9B26F';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a1[0], a1[1]);
    ctx.lineTo(a2[0], a2[1]);
    ctx.moveTo(b1[0], b1[1]);
    ctx.lineTo(b2[0], b2[1]);
    ctx.stroke();
    ctx.lineWidth = 2.2;
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      ctx.beginPath();
      ctx.moveTo(a1[0] + (a2[0] - a1[0]) * t, a1[1] + (a2[1] - a1[1]) * t);
      ctx.lineTo(b1[0] + (b2[0] - b1[0]) * t, b1[1] + (b2[1] - b1[1]) * t);
      ctx.stroke();
    }
  });
  B(22.3, 0.6, 0.8, 0.6);
  [16.4, 18.1, 19.8, 21.4].forEach((x) => nokta.raf.push({ x, y: 1.05, yon: '-y', poz: 'oku' }));

  // ortak okuma masası (misafir ajanlar)
  B(16.9, 3.3, 4.3, 1.2);
  P(17.0 + 3.4 + 1.1, (ctx, env) => {
    ellipseShadow(ctx, 19.2, 4.2, 74, 30, 0.14);
    box(ctx, 17.15, 3.5, 0, 0.1, 0.9, 0.72, '#5C3D28');
    box(ctx, 20.85, 3.5, 0, 0.1, 0.9, 0.72, '#5C3D28');
    box(ctx, 17.0, 3.4, 0.72, 4.1, 1.1, 0.07, '#B8845A');
    // yeşil masa lambaları
    [17.9, 20.2].forEach((lx) => {
      box(ctx, lx, 3.62, 0.79, 0.16, 0.12, 0.02, '#C9A227');
      box(ctx, lx + 0.06, 3.66, 0.81, 0.04, 0.04, 0.2, '#C9A227');
      box(ctx, lx - 0.1, 3.58, 1.01, 0.36, 0.2, 0.09, '#1F7A5A');
    });
    // dizüstüler: yalnızca koltukta misafir varsa açık
    nokta.misafir.forEach((s, i) => {
      const acik = env.misafirAcik[i];
      box(ctx, s.x - 0.2, 4.08, 0.79, 0.4, 0.28, 0.02, '#C9CED6');
      box(ctx, s.x - 0.2, 4.06, 0.81, 0.4, 0.03, 0.26, '#AEB5C0');
      if (acik) faceY(ctx, s.x - 0.18, 4.09, 1.06, (c) => ekranCiz(c, 36, 23, 'kod', env.t, 50 + i));
    });
  });
  [17.75, 19.05, 20.35].forEach((x) => {
    nokta.misafir.push({ x, y: 4.92, yon: '-y', otur: 0.49, poz: 'yaz' });
    B(x - 0.3, 4.65, 0.6, 0.6);
    sandalye(x, 4.92, '#F2E8CF');
  });

  // okuma koltukları
  function koltuk(x, y, renk) {
    B(x - 0.05, y - 0.05, 0.95, 0.95);
    nokta.koltuk.push({ x: x + 0.5, y: y + 0.42, yon: '-x', otur: 0.36, poz: 'oku' });
    P(x + y + 0.3, (ctx) => {
      ellipseShadow(ctx, x + 0.5, y + 0.5, 26, 12, 0.18);
      box(ctx, x + 0.05, y + 0.1, 0.06, 0.7, 0.65, 0.3, renk);
      box(ctx, x + 0.05, y, 0.06, 0.8, 0.12, 0.52, shade(renk, -0.08));
    });
    P(x + y + 1.25, (ctx) => {
      box(ctx, x + 0.05, y + 0.73, 0.06, 0.8, 0.12, 0.52, shade(renk, -0.08));
      box(ctx, x + 0.73, y, 0.06, 0.14, 0.85, 0.82, shade(renk, -0.04));
    });
  }
  koltuk(22.6, 3.0, '#2F6F62');
  koltuk(22.6, 4.9, '#2F6F62');
  // sehpa ve lambader
  B(22.7, 4.05, 0.5, 0.6);
  P(22.75 + 4.1 + 0.4, (ctx) => {
    box(ctx, 22.9, 4.25, 0, 0.1, 0.1, 0.42, '#5C3D28');
    box(ctx, 22.72, 4.08, 0.42, 0.46, 0.46, 0.04, '#B8845A');
    box(ctx, 22.8, 4.16, 0.46, 0.22, 0.3, 0.04, KITAP[6]);
    fincan(ctx, 23.05, 4.38, 0.46);
  });
  B(24.6, 3.9, 0.5, 0.5);
  P(24.85 + 4.15, (ctx, env) => {
    ellipseShadow(ctx, 24.85, 4.15, 11, 5.5, 0.2);
    box(ctx, 24.75, 4.05, 0, 0.2, 0.2, 0.03, '#2B303B');
    box(ctx, 24.83, 4.13, 0, 0.04, 0.04, 1.6, '#2B303B');
    box(ctx, 24.67, 3.97, 1.55, 0.36, 0.36, 0.3, env.sky.isik > 0.1 ? '#FFE3A3' : '#F2E8CF');
  });
  // küre
  B(25.0, 6.5, 0.6, 0.6);
  P(25.3 + 6.8, (ctx) => {
    ellipseShadow(ctx, 25.3, 6.8, 11, 5.5, 0.2);
    box(ctx, 25.24, 6.74, 0, 0.12, 0.12, 0.7, '#5C3D28');
    const p = iso(25.3, 6.8, 1.0);
    ctx.fillStyle = '#3F88C5';
    ctx.beginPath();
    ctx.arc(p[0], p[1], 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57B26A';
    ctx.beginPath();
    ctx.ellipse(p[0] - 3, p[1] - 2, 5, 6.5, 0.4, 0, Math.PI * 2);
    ctx.ellipse(p[0] + 6, p[1] + 4, 3, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C9A227';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(p[0], p[1], 14, -0.5, 2.4);
    ctx.stroke();
  });
  B(25.1, 0.7, 0.8, 0.8);
  P(25.5 + 1.1, (ctx) => bitki(ctx, 25.5, 1.1, 1.1, 21, '#F2E8CF'));

  // =================== OYUN ALANI ===================
  // medya duvarı + televizyon
  B(18.2, 9.4, 4.5, 1.0);
  P(18.4 + 9.5 + 2.2, (ctx, env) => {
    box(ctx, 18.4, 9.5, 0, 4.1, 0.3, 2.55, '#6B4A35');
    faceY(ctx, 18.4, 9.8, 2.55, (c) => {
      // ahşap çıtalar
      for (let i = 0; i < 41; i++) {
        c.fillStyle = i % 2 ? '#7A5640' : '#5E4030';
        c.fillRect(i * 10, 0, 10, 255);
      }
      // televizyon
      c.fillStyle = '#0B0D12';
      c.fillRect(66, 26, 278, 156);
      c.save();
      c.beginPath();
      c.rect(72, 32, 266, 144);
      c.clip();
      if (env.tvAcik) {
        // yarış oyunu
        const g = c.createLinearGradient(0, 32, 0, 176);
        g.addColorStop(0, '#1B1464');
        g.addColorStop(0.48, '#F2709C');
        g.addColorStop(0.5, '#2B303B');
        g.addColorStop(1, '#1A1D24');
        c.fillStyle = g;
        c.fillRect(72, 32, 266, 144);
        c.fillStyle = '#F6D55C';
        c.beginPath();
        c.arc(205, 96, 24, Math.PI, 0);
        c.fill();
        c.fillStyle = '#3A3F4B';
        c.beginPath();
        c.moveTo(195, 104);
        c.lineTo(215, 104);
        c.lineTo(330, 176);
        c.lineTo(80, 176);
        c.fill();
        c.fillStyle = '#FBF8F1';
        const kay = (env.t * 2.2) % 1;
        for (let i = 0; i < 5; i++) {
          const p = (i + kay) / 5;
          const y = 104 + p * p * 72;
          const hw = 1 + p * 5;
          c.fillRect(205 - hw / 2, y, hw, 3 + p * 9);
        }
        const sal = Math.sin(env.t * 1.7) * 22;
        c.fillStyle = '#17B8A6';
        c.fillRect(196 + sal, 148, 30, 14);
        c.fillStyle = '#0E7E72';
        c.fillRect(200 + sal, 142, 22, 8);
        c.fillStyle = '#D1495B';
        c.fillRect(150 - sal * 0.6, 126, 18, 9);
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.font = '800 11px -apple-system, Arial, sans-serif';
        c.fillText('1/3', 80, 46);
      } else {
        c.fillStyle = '#14171E';
        c.fillRect(72, 32, 266, 144);
        c.fillStyle = 'rgba(255,255,255,0.04)';
        c.beginPath();
        c.moveTo(220, 32);
        c.lineTo(280, 32);
        c.lineTo(200, 176);
        c.lineTo(140, 176);
        c.fill();
      }
      c.restore();
    });
    // konsol sehpası
    box(ctx, 18.9, 9.8, 0, 3.1, 0.5, 0.42, '#2B303B');
    box(ctx, 18.85, 9.78, 0.42, 3.2, 0.55, 0.05, '#E7D3B1');
    // PS5: beyaz kanatlar, siyah gövde, mavi ışık
    box(ctx, 21.42, 9.98, 0.47, 0.06, 0.3, 0.5, '#F7F7F5');
    box(ctx, 21.48, 10.0, 0.47, 0.06, 0.26, 0.47, '#15171C');
    box(ctx, 21.54, 9.98, 0.47, 0.06, 0.3, 0.5, '#F7F7F5');
    if (env.tvAcik) {
      const p = iso(21.51, 10.27, 0.92);
      ctx.fillStyle = '#4FB6FF';
      ctx.fillRect(p[0] - 1, p[1], 2.5, 12);
    }
    // oyun kolları
    box(ctx, 19.3, 10.02, 0.47, 0.22, 0.14, 0.05, '#F7F7F5');
    box(ctx, 19.7, 10.02, 0.47, 0.22, 0.14, 0.05, '#2B303B');
    // ses çubuğu
    box(ctx, 19.9, 9.86, 0.47, 1.1, 0.1, 0.08, '#15171C');
  });

  // kanepe
  B(18.9, 12.2, 3.1, 1.2);
  [19.65, 20.45, 21.25].forEach((x) => nokta.ps.push({ x, y: 12.72, yon: '-y', otur: 0.36, poz: 'oyun' }));
  P(19.0 + 12.3 + 0.3, (ctx) => {
    ellipseShadow(ctx, 20.5, 12.9, 62, 26, 0.18);
    box(ctx, 19.0, 12.35, 0.08, 2.9, 0.7, 0.3, C.kanepe);
    box(ctx, 19.0, 12.3, 0.08, 0.22, 0.95, 0.5, shade(C.kanepe, -0.1));
  });
  P(19.0 + 12.3 + 3.9, (ctx) => {
    box(ctx, 21.68, 12.3, 0.08, 0.22, 0.95, 0.5, shade(C.kanepe, -0.1));
    box(ctx, 19.0, 13.04, 0.08, 2.9, 0.2, 0.44, shade(C.kanepe, -0.06));
  });
  // puflar
  function puf(x, y, renk) {
    B(x - 0.4, y - 0.4, 0.8, 0.8);
    nokta.ps.push({ x, y, yon: '-y', otur: 0.3, poz: 'oyun' });
    P(x + y - 0.05, (ctx) => {
      ellipseShadow(ctx, x, y + 0.05, 22, 11, 0.2);
      const p = iso(x, y, 0.16);
      ctx.fillStyle = shade(renk, -0.16);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] + 3, 21, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = renk;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] - 3, 19, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  puf(22.9, 11.7, '#17B8A6');
  puf(18.1, 11.7, '#8E7CC3');
  // alçak sehpa
  B(19.9, 10.95, 1.3, 0.7);
  P(20.0 + 11.0 + 0.9, (ctx) => {
    box(ctx, 20.05, 11.05, 0, 1.0, 0.5, 0.26, '#3B4252');
    box(ctx, 20.0, 11.0, 0.26, 1.1, 0.6, 0.04, '#E7D3B1');
    fincan(ctx, 20.2, 11.2, 0.3, '#17B8A6');
    box(ctx, 20.6, 11.15, 0.3, 0.3, 0.22, 0.03, '#D1495B');
  });

  // atari kabini
  B(24.3, 9.6, 1.0, 1.0);
  P(24.4 + 9.7 + 0.8, (ctx, env) => {
    ellipseShadow(ctx, 24.85, 10.25, 24, 11, 0.2);
    box(ctx, 24.4, 9.7, 0, 0.8, 0.8, 1.0, '#D1495B');
    box(ctx, 24.4, 9.7, 1.0, 0.8, 0.55, 0.85, '#B23A4B');
    box(ctx, 24.4, 10.25, 1.0, 0.8, 0.25, 0.08, '#2B303B');
    faceY(ctx, 24.46, 10.25, 1.8, (c) => {
      c.fillStyle = '#0B0D12';
      c.fillRect(0, 0, 68, 62);
      const on = Math.sin(env.t * 2) > -0.6;
      c.fillStyle = '#F6D55C';
      c.fillRect(8 + ((env.t * 14) % 44), 26, 8, 8);
      c.fillStyle = on ? '#7DCFFF' : '#3F88C5';
      for (let i = 0; i < 5; i++) c.fillRect(8 + i * 12, 10, 6, 5);
      c.fillStyle = '#57B26A';
      c.fillRect(28, 50, 12, 5);
    });
    const p = iso(24.62, 10.5, 1.1);
    ctx.fillStyle = '#F6D55C';
    ctx.beginPath();
    ctx.arc(p[0], p[1] - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // pinpon masası
  const PX = 11.5;
  const PY = 13.2;
  B(PX - 0.1, PY - 0.1, 3.2, 1.8);
  nokta.pong.push({ x: PX - 0.62, y: PY + 0.8, yon: '+x', poz: 'pong' });
  nokta.pong.push({ x: PX + 3.62, y: PY + 0.8, yon: '-x', poz: 'pong' });
  P(PX + PY + 2.3, (ctx, env) => {
    ellipseShadow(ctx, PX + 1.6, PY + 0.95, 72, 30, 0.2);
    [0.25, 2.65].forEach((dx) => {
      box(ctx, PX + dx, PY + 0.15, 0, 0.08, 0.08, 0.72, '#2B303B');
      box(ctx, PX + dx, PY + 1.37, 0, 0.08, 0.08, 0.72, '#2B303B');
    });
    box(ctx, PX, PY, 0.72, 3.0, 1.6, 0.06, C.pong, { left: '#15171C', right: '#15171C' });
    faceTop(ctx, PX, PY, 0.781, (c) => {
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 4;
      c.strokeRect(2, 2, 296, 156);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 80);
      c.lineTo(300, 80);
      c.stroke();
    });
    // file
    const n1 = iso(PX + 1.5, PY - 0.06, 0.95);
    const n2 = iso(PX + 1.5, PY + 1.66, 0.95);
    const n3 = iso(PX + 1.5, PY + 1.66, 0.78);
    const n4 = iso(PX + 1.5, PY - 0.06, 0.78);
    ctx.fillStyle = 'rgba(245,245,245,0.55)';
    ctx.beginPath();
    ctx.moveTo(n1[0], n1[1]);
    ctx.lineTo(n2[0], n2[1]);
    ctx.lineTo(n3[0], n3[1]);
    ctx.lineTo(n4[0], n4[1]);
    ctx.fill();
    ctx.strokeStyle = '#FBF8F1';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(n1[0], n1[1]);
    ctx.lineTo(n2[0], n2[1]);
    ctx.stroke();
    if (env.pongAcik) {
      // top
      const f = (env.t * 0.9) % 2;
      const u = f < 1 ? f : 2 - f;
      const bx = PX + 0.15 + u * 2.7;
      const by = PY + 0.8 + Math.sin(env.t * 1.3) * 0.35;
      const ic = (u * 2) % 1;
      const bz = 0.8 + Math.abs(Math.sin(ic * Math.PI)) * 0.42;
      const g = iso(bx, by, 0.785);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(g[0], g[1], 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      const b = iso(bx, by, bz);
      ctx.fillStyle = '#FF9F1C';
      ctx.beginPath();
      ctx.arc(b[0], b[1], 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // raketler masada
      const r1 = iso(PX + 0.5, PY + 0.4, 0.79);
      ctx.fillStyle = '#D1495B';
      ctx.beginPath();
      ctx.ellipse(r1[0], r1[1], 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      const r2 = iso(PX + 2.5, PY + 1.2, 0.79);
      ctx.fillStyle = '#2B303B';
      ctx.beginPath();
      ctx.ellipse(r2[0], r2[1], 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  B(25.0, 16.7, 0.8, 0.8);
  P(25.4 + 17.1, (ctx) => bitki(ctx, 25.4, 17.1, 1.35, 31));
  B(10.3, 9.7, 0.7, 0.7);
  P(10.65 + 10.05, (ctx) => bitki(ctx, 10.65, 10.05, 1.0, 32, '#F2E8CF'));

  // =================== KAHVE ALANI ===================
  B(0, 11.6, 1.0, 6.2);
  P(0.05 + 11.8 + 0.5, (ctx, env) => {
    // buzdolabı en arkada kalmasın diye tezgahla birlikte
    box(ctx, 0.05, 11.75, 0, 0.82, 4.75, 0.9, C.tezgahGovde);
    box(ctx, 0.02, 11.72, 0.9, 0.9, 4.81, 0.05, C.tezgah);
    faceX(ctx, 0.87, 16.5, 0.86, (c) => {
      c.strokeStyle = 'rgba(255,255,255,0.16)';
      c.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        c.strokeRect(8 + i * 95, 8, 84, 70);
        c.fillStyle = '#C9A227';
        c.fillRect(46 + i * 95, 14, 8, 3);
      }
    });
    const z = 0.95;
    // espresso makinesi
    box(ctx, 0.14, 12.5, z, 0.5, 0.86, 0.46, '#C9CED6');
    box(ctx, 0.14, 12.5, z + 0.46, 0.5, 0.86, 0.07, '#2B303B');
    box(ctx, 0.5, 12.62, z + 0.22, 0.2, 0.14, 0.08, '#2B303B');
    box(ctx, 0.5, 13.08, z + 0.22, 0.2, 0.14, 0.08, '#2B303B');
    box(ctx, 0.54, 12.64, z, 0.1, 0.1, 0.1, '#FBF8F1');
    for (let i = 0; i < 3; i++) fincan(ctx, 0.2 + i * 0.12, 12.56, z + 0.53);
    for (let i = 0; i < 3; i++) fincan(ctx, 0.2 + i * 0.12, 12.72, z + 0.53);
    // buhar
    if (env.kahveAcik) {
      for (let i = 0; i < 3; i++) {
        const f = (env.t * 0.5 + i / 3) % 1;
        const p = iso(0.59, 12.69, z + 0.14 + f * 0.6);
        ctx.fillStyle = `rgba(255,255,255,${0.42 * (1 - f)})`;
        ctx.beginPath();
        ctx.arc(p[0] + Math.sin(f * 6 + i) * 3, p[1], 2.5 + f * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // öğütücü
    box(ctx, 0.22, 13.6, z, 0.26, 0.26, 0.3, '#2B303B');
    box(ctx, 0.25, 13.63, z + 0.3, 0.2, 0.2, 0.22, 'rgba(110,70,40,0.9)');
    // lavabo
    box(ctx, 0.2, 14.5, z - 0.01, 0.5, 0.7, 0.02, '#9CA3AF');
    box(ctx, 0.22, 14.82, z, 0.04, 0.04, 0.24, '#C9CED6');
    box(ctx, 0.22, 14.82, z + 0.22, 0.2, 0.04, 0.03, '#C9CED6');
    // kavanozlar
    box(ctx, 0.2, 15.6, z, 0.18, 0.18, 0.26, '#F2E8CF');
    box(ctx, 0.2, 15.85, z, 0.18, 0.18, 0.2, '#B8734A');
    box(ctx, 0.2, 16.1, z, 0.18, 0.18, 0.3, '#E9843B');
    // duvar rafı
    box(ctx, 0.0, 12.2, 2.05, 0.32, 3.9, 0.05, '#B8845A');
    for (let i = 0; i < 6; i++) fincan(ctx, 0.1, 12.4 + i * 0.2, 2.1, ['#FBF8F1', '#17B8A6', '#F28C28'][i % 3]);
    box(ctx, 0.08, 14.3, 2.1, 0.16, 0.5, 0.24, '#31525B');
    const yp = iso(0.16, 15.4, 2.1);
    ctx.fillStyle = C.saksi;
    ctx.fillRect(yp[0] - 5, yp[1] - 8, 10, 8);
    ctx.fillStyle = C.yaprak;
    ctx.beginPath();
    ctx.ellipse(yp[0] - 4, yp[1] - 14, 4, 8, -0.4, 0, Math.PI * 2);
    ctx.ellipse(yp[0] + 4, yp[1] - 14, 4, 8, 0.4, 0, Math.PI * 2);
    ctx.ellipse(yp[0], yp[1] - 17, 4, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // buzdolabı
  P(0.05 + 16.6 + 0.9, (ctx) => {
    box(ctx, 0.05, 16.62, 0, 0.9, 0.95, 2.1, '#E4E7EC');
    const p1 = iso(0.95, 17.5, 1.25);
    const p2 = iso(0.95, 16.65, 1.25);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
    box(ctx, 0.95, 17.38, 1.4, 0.03, 0.04, 0.4, '#8C96A6');
    box(ctx, 0.95, 17.38, 0.6, 0.03, 0.04, 0.5, '#8C96A6');
  });
  nokta.kahve.push({ x: 1.42, y: 12.95, yon: '-x', poz: 'kahve' });
  nokta.kahve.push({ x: 1.42, y: 14.4, yon: '-x', poz: 'kahve' });

  // bar masası ve tabureler
  B(3.5, 13.5, 2.5, 0.9);
  P(3.6 + 13.6 + 1.5, (ctx) => {
    ellipseShadow(ctx, 4.8, 14.1, 44, 18, 0.16);
    box(ctx, 3.75, 13.85, 0, 0.1, 0.1, 1.02, '#2B303B');
    box(ctx, 5.55, 13.85, 0, 0.1, 0.1, 1.02, '#2B303B');
    box(ctx, 3.6, 13.6, 1.02, 2.2, 0.7, 0.06, '#B8845A');
    fincan(ctx, 4.0, 13.95, 1.08);
    fincan(ctx, 5.2, 13.9, 1.08, '#17B8A6');
    box(ctx, 4.5, 13.8, 1.08, 0.3, 0.2, 0.02, '#FBF8F1');
  });
  function tabure(x, y, yon) {
    B(x - 0.25, y - 0.25, 0.5, 0.5);
    nokta.kahve.push({ x, y, yon, otur: 0.72, poz: 'kahve' });
    P(x + y - 0.03, (ctx) => {
      ellipseShadow(ctx, x, y + 0.03, 10, 5, 0.2);
      box(ctx, x - 0.03, y - 0.03, 0, 0.06, 0.06, 0.66, '#2B303B');
      box(ctx, x - 0.19, y - 0.19, 0.66, 0.38, 0.38, 0.07, '#E9843B');
    });
  }
  tabure(4.15, 14.72, '-y');
  tabure(5.25, 14.72, '-y');
  // sarkıt lambalar
  [4.15, 5.25].forEach((x, i) => {
    P(x + 13.95 + 2.5, (ctx, env) => {
      const a = iso(x, 13.95, 3.6);
      const b = iso(x, 13.95, 2.25);
      ctx.strokeStyle = 'rgba(43,48,59,0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      box(ctx, x - 0.16, 13.79, 2.02, 0.32, 0.32, 0.24, i ? '#31525B' : '#F28C28');
      if (env.sky.isik > 0.1) {
        const p = iso(x, 13.95, 2.0);
        ctx.fillStyle = '#FFE3A3';
        ctx.beginPath();
        ctx.ellipse(p[0], p[1], 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });
  // kafe masası
  B(6.0, 16.0, 0.9, 0.9);
  P(6.45 + 16.45 + 0.2, (ctx) => {
    ellipseShadow(ctx, 6.45, 16.5, 22, 10, 0.18);
    box(ctx, 6.4, 16.4, 0, 0.1, 0.1, 0.7, '#2B303B');
    const p = iso(6.45, 16.45, 0.74);
    ctx.fillStyle = '#C9B79B';
    ctx.beginPath();
    ctx.ellipse(p[0], p[1] + 2.5, 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F3EFE8';
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], 22, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    fincan(ctx, 6.35, 16.4, 0.75, '#F28C28');
  });
  tabure(5.45, 16.45, '+x');
  tabure(7.45, 16.45, '-x');
  B(7.5, 17.0, 0.8, 0.8);
  P(7.9 + 17.4, (ctx) => bitki(ctx, 7.9, 17.4, 1.2, 41, '#31525B'));
  // su sebili
  B(2.0, 17.2, 0.6, 0.6);
  P(2.3 + 17.5, (ctx) => {
    ellipseShadow(ctx, 2.3, 17.5, 12, 6, 0.2);
    box(ctx, 2.1, 17.3, 0, 0.4, 0.4, 0.95, '#E4E7EC');
    box(ctx, 2.14, 17.34, 0.95, 0.32, 0.32, 0.42, 'rgba(125,207,255,0.75)');
  });

  // ----- yürüme ızgarası (0.5 birim) -----
  const GW = W * 2;
  const GD = D * 2;
  const doluHucre = new Uint8Array(GW * GD);
  for (const [bx, by, bw, bd] of blok) {
    const x0 = Math.max(0, Math.floor(bx * 2));
    const x1 = Math.min(GW - 1, Math.ceil((bx + bw) * 2) - 1);
    const y0 = Math.max(0, Math.floor(by * 2));
    const y1 = Math.min(GD - 1, Math.ceil((by + bd) * 2) - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) doluHucre[y * GW + x] = 1;
  }
  // duvar dibi
  for (let x = 0; x < GW; x++) doluHucre[x] = 1;
  for (let y = 0; y < GD; y++) doluHucre[y * GW] = 1;

  props.sort((a, b) => a.k - b.k);
  return { props, nokta, masaYer, bosYerler, izgara: { GW, GD, dolu: doluHucre } };
}

// ---------- yol bulma (A*) ----------
export function yolBul(izgara, bas, son) {
  const { GW, GD, dolu } = izgara;
  const hucre = (p) => {
    let gx = Math.min(GW - 1, Math.max(0, Math.floor(p.x * 2)));
    let gy = Math.min(GD - 1, Math.max(0, Math.floor(p.y * 2)));
    if (!dolu[gy * GW + gx]) return [gx, gy];
    // en yakın boş hücre
    for (let r = 1; r < 8; r++) {
      let en = null;
      let enU = 1e9;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < 0 || y < 0 || x >= GW || y >= GD || dolu[y * GW + x]) continue;
          const u = (x / 2 + 0.25 - p.x) ** 2 + (y / 2 + 0.25 - p.y) ** 2;
          if (u < enU) {
            enU = u;
            en = [x, y];
          }
        }
      }
      if (en) return en;
    }
    return [gx, gy];
  };
  const [sx, sy] = hucre(bas);
  const [tx, ty] = hucre(son);
  const N = GW * GD;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const kapali = new Uint8Array(N);
  const acik = [];
  const s = sy * GW + sx;
  const hedef = ty * GW + tx;
  g[s] = 0;
  acik.push([Math.hypot(tx - sx, ty - sy), s]);
  const KOM = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.42],
    [1, -1, 1.42],
    [-1, 1, 1.42],
    [-1, -1, 1.42],
  ];
  while (acik.length) {
    let bi = 0;
    for (let i = 1; i < acik.length; i++) if (acik[i][0] < acik[bi][0]) bi = i;
    const [, cur] = acik.splice(bi, 1)[0];
    if (cur === hedef) break;
    if (kapali[cur]) continue;
    kapali[cur] = 1;
    const cx = cur % GW;
    const cy = (cur - cx) / GW;
    for (const [dx, dy, c] of KOM) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GD) continue;
      const ni = ny * GW + nx;
      if (dolu[ni] || kapali[ni]) continue;
      if (dx && dy && (dolu[cy * GW + nx] || dolu[ny * GW + cx])) continue;
      const ng = g[cur] + c;
      if (ng < g[ni]) {
        g[ni] = ng;
        from[ni] = cur;
        acik.push([ng + Math.hypot(tx - nx, ty - ny), ni]);
      }
    }
  }
  const yol = [];
  if (from[hedef] === -1 && hedef !== s) return [{ x: son.x, y: son.y }];
  let c = hedef;
  while (c !== -1 && c !== s) {
    const x = c % GW;
    yol.push({ x: x / 2 + 0.25, y: (c - x) / GW / 2 + 0.25 });
    c = from[c];
  }
  yol.reverse();
  // düzleştir: aynı yöndeki ara noktaları at
  const sade = [];
  for (let i = 0; i < yol.length; i++) {
    const a = sade[sade.length - 1] || bas;
    const b = yol[i];
    const n = yol[i + 1];
    if (n && Math.abs((b.x - a.x) * (n.y - b.y) - (b.y - a.y) * (n.x - b.x)) < 1e-6) continue;
    sade.push(b);
  }
  sade.push({ x: son.x, y: son.y });
  return sade;
}

export const SINIR = {
  minX: -D * HW - 60,
  maxX: W * HW + 60,
  minY: -WALL_H * HZ - 70,
  maxY: (W + D) * HH + 110,
};
