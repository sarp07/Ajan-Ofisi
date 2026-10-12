// Sahne: kamera, çizim döngüsü, karakterlerin gerçek duruma göre yerleştirilmesi.
import { iso, alpha, mix, roundRect, faceTop } from './izo.js';
import { ofisKur, sabitCiz, duvarCiz, gokyuzu, SINIR, W, D, WALL_H } from './ofis.js';
import { Kisi, kisiCiz, MISAFIR_GORUNUS } from './insanlar.js';
import { SEF_ID, MISAFIR_RENK } from '../cekirdek/kimlik.js';

const COZ = 2; // sabit katman çözünürlük çarpanı
const KAHVE_SURESI = 40000; // boşa düşen kişi önce kahveye, sonra oyun alanına geçer
const YAZI = '-apple-system, "SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

function kisalt(ctx, metin, en) {
  if (ctx.measureText(metin).width <= en) return metin;
  let s = metin;
  while (s.length > 1 && ctx.measureText(s + '…').width > en) s = s.slice(0, -1);
  return s + '…';
}

export class Sahne {
  constructor(tuval, { secildi, bosMasa, t }) {
    this.tuval = tuval;
    this.ctx = tuval.getContext('2d');
    this.secildi = secildi || (() => {});
    this.bosMasa = bosMasa || (() => {});
    this.t = t;
    this.sirket = null;
    this.ofis = null;
    this.kisiler = new Map();
    this.veri = { ajanlar: [], gorevler: [], yogunluk: 0 };
    this.secili = null;
    this.uzerinde = null; // fare altındaki boş masa
    this.kam = { x: 0, y: 0, z: 1, elle: false };
    this.sabit = document.createElement('canvas');
    this.sabitIz = null;
    this.t0 = performance.now();
    this.son = this.t0;
    this.calisiyor = true;
    this.fazladan = [
      { x: 16.6, y: 5.9, yon: '-y', poz: 'ayakta' },
      { x: 18.0, y: 5.9, yon: '-y', poz: 'ayakta' },
      { x: 19.4, y: 5.9, yon: '-y', poz: 'ayakta' },
      { x: 20.8, y: 5.9, yon: '-y', poz: 'ayakta' },
      { x: 13.4, y: 6.6, yon: '+y', poz: 'ayakta' },
      { x: 13.4, y: 3.6, yon: '+y', poz: 'ayakta' },
    ];
    this._olaylar();
    this.boyutla();
    requestAnimationFrame((z) => this.dongu(z));
  }

  // ---------- veri ----------
  sirketAl(sirket, t) {
    this.sirket = sirket;
    if (t) this.t = t;
    this.ofis = ofisKur(sirket);
    this.sabitIz = null;
    // masalar yeniden kuruldu: herkes yerini yeniden bulsun
    for (const k of this.kisiler.values()) {
      k.nokta = null;
      k.vardi = false;
    }
  }

  veriAl(snapshot) {
    this.veri = snapshot;
  }

  // Ofisteki kişinin şirketteki kaydı (ad, kabiliyet, alanlar, renk, görünüş)
  bilgi(rolId) {
    const s = this.sirket;
    const bos = { ad: '', unvan: this.t('misafir.unvan'), alanlar: [], renk: MISAFIR_RENK, gorunus: MISAFIR_GORUNUS };
    if (!s) return bos;
    if (rolId === SEF_ID) return s.sef;
    return s.ajanlar.find((a) => a.id === rolId) || bos;
  }

  sec(id) {
    this.secili = id;
  }

  odakla(id) {
    const k = this.kisiler.get(id);
    if (!k) return;
    const [sx, sy] = iso(k.x, k.y, 0.5);
    this.kam.x = sx;
    this.kam.y = sy;
    this.kam.z = Math.max(this.kam.z, this.sigdirZ() * 1.5);
    this.kam.elle = true;
  }

  // ---------- kamera ----------
  sigdirZ() {
    const cw = this.tuval.clientWidth || 1;
    const ch = this.tuval.clientHeight || 1;
    return Math.min(cw / (SINIR.maxX - SINIR.minX), ch / (SINIR.maxY - SINIR.minY));
  }

