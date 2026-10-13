// Simülatör ve emülatör: uygulamanın içinde canlı görüntü, dokunma, kaydırma, yazı ve tuşlar.
// iOS: uygulamaya gömülü AXe (MIT, github.com/cameroncooke/AXe) ile. Android: adb ile.
// Sahip ve ajanlar aynı cihazı birlikte kullanır. Dokunma koordinatları iOS'ta nokta, Android'de pikseldir;
// arayüz 0..1 arası oranla gönderir, burada cihazın ölçüsüne çevrilir.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { calistir } from './claude.js';
import { adbBul } from './test-alani.js';

const MAC = process.platform === 'darwin';

export class Simulator {
  // axe: gömülü AXe programının yolu. env: kabuk ortamı. kare(udid, jpegBuffer): canlı görüntünün her karesi.
  constructor({ axe, env, kare }) {
    this.axe = axe;
    this.env = env;
    this.kareGeldi = kare || (() => {});
    this.akis = null; // { udid, surec }
    this.olcu = new Map(); // udid -> { w, h } (nokta)
  }

  ortamAyarla(env) {
    this.env = env;
  }

  axeVar() {
    try {
      return MAC && !!this.axe && fs.statSync(this.axe).isFile();
    } catch {
      return false;
    }
  }

  async axeCalis(arg, zamanAsimi = 30000, girdi) {
    if (!this.axeVar()) throw new Error('Simülatör denetim aracı (AXe) bulunamadı.');
    const s = await calistir(this.axe, arg, { env: this.env, zamanAsimi, girdi });
    if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').slice(-2).join(' ') || 'AXe hatası');
    return s.cikti;
  }

  async adbCalis(arg, zamanAsimi = 30000) {
    const adb = adbBul(this.env);
    if (!adb) throw new Error('adb bulunamadı');
    const s = await calistir(adb, arg, { env: this.env, zamanAsimi });
    if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').pop() || 'adb hatası');
    return s.cikti;
  }

  // Android cihazları seri numarasıyla, iOS simülatörleri UDID ile gelir (36 karakter, tireli)
  static ios(kimlik) {
    return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(String(kimlik));
  }

  // Ekranın ölçüsü: iOS'ta nokta (erişilebilirlik ağacının kökü), Android'de piksel
  async ekranOlcusu(kimlik) {
    if (this.olcu.has(kimlik)) return this.olcu.get(kimlik);
    let o;
    if (Simulator.ios(kimlik)) {
      const agac = JSON.parse(await this.axeCalis(['describe-ui', '--udid', kimlik]));
      const kok = Array.isArray(agac) ? agac[0] : agac;
      const f = (kok && (kok.frame || (kok.children && kok.children[0] && kok.children[0].frame))) || {};
      o = { w: f.width || 393, h: f.height || 852 };
    } else {
      const c = await this.adbCalis(['-s', kimlik, 'shell', 'wm', 'size']);
      const m = /(\d+)x(\d+)/.exec(c.split('\n').filter((x) => /size/i.test(x)).pop() || c);
      o = { w: m ? Number(m[1]) : 1080, h: m ? Number(m[2]) : 2400 };
    }
    this.olcu.set(kimlik, o);
    return o;
  }

