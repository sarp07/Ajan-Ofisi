// Tasarım odası: katın tasarımları proje klasöründe designs/0001, designs/0002… klasörlerinde durur.
// Her tasarım sayfa adlarıyla HTML dosyalarından oluşur (index.html, fiyatlar.html…); görseller assets klasöründe.
import fs from 'node:fs';
import path from 'node:path';
import { ilkeMetni } from './ilkeler.js';

export const TASARIM_KLASORU = 'designs';
const NO = /^\d{4}$/;
const SAYFA = /\.html?$/i;

export const tasarimKoku = (projeKlasoru) => path.join(projeKlasoru, TASARIM_KLASORU);

// Tasarımlar (yeniden eskiye) ve sayfaları. index.html her zaman ilk sayfadır.
export function tasarimListesi(projeKlasoru) {
  const kok = tasarimKoku(projeKlasoru);
  let girdiler = [];
  try {
    girdiler = fs.readdirSync(kok, { withFileTypes: true });
  } catch {
    return [];
  }
  const sonuc = [];
  for (const e of girdiler) {
    if (!e.isDirectory() || !NO.test(e.name)) continue;
    const dir = path.join(kok, e.name);
    let girdi = [];
    try {
      girdi = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    // sayfalar: tasarımın kökündeki HTML dosyaları ve bir alt klasördekiler (ör. dil klasörleri: en/index.html)
    const dosyalar = girdi.filter((d) => d.isFile() && SAYFA.test(d.name)).map((d) => ({ name: d.name }));
    for (const d of girdi) {
      if (!d.isDirectory() || d.name === 'assets' || d.name.startsWith('.')) continue;
      try {
        for (const a of fs.readdirSync(path.join(dir, d.name), { withFileTypes: true })) if (a.isFile() && SAYFA.test(a.name)) dosyalar.push({ name: d.name + '/' + a.name });
      } catch {
        /* okunamadı */
      }
    }
    // plan (SPEC.md gibi) ve diğer dosyaların sayısı: tasarımcı daha sayfa yazmadan ilerlemeyi gösterir
    const plan = (girdi.find((d) => d.isFile() && /^(spec|plan|brief)[\w-]*\.md$/i.test(d.name)) || girdi.find((d) => d.isFile() && /\.md$/i.test(d.name)) || {}).name || '';
    let dosyaSayisi = 0;
    const say = (d, derin) => {
      if (derin > 3 || dosyaSayisi > 2000) return;
      try {
        for (const a of fs.readdirSync(d, { withFileTypes: true })) {
          if (a.isDirectory()) say(path.join(d, a.name), derin + 1);
          else if (a.isFile()) dosyaSayisi++;
        }
      } catch {
        /* okunamadı */
      }
    };
    say(dir, 0);
    let z = 0;
    const sayfalar = dosyalar
      .map((d) => {
        let st = null;
        try {
          st = fs.statSync(path.join(dir, d.name));
        } catch {
          /* silinmiş */
        }
        if (st && st.mtimeMs > z) z = st.mtimeMs;
        return { dosya: d.name, ad: d.name.replace(SAYFA, ''), z: st ? st.mtimeMs : 0 };
      })
      .sort((a, b) => (a.ad === 'index' ? -1 : b.ad === 'index' ? 1 : a.ad.localeCompare(b.ad, 'tr')));
    if (!z) {
      try {
        z = fs.statSync(dir).mtimeMs;
      } catch {
        z = 0;
      }
    }
    sonuc.push({ id: e.name, sayfalar, z, plan, dosyaSayisi });
  }
  return sonuc.sort((a, b) => b.id.localeCompare(a.id));
}

// Sıradaki boş tasarım klasörü (0001, 0002…). Döner: kimlik
export function yeniTasarim(projeKlasoru) {
  const kok = tasarimKoku(projeKlasoru);
  fs.mkdirSync(kok, { recursive: true });
  const enBuyuk = fs
    .readdirSync(kok)
    .filter((a) => NO.test(a))
    .reduce((m, a) => Math.max(m, Number(a)), 0);
  if (enBuyuk >= 9999) throw new Error('Tasarım sayısı sınırına ulaşıldı');
  const id = String(enBuyuk + 1).padStart(4, '0');
  fs.mkdirSync(path.join(kok, id, 'assets'), { recursive: true });
  return id;
}

// designs klasörünün içinde kalan güvenli yol; dışarı çıkan yol null döner
export function tasarimYolu(projeKlasoru, goreli) {
  const kok = path.resolve(tasarimKoku(projeKlasoru));
  const tam = path.resolve(kok, String(goreli || '').replace(/^\/+/, ''));
  return tam === kok || tam.startsWith(kok + path.sep) ? tam : null;
}

export const gecerliTasarim = (id) => typeof id === 'string' && NO.test(id);

// Tasarımın planı (Markdown) okunur: önizleme alanında gösterilir
export function tasarimPlani(projeKlasoru, id, dosya) {
  if (!gecerliTasarim(id) || !/^[\w.-]+\.md$/i.test(String(dosya || ''))) return '';
  const yol = tasarimYolu(projeKlasoru, id + '/' + dosya);
  try {
    return yol ? fs.readFileSync(yol, 'utf8').slice(0, 40000) : '';
  } catch {
    return '';
  }
}

// Önizlemeye seçici katmanı eklenir: öğe seçme ve canlı düzenleme bununla yapılır (dosyaya yazılmaz)
export function seciciEkle(html, betik) {
  const etiket = `<script>${betik}</script>`;
  const i = html.search(/<\/body\s*>/i);
  return i >= 0 ? html.slice(0, i) + etiket + html.slice(i) : html + etiket;
}

const TASARIM_SKILLERI = ['frontend-design', 'impeccable', 'ui-ux-pro-max', 'web-design-guidelines'];

// Tasarımcının talimatı. skiller: [{ id, yol }] (kurulu ve açık olanlar)
export function tasarimMetni({ dil = 'tr', sirketAd = '', ad = '', proje = null, skiller = [], sahip = '' }) {
  const en = dil === 'en';
  const kok = proje ? tasarimKoku(proje.klasor) : TASARIM_KLASORU;
  const uygun = skiller.filter((s) => TASARIM_SKILLERI.includes(s.id));
  const b = [];
  if (en) {
    b.push(`You are ${ad}, the designer of ${sirketAd || 'the company'}. You work in the design room of the "${proje ? proje.ad : ''}" floor. ${sahip || 'The owner'} describes what they want in the chat; you design it as real HTML pages and the owner watches the live preview next to the chat.`);
    b.push(
      [
        '## Where you write',
        `- Designs live in ${kok}. Each design is a numbered folder: 0001, 0002, 0003… Every message tells you the active design and page as "[Design 0001 · page: index.html]". Work only in that folder unless the owner asks for a new design.`,
        '- Each page is its own HTML file named after the page: index.html (home), pricing.html, about.html, contact.html… Link pages to each other with relative links (href="pricing.html").',
        '- Put images and other files in the design\'s assets folder and reference them relatively (assets/logo.png). Files the owner attaches are copied there for you.',
        '- Never write outside the designs folder. Do not touch the project\'s source code, do not run builds, do not install packages and do not start servers. Read the project files only when you need its brand, colors, copy or structure.',
      ].join('\n')
    );
    b.push(
      [
        '## How you build',
        '- Output is always HTML. Every page is a complete, standalone HTML document that opens directly from the file: inline <style>, optional inline <script>. A CDN link is fine only when it truly adds value (a web font, an icon set).',
        '- Responsive by default: it must look right on desktop, tablet (768px) and mobile (390px).',
        '- Use semantic structure: <header>, <nav>, <main>, <section>, <footer>, real <button> and <a> elements. Give every main section a clear id or class (hero, features, pricing…) so the owner can select it and talk about it.',
        '- Design with a clear point of view: real hierarchy, considered type, spacing and color, believable copy in the owner\'s language. No lorem ipsum, no generic template look.',
        '- Keep pages light so the preview stays fast: no huge images, no heavy libraries, no endless animations.',
        uygun.length ? `- Design skills: read and follow these before you design: ${uygun.map((s) => `${s.id} (${s.yol})`).join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
    b.push(
      [
        '## Mobile apps',
        '- When the owner asks for a mobile app (iOS, Android or both), every screen is its own HTML page named after the screen (giris.html, index.html as the home screen, profil.html, ayarlar.html…) and the pages together work as a clickable prototype: tabs, buttons and back arrows link to the next screen.',
        '- Design for a phone viewport of about 390×844: respect safe areas (padding with env(safe-area-inset-top) and env(safe-area-inset-bottom), at least 47px at the top for the status bar and 34px at the bottom for the home indicator), keep touch targets at least 44px, use a bottom tab bar or native style navigation, and system fonts (-apple-system for iOS, Roboto for Android).',
        '- The body fills the screen (min-height: 100dvh) and does not scroll sideways. When the message says "device: iPhone" or "device: Android", follow that platform\'s conventions (iOS: large titles, sheets, SF style; Android: Material 3, top app bar, FAB).',
      ].join('\n')
    );
    b.push(
      [
        '## Editing',
        '- When a message includes "[Selected element]", it names the page, a CSS path, the element\'s HTML and its current styles. Change exactly that element (or its section if asked) in the source file and leave the rest as it is.',
        '- "[Direct edits]" lists changes the owner already tried in the live preview (text, color, size, spacing). Write them into the source file faithfully.',
        '- After every change, reply in one or two short sentences: what you changed and on which page. Do not paste the code into the chat; the preview refreshes on its own.',
        '- Ask a short question only when a choice really matters (audience, brand, page list). Otherwise make a good decision and build.',
      ].join('\n')
    );
  } else {
    b.push(`Sen ${ad}, ${sirketAd || 'şirketin'} tasarımcısısın. "${proje ? proje.ad : ''}" katının tasarım odasında çalışıyorsun. ${sahip || 'Sahip'} ne istediğini sohbette anlatır; sen bunu gerçek HTML sayfaları olarak tasarlarsın, sahip sohbetin yanındaki canlı önizlemeden izler.`);
    b.push(
      [
        '## Nereye yazarsın',
        `- Tasarımlar ${kok} klasöründe. Her tasarım numaralı bir klasördür: 0001, 0002, 0003… Her mesajda etkin tasarım ve sayfa "[Tasarım 0001 · sayfa: index.html]" diye gelir. Sahip yeni tasarım istemedikçe yalnızca o klasörde çalış.`,
        '- Her sayfa kendi adıyla ayrı bir HTML dosyasıdır: index.html (ana sayfa), fiyatlar.html, hakkimizda.html, iletisim.html… Sayfaları birbirine göreli bağlantıyla bağla (href="fiyatlar.html").',
        '- Görselleri ve diğer dosyaları tasarımın assets klasörüne koy, göreli yolla kullan (assets/logo.png). Sahibin eklediği dosyalar oraya kopyalanır.',
        '- designs klasörünün dışına asla yazma. Projenin kaynak koduna dokunma, derleme çalıştırma, paket kurma, sunucu başlatma. Proje dosyalarını yalnızca marka, renk, metin ya da yapı gerektiğinde oku.',
      ].join('\n')
    );
    b.push(
      [
        '## Nasıl kurarsın',
        '- Çıktı her zaman HTML. Her sayfa dosyadan doğrudan açılan, tek başına tam bir HTML belgesidir: satır içi <style>, gerekirse satır içi <script>. CDN bağlantısını yalnızca gerçekten değer katıyorsa kullan (yazı tipi, simge seti).',
        '- Varsayılan olarak duyarlı: masaüstü, tablet (768px) ve mobilde (390px) düzgün görünmeli.',
        '- Anlamlı yapı kullan: <header>, <nav>, <main>, <section>, <footer>, gerçek <button> ve <a> öğeleri. Her ana bölüme açık bir id ya da sınıf ver (hero, ozellikler, fiyatlar…) ki sahip onu seçip konuşabilsin.',
        '- Net bir bakış açısıyla tasarla: gerçek hiyerarşi, düşünülmüş yazı tipi, boşluk ve renk, sahibin dilinde inandırıcı metin. Lorem ipsum yok, hazır şablon görüntüsü yok.',
        '- Önizleme hızlı kalsın diye sayfaları hafif tut: dev görseller, ağır kütüphaneler, bitmeyen animasyonlar yok.',
        uygun.length ? `- Tasarım skilleri: tasarlamadan önce bunları oku ve uygula: ${uygun.map((s) => `${s.id} (${s.yol})`).join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
    b.push(
      [
        '## Mobil uygulamalar',
        '- Sahip mobil uygulama isterse (iOS, Android ya da ikisi) her ekran ekranın adıyla ayrı bir HTML sayfasıdır (giris.html, ana ekran olarak index.html, profil.html, ayarlar.html…) ve sayfalar birlikte tıklanabilir bir prototip gibi çalışır: sekmeler, butonlar ve geri okları sonraki ekrana bağlanır.',
        '- Yaklaşık 390×844 telefon ekranı için tasarla: güvenli alanlara uy (env(safe-area-inset-top) ve env(safe-area-inset-bottom) ile boşluk, üstte durum çubuğu için en az 47px, altta ana ekran çizgisi için 34px), dokunma alanları en az 44px olsun, alt sekme çubuğu ya da yerel tarzda gezinme kullan, sistem yazı tiplerini kullan (iOS için -apple-system, Android için Roboto).',
        '- Gövde ekranı doldurur (min-height: 100dvh), yana kaymaz. Mesajda "cihaz: iPhone" ya da "cihaz: Android" yazıyorsa o platformun alışkanlıklarına uy (iOS: büyük başlıklar, alttan açılan sayfalar, SF tarzı; Android: Material 3, üst uygulama çubuğu, yüzen eylem butonu).',
      ].join('\n')
    );
    b.push(
      [
        '## Düzenleme',
        '- Mesajda "[Seçili öğe]" varsa sayfayı, CSS yolunu, öğenin HTML\'ini ve şu anki stillerini verir. Kaynak dosyada tam olarak o öğeyi (istenirse bölümünü) değiştir, gerisine dokunma.',
        '- "[Doğrudan düzenlemeler]" sahibin canlı önizlemede denediği değişikliklerdir (metin, renk, boyut, boşluk). Bunları kaynak dosyaya aynen işle.',
        '- Her değişiklikten sonra bir iki kısa cümleyle cevap ver: neyi, hangi sayfada değiştirdin. Kodu sohbete yapıştırma; önizleme kendiliğinden yenilenir.',
        '- Yalnızca seçim gerçekten önemliyse kısa bir soru sor (hedef kitle, marka, sayfa listesi). Yoksa iyi bir karar verip kur.',
      ].join('\n')
    );
  }
  // ortak çalışma ilkeleri; tasarım skillerinin kalite çıtası önce gelir
  b.push(ilkeMetni(dil));
  return b.join('\n\n') + '\n';
}
