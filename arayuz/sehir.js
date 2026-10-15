// Projeler haritası: havada duran bir ada şehir. Kule projelerin katlarından oluşur, proje eklendikçe yükselir.
// Seçili kat dışarı kayar ve ekibi masalarında görünür. Gece ve gündüz gerçek saate göre; arabalar, yayalar, asansör, vinç.
// opts: { t, katSec(id), kataGir(id), katKur(), kisisel(), servisler(), saat(evre, saat) }
export const KAT_RENK = ['#17b8a6', '#f28c28', '#5aa2e6', '#a66dd4', '#e86a92', '#d9d36a', '#57b26a', '#ef6f6c', '#7fd8cc', '#c49a6c'];
const DURUM_RENK = { calisiyor: '#84d394', acik: '#7fd8cc', onay: '#f5c47a', hata: '#ff8a8d', bosta: '#98a0b2' };

export function sehirKur(kap, opts) {
  const t = opts.t;
  const c = document.createElement('canvas');
  c.className = 'sehirTuval';
  kap.append(c);
  const ctx = c.getContext('2d');
  let KATLAR = [];
  let sonEtiket = null;
  let kisiselKutu = null;
  let servisKutu = null;
  let yeniKatKutu = null;
  let calisiyor = false;
  let istek = 0;
  const saatBildir = (evre, saat) => opts.saat && opts.saat(evre, saat);
const TEN = ['#f0c9a2', '#e8b48a', '#c8956b', '#a8714f', '#f3d0b0'];

// ---------- tuval ve izdüşüm ----------
let W, H, dpr = Math.min(2, devicePixelRatio), olcek = 21, kx = 0, ky = 0, zaman = 0;
const P = (x, y, z = 0) => [W / 2 + kx + (x - y) * olcek * 0.866, H * 0.56 + ky + (x + y) * olcek * 0.5 - z * olcek];
function poli(pts, dolgu, cizgi, lw = 1) { ctx.beginPath(); pts.forEach(([x, y, z], i) => { const [a, b] = P(x, y, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath(); if (dolgu) { ctx.fillStyle = dolgu; ctx.fill(); } if (cizgi) { ctx.strokeStyle = cizgi; ctx.lineWidth = lw; ctx.stroke(); } }
function kutu(x, y, z, w, d, h, r) {
  poli([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], r.sol);
  poli([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], r.sag);
  poli([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], r.ust);
}
function boyutla() { const b = kap.getBoundingClientRect(); if (!b.width) return; W = b.width; H = b.height; c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; }

// ---------- gece / gündüz (gerçek saate göre, düğmeyle önizlenir) ----------
let gunIsigi = 0, gunHedef = 0, elleGece = null;
function gunHesapla() { const d = new Date(); const s = d.getHours() + d.getMinutes() / 60; const g = elleGece === null ? (s > 7 && s < 19 ? 1 : s > 6 && s < 20 ? 0.5 : 0) : elleGece; gunHedef = g; saatBildir(g > 0.7 ? 'gunduz' : g > 0.2 ? 'alacakaranlik' : 'gece', d.toTimeString().slice(0, 5)); }
const karis = (a, b, t) => { const h = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); const x = h(a), y = h(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };

// ---------- şehir düzeni ----------
const BW = 6, BD = 5, KH = 1.7, LOBI = 2.2; // kule
const YOL = [[-7, -7], [12, -7], [12, 11], [-7, 11]]; // çevre yolu (köşeler)
const yolUzun = (() => { let u = 0; for (let i = 0; i < 4; i++) { const a = YOL[i], b = YOL[(i + 1) % 4]; u += Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); } return u; })();
function yolNokta(s) { s = ((s % yolUzun) + yolUzun) % yolUzun; for (let i = 0; i < 4; i++) { const a = YOL[i], b = YOL[(i + 1) % 4]; const u = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); if (s <= u) { const t = s / u; return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, yon: i }; } s -= u; } }
const arabalar = Array.from({ length: 9 }, (_, i) => ({ s: (i / 9) * yolUzun, h: 2.2 + (i % 3) * 0.7, renk: ['#e5484d', '#5aa2e6', '#f2f2f2', '#f2a93b', '#2b2f3a', '#17b8a6'][i % 6], ters: i % 2 }));
const agaclar = [[-5, -4], [-5, 0], [-5, 5], [-5, 8.6], [9, -5], [10.2, 8.6], [3, 9.4], [7, 9.4], [-1, -5.2]];
// yayalar: kuleyle kişisel ev ve santral arasında gidip gelen ajanlar
const yayalar = Array.from({ length: 9 }, (_, i) => ({ yol: i % 3, t: Math.random(), h: 0.05 + Math.random() * 0.04, ten: TEN[i % 5], gomlek: ['#17b8a6', '#f28c28', '#5aa2e6', '#a66dd4', '#e86a92'][i % 5], yon: 1 }));
const YAYA_YOLLARI = [[[3, 5.6], [3, 7.6], [-3, 7.6], [-3, 6]], [[6.4, 0.5], [8.6, 0.5], [8.6, -3]], [[3, 5.6], [3, 8.2], [9.5, 8.2]]];
function yolUzerinde(yol, t) { const nok = YAYA_YOLLARI[yol]; const n = nok.length - 1; const k = Math.min(n - 1, Math.floor(t * n)); const u = t * n - k; return { x: nok[k][0] + (nok[k + 1][0] - nok[k][0]) * u, y: nok[k][1] + (nok[k + 1][1] - nok[k][1]) * u }; }

// ---------- kule durumu ----------
let secili = 0, acik = 0, asansor = 0, asansorHedef = 0, vinc = 0, yeniKat = 0;
const baloncuklar = []; // {kat, ikon, t}
const roketler = [];
const katZ = (i) => LOBI + i * (KH + 0.1);

// ---------- çizim yardımcıları ----------
function pencereSirasi(i, k, x0, gece) {
  const z = katZ(i); const n = 8, n2 = 6;
  const yanik = k.durum !== 'bosta';
  for (let j = 0; j < n; j++) {
    const a = x0 + 0.2 + j * (BW / n), b = a + BW / n - 0.3;
    const r = Math.sin(i * 17 + j * 7.3) * 0.5 + 0.5;
    let isik = yanik ? (gece ? `rgba(255,${205 + r * 30},${130 + r * 40},.95)` : `rgba(190,225,255,${0.5 + r * 0.3})`) : (gece ? 'rgba(24,32,52,.95)' : 'rgba(120,150,190,.55)');
    if (k.durum === 'hata' && Math.sin(zaman * 8) > 0) isik = 'rgba(255,90,90,.95)';
    if (k.durum === 'onay' && j === 2) isik = `rgba(255,190,80,${0.6 + Math.sin(zaman * 5) * 0.4})`;
    poli([[a, BD + 0.01, z + 0.35], [b, BD + 0.01, z + 0.35], [b, BD + 0.01, z + KH - 0.3], [a, BD + 0.01, z + KH - 0.3]], isik);
    // pencerede çalışan kişi silüeti
    if (yanik && j % 2 === 0 && j / 2 < k.ekip.length) { const [px, py] = P((a + b) / 2, BD + 0.02, z + 0.62 + Math.abs(Math.sin(zaman * 2.5 + j)) * 0.04); ctx.fillStyle = 'rgba(20,24,34,.55)'; ctx.beginPath(); ctx.arc(px, py - 7, 3.2, 0, 7); ctx.fill(); ctx.fillRect(px - 4, py - 4, 8, 7); }
  }
  for (let j = 0; j < n2; j++) {
    const a = 0.2 + j * (BD / n2), b = a + BD / n2 - 0.3; const r = Math.sin(i * 11 + j * 5.1) * 0.5 + 0.5;
    const isik = yanik ? (gece ? `rgba(245,${185 + r * 30},${110 + r * 40},.8)` : `rgba(170,210,245,${0.4 + r * 0.3})`) : (gece ? 'rgba(20,28,46,.95)' : 'rgba(110,140,180,.5)');
    poli([[x0 + BW + 0.01, a, z + 0.35], [x0 + BW + 0.01, b, z + 0.35], [x0 + BW + 0.01, b, z + KH - 0.3], [x0 + BW + 0.01, a, z + KH - 0.3]], isik);
  }
  // kat şeridi (projenin rengi)
  poli([[x0, BD + 0.012, z + 0.05], [x0 + BW, BD + 0.012, z + 0.05], [x0 + BW, BD + 0.012, z + 0.2], [x0, BD + 0.012, z + 0.2]], k.renk);
  poli([[x0 + BW + 0.012, 0, z + 0.05], [x0 + BW + 0.012, BD, z + 0.05], [x0 + BW + 0.012, BD, z + 0.2], [x0 + BW + 0.012, 0, z + 0.2]], k.renk);
}
function katIci(i, k, x0) {
  const z = katZ(i);
  poli([[x0, 0, z], [x0 + BW, 0, z], [x0 + BW, BD, z], [x0, BD, z]], '#202838', 'rgba(255,255,255,.06)');
  for (let g = 1; g < BW; g++) poli([[x0 + g, 0, z + 0.001], [x0 + g + 0.02, 0, z + 0.001], [x0 + g + 0.02, BD, z + 0.001], [x0 + g, BD, z + 0.001]], 'rgba(255,255,255,.04)');
  poli([[x0, 0, z], [x0 + BW, 0, z], [x0 + BW, 0, z + 0.7], [x0, 0, z + 0.7]], 'rgba(58,70,94,.7)');
  poli([[x0, 0, z], [x0, BD, z], [x0, BD, z + 0.7], [x0, 0, z + 0.7]], 'rgba(46,56,78,.7)');
  // kahve köşesi
  kutu(x0 + 0.2, 0.2, z, 0.8, 0.6, 0.8, { ust: '#5a4636', sol: '#3d2f24', sag: '#4a392c' });
  const masalar = [[1.6, 0.6], [3.4, 0.6], [1.6, 2.6], [3.4, 2.6], [5.0, 1.6]];
  k.ekip.slice(0, masalar.length).forEach((ad, m) => {
    const [mx, my] = masalar[m];
    kutu(x0 + mx, my, z, 1.2, 0.7, 0.42, { ust: '#4a5468', sol: '#2c3444', sag: '#36405a' });
    const [sx, sy] = P(x0 + mx + 0.6, my + 0.15, z + 0.75); ctx.fillStyle = k.durum === 'bosta' ? '#2a3140' : 'rgba(150,225,255,.9)'; ctx.fillRect(sx - 7, sy - 5, 14, 8);
    // kişi: çalışırken başı sallanır, onayda el kalkar
    const [px, py] = P(x0 + mx + 0.6, my + 1.05, z + 0.55);
    const salla = k.durum === 'calisiyor' || k.durum === 'deploy' ? Math.sin(zaman * 6 + m) * 1.2 : 0;
    ctx.fillStyle = k.renk; ctx.beginPath(); ctx.roundRect(px - 5, py - 3, 10, 11, 3); ctx.fill();
    ctx.fillStyle = TEN[m % 5]; ctx.beginPath(); ctx.arc(px, py - 8 + salla, 4.5, 0, 7); ctx.fill();
    if (k.durum === 'onay' && m === 0) { ctx.strokeStyle = TEN[0]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px + 4, py - 1); ctx.lineTo(px + 7, py - 15 + Math.sin(zaman * 6) * 2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(233,236,242,.85)'; ctx.font = '600 9.5px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(ad, px, py + 19);
  });
}
function baloncuk(x, y, ikon, renk, s = 1) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = 'rgba(16,20,28,.92)'; ctx.strokeStyle = renk; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(-15, -30, 30, 26, 9); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(0, 3); ctx.lineTo(4, -4); ctx.fill(); ctx.font = '15px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(ikon, 0, -11); ctx.restore(); }
function agac(x, y, gece) { const [a, b] = P(x, y, 0); ctx.fillStyle = '#4a3a2c'; ctx.fillRect(a - 2, b - 12, 4, 12); ctx.fillStyle = gece ? '#1d3a33' : '#2f7d5c'; ctx.beginPath(); ctx.arc(a, b - 20, 11, 0, 7); ctx.fill(); ctx.fillStyle = gece ? '#244a40' : '#3f9a70'; ctx.beginPath(); ctx.arc(a - 3, b - 24, 6, 0, 7); ctx.fill(); }
function lamba(x, y, gece) { const [a, b] = P(x, y, 0); ctx.strokeStyle = '#5b6578'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, b - 30); ctx.stroke(); if (gece) { const g = ctx.createRadialGradient(a, b - 30, 0, a, b - 30, 40); g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a, b - 30, 40, 0, 7); ctx.fill(); } ctx.fillStyle = gece ? '#ffe2a8' : '#cfd6e0'; ctx.beginPath(); ctx.arc(a, b - 31, 3, 0, 7); ctx.fill(); }

