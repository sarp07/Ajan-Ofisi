// Karakterler: görünüş, pozlar, yürüme ve çizim.
import { iso, box, shade, ellipseShadow } from './izo.js';
import { yolBul } from './ofis.js';

const S = 1.22; // karakter ölçeği
const HIZ = 2.5; // birim / saniye

export const MISAFIR_GORUNUS = { ten: '#E0B48C', sac: '#4A3A2A', stil: 'kisa', ek: '', sakal: false, alt: '#3B4252' };

const YON = {
  '+x': { f: [1, 0], a: [0, 1] },
  '-x': { f: [-1, 0], a: [0, -1] },
  '+y': { f: [0, 1], a: [-1, 0] },
  '-y': { f: [0, -1], a: [1, 0] },
};

export class Kisi {
  constructor(id, rolId, bas) {
    this.id = id;
    this.rolId = rolId;
    this.x = bas.x;
    this.y = bas.y;
    this.yon = '+x';
    this.yol = [];
    this.nokta = null; // hedef nokta
    this.vardi = false;
    this.poz = 'ayakta';
    this.oturZ = 0;
    this.faz = Math.random() * 6;
    this.alfa = 0;
    this.gidiyor = false; // ofisten ayrılıyor
    this.bitti = false;
    this.aktif = false; // şu an gerçekten araç çalıştırıyor
    this.onay = false;
    this.hata = false;
    this.bilgi = { renk: '#A9B1BD', gorunus: MISAFIR_GORUNUS };
  }

  hedefle(nokta, izgara) {
    if (this.nokta === nokta) return;
    this.nokta = nokta;
    this.vardi = false;
    this.poz = 'ayakta';
    this.oturZ = 0;
    this.yol = yolBul(izgara, { x: this.x, y: this.y }, nokta);
  }

  guncelle(dt) {
    this.faz += dt;
    this.alfa = Math.min(1, this.alfa + dt * 2.5);
    if (this.yol.length) {
      let kalan = HIZ * dt;
      while (kalan > 0 && this.yol.length) {
        const h = this.yol[0];
        const dx = h.x - this.x;
        const dy = h.y - this.y;
        const u = Math.hypot(dx, dy);
        if (u <= kalan) {
          this.x = h.x;
          this.y = h.y;
          this.yol.shift();
          kalan -= u;
        } else {
          this.x += (dx / u) * kalan;
          this.y += (dy / u) * kalan;
          if (Math.abs(dx) > Math.abs(dy)) this.yon = dx > 0 ? '+x' : '-x';
          else this.yon = dy > 0 ? '+y' : '-y';
          kalan = 0;
        }
      }
      if (!this.yol.length) {
        if (this.gidiyor) {
          this.bitti = true;
        } else if (this.nokta) {
          this.vardi = true;
          this.yon = this.nokta.yon || this.yon;
          this.poz = this.nokta.poz || 'ayakta';
          this.oturZ = this.nokta.otur || 0;
        }
      }
    }
  }

  get yuruyor() {
    return this.yol.length > 0;
  }

  // ekranda baş üstü noktası
  tepe() {
    return iso(this.x, this.y, this.oturZ + S * 0.98);
  }
}

