// Servisler: katların docker compose servislerini (veritabanı, önbellek, API, web, worker) Docker Desktop üzerinden yönetir.
// Ajanlar ham docker komutu çalıştırmaz, buradaki araçları kullanır: yalnızca kendi katının compose dosyasındaki servislere
// dokunabilirler. Docker'ın sanal makinesi çökerse uygulama fark eder, Docker'ı yeniden açar ve açık olması gereken
// servisleri yeniden kaldırır.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { yolAra, calistir } from './claude.js';

const COMPOSE_ADLARI = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'];
const ALT_KLASORLER = ['', 'infra', 'docker', 'deploy', 'ops', '.docker'];

export function dockerBul(env) {
  const adaylar = [
    yolAra(env, 'docker'),
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
    path.join(os.homedir(), '.docker', 'bin', 'docker'),
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  ].filter(Boolean);
  return (
    adaylar.find((y) => {
      try {
        return fs.statSync(y).isFile();
      } catch {
        return false;
      }
    }) || null
  );
}

// Proje klasöründe compose dosyalarını arar: kök ve sık kullanılan alt klasörler. Geliştirme dosyası (.dev) ayrıca listelenir.
export function composeBul(klasor) {
  const bulunan = [];
  if (!klasor) return bulunan;
  for (const alt of ALT_KLASORLER) {
    const yer = path.join(klasor, alt);
    let dosyalar;
    try {
      dosyalar = fs.readdirSync(yer);
    } catch {
      continue;
    }
    for (const d of dosyalar) {
      if (COMPOSE_ADLARI.includes(d) || /^(docker-)?compose\.[\w-]+\.ya?ml$/.test(d)) bulunan.push(path.join(yer, d));
    }
  }
  return bulunan;
}