  sigdir() {
    this.kam.z = this.sigdirZ();
    this.kam.x = (SINIR.minX + SINIR.maxX) / 2;
    this.kam.y = (SINIR.minY + SINIR.maxY) / 2;
    this.kam.elle = false;
  }

  yakinlas(carpan, mx, my) {
    const cw = this.tuval.clientWidth;
    const ch = this.tuval.clientHeight;
    if (mx === undefined) {
      mx = cw / 2;
      my = ch / 2;
    }
    const eski = this.kam.z;
    const yeni = Math.min(3.4, Math.max(this.sigdirZ() * 0.7, eski * carpan));
    const wx = (mx - cw / 2) / eski + this.kam.x;
    const wy = (my - ch / 2) / eski + this.kam.y;
    this.kam.z = yeni;
    this.kam.x = wx - (mx - cw / 2) / yeni;
    this.kam.y = wy - (my - ch / 2) / yeni;
    this.kam.elle = true;
  }

  boyutla() {
    const dpr = window.devicePixelRatio || 1;
    const cw = this.tuval.clientWidth;
    const ch = this.tuval.clientHeight;
    if (!cw || !ch) return;
    this.tuval.width = Math.max(1, Math.round(cw * dpr));
    this.tuval.height = Math.max(1, Math.round(ch * dpr));
    this.dpr = dpr;
    if (!this.kam.elle) this.sigdir();
  }

  ekrana(wx, wy) {
    return [(wx - this.kam.x) * this.kam.z + this.tuval.clientWidth / 2, (wy - this.kam.y) * this.kam.z + this.tuval.clientHeight / 2];
  }

  dunyaya(mx, my) {
    return [(mx - this.tuval.clientWidth / 2) / this.kam.z + this.kam.x, (my - this.tuval.clientHeight / 2) / this.kam.z + this.kam.y];
  }

