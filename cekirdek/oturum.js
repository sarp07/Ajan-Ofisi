// Gömülü terminal oturumu: Claude Code'u uygulamanın içinde, gerçek bir sözde terminalde çalıştırır.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { komutHazirla } from './claude.js';

const require = createRequire(import.meta.url);
let ptyModul = null;
function pty() {
  if (!ptyModul) {
    yardimciIzni();
    ptyModul = require('node-pty');
  }
  return ptyModul;
}

// macOS ve Linux'ta node-pty küçük bir yardımcı program çalıştırır. Paketten çıkarken çalıştırma izni
// kaybolabildiği için ("posix_spawnp failed" hatası) izin her açılışta yeniden verilir.
function yardimciIzni() {
  if (process.platform === 'win32') return;
  try {
    const kok = path.dirname(require.resolve('node-pty/package.json'));
    const kokler = [kok, kok.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep)];
    for (const k of kokler) {
      const adaylar = [path.join(k, 'build', 'Release', 'spawn-helper')];
      try {
        for (const d of fs.readdirSync(path.join(k, 'prebuilds'))) adaylar.push(path.join(k, 'prebuilds', d, 'spawn-helper'));
      } catch {
        /* hazır derleme klasörü yok */
      }
      for (const a of adaylar) {
        try {
          fs.chmodSync(a, 0o755);
        } catch {
          /* dosya yok ya da salt okunur */
        }
      }
    }
  } catch {
    /* izin verilemese de deneme sürer */
  }
}

export class Oturum {
  constructor({ veri, cikis }) {
    this.veriCb = veri;
    this.cikisCb = cikis;
    this.surec = null;
    this.bilgi = null;
    this.tampon = '';
  }

  get acik() {
    return !!this.surec;
  }

  baslat({ yol, arg, cwd, env, sutun = 100, satir = 30, bilgi }) {
    if (this.surec) throw new Error('Zaten açık bir oturum var');
    const k = komutHazirla(yol, arg);
    this.tampon = '';
    this.bilgi = bilgi || null;
    const surec = pty().spawn(k.dosya, k.arg, {
      name: 'xterm-256color',
      cols: Math.max(20, sutun),
      rows: Math.max(5, satir),
      cwd,
      env: { ...env, TERM: 'xterm-256color', COLORTERM: 'truecolor', FORCE_COLOR: '3' },
    });
    this.surec = surec;
    surec.onData((d) => {
      // pencere yeniden yüklenirse son ekran geri verilebilsin
      this.tampon = (this.tampon + d).slice(-200000);
      this.veriCb(d);
    });
    surec.onExit(({ exitCode }) => {
      if (this.surec !== surec) return;
      const b = this.bilgi;
      this.surec = null;
      this.bilgi = null;
      this.cikisCb(exitCode, b);
    });
  }

  yaz(veri) {
    if (this.surec) this.surec.write(veri);
  }

  boyut(sutun, satir) {
    if (this.surec && sutun > 1 && satir > 1) {
      try {
        this.surec.resize(Math.floor(sutun), Math.floor(satir));
      } catch {
        /* kapanırken boyut değişimi */
      }
    }
  }

  durdur() {
    if (!this.surec) return;
    try {
      this.surec.kill();
    } catch {
      /* zaten kapanmış */
    }
  }
}
