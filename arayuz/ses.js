// Beynin sesi arayüz tarafı. "sistem" sesi işletim sisteminin sesleriyle burada konuşur.
// ElevenLabs ve OpenAI sesi ana süreçte üretilir, buraya yalnızca ses verisi gelir.
import { depo, api } from './depo.js';

let calan = null;

export function sustur() {
  if (calan) {
    calan.pause();
    calan = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// İşletim sisteminin sesleri, önce şirketin dilindekiler
export function sistemSesleri() {
  return new Promise((coz) => {
    const sy = window.speechSynthesis;
    if (!sy) return coz([]);
    const al = () => {
      const dil = depo.sirket.dil;
      const liste = sy.getVoices().map((v) => ({ id: v.name, ad: `${v.name} (${v.lang})`, dil: v.lang }));
      liste.sort((a, b) => Number(b.dil.toLowerCase().startsWith(dil)) - Number(a.dil.toLowerCase().startsWith(dil)) || a.ad.localeCompare(b.ad));
      return liste;
    };
    const ilk = al();
    if (ilk.length) return coz(ilk);
    // bazı sistemlerde ses listesi geç dolar
    const z = setTimeout(() => coz(al()), 1500);
    sy.addEventListener('voiceschanged', () => {
      clearTimeout(z);
      coz(al());
    }, { once: true });
  });
}

// Döner: hata varsa hata nesnesi, yoksa null
export async function konus(metin, secim = depo.sirket.beyin.ses) {
  if (!secim || secim.tur === 'yok' || !String(metin || '').trim()) return null;
  sustur();
  if (secim.tur === 'sistem') {
    const sy = window.speechSynthesis;
    if (!sy) return { hata: 'ses', ayrinti: 'Bu sistemde konuşma sentezi yok' };
    const duz = String(metin).replace(/```[\s\S]*?```/g, ' ').replace(/[`*#_>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 700);
    const s = new SpeechSynthesisUtterance(duz);
    const ses = sy.getVoices().find((v) => v.name === secim.ses);
    if (ses) s.voice = ses;
    s.lang = ses ? ses.lang : depo.sirket.dil === 'en' ? 'en-US' : 'tr-TR';
    sy.speak(s);
    return null;
  }
  const r = await api.sesUret(metin, secim);
  if (!r || r.hata) return r || { hata: 'ses' };
  calan = new Audio(`data:${r.mime};base64,${r.veri}`);
  try {
    await calan.play();
  } catch (e) {
    return { hata: 'ses', ayrinti: String(e.message || e) };
  }
  return null;
}

// Beynin sesi kapatılabilir (yalnızca bu bilgisayarda hatırlanır)
const ANAHTAR = 'ofis.beyinSessiz';
export function sessizMi() {
  try {
    return localStorage.getItem(ANAHTAR) === '1';
  } catch {
    return false;
  }
}
export function sessizYap(v) {
  try {
    localStorage.setItem(ANAHTAR, v ? '1' : '0');
  } catch {
    /* depolama kapalı */
  }
  if (v) sustur();
}
