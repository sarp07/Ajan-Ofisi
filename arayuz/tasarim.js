// Tasarım odası çalışma alanı: solda sohbet (ofis sayfasının konuşma paneli buraya taşınır), ortada canlı önizleme,
// sağda seçilen öğenin denetçisi. Tasarımlar katın designs/0001… klasörlerinde, her sayfa ayrı HTML dosyasıdır.
// Önizleme kum havuzlu çerçevede açılır ve iki tamponludur: yeni hali arkada yüklenir, hazır olunca öne geçer.
import { h, doldur, ikon, ayirici, mdMetin, saatYaz } from './dom.js';
import { depo, api, bildir, hataMetni } from './depo.js';

// [ad, simge, genişlik, yükseklik]: telefonlar gerçek ekran ölçüsünde, sahneye sığacak kadar küçültülerek gösterilir
const CIHAZLAR = [
  ['masaustu', 'ekran', 0, 0],
  ['tablet', 'tablet', 820, 0],
  ['iphone', 'telefon', 393, 852],
  ['android', 'android', 412, 915],
];
const CIHAZ_ADI = { iphone: 'iPhone 393×852', android: 'Android 412×915', tablet: 'Tablet 820' };
const STIL_ALANLARI = [
  ['color', 'renk'],
  ['backgroundColor', 'renk'],
  ['fontSize', 'px'],
  ['fontWeight', 'secim', ['300', '400', '500', '600', '700', '800']],
  ['textAlign', 'secim', ['left', 'center', 'right']],
  ['padding', 'metin'],
  ['margin', 'metin'],
  ['gap', 'metin'],
  ['borderRadius', 'px'],
];
const CSS_ADI = { color: 'color', backgroundColor: 'background-color', fontSize: 'font-size', fontWeight: 'font-weight', textAlign: 'text-align', padding: 'padding', margin: 'margin', gap: 'gap', borderRadius: 'border-radius' };

const saklanan = (ad, vars) => {
  try {
    return localStorage.getItem(ad) ?? vars;
  } catch {
    return vars;
  }
};
const sakla = (ad, deger) => {
  try {
    localStorage.setItem(ad, deger);
  } catch {
    /* depolama kapalı */
  }
};

// rgb(…) → #rrggbb (renk seçici için); saydamsa boş
function onaltilik(renk) {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(String(renk || ''));
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return '';
  return '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
}

