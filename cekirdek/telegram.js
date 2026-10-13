// Telegram botu: resmi Bot API ile, uzun yoklamayla (getUpdates) çalışır. Dışarıya açık bir adres gerekmez.
// Bot başkasına ilk mesajı atamaz: kişi bota bir kez yazmalıdır. Bu yüzden her kişiye bir bağlantı kodu verilir
// (t.me/<bot>?start=<kod>). Kodu getiren sohbet o kişiye bağlanır. Tanınmayan sohbetlerin mesajları yok sayılır.
// Yapay zekâ Telegram'ı okumaz: yalnızca tanınan kişilerin mesajları beyne iletilir.
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.telegram.org';
const EN_BUYUK = 20 * 1024 * 1024; // Bot API'nin indirme sınırı
const guvenliAd = (ad) => String(ad || 'dosya').replace(/[^\w.\- ]+/g, '_').slice(0, 80);
const RESIM = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VIDEO = new Set(['.mp4', '.mov']);
const SES = new Set(['.mp3', '.m4a', '.ogg', '.opus', '.wav']);

export class TelegramBotu {
  // ad: botun uygulamadaki adı (beyin ya da proje kimliği). medya: gelen dosyaların klasörü.
  // mesaj({ sohbet, kimden, kullanici, metin, baslangic, ses, dosyalar }): gelen mesaj. degisti(durum): durum değişince.
  constructor({ ad, token, medya, mesaj, degisti, gunluk }) {
    this.ad = ad;
    this.token = token;
    this.medya = medya;
    this.mesajGeldi = mesaj;
    this.degisti = degisti || (() => {});
    this.gunluk = gunluk || (() => {});
    this.durum = { baglanti: 'kapali', kullanici: '', hata: '' }; // kapali | baglaniyor | bagli | hata
    this.ofset = 0;
    this.calisiyor = false;
    this.kontrol = null;
  }

  ayarla(d) {
    this.durum = { ...this.durum, ...d };
    this.degisti({ ...this.durum });
  }