// JSON satırları ya da JSON dizisi: docker sürümüne göre ikisi de gelebilir
function jsonSatirlar(metin) {
  const t = String(metin || '').trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    try {
      return JSON.parse(t);
    } catch {
      return [];
    }
  }
  return t
    .split('\n')
    .map((x) => {
      try {
        return JSON.parse(x);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const servisAdiGecerli = (s) => /^[\w.-]{1,80}$/.test(String(s || ''));

export class Servisler {
  // env: kabuk ortamı (sonradan değişebilir). degisti(): servis durumu değişince arayüzü haberdar etmek için.
  constructor({ env, degisti, gunluk }) {
    this.env = env;
    this.degisti = degisti || (() => {});
    this.gunluk = gunluk || (() => {});
    this.sonMotor = null; // son bilinen motor durumu
    this.toparlaniyor = false;
  }

  ortamAyarla(env) {
    this.env = env;
  }

  docker() {
    return dockerBul(this.env || process.env);
  }

  async calis(arg, { cwd, zamanAsimi = 60000 } = {}) {
    const d = this.docker();
    if (!d) throw new Error('Docker bulunamadı. Docker Desktop kurulu olmalı.');
    // Docker'ın kendi ikili klasörü PATH'te olsun: compose eklentisi ve kimlik yardımcıları oradan bulunur
    const env = { ...(this.env || process.env) };
    const yolAnahtari = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
    env[yolAnahtari] = [path.dirname(d), env[yolAnahtari] || ''].join(path.delimiter);
    const s = await calistir(d, arg, { env, cwd, zamanAsimi });
    if (s.kod !== 0) throw new Error((s.hata || s.cikti).trim().split('\n').slice(-3).join(' ') || 'docker hatası');
    return s.cikti;
  }

  // Motor durumu: Docker kurulu mu, çalışıyor mu, sürümü, CPU ve bellek
  async motor() {
    const d = this.docker();
    if (!d) return (this.sonMotor = { kurulu: false, calisiyor: false });
    try {
      const j = JSON.parse(await this.calis(['info', '--format', '{{json .}}'], { zamanAsimi: 10000 }));
      this.sonMotor = { kurulu: true, calisiyor: true, surum: j.ServerVersion || '', cpu: j.NCPU || 0, bellek: j.MemTotal || 0, konteyner: j.ContainersRunning || 0 };
    } catch (e) {
      this.sonMotor = { kurulu: true, calisiyor: false, hata: String(e.message || e).slice(0, 300) };
    }
    return this.sonMotor;
  }

  // Docker Desktop'ı açar ve hazır olmasını bekler (en çok 3 dakika)
  async motoruAc() {
    if (process.platform === 'darwin') spawn('/usr/bin/open', ['-a', 'Docker'], { detached: true, stdio: 'ignore' }).unref();
    else if (process.platform === 'win32') spawn('C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe', [], { detached: true, stdio: 'ignore' }).unref();
    else spawn('systemctl', ['--user', 'start', 'docker-desktop'], { detached: true, stdio: 'ignore' }).unref();
    const son = Date.now() + 180000;
    while (Date.now() < son) {
      await new Promise((r) => setTimeout(r, 4000));
      if ((await this.motor()).calisiyor) return true;
    }
    return false;
  }

  // Compose dosyası kat klasörünün içinde olmalı: ajan başka bir projenin servislerine dokunamaz
  dosyaDogrula(proje) {
    const dosya = proje.servis && proje.servis.compose;
    if (!dosya) throw new Error('Bu katta seçili bir compose dosyası yok. Servisler sayfasından seç.');
    // katın herhangi bir deposunun içinde olmalı (çok depolu katlarda api, web, admin...)
    const kokler = [proje.klasor, ...(proje.depolar || []).map((d) => d.klasor)].filter(Boolean).map((k) => path.resolve(k) + path.sep);
    if (!kokler.some((k) => path.resolve(dosya).startsWith(k))) throw new Error('Compose dosyası katın depolarının dışında.');
    if (!fs.existsSync(dosya)) throw new Error('Compose dosyası bulunamadı: ' + dosya);
    return dosya;
  }

  compose(proje, arg, secenek = {}) {
    const dosya = this.dosyaDogrula(proje);
    return this.calis(['compose', '-f', dosya, ...arg], { cwd: path.dirname(dosya), ...secenek });
  }

  // Servis listesi: compose dosyasındaki bütün servisler, çalışanların durumu, portları, sağlığı ve kaynak kullanımı
  async liste(proje) {
    const tanimli = (await this.compose(proje, ['config', '--services'], { zamanAsimi: 20000 })).split('\n').map((x) => x.trim()).filter(Boolean);
    const ps = jsonSatirlar(await this.compose(proje, ['ps', '--all', '--format', 'json'], { zamanAsimi: 20000 }));
    let istatistik = [];
    const adlar = ps.filter((c) => c.State === 'running').map((c) => c.Name);
    if (adlar.length) {
      try {
        istatistik = jsonSatirlar(await this.calis(['stats', '--no-stream', '--format', '{{json .}}', ...adlar], { zamanAsimi: 20000 }));
      } catch {
        istatistik = [];
      }
    }
    return tanimli.map((ad) => {
      const c = ps.find((x) => x.Service === ad);
      const st = c && istatistik.find((x) => x.Name === c.Name);
      const portlar = c && Array.isArray(c.Publishers) ? [...new Set(c.Publishers.filter((p) => p.PublishedPort).map((p) => `${p.PublishedPort}:${p.TargetPort}`))] : [];
      return {
        ad,
        konteyner: c ? c.Name : '',
        durum: c ? c.State : 'yok', // running | exited | restarting | created | paused | yok
        saglik: c ? c.Health || '' : '',
        aciklama: c ? c.Status || '' : '',
        portlar,
        cpu: st ? st.CPUPerc : '',
        bellek: st ? st.MemUsage : '',
      };
    });
  }

  async baslat(proje, servis) {
    if (servis && !servisAdiGecerli(servis)) throw new Error('Geçersiz servis adı');
    await this.compose(proje, ['up', '-d', ...(servis ? [servis] : [])], { zamanAsimi: 600000 });
    await this.sinirUygula(proje);
    this.degisti();
  }

  async durdur(proje, servis) {
    if (servis && !servisAdiGecerli(servis)) throw new Error('Geçersiz servis adı');
    await this.compose(proje, ['stop', ...(servis ? [servis] : [])], { zamanAsimi: 120000 });
    this.degisti();
  }

  async yeniden(proje, servis) {
    if (servis && !servisAdiGecerli(servis)) throw new Error('Geçersiz servis adı');
    await this.compose(proje, ['restart', ...(servis ? [servis] : [])], { zamanAsimi: 180000 });
    this.degisti();
  }

  async derle(proje, servis) {
    if (servis && !servisAdiGecerli(servis)) throw new Error('Geçersiz servis adı');
    return (await this.compose(proje, ['build', ...(servis ? [servis] : [])], { zamanAsimi: 1800000 })).slice(-4000);
  }

  async log(proje, servis, satir = 200) {
    if (servis && !servisAdiGecerli(servis)) throw new Error('Geçersiz servis adı');
    const n = Math.max(10, Math.min(2000, Number(satir) || 200));
    return this.compose(proje, ['logs', '--no-color', '--tail', String(n), ...(servis ? [servis] : [])], { zamanAsimi: 30000 });
  }

  // Çalışan bir servisin içinde komut çalıştırır (ör. psql ile test veritabanı açmak). Komut dizi olarak verilir, kabuk yok.
  async komut(proje, servis, komut) {
    if (!servisAdiGecerli(servis)) throw new Error('Geçersiz servis adı');
    if (!Array.isArray(komut) || !komut.length) throw new Error('Komut bir dizi olmalı, ör. ["psql", "-U", "kullanici", "-c", "select 1"]');
    return (await this.compose(proje, ['exec', '-T', servis, ...komut.map(String)], { zamanAsimi: 300000 })).slice(-8000);
  }

  // Katın kaynak sınırı: her servis kabı için bellek (MB) ve CPU. 0 ya da boş: sınır yok.
  async sinirUygula(proje) {
    const s = proje.servis || {};
    const arg = [];
    if (s.bellekMb > 0) arg.push('--memory', `${s.bellekMb}m`, '--memory-swap', `${s.bellekMb}m`);
    if (s.cpu > 0) arg.push('--cpus', String(s.cpu));
    if (!arg.length) return;
    const ps = jsonSatirlar(await this.compose(proje, ['ps', '--format', 'json'], { zamanAsimi: 20000 }));
    for (const c of ps) {
      try {
        await this.calis(['update', ...arg, c.Name], { zamanAsimi: 20000 });
      } catch (e) {
        this.gunluk('servis sınırı uygulanamadı', c.Name, String(e.message || e));
      }
    }
  }

  // Kendini toparlama: açık kalması istenen katların servisleri düşerse yeniden kaldırılır.
  // Docker hiç cevap vermiyorsa (sanal makine çöktü) önce Docker Desktop yeniden açılır.
  async toparla(projeler, bildir) {
    if (this.toparlaniyor) return;
    const istenen = projeler.filter((p) => p.servis && p.servis.compose && p.servis.acikTut);
    if (!istenen.length) return;
    this.toparlaniyor = true;
    try {
      const m = await this.motor();
      if (!m.kurulu) return;
      if (!m.calisiyor) {
        bildir('motorDustu');
        if (!(await this.motoruAc())) return bildir('motorAcilamadi');
      }
      for (const p of istenen) {
        let liste;
        try {
          liste = await this.liste(p);
        } catch {
          continue;
        }
        const dusen = liste.filter((s) => s.durum !== 'running');
        if (!dusen.length) continue;
        try {
          await this.baslat(p);
          bildir('kaldirildi', p, dusen.map((s) => s.ad));
        } catch (e) {
          bildir('kaldirilamadi', p, dusen.map((s) => s.ad), String(e.message || e));
        }
      }
    } finally {
      this.toparlaniyor = false;
    }
  }
}

// ---------- ajan araçları ----------
const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });
const servisAlani = yazi('Servisin compose dosyasındaki adı (ör. postgres, api). Boş bırakılırsa bütün servisler.');

// projeAl(): aracı çağıran katın proje kaydı. Brain için kat_id ile seçilir.
export function servisAraclari(srv, projeAl, { beyin = false } = {}) {
  const kat = beyin ? { kat_id: yazi('Katın kimliği') } : {};
  const gerekliKat = beyin ? ['kat_id'] : [];
  const p = (g) => projeAl(beyin ? String(g.kat_id || '') : '');
  return {
    servisler: {
      aciklama: 'Katın docker compose servislerini listeler: durum, sağlık, portlar, CPU ve bellek. Docker\'ı ham komutla kullanma, bu araçları kullan.',
      sema: nesne({ ...kat }, gerekliKat),
      calistir: async (g) => {
        const m = await srv.motor();
        if (!m.calisiyor) return { motor: m, servisler: [] };
        return { motor: m, servisler: await srv.liste(p(g)) };
      },
    },
    servis_baslat: {
      aciklama: 'Servisleri başlatır (docker compose up -d). Servis verilmezse hepsi. Katın kaynak sınırı uygulanır.',
      sema: nesne({ ...kat, servis: servisAlani }, gerekliKat),
      calistir: async (g) => (await srv.baslat(p(g), g.servis ? String(g.servis) : ''), 'Başlatıldı.'),
    },
    servis_durdur: {
      aciklama: 'Servisleri durdurur (veriler silinmez). Servis verilmezse hepsi.',
      sema: nesne({ ...kat, servis: servisAlani }, gerekliKat),
      calistir: async (g) => (await srv.durdur(p(g), g.servis ? String(g.servis) : ''), 'Durduruldu.'),
    },
    servis_yeniden: {
      aciklama: 'Servisleri yeniden başlatır. Servis verilmezse hepsi.',
      sema: nesne({ ...kat, servis: servisAlani }, gerekliKat),
      calistir: async (g) => (await srv.yeniden(p(g), g.servis ? String(g.servis) : ''), 'Yeniden başlatıldı.'),
    },
    servis_derle: {
      aciklama: 'Servis imajlarını derler (docker compose build). Uzun sürebilir. Servis verilmezse hepsi.',
      sema: nesne({ ...kat, servis: servisAlani }, gerekliKat),
      calistir: async (g) => srv.derle(p(g), g.servis ? String(g.servis) : ''),
    },
    servis_log: {
      aciklama: 'Servisin son log satırlarını verir.',
      sema: nesne({ ...kat, servis: servisAlani, satir: { type: 'number', description: 'Kaç satır (10-2000, varsayılan 200)' } }, gerekliKat),
      calistir: async (g) => srv.log(p(g), g.servis ? String(g.servis) : '', g.satir),
    },
    servis_komut: {
      aciklama: 'Çalışan bir servisin içinde komut çalıştırır (docker compose exec). Ör. test veritabanı açmak: servis "postgres", komut ["psql","-U","kullanici","-d","postgres","-c","CREATE DATABASE test_x"]. Kendi açtığın test veritabanlarını işin bitince sil; başkalarının verisine dokunma.',
      sema: nesne({ ...kat, servis: yazi('Servisin adı'), komut: { type: 'array', items: { type: 'string' }, description: 'Komut ve argümanları, her biri ayrı öğe' } }, [...gerekliKat, 'servis', 'komut']),
      calistir: async (g) => srv.komut(p(g), String(g.servis), g.komut),
    },
  };
}

export const SERVIS_ARAC_ADLARI = ['servisler', 'servis_baslat', 'servis_durdur', 'servis_yeniden', 'servis_derle', 'servis_log', 'servis_komut'];
