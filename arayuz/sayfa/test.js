// Simülatör: iOS simülatörleri ve Android cihazları uygulamanın içinde canlı. Ekrana tıklamak dokunma, sürüklemek kaydırmadır.
// Sahip ve ajanlar aynı cihazı birlikte kullanır; ajanlar cihaz_ araçlarıyla dokunur, sahip burada canlı izler.
// Normalde tek simülatör açık tutulur; birden çok açıksa bilgisayarı yoracağı uyarısı çıkar.
import { h, doldur, ikon } from '../dom.js';
import { depo, api, dinle, bildir, hataMetni } from '../depo.js';

export function testSayfasi({ git } = {}) {
  const kok = h('div', { class: 'sayfa testSayfa' });
  let durum = null;
  let yukleniyor = false;
  let calisan = '';
  let secili = ''; // canlı gösterilen cihaz (iOS UDID ya da Android seri)
  let uygulamalar = [];
  let uygKimlik = '';
  let gorunur = false;

  // canlı ekran: öğe bir kez kurulur, kareler yalnızca kaynağını değiştirir
  const ekran = h('img', { class: 'simEkran', alt: '', draggable: 'false' });
  // ekrana tıklayınca klavye cihaza bağlanır: yazılanlar, silme, Enter, oklar ve Cmd kısayolları doğrudan cihaza gider
  const klavyeNot = h('div', { class: 'simKlavyeNot' });
  const ekranKap = h('div', { class: 'simCerceve', tabindex: '0', 'aria-label': 'Cihaz ekranı' }, ekran, klavyeNot);
  let sonKare = 0;
  api.simKareDinle((k) => {
    if (k.kimlik !== secili || !gorunur) return;
    ekran.src = `data:${k.mime};base64,${k.veri}`;
    sonKare = Date.now();
    ekranKap.classList.add('canli');
  });

  // dokunma ve kaydırma: oran (0..1) olarak gönderilir, cihazın ölçüsüne ana süreçte çevrilir
  let basla = null;
  const oran = (e) => {
    const r = ekran.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  ekran.addEventListener('pointerdown', (e) => {
    if (!secili) return;
    ekranKap.focus({ preventScroll: true });
    basla = { o: oran(e), z: Date.now() };
    ekran.setPointerCapture(e.pointerId);
  });
  ekran.addEventListener('pointerup', async (e) => {
    if (!basla || !secili) return;
    const son = oran(e);
    const [x1, y1] = basla.o;
    const [x2, y2] = son;
    basla = null;
    const r = Math.hypot(x2 - x1, y2 - y1) > 0.02 ? await api.simKaydir(secili, x1, y1, x2, y2) : await api.simDokun(secili, x2, y2);
    if (r && r.hata) bildir(r.ayrinti || hataMetni(r), true);
  });

  // ---------- klavye ----------
  // İşlemler sırayla gider (yazı, silme, Enter karışmasın); art arda yazılan harfler tek seferde gönderilir
  let sira = Promise.resolve();
  const sirala = (fn) => {
    sira = sira.then(fn).then((r) => r && r.hata && bildir(r.ayrinti || hataMetni(r), true)).catch(() => {});
    return sira;
  };
  // önceki işlem sürerken yazılan harfler birikir ve sırası gelince tek seferde gider (her harf ayrı komut olmaz)
  let tampon = '';
  let tamponZ = null;
  let yaziSirada = false;
  const tamponuGonder = () => {
    clearTimeout(tamponZ);
    if (!tampon || !secili || yaziSirada) return;
    yaziSirada = true;
    const k = secili;
    sirala(() => {
      yaziSirada = false;
      const m = tampon;
      tampon = '';
      return m ? api.simYaz(k, m) : null;
    });
  };
  const TUSLAR = { Enter: 'enter', Backspace: 'sil', Delete: 'ileriSil', Tab: 'tab', Escape: 'esc', ArrowRight: 'sag', ArrowLeft: 'sol', ArrowDown: 'asagi', ArrowUp: 'yukari' };
  ekranKap.addEventListener('keydown', (e) => {
    if (!secili || e.isComposing) return;
    const k = secili;
    const kisa = (api.mac ? e.metaKey : e.ctrlKey) && !e.altKey;
    if (kisa && /^[acvxz]$/i.test(e.key)) {
      e.preventDefault();
      tamponuGonder();
      const harf = e.key.toLowerCase();
      if (harf === 'v') return sirala(() => api.simYapistir(k));
      return sirala(async () => {
        const r = await api.simKisayol(k, harf);
        if (r && r.tamam && r.sonuc && r.sonuc.metin) bildir(depo.t('sim.kopyalandi'));
        return r;
      });
    }
    if (kisa || e.altKey) return;
    if (TUSLAR[e.key]) {
      e.preventDefault();
      tamponuGonder();
      return sirala(() => api.simTus(k, TUSLAR[e.key]));
    }
    if ([...e.key].length === 1) {
      e.preventDefault();
      tampon += e.key;
      clearTimeout(tamponZ);
      tamponZ = setTimeout(tamponuGonder, 90);
    }
  });
  // Mac panosundan yapıştırma (sağ tık menüsünden de)
  ekranKap.addEventListener('paste', (e) => {
    if (!secili) return;
    e.preventDefault();
    tamponuGonder();
    const k = secili;
    sirala(() => api.simYapistir(k));
  });
  const klavyeNotCiz = () => {
    const odakta = document.activeElement === ekranKap;
    ekranKap.classList.toggle('klavyede', odakta);
    klavyeNot.textContent = depo.t(odakta ? 'sim.klavyeAcik' : 'sim.klavyeKapali');
  };
  ekranKap.addEventListener('focus', klavyeNotCiz);
  ekranKap.addEventListener('blur', () => (tamponuGonder(), klavyeNotCiz()));

  // fare tekerleği ve trackpad: kaydırma (toplanır, kısa bir duraklamada tek kaydırma olarak gider)
  let tekerlek = 0;
  let tekerlekZ = null;
  ekranKap.addEventListener(
    'wheel',
    (e) => {
      if (!secili) return;
      e.preventDefault();
      tekerlek += e.deltaY;
      clearTimeout(tekerlekZ);
      tekerlekZ = setTimeout(() => {
        const r = ekran.getBoundingClientRect();
        const pay = Math.max(-0.4, Math.min(0.4, tekerlek / Math.max(200, r.height * 1.4)));
        tekerlek = 0;
        if (Math.abs(pay) < 0.02) return;
        const k = secili;
        // aşağı kaydırmak parmağı yukarı sürüklemektir
        sirala(() => api.simKaydir(k, 0.5, 0.5 + pay / 2, 0.5, 0.5 - pay / 2));
      }, 120);
    },
    { passive: false }
  );

  async function yenile() {
    yukleniyor = true;
    ciz();
    const r = await api.testDurum();
    yukleniyor = false;
    durum = r && r.tamam ? r.sonuc : null;
    if (r && r.hata) bildir(hataMetni(r), true);
    // açık bir cihaz seçili değilse ilk açık olan seçilir
    const aciklar = acikCihazlar();
    if (!aciklar.some((c) => c.kimlik === secili)) secili = (aciklar[0] || {}).kimlik || '';
    akisAyarla();
    ciz();
  }

  const acikCihazlar = () => [
    ...((durum && durum.ios) || []).filter((c) => c.durum === 'Booted').map((c) => ({ kimlik: c.udid, ad: c.ad, alt: c.surum, ios: true })),
    ...((durum && durum.android && durum.android.cihazlar) || []).filter((c) => c.durum === 'device').map((c) => ({ kimlik: c.seri, ad: c.ad, alt: 'Android', ios: false })),
  ];

  async function akisAyarla() {
    if (!gorunur || !secili) return api.simAkis('');
    ekranKap.classList.remove('canli');
    const r = await api.simAkis(secili);
    if (r && r.hata) bildir(r.ayrinti || hataMetni(r), true);
    const c = acikCihazlar().find((x) => x.kimlik === secili);
    if (uygKimlik === secili) return;
    uygKimlik = secili;
    uygulamalar = [];
    if (c && c.ios) {
      const u = await api.simUygulamalar(secili);
      uygulamalar = u && u.tamam ? u.sonuc : [];
      ciz();
    }
  }

  async function is(ad, fn) {
    calisan = ad;
    ciz();
    const r = await fn();
    calisan = '';
    if (!r || r.hata) bildir((r && r.ayrinti) || hataMetni(r), true);
    return r;
  }

  const katlar = () => depo.sirket.projeler.filter((p) => p.tur !== 'kisisel');
  let secilenKat = '';
  function sefeVer(cihaz) {
    const kat = secilenKat || (katlar()[0] || {}).id;
    if (!kat) return bildir(depo.t('test.katYok'), true);
    is('sef', () => api.testSefeVer(kat, cihaz)).then((r) => r && r.tamam && bildir(depo.t('test.sefeVerildi', { x: cihaz })));
  }

  const dugme = (ad, ikonAd, yazi, onclick, sinif = '') => h('button', { type: 'button', class: 'dugme kucuk ' + sinif, disabled: !!calisan, onclick }, calisan === ad ? h('span', { class: 'donen' }) : ikonAd ? ikon(ikonAd, 13) : null, yazi);

  function cihazListesi() {
    const t = depo.t;
    const ios = (durum.ios || []).slice().sort((a, b) => (b.durum === 'Booted') - (a.durum === 'Booted'));
    const a = durum.android;
    const satir = (c, kimlik, ad, alt, acik, ikonAd, eylem) =>
      h(
        'li',
        { class: 'cihazSatir' + (acik ? ' acik' : '') + (kimlik === secili ? ' secili' : ''), onclick: acik ? () => ((secili = kimlik), akisAyarla(), ciz()) : null },
        ikon(ikonAd, 15),
        h('div', { class: 'cihazAd' }, h('b', null, ad), h('span', null, alt)),
        acik ? h('span', { class: 'katNokta' }) : null,
        h('div', { class: 'satirDugme' }, eylem)
      );
    return h(
      'div',
      { class: 'simListe' },
      durum.platform === 'darwin'
        ? h(
            'section',
            { class: 'panel' },
            h('h2', null, t('test.iosBaslik')),
            durum.iosHata ? h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 15), t('test.xcodeYok')) : null,
            ios.length
              ? h(
                  'ol',
                  { class: 'cihazListe' },
                  ios.map((c) =>
                    satir(
                      c,
                      c.udid,
                      c.ad,
                      c.surum,
                      c.durum === 'Booted',
                      'telefon',
                      c.durum === 'Booted'
                        ? dugme('k' + c.udid, 'dur', t('test.kapat'), (e) => (e.stopPropagation(), is('k' + c.udid, () => api.testIosKapat(c.udid)).then(yenile)))
                        : dugme('a' + c.udid, 'oynat', t('test.ac'), (e) => (e.stopPropagation(), is('a' + c.udid, () => api.testIosAc(c.udid)).then(() => ((secili = c.udid), yenile()))))
                    )
                  )
                )
              : h('p', { class: 'ipucu' }, t('test.iosBos'))
          )
        : null,
      h(
        'section',
        { class: 'panel' },
        h('h2', null, 'Android'),
        !a.adb && !a.emulator
          ? [h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 15), t('test.androidYok')), h('p', { class: 'ipucu' }, t('test.androidKur.' + (durum.platform === 'win32' ? 'win' : durum.platform === 'darwin' ? 'mac' : 'linux')))]
          : [
              a.cihazlar.length ? h('ol', { class: 'cihazListe' }, a.cihazlar.map((c) => satir(c, c.seri, c.ad, c.seri, c.durum === 'device', 'android', null))) : h('p', { class: 'ipucu' }, t('test.androidCihazYok')),
              a.avdler.length ? h('div', { class: 'avdListe' }, h('span', { class: 'alanEtiket' }, t('test.avdler')), a.avdler.map((v) => dugme('avd' + v, 'oynat', v, () => is('avd' + v, () => api.testAndroidBaslat(v)).then(() => (bildir(t('test.emulatorBasladi')), setTimeout(yenile, 8000)))))) : null,
            ]
      )
    );
  }

  function canliBolum() {
    const t = depo.t;
    const c = acikCihazlar().find((x) => x.kimlik === secili);
    if (!c) return h('section', { class: 'panel simCanli bos' }, h('h2', null, t('sim.canli')), h('p', { class: 'ipucu' }, t('sim.secilmedi')));
    const yaziGiris = h('input', { type: 'text', placeholder: t('sim.yaziYer'), class: 'simYazi', onkeydown: (e) => e.key === 'Enter' && gonderYazi() });
    const gonderYazi = async () => {
      if (!yaziGiris.value) return;
      const r = await api.simYaz(secili, yaziGiris.value);
      if (r && r.hata) return bildir(r.ayrinti || hataMetni(r), true);
      yaziGiris.value = '';
    };
    const uygSec = c.ios && uygulamalar.length ? h('select', { class: 'simUyg', onchange: (e) => e.target.value && is('uyg', () => api.simBaslat(secili, e.target.value)) }, h('option', { value: '' }, t('sim.uygulamaAc')), uygulamalar.map((u) => h('option', { value: u.paket }, u.ad))) : null;
    return h(
      'section',
      { class: 'panel simCanli' },
      h('header', { class: 'servisKatBas' }, h('div', null, h('h2', null, c.ad), h('p', { class: 'ipucu' }, c.alt + ' · ' + t('sim.ipucu'))), dugme('sef', 'oynat', t('test.sefeVer'), () => sefeVer(`${c.ad} (${c.alt})${c.ios ? ' iOS simülatörü' : ' Android cihazı'}`), 'ana')),
      durum.platform === 'darwin' && c.ios && !durum.axe ? h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 15), t('sim.axeYok')) : null,
      (klavyeNotCiz(), ekranKap),
      h(
        'div',
        { class: 'simAraclar' },
        dugme('ana', 'ofis', t('sim.anaEkran'), () => api.simTus(secili, 'anaEkran')),
        c.ios ? dugme('kilit', 'kalkan', t('sim.kilit'), () => api.simTus(secili, 'kilit')) : dugme('geri', 'geri', t('sim.geri'), () => api.simTus(secili, 'geri')),
        uygSec,
        h('span', { class: 'gitCommit simYaziKap' }, yaziGiris, h('button', { type: 'button', class: 'dugme kucuk', onclick: gonderYazi }, ikon('gonder', 13), t('sim.yaz')))
      )
    );
  }

  function ciz() {
    const t = depo.t;
    const ks = katlar();
    const katSec = ks.length ? h('select', { class: 'katSec', onchange: (e) => (secilenKat = e.target.value) }, ks.map((p) => h('option', { value: p.id }, p.ad))) : null;
    if (katSec) katSec.value = secilenKat || ks[0].id;
    const aciklar = durum ? acikCihazlar().filter((c) => c.ios) : [];
    doldur(
      kok,
      h(
        'header',
        { class: 'sayfaBas' },
        h('div', null, h('h1', null, t('sim.baslik')), h('p', null, t(durum && durum.platform === 'darwin' ? 'sim.aciklamaMac' : 'sim.aciklamaDiger'))),
        h('div', { class: 'satirDugme' }, katSec, h('button', { type: 'button', class: 'dugme', disabled: yukleniyor, onclick: yenile }, yukleniyor ? h('span', { class: 'donen' }) : ikon('yenile', 14), t('test.yenile')))
      ),
      aciklar.length > 1
        ? h('div', { class: 'simUyari' }, ikon('ucgen', 15), h('span', null, t('sim.cokAcik', { x: aciklar.length })), h('button', { type: 'button', class: 'dugme kucuk', disabled: !!calisan, onclick: () => is('diger', () => api.simDigerleriniKapat(secili)).then(yenile) }, t('sim.digerleriniKapat')))
        : null,
      !durum ? h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('test.araniyor')) : h('div', { class: 'simIzgara' }, canliBolum(), cihazListesi())
    );
  }

  dinle('sirket', () => kok.isConnected && !kok.hidden && ciz());
  // görüntü bir süre gelmezse (simülatör kapandı) akış yeniden kurulur
  setInterval(() => {
    if (gorunur && secili && Date.now() - sonKare > 5000) akisAyarla();
  }, 5000);
  return {
    kok,
    goster() {
      gorunur = true;
      yenile();
    },
    gizle() {
      gorunur = false;
      api.simAkis('');
    },
  };
}
