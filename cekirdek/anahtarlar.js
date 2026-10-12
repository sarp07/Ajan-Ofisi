// API anahtarları: işletim sisteminin şifreli deposuyla (Electron safeStorage) şifrelenip uygulamanın veri klasöründe durur.
// Anahtarlar arayüze hiç gönderilmez. Arayüz yalnızca "kayıtlı mı" bilgisini görür.
import fs from 'node:fs';
import path from 'node:path';

export class AnahtarDeposu {
  // sifreleyici: { kullanilabilir(), sifrele(metin) -> Buffer, coz(Buffer) -> metin }
  constructor(dosya, sifreleyici) {
    this.dosya = dosya;
    this.s = sifreleyici;
    this.veri = {};
    try {
      const ham = JSON.parse(fs.readFileSync(dosya, 'utf8'));
      if (ham && typeof ham === 'object') this.veri = ham;
    } catch {
      this.veri = {};
    }
  }

  kullanilabilir() {
    return this.s.kullanilabilir();
  }

  var(ad) {
    return typeof this.veri[ad] === 'string' && this.veri[ad].length > 0;
  }

  al(ad) {
    if (!this.var(ad) || !this.kullanilabilir()) return '';
    try {
      return this.s.coz(Buffer.from(this.veri[ad], 'base64'));
    } catch {
      return '';
    }
  }

  koy(ad, deger) {
    const temiz = String(deger || '').trim();
    if (!temiz) {
      delete this.veri[ad];
    } else {
      if (!this.kullanilabilir()) throw new Error('Bu sistemde şifreli depo kullanılamıyor');
      this.veri[ad] = this.s.sifrele(temiz).toString('base64');
    }
    fs.mkdirSync(path.dirname(this.dosya), { recursive: true });
    fs.writeFileSync(this.dosya, JSON.stringify(this.veri), { mode: 0o600 });
  }

  durum() {
    return { claude: this.var('claude'), codex: this.var('codex'), elevenlabs: this.var('elevenlabs') };
  }
}
