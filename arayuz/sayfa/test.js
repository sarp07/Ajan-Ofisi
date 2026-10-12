// Test alanı: bu bilgisayarda kullanılabilen iOS simülatörleri ve Android cihazları, web testi ve şefe test işi verme.
// Mac'te iOS ve Android, Windows ve Linux'ta yalnızca Android gösterilir.
import { h, doldur, ikon } from '../dom.js';
import { depo, api, dinle, bildir, hataMetni } from '../depo.js';

export function testSayfasi({ git } = {}) {
  const kok = h('div', { class: 'sayfa testSayfa' });
  let durum = null;
  let yukleniyor = false;
  let goruntu = null; // { ad, veri }
  let calisan = '';

  async function yenile() {
    yukleniyor = true;
    ciz();
    const r = await api.testDurum();
    yukleniyor = false;
    durum = r && r.tamam ? r.sonuc : null;
    if (r && r.hata) bildir(hataMetni(r), true);
    ciz();
  }

  async function is(ad, fn) {
    calisan = ad;
    ciz();
    const r = await fn();
    calisan = '';
    if (!r || r.hata) bildir(hataMetni(r), true);
    return r;
  }

  const katlar = () => depo.sirket.projeler.filter((p) => p.tur !== 'kisisel');
  let secilenKat = '';

  function sefeVer(cihaz) {
    const kat = secilenKat || (katlar()[0] || {}).id;
    if (!kat) return bildir(depo.t('test.katYok'), true);
    is('sef', () => api.testSefeVer(kat, cihaz)).then((r) => r && r.tamam && bildir(depo.t('test.sefeVerildi', { x: cihaz })));
  }

  const dugme = (ad, ikonAd, yazi, onclick, ana) => h('button', { type: 'button', class: 'dugme kucuk' + (ana ? ' ana' : ''), disabled: !!calisan, onclick }, calisan === ad ? h('span', { class: 'donen' }) : ikon(ikonAd, 13), yazi);

  function iosBolumu() {
    const t = depo.t;
    if (durum.platform !== 'darwin') return h('section', { class: 'panel' }, h('h2', null, 'iOS'), h('p', { class: 'ipucu' }, t('test.iosMacYok')));
    const liste = durum.ios || [];
    return h(
      'section',
      { class: 'panel' },
      h('h2', null, t('test.iosBaslik')),
      durum.iosHata ? h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 15), t('test.xcodeYok')) : null,
      liste.length
        ? h(
            'ol',
            { class: 'cihazListe' },
            liste.map((c) => {
              const acik = c.durum === 'Booted';
              return h(
                'li',
                { class: 'cihazSatir' + (acik ? ' acik' : '') },
                ikon('telefon', 16),
                h('div', { class: 'cihazAd' }, h('b', null, c.ad), h('span', null, c.surum)),
                h('span', { class: 'cihazDurum' }, acik ? h('span', { class: 'katNokta' }) : null, t(acik ? 'test.acik' : 'test.kapali')),
                h(
                  'div',
                  { class: 'satirDugme' },
                  acik
                    ? [
                        dugme('g' + c.udid, 'goz', t('test.goruntu'), async () => {
                          const r = await is('g' + c.udid, () => api.testIosGoruntu(c.udid));
                          if (r && r.tamam) ((goruntu = { ad: c.ad, veri: r.sonuc }), ciz());
                        }),
                        dugme('sef', 'oynat', t('test.sefeVer'), () => sefeVer(`${c.ad} (${c.surum}) iOS simülatörü`), true),
                        dugme('k' + c.udid, 'dur', t('test.kapat'), async () => (await is('k' + c.udid, () => api.testIosKapat(c.udid)), yenile())),
                      ]
                    : dugme('a' + c.udid, 'oynat', t('test.ac'), async () => (await is('a' + c.udid, () => api.testIosAc(c.udid)), yenile()))
                )
              );
            })
          )
        : h('p', { class: 'ipucu' }, t('test.iosBos'))
    );
  }

  function androidBolumu() {
    const t = depo.t;
    const a = durum.android;
    if (!a.adb && !a.emulator) {
      return h('section', { class: 'panel' }, h('h2', null, 'Android'), h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 15), t('test.androidYok')), h('p', { class: 'ipucu' }, t('test.androidKur.' + (durum.platform === 'win32' ? 'win' : durum.platform === 'darwin' ? 'mac' : 'linux'))));
    }
    return h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Android'),
      a.cihazlar.length
        ? h(
            'ol',
            { class: 'cihazListe' },
            a.cihazlar.map((c) =>
              h(
                'li',
                { class: 'cihazSatir acik' },
                ikon('android', 16),
                h('div', { class: 'cihazAd' }, h('b', null, c.ad), h('span', null, c.seri)),
                h('span', { class: 'cihazDurum' }, h('span', { class: 'katNokta' }), c.durum),
                h(
                  'div',
                  { class: 'satirDugme' },
                  dugme('g' + c.seri, 'goz', t('test.goruntu'), async () => {
                    const r = await is('g' + c.seri, () => api.testAndroidGoruntu(c.seri));
                    if (r && r.tamam) ((goruntu = { ad: c.ad, veri: r.sonuc }), ciz());
                  }),
                  dugme('sef', 'oynat', t('test.sefeVer'), () => sefeVer(`${c.ad} Android cihazı`), true)
                )
              )
            )
          )
        : h('p', { class: 'ipucu' }, t('test.androidCihazYok')),
      a.avdler.length
        ? h(
            'div',
            { class: 'avdListe' },
            h('span', { class: 'alanEtiket' }, t('test.avdler')),
            a.avdler.map((v) => dugme('avd' + v, 'oynat', v, async () => (await is('avd' + v, () => api.testAndroidBaslat(v)), bildir(t('test.emulatorBasladi')), setTimeout(yenile, 8000))))
          )
        : null
    );
  }

  function ciz() {
    const t = depo.t;
    const ks = katlar();
    const katSec = ks.length
      ? h(
          'select',
          { class: 'katSec', onchange: (e) => (secilenKat = e.target.value) },
          ks.map((p) => h('option', { value: p.id }, p.ad))
        )
      : null;
    if (katSec) katSec.value = secilenKat || ks[0].id;
    doldur(
      kok,
      h(
        'header',
        { class: 'sayfaBas' },
        h('div', null, h('h1', null, t('test.baslik')), h('p', null, t(durum && durum.platform === 'darwin' ? 'test.aciklamaMac' : 'test.aciklamaDiger'))),
        h('div', { class: 'satirDugme' }, katSec, h('button', { type: 'button', class: 'dugme', disabled: yukleniyor, onclick: yenile }, yukleniyor ? h('span', { class: 'donen' }) : ikon('yenile', 14), t('test.yenile')))
      ),
      !durum
        ? h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('test.araniyor'))
        : h(
            'div',
            { class: 'testIzgara' },
            h('div', { class: 'testSol' }, iosBolumu(), androidBolumu(), h('section', { class: 'panel' }, h('h2', null, 'Web'), h('p', { class: 'ipucu' }, t('test.web')), h('div', { class: 'satirDugme' }, h('button', { type: 'button', class: 'dugme', onclick: () => git && git('tarayici') }, ikon('dunya', 14), t('test.tarayiciyaGit'))))),
            h('aside', { class: 'panel testGoruntu' }, h('h2', null, goruntu ? goruntu.ad : t('test.goruntuBaslik')), goruntu ? h('img', { src: 'data:image/png;base64,' + goruntu.veri, alt: goruntu.ad }) : h('p', { class: 'ipucu' }, t('test.goruntuBos')))
          )
    );
  }

  dinle('sirket', () => kok.isConnected && !kok.hidden && ciz());
  return {
    kok,
    goster() {
      if (!durum) yenile();
      else ciz();
    },
    gizle() {},
  };
}
