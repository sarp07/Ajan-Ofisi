// Beynin sesi. "sistem" sesi arayüzde tarayıcının konuşma sentezleyicisiyle çalınır (anahtar gerekmez).
// ElevenLabs ve OpenAI sesleri ana süreçte üretilir: anahtar arayüze hiç gitmez, arayüze yalnızca ses verisi gider.
// Claude'un dışarıya açık bir ses servisi yoktur, bu yüzden Claude motoruyla da bu üç yoldan biri kullanılır.

export const OPENAI_SESLERI = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
const ELEVEN = 'https://api.elevenlabs.io/v1';
const ZAMAN_ASIMI = 30000;

async function istek(url, secenek) {
  const kontrol = new AbortController();
  const z = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI);
  try {
    const r = await fetch(url, { ...secenek, signal: kontrol.signal });
    if (!r.ok) {
      let neden = '';
      try {
        const j = await r.json();
        neden = (j.detail && (j.detail.message || j.detail)) || (j.error && j.error.message) || '';
      } catch {
        neden = '';
      }
      throw new Error(`${r.status} ${typeof neden === 'string' ? neden : JSON.stringify(neden)}`.trim());
    }
    return r;
  } finally {
    clearTimeout(z);
  }
}

// Konuşmaya uygun düz metin: Markdown işaretleri ve kod blokları atılır, uzunluk sınırlanır
export function sesMetni(metin, sinir = 700) {
  const duz = String(metin || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*|__|[*#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (duz.length <= sinir) return duz;
  const kes = duz.slice(0, sinir);
  const son = Math.max(kes.lastIndexOf('. '), kes.lastIndexOf('? '), kes.lastIndexOf('! '));
  return (son > sinir * 0.5 ? kes.slice(0, son + 1) : kes) + '';
}

export async function sesListesi({ tur, anahtar }) {
  if (tur === 'openai') return OPENAI_SESLERI.map((id) => ({ id, ad: id[0].toUpperCase() + id.slice(1) }));
  if (tur !== 'elevenlabs') return [];
  if (!anahtar) throw new Error('ElevenLabs anahtarı yok');
  const r = await istek(`${ELEVEN}/voices`, { headers: { 'xi-api-key': anahtar } });
  const j = await r.json();
  return (Array.isArray(j.voices) ? j.voices : [])
    .map((v) => {
      const l = v.labels || {};
      const ek = [l.gender, l.accent, l.language].filter((x) => typeof x === 'string' && x).join(', ');
      return { id: String(v.voice_id), ad: String(v.name || v.voice_id) + (ek ? ` (${ek})` : '') };
    })
    .slice(0, 200);
}

// Döner: { veri: base64, mime }
export async function sesUret({ tur, ses, metin, anahtar }) {
  const yazi = sesMetni(metin);
  if (!yazi) throw new Error('Okunacak metin yok');
  if (!anahtar) throw new Error('Ses servisi anahtarı yok');
  let r;
  if (tur === 'elevenlabs') {
    if (!ses) throw new Error('ElevenLabs sesi seçilmedi');
    r = await istek(`${ELEVEN}/text-to-speech/${encodeURIComponent(ses)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': anahtar, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: yazi, model_id: 'eleven_multilingual_v2' }),
    });
  } else if (tur === 'openai') {
    r = await istek('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + anahtar, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: OPENAI_SESLERI.includes(ses) ? ses : 'alloy', input: yazi, response_format: 'mp3' }),
    });
  } else {
    throw new Error('Bu ses türü ana süreçte üretilmez');
  }
  const tampon = Buffer.from(await r.arrayBuffer());
  return { veri: tampon.toString('base64'), mime: 'audio/mpeg' };
}
