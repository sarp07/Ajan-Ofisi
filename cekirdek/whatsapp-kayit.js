// WhatsApp hafızası: beynin konuşabildiği kişilerle (sahip, projelere kayıtlı kişiler, beynin yazdığı numaralar)
// olan mesajlar bilgisayarda yerel bir kayıtta tutulur. Başka sohbetler kaydedilmez. Kayıt dışarı gönderilmez.
import fs from 'node:fs';
import path from 'node:path';

const EN_BUYUK = 25 * 1024 * 1024; // kayıt bu boyutu geçince eski yarısı atılır
// numara tam haliyle saklanır (ülke koduyla), eşleştirme son 10 haneyle yapılır
const tam = (x) => String(x || '').replace(/\D/g, '');
const rakam = (x) => tam(x).slice(-10);

export class WhatsappKaydi {
  constructor(klasor) {
    this.klasor = klasor;
    fs.mkdirSync(klasor, { recursive: true });
    this.dosya = path.join(klasor, 'mesajlar.jsonl');
    this.durumDosya = path.join(klasor, 'durum.json');
    this.idler = new Set();
    this.mesajlar = [];
    try {
      for (const satir of fs.readFileSync(this.dosya, 'utf8').split('\n')) {
        if (!satir) continue;
        try {
          const m = JSON.parse(satir);
          if (m.id && !this.idler.has(m.id)) {
            this.idler.add(m.id);
            this.mesajlar.push(m);
          }
        } catch {
          /* bozuk satır atlanır */
        }
      }
    } catch {
      /* henüz kayıt yok */
    }
    this.mesajlar.sort((a, b) => a.z - b.z);
    try {
      this.durum = JSON.parse(fs.readFileSync(this.durumDosya, 'utf8'));
    } catch {
      this.durum = {};
    }
    if (!Array.isArray(this.durum.konusulan)) this.durum.konusulan = [];
  }

  durumYaz() {
    fs.writeFileSync(this.durumDosya, JSON.stringify(this.durum, null, 2));
  }

  // beynin yazdığı numara: cevapları da beyne gelir
  konusuldu(numara) {
    const r = rakam(numara);
    if (r.length < 7 || this.durum.konusulan.includes(r)) return;
    this.durum.konusulan.push(r);
    this.durumYaz();
  }

  // kayıtta görülen son ad (WhatsApp profil adı)
  adi(numara) {
    const r = rakam(numara);
    for (let i = this.mesajlar.length - 1; i >= 0; i--) if (rakam(this.mesajlar[i].numara) === r && this.mesajlar[i].kimden) return this.mesajlar[i].kimden;
    return '';
  }

  konusulduMu(numara) {
    const r = rakam(numara);
    return r.length >= 7 && this.durum.konusulan.includes(r);
  }

  // en son işlenen gelen mesajın zamanı: kapalıyken gelenler bundan sonrakilerdir
  get sonGelen() {
    return Number(this.durum.sonGelen) || 0;
  }

  set sonGelen(z) {
    if (z > this.sonGelen) {
      this.durum.sonGelen = z;
      this.durumYaz();
    }
  }

  // m: { id, z, numara, kimden, yon: 'gelen'|'giden', metin, dosyalar } — aynı mesaj iki kez yazılmaz
  ekle(m) {
    if (!m || !m.id || this.idler.has(m.id)) return false;
    const kayit = { id: String(m.id), z: Number(m.z) || Date.now(), numara: tam(m.numara), kimden: String(m.kimden || '').slice(0, 80), yon: m.yon === 'giden' ? 'giden' : 'gelen', metin: String(m.metin || '').slice(0, 8000), dosyalar: (m.dosyalar || []).map((d) => ({ tur: d.tur, ad: d.ad, yol: d.yol || '' })).slice(0, 10) };
    if (!kayit.metin && !kayit.dosyalar.length) return false;
    this.idler.add(kayit.id);
    this.mesajlar.push(kayit);
    if (this.mesajlar.length > 1 && this.mesajlar[this.mesajlar.length - 2].z > kayit.z) this.mesajlar.sort((a, b) => a.z - b.z);
    fs.appendFileSync(this.dosya, JSON.stringify(kayit) + '\n');
    this.kirp();
    return true;
  }

  kirp() {
    let boyut = 0;
    try {
      boyut = fs.statSync(this.dosya).size;
    } catch {
      return;
    }
    if (boyut <= EN_BUYUK) return;
    this.mesajlar = this.mesajlar.slice(Math.floor(this.mesajlar.length / 2));
    this.idler = new Set(this.mesajlar.map((m) => m.id));
    fs.writeFileSync(this.dosya, this.mesajlar.map((m) => JSON.stringify(m)).join('\n') + '\n');
  }

  // Geçmiş: numaraya, kelimeye ve tarihe göre süzülür, en yeniler döner (eskiden yeniye sıralı)
  ara({ numaralar = null, sorgu = '', son = 40, once = 0 } = {}) {
    const izin = numaralar ? new Set(numaralar.map(rakam)) : null;
    const q = String(sorgu || '').toLocaleLowerCase('tr').trim();
    const sonuc = [];
    for (let i = this.mesajlar.length - 1; i >= 0 && sonuc.length < Math.min(200, son || 40); i--) {
      const m = this.mesajlar[i];
      if (izin && !izin.has(rakam(m.numara))) continue;
      if (once && m.z >= once) continue;
      if (q && !(m.metin.toLocaleLowerCase('tr').includes(q) || m.kimden.toLocaleLowerCase('tr').includes(q))) continue;
      sonuc.push(m);
    }
    return sonuc.reverse();
  }

  // konuşulan kişiler: son mesaj zamanıyla
  kisiler(numaralar = null) {
    const izin = numaralar ? new Set(numaralar.map(rakam)) : null;
    const m = new Map();
    for (const x of this.mesajlar) {
      if (izin && !izin.has(rakam(x.numara))) continue;
      const anahtar = rakam(x.numara);
      const k = m.get(anahtar) || { numara: x.numara, kimden: '', adet: 0, son: 0 };
      if (x.numara.length > k.numara.length) k.numara = x.numara;
      k.adet++;
      k.son = Math.max(k.son, x.z);
      if (x.yon === 'gelen' && x.kimden) k.kimden = x.kimden;
      m.set(anahtar, k);
    }
    return [...m.values()].sort((a, b) => b.son - a.son);
  }
}
