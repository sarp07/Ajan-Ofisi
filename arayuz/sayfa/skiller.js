// Skiller sayfası: kurulu skiller, hazır katalog ve özel skill ekleme.
import { h, doldur, ikon, alan, anahtar } from '../dom.js';
import { depo, api, dinle, yayinla, bildir, hataMetni } from '../depo.js';

const ALAN_SIRA = ['tasarim', 'guvenlik', 'surec', 'kod', 'test', 'skill'];

export function skillerSayfasi() {
  const kok = h('div', { class: 'sayfa skillSayfa' });
  const katman = h('div', { class: 'katman', hidden: true });
  const ilerleme = new Map(); // id -> iniyor | tamam | hata

  const skillKoy = (liste) => {
    depo.skiller = liste;
    yayinla('skiller');
  };

  async function kur(idler) {
    for (const id of idler) ilerleme.set(id, 'iniyor');
    ciz();
    const r = await api.skillKatalogKur(idler);
    if (!r || r.hata) bildir(hataMetni(r), true);
    else {
      const hatali = r.sonuc.filter((x) => x.hata);
      if (hatali.length) bildir(depo.t('skill.indirilemedi', { x: hatali.map((x) => x.id).join(', ') }), true);
      else bildir(depo.t('skill.kuruldu', { x: r.sonuc.length }));
      skillKoy(r.skiller);
    }
    for (const id of idler) ilerleme.delete(id);
    ciz();
  }

  function kaynakYaz(k) {
    const t = depo.t;
    if (!k) return '';
    if (k.tur === 'github') return h('a', { href: `https://github.com/${k.repo}`, target: '_blank', rel: 'noreferrer' }, k.repo);
    if (k.tur === 'klasor') return t('skill.kaynakKlasor');
    if (k.tur === 'elle') return t('skill.kaynakElle');
    return '';
  }

  async function goster(id) {
    const r = await api.skillOku(id);
    if (!r || r.hata) return bildir(hataMetni(r), true);
    doldur(
      katman,
      h(
        'div',
        { class: 'pencere genis', onclick: (e) => e.stopPropagation() },
        h('header', null, h('h2', null, id), h('button', { type: 'button', class: 'simge', onclick: () => (katman.hidden = true) }, ikon('kapat', 18))),
        h('pre', { class: 'skillMetin' }, r.metin)
      )
    );
    katman.hidden = false;
  }

  function yeniYaz() {
    const t = depo.t;
    const taslak = { ad: '', aciklama: '', govde: '' };
    const ad = h('input', { type: 'text', placeholder: t('skill.adOrnek'), oninput: () => (taslak.ad = ad.value) });
    const aciklama = h('textarea', { rows: '2', placeholder: t('skill.aciklamaOrnek'), oninput: () => (taslak.aciklama = aciklama.value) });
    const govde = h('textarea', { rows: '12', class: 'mono', placeholder: t('skill.govdeOrnek'), oninput: () => (taslak.govde = govde.value) });
    const tarif = h('textarea', { rows: '2', placeholder: t('skill.tarifOrnek') });
    const yazDugme = h('button', { type: 'button', class: 'dugme' }, ikon('sihir', 15), t('duz.yazdir'));
    yazDugme.addEventListener('click', async () => {
      if (!tarif.value.trim()) return tarif.focus();
      yazDugme.disabled = true;
      yazDugme.lastChild.textContent = t('duz.yaziyor', { x: depo.sirket.sef.ad });
      const r = await api.taslakSkill(tarif.value);
      yazDugme.disabled = false;
      yazDugme.lastChild.textContent = t('duz.yazdir');
      if (!r || r.hata) return bildir(hataMetni(r), true);
      Object.assign(taslak, r.sonuc);
      ad.value = taslak.ad;
      aciklama.value = taslak.aciklama;
      govde.value = taslak.govde;
    });
    doldur(
      katman,
      h(
        'div',
        { class: 'pencere genis', onclick: (e) => e.stopPropagation() },
        h('header', null, h('h2', null, t('skill.yeniBaslik')), h('button', { type: 'button', class: 'simge', onclick: () => (katman.hidden = true) }, ikon('kapat', 18))),
        h(
          'div',
          { class: 'pencereGovde' },
          h('section', { class: 'yazdirKutu' }, h('h3', null, ikon('sihir', 16), t('duz.yazdirBaslik', { x: depo.sirket.sef.ad })), h('p', null, t('skill.yazdirAciklama')), tarif, yazDugme),
          alan(t('skill.ad'), ad, t('skill.adIpucu')),
          alan(t('skill.aciklama'), aciklama, t('skill.aciklamaIpucu')),
          alan(t('skill.govde'), govde)
        ),
        h(
          'footer',
          null,
          h('button', { type: 'button', class: 'dugme', onclick: () => (katman.hidden = true) }, t('genel.vazgec')),
          h(
            'button',
            {
              type: 'button',
              class: 'dugme ana',
              onclick: async () => {
                const r = await api.skillYeni(taslak);
                if (!r || r.hata) return bildir(hataMetni(r), true);
                skillKoy(r.skiller);
                katman.hidden = true;
                bildir(t('skill.eklendi', { x: r.id }));
              },
            },
            t('genel.kaydet')
          )
        )
      )
    );
    katman.hidden = false;
    requestAnimationFrame(() => tarif.focus());
  }

  function ciz() {
    const t = depo.t;
    const dil = depo.sirket.dil;
    const kurulu = new Set(depo.skiller.map((s) => s.id));
    const gorunen = depo.katalog.filter((k) => !k.gizli);
    const onerilen = gorunen.filter((k) => k.varsayilan && !kurulu.has(k.id)).map((k) => k.id);
    const adres = h('input', { type: 'text', placeholder: 'github.com/sahip/depo/tree/main/skills/ornek' });
    const githubEkle = async (dugme) => {
      if (!adres.value.trim()) return adres.focus();
      dugme.disabled = true;
      const r = await api.skillGithub(adres.value);
      dugme.disabled = false;
      if (!r || r.hata) return bildir(hataMetni(r), true);
      skillKoy(r.skiller);
      bildir(t('skill.eklendi', { x: r.kurulan.join(', ') }));
    };
    const githubDugme = h('button', { type: 'button', class: 'dugme', onclick: () => githubEkle(githubDugme) }, t('genel.ekle'));

    doldur(
      kok,
      h('header', { class: 'sayfaBas' }, h('div', null, h('h1', null, t('skill.baslik')), h('p', null, t('skill.aciklamaUst')))),

      h('h2', { class: 'araBaslik' }, t('skill.kurulu'), h('span', { class: 'adet' }, depo.skiller.length || '')),
      depo.skiller.length
        ? h(
            'div',
            { class: 'skillListe' },
            depo.skiller.map((s) =>
              h(
                'div',
                { class: 'skillSatir' + (s.etkin ? '' : ' kapali') },
                anahtar(s.etkin, async (v) => {
                  const r = await api.skillEtkin(s.id, v);
                  if (r && r.skiller) skillKoy(r.skiller);
                }),
                h('div', { class: 'skillBilgi' }, h('div', { class: 'skillAd' }, s.id), h('div', { class: 'skillAciklama' }, s.aciklama || ''), h('div', { class: 'skillMeta' }, kaynakYaz(s.kaynak), s.lisans ? h('span', null, s.lisans) : null)),
                h('button', { type: 'button', class: 'simge', title: t('skill.gor'), onclick: () => goster(s.id) }, ikon('goz', 16)),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'simge',
                    title: t('genel.sil'),
                    onclick: async () => {
                      const r = await api.skillSil(s.id);
                      if (r && r.skiller) skillKoy(r.skiller);
                    },
                  },
                  ikon('cop', 16)
                )
              )
            )
          )
        : h('p', { class: 'bosNot' }, t('skill.yok')),

      h(
        'div',
        { class: 'araSatir' },
        h('h2', { class: 'araBaslik' }, t('skill.katalog')),
        onerilen.length ? h('button', { type: 'button', class: 'dugme ana', onclick: () => kur(onerilen) }, ikon('arti', 15), t('skill.onerilenKur', { x: onerilen.length })) : null
      ),
      h('p', { class: 'araAciklama' }, t('skill.katalogAciklama')),
      ALAN_SIRA.map((alanAd) => {
        const liste = gorunen.filter((k) => k.alan === alanAd);
        if (!liste.length) return null;
        return h(
          'section',
          { class: 'katalogBolum' },
          h('h3', null, t('skillAlan.' + alanAd)),
          h(
            'div',
            { class: 'katalogIzgara' },
            liste.map((k) => {
              const durum = ilerleme.get(k.id);
              const var_ = kurulu.has(k.id);
              return h(
                'div',
                { class: 'katalogKart' + (var_ ? ' kurulu' : '') },
                h('div', { class: 'katalogUst' }, h('b', null, k.id), k.varsayilan ? h('span', { class: 'rozet' }, t('skill.onerilen')) : null),
                h('p', null, k[dil] || k.tr),
                h('div', { class: 'skillMeta' }, h('a', { href: `https://github.com/${k.repo}`, target: '_blank', rel: 'noreferrer' }, k.repo), h('span', null, k.lisans), k.not ? h('span', { class: 'uyariNot' }, t('skillNot.' + k.not)) : null),
                var_
                  ? h('span', { class: 'kuruldu' }, ikon('tik', 14), t('skill.kurulduEtiket'))
                  : h('button', { type: 'button', class: 'dugme kucuk', disabled: !!durum, onclick: () => kur([k.id]) }, durum === 'iniyor' ? t('skill.iniyor') : t('skill.kur'))
              );
            })
          )
        );
      }),

      h('h2', { class: 'araBaslik' }, t('skill.ozel')),
      h('p', { class: 'araAciklama uyari' }, ikon('ucgen', 15), t('skill.guven')),
      h(
        'div',
        { class: 'ozelIzgara' },
        h('div', { class: 'ozelKart' }, h('h3', null, t('skill.github')), h('p', null, t('skill.githubAciklama')), h('div', { class: 'satirGiris' }, adres, githubDugme)),
        h(
          'div',
          { class: 'ozelKart' },
          h('h3', null, t('skill.klasor')),
          h('p', null, t('skill.klasorAciklama')),
          h(
            'button',
            {
              type: 'button',
              class: 'dugme',
              onclick: async () => {
                const r = await api.skillKlasor();
                if (!r || r.iptal) return;
                if (r.hata) return bildir(hataMetni(r), true);
                skillKoy(r.skiller);
                bildir(t('skill.eklendi', { x: r.kurulan.join(', ') }));
              },
            },
            ikon('klasor', 15),
            t('skill.klasorSec')
          )
        ),
        h('div', { class: 'ozelKart' }, h('h3', null, t('skill.yaz')), h('p', null, t('skill.yazAciklama')), h('button', { type: 'button', class: 'dugme', onclick: yeniYaz }, ikon('kalem', 15), t('skill.yazDugme')))
      ),
      katman
    );
  }

  katman.addEventListener('click', () => (katman.hidden = true));
  api.skillIlerleme((v) => {
    if (v.durum === 'iniyor') ilerleme.set(v.id, 'iniyor');
  });
  dinle('skiller', ciz);
  dinle('sirket', ciz);
  ciz();
  return { kok, goster: ciz, gizle() {} };
}
