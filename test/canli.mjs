// Geliştirme aracı: uygulamayı açar, gömülü terminalde GERÇEK Claude Code oturumu başlatır.
// Kullanım: node test/canli.mjs <çıktı klasörü> <veri klasörü> <proje klasörü> "<şefe yazılacak mesaj>"
// Playwright bu depoya bağımlılık olarak eklenmedi: PLAYWRIGHT ile yolunu ver ya da "npm i -D playwright" yaz.
const { _electron } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
import path from 'node:path';
const [,, cikti, veri, proje, mesaj = ''] = process.argv;
fs.mkdirSync(cikti, { recursive: true });
fs.mkdirSync(proje, { recursive: true });
const kayit = path.join(cikti, 'olaylar.jsonl');
fs.rmSync(kayit, { force: true });
const app = await _electron.launch({
  // UYGULAMA verilirse paketlenmiş uygulama, verilmezse kaynak koddan çalışan sürüm açılır
  executablePath: process.env.UYGULAMA || path.resolve('node_modules/electron/dist/electron'),
  args: [...(process.env.UYGULAMA ? [] : ['.']), '--no-sandbox', '--disable-gpu', '--lang=tr'],
  env: { ...process.env, AJAN_OFIS_VERI: veri, AJAN_OFIS_EKRAN: 'yok', AJAN_OFIS_OLAY_KAYDI: kayit },
});
const w = await app.firstWindow();
w.on('pageerror', (e) => console.log('SAYFA HATA:', e.message));
await w.setViewportSize({ width: 1500, height: 950 }).catch(() => {});
await w.waitForSelector('#ray button', { timeout: 20000 });
const cek = async (ad) => { await w.screenshot({ path: path.join(cikti, ad + '.png') }); console.log('ekran:', ad); };
const ansi = (s) => s.replace(/\x1b\[(\d*)C/g, (_m, n) => ' '.repeat(Number(n) || 1)).replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, '').replace(/\x1b[()][A-Z0-9]/g, '');
const ekran = async () => ansi(((await w.evaluate(() => window.ofis.oturumTampon())) || {}).tampon || '');
const bekle = (ms) => w.waitForTimeout(ms);
const yaz = (s) => w.evaluate((x) => window.ofis.oturumYaz(x), s);

const kayitli = await w.evaluate(async (p) => {
  const b = await window.ofis.baslangic();
  const var_ = b.sirket.projeler.find((x) => x.klasor === p);
  const pr = var_ || (await window.ofis.projeKaydet({ klasor: p, ad: 'Deneme', aciklama: 'Canlı sınama projesi', test: { komut: 'node --test', zorunlu: false } })).proje;
  await window.ofis.sirketGuncelle({ sonProje: pr.id });
  return pr;
}, proje);
console.log('proje:', kayitli.id, kayitli.ad, '| son oturum:', kayitli.sonOturum || 'yok');
await w.locator('#ray button', { hasText: 'Projeler' }).click();
await bekle(300);
await w.locator('#ray button', { hasText: 'Ofis' }).click();
await bekle(800);
const s = await w.evaluate(() => window.ofis.baslangic());
console.log('claude:', JSON.stringify(s.bilgi.claude), '| ekip:', s.sirket.ajanlar.map((a) => a.ad).join(', '));
await w.locator('.dugme', { hasText: process.env.SURDUR ? 'sürdür' : /başlat/i }).first().click();
await bekle(9000);
let e = await ekran();
console.log('--- açılış ---\n' + e.slice(-1500));
await cek('c1-acilis');
// ilk açılış adımları (tema, güvenlik notu, klasöre güven) Enter ile geçilir; giriş ekranında durulur
for (let i = 0; i < 8; i++) {
  const son = e.slice(-1200).replace(/\s/g, '');
  if (/Selectloginmethod|Pastecodehere/i.test(son)) { console.log('GİRİŞ EKRANI: hesap bağlı değil'); break; }
  if (!/Choosethetextstyle|PressEntertocontinue|Securitynotes|trustthisfolder|Doyoutrust|Yes,Itrust|Yes,proceed/i.test(son)) break;
  if (/Yes,Itrustthisfolder/.test(son.slice(-400))) { await yaz('\x1b[B'); await bekle(400); }
  await yaz('\r');
  await bekle(3500);
  e = await ekran();
  console.log(`--- adım ${i + 1} sonrası ---\n` + e.slice(-700));
}
if (mesaj) {
  await yaz(mesaj);
  await bekle(600);
  await yaz('\r');
  const sure = Number(process.env.SURE || 90);
  let sakin = 0;
  for (let i = 0; i < sure / 5; i++) {
    await bekle(5000);
    const d = await w.evaluate(() => window.ofis.durumAl());
    const ozet = (d.ajanlar || []).map((k) => `${k.ad || k.rol}:${k.durum}${k.ozet ? " (" + String(k.ozet).slice(0, 40) + ")" : ""}`).join(' | ');
    console.log(`t+${(i + 1) * 5}s`, ozet);
    if (i < 5 || i === 9) await cek('c2-calisma-' + i);
    const son = (await ekran()).slice(-2500);
    if (process.env.ONAY && /Doyouwant|Allow/i.test(son.replace(/\s/g, '').slice(-600))) { await yaz('\r'); }
    const olay = fs.existsSync(kayit) ? fs.readFileSync(kayit, 'utf8') : '';
    const mesgul = (d.ajanlar || []).some((k) => k.durum === 'calisiyor' || k.durum === 'arastiriyor');
    sakin = /"hook_event_name":"Stop"/.test(olay) && !mesgul ? sakin + 1 : 0;
    if (sakin >= 3) break;
  }
}
await bekle(1500);
await cek('c3-son');
e = await ekran();
fs.writeFileSync(path.join(cikti, 'terminal.txt'), e);
console.log('--- son ekran ---\n' + e.slice(-1800));
console.log('--- durum ---\n' + JSON.stringify(await w.evaluate(() => window.ofis.durumAl()), null, 1).slice(0, 3000));
await w.evaluate(() => window.ofis.oturumDurdur());
await bekle(800);
console.log('--- defter ---\n' + JSON.stringify((await w.evaluate((id) => window.ofis.kayitOku(id), kayitli.id)).kayitlar.map((k) => [k.tur, k.kim || '', String(k.metin).slice(0, 110)]), null, 0).replace(/\],\[/g, '],\n['));
await bekle(1500);
await app.close();
