// Test alanları: mobil uygulamalar için iOS simülatörü (yalnızca macOS) ve Android emülatörü (adb kuruluysa).
// Kat şefleri ve ekip bu araçlarla cihazı açar, uygulamayı kurar, başlatır, adres açar ve ekran görüntüsü alır.
// Web testleri tarayıcı odasındaki "Test" sekmesiyle yapılır (bkz. tarayici-araclari.js).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { yolAra, calistir } from './claude.js';

const MAC = process.platform === 'darwin';

const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });

export function adbBul(env) {
  const ev = os.homedir();
  const adaylar = [yolAra(env, 'adb'), path.join(ev, 'Library', 'Android', 'sdk', 'platform-tools', 'adb'), path.join(ev, 'Android', 'Sdk', 'platform-tools', 'adb'), path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')].filter(Boolean);
  return adaylar.find((y) => {
    try {
      return fs.statSync(y).isFile();
    } catch {
      return false;
    }
  }) || null;
}

async function simctl(env, arg, zamanAsimi = 60000) {
  const s = await calistir('/usr/bin/xcrun', ['simctl', ...arg], { env, zamanAsimi });
  if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').pop() || 'simctl hatası');
  return s.cikti;
}

const geciciPng = () => path.join(os.tmpdir(), `ofis-ekran-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);

// env: kabuk ortamı. Döner: MCP araçları (cihaz yoksa ilgili araçlar listelenmez)
export function testAraclari({ env }) {
  const adb = adbBul(env);
  const araclar = {};
  if (MAC) {
    araclar.ios_cihazlar = {
      aciklama: 'iOS simülatörlerini listeler: ad, sürüm, durum (Booted açık demektir) ve kimlik.',
      sema: nesne({}),
      calistir: async () => {
        const j = JSON.parse(await simctl(env, ['list', 'devices', 'available', '-j']));
        return Object.entries(j.devices).flatMap(([rt, ds]) => ds.map((d) => ({ udid: d.udid, ad: d.name, surum: rt.split('.').pop().replace(/-/g, ' '), durum: d.state })));
      },
    };
    araclar.ios_ac = {
      aciklama: 'Simülatörü başlatır ve Simulator uygulamasını öne getirir. Zaten açıksa bir şey yapmaz.',
      sema: nesne({ udid: yazi('Simülatörün kimliği (ios_cihazlar)') }, ['udid']),
      calistir: async (g) => {
        await simctl(env, ['boot', String(g.udid)]).catch((e) => {
          if (!/Booted/i.test(e.message)) throw e;
        });
        await calistir('/usr/bin/open', ['-a', 'Simulator'], { env, zamanAsimi: 15000 });
        return 'Simülatör açık.';
      },
    };
    araclar.ios_kur = {
      aciklama: 'Derlenmiş .app paketini simülatöre kurar.',
      sema: nesne({ udid: yazi('Simülatörün kimliği'), uygulama: yazi('.app paketinin tam yolu') }, ['udid', 'uygulama']),
      calistir: async (g) => (await simctl(env, ['install', String(g.udid), String(g.uygulama)], 180000), 'Kuruldu.'),
    };
    araclar.ios_baslat = {
      aciklama: 'Kurulu uygulamayı paket kimliğiyle başlatır.',
      sema: nesne({ udid: yazi('Simülatörün kimliği'), paket: yazi('Paket kimliği (ör. com.sirket.uygulama)') }, ['udid', 'paket']),
      calistir: async (g) => (await simctl(env, ['launch', String(g.udid), String(g.paket)]), 'Başlatıldı.'),
    };
    araclar.ios_adres = {
      aciklama: 'Simülatörde bir adres ya da derin bağlantı açar (Safari ya da uygulamanın kendi şeması).',
      sema: nesne({ udid: yazi('Simülatörün kimliği'), adres: yazi('Adres ya da derin bağlantı') }, ['udid', 'adres']),
      calistir: async (g) => (await simctl(env, ['openurl', String(g.udid), String(g.adres)]), 'Açıldı.'),
    };
    araclar.ios_goruntu = {
      aciklama: 'Simülatörün ekran görüntüsünü verir.',
      sema: nesne({ udid: yazi('Simülatörün kimliği') }, ['udid']),
      calistir: async (g) => {
        const dosya = geciciPng();
        try {
          await simctl(env, ['io', String(g.udid), 'screenshot', dosya]);
          return { icerik: [{ type: 'image', data: fs.readFileSync(dosya).toString('base64'), mimeType: 'image/png' }] };
        } finally {
          fs.rmSync(dosya, { force: true });
        }
      },
    };
  }
  if (adb) {
    const adbCalis = async (arg, zamanAsimi = 60000) => {
      const s = await calistir(adb, arg, { env, zamanAsimi });
      if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').pop() || 'adb hatası');
      return s.cikti;
    };
    araclar.android_cihazlar = {
      aciklama: 'Bağlı Android cihaz ve emülatörleri listeler.',
      sema: nesne({}),
      calistir: async () =>
        (await adbCalis(['devices', '-l']))
          .split('\n')
          .slice(1)
          .filter((x) => x.trim())
          .map((x) => {
            const [seri, durum, ...ek] = x.trim().split(/\s+/);
            return { seri, durum, bilgi: ek.join(' ') };
          }),
    };
    araclar.android_kur = {
      aciklama: 'APK dosyasını cihaza kurar.',
      sema: nesne({ seri: yazi('Cihazın seri numarası'), apk: yazi('APK dosyasının tam yolu') }, ['seri', 'apk']),
      calistir: async (g) => (await adbCalis(['-s', String(g.seri), 'install', '-r', String(g.apk)], 180000), 'Kuruldu.'),
    };
    araclar.android_adres = {
      aciklama: 'Cihazda bir adres ya da derin bağlantı açar.',
      sema: nesne({ seri: yazi('Cihazın seri numarası'), adres: yazi('Adres ya da derin bağlantı') }, ['seri', 'adres']),
      calistir: async (g) => (await adbCalis(['-s', String(g.seri), 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', String(g.adres)]), 'Açıldı.'),
    };
    araclar.android_goruntu = {
      aciklama: 'Android cihazın ekran görüntüsünü verir.',
      sema: nesne({ seri: yazi('Cihazın seri numarası') }, ['seri']),
      calistir: async (g) => {
        const dosya = geciciPng();
        try {
          await adbCalis(['-s', String(g.seri), 'shell', 'screencap', '-p', '/sdcard/ofis-ekran.png']);
          await adbCalis(['-s', String(g.seri), 'pull', '/sdcard/ofis-ekran.png', dosya]);
          return { icerik: [{ type: 'image', data: fs.readFileSync(dosya).toString('base64'), mimeType: 'image/png' }] };
        } finally {
          fs.rmSync(dosya, { force: true });
        }
      },
    };
  }
  return araclar;
}

export const TEST_ARAC_ADLARI = ['ios_cihazlar', 'ios_ac', 'ios_kur', 'ios_baslat', 'ios_adres', 'ios_goruntu', 'android_cihazlar', 'android_kur', 'android_adres', 'android_goruntu'];