export function kisiCiz(ctx, k, t) {
  const g = k.bilgi.gorunus || MISAFIR_GORUNUS;
  const { f, a } = YON[k.yon];
  const parca = [];
  const z0 = k.oturZ;
  const oturuyor = z0 > 0;
  const yuru = k.yuruyor;
  const fz = k.faz;
  const sal = yuru ? Math.sin(fz * 11) : 0;
  const zipla = yuru ? Math.abs(Math.sin(fz * 11)) * 0.025 : Math.sin(fz * 2) * 0.006;

  const ekle = (la, lb, lz, wa, wb, h, col, son) => {
    const cx = k.x + (a[0] * la + f[0] * lb) * S;
    const cy = k.y + (a[1] * la + f[1] * lb) * S;
    const w = (Math.abs(a[0]) * wa + Math.abs(f[0]) * wb) * S;
    const d = (Math.abs(a[1]) * wa + Math.abs(f[1]) * wb) * S;
    parca.push({ k: (cx + cy) * 1000 + lz, cx, cy, z: z0 + lz * S, w, d, h: h * S, col, son });
  };

  const gomlek = k.bilgi.renk;
  const alt = g.alt || '#3B4252';
  let tz; // gövde alt yüksekliği (yerel)
  if (oturuyor) {
    tz = 0.0 + zipla;
    // uyluklar
    ekle(-0.09, 0.11, 0, 0.12, 0.22, 0.11, alt);
    ekle(0.09, 0.11, 0, 0.12, 0.22, 0.11, alt);
    if (k.poz !== 'yaz') {
      // sarkan bacaklar
      const boy = Math.min(0.28, z0 / S - 0.02);
      if (boy > 0.05) {
        ekle(-0.09, 0.2, -boy, 0.11, 0.11, boy, alt);
        ekle(0.09, 0.2, -boy, 0.11, 0.11, boy, alt);
        ekle(-0.09, 0.23, -boy, 0.11, 0.16, 0.05, '#F4F1EA');
        ekle(0.09, 0.23, -boy, 0.11, 0.16, 0.05, '#F4F1EA');
      }
    }
  } else {
    tz = 0.26 + zipla;
    const l1 = sal * 0.075;
    ekle(-0.09, l1, Math.max(0, sal) * 0.03, 0.12, 0.13, 0.26, alt);
    ekle(0.09, -l1, Math.max(0, -sal) * 0.03, 0.12, 0.13, 0.26, alt);
    ekle(-0.09, l1 + 0.02, Math.max(0, sal) * 0.03, 0.12, 0.17, 0.05, '#F4F1EA');
    ekle(0.09, -l1 + 0.02, Math.max(0, -sal) * 0.03, 0.12, 0.17, 0.05, '#F4F1EA');
  }
  // gövde
  ekle(0, 0, tz, 0.34, 0.2, 0.3, gomlek);
  if (g.ek === 'kapuson') ekle(0, -0.12, tz + 0.2, 0.28, 0.08, 0.13, shade(gomlek, -0.12));

  // kollar
  const omuz = tz + 0.03;
  const kol = (yan, tip) => {
    const la = yan * 0.215;
    if (tip === 'serbest') {
      ekle(la, yuru ? -yan * sal * 0.06 : 0, omuz, 0.09, 0.11, 0.27, gomlek);
      ekle(la, yuru ? -yan * sal * 0.06 : 0, omuz - 0.02, 0.09, 0.1, 0.05, g.ten);
    } else if (tip === 'ileri') {
      const j = k.aktif ? Math.sin(fz * 22 + yan * 1.7) * 0.012 : 0;
      ekle(la, 0.03, omuz + 0.11, 0.09, 0.12, 0.17, gomlek);
      ekle(yan * 0.18, 0.17, omuz + 0.12 + j, 0.08, 0.2, 0.08, gomlek);
      ekle(yan * 0.18, 0.3, omuz + 0.12 + j, 0.08, 0.07, 0.07, g.ten);
    } else if (tip === 'yukari') {
      const w = Math.sin(fz * 6) * 0.03;
      ekle(la + w * yan, 0, omuz + 0.22, 0.09, 0.11, 0.3, gomlek);
      ekle(la + w * yan, 0, omuz + 0.52, 0.09, 0.1, 0.07, g.ten);
    } else if (tip === 'bardak') {
      ekle(la, 0.03, omuz + 0.11, 0.09, 0.12, 0.17, gomlek);
      ekle(yan * 0.17, 0.15, omuz + 0.13, 0.08, 0.16, 0.08, gomlek);
      ekle(yan * 0.15, 0.25, omuz + 0.14, 0.1, 0.1, 0.11, '#FBF8F1');
    } else if (tip === 'raket') {
      const v = Math.sin(t * 2.83 + (k.yon === '+x' ? 0 : Math.PI));
      ekle(la, 0.06 + v * 0.05, omuz + 0.1, 0.09, 0.12, 0.18, gomlek);
      ekle(la, 0.2 + v * 0.1, omuz + 0.14, 0.08, 0.18, 0.08, g.ten);
      ekle(la, 0.34 + v * 0.1, omuz + 0.12, 0.03, 0.16, 0.2, '#D1495B');
    }
  };

  if (k.onay) {
    kol(-1, oturuyor ? 'ileri' : 'serbest');
    kol(1, 'yukari');
  } else if (yuru) {
    kol(-1, 'serbest');
    kol(1, 'serbest');
  } else if (k.poz === 'yaz' || k.poz === 'oyun') {
    kol(-1, 'ileri');
    kol(1, 'ileri');
    if (k.poz === 'oyun') ekle(0, 0.31, omuz + 0.11, 0.26, 0.09, 0.07, '#F7F7F5');
  } else if (k.poz === 'oku') {
    kol(-1, 'ileri');
    kol(1, 'ileri');
    ekle(0, 0.33, omuz + 0.1, 0.3, 0.05, 0.2, gomlek === '#8E7CC3' ? '#EDAE49' : '#8E7CC3');
    ekle(0, 0.3, omuz + 0.11, 0.26, 0.03, 0.18, '#FBF8F1');
  } else if (k.poz === 'kahve') {
    kol(-1, 'serbest');
    kol(1, 'bardak');
  } else if (k.poz === 'pong') {
    kol(-1, 'serbest');
    kol(1, 'raket');
  } else {
    kol(-1, 'serbest');
    kol(1, 'serbest');
  }

  // baş
  const hz = tz + 0.32;
  const yuzGorunur = k.yon === '+x' || k.yon === '+y';
  ekle(0, 0.01, hz, 0.3, 0.28, 0.27, g.ten, (p) => {
    if (!yuzGorunur) return;
    // gözler: bize bakan yüzde
    const e = (yan) => {
      const ex = p.cx + a[0] * yan * 0.075 * S + f[0] * 0.14 * S;
      const ey = p.cy + a[1] * yan * 0.075 * S + f[1] * 0.14 * S;
      return iso(ex, ey, z0 + (hz + 0.15) * S);
    };
    const e1 = e(-1);
    const e2 = e(1);
    if (g.sakal) {
      const b1 = iso(p.cx + a[0] * -0.15 * S + f[0] * 0.14 * S, p.cy + a[1] * -0.15 * S + f[1] * 0.14 * S, z0 + (hz + 0.09) * S);
      const b2 = iso(p.cx + a[0] * 0.15 * S + f[0] * 0.14 * S, p.cy + a[1] * 0.15 * S + f[1] * 0.14 * S, z0 + (hz + 0.09) * S);
      const b3 = iso(p.cx + a[0] * 0.15 * S + f[0] * 0.14 * S, p.cy + a[1] * 0.15 * S + f[1] * 0.14 * S, z0 + hz * S);
      const b4 = iso(p.cx + a[0] * -0.15 * S + f[0] * 0.14 * S, p.cy + a[1] * -0.15 * S + f[1] * 0.14 * S, z0 + hz * S);
      ctx.fillStyle = shade(g.sac, 0.08);
      ctx.beginPath();
      ctx.moveTo(b1[0], b1[1]);
      ctx.lineTo(b2[0], b2[1]);
      ctx.lineTo(b3[0], b3[1]);
      ctx.lineTo(b4[0], b4[1]);
      ctx.fill();
    }
    ctx.fillStyle = '#1F2430';
    const goz = Math.sin(fz * 0.9) > 0.985 ? 0.8 : 3.2;
    ctx.fillRect(e1[0] - 1.2, e1[1] - 1.5, 2.4, goz);
    ctx.fillRect(e2[0] - 1.2, e2[1] - 1.5, 2.4, goz);
    if (g.ek === 'gozluk') {
      ctx.strokeStyle = '#1F2430';
      ctx.lineWidth = 1;
      ctx.strokeRect(e1[0] - 2.8, e1[1] - 2.8, 5.6, 5.6);
      ctx.strokeRect(e2[0] - 2.8, e2[1] - 2.8, 5.6, 5.6);
      ctx.beginPath();
      ctx.moveTo(e1[0], e1[1]);
      ctx.lineTo(e2[0], e2[1]);
      ctx.stroke();
    }
  });

  // saç ve aksesuarlar
  const st = g.stil;
  if (st === 'bere') {
    ekle(0, 0.005, hz + 0.2, 0.32, 0.3, 0.13, '#31525B');
    ekle(0, -0.125, hz + 0.08, 0.3, 0.05, 0.14, g.sac);
  } else if (st === 'sapka') {
    ekle(0, 0.005, hz + 0.24, 0.32, 0.3, 0.09, '#2B303B');
    ekle(0, 0.2, hz + 0.24, 0.26, 0.12, 0.03, '#2B303B');
    ekle(0, -0.125, hz + 0.08, 0.3, 0.05, 0.17, g.sac);
  } else if (st === 'kivircik') {
    ekle(0, -0.01, hz + 0.24, 0.38, 0.36, 0.13, g.sac);
    ekle(0, -0.14, hz + 0.08, 0.36, 0.09, 0.2, g.sac);
  } else {
    ekle(0, 0.0, hz + 0.27, 0.32, 0.3, 0.065, g.sac);
    if (st === 'uzun') {
      ekle(0, -0.13, hz - 0.1, 0.33, 0.07, 0.4, g.sac);
      ekle(-0.155, -0.03, hz + 0.02, 0.035, 0.2, 0.26, g.sac);
      ekle(0.155, -0.03, hz + 0.02, 0.035, 0.2, 0.26, g.sac);
    } else {
      ekle(0, -0.13, hz + 0.08, 0.32, 0.06, 0.2, g.sac);
      if (st === 'topuz') ekle(0, -0.08, hz + 0.33, 0.14, 0.14, 0.11, g.sac);
    }
  }
  if (g.ek === 'kulaklik') {
    ekle(0, 0.0, hz + 0.335, 0.34, 0.06, 0.03, '#15171C');
    ekle(-0.17, 0.0, hz + 0.08, 0.05, 0.12, 0.14, '#15171C');
    ekle(0.17, 0.0, hz + 0.08, 0.05, 0.12, 0.14, '#15171C');
  }

  // çiz
  ctx.save();
  ctx.globalAlpha = k.alfa;
  if (!oturuyor) ellipseShadow(ctx, k.x + 0.03, k.y + 0.03, 11, 5.5, 0.24);
  parca.sort((p, q) => p.k - q.k);
  for (const p of parca) {
    box(ctx, p.cx - p.w / 2, p.cy - p.d / 2, p.z, p.w, p.d, p.h, p.col);
    if (p.son) p.son(p);
  }
  ctx.restore();
}