export function tasarimAlani({ baslat, sohbetOner, katlar, katSec }) {
  const tt = (k, d) => depo.t(k, d);
  let katId = null;
  let liste = [];
  let etkin = null; // tasarım kimliği (0001)
  let sayfa = null; // dosya adı (index.html)
  let cihaz = saklanan('tasarim.cihaz', 'masaustu');
  if (cihaz === 'mobil') cihaz = 'iphone';
  if (!CIHAZLAR.some((c) => c[0] === cihaz)) cihaz = 'masaustu';
  let secimModu = false;
  let secili = null; // seçicinin gönderdiği öğe bilgisi
  let baglaSohbete = true;
  let bekleyen = new Map(); // yol|özellik → { yol, ad, ozellik, eski, deger }
  let surum = 0;
  let kaydirY = 0;
  let menuAcik = false;
  let gorunur = false;
  // süreç: tasarımcının adımları (canlı akıştan), son yazılan dosyalar ve plan
  let sonDosyalar = [];
  let plan = { anahtar: '', metin: '' };
  let planAcik = false;
  let cekmeceAcik = false;
  let surecIzi = '';

  // ---------- iskelet ----------
  const sohbetYuva = h('div', { class: 'tsSohbetYuva' });
  const sohbetKap = h('aside', { class: 'tsSohbet' }, sohbetYuva);
  const tasarimSecici = h('button', { type: 'button', class: 'tsTasarimDugme', 'aria-haspopup': 'menu', onclick: (e) => (e.stopPropagation(), menuAc(!menuAcik)) });
  const menu = h('div', { class: 'tsMenu', role: 'menu', hidden: true });
  const sayfalarEl = h('div', { class: 'tsSayfalar', role: 'tablist' });
  const secDugme = h('button', { type: 'button', class: 'tsArac', 'aria-pressed': 'false', onclick: () => secimAyarla(!secimModu) }, ikon('hedef', 15), h('span', null), h('kbd', null, 'V'));
  const cihazEl = h('div', { class: 'tsCihazlar', role: 'radiogroup' });
  const yenileDugme = h('button', { type: 'button', class: 'tsArac simgeli', onclick: () => yukle(true) }, ikon('yenile', 15));
  const klasorDugme = h('button', { type: 'button', class: 'tsArac simgeli', onclick: () => katId && api.tasarimKlasor(katId, etkin || '') }, ikon('klasor', 15));
  const ust = h('header', { class: 'tsUst' }, h('div', { class: 'tsSecimKap' }, tasarimSecici, menu), sayfalarEl, h('div', { class: 'tsBosluk' }), secDugme, cihazEl, yenileDugme, klasorDugme);
  const cerceveA = h('iframe', { class: 'tsOnizleme', sandbox: 'allow-scripts allow-forms allow-modals allow-popups', referrerpolicy: 'no-referrer' });
  const cerceveB = h('iframe', { class: 'tsOnizleme arka', sandbox: 'allow-scripts allow-forms allow-modals allow-popups', referrerpolicy: 'no-referrer' });
  let on = cerceveA;
  let arka = cerceveB;
  const cerceveKap = h('div', { class: 'tsCerceve' }, cerceveA, cerceveB);
  const calisiyorEl = h('button', { type: 'button', class: 'tsCalisiyor', hidden: true, 'aria-expanded': 'false', onclick: () => ((cekmeceAcik = !cekmeceAcik), (surecIzi = ''), surecTazele()) });
  const cekmece = h('div', { class: 'tsCekmece', hidden: true });
  const bosEl = h('div', { class: 'tsBos', hidden: true });
  const sahne = h('div', { class: 'tsSahne' }, cerceveKap, bosEl, calisiyorEl, cekmece);
  const tuval = h('section', { class: 'tsTuval' }, ust, sahne);
  const denetci = h('aside', { class: 'tsDenetci', hidden: true });

  // sohbet sütunu sürüklenerek genişler, ölçü hatırlanır
  let ilk = 0;
  const sohbetAyirici = ayirici({
    yon: 'dikey',
    etiket: 'tasarim-sohbet',
    basla: () => (ilk = sohbetKap.getBoundingClientRect().width),
    ayarla: (f) => {
      const w = Math.round(Math.max(300, Math.min(640, ilk + f)));
      sohbetKap.style.width = w + 'px';
    },
    bitir: () => sakla('tasarim.sohbet', String(Math.round(sohbetKap.getBoundingClientRect().width))),
    sifirla: () => ((sohbetKap.style.width = ''), sakla('tasarim.sohbet', '')),
  });
  const kayitliGenislik = Number(saklanan('tasarim.sohbet', '')) || 0;
  if (kayitliGenislik) sohbetKap.style.width = kayitliGenislik + 'px';
  const kok = h('div', { class: 'tasarim' }, sohbetKap, sohbetAyirici, tuval, denetci);

  document.addEventListener('click', (e) => {
    if (menuAcik && !menu.contains(e.target)) menuAc(false);
  });

  // ---------- önizleme ----------
  const adres = (s = sayfa) => `tasarim://${katId}/${etkin}/${s.split('/').map(encodeURIComponent).join('/')}?v=${++surum}${kaydirY ? '&ofisY=' + kaydirY : ''}`;
  const yolla = (cerceve, veri) => cerceve.contentWindow && cerceve.contentWindow.postMessage({ ofisTasarim: true, ...veri }, '*');

  // Sayfa seçici katmanı çalıştırmadan açılırsa (bozuk HTML, hata sayfası) yine de öne alınır: önizleme boş kalmaz
  function oneAl() {
    [on, arka] = [arka, on];
    on.classList.remove('arka');
    arka.classList.add('arka');
    // eski tampon boşaltılır: bellekte tek sayfa kalır
    setTimeout(() => arka.classList.contains('arka') && arka.removeAttribute('src'), 50);
  }
  for (const c of [cerceveA, cerceveB]) {
    c.addEventListener('load', () => {
      if (c !== arka || !c.getAttribute('src')) return;
      const src = c.getAttribute('src');
      setTimeout(() => c === arka && c.getAttribute('src') === src && oneAl(), 400);
    });
  }

  function yukle(elle = false) {
    if (!gorunur || !katId || !etkin || !sayfa) {
      on.removeAttribute('src');
      arka.removeAttribute('src');
      return;
    }
    if (elle) {
      bekleyen.clear();
      denetciCiz();
    }
    // arka tamponda yüklenir, "yuklendi" gelince öne alınır (titreme olmaz)
    arka.src = adres();
  }

  addEventListener('message', (e) => {
    const d = e.data;
    if (!gorunur || !d || !d.ofisTasarim) return;
    const kaynakOn = e.source === on.contentWindow;
    const kaynakArka = e.source === arka.contentWindow;
    if (!kaynakOn && !kaynakArka) return;
    if (d.tur === 'yuklendi') {
      if (kaynakArka) oneAl();
      yolla(on, { tur: 'mod', secim: secimModu });
      if (secili) yolla(on, { tur: 'gorunum', yol: secili.yol });
      // bekleyen canlı düzenlemeler yeniden yüklemede kaybolmasın
      for (const b of bekleyen.values()) yolla(on, b.ozellik === 'metin' ? { tur: 'metin', yol: b.yol, deger: b.deger } : b.ozellik === 'gorsel' ? { tur: 'gorsel', yol: b.yol, deger: b.deger } : { tur: 'stil', yol: b.yol, ozellik: b.ozellik, deger: b.deger });
      // önizlemede bağlantıyla başka sayfaya geçildiyse sekme de değişir
      const s = String(d.sayfa || '');
      if (s && s !== sayfa && sayfalar().some((x) => x.dosya === s)) {
        sayfa = s;
        kaydirY = 0;
        sayfalarCiz();
      }
      return;
    }
    if (!kaynakOn) return;
    if (d.tur === 'secildi') {
      secili = d.bilgi || null;
      denetciCiz();
    } else if (d.tur === 'secimKapat') secimAyarla(false);
    else if (d.tur === 'duzenleme' && d.duzen) {
      bekleyenEkle(d.duzen);
      if (secili && secili.yol === d.duzen.yol && d.duzen.ozellik === 'metin') secili = { ...secili, metin: d.duzen.deger };
      denetciCiz();
    } else if (d.tur === 'kaydir') kaydirY = Math.max(0, Number(d.y) || 0);
  });

  // ---------- veri ----------
  const tasarim = () => liste.find((x) => x.id === etkin) || null;
  const sayfalar = () => (tasarim() || { sayfalar: [] }).sayfalar;

  async function listeYukle(yuklesin = true) {
    if (!katId) return;
    const istenen = katId;
    const r = await api.tasarimListe(katId);
    if (istenen !== katId || !r || r.hata) return;
    liste = r.liste || [];
    if (!liste.some((x) => x.id === etkin)) {
      etkin = saklanan('tasarim.etkin.' + katId, '');
      if (!liste.some((x) => x.id === etkin)) etkin = liste[0] ? liste[0].id : null;
      if (etkin) api.tasarimEtkin(katId, etkin);
      sayfa = null;
    }
    const ss = sayfalar();
    if (!ss.some((x) => x.dosya === sayfa)) {
      sayfa = ss[0] ? ss[0].dosya : null;
      kaydirY = 0;
    }
    ciz();
    if (yuklesin) yukle();
  }

  function tasarimSec(id) {
    if (!id || id === etkin) return menuAc(false);
    etkin = id;
    sayfa = null;
    kaydirY = 0;
    secili = null;
    bekleyen.clear();
    sakla('tasarim.etkin.' + katId, id);
    api.tasarimEtkin(katId, id);
    menuAc(false);
    const ss = sayfalar();
    sayfa = ss[0] ? ss[0].dosya : null;
    ciz();
    yukle();
  }

  async function yeniTasarim() {
    menuAc(false);
    const r = await api.tasarimYeni(katId);
    if (!r || r.hata || !r.id) return bildir(hataMetni(r), true);
    etkin = r.id;
    sakla('tasarim.etkin.' + katId, r.id);
    sayfa = null;
    secili = null;
    bekleyen.clear();
    await listeYukle();
    sohbetOner('');
  }

  function sayfaSec(dosya) {
    if (dosya === sayfa) return;
    sayfa = dosya;
    kaydirY = 0;
    secili = null;
    bekleyen.clear();
    sayfalarCiz();
    denetciCiz();
    yukle();
  }

  // ---------- seçim ----------
  function secimAyarla(acik) {
    secimModu = !!acik;
    secDugme.setAttribute('aria-pressed', secimModu ? 'true' : 'false');
    secDugme.classList.toggle('etkin', secimModu);
    sahne.classList.toggle('seciliyor', secimModu);
    yolla(on, { tur: 'mod', secim: secimModu });
  }

  function ataSec(yol) {
    yolla(on, { tur: 'sec', yol });
  }

  function seciliBirak() {
    secili = null;
    yolla(on, { tur: 'birak' });
    denetciCiz();
  }

  function bekleyenEkle(d) {
    const anahtar = d.yol + '|' + d.ozellik;
    const onceki = bekleyen.get(anahtar);
    bekleyen.set(anahtar, { ...d, eski: onceki ? onceki.eski : d.eski });
  }

  function stilUygula(ozellik, deger) {
    if (!secili) return;
    yolla(on, { tur: 'stil', yol: secili.yol, ozellik, deger });
    bekleyenEkle({ yol: secili.yol, ad: secili.ad, ozellik, eski: (secili.stil || {})[ozellik] || '', deger });
    secili = { ...secili, stil: { ...secili.stil, [ozellik]: deger } };
    bekleyenCiz();
  }

  function metinUygula(deger) {
    if (!secili) return;
    yolla(on, { tur: 'metin', yol: secili.yol, deger });
    bekleyenEkle({ yol: secili.yol, ad: secili.ad, ozellik: 'metin', eski: secili.metin || '', deger });
    secili = { ...secili, metin: deger };
    bekleyenCiz();
  }

  async function gorselDegistir() {
    if (!secili) return;
    const r = await api.odaEkle('tasarim:' + katId);
    if (!r || r.iptal) return;
    if (r.hata || !r.eklenen || !r.eklenen[0]) return bildir(hataMetni(r), true);
    const yeni = 'assets/' + r.eklenen[0].ad;
    yolla(on, { tur: 'gorsel', yol: secili.yol, deger: yeni });
    bekleyenEkle({ yol: secili.yol, ad: secili.ad, ozellik: 'gorsel', eski: secili.kaynak || '', deger: yeni });
    secili = { ...secili, kaynak: yeni };
    denetciCiz();
  }

  // ---------- tasarımcıya giden metin ----------
  const en = () => depo.sirket && depo.sirket.dil === 'en';
  // telefon ya da tablet seçiliyse tasarımcı o ekranı da bilir
  const cihazEki = () => (CIHAZ_ADI[cihaz] ? (en() ? ` · device: ${CIHAZ_ADI[cihaz]}` : ` · cihaz: ${CIHAZ_ADI[cihaz]}`) : '');
  const basSatiri = () => (etkin ? (en() ? `[Design ${etkin} · page: ${sayfa || 'index.html'}${cihazEki()}]` : `[Tasarım ${etkin} · sayfa: ${sayfa || 'index.html'}${cihazEki()}]`) : '');
  function ogeMetni(o) {
    const stil = Object.entries(o.stil || {})
      .filter(([k]) => CSS_ADI[k])
      .map(([k, v]) => `${CSS_ADI[k]}: ${v}`)
      .join('; ');
    return en()
      ? `[Selected element] page: ${o.sayfa || sayfa} · path: ${o.yol} · type: ${o.tur}\nHTML: ${o.html}\nStyles: ${stil}`
      : `[Seçili öğe] sayfa: ${o.sayfa || sayfa} · yol: ${o.yol} · tür: ${o.tur}\nHTML: ${o.html}\nStiller: ${stil}`;
  }
  function duzenMetni() {
    const satir = [...bekleyen.values()].map((b) => {
      const ad = CSS_ADI[b.ozellik] || (b.ozellik === 'metin' ? (en() ? 'text' : 'metin') : b.ozellik === 'gorsel' ? (en() ? 'image src' : 'görsel src') : b.ozellik);
      return `- ${b.yol} (${b.ad}): ${ad} "${String(b.eski).slice(0, 200)}" → "${String(b.deger).slice(0, 600)}"`;
    });
    return (en() ? '[Direct edits] Write these changes I tried in the live preview into the source file of this page:' : '[Doğrudan düzenlemeler] Canlı önizlemede denediğim şu değişiklikleri bu sayfanın kaynak dosyasına işle:') + '\n' + satir.join('\n');
  }

  // Sohbetten giden mesajın başına etkin tasarım ve (bağlıysa) seçili öğe eklenir. Tasarım yoksa 0001 açılır.
  async function baglamAl() {
    if (!katId) return '';
    if (!etkin) {
      const r = await api.tasarimYeni(katId);
      if (r && r.id) {
        etkin = r.id;
        sakla('tasarim.etkin.' + katId, r.id);
        listeYukle();
      }
    }
    const parca = [basSatiri()];
    if (secili && baglaSohbete) parca.push(ogeMetni(secili));
    return parca.filter(Boolean).join('\n');
  }

  async function tasarimciyaYaz(metin) {
    if (!depo.oturum.acik) return bildir(tt('sohbet.kapali'), true);
    const r = await api.sohbetYaz('tasarim:' + katId, metin);
    if (r && r.hata) bildir(hataMetni(r), true);
    return r && !r.hata;
  }

  async function duzenleriKaydet() {
    if (!bekleyen.size) return;
    const ok = await tasarimciyaYaz([basSatiri(), duzenMetni()].join('\n'));
    if (ok) {
      bekleyen.clear();
      denetciCiz();
    }
  }

  // ---------- çizim ----------
  function menuAc(acik) {
    menuAcik = !!acik;
    menu.hidden = !menuAcik;
    tasarimSecici.setAttribute('aria-expanded', menuAcik ? 'true' : 'false');
    if (!menuAcik) return;
    const simdi = Date.now();
    const zaman = (z) => {
      const dk = Math.round((simdi - z) / 60000);
      return dk < 1 ? tt('tasarim.az') : dk < 60 ? tt('tasarim.dk', { x: dk }) : dk < 1440 ? tt('tasarim.sa', { x: Math.round(dk / 60) }) : new Date(z).toLocaleDateString();
    };
    const kl = katlar();
    doldur(
      menu,
      // kat değiştirme: tasarımlar katın kendi klasöründe durur
      kl.length > 1
        ? h(
            'div',
            { class: 'tsMenuKatlar' },
            h('span', { class: 'tsMenuEtiket' }, tt('tasarim.kat')),
            h(
              'div',
              { class: 'tsMenuKatListe' },
              kl.map((p) => h('button', { type: 'button', class: 'tsMenuKat' + (p.id === katId ? ' secili' : ''), 'aria-pressed': p.id === katId ? 'true' : 'false', onclick: () => (menuAc(false), p.id !== katId && katSec(p.id)) }, p.ad))
            )
          )
        : null,
      h('span', { class: 'tsMenuEtiket' }, tt('tasarim.tasarimlar')),
      liste.length
        ? liste.slice(0, 60).map((x) =>
            h(
              'button',
              { type: 'button', role: 'menuitemradio', 'aria-checked': x.id === etkin ? 'true' : 'false', class: 'tsMenuOge' + (x.id === etkin ? ' secili' : ''), onclick: () => tasarimSec(x.id) },
              h('b', null, x.id),
              h('span', null, x.sayfalar.length ? x.sayfalar.map((s) => s.ad).slice(0, 4).join(', ') + (x.sayfalar.length > 4 ? '…' : '') : tt('tasarim.bosTasarim')),
              h('small', null, zaman(x.z))
            )
          )
        : h('p', { class: 'tsMenuBos' }, tt('tasarim.henuzYok')),
      h('button', { type: 'button', class: 'tsMenuYeni', role: 'menuitem', onclick: () => yeniTasarim() }, ikon('arti', 14), tt('tasarim.yeni'))
    );
  }

  function sayfalarCiz() {
    const ss = sayfalar();
    doldur(
      sayfalarEl,
      ss.map((s) =>
        h(
          'button',
          { type: 'button', role: 'tab', class: 'tsSayfa' + (s.dosya === sayfa ? ' secili' : ''), 'aria-selected': s.dosya === sayfa ? 'true' : 'false', title: s.dosya, onclick: () => sayfaSec(s.dosya) },
          s.ad === 'index' ? tt('tasarim.anaSayfa') : s.ad
        )
      ),
      etkin
        ? h(
            'button',
            {
              type: 'button',
              class: 'tsSayfa ekle',
              title: tt('tasarim.sayfaEkle'),
              'aria-label': tt('tasarim.sayfaEkle'),
              onclick: () => sohbetOner(tt('tasarim.sayfaEkleOneri')),
            },
            ikon('arti', 13)
          )
        : null
    );
  }

  function ustCiz() {
    const kat = katlar().find((p) => p.id === katId);
    doldur(tasarimSecici, ikon('firca', 14), kat ? h('span', { class: 'tsKatAd' }, kat.ad) : null, h('b', null, etkin ? tt('tasarim.adi', { x: etkin }) : tt('tasarim.baslik')), ikon('asagi', 12));
    secDugme.querySelector('span').textContent = tt('tasarim.sec');
    secDugme.title = tt('tasarim.secIpucu');
    secDugme.disabled = !sayfa;
    yenileDugme.title = tt('tasarim.yenile');
    yenileDugme.setAttribute('aria-label', tt('tasarim.yenile'));
    yenileDugme.disabled = !sayfa;
    klasorDugme.title = tt('tasarim.klasor');
    klasorDugme.setAttribute('aria-label', tt('tasarim.klasor'));
    doldur(
      cihazEl,
      CIHAZLAR.map(([ad, simge]) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            class: 'tsArac simgeli' + (cihaz === ad ? ' etkin' : ''),
            'aria-checked': cihaz === ad ? 'true' : 'false',
            title: tt('tasarim.cihaz.' + ad),
            'aria-label': tt('tasarim.cihaz.' + ad),
            onclick: () => {
              cihaz = ad;
              sakla('tasarim.cihaz', ad);
              ustCiz();
              cihazUygula();
              surecTazele();
            },
          },
          ikon(simge, 15)
        )
      )
    );
    sayfalarCiz();
  }

  function cihazUygula() {
    const [, , g, y] = CIHAZLAR.find((c) => c[0] === cihaz) || CIHAZLAR[0];
    cerceveKap.style.width = g ? g + 'px' : '';
    cerceveKap.style.height = y ? y + 'px' : '';
    cerceveKap.classList.toggle('cihazli', !!g);
    cerceveKap.classList.toggle('telefon', !!y);
    cerceveKap.dataset.cihaz = cihaz;
    sahne.classList.toggle('telefonlu', !!y);
    olcekle();
  }
  // telefon çerçevesi sahnenin yüksekliğine sığdırılır (dokunma koordinatları tarayıcıda doğru çevrilir)
  function olcekle() {
    const y = (CIHAZLAR.find((c) => c[0] === cihaz) || CIHAZLAR[0])[3];
    if (!y) return (cerceveKap.style.transform = '');
    const bos = sahne.clientHeight - 40;
    const o = bos > 0 ? Math.min(1, bos / (y + 24)) : 1;
    cerceveKap.style.transform = o < 1 ? `scale(${o.toFixed(3)})` : '';
  }
  new ResizeObserver(() => gorunur && olcekle()).observe(sahne);

  function bosCiz() {
    const yok = !sayfa;
    bosEl.hidden = !yok;
    cerceveKap.hidden = yok;
    if (!yok) return;
    const acik = depo.oturum.acik && !depo.oturum.giris;
    // tasarımcı çalışıyorsa ya da bir şey yaptıysa öneriler yerine süreç gösterilir
    const t_ = tasarim();
    if (acik && (calisiyorMu() || adimlar().some((x) => x.tur === 'arac') || (t_ && t_.dosyaSayisi))) {
      // çalışırken arkada isteğe göre iskelet yanıp söner, süreç kartı önünde durur
      bosEl.classList.add('surecli');
      bosEl.classList.toggle('canli', calisiyorMu());
      doldur(bosEl, siluet(), h('div', { class: 'tsSurec buyuk' }, surecIcerik(true), h('p', { class: 'tsBosNot' }, tt('tasarim.ilkSayfa'))));
      return;
    }
    bosEl.classList.remove('surecli', 'canli');
    const oneriler = ['tasarim.oneri1', 'tasarim.oneri2', 'tasarim.oneri3', 'tasarim.oneri4'];
    doldur(
      bosEl,
      h('div', { class: 'tsBosIkon' }, ikon('firca', 26)),
      h('h3', null, etkin ? tt('tasarim.bosBaslikTasarim', { x: etkin }) : tt('tasarim.bosBaslik')),
      h('p', null, tt('tasarim.bosAciklama')),
      acik
        ? h(
            'div',
            { class: 'tsOneriler' },
            oneriler.map((k) => h('button', { type: 'button', class: 'tsOneri', onclick: () => sohbetOner(tt(k)) }, ikon('sihir', 13), tt(k)))
          )
        : h('button', { type: 'button', class: 'dugme ana buyuk', onclick: () => baslat() }, ikon('firca', 14), tt('tasarim.baslat')),
      h('p', { class: 'tsBosNot' }, tt('tasarim.klasorNot'))
    );
  }

  // ---------- süreç ----------
  // Tasarımcı çalışırken ne yaptığı görünür: o anki adım, son adımlar, yazılan dosyalar ve plan.
  const sefCanli = () => (depo.canli.ajanlar || []).find((a) => a.sef) || null;
  function calisiyorMu() {
    const o = depo.oturum;
    if (!o.acik || o.giris) return false;
    const a = sefCanli();
    if (a && (a.durum === 'calisiyor' || a.durum === 'arastiriyor')) return true;
    const sohbet = depo.sohbet || [];
    const son = sohbet[sohbet.length - 1];
    return !!(son && son.kim === 'sen' && !sohbet.some((m) => m.acik));
  }
  // akıştaki istek metninden tasarım bağlam satırları atılır
  const BAGLAM = /\[(?:Tasarım|Design) \d{4}[^\]]*\]\s*|\[(?:Seçili öğe|Selected element|Doğrudan düzenlemeler|Direct edits)\][^\n]*/g;
  const adimlar = () =>
    (depo.canli.akis || [])
      .filter((x) => x.tur !== 'mesaj')
      .slice(-12)
      .reverse()
      .map((x) => (x.tur === 'istek' ? { ...x, metin: String(x.metin || '').replace(BAGLAM, '').trim() } : x));
  const TUR_SIMGE = { arac: 'kod', istek: 'gonder', durum: 'tik', hata: 'ucgen', gorev: 'hedef', onay: 'kalkan' };

  async function planYukle(t_) {
    const anahtar = etkin + '/' + t_.plan;
    if (plan.anahtar === anahtar) return;
    plan = { anahtar, metin: '' };
    const r = await api.tasarimPlan(katId, etkin, t_.plan);
    if (plan.anahtar === anahtar) {
      plan.metin = (r && r.metin) || '';
      surecIzi = '';
      surecTazele();
    }
  }

  function surecIcerik(buyuk) {
    const a = sefCanli();
    const calisiyor = calisiyorMu();
    const t_ = tasarim();
    const ad = tt('tasarim.tasarimci');
    const liste = adimlar();
    if (t_ && t_.plan && planAcik) planYukle(t_);
    return [
      h(
        'div',
        { class: 'tsSurecBas' },
        h('span', { class: 'tsSurecNokta' + (calisiyor ? ' canli' : '') }),
        h('div', null, h('b', null, calisiyor ? tt('tasarim.calisiyor', { x: ad }) : tt('tasarim.bekliyor', { x: ad })), a && a.ozet && calisiyor ? h('p', null, a.ozet) : null)
      ),
      liste.length
        ? h(
            'ol',
            { class: 'tsAdimlar' },
            liste.slice(0, buyuk ? 10 : 7).map((x, i) => h('li', { class: 'tur-' + x.tur + (i === 0 && calisiyor && x.tur === 'arac' ? ' simdi' : '') }, ikon(TUR_SIMGE[x.tur] || 'tik', 12), h('span', null, x.metin), h('time', null, saatYaz(x.z))))
          )
        : null,
      t_ && (t_.dosyaSayisi || t_.plan)
        ? h(
            'div',
            { class: 'tsDosyaOzet' },
            ikon('klasor', 13),
            h('span', null, tt('tasarim.dosyaOzet', { x: t_.id, y: t_.dosyaSayisi, z: t_.sayfalar.length })),
            t_.plan ? h('button', { type: 'button', class: 'tsBag', onclick: () => ((planAcik = !planAcik), (surecIzi = ''), surecTazele()) }, tt(planAcik ? 'tasarim.planGizle' : 'tasarim.planGoster', { x: t_.plan })) : null
          )
        : null,
      sonDosyalar.length ? h('div', { class: 'tsSonDosyalar' }, sonDosyalar.slice(0, buyuk ? 8 : 5).map((d) => h('code', { title: d.dosya }, d.dosya.split('/').pop()))) : null,
      planAcik && t_ && t_.plan ? h('div', { class: 'tsPlan' }, plan.metin ? mdMetin(plan.metin) : h('p', { class: 'tsIpucu' }, '…')) : null,
    ];
  }

  // İsteğe göre şekillenen iskelet: tasarımcı çalışırken önizlemenin yerinde yanıp söner.
  // Tür sahibin son mesajından ve seçili cihazdan çıkarılır: mobil uygulama, panel, menü ya da açılış sayfası.
  function siluetTuru() {
    const son = [...(depo.sohbet || [])].reverse().find((m) => m.kim === 'sen');
    const m = String((son && son.metin) || '').toLocaleLowerCase('tr');
    if (cihaz === 'iphone' || cihaz === 'android' || /mobil uygulama|mobile app|\bapp\b|ios|android|uygulama ekran|ekranlar/.test(m)) return 'mobil';
    if (/admin|panel|dashboard|yönetim|kontrol paneli/.test(m) && !/landing|açılış|web site/.test(m)) return 'panel';
    if (/qr|menü|menu|fiyat listesi/.test(m) && !/landing|açılış/.test(m)) return 'menu';
    return 'site';
  }
  const sk = (sinif, ...c) => h('div', { class: 'sk ' + sinif }, ...c);
  function siluet() {
    const tur = siluetTuru();
    const govde =
      tur === 'mobil'
        ? [
            sk('skDurum'),
            sk('skBaslik'),
            sk('skKart buyuk'),
            h('div', { class: 'skSira' }, sk('skKare'), sk('skKare'), sk('skKare')),
            sk('skSatir'),
            sk('skSatir kisa'),
            sk('skKart'),
            h('div', { class: 'skSekmeler' }, sk('skNokta'), sk('skNokta'), sk('skNokta'), sk('skNokta')),
          ]
        : tur === 'panel'
        ? [
            h(
              'div',
              { class: 'skPanel' },
              h('div', { class: 'skYan' }, sk('skLogo'), sk('skSatir'), sk('skSatir'), sk('skSatir'), sk('skSatir kisa')),
              h(
                'div',
                { class: 'skAna' },
                sk('skBaslik'),
                h('div', { class: 'skSira' }, sk('skKart'), sk('skKart'), sk('skKart'), sk('skKart')),
                sk('skGrafik'),
                h('div', { class: 'skSira' }, sk('skKart uzun'), sk('skKart uzun'))
              )
            ),
          ]
        : tur === 'menu'
        ? [
            h('div', { class: 'skNav' }, sk('skLogo'), h('div', { class: 'skSira dar' }, sk('skBag'), sk('skBag'), sk('skBag'))),
            sk('skBaslik orta'),
            h('div', { class: 'skSira dar orta' }, sk('skCip'), sk('skCip'), sk('skCip'), sk('skCip')),
            ...[0, 1, 2, 3, 4].map(() => h('div', { class: 'skUrun' }, sk('skKare'), h('div', { class: 'skUrunMetin' }, sk('skSatir'), sk('skSatir kisa')), sk('skFiyat'))),
          ]
        : [
            h('div', { class: 'skNav' }, sk('skLogo'), h('div', { class: 'skSira dar' }, sk('skBag'), sk('skBag'), sk('skBag'), sk('skDugme'))),
            h('div', { class: 'skHero' }, h('div', { class: 'skHeroMetin' }, sk('skBaslik buyuk'), sk('skBaslik'), sk('skSatir'), sk('skSatir kisa'), h('div', { class: 'skSira dar' }, sk('skDugme'), sk('skDugme hayalet'))), sk('skGorsel')),
            h('div', { class: 'skSira' }, sk('skKart'), sk('skKart'), sk('skKart')),
            sk('skBant'),
          ];
    return h('div', { class: 'tsSiluet tur-' + tur, 'aria-hidden': 'true' }, h('div', { class: 'skSayfa' }, govde), h('div', { class: 'skParilti' }));
  }

  // canlı akış her saniye gelebilir: yalnızca görünen bilgi değişince çizilir
  function surecTazele() {
    if (!gorunur) return;
    const a = sefCanli();
    const calisiyor = calisiyorMu();
    const ak = adimlar();
    const t_ = tasarim();
    const iz = JSON.stringify([calisiyor, cihaz, !sayfa && siluetTuru(), a && a.ozet, ak.length && ak[0].z, ak.length, sonDosyalar.length && sonDosyalar[0].z, t_ && [t_.id, t_.dosyaSayisi, t_.plan, t_.sayfalar.length], planAcik, plan.metin.length, cekmeceAcik, !!sayfa, depo.oturum.acik]);
    if (iz === surecIzi) return;
    surecIzi = iz;
    // sayfa yokken süreç boş ekranın yerini alır; sayfa varken üstte bir hap, tıklayınca açılan çekmece
    if (!sayfa) {
      calisiyorEl.hidden = true;
      cekmece.hidden = true;
      bosCiz();
      return;
    }
    // tasarımcı açık sayfayı yazarken çerçeve nefes alır
    cerceveKap.classList.toggle('yaziliyor', calisiyor);
    calisiyorEl.hidden = !calisiyor && !cekmeceAcik;
    calisiyorEl.setAttribute('aria-expanded', cekmeceAcik ? 'true' : 'false');
    doldur(
      calisiyorEl,
      h('span', { class: 'nabiz' }, h('i'), h('i'), h('i')),
      h('span', null, calisiyor ? tt('tasarim.calisiyor', { x: tt('tasarim.tasarimci') }) : tt('tasarim.bekliyor', { x: tt('tasarim.tasarimci') })),
      calisiyor && a && a.ozet ? h('span', { class: 'tsHapIs' }, a.ozet) : null,
      ikon(cekmeceAcik ? 'yukari' : 'asagi', 12)
    );
    cekmece.hidden = !cekmeceAcik;
    if (cekmeceAcik) doldur(cekmece, surecIcerik(false));
  }

  const turAdi = (tur) => tt('tasarim.tur.' + (['button', 'link', 'image', 'input', 'section', 'text', 'container'].includes(tur) ? tur : 'container'));

  function bekleyenCiz() {
    const kap = denetci.querySelector('.tsBekleyen');
    if (!kap) return;
    doldur(
      kap,
      bekleyen.size
        ? [
            h('div', { class: 'tsBolumBaslik' }, tt('tasarim.bekleyen', { x: bekleyen.size })),
            h(
              'ul',
              { class: 'tsBekleyenListe' },
              [...bekleyen.values()].slice(-8).map((b) => h('li', null, h('code', null, b.ad), ' ', CSS_ADI[b.ozellik] || tt(b.ozellik === 'metin' ? 'tasarim.alan.metin' : 'tasarim.alan.gorsel'), h('span', null, String(b.deger).slice(0, 40))))
            ),
            h(
              'div',
              { class: 'tsSatir' },
              h('button', { type: 'button', class: 'dugme ana', disabled: !depo.oturum.acik, onclick: () => duzenleriKaydet() }, ikon('tik', 13), tt('tasarim.kaydet')),
              h('button', { type: 'button', class: 'dugme', onclick: () => yukle(true) }, ikon('geri', 13), tt('tasarim.geriAl'))
            ),
          ]
        : null
    );
  }

  function alanKur([ozellik, tur, secenek]) {
    const deger = (secili.stil || {})[ozellik] || '';
    const etiket = tt('tasarim.alan.' + ozellik);
    let kontrol;
    if (tur === 'renk') {
      const hex = onaltilik(deger);
      const metin = h('input', { type: 'text', class: 'tsGiris', value: hex || deger, spellcheck: 'false', onchange: (e) => stilUygula(ozellik, e.target.value.trim()) });
      const secici = h('input', {
        type: 'color',
        class: 'tsRenk',
        value: hex || '#000000',
        oninput: (e) => {
          metin.value = e.target.value;
          stilUygula(ozellik, e.target.value);
        },
      });
      kontrol = h('div', { class: 'tsRenkSatir' }, secici, metin);
    } else if (tur === 'px') {
      kontrol = h('input', { type: 'number', class: 'tsGiris', min: '0', max: '400', step: '1', value: parseFloat(deger) || 0, onchange: (e) => stilUygula(ozellik, (Number(e.target.value) || 0) + 'px') });
    } else if (tur === 'secim') {
      kontrol = h(
        'div',
        { class: 'tsParcali' },
        secenek.map((v) => h('button', { type: 'button', class: String(deger) === v ? 'etkin' : '', onclick: () => (stilUygula(ozellik, v), denetciCiz()) }, ozellik === 'textAlign' ? tt('tasarim.hiza.' + v) : v))
      );
    } else {
      kontrol = h('input', { type: 'text', class: 'tsGiris', value: deger, spellcheck: 'false', onchange: (e) => stilUygula(ozellik, e.target.value.trim()) });
    }
    return h('label', { class: 'tsAlan' }, h('span', null, etiket), kontrol);
  }

  function denetciCiz() {
    denetci.hidden = !secili;
    kok.classList.toggle('denetcili', !!secili);
    if (!secili) return;
    const o = secili;
    const zincir = (o.zincir || []).filter((z) => z.ad !== 'body').slice(-4);
    // en yakın kapsayıcı (div vb.) ve en yakın bölüm (section, header, footer…) ayrı ayrı seçilebilir
    const kapsayan = [...(o.zincir || [])].reverse().find((z) => z.tur === 'container' && z.ad !== 'body');
    const bolum = [...(o.zincir || [])].reverse().find((z) => z.tur === 'section');
    const istek = h('textarea', { class: 'tsGiris tsIstek', rows: '3', placeholder: tt('tasarim.istekYer') });
    const istekGonder = async () => {
      const m = istek.value.trim();
      if (!m) return istek.focus();
      if (await tasarimciyaYaz([basSatiri(), ogeMetni(o), m].join('\n'))) istek.value = '';
    };
    istek.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        istekGonder();
      }
    });
    doldur(
      denetci,
      h(
        'header',
        { class: 'tsDenetciBas' },
        h('span', { class: 'tsTur tur-' + o.tur }, turAdi(o.tur)),
        h('code', { class: 'tsOgeAd', title: o.yol }, o.ad),
        h('button', { type: 'button', class: 'simge', title: tt('genel.kapat'), 'aria-label': tt('genel.kapat'), onclick: seciliBirak }, ikon('kapat', 14))
      ),
      zincir.length
        ? h(
            'nav',
            { class: 'tsZincir', 'aria-label': tt('tasarim.zincir') },
            zincir.map((z) => h('button', { type: 'button', title: z.yol, onclick: () => ataSec(z.yol) }, z.ad)),
            h('span', { class: 'tsZincirSon' }, o.ad)
          )
        : null,
      h(
        'div',
        { class: 'tsSatir tsHizli' },
        kapsayan ? h('button', { type: 'button', class: 'dugme kucuk', onclick: () => ataSec(kapsayan.yol) }, tt('tasarim.kapsayaniSec')) : null,
        bolum ? h('button', { type: 'button', class: 'dugme kucuk', onclick: () => ataSec(bolum.yol) }, tt('tasarim.bolumuSec')) : null
      ),
      h(
        'section',
        { class: 'tsBolum' },
        h('div', { class: 'tsBolumBaslik' }, tt('tasarim.istekBaslik')),
        istek,
        h(
          'div',
          { class: 'tsSatir' },
          h('button', { type: 'button', class: 'dugme ana', disabled: !depo.oturum.acik, onclick: istekGonder }, ikon('gonder', 13), tt('tasarim.istekGonder')),
          h(
            'label',
            { class: 'tsBagla', title: tt('tasarim.baglaIpucu') },
            h('input', { type: 'checkbox', checked: baglaSohbete, onchange: (e) => (baglaSohbete = e.target.checked) }),
            tt('tasarim.bagla')
          )
        )
      ),
      o.yaziDuzenlenir
        ? h(
            'section',
            { class: 'tsBolum' },
            h('div', { class: 'tsBolumBaslik' }, tt('tasarim.alan.metin')),
            h('textarea', { class: 'tsGiris', rows: '2', value: o.metin, onchange: (e) => metinUygula(e.target.value) }),
            h('p', { class: 'tsIpucu' }, tt('tasarim.ciftTikla'))
          )
        : null,
      o.kaynak !== '' || o.tur === 'image'
        ? h(
            'section',
            { class: 'tsBolum' },
            h('div', { class: 'tsBolumBaslik' }, tt('tasarim.alan.gorsel')),
            o.kaynak ? h('code', { class: 'tsKaynak' }, o.kaynak) : null,
            h('button', { type: 'button', class: 'dugme', onclick: gorselDegistir }, ikon('dosya', 13), tt('tasarim.gorselDegistir'))
          )
        : null,
      h('section', { class: 'tsBolum' }, h('div', { class: 'tsBolumBaslik' }, tt('tasarim.stil')), h('div', { class: 'tsAlanlar' }, STIL_ALANLARI.map(alanKur))),
      h('div', { class: 'tsBekleyen' })
    );
    bekleyenCiz();
  }

  function ciz() {
    ustCiz();
    cihazUygula();
    bosCiz();
    surecIzi = '';
    surecTazele();
    denetciCiz();
  }

  // ajan bir dosya yazınca: liste tazelenir, açık sayfa ya da görseli değiştiyse önizleme arkada yenilenir
  let tazeZ = null;
  api.tasarimDegisti((v) => {
    if (!gorunur || !v || v.katId !== katId) return;
    clearTimeout(tazeZ);
    tazeZ = setTimeout(async () => {
      const oncekiSayfa = sayfa;
      const oncekiEtkin = etkin;
      await listeYukle(false);
      const benim = (v.dosyalar || []).filter((f) => f.startsWith(etkin + '/'));
      // süreç: son yazılan dosyalar (en yenisi önde)
      const z = Date.now();
      // uzantısız girdiler klasördür, listeye girmez
      for (const f of benim.filter((x) => /\.[a-z0-9]{1,6}$/i.test(x))) {
        sonDosyalar = [{ dosya: f.slice(5), z }, ...sonDosyalar.filter((x) => x.dosya !== f.slice(5))].slice(0, 14);
        if (plan.anahtar && f.slice(5) === plan.anahtar.split('/').pop()) plan.anahtar = '';
      }
      surecIzi = '';
      surecTazele();
      // önizleme yalnızca açık sayfa, onun görselleri ya da stil dosyaları değişince (veya ilk sayfa geldiğinde) yenilenir
      const acikDegisti = benim.some((f) => f === etkin + '/' + sayfa || !/\.(md|txt|json)$/i.test(f));
      if (sayfa && (oncekiSayfa !== sayfa || oncekiEtkin !== etkin || acikDegisti)) yukle();
    }, 120);
  });

  // klavye: V seçim aracı, Esc seçimi bırakır
  document.addEventListener('keydown', (e) => {
    if (!gorunur || e.metaKey || e.ctrlKey || e.altKey) return;
    const yaziyor = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
    if (yaziyor) return;
    if (e.key === 'v' || e.key === 'V') {
      if (sayfa) secimAyarla(!secimModu);
    } else if (e.key === 'Escape') {
      if (menuAcik) menuAc(false);
      else if (secili) seciliBirak();
      else if (secimModu) secimAyarla(false);
    }
  });

  return {
    kok,
    sohbetYuva,
    goster(yeniKat) {
      const degisti = yeniKat !== katId;
      gorunur = true;
      if (degisti) {
        katId = yeniKat;
        liste = [];
        etkin = null;
        sayfa = null;
        secili = null;
        bekleyen.clear();
        kaydirY = 0;
        sonDosyalar = [];
        plan = { anahtar: '', metin: '' };
        planAcik = false;
      }
      api.tasarimIzle(katId);
      ciz();
      listeYukle();
    },
    // oda kapanınca izleme durur ve önizlemeler boşaltılır: arka planda hiçbir şey çalışmaz
    gizle() {
      if (!gorunur) return;
      gorunur = false;
      menuAc(false);
      api.tasarimIzle(null);
      on.removeAttribute('src');
      arka.removeAttribute('src');
    },
    tazele() {
      if (!gorunur) return;
      surecTazele();
    },
    // oturum açılıp kapanınca başlat düğmesi, öneriler ve düğmelerin durumu yenilenir
    oturumDegisti() {
      if (!gorunur) return;
      ustCiz();
      bosCiz();
      surecIzi = '';
      surecTazele();
      if (secili) denetciCiz();
    },
    baglamAl,
  };
}
