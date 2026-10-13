// Paketleme sonrası denetim (electron-builder afterPack). İmzalamadan önce çalışır.
// 1. Uygulama arşivine yalnızca izinli dosyaların girdiğini doğrular. Fazlası varsa derlemeyi durdurur:
//    proje klasöründe duran alakasız bir dosya ya da klasör asla kurulum dosyasına sızmasın.
// 2. Başka işletim sistemlerine ait hazır terminal derlemelerini siler.
// 3. macOS'ta AXe'yi (simülatör dokunma ve canlı görüntü) Resources/axe altına kopyalar. extraResources
//    framework sembolik bağlarını bozduğu için ditto ile kopyalanır; imzalama bundan sonra gelir.
const fs = require('node:fs');
const path = require('node:path');

const IZINLI = new Set(['main.js', 'preload.cjs', 'package.json', 'arayuz', 'cekirdek', 'katalog', 'node_modules']);

exports.default = async function paketSonrasi(context) {
  const platform = context.electronPlatformName; // darwin, win32, linux
  const kaynaklar =
    platform === 'darwin'
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(context.appOutDir, 'resources');

  const asar = require('@electron/asar');
  const arsiv = path.join(kaynaklar, 'app.asar');
  const ust = new Set(asar.listPackage(arsiv).map((p) => p.split(/[\\/]/).filter(Boolean)[0]));
  const fazla = [...ust].filter((x) => x && !IZINLI.has(x));
  if (fazla.length) {
    throw new Error('Pakete girmemesi gereken dosyalar var: ' + fazla.join(', ') + '. package.json içindeki "files" listesini kontrol et.');
  }
  for (const gerekli of ['main.js', 'preload.cjs', 'arayuz', 'cekirdek', 'katalog', 'node_modules']) {
    if (!ust.has(gerekli)) throw new Error('Pakette eksik: ' + gerekli);
  }

  const hazir = path.join(kaynaklar, 'app.asar.unpacked', 'node_modules', 'node-pty', 'prebuilds');
  if (fs.existsSync(hazir)) {
    for (const d of fs.readdirSync(hazir)) {
      // Linux'ta terminal modülü kaynaktan derlenir, hazır derleme gerekmez
      if (platform === 'linux' || !d.startsWith(platform + '-')) {
        fs.rmSync(path.join(hazir, d), { recursive: true, force: true });
        continue;
      }
      // hata ayıklama simgeleri kurulum dosyasını boşuna büyütür
      for (const f of fs.readdirSync(path.join(hazir, d))) if (f.endsWith('.pdb')) fs.rmSync(path.join(hazir, d, f), { force: true });
    }
  }
  if (platform === 'darwin') {
    const axe = path.join(__dirname, 'axe');
    if (!fs.existsSync(path.join(axe, 'axe'))) throw new Error('AXe yok: önce bash betik/axe-indir.sh çalıştır.');
    require('node:child_process').execFileSync('ditto', [axe, path.join(kaynaklar, 'axe')]);
  }
  console.log(`  • paket denetimi   ${[...ust].sort().join(', ')}`);
};
