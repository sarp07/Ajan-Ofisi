// Geliştirme aracı: gerçek uygulamayı açar, tıklayarak gezer ve ekran görüntüsü alır.
// Playwright bu depoya bağımlılık olarak eklenmedi: PLAYWRIGHT ile yolunu ver ya da "npm i -D playwright" yaz.
const { _electron } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
import path from 'node:path';
const [,, cikti, senaryo = 'kurulum'] = process.argv;
fs.mkdirSync(cikti, { recursive: true });
const veri = path.join(cikti, 'veri-' + senaryo);
if (!process.env.KORU) fs.rmSync(veri, { recursive: true, force: true });
const app = await _electron.launch({
  executablePath: path.resolve('node_modules/electron/dist/electron'),
  args: ['.', '--no-sandbox', '--disable-gpu', '--lang=' + (process.env.DIL || 'tr')],
  env: { ...process.env, AJAN_OFIS_VERI: veri, AJAN_OFIS_EKRAN: 'yok', ...(process.env.CLAUDE_YOK ? { PATH: '/usr/bin:/bin', SHELL: '/bin/sh' } : {}) },
});
app.process().stdout.on('data', (d) => { const s = String(d); if (/ARAYUZ/.test(s)) process.stdout.write(s); });
const w = await app.firstWindow();
w.on('pageerror', (e) => console.log('SAYFA HATA:', e.message));
w.on('console', (m) => { if (m.type() === 'error') console.log('KONSOL:', m.text()); });
await w.setViewportSize({ width: 1500, height: 950 }).catch(() => {});
await w.waitForSelector('#ray button', { timeout: 20000 });
const cek = async (ad) => { await w.waitForTimeout(500); await w.screenshot({ path: path.join(cikti, ad + '.png') }); console.log('ekran:', ad); };
const tikla = async (metin) => { await w.getByRole('button', { name: metin, exact: false }).first().click(); };

