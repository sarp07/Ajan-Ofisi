// Uygulama güncellemeleri: GitHub sürümlerinden kontrol, sahibin onayıyla indirme ve yeniden başlatınca kurma.
// Yalnızca paketlenmiş uygulamada çalışır. Geliştirme sırasında (npm start) kontrol yapılmaz.
// Ertelenen ya da atlanan sürüm ve "neler yeni" bilgisi uygulamanın veri klasöründe küçük bir dosyada tutulur.
import fs from 'node:fs';
import path from 'node:path';
import electronUpdater from 'electron-updater';
import { notMetni } from './surum-notu.js';

const { autoUpdater } = electronUpdater;
const ARALIK = 30 * 60 * 1000; // 30 dakikada bir; ayrıca pencere öne gelince ve internet dönünce bakılır
const TAZE = 10 * 60 * 1000; // odakta en çok 10 dakikada bir
const YENIDEN = 5 * 60 * 1000; // sürüm dosyaları henüz yüklenmediyse ya da internet yoksa 5 dakika sonra yeniden
const ERTELE = 24 * 60 * 60 * 1000; // "sonra" denince 1 gün sorulmaz

// Güncelleme hatasını sahibin anlayacağı bir koda çevirir. Ham ileti yine saklanır (ayrıntı için).
// hazirlaniyor: sürüm yayımlandı ama dosyaları henüz yüklenmedi (latest-*.yml ya da paket 404). baglanti: internet yok.
function hataDurumu(e) {
  const ileti = String((e && e.message) || e).split('\n')[0].slice(0, 300);
  const kod = /latest[\w-]*\.yml|404|Cannot find/i.test(ileti) ? 'hazirlaniyor' : /ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|net::ERR|network/i.test(ileti) ? 'baglanti' : /signature|code sign|checksum|sha512/i.test(ileti) ? 'dogrulama' : 'genel';
  return { asama: 'hata', hata: ileti, hataKod: kod };
}

export class Guncelleyici {
  // app: Electron app. degisti(durum): arayüze bildirim. dikkat(durum): pencere arkadayken sahibin dikkatini çeker.
  constructor({ app, dosya, degisti, dikkat }) {
    this.app = app;
    this.dosya = dosya;
    this.degisti = degisti;
    this.dikkat = dikkat;
    this.durum = { asama: 'bos', surum: '', notlar: '', yuzde: 0, hata: '', mevcut: app.getVersion(), etkin: app.isPackaged };
    this.kayit = this.oku();
    this.zaman = null;
  }

  oku() {
    try {
      return JSON.parse(fs.readFileSync(this.dosya, 'utf8')) || {};
    } catch {
      return {};
    }
  }

  yaz() {
    try {
      fs.mkdirSync(path.dirname(this.dosya), { recursive: true });
      fs.writeFileSync(this.dosya, JSON.stringify(this.kayit, null, 2));
    } catch {
      /* yazılamazsa yalnızca hatırlatma tekrar gelir */
    }
  }

  ayarla(yama) {
    Object.assign(this.durum, yama);
    this.degisti({ ...this.durum });
  }

  // Bu sürüme yeni geçildiyse "neler yeni" bilgisini bir kez verir
  yenilikler() {
    const mevcut = this.app.getVersion();
    const onceki = this.kayit.sonSurum;
    this.kayit.sonSurum = mevcut;
    const notlar = this.kayit.bekleyenNotlar && this.kayit.bekleyenNotlar.surum === mevcut ? this.kayit.bekleyenNotlar.notlar : '';
    delete this.kayit.bekleyenNotlar;
    this.yaz();
    return onceki && onceki !== mevcut ? { onceki, surum: mevcut, notlar } : null;
  }

