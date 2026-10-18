// WhatsApp bağlantısı: tarayıcı ya da ekran okuma olmadan, WhatsApp'ın bağlı cihaz bağlantısıyla çalışır.
// Beynin numarası bir kez QR ile bağlanır (WhatsApp > Bağlı cihazlar). Gelen mesajlar anında olay olarak gelir,
// gönderim doğrudan yapılır. Yapay zekâ WhatsApp'ı genel olarak okumaz: yalnızca sahibin, projelere kayıtlı kişilerin ve
// beynin yazdığı numaraların mesajları beyne iletilir ve hafızaya (yerel kayıt) yazılır; başka sohbetlere dokunulmaz.
// Oturum anahtarları uygulamanın veri klasöründe durur. "Çıkış" bağlı cihazı WhatsApp'tan da kaldırır.
import fs from 'node:fs';
import path from 'node:path';

// Gönderilecek dosyanın türü uzantıdan çıkar: fotoğraf, video, ses ya da belge
const RESIM = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const VIDEO = { '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const SES = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav' };
const BELGE = { '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.json': 'application/json', '.zip': 'application/zip', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const EN_BUYUK = 64 * 1024 * 1024;
const uzantiMime = (mime) => ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'application/pdf': '.pdf' })[String(mime || '').split(';')[0]] || '';
const guvenliAd = (ad) => String(ad || 'dosya').replace(/[^\w.\- ]+/g, '_').slice(0, 80);

const sessiz = { level: 'silent', child: () => sessiz, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} };
const rakamlar = (x) => String(x || '').split('@')[0].split(':')[0].replace(/\D/g, '');

export class WhatsappBaglantisi {
  // klasor: oturum anahtarlarının klasörü. degisti(durum): durum değişince. mesaj({ kimden, numara, metin, ses }): gelen mesaj.
  // medya: gelen fotoğraf ve dosyaların kaydedildiği klasör. kucukResim(yol): önizleme için küçük JPEG (Buffer) ya da null.
  // gecmis(liste): bağlanınca WhatsApp'ın gönderdiği eski mesajlar (yalnızca metin, kaydetmek için)
  // gonderildi({ id, numara, metin, dosya }): beynin gönderdiği mesaj (hafızaya yazılır)
  constructor({ klasor, medya, kucukResim, degisti, mesaj, gecmis, gonderildi }) {
    this.gecmisGeldi = gecmis || (() => {});
    this.gonderildi = gonderildi || (() => {});
    this.klasor = klasor;
    this.medya = medya;
    this.kucukResim = kucukResim || (() => null);
    this.degisti = degisti;
    this.mesajGeldi = mesaj;
    this.durum = { baglanti: 'kapali', qr: '', numara: '', hata: '' }; // kapali | baglaniyor | qr | bagli
    this.soket = null;
    this.gonderilen = new Set(); // kendi gönderdiğimiz mesajlar: kendine mesaj sohbetinde geri dönmesin
    this.yeniden = 0;
  }

  kayitliMi() {
    return fs.existsSync(`${this.klasor}/creds.json`);
  }

  ayarla(d) {
    this.durum = { ...this.durum, ...d };
    this.degisti({ ...this.durum });
  }

