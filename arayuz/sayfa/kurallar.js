// Kurallar sayfası: şirket kuralları elle yazılır ya da şefe yazdırılır.
import { h, doldur, ikon, listeDuzenleyici } from '../dom.js';
import { depo, api, dinle, bildir, hataMetni } from '../depo.js';

export function kurallarSayfasi() {
  const kok = h('div', { class: 'sayfa kuralSayfa' });
  let duzenleyici = null;
  let sonYazilan = '';

  const kaydet = async (metinler) => {
    const eski = depo.sirket.kurallar;
    const kurallar = metinler.map((m, i) => ({ id: eski[i] && eski[i].metin === m ? eski[i].id : undefined, metin: m }));
    sonYazilan = JSON.stringify(metinler);
    await api.sirketGuncelle({ kurallar });
  };

  function ciz() {
    const t = depo.t;
    const s = depo.sirket;
    const metinler = s.kurallar.map((k) => k.metin);
    duzenleyici = listeDuzenleyici(metinler, kaydet, t('kural.ekle'));
    const tarif = h('textarea', { rows: '2', placeholder: t('kural.tarifOrnek') });
    const oneriler = h('div', { class: 'oneriler' });
    const dugme = h('button', { type: 'button', class: 'dugme' }, ikon('sihir', 15), t('duz.yazdir'));
    dugme.addEventListener('click', async () => {
      if (!tarif.value.trim()) return tarif.focus();
      dugme.disabled = true;
      dugme.lastChild.textContent = t('duz.yaziyor', { x: s.sef.ad });
      const r = await api.taslakKural(tarif.value);
      dugme.disabled = false;
      dugme.lastChild.textContent = t('duz.yazdir');
      if (!r || r.hata) return bildir(hataMetni(r), true);
      const ekle = (k, satir) => {
        const yeni = [...duzenleyici.al(), k];
        duzenleyici.ayarla(yeni);
        kaydet(yeni);
        satir.remove();
      };
      doldur(
        oneriler,
        r.sonuc.kurallar.map((k) => {
          const satir = h('div', { class: 'oneri' }, h('span', null, k));
          satir.append(h('button', { type: 'button', class: 'dugme kucuk', onclick: () => ekle(k, satir) }, t('genel.ekle')));
          return satir;
        })
      );
    });

    doldur(
      kok,
      h('header', { class: 'sayfaBas' }, h('div', null, h('h1', null, t('kural.baslik')), h('p', null, t('kural.aciklama', { x: s.ad })))),
      h(
        'div',
        { class: 'ikiSutun' },
        h('section', { class: 'panel' }, h('h2', null, t('kural.liste'), h('span', { class: 'adet' }, s.kurallar.length || '')), duzenleyici, h('p', { class: 'ipucu' }, t(depo.oturum.acik ? 'kural.oturumNot' : 'kural.not'))),
        h('section', { class: 'panel yazdirKutu' }, h('h3', null, ikon('sihir', 16), t('duz.yazdirBaslik', { x: s.sef.ad })), h('p', null, t('kural.yazdirAciklama')), tarif, dugme, oneriler)
      )
    );
  }

  dinle('sirket', () => {
    // kendi yazdığımız değişiklikte imleç kaybolmasın
    if (JSON.stringify(depo.sirket.kurallar.map((k) => k.metin)) === sonYazilan && kok.querySelector('.listeDuz')) return;
    ciz();
  });
  ciz();
  return { kok, goster: ciz, gizle() {} };
}
