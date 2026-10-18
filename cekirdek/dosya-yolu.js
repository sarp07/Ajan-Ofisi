// Tarayıcı odasının dosya yolu kuralları: indirilen dosyanın adı ve ajanın yükleyebileceği dosyalar.
import fs from 'node:fs';
import path from 'node:path';

// İndirilen dosya Chrome gibi İndirilenler klasörüne gider; aynı ad varsa "ad (1).uzanti"
export function bosAd(klasor, ad) {
  const temiz = String(ad || 'indirilen').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').slice(0, 180) || 'indirilen';
  const uz = path.extname(temiz);
  const kok = temiz.slice(0, temiz.length - uz.length);
  let aday = temiz;
  for (let i = 1; fs.existsSync(path.join(klasor, aday)) && i < 1000; i++) aday = `${kok} (${i})${uz}`;
  return path.join(klasor, aday);
}

// Ajanın yükleyebileceği dosya: gizli klasörler (.ssh, .aws…) ve sistem klasörleri dışındaki gerçek dosyalar
export function yuklenebilirMi(yol) {
  const tam = path.resolve(String(yol || ''));
  if (!path.isAbsolute(String(yol || ''))) return false;
  const parca = tam.split(path.sep).filter(Boolean);
  if (parca.some((p) => p.startsWith('.') || p === 'Library' || p === 'AppData')) return false;
  try {
    const st = fs.statSync(tam);
    return st.isFile() && st.size <= 500 * 1024 * 1024;
  } catch {
    return false;
  }
}