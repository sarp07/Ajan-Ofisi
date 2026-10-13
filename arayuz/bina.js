// Bina: aktif kat cam bir kuleden çekmece gibi öne çekilmiş durur; kulede onun yeri boş kalır.
// Kulenin üst katları yukarıda, alt katları aşağıda görünür. Oturumu açık katın pencereleri sıcak sarı yanar,
// kapalı katların camı gece mavisidir. Arkada gece şehri vardır. Bir kata ya da etiketine tıklanınca o kata geçilir.
import { iso, box, faceX, faceY, faceTop } from './izo.js';
import { W, D, WALL_H } from './ofis.js';

const KAT_Y = 2.1; // kulede bir katın yüksekliği
const DOSEME = 0.24; // katlar arasındaki beton bant
const GERI = 12; // kule, öne çekilmiş aktif katın ne kadar gerisinde (x ve y yönünde)
const TABAN_Z = -0.45; // aktif katın döşemesinin altı: kulede aktif katın yeri bu seviyeden başlar
const GOSTER_UST = 6;
const GOSTER_ALT = 4;

const yumusak = (x) => 1 - Math.pow(1 - x, 3);

function rastgele(tohum) {
  let s = (tohum * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Kulenin yeri: aktif katın gerisinde, aynı taban ölçüsünde
const KX = -GERI;
const KY = -GERI;
const KW = W;
const KD = D;

// Bir cephe şeridi: cam pencereler ve dikmeler. genislik: plan birimi * 100, yukseklik: cam yüksekliği * 100
function cephe(c, genislik, yukseklik, yanik, tohum, karanlik) {
  const r = rastgele(tohum);
  // cam zemin
  const cam = c.createLinearGradient(0, 0, 0, yukseklik);
  if (yanik) {
    cam.addColorStop(0, '#FFE2A8');
    cam.addColorStop(1, '#F5B35C');
  } else {
    cam.addColorStop(0, karanlik ? '#121A2B' : '#1B2740');
    cam.addColorStop(1, karanlik ? '#0C1220' : '#141E33');
  }
  c.fillStyle = cam;
  c.fillRect(0, 0, genislik, yukseklik);
  // pencere bölmeleri: yanık katta bazı pencereler kapalı ya da loş
  const bolme = 50;
  for (let x = 0; x < genislik; x += bolme) {
    const v = r();
    if (yanik) {
      if (v < 0.18) {
        c.fillStyle = 'rgba(40,30,20,0.55)'; // perdesi kapalı
        c.fillRect(x, 0, bolme, yukseklik);
      } else if (v < 0.4) {
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.fillRect(x, 0, bolme, yukseklik);
      }
    } else if (v < 0.07 && !karanlik) {
      c.fillStyle = 'rgba(255,214,140,0.28)'; // gecikmiş tek bir ışık
      c.fillRect(x, 0, bolme, yukseklik);
    }
    // camdaki çapraz yansıma
    c.fillStyle = yanik ? 'rgba(255,255,255,0.14)' : 'rgba(150,180,230,0.10)';
    c.beginPath();
    c.moveTo(x + 6, yukseklik);
    c.lineTo(x + 22, 0);
    c.lineTo(x + 30, 0);
    c.lineTo(x + 14, yukseklik);
    c.fill();
  }
  // dikmeler
  c.fillStyle = yanik ? 'rgba(90,60,30,0.55)' : 'rgba(70,84,110,0.85)';
  for (let x = 0; x <= genislik; x += bolme) c.fillRect(x - 2, 0, 4, yukseklik);
}

// Kulenin bir katı: altında beton döşeme bandı, üstünde iki cepheli cam şerit
function kat(ctx, z, k, i) {
  const cam = KAT_Y - DOSEME;
  // döşeme bandı
  box(ctx, KX, KY, z, KW, KD, DOSEME, '#3A4357', { top: '#3A4357', left: '#566078', right: '#454E64' });
  // cam gövde (kutu olarak çizilir, cepheler üstüne boyanır)
  box(ctx, KX, KY, z + DOSEME, KW, KD, cam, '#1B2740', { top: '#2A3348' });
  faceY(ctx, KX, KY + KD, z + KAT_Y, (c) => cephe(c, KW * 100, cam * 100, k.acik, k.no * 31 + 7, false));
  faceX(ctx, KX + KW, KY + KD, z + KAT_Y, (c) => cephe(c, KD * 100, cam * 100, k.acik, k.no * 17 + 3, false));
}

// Aktif katın kuledeki boş yeri: karanlık bir oyuk, çevresinde ince ışık
function oyuk(ctx, z, yukseklik) {
  box(ctx, KX, KY, z, KW, KD, DOSEME, '#3A4357', { top: '#3A4357', left: '#566078', right: '#454E64' });
  box(ctx, KX, KY, z + DOSEME, KW, KD, yukseklik - DOSEME, '#0A0E17', { top: '#0A0E17', left: '#0D1220', right: '#0A0F1A' });
  faceY(ctx, KX, KY + KD, z + yukseklik, (c) => {
    c.strokeStyle = 'rgba(23,184,166,0.45)';
    c.lineWidth = 6;
    c.strokeRect(3, 3, KW * 100 - 6, (yukseklik - DOSEME) * 100 - 6);
  });
  faceX(ctx, KX + KW, KY + KD, z + yukseklik, (c) => {
    c.strokeStyle = 'rgba(23,184,166,0.45)';
    c.lineWidth = 6;
    c.strokeRect(3, 3, KD * 100 - 6, (yukseklik - DOSEME) * 100 - 6);
  });
}

function cati(ctx, z) {
  // çatı: açık beton, karo çizgileri, kenar korkuluğu ve ışıkları, helikopter pisti, klima üniteleri, anten
  box(ctx, KX, KY, z, KW, KD, 0.3, '#3A4357', { top: '#4B556C', left: '#566078', right: '#454E64' });
  const zt = z + 0.3;
  faceTop(ctx, KX, KY, zt, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = 3;
    for (let x = 100; x < KW * 100; x += 100) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, KD * 100);
      c.stroke();
    }
    for (let y = 100; y < KD * 100; y += 100) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(KW * 100, y);
      c.stroke();
    }
    // helikopter pisti
    const hx = KW * 100 * 0.62;
    const hy = KD * 100 * 0.55;
    c.fillStyle = '#39425A';
    c.beginPath();
    c.arc(hx, hy, 300, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#E9C46A';
    c.lineWidth = 16;
    c.beginPath();
    c.arc(hx, hy, 250, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#E9ECF2';
    c.fillRect(hx - 90, hy - 110, 34, 220);
    c.fillRect(hx + 56, hy - 110, 34, 220);
    c.fillRect(hx - 90, hy - 17, 180, 34);
  });
  // korkuluk (kenar şeridi)
  box(ctx, KX, KY, zt, KW, 0.12, 0.35, '#566078');
  box(ctx, KX, KY, zt, 0.12, KD, 0.35, '#566078');
  // klima üniteleri ve makine dairesi
  for (const [x, y] of [[1.5, 1.5], [3.2, 1.5], [1.5, 3.2]]) box(ctx, KX + x, KY + y, zt, 1.2, 1.2, 0.55, '#5A6480', { top: '#6E789A' });
  box(ctx, KX + 6, KY + 1.2, zt, 3.5, 2.5, 1.0, '#475066', { top: '#5A6480' });
  box(ctx, KX + 7.6, KY + 2.2, zt + 1.0, 0.12, 0.12, 2.6, '#8C96A6');
  const parla = 0.55 + 0.45 * Math.sin(performance.now() / 420);
  const [ax, ay] = iso(KX + 7.66, KY + 2.26, zt + 3.6);
  ctx.fillStyle = `rgba(255,80,80,${parla})`;
  ctx.beginPath();
  ctx.arc(ax, ay, 4, 0, Math.PI * 2);
  ctx.fill();
  // ön kenarlarda küçük ikaz ışıkları
  ctx.fillStyle = `rgba(255,213,138,${0.5 + parla * 0.4})`;
  for (let x = 1; x < KW; x += 3) {
    const [px, py] = iso(KX + x, KY + KD, zt + 0.02);
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
  for (let y = 1; y < KD; y += 3) {
    const [px, py] = iso(KX + KW, KY + y, zt + 0.02);
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
}

// Bir katın tıklanabilir dış çizgisi (iki cephe)
function katYolu(ctx, z, h) {
  const p = [iso(KX, KY + KD, z + h), iso(KX + KW, KY + KD, z + h), iso(KX + KW, KY, z + h), iso(KX + KW, KY, z), iso(KX + KW, KY + KD, z), iso(KX, KY + KD, z)];
  ctx.beginPath();
  p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function etiket(ctx, z, k, aktif) {
  const [x, y] = iso(KX + KW + 0.4, KY + KD * 0.35, z + KAT_Y * 0.55);
  const yazi = `${k.no}  ${k.ad}`;
  ctx.font = '600 21px -apple-system, "SF Pro Text", "Segoe UI", sans-serif';
  const g = ctx.measureText(yazi).width + 40 + (k.bekleyen ? 32 : 0);
  ctx.save();
  ctx.fillStyle = aktif ? 'rgba(10,40,38,0.92)' : 'rgba(10,13,20,0.85)';
  ctx.strokeStyle = aktif ? 'rgba(23,184,166,0.9)' : k.acik ? 'rgba(255,213,138,0.6)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y - 19, g, 38, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = k.acik ? '#FFD58A' : '#4A5263';
  ctx.beginPath();
  ctx.arc(x + 18, y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = aktif ? '#FFFFFF' : '#C9CFDB';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(yazi, x + 32, y + 1);
  if (k.bekleyen) {
    const bx = x + g - 20;
    ctx.fillStyle = '#F2A93B';
    ctx.beginPath();
    ctx.arc(bx, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1B1405';
    ctx.font = '700 15px -apple-system, "SF Pro Text", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(k.bekleyen), bx, y + 1);
  }
  ctx.restore();
}

export class Bina {
  constructor() {
    this.katlar = []; // alttan üste: [{ id, no, ad, acik, bekleyen }]
    this.aktif = null;
    this.acilis = 0;
    this.gece = null;
    this.geceBoyut = '';
    this.yollar = []; // tıklama için: { id, z, h }
  }

  ayarla(katlar, aktif) {
    if (aktif !== this.aktif) this.acilis = performance.now();
    this.katlar = katlar;
    this.aktif = aktif;
  }

  get sira() {
    return this.katlar.findIndex((k) => k.id === this.aktif);
  }

  // Sahnenin sığdırma sınırına eklenecek pay (dünya pikseli): kulenin bir kısmı görünsün
  pay() {
    if (!this.katlar.length) return { ust: 0, alt: 0, sol: 0 };
    return { ust: 400, alt: 40, sol: 40 };
  }

  arkaPlan(ctx, gen, yuk) {
    const anahtar = `${Math.round(gen)}x${Math.round(yuk)}`;
    if (!this.gece || this.geceBoyut !== anahtar) {
      const dpr = window.devicePixelRatio || 1;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(gen * dpr));
      c.height = Math.max(1, Math.round(yuk * dpr));
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      const gok = g.createLinearGradient(0, 0, 0, yuk);
      gok.addColorStop(0, '#060912');
      gok.addColorStop(0.55, '#0E1528');
      gok.addColorStop(1, '#1A2236');
      g.fillStyle = gok;
      g.fillRect(0, 0, gen, yuk);
      const r = rastgele(42);
      for (let i = 0; i < 110; i++) {
        g.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.5})`;
        const b = r() < 0.12 ? 2 : 1;
        g.fillRect(r() * gen, r() * yuk * 0.5, b, b);
      }
      // ay
      const ay = g.createRadialGradient(gen * 0.86, yuk * 0.14, 2, gen * 0.86, yuk * 0.14, 60);
      ay.addColorStop(0, 'rgba(255,248,225,0.95)');
      ay.addColorStop(0.25, 'rgba(255,248,225,0.85)');
      ay.addColorStop(0.3, 'rgba(255,248,225,0.12)');
      ay.addColorStop(1, 'rgba(255,248,225,0)');
      g.fillStyle = ay;
      g.fillRect(gen * 0.86 - 60, yuk * 0.14 - 60, 120, 120);
      // ufuk ışığı ve iki sıra uzak bina
      const ufuk = g.createLinearGradient(0, yuk * 0.6, 0, yuk);
      ufuk.addColorStop(0, 'rgba(90,110,170,0)');
      ufuk.addColorStop(1, 'rgba(90,110,170,0.18)');
      g.fillStyle = ufuk;
      g.fillRect(0, yuk * 0.6, gen, yuk * 0.4);
      for (const [taban, renk, isik, yog, maks] of [
        [yuk * 0.8, '#141C30', 'rgba(255,214,140,0.30)', 0.05, 0.28],
        [yuk * 0.95, '#0B1120', 'rgba(255,214,140,0.55)', 0.09, 0.4],
      ]) {
        let x = -20;
        while (x < gen + 20) {
          const bw = 26 + r() * 64;
          const bh = 30 + r() * yuk * maks;
          g.fillStyle = renk;
          g.fillRect(x, taban - bh, bw, yuk);
          if (r() < 0.3) g.fillRect(x + bw / 2 - 1, taban - bh - 14, 2, 14);
          g.fillStyle = isik;
          for (let wy = taban - bh + 7; wy < taban - 5; wy += 8)
            for (let wx = x + 4; wx < x + bw - 5; wx += 7) if (r() < yog) g.fillRect(wx, wy, 3, 3);
          x += bw + 3 + r() * 8;
        }
      }
      this.gece = c;
      this.geceBoyut = anahtar;
    }
    ctx.drawImage(this.gece, 0, 0, gen, yuk);
  }

  // Kule: aktif katın gerisinde, ofisten önce çizilir. Alttan üste: alt katlar, boş yer, üst katlar, çatı.
  // Kat değişince kule kısa bir an aşağıdan yukarı kayar (aktif kat çekmece gibi öne çıkar).
  altCiz(ctx) {
    const i = this.sira;
    this.yollar = [];
    if (i < 0) return;
    const f = yumusak(Math.min(1, (performance.now() - this.acilis) / 700));
    const kay = (1 - f) * KAT_Y * 0.6;
    const yuvaH = WALL_H + 0.45;
    const alt = this.katlar.slice(Math.max(0, i - GOSTER_ALT), i);
    const ust = this.katlar.slice(i + 1, i + 1 + GOSTER_UST);
    // alt katlar: en alttan başlayarak
    alt.forEach((k, j) => {
      const z = TABAN_Z - (alt.length - j) * KAT_Y - kay;
      kat(ctx, z, k, j);
      this.yollar.push({ id: k.id, z, h: KAT_Y });
    });
    oyuk(ctx, TABAN_Z - kay, yuvaH);
    ust.forEach((k, j) => {
      const z = TABAN_Z + yuvaH + j * KAT_Y - kay;
      kat(ctx, z, k, j);
      this.yollar.push({ id: k.id, z, h: KAT_Y });
    });
    // kule bitiyorsa çatı
    if (i + 1 + GOSTER_UST >= this.katlar.length) cati(ctx, TABAN_Z + yuvaH + ust.length * KAT_Y - kay);
    this.aktifZ = TABAN_Z - kay;
    this.yuvaH = yuvaH;
  }

  ustCiz() {}

  // Etiketler ofisten sonra: aktif katın etiketi kuledeki yerinde, diğerleri kendi katlarında
  etiketCiz(ctx) {
    const i = this.sira;
    if (i < 0) return;
    for (const y of this.yollar) {
      const k = this.katlar.find((x) => x.id === y.id);
      if (k) etiket(ctx, y.z, k, false);
    }
    etiket(ctx, this.aktifZ + 0.2, this.katlar[i], true);
  }

  vur(ctx, wx, wy) {
    for (const y of [...this.yollar].reverse()) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      katYolu(ctx, y.z, y.h);
      const ic = ctx.isPointInPath(wx, wy);
      ctx.restore();
      if (ic) return y.id;
    }
    return null;
  }
}
