// Tarayıcı sayfası: katlara bağlı hesaplar ve her hesabın kendi kalıcı tarayıcısı.
// Tarayıcının kendisi ana süreçte çizilir (WebContentsView); bu sayfa yalnızca yerini ve araç çubuğunu tutar.
import { h, doldur, ikon, alan } from '../dom.js';
import { depo, api, dinle, bildir, hataMetni } from '../depo.js';
import { PLATFORMLAR, PLATFORM_ADI } from './projeler.js';

export function tarayiciSayfasi() {
  const kok = h('div', { class: 'sayfa tarayiciSayfa' });
  const liste = h('aside', { class: 'tarayiciListe' });
  const arac = h('div', { class: 'tarayiciArac' });
  const yer = h('div', { class: 'tarayiciYer' });
  const bos = h('div', { class: 'tarayiciBos' });
  // konsol paneli: tarayıcının altında, onunla üst üste binmez
  const konsolPanel = h('section', { class: 'konsolPanel', hidden: true });
  // indirilenler: tarayıcının üstünde açılan şerit (tarayıcı yerel çizildiği için açılır menü onun altında kalırdı)
  const indirmePanel = h('section', { class: 'indirmePanel', hidden: true });
  kok.append(liste, h('section', { class: 'tarayiciSag' }, arac, indirmePanel, h('div', { class: 'tarayiciGovde' }, yer, bos), konsolPanel));
  let indirmeler = [];
  let indirmeAcik = false;
  let yeniIndirme = 0;
  let konsolAcik = false;
  let konsolSuzgec = '';

  let gorunur = false;
  let secili = null; // hesap kimliği
  let hesaplar = [];
  const durumlar = new Map(); // hesap kimliği -> { acik, adres, baslik, yukleniyor, geri, ileri }
  let ekleKat = null; // hesap ekleme formu açık olan kat

  const ad = (p) => PLATFORM_ADI[p] || depo.t('proje.diger');

  async function yenile() {
    hesaplar = await api.tarayiciListe();
    for (const x of hesaplar) durumlar.set(x.id, { acik: x.acik, adres: x.adres, baslik: x.baslik, yukleniyor: x.yukleniyor, geri: x.geri, ileri: x.ileri });
    if (secili && !hesaplar.some((x) => x.id === secili)) secili = null;
    ciz();
  }

  // Tarayıcıyı yer tutucunun üstüne yerleştirir. Sayfa gizliyken ya da sekme kapalıyken gizler.
  function yerlestir() {
    const d = secili && durumlar.get(secili);
    if (!gorunur || !d || !d.acik) return api.tarayiciGizle();
    const r = yer.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    api.tarayiciGoster(secili, { x: r.left, y: r.top, width: r.width, height: r.height });
  }
  new ResizeObserver(() => yerlestir()).observe(yer);
  window.addEventListener('resize', yerlestir);

  async function ac(id) {
    secili = id;
    const b = await api.tarayiciAc(id);
    if (b && b.hata) return bildir(hataMetni(b), true);
    durumlar.set(id, b);
    ciz();
    requestAnimationFrame(yerlestir);
  }

  function listeCiz() {
    const t = depo.t;
    const katlar = depo.sirket.projeler;
    if (!katlar.length) {
      doldur(liste, h('p', { class: 'ipucu' }, t('tarayici.katYok', { x: depo.sirket.beyin.ad })));
      return;
    }
    doldur(
      liste,
      h('h2', null, t('tarayici.hesaplar')),
      katlar.map((p) => {
        const benim = hesaplar.filter((x) => x.katId === p.id);
        return h(
          'section',
          { class: 'tarayiciKat' },
          h('h3', null, p.ad),
          benim.map((x) => {
            const d = durumlar.get(x.id) || {};
            return h(
              'button',
              { type: 'button', class: 'tarayiciHesap' + (x.id === secili ? ' secili' : ''), onclick: () => (d.acik ? ((secili = x.id), ciz(), requestAnimationFrame(yerlestir)) : ac(x.id)) },
              h('span', { class: 'hesapHarf', 'data-p': x.test ? 'test' : x.platform }, x.test ? ikon('oynat', 12) : ad(x.platform).slice(0, 1)),
              h('span', { class: 'hesapAd' }, h('b', null, x.test ? t('tarayici.test') : x.ad), h('span', null, x.test ? x.not : ad(x.platform))),
              d.acik ? h('span', { class: 'katNokta', title: t('tarayici.acik') }) : null
            );
          }),
          ekleKat === p.id ? ekleFormu(p) : h('button', { type: 'button', class: 'hesapEkle', onclick: () => ((ekleKat = p.id), ciz()) }, ikon('arti', 13), t('tarayici.ekle'))
        );
      }),
      h('p', { class: 'ipucu' }, t('tarayici.not'))
    );
  }

  function ekleFormu(p) {
    const t = depo.t;
    const pl = h('select', null, PLATFORMLAR.map((x) => h('option', { value: x }, ad(x))));
    const isim = h('input', { type: 'text', maxlength: '80', placeholder: t('tarayici.adOrnek') });
    const adres = h('input', { type: 'text', maxlength: '500', placeholder: 'https://…' });
    const adresAlan = alan(t('tarayici.adres'), adres, t('tarayici.adresIpucu'));
    adresAlan.hidden = true;
    pl.addEventListener('change', () => (adresAlan.hidden = pl.value !== 'diger'));
    return h(
      'form',
      {
        class: 'hesapForm',
        onsubmit: async (e) => {
          e.preventDefault();
          if (!isim.value.trim()) return isim.focus();
          if (pl.value === 'diger' && !/^https?:\/\//i.test(adres.value.trim())) return adres.focus();
          const r = await api.tarayiciHesapEkle({ katId: p.id, platform: pl.value, ad: isim.value.trim(), adres: adres.value.trim() });
          if (!r || r.hata) return bildir(hataMetni(r), true);
          ekleKat = null;
          await yenile();
          ac(r.hesap.id);
        },
      },
      alan(t('proje.platform'), pl),
      alan(t('tarayici.ad'), isim),
      adresAlan,
      h('div', { class: 'satirDugme' }, h('button', { type: 'submit', class: 'dugme ana' }, t('tarayici.ekleAc')), h('button', { type: 'button', class: 'dugme', onclick: () => ((ekleKat = null), ciz()) }, t('genel.vazgec')))
    );
  }

  function aracCiz() {
    const t = depo.t;
    const x = hesaplar.find((y) => y.id === secili);
    const d = (secili && durumlar.get(secili)) || {};
    if (!x) {
      doldur(arac);
      return;
    }
    const adres = h('input', { type: 'text', class: 'adresCubugu', value: d.adres || '', spellcheck: 'false', 'aria-label': t('tarayici.adres') });
    adres.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      let a = adres.value.trim();
      if (a && !/^https?:\/\//i.test(a)) a = 'https://' + a;
      const r = await api.tarayiciGezin(secili, a);
      if (r && r.hata) bildir(hataMetni(r), true);
    });
    doldur(
      arac,
      h('button', { type: 'button', class: 'simge', title: t('tarayici.geri'), disabled: !d.geri, onclick: () => api.tarayiciGit(secili, 'geri') }, ikon('geri', 16)),
      h('button', { type: 'button', class: 'simge', title: t('tarayici.ileri'), disabled: !d.ileri, onclick: () => api.tarayiciGit(secili, 'ileri') }, ikon('ileriOk', 16)),
      h('button', { type: 'button', class: 'simge' + (d.yukleniyor ? ' donuyor' : ''), title: t('tarayici.yenile'), disabled: !d.acik, onclick: () => api.tarayiciGit(secili, 'yenile') }, ikon('yenile', 15)),
      d.acik ? adres : h('span', { class: 'aracBaslik' }, x.ad),
      d.acik
        ? h(
            'div',
            { class: 'bolmeli cihazSec', role: 'group', 'aria-label': t('tarayici.cihaz') },
            [
              ['masaustu', 'ekran'],
              ['iphone', 'telefon'],
              ['ipad', 'tablet'],
              ['android', 'android'],
            ].map(([c, ik]) => h('button', { type: 'button', class: (d.cihaz || 'masaustu') === c ? 'secili' : '', title: t('tarayici.cihaz.' + c), 'aria-label': t('tarayici.cihaz.' + c), onclick: () => api.tarayiciCihaz(secili, c) }, ikon(ik, 15)))
          )
        : null,
      d.acik
        ? h(
            'button',
            { type: 'button', class: 'dugme konsolDugme' + (konsolAcik ? ' secili' : ''), 'aria-pressed': konsolAcik ? 'true' : 'false', onclick: () => ((konsolAcik = !konsolAcik), ciz()) },
            ikon('konsol', 14),
            t('tarayici.konsol'),
            d.hata ? h('span', { class: 'konsolSayi hata' }, String(d.hata)) : d.uyari ? h('span', { class: 'konsolSayi uyari' }, String(d.uyari)) : null
          )
        : null,
      h(
        'button',
        {
          type: 'button',
          class: 'dugme indirmeDugme' + (indirmeAcik ? ' secili' : ''),
          'aria-pressed': indirmeAcik ? 'true' : 'false',
          title: t('tarayici.indirilenler'),
          onclick: () => {
            indirmeAcik = !indirmeAcik;
            yeniIndirme = 0;
            ciz();
          },
        },
        ikon('indir', 14),
        t('tarayici.indirilenler'),
        indirmeler.some((x) => x.durum === 'iniyor') ? h('span', { class: 'donen kucuk' }) : yeniIndirme ? h('span', { class: 'konsolSayi yeni' }, String(yeniIndirme)) : null
      ),
      d.acik ? h('button', { type: 'button', class: 'dugme', onclick: () => api.tarayiciKapat(secili) }, t('tarayici.kapat')) : null,
      x.test
        ? null
        : h(
        'button',
        {
          type: 'button',
          class: 'simge',
          title: t('tarayici.sil'),
          onclick: async () => {
            if (!confirm(t('tarayici.silOnay', { x: x.ad }))) return;
            const r = await api.tarayiciHesapSil(x.katId, x.id);
            if (r && r.hata) return bildir(hataMetni(r), true);
            secili = null;
            yenile();
          },
        },
        ikon('cop', 15)
      )
    );
  }

  function bosCiz() {
    const t = depo.t;
    const x = hesaplar.find((y) => y.id === secili);
    const d = (secili && durumlar.get(secili)) || {};
    bos.hidden = !!(x && d.acik);
    yer.hidden = !bos.hidden;
    if (!bos.hidden) {
      doldur(
        bos,
        x
          ? [h('h3', null, x.ad), h('p', null, t('tarayici.kapaliAciklama')), h('button', { type: 'button', class: 'dugme ana', onclick: () => ac(x.id) }, ikon('dunya', 15), t('tarayici.ac'))]
          : [h('h3', null, t('tarayici.bosBaslik')), h('p', null, t('tarayici.bosAciklama', { x: depo.sirket.beyin.ad }))]
      );
    }
  }

  const boyutYaz = (b) => (!b ? '' : b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : b < 1073741824 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1073741824).toFixed(2) + ' GB');
  function indirmeCiz() {
    const t = depo.t;
    const onceki = indirmePanel.hidden;
    indirmePanel.hidden = !indirmeAcik;
    if (onceki !== indirmePanel.hidden) requestAnimationFrame(yerlestir);
    if (!indirmeAcik) return;
    doldur(
      indirmePanel,
      h('div', { class: 'indirmeBas' }, h('b', null, t('tarayici.indirilenler')), h('span', null, t('tarayici.indirmeKlasor')), h('button', { type: 'button', class: 'simge', title: t('genel.kapat'), 'aria-label': t('genel.kapat'), onclick: () => ((indirmeAcik = false), ciz()) }, ikon('kapat', 14))),
      indirmeler.length
        ? h(
            'ul',
            { class: 'indirmeListe' },
            indirmeler.slice(0, 12).map((x) => {
              const oran = x.boyut > 0 ? Math.min(100, Math.round((x.alinan / x.boyut) * 100)) : 0;
              return h(
                'li',
                { class: 'indirme durum-' + x.durum },
                ikon(x.durum === 'tamam' ? 'dosya' : x.durum === 'iniyor' ? 'indir' : 'ucgen', 15),
                h(
                  'div',
                  { class: 'indirmeBilgi' },
                  h('span', { class: 'indirmeAd', title: x.yol }, x.ad),
                  x.durum === 'iniyor' ? h('div', { class: 'indirmeCubuk' }, h('i', { style: `width:${x.boyut > 0 ? oran : 35}%` })) : null,
                  h('small', null, x.durum === 'iniyor' ? `${boyutYaz(x.alinan)}${x.boyut ? ' / ' + boyutYaz(x.boyut) : ''}` : t('tarayici.indirme.' + x.durum) + (x.durum === 'tamam' ? ' · ' + boyutYaz(x.alinan || x.boyut) : ''))
                ),
                x.durum === 'tamam' ? h('button', { type: 'button', class: 'dugme kucuk', onclick: () => api.tarayiciIndirmeAc(x.id) }, t('tarayici.indirmeAc')) : null,
                h('button', { type: 'button', class: 'simge', title: t('tarayici.indirmeGoster'), 'aria-label': t('tarayici.indirmeGoster'), disabled: x.durum === 'iptal', onclick: () => api.tarayiciIndirmeGoster(x.id) }, ikon('klasor', 14))
              );
            })
          )
        : h('p', { class: 'indirmeBos' }, t('tarayici.indirmeYok'))
    );
  }

  // indirme ilerlemesi: liste güncellenir, biten indirme her sayfada bildirilir
  api.tarayiciIndirmeDinle((d) => {
    if (!d) return;
    const i = indirmeler.findIndex((x) => x.id === d.id);
    if (i >= 0) indirmeler[i] = d;
    else indirmeler.unshift(d);
    if (d.durum === 'tamam') {
      bildir(depo.t('tarayici.indirildi', { x: d.ad }));
      if (!indirmeAcik) yeniIndirme++;
    } else if (d.durum === 'hata') bildir(depo.t('tarayici.indirmeHata', { x: d.ad }), true);
    if (!gorunur) return;
    if (i < 0 || d.durum !== 'iniyor') aracCiz();
    indirmeCiz();
  });

  // Konsol: sayfanın hata ve uyarıları, en yenisi altta
  async function konsolCiz() {
    const t = depo.t;
    const d = (secili && durumlar.get(secili)) || {};
    konsolPanel.hidden = !(konsolAcik && d.acik);
    if (konsolPanel.hidden) return requestAnimationFrame(yerlestir);
    const kayitlar = (await api.tarayiciKonsol(secili)) || [];
    const gorunen = konsolSuzgec ? kayitlar.filter((k) => k.seviye === konsolSuzgec) : kayitlar;
    const satirlar = h(
      'ol',
      { class: 'konsolListe' },
      gorunen.length
        ? gorunen.map((k) =>
            h(
              'li',
              { class: 'konsolSatir ' + k.seviye },
              h('time', null, new Date(k.z).toLocaleTimeString()),
              h('span', { class: 'konsolMesaj' }, k.mesaj),
              k.kaynak ? h('span', { class: 'konsolKaynak', title: k.kaynak }, (k.kaynak.split('/').pop() || k.kaynak) + (k.satir ? ':' + k.satir : '')) : null
            )
          )
        : h('li', { class: 'konsolBos' }, t('tarayici.konsolBos'))
    );
    doldur(
      konsolPanel,
      h(
        'div',
        { class: 'konsolBas' },
        h('b', null, t('tarayici.konsol')),
        h(
          'div',
          { class: 'bolmeli kucuk' },
          [
            ['', 'tarayici.hepsi'],
            ['error', 'tarayici.hatalar'],
            ['warning', 'tarayici.uyarilar'],
          ].map(([v, k]) => h('button', { type: 'button', class: konsolSuzgec === v ? 'secili' : '', onclick: () => ((konsolSuzgec = v), konsolCiz()) }, t(k)))
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'dugme kucuk',
            onclick: async () => {
              const metin = gorunen.map((k) => `[${k.seviye}] ${k.mesaj}${k.kaynak ? '  (' + k.kaynak + (k.satir ? ':' + k.satir : '') + ')' : ''}`).join('\n');
              try {
                await navigator.clipboard.writeText(metin);
                bildir(t('genel.kopyalandi'));
              } catch {
                bildir(t('hata.genel'), true);
              }
            },
          },
          ikon('kopya', 13),
          t('genel.kopyala')
        ),
        h('button', { type: 'button', class: 'dugme kucuk', onclick: () => api.tarayiciKonsolTemizle(secili) }, ikon('cop', 13), t('tarayici.temizle'))
      ),
      satirlar
    );
    satirlar.scrollTop = satirlar.scrollHeight;
    requestAnimationFrame(yerlestir);
  }

  function ciz() {
    listeCiz();
    aracCiz();
    bosCiz();
    konsolCiz();
    indirmeCiz();
    requestAnimationFrame(yerlestir);
  }

  api.tarayiciDinle((b) => {
    const once = durumlar.get(b.id) || {};
    durumlar.set(b.id, b);
    if (!gorunur) return;
    // açılıp kapanma listeyi değiştirir; adres ve başlık yalnızca araç çubuğunu
    if (once.acik !== b.acik) ciz();
    else if (b.id === secili && document.activeElement && !document.activeElement.classList.contains('adresCubugu')) aracCiz();
  });
  dinle('sirket', () => gorunur && yenile());
  let konsolZ = null;
  api.tarayiciKonsolDinle((v) => {
    if (!gorunur || !konsolAcik || v.id !== secili) return;
    clearTimeout(konsolZ);
    konsolZ = setTimeout(konsolCiz, 150);
  });

  return {
    kok,
    goster() {
      gorunur = true;
      yenile();
      api.tarayiciIndirmeler().then((l) => {
        indirmeler = Array.isArray(l) ? l : [];
        if (gorunur) indirmeCiz();
      });
    },
    gizle() {
      gorunur = false;
      api.tarayiciGizle();
    },
  };
}
