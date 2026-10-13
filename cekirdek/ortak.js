// Ortak servisler: makinede tek bir Postgres (uygulamanın yönettiği Docker kabı) ve katlara ayrılan port blokları.
// Her proje ortak Postgres'te kendi veritabanını ve kendi kullanıcısını alır; projeler birbirinin verisine erişemez.
// Böylece her yeni uygulama ayrı bir Postgres kabı açıp 5432 gibi portlarda çakışmaz.
import net from 'node:net';
import crypto from 'node:crypto';

export const PG_KAP = 'ajan-ofisi-postgres';
const PG_BIRIM = 'ajan-ofisi-pg';
const PG_IMAJ = 'postgres:16-alpine';
const PG_YONETICI = 'ofis';
const PORT_BAS = 4000; // blok k: 4000 + k*100 ... +99
const BLOK = 100;

// Bu portta dinleyen bir şey var mı (yalnızca bu bilgisayar)
export function portBosMu(port) {
  return new Promise((coz) => {
    const s = net.createServer();
    s.once('error', () => coz(false));
    s.once('listening', () => s.close(() => coz(true)));
    s.listen(port, '127.0.0.1');
  });
}

// Veritabanı ve kullanıcı adı: yalnızca küçük harf, rakam ve alt çizgi (SQL'e güvenle girer)
export function sqlAd(metin, onek = 'p_') {
  const sade = String(metin || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return onek + (sade || 'proje');
}

export const portAraligi = (blok) => ({ bas: PORT_BAS + blok * BLOK, son: PORT_BAS + blok * BLOK + BLOK - 1 });

// Katın port bloğu: kalıcıdır; ilk ihtiyaçta kullanılmayan en küçük blok verilir
export function blokSec(projeler) {
  const dolu = new Set(projeler.map((p) => p.portBlok).filter((x) => x > 0));
  let k = 1;
  while (dolu.has(k)) k++;
  return k;
}

// Bloktan boş bir port: önce kayıtlı olmayan, sonra gerçekten boş olan
export async function portSec(blok, ayrilan) {
  const { bas, son } = portAraligi(blok);
  const kullanilan = new Set(Object.values(ayrilan || {}));
  for (let p = bas; p <= son; p++) {
    if (kullanilan.has(p)) continue;
    if (await portBosMu(p)) return p;
  }
  throw new Error(`Katın port bloğunda boş port kalmadı (${bas}-${son}).`);
}

export class OrtakPostgres {
  // srv: Servisler (docker komutu için). sifreAl/sifreKoy: yönetici şifresinin şifreli depodaki yeri.
  constructor({ srv, sifreAl, sifreKoy, kap = PG_KAP, birim = PG_BIRIM }) {
    this.srv = srv;
    this.kap = kap;
    this.birim = birim;
    this.sifreAl = sifreAl;
    this.sifreKoy = sifreKoy;
    this.port = null;
  }

  async durum() {
    const m = await this.srv.motor();
    if (!m.calisiyor) return { motor: m, kurulu: false, calisiyor: false };
    const cikti = (await this.srv.calis(['ps', '-a', '--filter', `name=^${this.kap}$`, '--format', '{{.State}}|{{.Ports}}'], { zamanAsimi: 15000 })).trim();
    if (!cikti) return { motor: m, kurulu: false, calisiyor: false };
    const [durum, portlar] = cikti.split('|');
    const pm = /:(\d+)->5432/.exec(portlar || '');
    if (pm) this.port = Number(pm[1]);
    return { motor: m, kurulu: true, calisiyor: durum === 'running', port: this.port };
  }

  // Kurulu değilse kurar, duruyorsa başlatır, hazır olana kadar bekler. Döner: port.
  async hazirla() {
    const d = await this.durum();
    if (!d.motor.calisiyor) throw new Error('Docker çalışmıyor. Servisler sayfasından Docker Desktop\'ı aç.');
    if (!d.kurulu) {
      let sifre = this.sifreAl();
      if (!sifre) {
        sifre = crypto.randomBytes(18).toString('hex');
        this.sifreKoy(sifre);
      }
      // 5432 boşsa o, değilse 54320'den sonraki ilk boş port
      let port = 5432;
      if (!(await portBosMu(port))) {
        port = 0;
        for (let p = 54320; p < 54400; p++) if (await portBosMu(p)) {
          port = p;
          break;
        }
        if (!port) throw new Error('Ortak Postgres için boş port bulunamadı.');
      }
      await this.srv.calis(['run', '-d', '--name', this.kap, '--restart', 'unless-stopped', '-e', `POSTGRES_USER=${PG_YONETICI}`, '-e', `POSTGRES_PASSWORD=${sifre}`, '-p', `127.0.0.1:${port}:5432`, '-v', `${this.birim}:/var/lib/postgresql/data`, '--label', 'ajan-ofisi=ortak', PG_IMAJ], { zamanAsimi: 600000 });
      this.port = port;
    } else if (!d.calisiyor) {
      await this.srv.calis(['start', this.kap], { zamanAsimi: 60000 });
    }
    // hazır olana kadar bekle (ilk kurulumda imaj iner, veritabanı başlar)
    const son = Date.now() + 90000;
    while (Date.now() < son) {
      try {
        await this.srv.calis(['exec', this.kap, 'pg_isready', '-U', PG_YONETICI], { zamanAsimi: 10000 });
        await this.durum();
        return this.port;
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw new Error('Ortak Postgres zamanında hazır olmadı.');
  }

  // Yönetici olarak SQL çalıştırır. sql yalnızca bu dosyada, temizlenmiş adlarla kurulur.
  sql(sql, db = 'postgres') {
    return this.srv.calis(['exec', '-i', this.kap, 'psql', '-U', PG_YONETICI, '-d', db, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], { zamanAsimi: 60000 });
  }

  // Projenin veritabanı: yoksa kullanıcısı ve veritabanı açılır. Döner: { db, kullanici, sifre, port, adres }
  async projeDb(proje, sifreAl, sifreKoy) {
    const port = await this.hazirla();
    const ad = sqlAd(proje.ad);
    let sifre = sifreAl();
    const rolVar = (await this.sql(`SELECT 1 FROM pg_roles WHERE rolname='${ad}'`)).trim() === '1';
    if (!rolVar || !sifre) {
      sifre = crypto.randomBytes(16).toString('hex');
      sifreKoy(sifre);
      // CREATEDB: proje kendi test veritabanlarını açabilsin (adlar araçta önekle sınırlanır)
      await this.sql(rolVar ? `ALTER ROLE ${ad} WITH LOGIN CREATEDB PASSWORD '${sifre}'` : `CREATE ROLE ${ad} WITH LOGIN CREATEDB PASSWORD '${sifre}'`);
    }
    const dbVar = (await this.sql(`SELECT 1 FROM pg_database WHERE datname='${ad}'`)).trim() === '1';
    if (!dbVar) await this.sql(`CREATE DATABASE ${ad} OWNER ${ad}`);
    // başka projelerin kullanıcıları bu veritabanına bağlanamaz
    await this.sql(`REVOKE CONNECT ON DATABASE ${ad} FROM PUBLIC`);
    await this.sql(`GRANT CONNECT ON DATABASE ${ad} TO ${ad}`);
    return { db: ad, kullanici: ad, sifre, port, adres: `postgresql://${ad}:${sifre}@localhost:${port}/${ad}` };
  }

  // Projenin test veritabanı: <db>_test_<ad>. Açar ya da siler.
  async testDb(proje, ad, islem, sifre) {
    const port = await this.hazirla();
    const ana = sqlAd(proje.ad);
    const test = `${ana}_test_${sqlAd(ad, '').slice(0, 20)}`;
    if (islem === 'sil') {
      await this.sql(`DROP DATABASE IF EXISTS ${test} WITH (FORCE)`);
      return { silindi: test };
    }
    const varMi = (await this.sql(`SELECT 1 FROM pg_database WHERE datname='${test}'`)).trim() === '1';
    if (!varMi) await this.sql(`CREATE DATABASE ${test} OWNER ${ana}`);
    await this.sql(`REVOKE CONNECT ON DATABASE ${test} FROM PUBLIC`);
    await this.sql(`GRANT CONNECT ON DATABASE ${test} TO ${ana}`);
    return { db: test, adres: `postgresql://${ana}:${sifre}@localhost:${port}/${test}` };
  }

  // Projenin test veritabanları (temizlik için)
  async testListesi(proje) {
    const ana = sqlAd(proje.ad);
    const c = await this.sql(`SELECT datname FROM pg_database WHERE datname LIKE '${ana}\\_test\\_%' ORDER BY 1`);
    return c.split('\n').map((x) => x.trim()).filter(Boolean);
  }

  // Bütün projelerin veritabanları ve boyutları (Servisler sayfası için)
  async veritabanlari() {
    const c = await this.sql("SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname LIKE 'p\\_%' ORDER BY 1");
    return c
      .split('\n')
      .filter(Boolean)
      .map((x) => {
        const [ad, boyut] = x.split('|');
        return { ad, boyut };
      });
  }
}

// ---------- ajan araçları ----------
const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });

// ops: { db(), testDb(ad, islem), testListesi(), portAyir(ad), portlar() } — katın kendi kapsamında
export function ortakAraclari(ops) {
  return {
    ortak_db: {
      aciklama: 'Projenin ortak Postgres\'teki kendi veritabanının bağlantı bilgisini verir (yoksa açar). Yeni Postgres kabı kurma, docker-compose\'a postgres ekleme; .env\'deki DATABASE_URL\'i buradan al.',
      sema: nesne({}),
      calistir: async () => ops.db(),
    },
    ortak_db_test: {
      aciklama: 'Projenin test veritabanını açar ya da siler (ad: kısa bir etiket, ör. "e2e"). Açtığın test veritabanını işin bitince sil.',
      sema: nesne({ ad: yazi('Kısa etiket, ör. e2e, migrate'), islem: { type: 'string', enum: ['ac', 'sil', 'liste'] } }, ['islem']),
      calistir: async (g) => (g.islem === 'liste' ? ops.testListesi() : ops.testDb(String(g.ad || 'test'), g.islem === 'sil' ? 'sil' : 'ac')),
    },
    port_ayir: {
      aciklama: 'Katın port bloğundan bu servis için kalıcı ve boş bir port ayırır (ör. api, web, worker). Aynı ad için hep aynı port döner. 3000, 5173, 8080 gibi sabit portlar yerine bunu kullan.',
      sema: nesne({ ad: yazi('Servisin adı, ör. api, web') }, ['ad']),
      calistir: async (g) => ops.portAyir(String(g.ad)),
    },
    portlar: {
      aciklama: 'Katın port bloğunu ve ayrılmış portları listeler.',
      sema: nesne({}),
      calistir: async () => ops.portlar(),
    },
  };
}

export const ORTAK_ARAC_ADLARI = ['ortak_db', 'ortak_db_test', 'port_ayir', 'portlar'];
