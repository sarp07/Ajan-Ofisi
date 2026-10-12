// Küçük karakter portresi: ofisteki çizimin aynısı, kartlarda ve düzenleyicide kullanılır.
import { Kisi, kisiCiz } from './insanlar.js';

export function portreCiz(tuval, { renk, gorunus }) {
  const dpr = window.devicePixelRatio || 1;
  const w = Number(tuval.getAttribute('data-w')) || 64;
  const hh = Number(tuval.getAttribute('data-h')) || 72;
  tuval.width = Math.round(w * dpr);
  tuval.height = Math.round(hh * dpr);
  const ctx = tuval.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hh);
  const k = new Kisi('portre', 'x', { x: 0, y: 0 });
  k.yon = '+y';
  k.alfa = 1;
  k.faz = 0.4;
  k.bilgi = { renk, gorunus };
  // karakter ayaktan saç ucuna yaklaşık 54 birim: tuvale sığacak ölçek
  const olcek = Math.min((hh - 6) / 56, (w - 4) / 34);
  ctx.save();
  ctx.translate(w / 2 + olcek, hh - 3 - 7 * olcek);
  ctx.scale(olcek, olcek);
  kisiCiz(ctx, k, 0);
  ctx.restore();
}

export function portre(kisi, genislik = 56, yukseklik = 64) {
  const c = document.createElement('canvas');
  c.className = 'portre';
  c.setAttribute('data-w', genislik);
  c.setAttribute('data-h', yukseklik);
  c.style.width = genislik + 'px';
  c.style.height = yukseklik + 'px';
  portreCiz(c, kisi);
  c.yenile = (yeni) => portreCiz(c, yeni);
  return c;
}