  baslat({ otomatik = true } = {}) {
    // Geliştirme aracı: AJAN_OFIS_GUNCELLEME_SINAMA=<sürüm> ise sahte bir yeni sürüm bildirilir (arayüzü denemek için)
    const sahte = process.env.AJAN_OFIS_GUNCELLEME_SINAMA;
    if (sahte) {
      setTimeout(() => {
        this.ayarla({ asama: 'var', surum: sahte, notlar: '## Yenilikler\n- Otomatik güncelleme\n- Yükleme animasyonları', etkin: true, sor: true });
        this.dikkat({ ...this.durum });
      }, Number(process.env.AJAN_OFIS_GUNCELLEME_BEKLE || 4000));
      return;
    }
    if (!this.app.isPackaged) return;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;
    autoUpdater.on('checking-for-update', () => this.ayarla({ asama: 'kontrol', hata: '' }));
    autoUpdater.on('update-not-available', () => this.ayarla({ asama: 'yok', kontrolZamani: Date.now() }));
    autoUpdater.on('update-available', (bilgi) => {
      const surum = String(bilgi.version || '');
      const notlar = notMetni(bilgi.releaseNotes);
      this.kayit.bekleyenNotlar = { surum, notlar };
      this.yaz();
      // sor: arayüz hazır olduğunda pencereyi kendisi açsın (sinyal kaçırılsa bile)
      const sor = this.sormaliMi(surum);
      this.ayarla({ asama: 'var', surum, notlar, tarih: bilgi.releaseDate || '', kontrolZamani: Date.now(), sor });
      if (sor) this.dikkat({ ...this.durum });
    });
    autoUpdater.on('download-progress', (p) => this.ayarla({ asama: 'iniyor', yuzde: Math.round(p.percent || 0) }));
    autoUpdater.on('update-downloaded', () => {
      this.ayarla({ asama: 'indi', yuzde: 100, sor: true });
      this.dikkat({ ...this.durum });
    });
    autoUpdater.on('error', (e) => this.ayarla(hataDurumu(e)));
    if (otomatik) this.otomatik(true);
  }

  otomatik(acik) {
    clearInterval(this.zaman);
    this.zaman = null;
    if (!acik || !this.app.isPackaged) return;
    setTimeout(() => this.kontrol(), 8000);
    this.zaman = setInterval(() => this.kontrol(), ARALIK);
  }

  // Atlanan ya da ertelenen sürüm için kendiliğinden pencere açılmaz (elle kontrolde açılır)
  sormaliMi(surum) {
    if (this.kayit.atlanan === surum) return false;
    if (this.kayit.ertele && this.kayit.ertele.surum === surum && Date.now() < this.kayit.ertele.z) return false;
    return true;
  }

  async kontrol() {
    if (!this.app.isPackaged) return { ...this.durum, asama: 'gelistirme' };
    if (this.durum.asama === 'iniyor' || this.durum.asama === 'indi') return { ...this.durum };
    this.sonKontrol = Date.now();
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      this.ayarla(hataDurumu(e));
    }
    // yayın yeni çıkmış (dosyalar yükleniyor) ya da internet yoksa kısa süre sonra yeniden dene
    if (this.durum.asama === 'hata' && ['hazirlaniyor', 'baglanti'].includes(this.durum.hataKod)) {
      clearTimeout(this.yeniden);
      this.yeniden = setTimeout(() => this.kontrol(), YENIDEN);
    }
    return { ...this.durum };
  }

  // Pencere öne gelince ya da internet dönünce: son kontrol eskiyse yeniden bak (uygulamayı kapatıp açmaya gerek kalmaz)
  tazele(enAz = TAZE) {
    if (!this.zaman) return;
    if (Date.now() - (this.sonKontrol || 0) < enAz) return;
    this.kontrol();
  }

  async indir() {
    if (this.durum.asama !== 'var' && this.durum.asama !== 'hata') return { ...this.durum };
    this.ayarla({ asama: 'iniyor', yuzde: 0, hata: '' });
    try {
      await autoUpdater.downloadUpdate();
    } catch (e) {
      this.ayarla(hataDurumu(e));
    }
    return { ...this.durum };
  }

  kur() {
    if (this.durum.asama !== 'indi') return false;
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return true;
  }

  sonra() {
    this.ayarla({ sor: false });
    if (this.durum.surum) {
      this.kayit.ertele = { surum: this.durum.surum, z: Date.now() + ERTELE };
      this.yaz();
    }
  }

  atla() {
    this.ayarla({ sor: false });
    if (this.durum.surum) {
      this.kayit.atlanan = this.durum.surum;
      this.yaz();
    }
  }
}