  _olaylar() {
    const el = this.tuval;
    new ResizeObserver(() => this.boyutla()).observe(el);
    let surukle = null;
    el.addEventListener('pointerdown', (e) => {
      surukle = { x: e.clientX, y: e.clientY, kx: this.kam.x, ky: this.kam.y, oynadi: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (surukle) {
        const dx = e.clientX - surukle.x;
        const dy = e.clientY - surukle.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) surukle.oynadi = true;
        if (surukle.oynadi) {
          this.kam.x = surukle.kx - dx / this.kam.z;
          this.kam.y = surukle.ky - dy / this.kam.z;
          this.kam.elle = true;
          el.style.cursor = 'grabbing';
        }
      } else {
        const k = this._vur(e);
        this.uzerinde = k ? null : this._bosVur(e);
        el.style.cursor = k || this.uzerinde ? 'pointer' : 'grab';
      }
    });
    el.addEventListener('pointerleave', () => (this.uzerinde = null));
    el.addEventListener('pointerup', (e) => {
      if (surukle && !surukle.oynadi) {
        const k = this._vur(e);
        if (k) {
          this.secili = k.id;
          this.secildi(this.secili);
        } else {
          const bos = this._bosVur(e);
          if (bos) this.bosMasa(bos.i);
          else {
            this.secili = null;
            this.secildi(null);
          }
        }
      }
      surukle = null;
      el.style.cursor = 'grab';
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) * 2) {
          this.yakinlas(Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022)), e.clientX - r.left, e.clientY - r.top);
        } else {
          this.kam.x += e.deltaX / this.kam.z;
          this.kam.y += e.deltaY / this.kam.z;
          this.kam.elle = true;
        }
      },
      { passive: false }
    );
    el.addEventListener('dblclick', () => this.sigdir());
  }

  _vur(e) {
    const r = this.tuval.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let en = null;
    let enU = 30 * Math.max(1, this.kam.z);
    for (const k of this.kisiler.values()) {
      const p = iso(k.x, k.y, k.oturZ + 0.55);
      const [sx, sy] = this.ekrana(p[0], p[1]);
      const u = Math.hypot(sx - mx, sy - my);
      if (u < enU) {
        enU = u;
        en = k;
      }
    }
    return en;
  }

  // Fare boş bir masa yerinin üstünde mi (zemin düzleminde)
  _bosVur(e) {
    if (!this.ofis) return null;
    const r = this.tuval.getBoundingClientRect();
    const [wx, wy] = this.dunyaya(e.clientX - r.left, e.clientY - r.top);
    // izometrik ters dönüşüm (z = 0)
    const a = wx / 32;
    const b = wy / 16;
    const x = (a + b) / 2;
    const y = (b - a) / 2;
    return this.ofis.bosYerler.find((m) => x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.d) || null;
  }

  // ---------- gerçek duruma göre yerleşim ----------
  yerlestir(simdi) {
    const { nokta, izgara } = this.ofis;
    const ajanlar = this.veri.ajanlar || [];
    const idler = new Set(ajanlar.map((a) => a.id));

    // ayrılanlar kapıya yürür
    for (const k of this.kisiler.values()) {
      if (!idler.has(k.id) && !k.gidiyor) {
        k.gidiyor = true;
        k.nokta = null;
        k.onay = false;
        k.hata = false;
        k.aktif = false;
        k.poz = 'ayakta';
        k.oturZ = 0;
        k.yol = [];
        k.hedefle(nokta.kapi, izgara);
      }
    }
    for (const [id, k] of this.kisiler) if (k.bitti) this.kisiler.delete(id);

    // gelenler kapıdan girer
    for (const a of ajanlar) {
      let k = this.kisiler.get(a.id);
      if (k && k.gidiyor) {
        k.gidiyor = false;
        k.bitti = false;
        k.nokta = null;
        k.kat = null;
      }
      if (!k) {
        // kapıdan tek tek girsinler
        if (simdi - (this.sonGiris || 0) < 650) continue;
        this.sonGiris = simdi;
        k = new Kisi(a.id, a.rol, { x: nokta.kapi.x, y: nokta.kapi.y });
        k.kat = null;
        this.kisiler.set(a.id, k);
      }
      k.rolId = a.rol;
      const b = this.bilgi(a.rol);
      k.bilgi = { renk: b.renk, gorunus: b.gorunus };
      k.onay = a.durum === 'onay';
      k.hata = a.durum === 'hata';
      k.aktif = a.durum === 'calisiyor';

      let aday;
      if (a.durum === 'calisiyor') aday = 'masa';
      else if (a.durum === 'arastiriyor') aday = 'kutuphane';
      else if (a.durum === 'bosta') aday = simdi - a.durumZamani < KAHVE_SURESI ? 'kahve' : 'oyun';
      else aday = k.kat || 'masa';
      if (!k.kat) {
        k.kat = aday;
      } else if (aday !== k.kat) {
        if (k.aday !== aday) {
          k.aday = aday;
          k.adayZ = simdi;
        }
        const bekle = aday === 'masa' ? 500 : aday === 'oyun' ? 0 : 2500;
        if (simdi - k.adayZ >= bekle) {
          k.kat = aday;
          k.aday = null;
        }
      } else {
        k.aday = null;
      }
    }

    // nokta dağıtımı
    const dolu = new Set();
    const canli = ajanlar.map((a) => this.kisiler.get(a.id)).filter(Boolean);
    const tut = (k, liste) => {
      if (k.nokta && liste.includes(k.nokta) && !dolu.has(k.nokta)) {
        dolu.add(k.nokta);
        return true;
      }
      return false;
    };
    const ver = (k, liste) => {
      for (const n of liste) {
        if (!dolu.has(n)) {
          dolu.add(n);
          k.hedefle(n, izgara);
          return true;
        }
      }
      return false;
    };
    const masaListe = (k) => {
      const kendi = nokta.masa[k.rolId];
      return kendi ? [kendi, ...nokta.misafir, ...this.fazladan] : [...nokta.misafir, ...this.fazladan];
    };

    // oyun grubu: iki kişi varsa pinpon, kalanlar PS5
    const oyuncular = canli.filter((k) => k.kat === 'oyun').sort((p, q) => (p.id < q.id ? -1 : 1));
    const pongcu = oyuncular.length >= 2 ? oyuncular.slice(0, 2) : [];
    pongcu.forEach((k, i) => {
      dolu.add(nokta.pong[i]);
      k.hedefle(nokta.pong[i], izgara);
    });

    const bekleyen = [];
    for (const k of canli) {
      if (pongcu.includes(k)) continue;
      const liste =
        k.kat === 'masa'
          ? masaListe(k)
          : k.kat === 'kutuphane'
            ? [...nokta.raf, ...nokta.koltuk, ...this.fazladan]
            : k.kat === 'kahve'
              ? [...nokta.kahve, ...this.fazladan]
              : [...nokta.ps, ...nokta.koltuk, ...this.fazladan];
      // kendi masası boşsa misafir koltuğunda oturmasın
      const kendi = k.kat === 'masa' ? nokta.masa[k.rolId] : null;
      if (kendi && k.nokta !== kendi && !dolu.has(kendi) && !this._baskasiOturuyor(kendi, k)) {
        bekleyen.push([k, liste]);
        continue;
      }
      if (!tut(k, liste)) bekleyen.push([k, liste]);
    }
    for (const [k, liste] of bekleyen) {
      // herkes aynı noktaya yığılmasın: kimliğe göre kaydır
      let sira = liste;
      if (k.kat === 'kahve' || k.kat === 'kutuphane') {
        const n = k.kat === 'kahve' ? nokta.kahve.length : nokta.raf.length;
        const kay = [...k.id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % n;
        sira = [...liste.slice(kay, n), ...liste.slice(0, kay), ...liste.slice(n)];
      }
      ver(k, sira);
    }

    // sahne ortamı
    const vardi = (n) => canli.some((k) => k.nokta === n && k.vardi);
    this.pongAcik = pongcu.length === 2 && pongcu.every((k) => k.vardi);
    this.tvAcik = nokta.ps.some(vardi);
    this.kahveAcik = nokta.kahve.slice(0, 2).some(vardi);
    this.misafirAcik = nokta.misafir.map(vardi);
    this.masaMod = {};
    for (const a of ajanlar) {
      const k = this.kisiler.get(a.id);
      const kendi = nokta.masa[a.rol];
      if (!k || !kendi || this.masaMod[a.rol]) continue;
      if (k.nokta === kendi && k.vardi && a.durum === 'calisiyor') {
        this.masaMod[a.rol] = { mod: a.arac === 'Bash' || a.arac === 'PowerShell' ? 'terminal' : a.arac === 'WebSearch' || a.arac === 'WebFetch' ? 'web' : 'kod' };
      } else {
        this.masaMod[a.rol] = { mod: 'bekle' };
      }
    }
  }

  _baskasiOturuyor(n, ben) {
    for (const k of this.kisiler.values()) if (k !== ben && k.nokta === n && !k.gidiyor) return true;
    return false;
  }

  // ---------- çizim ----------
  sabitHazirla(sky) {
    const iz = sky.ust + '|' + this.sirket.dil;
    if (this.sabitIz === iz) return;
    this.sabitIz = iz;
    const bw = SINIR.maxX - SINIR.minX;
    const bh = SINIR.maxY - SINIR.minY;
    this.sabit.width = bw * COZ;
    this.sabit.height = bh * COZ;
    const c = this.sabit.getContext('2d');
    c.setTransform(COZ, 0, 0, COZ, -SINIR.minX * COZ, -SINIR.minY * COZ);
    sabitCiz(c, sky, this.t);
  }

  dongu(z) {
    requestAnimationFrame((zz) => this.dongu(zz));
    const dt = Math.min(0.25, (z - this.son) / 1000);
    this.son = z;
    if (!this.ofis || !this.tuval.clientWidth || !this.calisiyor) return;
    const t = (z - this.t0) / 1000;
    const simdiD = new Date();
    const simdi = simdiD.getTime();
    const saat = this.saatZorla ?? simdiD.getHours() + simdiD.getMinutes() / 60;
    const sky = gokyuzu(saat);
    this.sabitHazirla(sky);
    this.yerlestir(simdi);
    for (const k of this.kisiler.values()) k.guncelle(dt);

    const ctx = this.ctx;
    const cw = this.tuval.clientWidth;
    const ch = this.tuval.clientHeight;
    const kz = this.kam.z;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(kz, kz);
    ctx.translate(-this.kam.x, -this.kam.y);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.sabit, SINIR.minX, SINIR.minY, SINIR.maxX - SINIR.minX, SINIR.maxY - SINIR.minY);

    const env = {
      t,
      t_: this.t,
      simdi: simdiD,
      sky,
      gorevler: this.veri.gorevler || [],
      masa: this.masaMod || {},
      misafirAcik: this.misafirAcik || [],
      tvAcik: this.tvAcik,
      pongAcik: this.pongAcik,
      kahveAcik: this.kahveAcik,
      yogunluk: this.veri.yogunluk || 0,
    };
    duvarCiz(ctx, env);

    // boş masa yerleri
    for (const m of this.ofis.bosYerler) {
      const ust = this.uzerinde === m;
      faceTop(ctx, m.x, m.y, 0.003, (c) => {
        roundRect(c, 6, 6, 188, 188, 14);
        c.fillStyle = ust ? 'rgba(23,184,166,0.16)' : 'rgba(95,65,30,0.045)';
        c.fill();
        c.setLineDash([12, 9]);
        c.lineWidth = ust ? 4 : 2.5;
        c.strokeStyle = ust ? 'rgba(23,184,166,0.95)' : 'rgba(95,65,30,0.3)';
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = ust ? 'rgba(23,184,166,0.95)' : 'rgba(95,65,30,0.34)';
        c.fillRect(100 - 3, 78, 6, 44);
        c.fillRect(78, 100 - 3, 44, 6);
      });
    }

    // seçim halkası
    const sk = this.secili && this.kisiler.get(this.secili);
    if (sk) {
      const p = iso(sk.x, sk.y, 0.01);
      ctx.strokeStyle = sk.bilgi.renk;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -t * 14;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 24, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // derinliğe göre mobilya + karakter
    const liste = this.ofis.props.slice();
    for (const k of this.kisiler.values()) liste.push({ k: k.x + k.y, kisi: k });
    liste.sort((a, b) => a.k - b.k);
    for (const o of liste) {
      if (o.kisi) kisiCiz(ctx, o.kisi, t);
      else o.ciz(ctx, env);
    }

    // akşam ve gece ışığı
    if (sky.isik > 0.01) {
      const govde = [iso(-0.25, D, -0.45), iso(W, D, -0.45), iso(W, -0.25, -0.45), iso(W, -0.25, WALL_H), iso(-0.25, -0.25, WALL_H), iso(-0.25, D, WALL_H)];
      ctx.save();
      ctx.beginPath();
      govde.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.clip();
      ctx.globalCompositeOperation = 'multiply';
      const n = Math.min(1, sky.isik / 0.34);
      ctx.fillStyle = mix('#FFFFFF', '#5F67A6', n * 0.74);
      ctx.fillRect(SINIR.minX, SINIR.minY, SINIR.maxX - SINIR.minX, SINIR.maxY - SINIR.minY);
      ctx.globalCompositeOperation = 'screen';
      const isik = (x, y, zz, r, renk, g) => {
        const p = iso(x, y, zz);
        const gr = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        gr.addColorStop(0, alpha(renk, g * n));
        gr.addColorStop(0.45, alpha(renk, g * n * 0.35));
        gr.addColorStop(1, alpha(renk, 0));
        ctx.fillStyle = gr;
        ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
      };
      isik(24.85, 4.15, 1.2, 170, '#FFC978', 0.5);
      isik(4.15, 13.95, 1.5, 120, '#FFC978', 0.42);
      isik(5.25, 13.95, 1.5, 120, '#FFC978', 0.42);
      isik(17.9, 3.7, 0.9, 60, '#B8F0C8', 0.3);
      isik(20.2, 3.7, 0.9, 60, '#B8F0C8', 0.3);
      for (const [id, yer] of Object.entries(this.ofis.masaYer)) {
        const m = this.masaMod && this.masaMod[id];
        if (m) isik(yer.x + yer.w / 2, yer.y + 0.75, 0.9, 70, '#A9CBFF', m.mod === 'bekle' ? 0.16 : 0.42);
      }
      if (this.tvAcik) isik(20.4, 11.2, 0.8, 170, '#F2A0C0', 0.4);
      ctx.restore();
    }
    ctx.restore();

    this.etiketCiz(ctx, t, simdi);
  }

  etiketCiz(ctx, t, simdi) {
    const ajanlar = new Map((this.veri.ajanlar || []).map((a) => [a.id, a]));
    // mesaj çizgileri
    for (const a of ajanlar.values()) {
      if (!a.mesaj || simdi - a.mesaj.zaman > 7000) continue;
      const k1 = this.kisiler.get(a.id);
      const k2 = a.mesaj.kimeId && this.kisiler.get(a.mesaj.kimeId);
      if (!k1 || !k2) continue;
      const p1 = this.ekrana(...k1.tepe());
      const p2 = this.ekrana(...k2.tepe());
      const mx = (p1[0] + p2[0]) / 2;
      const my = Math.min(p1[1], p2[1]) - 60 - Math.abs(p1[0] - p2[0]) * 0.12;
      const renk = k1.bilgi.renk;
      ctx.strokeStyle = alpha(renk, 0.9);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1] - 26);
      ctx.quadraticCurveTo(mx, my, p2[0], p2[1] - 26);
      ctx.stroke();
      ctx.setLineDash([]);
      const f = ((simdi - a.mesaj.zaman) / 1400) % 1;
      const q = (u, A, B, Cc) => (1 - u) * (1 - u) * A + 2 * (1 - u) * u * B + u * u * Cc;
      ctx.fillStyle = renk;
      ctx.beginPath();
      ctx.arc(q(f, p1[0], mx, p2[0]), q(f, p1[1] - 26, my, p2[1] - 26), 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // etiketler: üstte isim, altında kabiliyet. Öndekiler önce yerleşir, arkadakiler yukarı kayar.
    const sirali = [...this.kisiler.values()].sort((p, q) => q.x + q.y - (p.x + p.y));
    const kutular = [];
    const cizilecek = [];
    const yakin = this.kam.z >= this.sigdirZ() * 1.3;
    for (const k of sirali) {
      const a = ajanlar.get(k.id);
      const b = this.bilgi(k.rolId);
      const renk = k.bilgi.renk;
      const [sx, sy0] = this.ekrana(...k.tepe());
      const sy = sy0 - 8 * Math.max(0.8, this.kam.z);
      const ad = a ? a.ad : b.ad || '';
      const unvan = k.rolId === 'misafir' ? this.t('misafir.unvan') : b.unvan || '';
      const uyari = a && a.durum === 'onay';
      const hata = a && a.durum === 'hata';
      const secili = this.secili === k.id;
      const mesajVar = a && a.mesaj && simdi - a.mesaj.zaman < 7000;
      const calisir = a && (a.durum === 'calisiyor' || a.durum === 'arastiriyor');

      // üçüncü satır: o an ne yaptığı. Uzak görünümde yalnızca dikkat isteyen durumlarda açılır.
      let is = '';
      if (a) {
        if (mesajVar) is = '→ ' + a.mesaj.kime + ': ' + a.mesaj.metin;
        else if (uyari) is = this.t('durum.onay') + (a.ozet ? ' · ' + a.ozet : '');
        else if (hata) is = this.t('durum.hata') + (a.ozet ? ' · ' + a.ozet : '');
        else if (calisir && (yakin || secili)) is = a.ozet || '';
      } else if (k.gidiyor) is = this.t('etiket.cikiyor');
      let alan = '';
      if ((secili || yakin) && b.alanlar && b.alanlar.length) alan = b.alanlar.slice(0, 3).join(' · ');

      ctx.font = `700 11.5px ${YAZI}`;
      const adEn = ctx.measureText(ad).width;
      ctx.font = `500 10.5px ${YAZI}`;
      const genis = secili || uyari || hata ? 240 : 170;
      const unvanK = unvan ? kisalt(ctx, alan ? unvan + ' · ' + alan : unvan, genis) : '';
      const unvanEn = unvanK ? ctx.measureText(unvanK).width : 0;
      is = is ? kisalt(ctx, is, genis) : '';
      const isEn = is ? ctx.measureText(is).width : 0;
      const nabiz = calisir && !is;
      const en = Math.max(adEn + 16 + (nabiz ? 17 : 0), unvanEn, isEn) + 18;
      const boy = 20 + (unvanK ? 14 : 0) + (is ? 15 : 0);
      const x = sx - en / 2;
      let y = sy - boy;
      for (let d = 0; d < 8; d++) {
        const c = kutular.find((q) => x < q.x + q.en + 4 && x + en + 4 > q.x && y < q.y + q.boy + 3 && y + boy + 3 > q.y);
        if (!c) break;
        y = c.y - boy - 4;
      }
      if (y < 4) y = 4; // tuvalin üstünden taşmasın
      kutular.push({ x, y, en, boy });
      cizilecek.push({ k, sx, sy, x, y, en, boy, ad, adEn, unvanK, is, nabiz, uyari, hata, secili, renk });
    }

    // Önce bütün bağlantı çizgileri, sonra kutular: çizgi başka bir etiketin yazısının üstünden geçmez.
    for (const e of cizilecek) {
      if (e.sy - (e.y + e.boy) <= 3) continue;
      ctx.globalAlpha = e.k.alfa;
      ctx.strokeStyle = 'rgba(15,18,25,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(e.sx, e.y + e.boy + 4);
      ctx.lineTo(e.sx, e.sy + 3);
      ctx.stroke();
    }
    for (const e of cizilecek) {
      const { k, sx, x, y, en, boy, ad, adEn, unvanK, is, nabiz, uyari, hata, secili, renk } = e;
      ctx.globalAlpha = k.alfa;

      ctx.fillStyle = 'rgba(15,18,25,0.94)';
      roundRect(ctx, x, y, en, boy, 7);
      ctx.fill();
      ctx.lineWidth = uyari || hata || secili ? 1.6 : 1;
      ctx.strokeStyle = uyari ? '#F2A93B' : hata ? '#E5484D' : secili ? renk : 'rgba(255,255,255,0.14)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(15,18,25,0.9)';
      ctx.beginPath();
      ctx.moveTo(sx - 4, y + boy - 0.5);
      ctx.lineTo(sx + 4, y + boy - 0.5);
      ctx.lineTo(sx, y + boy + 4.5);
      ctx.fill();
      ctx.fillStyle = renk;
      ctx.beginPath();
      ctx.arc(x + 12, y + 10, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F2F4F8';
      ctx.font = `700 11.5px ${YAZI}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(ad, x + 20, y + 10.5);
      if (nabiz) {
        ctx.fillStyle = renk;
        for (let i = 0; i < 3; i++) {
          const yuk = 3 + Math.abs(Math.sin(t * 5 + i * 0.9)) * 6;
          ctx.fillRect(x + 25 + adEn + i * 4.5, y + 14.5 - yuk, 3, yuk);
        }
      }
      let satirY = y + 24.5;
      ctx.font = `500 10.5px ${YAZI}`;
      if (unvanK) {
        ctx.fillStyle = '#A8B0C0';
        ctx.fillText(unvanK, x + 9, satirY);
        satirY += 14.5;
      }
      if (is) {
        ctx.fillStyle = uyari ? '#F6C177' : hata ? '#FF9A9E' : '#DCE2EC';
        ctx.fillText(is, x + 9, satirY);
      }
      if (uyari) {
        const zip = Math.abs(Math.sin(t * 4)) * 5;
        ctx.fillStyle = '#F2A93B';
        ctx.beginPath();
        ctx.arc(x + en - 2, y - 2 - zip, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1A1205';
        ctx.font = `800 12px ${YAZI}`;
        ctx.textAlign = 'center';
        ctx.fillText('!', x + en - 2, y - 1.5 - zip);
        ctx.textAlign = 'left';
      }
      ctx.globalAlpha = 1;
    }
  }
}
