// WhatsApp bağlantısı: tarayıcı ya da ekran okuma olmadan, WhatsApp'ın bağlı cihaz bağlantısıyla çalışır.
// Beynin numarası bir kez QR ile bağlanır (WhatsApp > Bağlı cihazlar). Gelen mesajlar anında olay olarak gelir,
// gönderim doğrudan yapılır. Yapay zekâ WhatsApp'ı okumaz: yalnızca sahibin mesajı beyne iletilir, jeton harcanmaz.
// Oturum anahtarları uygulamanın veri klasöründe durur. "Çıkış" bağlı cihazı WhatsApp'tan da kaldırır.
import fs from 'node:fs';

const sessiz = { level: 'silent', child: () => sessiz, trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {} };
const rakamlar = (x) => String(x || '').split('@')[0].split(':')[0].replace(/\D/g, '');

export class WhatsappBaglantisi {
  // klasor: oturum anahtarlarının klasörü. degisti(durum): durum değişince. mesaj({ kimden, numara, metin, ses }): gelen mesaj.
  constructor({ klasor, degisti, mesaj }) {
    this.klasor = klasor;
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
    const soket = makeWASocket({ auth: state, logger: sessiz, browser: Browsers.macOS('Ajan Ofisi'), printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: false, ...(surum ? { version: surum } : {}) });
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
    soket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        try {
          if (!m.message || this.gonderilen.has(m.key.id)) continue;
          const sohbet = m.key.remoteJid || '';
          if (sohbet.endsWith('@g.us') || sohbet === 'status@broadcast') continue;
          // numara: yeni WhatsApp sürümleri sohbeti gizli kimlikle (@lid) verir, telefon numarası ek alandadır
          const tel = [m.key.remoteJidAlt, m.key.senderPn, sohbet].find((j) => j && /@s\.whatsapp\.net$/.test(j));
          const numara = rakamlar(tel || sohbet);
          const kendi = rakamlar(soket.user && soket.user.id);
          // kendi numarandan kendine yazdığın mesajlar da sayılır; başka sohbetlerde senin gönderdiklerin sayılmaz
          if (m.key.fromMe && numara !== kendi) continue;
          const ic = m.message.ephemeralMessage ? m.message.ephemeralMessage.message : m.message;
          let metin = ic.conversation || (ic.extendedTextMessage && ic.extendedTextMessage.text) || (ic.imageMessage && ic.imageMessage.caption) || '';
          let ses = null;
          if (ic.audioMessage) ses = { veri: await downloadMediaMessage(m, 'buffer', {}), mime: ic.audioMessage.mimetype || 'audio/ogg' };
          if (!metin && !ses) continue;
          this.mesajGeldi({ kimden: m.pushName || '', numara, sohbet, metin, ses });
        } catch {
          /* tek bir mesaj okunamadıysa diğerleri yine işlenir */
        }
      }
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

  // hedef: telefon numarası (ülke koduyla) ya da sohbet kimliği
  async gonder(hedef, metin) {
    if (!this.soket || this.durum.baglanti !== 'bagli') throw new Error('WhatsApp bağlı değil. Ayarlar > Beyin bölümünden bağla.');
    let jid = String(hedef);
    if (!jid.includes('@')) {
      const n = rakamlar(jid);
      if (n.length < 7) throw new Error('Geçersiz numara: ' + hedef);
      const [kayit] = await this.soket.onWhatsApp(n);
      if (!kayit || !kayit.exists) throw new Error('Bu numara WhatsApp kullanmıyor: ' + hedef);
      jid = kayit.jid;
    }
    const r = await this.soket.sendMessage(jid, { text: String(metin) });
    if (r && r.key && r.key.id) {
      this.gonderilen.add(r.key.id);
      if (this.gonderilen.size > 500) this.gonderilen.delete(this.gonderilen.values().next().value);
    }
    return { tamam: true };
  }
}
