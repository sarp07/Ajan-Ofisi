// Yeni kat penceresi: var olan klasörü seç, sıfırdan klasör aç (istersen git ve GitHub reposuyla) ya da GitHub'dan klonla.
import { h, doldur, ikon, alan, anahtar } from './dom.js';
import { depo, api, bildir, hataMetni, gorunumSec } from './depo.js';

export function katKurAc({ bitti } = {}) {
  const t = depo.t;
  let sekme = 'yeni';
  let koku = '';
  let repolar = null;
  let repoHata = '';
  let arama = '';
  let calisiyor = false;
  const yeni = { ad: '', git: true, github: false, gizli: true };

  const perde = h('div', { class: 'pencerePerde', onclick: (e) => e.target === perde && kapat() });
  const kutu = h('div', { class: 'pencere katKurPencere', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('katKur.baslik') });
  perde.append(kutu);
  const kapat = () => {
    perde.remove();
    document.removeEventListener('keydown', tus);
  };
  const tus = (e) => e.key === 'Escape' && !calisiyor && kapat();
  document.addEventListener('keydown', tus);

  async function tamam(proje) {
    kapat();
    gorunumSec('kat');
    bildir(t('katKur.acildi', { x: proje.ad }));
    if (bitti) bitti(proje);
  }

  async function calistir(is) {
    calisiyor = true;
    ciz();
    const r = await is();
    calisiyor = false;
    if (!r || r.hata) {
      bildir(hataMetni(r), true);
      ciz();
      return;
    }
    if (r.proje) tamam(r.proje);
  }

  function yeniCiz() {
    const g = depo.bilgi.github || {};
    const ad = h('input', { type: 'text', value: yeni.ad, maxlength: '60', placeholder: t('katKur.adOrnek'), oninput: () => ((yeni.ad = ad.value), (onizle.textContent = koku + '/' + klasor(ad.value))) });
    const klasor = (x) =>
      String(x || '')
        .trim()
        .replace(/[şŞ]/g, 's')
        .replace(/[ıİ]/g, 'i')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u')
        .replace(/[öÖ]/g, 'o')
        .replace(/[çÇ]/g, 'c')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '') || '…';
    const onizle = h('code', { class: 'yol' }, koku + '/' + klasor(yeni.ad));
    setTimeout(() => ad.focus(), 0);
    return [
      alan(t('katKur.ad'), ad),
      h('div', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('katKur.konum')), onizle, h('button', { type: 'button', class: 'dugme kucuk kokDugme', onclick: async () => { const r = await api.katKokuSec(); if (r && r.yol) { koku = r.yol; ciz(); } } }, ikon('klasor', 13), t('katKur.kokDegistir'))),
      h('div', { class: 'alan yatay' }, anahtar(yeni.git, (v) => ((yeni.git = v), ciz()), t('katKur.git'))),
      g.var && g.girisli
        ? [
            h('div', { class: 'alan yatay' }, anahtar(yeni.github, (v) => ((yeni.github = v), v && (yeni.git = true), ciz()), t('katKur.github', { x: g.hesap }))),
            yeni.github ? h('div', { class: 'alan yatay' }, anahtar(yeni.gizli, (v) => (yeni.gizli = v), t('katKur.gizli'))) : null,
          ]
        : h('p', { class: 'ipucu' }, t('katKur.githubYok')),
      h(
        'div',
        { class: 'pencereAlt' },
        h('button', { type: 'button', class: 'dugme', onclick: kapat, disabled: calisiyor }, t('genel.vazgec')),
        h(
          'button',
          { type: 'button', class: 'dugme ana', disabled: calisiyor, onclick: () => yeni.ad.trim() ? calistir(() => api.katYeni({ ad: yeni.ad, gitBaslat: yeni.git, githubOlustur: yeni.github, gizli: yeni.gizli })) : ad.focus() },
          calisiyor ? h('span', { class: 'donen' }) : ikon('arti', 14),
          t('katKur.olustur')
        )
      ),
    ];
  }

  function klonCiz() {
    const g = depo.bilgi.github || {};
    if (!g.var || !g.girisli) return [h('p', { class: 'ipucu' }, t('katKur.githubYok')), h('div', { class: 'pencereAlt' }, h('button', { type: 'button', class: 'dugme', onclick: kapat }, t('genel.kapat')))];
    if (repolar === null && !repoHata) {
      api.githubRepolar().then((r) => {
        if (r && r.tamam) repolar = r.liste;
        else repoHata = hataMetni(r);
        ciz();
      });
      return h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('katKur.repolarYukleniyor'));
    }
    if (repoHata) return h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), repoHata);
    const ara = h('input', { type: 'text', value: arama, placeholder: t('katKur.ara'), oninput: () => ((arama = ara.value), listeCiz()) });
    const liste = h('ol', { class: 'repoListe' });
    const listeCiz = () => {
      const q = arama.trim().toLowerCase();
      const bulunan = repolar.filter((r) => !q || r.tam.toLowerCase().includes(q) || r.aciklama.toLowerCase().includes(q)).slice(0, 60);
      doldur(
        liste,
        bulunan.length
          ? bulunan.map((r) =>
              h(
                'li',
                null,
                h(
                  'button',
                  { type: 'button', class: 'repoSatirDugme', disabled: calisiyor, onclick: () => calistir(() => api.katKlonla(r.tam)) },
                  ikon('dal', 14),
                  h('span', { class: 'repoAd' }, h('b', null, r.tam), r.aciklama ? h('span', null, r.aciklama) : null),
                  r.gizli ? h('span', { class: 'rozet' }, t('katKur.gizliRozet')) : null
                )
              )
            )
          : h('li', { class: 'ipucu' }, t('katKur.bulunamadi'))
      );
    };
    listeCiz();
    setTimeout(() => ara.focus(), 0);
    return [ara, calisiyor ? h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('katKur.klonlaniyor')) : null, liste, h('p', { class: 'ipucu' }, t('katKur.klonNot', { x: koku }))];
  }

  function ciz() {
    doldur(
      kutu,
      h('header', { class: 'pencereBas' }, h('h2', null, t('katKur.baslik')), h('button', { type: 'button', class: 'simge', 'aria-label': t('genel.kapat'), onclick: kapat, disabled: calisiyor }, ikon('kapat', 16))),
      h(
        'div',
        { class: 'bolmeli tam', role: 'tablist' },
        [
          ['yeni', 'katKur.sekmeYeni'],
          ['klon', 'katKur.sekmeKlon'],
          ['sec', 'katKur.sekmeSec'],
        ].map(([s, k]) =>
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              class: sekme === s ? 'secili' : '',
              'aria-selected': sekme === s ? 'true' : 'false',
              disabled: calisiyor,
              onclick: async () => {
                if (s === 'sec') {
                  const r = await api.projeSec();
                  if (r && r.tamam) tamam(r.proje);
                  return;
                }
                sekme = s;
                ciz();
              },
            },
            t(k)
          )
        )
      ),
      h('div', { class: 'pencereGovde' }, sekme === 'yeni' ? yeniCiz() : klonCiz())
    );
  }

  api.katKoku().then((r) => {
    koku = (r && r.yol) || '';
    ciz();
  });
  ciz();
  document.body.append(perde);
}