// ---------- çizim ----------
const sehirSil = Array.from({ length: 40 }, (_, i) => ({ x: i / 40, w: 0.018 + ((i * 37) % 11) / 400, h: 0.06 + ((i * 53) % 17) / 90 }));
// ---------- ada (diorama) ----------
const ADA = { x0: -9, y0: -9, x1: 14, y1: 13, derin: 2.4 };
// süs binaları: farklı boy ve renklerde, pencere ızgaralı (projeler kulenin katlarıdır, bunlar şehri doldurur)
const SUSLER = [
  { x: -4.6, y: -4.8, w: 2.2, d: 2.2, h: 5.4, r: '#6f8fb5', cati: 'tank' }, { x: -1.6, y: -4.8, w: 1.8, d: 1.8, h: 3.2, r: '#c9a37a', cati: 'bahce' },
  { x: 1.2, y: -4.9, w: 2.4, d: 1.8, h: 6.2, r: '#4f9fb0', cati: 'anten' }, { x: 4.3, y: -4.6, w: 1.8, d: 1.6, h: 3.8, r: '#b37a6a', cati: 'klima' },
  { x: -4.8, y: -1.6, w: 2.0, d: 2.0, h: 4.6, r: '#8a9bb8', cati: 'heli' }, { x: -4.6, y: 1.8, w: 1.6, d: 1.6, h: 2.6, r: '#d8c08a', cati: 'klima' },
];
function yuz(pts, ust, alt, zAlt, zUst) { const [, ya] = P(pts[0][0], pts[0][1], zAlt), [, yu] = P(pts[0][0], pts[0][1], zUst); const g = ctx.createLinearGradient(0, yu, 0, ya); g.addColorStop(0, ust); g.addColorStop(1, alt); poli(pts, g); }
function koyu(r, t) { return karis(r, '#000000', t); }
function acik_(r, t) { return karis(r, '#ffffff', t); }
function bina(b, gece) {
  const { x, y, w, d, h, r } = b;
  // gövde: ışığa bakan yüz açık, öbürü koyu; yukarı doğru açılan degrade
  yuz([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]], acik_(r, gece ? 0 : 0.12), koyu(r, gece ? 0.55 : 0.12), 0, h);
  yuz([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]], koyu(r, gece ? 0.45 : 0.05), koyu(r, gece ? 0.7 : 0.3), 0, h);
  poli([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]], koyu(r, gece ? 0.35 : -0.1 < 0 ? 0 : 0));
  // pencere ızgarası
  const kat = Math.floor(h / 0.55), sutun = Math.max(2, Math.floor(w / 0.42)), sutun2 = Math.max(2, Math.floor(d / 0.42));
  for (let k = 0; k < kat; k++) {
    const z = 0.35 + k * 0.55; if (z + 0.3 > h) break;
    for (let c2 = 0; c2 < sutun; c2++) { const a = x + 0.1 + c2 * (w - 0.2) / sutun, e = a + (w - 0.2) / sutun - 0.1; const yan = gece && Math.sin(b.x * 7 + k * 3.1 + c2 * 1.7) > 0.35; poli([[a, y + d + 0.01, z], [e, y + d + 0.01, z], [e, y + d + 0.01, z + 0.3], [a, y + d + 0.01, z + 0.3]], yan ? 'rgba(255,214,140,.9)' : gece ? 'rgba(20,30,50,.85)' : 'rgba(205,232,255,.75)'); }
    for (let c2 = 0; c2 < sutun2; c2++) { const a = y + 0.1 + c2 * (d - 0.2) / sutun2, e = a + (d - 0.2) / sutun2 - 0.1; const yan = gece && Math.sin(b.y * 5 + k * 2.3 + c2 * 1.1) > 0.45; poli([[x + w + 0.01, a, z], [x + w + 0.01, e, z], [x + w + 0.01, e, z + 0.3], [x + w + 0.01, a, z + 0.3]], yan ? 'rgba(245,190,120,.8)' : gece ? 'rgba(14,22,40,.9)' : 'rgba(150,190,225,.65)'); }
  }
  // çatı süsleri
  if (b.cati === 'tank') { const [a, c3] = P(x + w * 0.6, y + d * 0.5, h); ctx.fillStyle = '#7a5a40'; ctx.fillRect(a - 7, c3 - 14, 14, 14); ctx.beginPath(); ctx.ellipse(a, c3 - 14, 7, 3.5, 0, 0, 7); ctx.fillStyle = '#9b7552'; ctx.fill(); }
  if (b.cati === 'klima') kutu(x + w * 0.25, y + d * 0.3, h, w * 0.4, d * 0.35, 0.3, { ust: '#d4d9e0', sol: '#9aa3ae', sag: '#b3bbc5' });
  if (b.cati === 'anten') { const [a, c3] = P(x + w / 2, y + d / 2, h), [, c4] = P(x + w / 2, y + d / 2, h + 2.2); ctx.strokeStyle = '#c7ccd4'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a, c3); ctx.lineTo(a, c4); ctx.stroke(); ctx.fillStyle = Math.sin(zaman * 4) > 0 ? '#ff4d4d' : '#6a1d1d'; ctx.beginPath(); ctx.arc(a, c4, 3, 0, 7); ctx.fill(); }
  if (b.cati === 'heli') { poli([[x + 0.3, y + 0.3, h + 0.01], [x + w - 0.3, y + 0.3, h + 0.01], [x + w - 0.3, y + d - 0.3, h + 0.01], [x + 0.3, y + d - 0.3, h + 0.01]], '#3a4252'); const [a, c3] = P(x + w / 2, y + d / 2, h); ctx.fillStyle = '#f2f2f2'; ctx.font = '800 11px -apple-system'; ctx.textAlign = 'center'; ctx.fillText('H', a, c3 + 4); }
  if (b.cati === 'bahce') { poli([[x + 0.15, y + 0.15, h + 0.01], [x + w - 0.15, y + 0.15, h + 0.01], [x + w - 0.15, y + d - 0.15, h + 0.01], [x + 0.15, y + d - 0.15, h + 0.01]], '#5fae6e'); for (const [ax, ay] of [[0.5, 0.5], [1.2, 1.1]]) { const [a, c3] = P(x + ax, y + ay, h); ctx.fillStyle = '#3f8f55'; ctx.beginPath(); ctx.arc(a, c3 - 6, 6, 0, 7); ctx.fill(); } }
}
function ada(gece) {
  const { x0, y0, x1, y1, derin } = ADA;
  // ön yüzlerde toprak katmanları: çimen dudağı, toprak, kaya
  const katmanlar = [[0, 0.25, gece ? '#2e5a3e' : '#5fa363'], [0.25, 1.2, gece ? '#3d2c22' : '#8b5e3c'], [1.2, derin, gece ? '#2b2420' : '#6e4a32']];
  for (const [ust, alt, renk] of katmanlar) {
    yuz([[x0, y1, -ust], [x1, y1, -ust], [x1, y1, -alt], [x0, y1, -alt]], renk, koyu(renk, 0.25), -alt, -ust);
    yuz([[x1, y0, -ust], [x1, y1, -ust], [x1, y1, -alt], [x1, y0, -alt]], koyu(renk, 0.18), koyu(renk, 0.4), -alt, -ust);
  }
  // kaya çizgileri
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
  for (let k = 0; k < 6; k++) { ctx.beginPath(); for (let t = 0; t <= 1; t += 0.05) { const [a, b] = P(x0 + (x1 - x0) * t, y1, -1.4 - k * 0.17 - Math.sin(t * 20 + k) * 0.06); t ? ctx.lineTo(a, b) : ctx.moveTo(a, b); } ctx.stroke(); }
  // üst yüz (çimen) ve ince dokular
  poli([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], gece ? '#1d3a2b' : '#79b86f');
  for (let k = 0; k < 120; k++) { const px = x0 + ((k * 7.31) % (x1 - x0)), py = y0 + ((k * 3.77) % (y1 - y0)); const [a, b] = P(px, py, 0); ctx.fillStyle = gece ? 'rgba(80,140,100,.25)' : 'rgba(255,255,255,.18)'; ctx.fillRect(a, b, 2, 1); }
}

