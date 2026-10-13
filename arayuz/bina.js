// Bina: her zaman yüksek bir cam kule (en az 12 kat). Projelerin katları kulenin alt katlarıdır.
// Aktif kat yerinde durur ve alt katlara bitişiktir; yalnızca üstündeki katlar yukarı doğru ayrılır, aradaki boşlukta
// aktif katın içi görünür. Oturumu açık katın pencereleri sıcak sarı yanar, kapalı katlar karanlıktır. Arkada gece şehri.
// Bir kata ya da etiketine tıklanınca o kata geçilir.
import { iso, box, faceX, faceY, faceTop } from './izo.js';
import { W, D, WALL_H } from './ofis.js';

const KAT_Y = 2.1; // kulede bir katın yüksekliği
const DOSEME = 0.24; // katlar arasındaki beton bant
const TABAN_Z = -0.45; // aktif katın döşemesinin altı
const EN_AZ = 12; // kule en az bu kadar katlı görünür
const ZEMIN_Y = 2.6; // giriş katı (lobi) yüksekliği
const ACILMA = 19; // üst katlar aktif katın duvar üstünden bu kadar yukarı kalkar

const yumusak = (x) => 1 - Math.pow(1 - x, 3);

function rastgele(tohum) {
  let s = (tohum * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Kulenin yeri: aktif katla aynı taban (döşeme kenarları dahil)
const KX = -0.25;
const KY = -0.25;
const KW = W + 0.25;
const KD = D + 0.25;

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

// Kulenin bir katı: altında beton döşeme bandı, üstünde iki cepheli cam şerit.
// Proje katı açıksa ışıkları yanar, kapalıysa karanlıktır; projesi olmayan katlarda birkaç rastgele ışık yanar.
function kat(ctx, z, k) {
  const cam = KAT_Y - DOSEME;
  const karanlik = !k.dolgu && !k.acik;
  box(ctx, KX, KY, z, KW, KD, DOSEME, '#3A4357', { top: '#3A4357', left: '#566078', right: '#454E64' });
  box(ctx, KX, KY, z + DOSEME, KW, KD, cam, '#1B2740', { top: '#2A3348' });
  faceY(ctx, KX, KY + KD, z + KAT_Y, (c) => cephe(c, KW * 100, cam * 100, !!k.acik, k.no * 31 + 7, karanlik));
  faceX(ctx, KX + KW, KY + KD, z + KAT_Y, (c) => cephe(c, KD * 100, cam * 100, !!k.acik, k.no * 17 + 3, karanlik));
}

// Giriş katı: koyu taş kaplama, aydınlık cam giriş ve tabela
function lobi(ctx, z) {
  box(ctx, KX - 0.3, KY - 0.3, z - 0.3, KW + 0.6, KD + 0.6, 0.3, '#2A3142', { top: '#343C50' });
  box(ctx, KX, KY, z, KW, KD, ZEMIN_Y, '#252C3C', { top: '#2A3348', left: '#2E3647', right: '#262D3C' });
  faceY(ctx, KX, KY + KD, z + ZEMIN_Y, (c) => {
    const g = c.createLinearGradient(0, 0, 0, ZEMIN_Y * 100);
    g.addColorStop(0, '#FFE7B5');
    g.addColorStop(1, '#E9A85A');
    c.fillStyle = g;
    c.fillRect(KW * 100 * 0.35, 70, KW * 100 * 0.3, ZEMIN_Y * 100 - 70);
    c.fillStyle = 'rgba(60,40,20,0.6)';
    for (let x = KW * 100 * 0.35; x <= KW * 100 * 0.65; x += 60) c.fillRect(x - 2, 70, 4, ZEMIN_Y * 100 - 70);
    c.fillStyle = '#17B8A6';
    c.fillRect(KW * 100 * 0.42, 22, KW * 100 * 0.16, 26);
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

  // Sahnenin sığdırma sınırına eklenecek pay (dünya pikseli): ayrılan üst katların ve alttaki kulenin bir kısmı görünsün
  pay() {
    if (!this.katlar.length) return { ust: 0, alt: 0 };
    return { ust: 260, alt: 170 };
  }

  // Kulenin bütün katları alttan üste: projelerin katları, sonra kuleyi en az EN_AZ kata tamamlayan katlar
  kule() {
    const n = Math.max(EN_AZ, this.katlar.length + 3);
    return Array.from({ length: n }, (_, j) => this.katlar[j] || { id: null, no: j + 1, dolgu: true });
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

  // Alt katlar ve lobi: aktif katın hemen altında, ona bitişik (ofisten önce çizilir)
  altCiz(ctx) {
    const i = this.sira;
    this.yollar = [];
    if (i < 0) return;
    const kule = this.kule();
    let z = TABAN_Z;
    for (let j = i - 1; j >= 0; j--) {
      z -= KAT_Y;
      this.yollar.push({ k: kule[j], z, h: KAT_Y });
    }
    lobi(ctx, z - ZEMIN_Y);
    for (const y of [...this.yollar].reverse()) kat(ctx, y.z, y.k);
  }

  // Üst katlar: aktif katın üstünden yukarı ayrılır; kat değişince aralanma animasyonu (ofisten sonra çizilir)
  ustCiz(ctx) {
    const i = this.sira;
    if (i < 0) return;
    const f = yumusak(Math.min(1, (performance.now() - this.acilis) / 750));
    const kule = this.kule();
    let z = WALL_H + (ACILMA - WALL_H) * f;
    for (let j = i + 1; j < kule.length; j++) {
      kat(ctx, z, kule[j]);
      this.yollar.push({ k: kule[j], z, h: KAT_Y });
      z += KAT_Y;
    }
    cati(ctx, z);
  }

  // Etiketler en üst katmanda: yalnızca proje katlarının; aktif katın etiketi vurgulu
  etiketCiz(ctx) {
    const i = this.sira;
    if (i < 0) return;
    for (const y of this.yollar) if (!y.k.dolgu) etiket(ctx, y.z, y.k, false);
    etiket(ctx, TABAN_Z + 0.25, this.katlar[i], true);
  }

  vur(ctx, wx, wy) {
    for (const y of [...this.yollar].reverse()) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (y.k.dolgu) {
        ctx.restore();
        continue;
      }
      katYolu(ctx, y.z, y.h);
      const ic = ctx.isPointInPath(wx, wy);
      ctx.restore();
      if (ic) return y.k.id;
    }
    return null;
  }
}