if (senaryo === 'kurulum') {
  await w.waitForSelector('.kurulum');
  await w.waitForTimeout(2500);
  await w.fill('.kurulum input[type=text] >> nth=0', 'Solazan Stüdyo');
  await cek('k0-ofis');
  await tikla('Devam');
  await w.waitForTimeout(300);
  for (const ad of ['Kaan', 'Elif', 'Defne', 'Cem']) await w.locator('.sablonKart', { hasText: ad }).click();
  await cek('k1-ekip');
  await w.locator('.kurAlt .dugme.ana').click();
  await w.waitForTimeout(600);
  await cek('k2-skiller');
  await tikla('Şimdilik geç');
  await w.waitForTimeout(400);
  await cek('k3-claude');
  await w.locator('.kurAlt .dugme.ana').click();
  await w.waitForTimeout(1200);
  await cek('s1-ofis-bos');
  const ray = (ad) => w.locator('#ray button', { hasText: ad }).click();
  // proje: klasör seçme penceresi yerine doğrudan kayıt, deftere örnek satırlar
  const proje = path.join(cikti, 'ornek-proje');
  fs.mkdirSync(proje, { recursive: true });
  const pr = await w.evaluate((klasor) => window.ofis.projeKaydet({
    klasor, ad: 'FainEra', aciklama: 'Komisyon iadesi platformu. Next.js, Supabase ve Vercel.',
    alanAdlari: ['fainera.com', 'fee.fainera.com', 'staging.fainera.com'],
    hesaplar: [{ platform: 'instagram', ad: '@fainera', not: 'Duyurular' }, { platform: 'x', ad: '@fainera', not: '' }, { platform: 'vercel', ad: 'fainera', not: 'Canlı ve önizleme' }],
    test: { komut: 'npm test', adres: 'https://staging.fainera.com', sorumlu: 'cem', zorunlu: true },
    notlar: 'Canlıya çıkışı ben yaparım. Ödeme sayfasına dokunmadan önce sor.',
  }), proje);
  await w.evaluate((klasor) => window.ofis.projeKaydet({ klasor, ad: 'Blog', aciklama: 'İçerik sitesi' }), path.join(cikti, 'blog'));
  const z = Date.now();
  const satirlar = [
    { z: z - 7400000, tur: 'oturum', metin: 'basladi', oturum: 'a' },
    { z: z - 7300000, tur: 'istek', metin: 'Ödeme sayfasındaki form doğrulamasını düzelt, boş tutar gönderilebiliyor.', oturum: 'a' },
    { z: z - 7290000, tur: 'atama', kim: 'Elif', metin: 'Ödeme formu doğrulaması', oturum: 'a' },
    { z: z - 7280000, tur: 'gorev', gorev: '1', kim: 'Elif', metin: 'Tutar alanına doğrulama ekle', oturum: 'a' },
    { z: z - 7000000, tur: 'teslim', kim: 'Elif', metin: 'Tutar alanı artık boş ve sıfır değer kabul etmiyor. 2 dosya değişti.', oturum: 'a' },
    { z: z - 6990000, tur: 'gorevBitti', gorev: '1', kim: 'Elif', metin: 'Tutar alanına doğrulama ekle', oturum: 'a' },
    { z: z - 6900000, tur: 'teslim', kim: 'Cem', metin: '14 test geçti, 0 hata. Test adresinde elle de denedim.', oturum: 'a' },
    { z: z - 6800000, tur: 'sonuc', kim: 'Atlas', metin: 'Form doğrulaması düzeldi ve Cem doğruladı. Canlıya çıkış sende.', oturum: 'a' },
    { z: z - 5500000, tur: 'istek', metin: 'Şimdi mobil görünümdeki taşmaları toparla.', oturum: 'a' },
    { z: z - 5490000, tur: 'gorev', gorev: '2', kim: 'Elif', metin: 'Mobil ödeme sayfası taşmaları', oturum: 'a' },
    { z: z - 5400000, tur: 'oturum', metin: 'bitti', oturum: 'a' },
  ];
  fs.mkdirSync(path.join(veri, 'kayit'), { recursive: true });
  fs.writeFileSync(path.join(veri, 'kayit', pr.proje.id + '.jsonl'), satirlar.map((x) => JSON.stringify(x)).join('\n') + '\n');
  await ray('Projeler');
  await w.waitForTimeout(600);
  await cek('p1-projeler');
  await w.locator('.projeKart >> nth=0').click();
  await w.waitForTimeout(600);
  await cek('p2-proje-duzenle');
  await w.locator('.cekmeceGovde:visible').evaluate((el) => (el.scrollTop = 99999));
  await cek('p3-proje-defter');
  await w.locator('.cekmeceBas .simge:visible').click();
  await w.locator('.projeKart >> nth=0').locator('.dugme').click();
  await w.waitForTimeout(900);
  await cek('p4-ofis-kaldi');
  await ray('Ekip');
  await cek('s2-ekip');
  await w.locator('.kisiKart >> nth=1').click();
  await w.waitForTimeout(500);
  await cek('s3-duzenle');
  await w.locator('.cekmeceGovde:visible').evaluate((el) => (el.scrollTop = 900));
  await cek('s3b-duzenle-alt');
  await w.locator('.cekmeceBas .simge:visible').click();
  await w.locator('.kisiKart.bosKutu').click();
  await w.waitForTimeout(400);
  await cek('s4-yeni');
  await w.locator('.cekmeceBas .simge:visible').click();
  await ray('Skiller');
  await cek('s5-skiller');
  await w.locator('.sayfa.skillSayfa').evaluate((el) => (el.scrollTop = 99999));
  await cek('s5b-skiller-alt');
  await ray('Kurallar');
  await cek('s6-kurallar');
  await ray('Ayarlar');
  await cek('s7-ayarlar');
}
await app.close();