function ciz() {
  if (!W || !H) {
    boyutla();
    if (!W || !H) return;
  }
  zaman += 0.016; gunIsigi += (gunHedef - gunIsigi) * 0.03; const gece = gunIsigi < 0.5;
  acik += (1 - acik) * 0.08; asansor += (asansorHedef - asansor) * 0.04; vinc += 0.016;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // gökyüzü: yumuşak degrade (gündüz pastel, gece lacivert)
  const gok = ctx.createLinearGradient(0, 0, 0, H); gok.addColorStop(0, karis('#070b16', '#9ccbee', gunIsigi)); gok.addColorStop(1, karis('#141c30', '#eaf3f8', gunIsigi));
  ctx.fillStyle = gok; ctx.fillRect(0, 0, W, H);
  if (gece) for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + ((i * 17) % 10) / 22})`; ctx.fillRect((i * 97) % W, (i * 53) % H, 1.3, 1.3); }
  const [gx, gy] = [W * 0.86, H * 0.14]; ctx.fillStyle = gece ? '#eef2f8' : '#ffe9a8'; ctx.shadowColor = gece ? '#cfd8ff' : '#ffd36b'; ctx.shadowBlur = 34; ctx.beginPath(); ctx.arc(gx, gy, gece ? 16 : 24, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  // adanın altındaki bulutlar (arkada)
  const bulut = (x, y, s, a) => { ctx.fillStyle = gece ? `rgba(150,165,195,${a * 0.25})` : `rgba(255,255,255,${a})`; for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 30], [58, 0, 24], [30, 8, 26]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); } };
  for (let i = 0; i < 5; i++) bulut(((zaman * 8 + i * 300) % (W + 400)) - 200, H * (0.82 + (i % 2) * 0.08), 1 + (i % 3) * 0.3, 0.85);
  ada(gece);
  // yollar ve kaldırımlar
  const yolRenk = gece ? '#232a36' : '#5b6170', serit = gece ? 'rgba(255,214,120,.5)' : 'rgba(255,255,255,.85)', kaldirim = gece ? '#2c3646' : '#d6dade';
  for (const [a, b, c2, e] of [[-8, -8, 13, -6], [11, -8, 13, 12], [-8, 10, 13, 12], [-8, -8, -6, 12]]) { poli([[a - 0.3, b - 0.3, 0.01], [c2 + 0.3, b - 0.3, 0.01], [c2 + 0.3, e + 0.3, 0.01], [a - 0.3, e + 0.3, 0.01]], kaldirim); }
  for (const [a, b, c2, e] of [[-8, -8, 13, -6], [11, -8, 13, 12], [-8, 10, 13, 12], [-8, -8, -6, 12]]) poli([[a, b, 0.02], [c2, b, 0.02], [c2, e, 0.02], [a, e, 0.02]], yolRenk);
  for (let s2 = -7; s2 < 12; s2 += 1.6) { poli([[s2, -7.05, 0.03], [s2 + 0.7, -7.05, 0.03], [s2 + 0.7, -6.95, 0.03], [s2, -6.95, 0.03]], serit); poli([[s2, 10.95, 0.03], [s2 + 0.7, 10.95, 0.03], [s2 + 0.7, 11.05, 0.03], [s2, 11.05, 0.03]], serit); }
  for (let s2 = -7; s2 < 11; s2 += 1.6) { poli([[-7.05, s2, 0.03], [-6.95, s2, 0.03], [-6.95, s2 + 0.7, 0.03], [-7.05, s2 + 0.7, 0.03]], serit); poli([[11.95, s2, 0.03], [12.05, s2, 0.03], [12.05, s2 + 0.7, 0.03], [11.95, s2 + 0.7, 0.03]], serit); }
  // meydan (kulenin önü) ve havuz
  poli([[-0.6, -0.6, 0.03], [BW + 0.6, -0.6, 0.03], [BW + 0.6, BD + 3.4, 0.03], [-0.6, BD + 3.4, 0.03]], kaldirim);
  poli([[1, BD + 1.2, 0.04], [3.4, BD + 1.2, 0.04], [3.4, BD + 2.6, 0.04], [1, BD + 2.6, 0.04]], gece ? '#1f4b6b' : '#6cc3e8');
  { const [a, b] = P(2.2, BD + 1.9, 0.05); ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(a + Math.sin(zaman * 3 + k) * 3, b - 6 - ((zaman * 20 + k * 6) % 18), 1.6, 0, 7); ctx.fill(); } }
  const nesneler = [];
  for (const b of SUSLER) nesneler.push({ d: b.x + b.w / 2 + b.y + b.d / 2, f: () => bina(b, gece) });
  // kişisel ev
  nesneler.push({ d: -3.4 + 7.8, f: () => { kutu(-4.6, 6.6, 0, 2.4, 2.4, 1.6, { ust: '#3a2f45', sol: gece ? '#3a2a46' : '#c9a2e4', sag: gece ? '#46335a' : '#b98fd6' }); poli([[-4.6, 6.6, 1.6], [-2.2, 6.6, 1.6], [-3.4, 7.8, 2.7]], gece ? '#5a3d70' : '#e86a92'); poli([[-2.2, 6.6, 1.6], [-2.2, 9, 1.6], [-3.4, 7.8, 2.7]], gece ? '#6b4a84' : '#f08aa8'); poli([[-4.6, 9, 1.6], [-2.2, 9, 1.6], [-3.4, 7.8, 2.7]], gece ? '#4d3462' : '#d65e85');
    const [a, b] = P(-3.4, 9, 0.8); ctx.fillStyle = gece ? 'rgba(255,190,220,.9)' : 'rgba(255,255,255,.75)'; ctx.fillRect(a - 6, b - 8, 12, 10); etiket(-3.4, 9.6, 0, t('sehir.kisisel'), '#e86a92'); kisiselKutu = sonEtiket; } });
  // servis santrali
  nesneler.push({ d: 4, f: () => { kutu(7.4, -5.6, 0, 2.4, 2.2, 1.3, { ust: '#33404f', sol: gece ? '#26303d' : '#a2b3c6', sag: gece ? '#2d3848' : '#8ea0b4' });
    for (const [tx, ty] of [[10.3, -5.2], [10.3, -3.8]]) { const [a, b] = P(tx, ty, 0); const [, b2] = P(tx, ty, 1.9); ctx.fillStyle = gece ? '#2f4f74' : '#5aa2e6'; ctx.fillRect(a - 12, b2, 24, b - b2); ctx.beginPath(); ctx.ellipse(a, b2, 12, 6, 0, 0, 7); ctx.fillStyle = gece ? '#3d6290' : '#8fc4f2'; ctx.fill(); }
    const [a, b] = P(8.6, -4.5, 1.3); ctx.fillStyle = `rgba(220,230,240,${0.3 + Math.sin(zaman * 2) * 0.1})`; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(a + Math.sin(zaman + k) * 4, b - 12 - k * 10 - (zaman * 10 % 10), 5 + k * 2, 0, 7); ctx.fill(); }
    etiket(9.2, -4.4, 3.2, t('sehir.servisler'), '#5aa2e6'); servisKutu = sonEtiket; } });
  for (const [x, y] of [...agaclar.filter(([x]) => x < 8), [-7.2, 12.6], [12.6, -7.5], [4.6, 9.3], [10.2, 8.8], [9.6, -1.8]]) nesneler.push({ d: x + y, f: () => agac(x, y, gece) });
  for (const [x, y] of [[-0.8, 9], [6.8, 9], [-5.6, 2], [10.6, 4]]) nesneler.push({ d: x + y, f: () => lamba(x, y, gece) });
  for (const a of arabalar) { a.s += (a.ters ? -1 : 1) * a.h * 0.016; const n = yolNokta(a.s); const sag = a.ters ? 0.45 : -0.45; const x = n.x + (n.yon % 2 === 0 ? 0 : sag), y = n.y + (n.yon % 2 === 0 ? sag : 0); nesneler.push({ d: x + y, f: () => araba(x, y, n.yon, a, gece) }); }
  for (const p of yayalar) { p.t += p.h * 0.016 * p.yon; if (p.t > 1 || p.t < 0) { p.yon *= -1; p.t = Math.max(0, Math.min(1, p.t)); } const q = yolUzerinde(p.yol, p.t); nesneler.push({ d: q.x + q.y, f: () => yaya(q.x, q.y, p) }); }
  nesneler.push({ d: BW / 2 + BD / 2, f: () => kule(gece) });
  nesneler.sort((a, b) => a.d - b.d).forEach((n) => n.f());
  // önde süzülen bulutlar
  bulut(((zaman * 14) % (W + 400)) - 200, H * 0.24, 0.8, 0.45);
}
function etiket(x, y, z, ad, renk) { const [a, b] = P(x, y, z); ctx.font = '700 11px -apple-system, sans-serif'; const w = ctx.measureText(ad).width + 16; sonEtiket = [a - w / 2, b - 11, w, 22]; ctx.fillStyle = 'rgba(14,18,26,.85)'; ctx.strokeStyle = renk; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(a - w / 2, b - 11, w, 22, 11); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(ad, a, b + 4); }
function araba(x, y, yon, a, gece) { const yatay = yon % 2 === 0; const w = yatay ? 1.1 : 0.55, d = yatay ? 0.55 : 1.1; kutu(x - w / 2, y - d / 2, 0.05, w, d, 0.32, { ust: a.renk, sol: karis(a.renk.length === 7 ? a.renk : '#888888', '#000000', 0.35), sag: karis(a.renk.length === 7 ? a.renk : '#888888', '#000000', 0.2) }); kutu(x - w / 4, y - d / 4, 0.37, w / 2, d / 2, 0.2, { ust: '#cfe6ff', sol: '#7d93ad', sag: '#93abc6' });
  if (gece) { const ileri = (a.ters ? -1 : 1) * (yon === 0 || yon === 1 ? 1 : -1); const [hx, hy] = P(x + (yatay ? ileri * 0.7 : 0), y + (yatay ? 0 : ileri * 0.7), 0.2); const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26); g.addColorStop(0, 'rgba(255,240,190,.7)'); g.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, 26, 0, 7); ctx.fill(); } }
function yaya(x, y, p) { const [a, b] = P(x, y, 0); const adim = Math.sin(zaman * 10 + x) * 2; ctx.strokeStyle = '#2b3140'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a - 2, b); ctx.lineTo(a - 2 + adim, b - 6); ctx.moveTo(a + 2, b); ctx.lineTo(a + 2 - adim, b - 6); ctx.stroke(); ctx.fillStyle = p.gomlek; ctx.beginPath(); ctx.roundRect(a - 4, b - 15, 8, 10, 3); ctx.fill(); ctx.fillStyle = p.ten; ctx.beginPath(); ctx.arc(a, b - 19, 3.6, 0, 7); ctx.fill(); }
function kule(gece) {
  // lobi
  kutu(0, 0, 0, BW, BD, LOBI, { ust: '#2a3346', sol: gece ? '#1a2232' : '#5f7590', sag: gece ? '#212a3c' : '#7189a6' });
  poli([[2.2, BD + 0.01, 0], [3.8, BD + 0.01, 0], [3.8, BD + 0.01, 1.5], [2.2, BD + 0.01, 1.5]], gece ? 'rgba(255,224,170,.9)' : 'rgba(200,230,255,.8)');
  // asansör kuyusu (sağ arka köşe) ve kabin
  const top = katZ(KATLAR.length);
  kutu(BW, -0.9, 0, 0.9, 0.9, top + 0.3, { ust: '#3a4458', sol: gece ? '#1e2738' : '#6b7f98', sag: gece ? '#263046' : '#7d92ae' });
  const kz = LOBI * 0.2 + asansor * (KH + 0.1) + (asansor > 0 ? LOBI * 0.8 : 0);
  kutu(BW + 0.12, -0.78, kz + 0.3, 0.66, 0.66, 0.9, { ust: '#ffe2a8', sol: '#f2b45a', sag: '#f7c77a' });
  KATLAR.forEach((k, i) => {
    const z = katZ(i);
    const disari = i === secili ? acik * 7.5 : 0;
    if (i === secili) {
      kutu(0, 0, z, BW, BD, KH, { ust: '#0b0f17', sol: '#0a0d14', sag: '#0d121b' });
      katIci(i, k, disari);
      poli([[disari, BD, z - 0.25], [disari + BW, BD, z - 0.25], [disari + BW, BD, z], [disari, BD, z]], k.renk + '88');
      poli([[disari + BW, 0, z - 0.25], [disari + BW, BD, z - 0.25], [disari + BW, BD, z], [disari + BW, 0, z]], k.renk);
    } else {
      yuz([[0, BD, z], [BW, BD, z], [BW, BD, z + KH], [0, BD, z + KH]], gece ? '#1d2a42' : '#8fb4dc', gece ? '#121b2c' : '#5f86b4', z, z + KH);
      yuz([[BW, 0, z], [BW, BD, z], [BW, BD, z + KH], [BW, 0, z + KH]], gece ? '#16223a' : '#6d93c2', gece ? '#0e1626' : '#476c9a', z, z + KH);
      pencereSirasi(i, k, 0, gece);
    }
    // durum baloncukları katın yanında
    const [bx, by] = P(-0.2, BD, z + KH * 0.7);
    const ikon = k.baloncuk || { onay: '✋', hata: '❌', calisiyor: '⌨️' }[k.durum];
    if (ikon) { const [lx2, ly2] = P(0, BD, z + KH / 2); baloncuk(lx2 - 62, ly2 + 14 + Math.sin(zaman * 3 + i) * 2, ikon, DURUM_RENK[k.durum], 0.9); }
    // kat etiketi
    const [lx, ly] = P(0, BD, z + KH / 2); const sol = lx - 205;
    ctx.strokeStyle = i === secili ? k.renk : 'rgba(255,255,255,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sol + 122, ly); ctx.lineTo(lx - 4, ly); ctx.stroke();
    ctx.fillStyle = 'rgba(14,18,26,.9)'; ctx.strokeStyle = i === secili ? k.renk : 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.roundRect(sol - 4, ly - 16, 126, 32, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = k.renk; ctx.beginPath(); ctx.roundRect(sol + 2, ly - 9, 18, 18, 5); ctx.fill(); ctx.fillStyle = '#04221f'; ctx.font = '800 10px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(k.sv, sol + 11, ly + 4);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 12px -apple-system, sans-serif'; ctx.fillText(k.ad.length > 14 ? k.ad.slice(0, 13) + '…' : k.ad, sol + 27, ly - 1);
    ctx.fillStyle = DURUM_RENK[k.durum]; ctx.font = '10.5px -apple-system, sans-serif'; ctx.fillText(t('sehir.durum.' + k.durum), sol + 27, ly + 11);
    k.kutu = [sol - 4, ly - 16, 126, 32];
  });
  // seçili katın üstünde harita iğnesi (sallanarak iner)
  if (KATLAR[secili]) { const k = KATLAR[secili]; const z = katZ(secili); const [a, b] = P(acik * 7.5 + BW / 2, BD / 2, z + 2.6 + Math.sin(zaman * 3) * 0.15); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(a, b + 34, 8, 3, 0, 0, 7); ctx.fill(); ctx.fillStyle = k.renk; ctx.beginPath(); ctx.arc(a, b - 8, 12, Math.PI, 0); ctx.lineTo(a, b + 12); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(a, b - 8, 12, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(a, b - 8, 4.5, 0, 7); ctx.fill(); }
  // çatı, vinç ve yükselen yeni kat
  const tz = katZ(KATLAR.length);
  kutu(-0.1, -0.1, tz - 0.1, BW + 0.2, BD + 0.2, 0.3, { ust: '#33405a', sol: '#222c3e', sag: '#2a364c' });
  const yuk = Math.min(1, yeniKat) * KH;
  if (yeniKat > 0) { ctx.setLineDash([4, 4]); kutu(0, 0, tz + 0.2, BW, BD, yuk, { ust: 'rgba(23,184,166,.12)', sol: 'rgba(23,184,166,.18)', sag: 'rgba(23,184,166,.22)' }); ctx.setLineDash([]); }
  // vinç: kule, kol ve sallanan yük
  const [v0x, v0y] = P(1, 1, tz + 0.2), [v1x, v1y] = P(1, 1, tz + 4.2); ctx.strokeStyle = '#f2a93b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(v0x, v0y); ctx.lineTo(v1x, v1y); ctx.stroke();
  const aci = Math.sin(vinc * 0.4) * 0.9; const [kx2, ky2] = P(1 + Math.cos(aci) * 4.5, 1 + Math.sin(aci) * 4.5, tz + 4.2); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(v1x, v1y); ctx.lineTo(kx2, ky2); ctx.stroke();
  const ip = 30 + Math.sin(vinc * 1.3) * 6; ctx.strokeStyle = 'rgba(220,220,220,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(kx2, ky2); ctx.lineTo(kx2, ky2 + ip); ctx.stroke(); ctx.fillStyle = '#17b8a6'; ctx.fillRect(kx2 - 7, ky2 + ip, 14, 9);
  if (gece) { ctx.fillStyle = Math.sin(zaman * 4) > 0 ? '#ff4d4d' : '#5a1a1a'; ctx.beginPath(); ctx.arc(v1x, v1y - 4, 3, 0, 7); ctx.fill(); }
  const [ex, ey] = P(BW / 2, BD, tz + 0.9); ctx.font = '700 11.5px -apple-system, sans-serif'; ctx.fillStyle = '#7fd8cc'; ctx.textAlign = 'center'; const [ex2, ey2] = P(BW, BD / 2, tz + 0.9); ctx.textAlign = 'left'; const yazi = t(yeniKat > 0 && yeniKat < 1 ? 'sehir.kuruluyor' : 'sehir.yeniKat'); ctx.fillText(yazi, ex2 + 14, ey2); yeniKatKutu = [ex2 + 8, ey2 - 14, ctx.measureText(yazi).width + 12, 20];
  // roketler (yayın)
  for (let i = roketler.length - 1; i >= 0; i--) { const r = roketler[i]; r.z += 0.06; const [a, b] = P(BW / 2, BD / 2, r.z); ctx.font = '20px -apple-system, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🚀', a, b); ctx.fillStyle = 'rgba(255,190,90,.5)'; ctx.beginPath(); ctx.arc(a - 4, b + 10, 5 + Math.random() * 3, 0, 7); ctx.fill(); if (r.z > tz + 14) roketler.splice(i, 1); }
}

  // ---------- etkileşim ----------
  let surukle = null;
  let uzerinde = -1;
  const icinde = (k, x, y) => k && x > k[0] && x < k[0] + k[2] && y > k[1] && y < k[1] + k[3];
  c.addEventListener('mousedown', (e) => (surukle = { x: e.clientX, y: e.clientY, kx, ky, oynadi: false }));
  addEventListener('mouseup', () => setTimeout(() => (surukle = null), 0));
  c.addEventListener('mousemove', (e) => {
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (surukle) {
      const dx = e.clientX - surukle.x;
      const dy = e.clientY - surukle.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) surukle.oynadi = true;
      kx = surukle.kx + dx;
      ky = surukle.ky + dy;
    }
    uzerinde = KATLAR.findIndex((k) => icinde(k.kutu, x, y));
    const baska = icinde(kisiselKutu, x, y) || icinde(servisKutu, x, y) || icinde(yeniKatKutu, x, y);
    c.style.cursor = uzerinde >= 0 || baska ? 'pointer' : surukle ? 'grabbing' : 'grab';
  });
  c.addEventListener('click', (e) => {
    if (surukle && surukle.oynadi) return;
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (uzerinde >= 0) return uzerinde !== secili ? katSec(uzerinde, true) : opts.katSec(KATLAR[secili].id);
    if (icinde(kisiselKutu, x, y)) return opts.kisisel();
    if (icinde(servisKutu, x, y)) return opts.servisler();
    if (icinde(yeniKatKutu, x, y)) return opts.katKur();
  });
  c.addEventListener('dblclick', () => uzerinde >= 0 && opts.kataGir(KATLAR[uzerinde].id));
  c.addEventListener('wheel', (e) => {
    e.preventDefault();
    olcek = Math.max(12, Math.min(40, olcek * (e.deltaY < 0 ? 1.08 : 0.93)));
  }, { passive: false });
  function katSec(i, bildir) {
    if (!KATLAR[i]) return;
    secili = i;
    acik = 0;
    asansorHedef = i;
    if (bildir) opts.katSec(KATLAR[i].id);
  }
  const dongu = () => {
    if (!calisiyor) return;
    ciz();
    istek = requestAnimationFrame(dongu);
  };
  const gozlem = new ResizeObserver(boyutla);
  gozlem.observe(kap);
  let gunZaman = null;

  return {
    // katlar: [{ id, ad, durum, ekip: [ad], sv }] alttan üste
    veriKoy(katlar, seciliId) {
      const eskiSay = KATLAR.length;
      KATLAR = katlar.map((k, i) => ({ ...k, renk: KAT_RENK[i % KAT_RENK.length] }));
      if (eskiSay && KATLAR.length > eskiSay) {
        // yeni kat: vinç kaldırır
        yeniKat = 0.01;
        const z = setInterval(() => {
          yeniKat += 0.025;
          if (yeniKat >= 1) {
            yeniKat = 0;
            clearInterval(z);
          }
        }, 30);
      }
      const i = KATLAR.findIndex((k) => k.id === seciliId);
      if (i >= 0 && i !== secili) katSec(i);
      if (secili >= KATLAR.length) secili = Math.max(0, KATLAR.length - 1);
    },
    sec(id) {
      const i = KATLAR.findIndex((k) => k.id === id);
      if (i >= 0) katSec(i);
    },
    adim(yon) {
      const i = secili + yon;
      if (KATLAR[i]) katSec(i, true);
    },
    asansor(id) {
      const i = KATLAR.findIndex((k) => k.id === id);
      if (i >= 0) asansorHedef = i;
    },
    roket() {
      roketler.push({ z: katZ(KATLAR.length) });
    },
    geceGunduz() {
      elleGece = gunHedef > 0.5 ? 0 : 1;
      gunHesapla();
    },
    goster() {
      if (calisiyor) return;
      calisiyor = true;
      boyutla();
      gunHesapla();
      gunIsigi = gunHedef;
      gunZaman = setInterval(gunHesapla, 30000);
      dongu();
    },
    gizle() {
      calisiyor = false;
      cancelAnimationFrame(istek);
      clearInterval(gunZaman);
    },
  };
}