  // ---------- canlı görüntü ----------
  // Aynı anda tek akış: başka cihaza geçince önceki durur (bilgisayarı yormamak için)
  akisBaslat(kimlik, { fps = 12, olcek = 0.5 } = {}) {
    if (this.akis && this.akis.kimlik === kimlik) return;
    this.akisDurdur();
    if (Simulator.ios(kimlik)) {
      if (!this.axeVar()) throw new Error('Simülatör denetim aracı (AXe) bulunamadı.');
      const surec = spawn(this.axe, ['stream-video', '--udid', kimlik, '--format', 'mjpeg', '--fps', String(fps), '--quality', '65', '--scale', String(olcek)], { env: this.env, stdio: ['ignore', 'pipe', 'ignore'] });
      let tampon = Buffer.alloc(0);
      surec.stdout.on('data', (d) => {
        tampon = Buffer.concat([tampon, d]);
        // MJPEG akışından tam JPEG kareleri ayıklanır (FFD8 ... FFD9)
        for (;;) {
          const bas = tampon.indexOf(Buffer.from([0xff, 0xd8, 0xff]));
          if (bas < 0) {
            tampon = Buffer.alloc(0);
            break;
          }
          const son = tampon.indexOf(Buffer.from([0xff, 0xd9]), bas + 3);
          if (son < 0) {
            if (bas > 0) tampon = tampon.subarray(bas);
            break;
          }
          this.kareGeldi(kimlik, tampon.subarray(bas, son + 2));
          tampon = tampon.subarray(son + 2);
        }
        if (tampon.length > 8 * 1024 * 1024) tampon = Buffer.alloc(0);
      });
      surec.on('exit', () => {
        if (this.akis && this.akis.surec === surec) this.akis = null;
      });
      this.akis = { kimlik, surec };
    } else {
      // Android: adb ekran görüntüsü döngüsü (saniyede birkaç kare)
      const adb = adbBul(this.env);
      if (!adb) throw new Error('adb bulunamadı');
      const akis = { kimlik, dur: false };
      const dongu = async () => {
        while (!akis.dur) {
          const veri = await new Promise((coz) => {
            const c = spawn(adb, ['-s', kimlik, 'exec-out', 'screencap', '-p'], { env: this.env, stdio: ['ignore', 'pipe', 'ignore'] });
            const parca = [];
            c.stdout.on('data', (d) => parca.push(d));
            c.on('close', () => coz(Buffer.concat(parca)));
            c.on('error', () => coz(null));
          });
          if (akis.dur) break;
          if (veri && veri.length > 100) this.kareGeldi(kimlik, veri, 'image/png');
          await new Promise((r) => setTimeout(r, 150));
        }
      };
      dongu();
      this.akis = akis;
    }
  }

  akisDurdur() {
    const a = this.akis;
    this.akis = null;
    if (!a) return;
    if (a.surec) {
      try {
        a.surec.kill('SIGTERM');
      } catch {
        /* zaten kapandı */
      }
    } else a.dur = true;
  }

  // ---------- etkileşim (oran 0..1 ya da cihaz birimi) ----------
  async noktaya(kimlik, x, y, oran) {
    if (!oran) return [Math.round(x), Math.round(y)];
    const o = await this.ekranOlcusu(kimlik);
    return [Math.round(x * o.w), Math.round(y * o.h)];
  }

  async dokun(kimlik, { x, y, oran = false, etiket = '' }) {
    if (Simulator.ios(kimlik)) {
      if (etiket) return this.axeCalis(['tap', '--label', String(etiket), '--udid', kimlik, '--wait-timeout', '3']);
      const [px, py] = await this.noktaya(kimlik, x, y, oran);
      return this.axeCalis(['tap', '-x', String(px), '-y', String(py), '--udid', kimlik]);
    }
    const [px, py] = await this.noktaya(kimlik, x, y, oran);
    return this.adbCalis(['-s', kimlik, 'shell', 'input', 'tap', String(px), String(py)]);
  }

  async kaydir(kimlik, { x1, y1, x2, y2, oran = false, sure = 0.3 }) {
    const [ax, ay] = await this.noktaya(kimlik, x1, y1, oran);
    const [bx, by] = await this.noktaya(kimlik, x2, y2, oran);
    if (Simulator.ios(kimlik)) return this.axeCalis(['swipe', '--start-x', String(ax), '--start-y', String(ay), '--end-x', String(bx), '--end-y', String(by), '--duration', String(sure), '--udid', kimlik]);
    return this.adbCalis(['-s', kimlik, 'shell', 'input', 'swipe', String(ax), String(ay), String(bx), String(by), String(Math.round(sure * 1000))]);
  }

