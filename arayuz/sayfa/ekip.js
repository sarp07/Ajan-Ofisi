// Ekip sayfası: çalışan kartları, yeni çalışan yaratma, düzenleme ve eğitme.
import { h, doldur, ikon, alan, anahtar, cipGirisi, listeDuzenleyici } from '../dom.js';
import { depo, api, dinle, bildir, hataMetni, gorunumSec } from '../depo.js';
import { portre } from '../portre.js';
import { katKurAc } from '../katKur.js';
import { RENKLER, TENLER, SACLAR, STILLER, EKLER, ESYALAR, gorunusUret } from '../../cekirdek/kimlik.js';

export function ekipSayfasi({ git } = {}) {
  const kok = h('div', { class: 'sayfa ekipSayfa' });
  const cekmece = h('div', { class: 'cekmece', hidden: true });
  const perde = h('div', { class: 'perde', hidden: true, onclick: () => kapat() });
  let acik = null; // düzenlenen taslak

  // ---------- kartlar ----------
  const haplar = new Map();
  function hapYaz(el, rolId) {
    const canli = depo.canli.ajanlar.find((a) => a.rol === rolId);
    const metin = canli ? depo.t('durum.' + canli.durum) : depo.t('durum.yok');
    if (el.textContent !== metin) el.textContent = metin;
    if (canli) el.setAttribute('data-d', canli.durum);
    else el.removeAttribute('data-d');
  }

  // Özel sohbet: kişiyle bire bir, beyinden ve şeften bağımsız konuşma
  function ozelSohbet(k) {
    gorunumSec(`ozel:${depo.sirket.katId}:${k.id}`);
    if (git) git('ofis');
  }

  function kart(k, { sef } = {}) {
    const ana = kartGovde(k, { sef });
    if (sef) return ana;
    return h(
      'div',
      { class: 'kisiKartKap' },
      ana,
      h('button', { type: 'button', class: 'dugme ozelDugme', title: depo.t('ekip.ozelIpucu', { x: k.ad }), onclick: () => ozelSohbet(k) }, ikon('gonder', 13), depo.t('ekip.ozel'))
    );
  }

  function kartGovde(k, { sef } = {}) {
    const hap = h('span', { class: 'hap' });
    haplar.set(sef ? 'sef' : k.id, hap);
    hapYaz(hap, sef ? 'sef' : k.id);
    return h(
      'button',
      { type: 'button', class: 'kisiKart', onclick: () => ac(sef ? { sef: true, ...depo.sirket.sef } : { ...k }) },
      portre(k, 60, 70, 2.0),
      h(
        'div',
        { class: 'kisiBilgi' },
        h('div', { class: 'kisiAd' }, k.ad, sef ? h('span', { class: 'rozet' }, depo.t('ekip.sefRozet')) : null),
        h('div', { class: 'kisiUnvan' }, k.unvan || depo.t('ekip.unvanYok')),
        h('div', { class: 'cipler' }, (k.alanlar || []).slice(0, 4).map((x) => h('span', { class: 'cip sade' }, x)))
      ),
      hap
    );
  }

  // Ekipler kata özeldir: sayfa seçili katın ekibini gösterir
  function katSecici() {
    const s = depo.sirket;
    const sec = h('select', { class: 'katSec', onchange: () => api.sirketGuncelle({ sonProje: sec.value }) }, s.projeler.map((p, i) => h('option', { value: p.id }, `${i + 1}. ${p.ad}`)));
    sec.value = s.sonProje || '';
    return sec;
  }

  function ciz() {
    const t = depo.t;
    const s = depo.sirket;
    haplar.clear();
    if (!s.katId) {
      doldur(
        kok,
        h('header', { class: 'sayfaBas' }, h('div', null, h('h1', null, t('ekip.baslik')), h('p', null, t('ekip.katsizAciklama')))),
        h(
          'div',
          { class: 'binaBos' },
          h('p', null, t('ekip.katsiz', { x: s.beyin.ad })),
          h(
            'div',
            { class: 'satirDugme' },
            h(
              'button',
              {
                type: 'button',
                class: 'dugme ana',
                onclick: () => {
                  gorunumSec('beyin');
                  if (git) git('ofis');
                },
              },
              ikon('beyin', 15),
              t('ekip.beyinleKur', { x: s.beyin.ad })
            ),
            h('button', { type: 'button', class: 'dugme', onclick: () => katKurAc() }, ikon('arti', 14), t('kat.kur'))
          )
        ),
        perde,
        cekmece
      );
      return;
    }
    const kat = s.projeler.find((p) => p.id === s.katId);
    const kullanilan = new Set(s.ajanlar.map((a) => a.ad));
    doldur(
      kok,
      h(
        'header',
        { class: 'sayfaBas' },
        h('div', null, h('h1', null, t('ekip.baslikKat', { x: kat ? kat.ad : '' })), h('p', null, t(kat && kat.tur === 'kisisel' ? 'ekip.aciklamaKisisel' : 'ekip.aciklamaKat', { x: s.beyin.ad }))),
        h(
          'div',
          { class: 'satirDugme' },
          s.projeler.length > 1 ? katSecici() : null,
          kat && kat.tur === 'kisisel'
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'dugme',
                  onclick: () => {
                    gorunumSec('kat');
                    if (git) git('ofis');
                  },
                },
                ikon('ofis', 15),
                t('oda.ekleBaslik')
              )
            : null,
          h('button', { type: 'button', class: 'dugme ana', onclick: () => ac({ yeni: true }) }, ikon('arti', 15), t('ekip.yeni'))
        )
      ),
      h(
        'div',
        { class: 'kisiIzgara' },
        kat && kat.tur === 'kisisel'
          ? h('div', { class: 'kisiKart beyinKart' }, h('span', { class: 'beyinSimge' }, ikon('beyin', 30)), h('div', { class: 'kisiBilgi' }, h('div', { class: 'kisiAd' }, s.beyin.ad, h('span', { class: 'rozet' }, t('ekip.sefRozet'))), h('div', { class: 'kisiUnvan' }, t('ekip.kisiselSef'))))
          : kart(s.sef, { sef: true }),
        s.ajanlar.map((a) => kart(a)),
        h('button', { type: 'button', class: 'kisiKart bosKutu', onclick: () => ac({ yeni: true }) }, h('span', { class: 'artiDaire' }, ikon('arti', 22)), h('span', { class: 'bosKutuYazi' }, h('b', null, t('ekip.ekleBaslik')), h('span', null, t('ekip.ekleAciklama'))))
      ),
      h('h2', { class: 'araBaslik' }, t('ekip.sablonlar')),
      h('p', { class: 'araAciklama' }, t('ekip.sablonAciklama')),
      h(
        'div',
        { class: 'sablonIzgara' },
        depo.sablonlar.map((sb) => {
          const d = sb[s.dil] || sb.tr;
          const var_ = kullanilan.has(d.ad);
          return h(
            'button',
            {
              type: 'button',
              class: 'sablonKart',
              disabled: var_,
              onclick: async () => {
                const r = await api.ajanSablon(sb.id);
                if (r.hata) bildir(hataMetni(r), true);
                else bildir(t('ekip.eklendi', { x: r.ajan.ad }));
              },
            },
            portre({ renk: sb.renk, gorunus: sb.gorunus }, 44, 52, 1.5),
            h('div', null, h('b', null, d.ad), h('span', null, d.unvan)),
            h('span', { class: 'sablonEkle' }, var_ ? ikon('tik', 15) : ikon('arti', 15))
          );
        })
      ),
      perde,
      cekmece
    );
  }

  // ---------- düzenleyici ----------
  function kapat() {
    acik = null;
    cekmece.hidden = true;
    perde.hidden = true;
  }

  function secenekler(deger, liste, degisti, cizici) {
    const kap = h('div', { class: 'secenekler' });
    const ciz_ = (secili) =>
      doldur(
        kap,
        liste.map((x) =>
          h(
            'button',
            {
              type: 'button',
              class: 'secenek' + (x === secili ? ' secili' : ''),
              onclick: () => {
                degisti(x);
                ciz_(x);
              },
            },
            cizici(x)
          )
        )
      );
    ciz_(deger);
    return kap;
  }
  const renkNokta = (x) => h('span', { class: 'renkNokta', renk: x });

  function ac(kayit) {
    const t = depo.t;
    const s = depo.sirket;
    const sef = !!kayit.sef;
    const yeni = !!kayit.yeni;
    const taslak = yeni
      ? { ad: '', unvan: '', alanlar: [], cagri: '', talimat: '', kurallar: [], skiller: [], model: '', codexModel: '', hafiza: true, renk: RENKLER[(s.ajanlar.length + 1) % RENKLER.length], gorunus: gorunusUret('yeni' + Date.now()), esya: ESYALAR[s.ajanlar.length % ESYALAR.length], masa: Number.isInteger(kayit.masa) ? kayit.masa : undefined }
      : JSON.parse(JSON.stringify(kayit));
    acik = taslak;

    const onizleme = portre(taslak, 96, 112, 3.1);
    const baslik = h('h2', null, yeni ? t('duz.yeniBaslik') : taslak.ad);
    const yenile = () => {
      onizleme.yenile(taslak);
      if (!yeni) baslik.textContent = taslak.ad || '';
    };

    const adGiris = h('input', { type: 'text', value: taslak.ad, maxlength: '60', placeholder: t('duz.adOrnek'), oninput: () => ((taslak.ad = adGiris.value), yenile()) });
    const unvanGiris = h('input', { type: 'text', value: taslak.unvan, maxlength: '80', placeholder: t('duz.unvanOrnek'), oninput: () => (taslak.unvan = unvanGiris.value) });
    const alanGiris = cipGirisi(taslak.alanlar || [], (v) => (taslak.alanlar = v), t('duz.alanOrnek'));
    const cagriGiris = h('textarea', { rows: '2', value: taslak.cagri || '', placeholder: t('duz.cagriOrnek'), oninput: () => (taslak.cagri = cagriGiris.value) });
    const talimatGiris = h('textarea', { rows: '10', class: 'mono', value: taslak.talimat || '', placeholder: t('duz.talimatOrnek'), oninput: () => (taslak.talimat = talimatGiris.value) });
    const kuralDuz = listeDuzenleyici(taslak.kurallar || [], (v) => (taslak.kurallar = v), t('duz.kuralEkle'));

    // şefe yazdır
    const tarif = h('textarea', { rows: '2', placeholder: t('duz.tarifOrnek') });
    const yazDugme = h('button', { type: 'button', class: 'dugme' }, ikon('sihir', 15), t('duz.yazdir'));
    yazDugme.addEventListener('click', async () => {
      if (!tarif.value.trim()) return tarif.focus();
      yazDugme.disabled = true;
      yazDugme.lastChild.textContent = t('duz.yaziyor', { x: s.sef.ad });
      const r = await api.taslakAjan(tarif.value);
      yazDugme.disabled = false;
      yazDugme.lastChild.textContent = t('duz.yazdir');
      if (!r || r.hata) return bildir(hataMetni(r), true);
      Object.assign(taslak, r.sonuc);
      adGiris.value = taslak.ad;
      unvanGiris.value = taslak.unvan;
      alanGiris.ayarla(taslak.alanlar);
      cagriGiris.value = taslak.cagri;
      talimatGiris.value = taslak.talimat;
      kuralDuz.ayarla(taslak.kurallar);
      yenile();
    });

    // eğitim: geri bildirimi kurala çevir
    const geri = h('textarea', { rows: '2', placeholder: t('egit.ornek') });
    const oneriler = h('div', { class: 'oneriler' });
    const egitDugme = h('button', { type: 'button', class: 'dugme' }, ikon('sihir', 15), t('egit.cevir'));
    egitDugme.addEventListener('click', async () => {
      if (!geri.value.trim()) return geri.focus();
      egitDugme.disabled = true;
      egitDugme.lastChild.textContent = t('duz.yaziyor', { x: s.sef.ad });
      const r = await api.taslakEgitim({ id: taslak.id, geriBildirim: geri.value });
      egitDugme.disabled = false;
      egitDugme.lastChild.textContent = t('egit.cevir');
      if (!r || r.hata) return bildir(hataMetni(r), true);
      doldur(
        oneriler,
        r.sonuc.kurallar.map((k) => {
          const satir = h('div', { class: 'oneri' }, h('span', null, k));
          satir.append(
            h(
              'button',
              {
                type: 'button',
                class: 'dugme kucuk',
                onclick: () => {
                  taslak.kurallar = [...(taslak.kurallar || []), k];
                  kuralDuz.ayarla(taslak.kurallar);
                  satir.remove();
                },
              },
              t('genel.ekle')
            )
          );
          return satir;
        })
      );
    });

    const skillSecim = depo.skiller.filter((x) => x.etkin);
    const gorunus = taslak.gorunus;
    const g = (anahtar_) => (v) => {
      gorunus[anahtar_] = v;
      yenile();
    };

    const silKap = h('div', { class: 'silKap' });
    const silCiz = (sor) =>
      doldur(
        silKap,
        sor
          ? [
              h('span', null, t('duz.silEmin', { x: taslak.ad })),
              h(
                'button',
                {
                  type: 'button',
                  class: 'dugme tehlike',
                  onclick: async () => {
                    await api.ajanSil(taslak.id);
                    kapat();
                  },
                },
                t('duz.silEvet')
              ),
              h('button', { type: 'button', class: 'dugme', onclick: () => silCiz(false) }, t('genel.vazgec')),
            ]
          : h('button', { type: 'button', class: 'dugme hayalet tehlike', onclick: () => silCiz(true) }, ikon('cop', 15), t('duz.sil'))
      );
    if (!sef && !yeni) silCiz(false);

    const kaydet = async () => {
      if (!taslak.ad.trim()) {
        adGiris.focus();
        return bildir(t('duz.adGerekli'), true);
      }
      if (sef) {
        const { ad, unvan, alanlar, talimat, renk, gorunus: gr, model, codexModel } = taslak;
        await api.sirketGuncelle({ sef: { ad, unvan, alanlar, talimat, renk, gorunus: gr, model, codexModel } });
      } else {
        const r = await api.ajanKaydet(taslak);
        if (!r || r.hata) return bildir(hataMetni(r), true);
      }
      bildir(t(depo.oturum.acik ? 'duz.kaydedildiOturum' : 'duz.kaydedildi', { x: taslak.ad }));
      kapat();
    };

    doldur(
      cekmece,
      h('header', { class: 'cekmeceBas' }, onizleme, h('div', null, baslik, h('p', null, sef ? t('duz.sefAciklama') : yeni ? t('duz.yeniAciklama') : t('duz.duzenAciklama'))), h('button', { type: 'button', class: 'simge', onclick: kapat, 'aria-label': t('genel.kapat') }, ikon('kapat', 18))),
      h(
        'div',
        { class: 'cekmeceGovde' },
        yeni ? h('section', { class: 'yazdirKutu' }, h('h3', null, ikon('sihir', 16), t('duz.yazdirBaslik', { x: s.sef.ad })), h('p', null, t('duz.yazdirAciklama')), tarif, yazDugme) : null,
        h(
          'section',
          { class: 'formBolum' },
          h('div', { class: 'ikili' }, alan(t('duz.ad'), adGiris), alan(t('duz.unvan'), unvanGiris)),
          alan(t('duz.alanlar'), alanGiris, t('duz.alanIpucu')),
          sef ? null : alan(t('duz.cagri'), cagriGiris, t('duz.cagriIpucu')),
          alan(t('duz.talimat'), talimatGiris, t(sef ? 'duz.talimatSefIpucu' : 'duz.talimatIpucu')),
          sef ? null : h('div', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('duz.kurallar')), kuralDuz, h('span', { class: 'alanIpucu' }, t('duz.kuralIpucu')))
        ),
        !sef && !yeni
          ? h('section', { class: 'formBolum yazdirKutu' }, h('h3', null, ikon('sihir', 16), t('egit.baslik', { x: taslak.ad })), h('p', null, t('egit.aciklama')), geri, egitDugme, oneriler)
          : null,
        sef || !skillSecim.length
          ? null
          : h(
              'section',
              { class: 'formBolum' },
              h('h3', null, t('duz.skiller')),
              h('p', { class: 'alanIpucu' }, t('duz.skillIpucu')),
              h(
                'div',
                { class: 'cipler secmeli' },
                skillSecim.map((sk) => {
                  const b = h('button', { type: 'button', class: 'cip' + ((taslak.skiller || []).includes(sk.id) ? ' secili' : ''), title: sk.aciklama }, sk.id);
                  b.addEventListener('click', () => {
                    const kume = new Set(taslak.skiller || []);
                    if (kume.has(sk.id)) kume.delete(sk.id);
                    else kume.add(sk.id);
                    taslak.skiller = [...kume];
                    b.classList.toggle('secili', kume.has(sk.id));
                  });
                  return b;
                })
              )
            ),
        h(
          'section',
          { class: 'formBolum' },
          h('h3', null, t('duz.gorunus')),
          h('div', { class: 'gorunusSatir' }, h('span', null, t('duz.renk')), secenekler(taslak.renk, RENKLER, (v) => ((taslak.renk = v), yenile()), renkNokta)),
          h('div', { class: 'gorunusSatir' }, h('span', null, t('duz.ten')), secenekler(gorunus.ten, TENLER, g('ten'), renkNokta)),
          h('div', { class: 'gorunusSatir' }, h('span', null, t('duz.sac')), secenekler(gorunus.sac, SACLAR, g('sac'), renkNokta)),
          h('div', { class: 'gorunusSatir' }, h('span', null, t('duz.stil')), secenekler(gorunus.stil, STILLER, g('stil'), (x) => t('stil.' + x))),
          h('div', { class: 'gorunusSatir' }, h('span', null, t('duz.ek')), secenekler(gorunus.ek, EKLER, g('ek'), (x) => t('ek.' + (x || 'yok')))),
          h('div', { class: 'gorunusSatir' }, h('span', null, t('duz.sakal')), anahtar(gorunus.sakal, g('sakal'))),
          sef ? null : h('div', { class: 'gorunusSatir' }, h('span', null, t('duz.esya')), secenekler(taslak.esya, ESYALAR, (v) => (taslak.esya = v), (x) => t('esya.' + x)))
        ),
        h(
          'section',
          { class: 'formBolum' },
          h('h3', null, t('duz.gelismis')),
          alan(
            t('duz.modelClaude'),
            (() => {
              const sec = h('select', { onchange: () => (taslak.model = sec.value) }, ['', 'opus', 'sonnet', 'haiku', 'fable'].map((m) => h('option', { value: m }, m ? t('model.' + m) : t('duz.modelVarsayilan'))));
              sec.value = taslak.model || '';
              return sec;
            })(),
            t('duz.modelIpucu')
          ),
          alan(
            t('duz.modelCodex'),
            (() => {
              const liste = (depo.bilgi.motorlar || {}).codexModeller || [];
              const secenekler = [['', t('duz.modelVarsayilan')], ...liste.map((m) => [m.slug, m.ad])];
              if (taslak.codexModel && !liste.some((m) => m.slug === taslak.codexModel)) secenekler.push([taslak.codexModel, taslak.codexModel]);
              const sec = h('select', { onchange: () => (taslak.codexModel = sec.value) }, secenekler.map(([d, e]) => h('option', { value: d }, e)));
              sec.value = taslak.codexModel || '';
              return sec;
            })(),
            t('duz.modelIpucu')
          ),
          sef ? null : h('div', { class: 'alan yatay' }, anahtar(taslak.hafiza !== false, (v) => (taslak.hafiza = v), t('duz.hafiza')), h('span', { class: 'alanIpucu' }, t('duz.hafizaIpucu')))
        )
      ),
      h('footer', { class: 'cekmeceAlt' }, silKap, h('div', { class: 'bosluk' }), h('button', { type: 'button', class: 'dugme', onclick: kapat }, t('genel.vazgec')), h('button', { type: 'button', class: 'dugme ana', onclick: kaydet }, t('genel.kaydet')))
    );
    cekmece.hidden = false;
    perde.hidden = false;
    cekmece.scrollTop = 0;
    requestAnimationFrame(() => (yeni ? tarif : adGiris).focus());
  }

  dinle('sirket', () => {
    if (!acik) ciz();
  });
  dinle('canli', () => {
    for (const [rolId, el] of haplar) hapYaz(el, rolId);
  });
  dinle('skiller', () => !acik && ciz());
  ciz();

  return {
    kok,
    goster(arg) {
      ciz();
      if (arg && arg.yeni) ac({ yeni: true, masa: arg.masa });
      else if (arg && arg.id) {
        const a = depo.sirket.ajanlar.find((x) => x.id === arg.id);
        if (a) ac({ ...a });
      }
    },
    gizle() {
      kapat();
    },
  };
}