  async istek(yontem, govde, { zamanAsimi = 20000, form = null } = {}) {
    this.kontrol = new AbortController();
    const z = setTimeout(() => this.kontrol.abort(), zamanAsimi);
    try {
      const r = await fetch(`${API}/bot${this.token}/${yontem}`, form ? { method: 'POST', body: form, signal: this.kontrol.signal } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(govde || {}), signal: this.kontrol.signal });
      const j = await r.json();
      if (!j.ok) throw new Error(j.description || `Telegram hatası (${r.status})`);
      return j.result;
    } finally {
      clearTimeout(z);
    }
  }

  async baslat() {
    if (this.calisiyor) return;
    this.calisiyor = true;
    this.ayarla({ baglanti: 'baglaniyor', hata: '' });
    try {
      const ben = await this.istek('getMe');
      this.ayarla({ baglanti: 'bagli', kullanici: ben.username || '', hata: '' });
    } catch (e) {
      this.calisiyor = false;
      this.ayarla({ baglanti: 'hata', hata: String(e.message || e).slice(0, 200) });
      return;
    }
    this.dongu();
  }

  durdur() {
    this.calisiyor = false;
    try {
      if (this.kontrol) this.kontrol.abort();
    } catch {
      /* zaten bitti */
    }
    this.ayarla({ baglanti: 'kapali' });
  }

  async dongu() {
    let bekle = 1000;
    while (this.calisiyor) {
      try {
        const guncel = await this.istek('getUpdates', { offset: this.ofset, timeout: 25, allowed_updates: ['message'] }, { zamanAsimi: 35000 });
        bekle = 1000;
        if (this.durum.baglanti !== 'bagli') this.ayarla({ baglanti: 'bagli', hata: '' });
        for (const g of guncel) {
          this.ofset = g.update_id + 1;
          if (g.message) await this.isle(g.message).catch((e) => this.gunluk('telegram mesajı işlenemedi', String(e.message || e)));
        }
      } catch (e) {
        if (!this.calisiyor) break;
        const neden = String(e.message || e);
        // belirteç geçersizse durulur; ağ hatasında artan beklemeyle yeniden denenir
        if (/unauthorized|not found/i.test(neden)) {
          this.calisiyor = false;
          this.ayarla({ baglanti: 'hata', hata: neden.slice(0, 200) });
          break;
        }
        this.ayarla({ baglanti: 'baglaniyor', hata: neden.slice(0, 200) });
        await new Promise((r) => setTimeout(r, bekle));
        bekle = Math.min(60000, bekle * 2);
      }
    }
  }

  async isle(m) {
    if (!m.chat || m.chat.type !== 'private') return; // gruplar yok sayılır
    const metinHam = String(m.text || m.caption || '');
    const baslangic = /^\/start(?:\s+(\S+))?/.exec(metinHam);
    const dosyalar = [];
    let ses = null;
    const kaydet = async (fileId, ad, tur) => {
      const f = await this.istek('getFile', { file_id: fileId });
      if (!f.file_path || (f.file_size || 0) > EN_BUYUK) return dosyalar.push({ tur, yol: '', ad, buyuk: true });
      const r = await fetch(`${API}/file/bot${this.token}/${f.file_path}`);
      const veri = Buffer.from(await r.arrayBuffer());
      const klasor = path.join(this.medya, new Date().toISOString().slice(0, 10));
      fs.mkdirSync(klasor, { recursive: true });
      const yol = path.join(klasor, `${m.message_id}-${guvenliAd(ad)}`);
      fs.writeFileSync(yol, veri);
      dosyalar.push({ tur, yol, ad });
      return veri;
    };
    if (Array.isArray(m.photo) && m.photo.length) await kaydet(m.photo[m.photo.length - 1].file_id, 'foto.jpg', 'foto');
    if (m.document) await kaydet(m.document.file_id, m.document.file_name || 'belge', 'belge');
    if (m.video) await kaydet(m.video.file_id, m.video.file_name || 'video.mp4', 'video');
    if (m.voice || m.audio) {
      const x = m.voice || m.audio;
      const f = await this.istek('getFile', { file_id: x.file_id });
      if (f.file_path && (f.file_size || 0) <= EN_BUYUK) {
        const r = await fetch(`${API}/file/bot${this.token}/${f.file_path}`);
        ses = { veri: Buffer.from(await r.arrayBuffer()), mime: x.mime_type || 'audio/ogg' };
      }
    }
    if (!metinHam && !dosyalar.length && !ses) return;
    this.mesajGeldi({
      bot: this.ad,
      sohbet: String(m.chat.id),
      kimden: [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' '),
      kullanici: (m.from && m.from.username) || '',
      metin: baslangic ? '' : metinHam,
      baslangic: baslangic ? baslangic[1] || '' : null,
      ses,
      dosyalar,
    });
  }

  // metin ya da dosya gönderir. dosya: tam yol (isteğe bağlı), metin o zaman açıklama olur.
  async gonder(sohbet, metin, dosya = '') {
    if (!this.calisiyor || this.durum.baglanti === 'hata') throw new Error('Telegram botu bağlı değil.');
    if (!dosya) {
      // Telegram mesaj sınırı 4096 karakter: uzun metin parçalanır
      const parca = String(metin).match(/[\s\S]{1,4000}/g) || [''];
      for (const p of parca) await this.istek('sendMessage', { chat_id: sohbet, text: p });
      return { tamam: true };
    }
    const yol = path.resolve(String(dosya));
    let st;
    try {
      st = fs.statSync(yol);
    } catch {
      throw new Error('Dosya bulunamadı: ' + dosya);
    }
    if (!st.isFile() || st.size > 50 * 1024 * 1024) throw new Error('Dosya 50 MB\'tan büyük ya da geçersiz.');
    const uz = path.extname(yol).toLowerCase();
    const [yontem, alan] = RESIM.has(uz) ? ['sendPhoto', 'photo'] : VIDEO.has(uz) ? ['sendVideo', 'video'] : SES.has(uz) ? ['sendAudio', 'audio'] : ['sendDocument', 'document'];
    const form = new FormData();
    form.append('chat_id', String(sohbet));
    if (metin) form.append('caption', String(metin).slice(0, 1000));
    form.append(alan, new Blob([fs.readFileSync(yol)]), path.basename(yol));
    await this.istek(yontem, null, { form, zamanAsimi: 120000 });
    return { tamam: true };
  }
}

