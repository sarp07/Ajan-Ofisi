// İnternet bağlantısı yokken çıkan katman: durum, ne olacağı ve bekleme oyunu. Bağlantı gelince kendiliğinden kapanır.
import { h, ikon } from './dom.js';
import { kosuOyunu } from './kosu.js';

export function cevrimdisiKur({ api, depo, bildir }) {
  let katman = null;
  let oyun = null;
  let gizlendi = false;
  const t = (k, a) => depo.t(k, a);

  function ac() {
    if (katman || gizlendi) return;
    const tuval = h('canvas', { class: 'kosuTuval', 'aria-label': t('cevrimdisi.oyun') });
    katman = h(
      'div',
      { class: 'cevrimdisi', role: 'alertdialog', 'aria-live': 'assertive' },
      h(
        'div',
        { class: 'cevrimdisiKutu' },
        h('div', { class: 'cevrimdisiBas' }, h('span', { class: 'cevrimdisiSimge' }, ikon('dunya', 20)), h('div', null, h('h2', null, t('cevrimdisi.baslik')), h('p', null, t('cevrimdisi.aciklama')))),
        tuval,
        h('p', { class: 'cevrimdisiIpucu' }, t('cevrimdisi.ipucu')),
        h(
          'button',
          {
            type: 'button',
            class: 'dugme',
            onclick: () => {
              gizlendi = true;
              kapat();
            },
          },
          t('cevrimdisi.gizle')
        )
      )
    );
    document.body.append(katman);
    oyun = kosuOyunu(tuval, { yazilar: { rekor: t('cevrimdisi.rekor'), basla: t('cevrimdisi.basla'), bitti: t('cevrimdisi.bitti') } });
  }

  function kapat() {
    if (oyun) oyun.durdur();
    oyun = null;
    if (katman) katman.remove();
    katman = null;
  }

  api.baglantiDinle((d) => {
    if (d.cevrimici) {
      const acikti = !!katman || gizlendi;
      gizlendi = false;
      kapat();
      if (acikti) bildir(t('cevrimdisi.geldi'));
    } else ac();
  });
  api.baglantiDurum().then((d) => d && !d.cevrimici && ac());
}
