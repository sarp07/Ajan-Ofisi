// İzometrik çizim motoru: dünya koordinatı (x, y, z) -> ekran, kutu ve düzlem yardımcıları.
export const HW = 32; // yarım karo genişliği
export const HH = 16; // yarım karo yüksekliği
export const HZ = 38; // bir birim yükseklik

export function iso(x, y, z = 0) {
  return [(x - y) * HW, (x + y) * HH - z * HZ];
}

function isoVec(dx, dy, dz) {
  return [(dx - dy) * HW, (dx + dy) * HH - dz * HZ];
}

// ---- renk yardımcıları ----
const rgbCache = new Map();
function rgb(hex) {
  let c = rgbCache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  rgbCache.set(hex, c);
  return c;
}

const shadeCache = new Map();
// amt > 0 beyaza, amt < 0 siyaha doğru karıştırır
export function shade(hex, amt) {
  const key = hex + '|' + amt;
  let out = shadeCache.get(key);
  if (out) return out;
  const [r, g, b] = rgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const m = (v) => Math.round(v + (t - v) * p);
  out = `rgb(${m(r)},${m(g)},${m(b)})`;
  shadeCache.set(key, out);
  return out;
}

export function alpha(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mix(hexA, hexB, t) {
  const a = rgb(hexA);
  const b = rgb(hexB);
  const m = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

// ---- temel şekiller ----
function quad(ctx, p1, p2, p3, p4, fill) {
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.lineTo(p4[0], p4[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = fill;
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

// Kutu: görünen üç yüz (üst, sol = y+d yüzü, sağ = x+w yüzü)
export function box(ctx, x, y, z, w, d, h, col, o = {}) {
  const top = o.top || shade(col, 0.1);
  const left = o.left || col;
  const right = o.right || shade(col, -0.17);
  const A = iso(x, y, z + h);
  const B = iso(x + w, y, z + h);
  const C = iso(x + w, y + d, z + h);
  const D = iso(x, y + d, z + h);
  const C0 = iso(x + w, y + d, z);
  const D0 = iso(x, y + d, z);
  const B0 = iso(x + w, y, z);
  quad(ctx, D, C, C0, D0, left);
  quad(ctx, B, C, C0, B0, right);
  quad(ctx, A, B, C, D, top);
  if (o.edge) {
    ctx.strokeStyle = o.edge;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(D[0], D[1]);
    ctx.lineTo(C[0], C[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.moveTo(C[0], C[1]);
    ctx.lineTo(C0[0], C0[1]);
    ctx.stroke();
  }
}

// Zemin dörtgeni (z sabit)
export function floorQuad(ctx, x, y, w, d, fill, z = 0) {
  quad(ctx, iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z), fill);
}

// Bir dünya düzlemine 2B çizim: o başlangıç, u ve v birim vektörler.
// Çizim koordinatı 1/100 dünya birimidir (100 = 1 karo).
export function plane(ctx, o, u, v, fn) {
  const [ox, oy] = iso(o[0], o[1], o[2]);
  const [ux, uy] = isoVec(u[0], u[1], u[2]);
  const [vx, vy] = isoVec(v[0], v[1], v[2]);
  ctx.save();
  ctx.transform(ux / 100, uy / 100, vx / 100, vy / 100, ox, oy);
  fn(ctx);
  ctx.restore();
}

// Hazır düzlemler:
// y sabit duvar/yüz (bize bakan y+ yüzü): u = +x, v = aşağı
export function faceY(ctx, x, y, zTop, fn) {
  plane(ctx, [x, y, zTop], [1, 0, 0], [0, 0, -1], fn);
}
// x sabit duvar/yüz (bize bakan x+ yüzü): u soldan sağa = y azalan, v = aşağı
export function faceX(ctx, x, yMax, zTop, fn) {
  plane(ctx, [x, yMax, zTop], [0, -1, 0], [0, 0, -1], fn);
}
// zemin/üst yüzey: u = +x, v = +y
export function faceTop(ctx, x, y, z, fn) {
  plane(ctx, [x, y, z], [1, 0, 0], [0, 1, 0], fn);
}

export function ellipseShadow(ctx, x, y, rx, ry, a = 0.22) {
  const [sx, sy] = iso(x, y, 0);
  ctx.save();
  ctx.fillStyle = `rgba(20,24,40,${a})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
