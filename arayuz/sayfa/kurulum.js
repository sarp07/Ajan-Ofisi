// İlk açılış: önce beyin kurulur. Motor, beynin sesi, beynin adı, izinler.
// Başta ekip gelmez: ekipler projeye özeldir, katları beyin kurar. Her adım sonradan Ayarlar'dan değişir.
import { h, doldur, ikon, alan, kopyala } from '../dom.js';
import { depo, api, bildir, hataMetni, dinle, gorunumSec } from '../depo.js';
import { konus, sistemSesleri } from '../ses.js';
import { odaSecici } from '../odaSecici.js';

const SES_TURLERI = ['yok', 'sistem', 'elevenlabs', 'openai'];

export function kurulum({ bitti }) {
  const kok = h('div', { class: 'kurulum' });
  let adim = 0;
  const ADIMLAR = 5;
  const odaSecim = new Set();
  // ses adımının yerel durumu (kaydetmeden önce denenebilsin)
  const ses = { tur: null, ses: '', liste: [], yukleniyor: false, anahtar: '', hata: '' };

  const ileri = () => {
    adim++;
    ciz();
  };
  const geri = () => {
    adim = Math.max(0, adim - 1);
    ciz();
  };

  async function bitir(beyneGec = true) {
    await api.sirketGuncelle({ kurulumBitti: true, beyin: { kuruldu: true } });
    kok.remove();
    bitti();
    if (beyneGec) gorunumSec('beyin');
  }

  function adimlar() {
    const adlar = ['kur.adim0', 'kur.adim1', 'kur.adim2', 'kur.adim3x', 'kur.adim3'];
    return h('ol', { class: 'adimlar' }, adlar.map((k, i) => h('li', { class: i === adim ? 'simdi' : i < adim ? 'gecti' : '' }, depo.t(k))));
  }

  const alt = (sol, sag) => h('div', { class: 'kurAlt' }, sol || h('span'), sag);
  const geriDugme = () => h('button', { type: 'button', class: 'dugme hayalet', onclick: geri }, t_('genel.geri'));
  const t_ = (k, a) => depo.t(k, a);

  // Motorlar aranırken iki kartın iskeleti ve kayan ışık
  function motorAraniyor(t) {
    const iskelet = (ad) => h('div', { class: 'motorKart iskelet' }, h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('motor.araniyorAdli', { x: ad })), h('span', { class: 'iskeletCizgi' }), h('span', { class: 'iskeletCizgi kisa' }));
    return [h('div', { class: 'motorIzgara' }, iskelet(t('motor.arac.claude')), iskelet(t('motor.arac.codex')), iskelet(t('motor.arac.kimi')), iskelet(t('motor.arac.gemini'))), h('p', { class: 'ipucu' }, t('kur.motorAraniyor'))];
  }

  // ---------- 1. motor ----------
  function adimMotor() {
    const t = depo.t;
    const s = depo.sirket;
    const mb = depo.bilgi.motorlar || null;
    const komutSatiri = (komut) => {
      const kopyaDugme = h('button', { type: 'button', onclick: async () => (kopyaDugme.textContent = (await kopyala(komut)) ? t('genel.kopyalandi') : t('genel.kopyala')) }, t('genel.kopyala'));
      return h('div', { class: 'komut' }, h('code', null, komut), kopyaDugme);
    };
    const kart = (motor) => {
      const arac = mb && mb[motor];
      if (!arac) return h('div', { class: 'motorKart' }, h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('motor.yok', { x: t('motor.arac.' + motor) })), h('p', { class: 'ipucu' }, t('motor.yokAciklama.' + motor)), komutSatiri((mb.kurulum || {})[motor] || ''));
      const g = arac.giris || {};
      return h(
        'div',
        { class: 'motorKart' },
        h('p', { class: 'durumSatir iyi' }, ikon('tik', 16), t('motor.var', { x: t('motor.arac.' + motor), s: arac.surum })),
        g.girisli
          ? h('p', { class: 'durumSatir iyi' }, ikon('tik', 16), g.hesap ? t('motor.girisli', { x: g.hesap }) : t('motor.girisliHesapsiz'))
          : h(
              'div',
              { class: 'satirDugme' },
              h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('motor.girissiz')),
              h(
                'button',
                {
                  type: 'button',
                  class: 'dugme ana',
                  onclick: async () => {
                    // giriş ekranı terminalde açılır: kurulum kapanır, kalan adımlar Ayarlar'da
                    await api.sirketGuncelle({ motor, giris: { ...s.giris, [motor]: 'abonelik' } });
                    const r = await api.motorGiris({ motor, sutun: 100, satir: 30 });
                    if (!r || r.hata) return bildir(hataMetni(r), true);
                    bildir(t('motor.girisAcildi'));
                    await bitir(false);
                  },
                },
                t('kur.girisYap')
              )
            )
      );
    };
    const dilSec = h(
      'div',
      { class: 'bolmeli' },
      ['tr', 'en'].map((d) => h('button', { type: 'button', class: s.dil === d ? 'secili' : '', onclick: async () => s.dil !== d && (await api.dilDegistir(d), ciz()) }, d === 'tr' ? 'Türkçe' : 'English'))
    );
    const secim = h(
      'div',
      { class: 'bolmeli' },
      [
        ['otomatik', t('motor.otomatik')],
        ['claude', t('motor.claude')],
        ['codex', t('motor.codex')],
        ['kimi', t('motor.kimi')],
        ['gemini', t('motor.gemini')],
      ].map(([d, e]) => h('button', { type: 'button', class: s.motor === d ? 'secili' : '', onclick: async () => (await api.sirketGuncelle({ motor: d }), ciz()) }, e))
    );
    return [
      h('h1', null, t('kur.hosgeldin')),
      h('p', { class: 'kurAciklama' }, t('kur.hosAciklama')),
      h('div', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('ayar.dil')), dilSec, h('span', { class: 'alanIpucu' }, t('ayar.dilIpucu'))),
      !mb
        ? motorAraniyor(t)
        : [
            h('div', { class: 'motorIzgara' }, kart('claude'), kart('codex'), kart('kimi'), kart('gemini')),
            h('div', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('motor.secim')), secim, h('span', { class: 'alanIpucu' }, t('motor.secimIpucu'))),
            h(
              'div',
              { class: 'satirDugme' },
              h(
                'button',
                {
                  type: 'button',
                  class: 'dugme',
                  onclick: async (e) => {
                    const d = e.currentTarget;
                    d.disabled = true;
                    d.replaceChildren(h('span', { class: 'donen' }), t('motor.taraniyor'));
                    await api.claudeYenile();
                    ciz();
                  },
                },
                ikon('yenile', 14),
                t('motor.yenidenTara')
              )
            ),
          ],
      alt(null, h('button', { type: 'button', class: 'dugme ana buyuk', disabled: !mb || !mb.secilen, onclick: ileri }, t('genel.devam'))),
    ];
  }

  // ---------- 2. beynin sesi ----------
  async function sesListesiYukle() {
    ses.liste = [];
    ses.hata = '';
    if (ses.tur === 'yok') return ciz();
    ses.yukleniyor = true;
    ciz();
    if (ses.tur === 'sistem') ses.liste = await sistemSesleri();
    else {
      const anahtarVar = ((depo.bilgi.motorlar || {}).anahtarVar || {})[ses.tur === 'elevenlabs' ? 'elevenlabs' : 'codex'];
      if (anahtarVar) {
        const r = await api.sesListe(ses.tur);
        if (r && r.tamam) ses.liste = r.liste;
        else ses.hata = hataMetni(r);
      }
    }
    if (!ses.liste.some((v) => v.id === ses.ses)) ses.ses = ses.liste.length ? ses.liste[0].id : '';
    ses.yukleniyor = false;
    ciz();
  }

  function adimSes() {
    const t = depo.t;
    const mb = depo.bilgi.motorlar || {};
    if (ses.tur === null) {
      ses.tur = depo.sirket.beyin.ses.tur;
      ses.ses = depo.sirket.beyin.ses.ses;
      // çizim bitmeden yeniden çizim başlamasın
      if (ses.tur !== 'yok') queueMicrotask(sesListesiYukle);
    }
    const anahtarAdi = ses.tur === 'elevenlabs' ? 'elevenlabs' : 'codex';
    const anahtarVar = !!(mb.anahtarVar || {})[anahtarAdi];
    const secenek = (tur) =>
      h(
        'button',
        {
          type: 'button',
          role: 'radio',
          'aria-checked': ses.tur === tur ? 'true' : 'false',
          class: 'sesSecenek' + (ses.tur === tur ? ' secili' : ''),
          onclick: () => {
            if (ses.tur === tur) return;
            ses.tur = tur;
            ses.ses = '';
            sesListesiYukle();
          },
        },
        h('b', null, t('ses.' + tur)),
        h('span', null, t('ses.' + tur + 'Aciklama'))
      );
    const parcalar = [];
    if ((ses.tur === 'elevenlabs' || ses.tur === 'openai') && !anahtarVar) {
      const giris = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: ses.tur === 'elevenlabs' ? 'sk_…' : 'sk-…', value: ses.anahtar, oninput: () => (ses.anahtar = giris.value) });
      parcalar.push(
        alan(t(ses.tur === 'elevenlabs' ? 'ses.anahtarEleven' : 'ses.anahtarOpenai'), giris, t(ses.tur === 'elevenlabs' ? 'ses.anahtarElevenIpucu' : 'motor.anahtarIpucu.codex')),
        h(
          'div',
          { class: 'satirDugme' },
          h(
            'button',
            {
              type: 'button',
              class: 'dugme ana',
              disabled: !mb.sifreliDepo,
              onclick: async () => {
                if (!giris.value.trim()) return;
                const r = await api.motorAnahtar({ motor: anahtarAdi, deger: giris.value.trim() });
                if (!r || r.hata) return bildir(hataMetni(r), true);
                ses.anahtar = '';
                depo.bilgi = { ...depo.bilgi, motorlar: r.motorlar };
                sesListesiYukle();
              },
            },
            t('genel.kaydet')
          )
        ),
        !mb.sifreliDepo ? h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('motor.depoYok')) : null
      );
    } else if (ses.tur !== 'yok') {
      if (ses.yukleniyor) parcalar.push(h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('ses.yukleniyor')));
      else if (ses.hata) parcalar.push(h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), ses.hata));
      else if (!ses.liste.length) parcalar.push(h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('ses.listeBos')));
      else {
        const sec = h('select', { onchange: () => (ses.ses = sec.value) }, ses.liste.map((v) => h('option', { value: v.id }, v.ad)));
        sec.value = ses.ses;
        parcalar.push(
          alan(t('ses.secim'), sec),
          h(
            'div',
            { class: 'satirDugme' },
            h(
              'button',
              {
                type: 'button',
                class: 'dugme',
                onclick: async () => {
                  const r = await konus(t('ses.ornek', { x: depo.sirket.beyin.ad }), { tur: ses.tur, ses: ses.ses });
                  if (r && r.hata) bildir(hataMetni(r), true);
                },
              },
              ikon('ses', 15),
              t('ses.dinle')
            )
          )
        );
      }
    }
    const hazir = ses.tur === 'yok' || (!!ses.ses && !ses.yukleniyor);
    return [
      h('h1', null, t('kur.sesBaslik')),
      h('p', { class: 'kurAciklama' }, t('kur.sesAciklama')),
      h('div', { class: 'sesSecenekler', role: 'radiogroup' }, SES_TURLERI.map(secenek)),
      parcalar,
      alt(
        geriDugme(),
        h(
          'button',
          {
            type: 'button',
            class: 'dugme ana buyuk',
            disabled: !hazir,
            onclick: async () => {
              await api.sirketGuncelle({ beyin: { ses: { tur: ses.tur, ses: ses.tur === 'yok' ? '' : ses.ses } } });
              ileri();
            },
          },
          t('genel.devam')
        )
      ),
    ];
  }

  // ---------- 3. beynin adı ----------
  function adimBeyin() {
    const t = depo.t;
    const s = depo.sirket;
    const ad = h('input', { type: 'text', value: s.beyin.ad, maxlength: '40' });
    const sahip = h('input', { type: 'text', value: s.beyin.sahip, placeholder: t('kur.sahipOrnek'), maxlength: '40' });
    const ofis = h('input', { type: 'text', value: s.ad === 'Şirketim' || s.ad === 'My Company' ? '' : s.ad, placeholder: t('kur.ofisOrnek'), maxlength: '60' });
    const onizle = h('p', { class: 'beyinOnizle' });
    const yenile = () => doldur(onizle, ikon('beyin', 18), h('span', null, t('kur.beyinMerhaba', { x: ad.value.trim() || s.beyin.ad, y: sahip.value.trim() ? ' ' + sahip.value.trim() : '' })));
    ad.addEventListener('input', yenile);
    sahip.addEventListener('input', yenile);
    yenile();
    const kaydet = () => api.sirketGuncelle({ ad: ofis.value.trim() || s.ad, beyin: { ad: ad.value.trim() || s.beyin.ad, sahip: sahip.value.trim() } });
    return [
      h('h1', null, t('kur.beyinBaslik')),
      h('p', { class: 'kurAciklama' }, t('kur.beyinAciklama')),
      onizle,
      h('div', { class: 'formIki' }, alan(t('kur.beyinAdi'), ad, t('kur.beyinAdiIpucu')), alan(t('kur.sahip'), sahip, t('kur.sahipIpucu'))),
      alan(t('kur.ofisAdi'), ofis, t('kur.ofisIpucu')),
      s.beyin.ses.tur !== 'yok'
        ? h(
            'div',
            { class: 'satirDugme' },
            h(
              'button',
              {
                type: 'button',
                class: 'dugme',
                onclick: async () => {
                  const r = await konus(onizle.textContent);
                  if (r && r.hata) bildir(hataMetni(r), true);
                },
              },
              ikon('ses', 15),
              t('ses.dinle')
            )
          )
        : null,
      alt(
        geriDugme(),
        h(
          'button',
          {
            type: 'button',
            class: 'dugme ana buyuk',
            onclick: async () => {
              await kaydet();
              ileri();
            },
          },
          t('genel.devam')
        )
      ),
    ];
  }

  // ---------- 4. kişisel kat odaları (isteğe bağlı) ----------
  function adimOda() {
    const t = depo.t;
    const devam = h('button', { type: 'button', class: 'dugme ana buyuk' }, odaSecim.size ? t('oda.kur', { x: odaSecim.size }) : t('genel.simdilikGec'));
    devam.addEventListener('click', async () => {
      if (odaSecim.size) {
        const r = await api.katKisisel();
        if (r && r.proje) await api.odaKur(r.proje.id, [...odaSecim]);
      }
      ileri();
    });
    return [
      h('h1', null, t('kur.odaBaslik')),
      h('p', { class: 'kurAciklama' }, t('kur.odaAciklama')),
      odaSecici({ secili: odaSecim, degisti: (x) => (devam.textContent = x.size ? t('oda.kur', { x: x.size }) : t('genel.simdilikGec')) }),
      alt(geriDugme(), devam),
    ];
  }

  // ---------- 5. izinler ----------
  let izinSonuc = null;
  function adimIzin() {
    const t = depo.t;
    const s = depo.sirket;
    const mac = depo.bilgi.platform === 'darwin';
    const izin = h('select', { onchange: () => api.sirketGuncelle({ izinModu: izin.value }) }, ['', 'acceptEdits', 'auto', 'plan', 'bypassPermissions'].map((m) => h('option', { value: m }, t('izin.' + (m || 'varsayilan')))));
    izin.value = s.izinModu || '';
    const sonucSatiri = () => {
      if (!izinSonuc) return null;
      const k = izinSonuc.klasorler || {};
      const adlar = Object.keys(k);
      const tamam = adlar.filter((a) => k[a]).length;
      return h('p', { class: 'durumSatir ' + (tamam === adlar.length ? 'iyi' : 'kotu') }, ikon(tamam === adlar.length ? 'tik' : 'ucgen', 16), adlar.length ? t('izin.sonuc', { x: tamam, y: adlar.length }) : t('izin.bildirimDenendi'));
    };
    return [
      h('h1', null, t('kur.izinBaslik')),
      h('p', { class: 'kurAciklama' }, t(mac ? 'kur.izinAciklamaMac' : 'kur.izinAciklamaDiger')),
      h(
        'div',
        { class: 'satirDugme' },
        h(
          'button',
          {
            type: 'button',
            class: 'dugme ana',
            onclick: async (e) => {
              e.currentTarget.disabled = true;
              izinSonuc = await api.izinIste();
              ciz();
            },
          },
          ikon('kalkan', 15),
          t(mac ? 'izin.ver' : 'izin.bildirimDene')
        ),
        mac ? h('button', { type: 'button', class: 'dugme', onclick: () => api.izinTamDisk() }, t('izin.tamDisk')) : null
      ),
      sonucSatiri(),
      mac ? h('p', { class: 'ipucu' }, t('izin.tamDiskIpucu')) : null,
      alan(t('ayar.izin'), izin, t('kur.onayIpucu')),
      alt(geriDugme(), h('button', { type: 'button', class: 'dugme ana buyuk', onclick: () => bitir(true) }, ikon('beyin', 15), t('kur.beyinleBasla', { x: s.beyin.ad }))),
    ];
  }

  function ciz() {
    doldur(kok, h('div', { class: 'kurKart' }, adimlar(), h('div', { class: 'kurGovde' }, [adimMotor, adimSes, adimBeyin, adimOda, adimIzin][adim]())));
  }

  // motorlar arka planda aranır: sonuç gelince motor adımı yenilenir
  dinle('bilgi', () => kok.isConnected && (adim === 0 || adim === 1) && ciz());
  dinle('sirket', () => kok.isConnected && adim === 0 && ciz());
  ciz();
  return kok;
}