  async yaz(kimlik, metin) {
    const m = String(metin || '');
    if (!m) return '';
    // metin "-" ile başlasa bile bayrak sanılmasın: standart girdiden verilir
    if (Simulator.ios(kimlik)) return this.axeCalis(['type', '--stdin', '--udid', kimlik], 60000, m);
    // adb input text boşlukları %s ister, özel karakterler kaçırılır
    return this.adbCalis(['-s', kimlik, 'shell', 'input', 'text', m.replace(/([\\'"`$&|;<>()])/g, '\\$1').replace(/ /g, '%s')]);
  }

  // Donanım tuşu: ana ekran, kilit, ses; Android'de geri de vardır
  async tus(kimlik, tus) {
    if (Simulator.ios(kimlik)) {
      const ad = { anaEkran: 'home', kilit: 'lock', siri: 'siri', yan: 'side-button', applePay: 'apple-pay' }[tus] || tus;
      return this.axeCalis(['button', ad, '--udid', kimlik]);
    }
    const kod = { anaEkran: 'KEYCODE_HOME', geri: 'KEYCODE_BACK', kilit: 'KEYCODE_POWER', uygulamalar: 'KEYCODE_APP_SWITCH', enter: 'KEYCODE_ENTER', sil: 'KEYCODE_DEL' }[tus] || tus;
    return this.adbCalis(['-s', kimlik, 'shell', 'input', 'keyevent', kod]);
  }

  // Ekrandaki öğeler: etiket, tür ve konum (nokta). Ajanlar dokunacakları yeri buradan bulur.
  async ogeler(kimlik) {
    if (!Simulator.ios(kimlik)) {
      await this.adbCalis(['-s', kimlik, 'shell', 'uiautomator', 'dump', '/sdcard/ofis-ui.xml']);
      const xml = await this.adbCalis(['-s', kimlik, 'exec-out', 'cat', '/sdcard/ofis-ui.xml']);
      return [...xml.matchAll(/<node [^>]*?text="([^"]*)"[^>]*?class="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?clickable="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
        .map((m) => ({ etiket: m[1] || m[3], tur: m[2].split('.').pop(), tiklanir: m[4] === 'true', x: Math.round((+m[5] + +m[7]) / 2), y: Math.round((+m[6] + +m[8]) / 2) }))
        .filter((x) => x.etiket || x.tiklanir)
        .slice(0, 150);
    }
    const agac = JSON.parse(await this.axeCalis(['describe-ui', '--udid', kimlik]));
    const sonuc = [];
    const yuru = (d) => {
      for (const n of Array.isArray(d) ? d : [d]) {
        if (!n || typeof n !== 'object') continue;
        const f = n.frame || {};
        const etiket = n.AXLabel || n.AXValue || n.title || '';
        if (etiket || /Button|TextField|Cell|Switch|Link/.test(n.type || '')) sonuc.push({ etiket: String(etiket).slice(0, 80), tur: n.type || n.role, kimlik: n.AXUniqueId || undefined, x: Math.round((f.x || 0) + (f.width || 0) / 2), y: Math.round((f.y || 0) + (f.height || 0) / 2) });
        if (n.children) yuru(n.children);
      }
    };
    yuru(agac);
    return sonuc.slice(0, 200);
  }

  // Simülatörde yüklü uygulamalar (kullanıcının kurdukları): paket kimliği ve adı
  async uygulamalar(udid) {
    const s = await calistir('/usr/bin/xcrun', ['simctl', 'listapps', String(udid)], { env: this.env, zamanAsimi: 20000 });
    if (s.kod !== 0) throw new Error((s.hata || '').trim() || 'Uygulamalar okunamadı');
    const j = await calistir('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '-'], { env: this.env, girdi: s.cikti, zamanAsimi: 10000 });
    const veri = JSON.parse(j.cikti || '{}');
    return Object.entries(veri)
      .filter(([, v]) => v.ApplicationType === 'User')
      .map(([kimlik, v]) => ({ paket: kimlik, ad: v.CFBundleDisplayName || v.CFBundleName || kimlik, url: (v.CFBundleURLTypes || []).flatMap((u) => u.CFBundleURLSchemes || []).slice(0, 4) }));
  }
}

// Gömülü AXe'nin yeri: paketlenmiş uygulamada Resources/axe, geliştirmede paket/axe
export function axeYolu({ paketli, kaynaklar, kok }) {
  return paketli ? path.join(kaynaklar, 'axe', 'axe') : path.join(kok, 'paket', 'axe', 'axe');
}

// ---------- ajan araçları ----------
const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });
const cihazAlani = yazi('Cihaz: iOS simülatörünün kimliği (ios_cihazlar) ya da Android cihazın seri numarası (android_cihazlar)');

// Sahibin arayüzde de gördüğü aynı cihazı kullanır: canlı görüntü Simülatör sayfasında akar.
export function cihazAraclari(sim) {
  return {
    cihaz_ogeler: {
      aciklama: 'Cihaz ekranındaki öğeleri listeler: etiket, tür ve dokunulacak nokta (x, y). Dokunmadan önce bunu çağır.',
      sema: nesne({ cihaz: cihazAlani }, ['cihaz']),
      calistir: async (g) => sim.ogeler(String(g.cihaz)),
    },
    cihaz_dokun: {
      aciklama: 'Ekrana dokunur: etiket verilirse o öğeye (iOS), yoksa x, y noktasına (cihaz_ogeler listesindeki değerler).',
      sema: nesne({ cihaz: cihazAlani, x: { type: 'number' }, y: { type: 'number' }, etiket: yazi('Öğenin erişilebilirlik etiketi, ör. Giriş yap') }, ['cihaz']),
      calistir: async (g) => (await sim.dokun(String(g.cihaz), { x: g.x, y: g.y, etiket: g.etiket ? String(g.etiket) : '' }), 'Dokunuldu.'),
    },
    cihaz_kaydir: {
      aciklama: 'Ekranda bir noktadan diğerine kaydırır (liste kaydırma, sayfa geçişi).',
      sema: nesne({ cihaz: cihazAlani, x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' }, sure: { type: 'number', description: 'Saniye (varsayılan 0.3)' } }, ['cihaz', 'x1', 'y1', 'x2', 'y2']),
      calistir: async (g) => (await sim.kaydir(String(g.cihaz), { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, sure: g.sure || 0.3 }), 'Kaydırıldı.'),
    },
    cihaz_yaz: {
      aciklama: 'Odaktaki alana yazı yazar (önce alana dokun).',
      sema: nesne({ cihaz: cihazAlani, metin: yazi('Yazılacak metin') }, ['cihaz', 'metin']),
      calistir: async (g) => (await sim.yaz(String(g.cihaz), String(g.metin)), 'Yazıldı.'),
    },
    cihaz_tus: {
      aciklama: 'Donanım tuşu: anaEkran, kilit; Android\'de ayrıca geri, uygulamalar, enter, sil.',
      sema: nesne({ cihaz: cihazAlani, tus: { type: 'string', enum: ['anaEkran', 'kilit', 'geri', 'uygulamalar', 'enter', 'sil'] } }, ['cihaz', 'tus']),
      calistir: async (g) => (await sim.tus(String(g.cihaz), String(g.tus)), 'Basıldı.'),
    },
    ios_uygulamalar: {
      aciklama: 'iOS simülatöründe yüklü uygulamaları paket kimliği ve URL şemalarıyla listeler. Projenin uygulamasını açmak için ios_baslat ile paket kimliğini kullan; web adresini Safari\'de açma.',
      sema: nesne({ udid: yazi('Simülatörün kimliği') }, ['udid']),
      calistir: async (g) => sim.uygulamalar(String(g.udid)),
    },
  };
}

export const CIHAZ_ARAC_ADLARI = ['cihaz_ogeler', 'cihaz_dokun', 'cihaz_kaydir', 'cihaz_yaz', 'cihaz_tus', 'ios_uygulamalar'];
