// Güncelleme arayüzü: hem ana penceredeki iç pencere hem de uygulama arkadayken çıkan küçük pencere bunu kullanır.
import { h, doldur, ikon, mdMetin } from './dom.js';

// durum: ana süreçten gelen güncelleme durumu. t: çevirici. eylem: api çağrıları. kucuk: köşedeki küçük pencere mi.
export function guncellemeIcerik(durum, t, eylem, { kucuk = false } = {}) {
  const d = durum || {};
  const baslik =
    d.asama === 'indi' ? t('guncel.hazir', { x: d.surum }) : d.asama === 'iniyor' ? t('guncel.iniyor', { x: d.surum }) : d.asama === 'hata' ? t('guncel.hata') : t('guncel.var', { x: d.surum });
  const dugmeler = [];
  if (d.asama === 'var' || d.asama === 'hata') {
    dugmeler.push(h('button', { type: 'button', class: 'dugme ana', onclick: eylem.indir }, ikon('indir', 14), t('guncel.simdi')));
    dugmeler.push(h('button', { type: 'button', class: 'dugme', onclick: eylem.sonra }, t('guncel.sonra')));
    if (!kucuk && d.asama === 'var') dugmeler.push(h('button', { type: 'button', class: 'dugme hayalet', onclick: eylem.atla }, t('guncel.atla')));
  } else if (d.asama === 'indi') {
    dugmeler.push(h('button', { type: 'button', class: 'dugme ana', onclick: eylem.kur }, ikon('yenile', 14), t('guncel.kur')));
    dugmeler.push(h('button', { type: 'button', class: 'dugme', onclick: eylem.sonra }, t('guncel.kapanista')));
  }
  if (kucuk && eylem.uygulamadaAc) dugmeler.push(h('button', { type: 'button', class: 'dugme hayalet', onclick: eylem.uygulamadaAc }, t('guncel.ayrinti')));
  return [
    h(
      'div',
      { class: 'guncelBas' },
      h('span', { class: 'guncelSimge' + (d.asama === 'indi' ? ' hazir' : '') }, ikon(d.asama === 'indi' ? 'tik' : 'indir', 18)),
      h('div', null, h('h2', null, baslik), h('p', null, t('guncel.mevcut', { x: d.mevcut || '' })))
    ),
    d.asama === 'iniyor' ? h('div', { class: 'guncelCubuk', role: 'progressbar', 'aria-valuenow': String(d.yuzde || 0), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('span', { style: `width:${d.yuzde || 0}%` })) : null,
    d.asama === 'iniyor' ? h('p', { class: 'guncelNot' }, t('guncel.yuzde', { x: d.yuzde || 0 })) : null,
    d.asama === 'hata' ? h('p', { class: 'durumSatir kotu', title: d.hata || '' }, ikon('ucgen', 15), t('guncel.hataKod.' + (d.hataKod || 'genel'))) : null,
    !kucuk && d.notlar && d.asama !== 'iniyor' ? h('div', { class: 'guncelNotlar' }, h('h3', null, t('guncel.yenilikler')), mdMetin(d.notlar)) : null,
    // küçük pencerede notların ilk birkaç maddesi
    kucuk && d.notlar && d.asama === 'var'
      ? h(
          'ul',
          { class: 'guncelOzet' },
          d.notlar
            .split('\n')
            .map((x) => x.replace(/^[-*#\s]+/, '').trim())
            .filter((x) => x && !/^(yenilikler|what.?s new)$/i.test(x))
            .slice(0, 3)
            .map((x) => h('li', null, x))
        )
      : null,
    d.asama === 'indi' ? h('p', { class: 'guncelNot' }, t('guncel.kurNot')) : null,
    dugmeler.length ? h('div', { class: 'guncelDugmeler' }, dugmeler) : null,
  ];
}

// Ana pencere: güncelleme gelince iç pencere açar, üst çubuğa rozet koyar, bu sürüme yeni geçildiyse "neler yeni" gösterir
export function guncellemeKur({ api, depo, ustRozetKap }) {
  let durum = depo.guncelleme || null;
  let perde = null;
  const t = (k, a) => depo.t(k, a);
  const eylem = {
    indir: () => api.guncellemeIndir(),
    kur: () => api.guncellemeKur(),
    sonra: () => (api.guncellemeSonra(), kapat()),
    atla: () => (api.guncellemeAtla(), kapat()),
  };

  function kapat() {
    if (perde) perde.remove();
    perde = null;
    document.removeEventListener('keydown', tus);
  }
  const tus = (e) => e.key === 'Escape' && kapat();

  function pencere(icerik) {
    if (!perde) {
      perde = h('div', { class: 'pencerePerde', onclick: (e) => e.target === perde && kapat() });
      document.body.append(perde);
      document.addEventListener('keydown', tus);
    }
    doldur(perde, h('div', { class: 'pencere guncelPencere', role: 'dialog', 'aria-modal': 'true' }, h('button', { type: 'button', class: 'simge guncelKapat', 'aria-label': t('genel.kapat'), onclick: kapat }, ikon('kapat', 16)), h('div', { class: 'pencereGovde' }, icerik)));
  }

  const goster = () => pencere(guncellemeIcerik(durum, t, eylem));

  function rozet() {
    if (!ustRozetKap) return;
    const d = durum || {};
    const gorunur = d.asama === 'var' || d.asama === 'iniyor' || d.asama === 'indi';
    doldur(
      ustRozetKap,
      gorunur
        ? h(
            'button',
            { type: 'button', class: 'guncelRozet' + (d.asama === 'indi' ? ' hazir' : ''), onclick: goster },
            ikon(d.asama === 'indi' ? 'tik' : 'indir', 13),
            d.asama === 'indi' ? t('guncel.rozetHazir') : d.asama === 'iniyor' ? t('guncel.yuzde', { x: d.yuzde || 0 }) : t('guncel.rozet', { x: d.surum })
          )
        : null
    );
  }

  // sahibe sorulması gereken bir durum ilk kez görülünce pencere kendiliğinden açılır
  const gosterilen = new Set();
  const sorulmali = (d) => d && d.sor && (d.asama === 'var' || d.asama === 'indi') && !gosterilen.has(d.asama + d.surum);
  const kendiligindenAc = () => {
    if (!sorulmali(durum) || !document.hasFocus()) return;
    gosterilen.add(durum.asama + durum.surum);
    goster();
  };
  api.guncellemeDinle((d) => {
    durum = d;
    rozet();
    if (perde && perde.querySelector('.guncelPencere') && !perde.querySelector('.yenilikPencere')) goster();
    else kendiligindenAc();
  });
  window.addEventListener('focus', kendiligindenAc);
  api.guncellemeGosterDinle((d) => {
    durum = d;
    rozet();
    gosterilen.add(d.asama + d.surum);
    goster();
  });
  rozet();
  if (!depo.yenilikler) kendiligindenAc();

  // güncellemeden sonraki ilk açılış
  const y = depo.yenilikler;
  if (y) {
    pencere([
      h('div', { class: 'guncelBas yenilikPencere' }, h('span', { class: 'guncelSimge hazir' }, ikon('tik', 18)), h('div', null, h('h2', null, t('guncel.guncellendi', { x: y.surum })), h('p', null, t('guncel.oncekiden', { x: y.onceki })))),
      y.notlar ? h('div', { class: 'guncelNotlar' }, h('h3', null, t('guncel.yenilikler')), mdMetin(y.notlar)) : h('p', { class: 'guncelNot' }, t('guncel.notYok')),
      h('div', { class: 'guncelDugmeler' }, h('button', { type: 'button', class: 'dugme ana', onclick: kapat }, t('guncel.tamam'))),
    ]);
  }
  return { goster };
}