  async baslat() {
    if (this.soket) return;
    this.durduruldu = false;
    this.ayarla({ baglanti: 'baglaniyor', hata: '' });
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion, downloadMediaMessage } = await import('@whiskeysockets/baileys');
    const QR = (await import('qrcode')).default;
    fs.mkdirSync(this.klasor, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(this.klasor);
    let surum;
    try {
      surum = (await fetchLatestBaileysVersion()).version;
    } catch {
      surum = undefined; // kütüphanenin bildiği sürüm kullanılır
    }
    const soket = makeWASocket({ auth: state, logger: sessiz, browser: Browsers.macOS('Ajan Ofisi'), printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false, shouldSyncHistoryMessage: () => true, ...(surum ? { version: surum } : {}) });
    this.soket = soket;
    soket.ev.on('creds.update', saveCreds);
    soket.ev.on('connection.update', async (g) => {
      if (g.qr) this.ayarla({ baglanti: 'qr', qr: await QR.toDataURL(g.qr, { margin: 1, width: 280 }) });
      if (g.connection === 'open') {
        this.yeniden = 0;
        this.ayarla({ baglanti: 'bagli', qr: '', numara: rakamlar(soket.user && soket.user.id), hata: '' });
      }
      if (g.connection === 'close') {
        if (this.soket && this.soket !== soket) return; // yerine yenisi açılmış eski bağlantı
        this.soket = null;
        const kod = g.lastDisconnect && g.lastDisconnect.error && g.lastDisconnect.error.output && g.lastDisconnect.error.output.statusCode;
        if (this.durduruldu) return this.ayarla({ baglanti: 'kapali', qr: '' });
        // QR okutulmadan süresi doldu: arka planda sonsuza dek yeni kod üretme, sahip yeniden "Bağla" der
        if (!state.creds.me && kod !== DisconnectReason.restartRequired) {
          fs.rmSync(this.klasor, { recursive: true, force: true });
          return this.ayarla({ baglanti: 'kapali', qr: '', hata: 'qrSuresi' });
        }
        if (kod === DisconnectReason.loggedOut) {
          // telefon tarafından bağlı cihaz kaldırıldı: anahtarlar geçersiz
          fs.rmSync(this.klasor, { recursive: true, force: true });
          this.ayarla({ baglanti: 'kapali', qr: '', numara: '', hata: 'cikisYapildi' });
          return;
        }
        // ağ koptu ya da WhatsApp yeniden başlatma istedi: artan beklemeyle yeniden bağlan
        this.ayarla({ baglanti: 'baglaniyor', qr: '' });
        const bekle = Math.min(60000, 1000 * 2 ** this.yeniden++);
        setTimeout(() => this.baslat().catch((e) => this.ayarla({ baglanti: 'kapali', hata: String(e.message || e) })), bekle);
      }
    });
    // Mesajın içeriği: metin, sesli mesaj ve ekler. medyaIndir false ise dosyalar indirilmez (geçmiş senkronu)
    const ayikla = async (m, medyaIndir = true) => {
      if (!m.message) return null;
      const sohbet = m.key.remoteJid || '';
      if (sohbet.endsWith('@g.us') || sohbet === 'status@broadcast' || sohbet.endsWith('@newsletter')) return null;
      // numara: yeni WhatsApp sürümleri sohbeti gizli kimlikle (@lid) verir, telefon numarası ek alandadır
      const tel = [m.key.remoteJidAlt, m.key.senderPn, sohbet].find((j) => j && /@s\.whatsapp\.net$/.test(j));
      const numara = rakamlar(tel || sohbet);
      const kendi = rakamlar(soket.user && soket.user.id);
      const ic = m.message.ephemeralMessage ? m.message.ephemeralMessage.message : m.message;
      if (!ic) return null;
      let metin = ic.conversation || (ic.extendedTextMessage && ic.extendedTextMessage.text) || (ic.imageMessage && ic.imageMessage.caption) || '';
      let ses = null;
      if (ic.audioMessage && medyaIndir) ses = { veri: await downloadMediaMessage(m, 'buffer', {}), mime: ic.audioMessage.mimetype || 'audio/ogg' };
      else if (ic.audioMessage) metin = metin || '(sesli mesaj)';
      // fotoğraf, video ve belgeler diske kaydedilir; beyne dosya yolu verilir, beyin dosyayı kendisi açıp bakar
      const dosyalar = [];
      const medya = [
        ['foto', ic.imageMessage],
        ['video', ic.videoMessage],
        ['belge', ic.documentMessage || (ic.documentWithCaptionMessage && ic.documentWithCaptionMessage.message && ic.documentWithCaptionMessage.message.documentMessage)],
      ].find(([, x]) => x);
      if (medya) {
        const [tur, x] = medya;
        if (!metin && x.caption) metin = x.caption;
        if (!medyaIndir) dosyalar.push({ tur, yol: '', ad: x.fileName || tur, mime: x.mimetype || '' });
        else if (Number(x.fileLength || 0) <= EN_BUYUK) {
          const gun = new Date().toISOString().slice(0, 10);
          const klasor = path.join(this.medya, gun);
          fs.mkdirSync(klasor, { recursive: true });
          const ad = tur === 'belge' && x.fileName ? guvenliAd(x.fileName) : `${tur}${uzantiMime(x.mimetype) || (tur === 'foto' ? '.jpg' : tur === 'video' ? '.mp4' : '')}`;
          const yol = path.join(klasor, `${String(m.key.id).replace(/\W/g, '').slice(0, 24)}-${ad}`);
          fs.writeFileSync(yol, await downloadMediaMessage(m, 'buffer', {}));
          dosyalar.push({ tur, yol, ad: x.fileName || ad, mime: x.mimetype || '' });
        } else dosyalar.push({ tur, yol: '', ad: x.fileName || tur, mime: x.mimetype || '', buyuk: true });
      }
      if (!metin && !ses && !dosyalar.length) return null;
      const zs = Number(m.messageTimestamp && m.messageTimestamp.toNumber ? m.messageTimestamp.toNumber() : m.messageTimestamp) || 0;
      return { id: m.key.id, z: zs ? zs * 1000 : Date.now(), kimden: m.pushName || '', numara, sohbet, metin, ses, dosyalar, benden: !!m.key.fromMe, kendine: numara === kendi };
    };

    // notify: canlı mesaj. append: bağlantı kapalıyken gelip sonradan teslim edilenler. İkisi de işlenir;
    // ana süreç zamanına bakarak kapalıyken gelenleri ayırır.
    soket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const m of messages) {
        try {
          if (this.gonderilen.has(m.key.id)) continue;
          const x = await ayikla(m);
          if (!x) continue;
          this.mesajGeldi({ ...x, canli: type === 'notify' });
        } catch {
          /* tek bir mesaj okunamadıysa diğerleri yine işlenir */
        }
      }
    });
    // bağlanınca WhatsApp yakın geçmişi gönderir: yalnızca metni alınır (dosya indirilmez), kayıt için ana sürece verilir
    soket.ev.on('messaging-history.set', async ({ messages }) => {
      const liste = [];
      for (const m of messages || []) {
        try {
          const x = await ayikla(m, false);
          if (x) liste.push(x);
        } catch {
          /* okunamayan mesaj atlanır */
        }
      }
      if (liste.length) this.gecmisGeldi(liste);
    });
  }

  async durdur() {
    this.durduruldu = true;
    const s = this.soket;
    this.soket = null;
    if (s) s.end(undefined);
    this.ayarla({ baglanti: 'kapali', qr: '' });
  }

  // Bağlı cihazı WhatsApp'tan kaldırır ve anahtarları siler
  async cikis() {
    this.durduruldu = true;
    const s = this.soket;
    this.soket = null;
    try {
      if (s) await s.logout();
    } catch {
      /* bağlantı zaten kopuksa yerel anahtarları silmek yeter */
    }
    fs.rmSync(this.klasor, { recursive: true, force: true });
    this.ayarla({ baglanti: 'kapali', qr: '', numara: '', hata: '' });
  }

  // hedef: telefon numarası (ülke koduyla) ya da sohbet kimliği. dosya: gönderilecek dosyanın tam yolu (isteğe bağlı),
  // metin o zaman açıklama olur.
  async gonder(hedef, metin, dosya = '') {
    if (!this.soket || this.durum.baglanti !== 'bagli') throw new Error('WhatsApp bağlı değil. Ayarlar > Beyin bölümünden bağla.');
    let jid = String(hedef);
    if (!jid.includes('@')) {
      const n = rakamlar(jid);
      if (n.length < 7) throw new Error('Geçersiz numara: ' + hedef);
      const [kayit] = await this.soket.onWhatsApp(n);
      if (!kayit || !kayit.exists) throw new Error('Bu numara WhatsApp kullanmıyor: ' + hedef);
      jid = kayit.jid;
    }
    const r = await this.soket.sendMessage(jid, dosya ? this.dosyaIcerigi(dosya, metin) : { text: String(metin) });
    if (r && r.key && r.key.id) {
      this.gonderilen.add(r.key.id);
      if (this.gonderilen.size > 500) this.gonderilen.delete(this.gonderilen.values().next().value);
    }
    const numara = jid.endsWith('@lid') ? rakamlar(hedef) : rakamlar(jid);
    try {
      this.gonderildi({ id: r && r.key && r.key.id, numara, metin: String(metin || ''), dosya: dosya ? path.basename(String(dosya)) : '' });
    } catch {
      /* hafızaya yazılamadı, gönderim yine tamam */
    }
    return { tamam: true };
  }

  dosyaIcerigi(dosya, metin) {
    const yol = path.resolve(String(dosya));
    let boyut;
    try {
      const st = fs.statSync(yol);
      if (!st.isFile()) throw new Error();
      boyut = st.size;
    } catch {
      throw new Error('Dosya bulunamadı: ' + dosya);
    }
    if (boyut > EN_BUYUK) throw new Error('Dosya 64 MB\'tan büyük, WhatsApp\'tan gönderilemez.');
    const uz = path.extname(yol).toLowerCase();
    const aciklama = String(metin || '').trim();
    if (RESIM[uz] && uz !== '.gif') {
      const k = this.kucukResim(yol);
      return { image: { url: yol }, mimetype: RESIM[uz], ...(aciklama ? { caption: aciklama } : {}), ...(k ? { jpegThumbnail: k.toString('base64') } : {}) };
    }
    if (VIDEO[uz] || uz === '.gif') return { video: { url: yol }, mimetype: VIDEO[uz] || 'video/mp4', gifPlayback: uz === '.gif', ...(aciklama ? { caption: aciklama } : {}) };
    if (SES[uz]) return { audio: { url: yol }, mimetype: SES[uz] };
    return { document: { url: yol }, mimetype: BELGE[uz] || 'application/octet-stream', fileName: path.basename(yol), ...(aciklama ? { caption: aciklama } : {}) };
  }
}
