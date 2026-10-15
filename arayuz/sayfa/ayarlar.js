// Ayarlar sayfası: ofis adı, dil, çalışma biçimi, yapay zekâ motoru (Claude / OpenAI), giriş, model düzeni, veri klasörü.
import { h, doldur, ikon, alan, anahtar, kopyala } from '../dom.js';
import { depo, api, dinle, bildir, hataMetni } from '../depo.js';
import { konus, sistemSesleri } from '../ses.js';

const CLAUDE_MODELLER = { koordinator: ['opus', 'fable', 'sonnet'], calisan: ['sonnet', 'haiku', 'opus', 'fable'] };

export function ayarlarSayfasi({ git } = {}) {
  const kok = h('div', { class: 'sayfa ayarSayfa' });
  // yeni katların açılacağı klasör
  let projeKoku = '';
  api.katKoku().then((r) => {
    projeKoku = (r && r.yol) || '';
    ciz();
  });
  // motorlar yeniden taranırken kartlar "aranıyor" gösterir
  let taraniyor = false;
  // yazılmakta olan anahtar yeniden çizimde kaybolmasın
  const anahtarTaslak = { claude: '', codex: '', kimi: '', gemini: '', elevenlabs: '' };
  // beynin ses listesi: türe göre bir kez yüklenir
  const sesler = { tur: null, liste: [], hata: '' };
  async function sesleriYukle(tur) {
    sesler.tur = tur;
    sesler.liste = [];
    sesler.hata = '';
    if (tur === 'sistem') sesler.liste = await sistemSesleri();
    else if (tur === 'elevenlabs' || tur === 'openai') {
      const r = await api.sesListe(tur);
      if (r && r.tamam) sesler.liste = r.liste;
      else sesler.hata = hataMetni(r);
    }
    ciz();
  }

  // WhatsApp bağlantısı: durum ana süreçten gelir, QR görünürken telefondan okutulur
  let wpDurum = { baglanti: 'kapali' };
  api.whatsappDurum().then((d) => ((wpDurum = d || wpDurum), ciz()));
  api.whatsappDinle((d) => {
    wpDurum = d;
    if (kok.isConnected) ciz();
  });

  // Telegram botu: belirteç şifreli saklanır; sahip bota bir kez bağlantı adresiyle yazınca bağlanır
  let tgDurum = null;
  let tgTaslak = '';
  const tgYenile = () => api.telegramDurum().then((d) => ((tgDurum = d), kok.isConnected && ciz()));
  tgYenile();
  api.telegramDinle(() => tgYenile());

  function telegramBolumu() {
    const t = depo.t;
    const d = tgDurum && tgDurum.beyin;
    if (!d) return null;
    const giris = h('input', { type: 'password', value: tgTaslak, placeholder: '123456789:AA…', autocomplete: 'off', oninput: () => (tgTaslak = giris.value) });
    const kaydet = async () => {
      const r = await api.telegramToken('beyin', tgTaslak);
      if (r && r.hata) return bildir(r.ayrinti || hataMetni(r), true);
      tgTaslak = '';
      tgYenile();
    };
    const link = d.kullanici && d.kod ? `https://t.me/${d.kullanici}?start=${d.kod}` : '';
    const durum =
      d.baglanti === 'bagli'
        ? h('p', { class: 'durumSatir iyi' }, h('span', { class: 'katNokta' }), t('tg.bagli', { x: '@' + d.kullanici }))
        : d.baglanti === 'baglaniyor'
          ? h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('wp.baglaniyor'))
          : d.baglanti === 'hata'
            ? h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 15), d.hata || t('tg.hata'))
            : null;
    return h(
      'div',
      { class: 'alan wpBaglanti' },
      h('span', { class: 'alanEtiket' }, t('tg.baslik')),
      d.kayitli
        ? [
            durum,
            d.baglanti === 'bagli'
              ? d.sahipBagli
                ? h('p', { class: 'ipucu' }, t('tg.sahipBagli', { x: d.sahipAd || '' }))
                : h('div', { class: 'tgBag' }, h('p', { class: 'ipucu' }, t('tg.sahipBagla')), h('code', { class: 'yol' }, link), h('div', { class: 'satirDugme' }, h('button', { type: 'button', class: 'dugme kucuk ana', onclick: () => window.open(link) }, ikon('disari', 13), t('tg.ac')), h('button', { type: 'button', class: 'dugme kucuk', onclick: async () => bildir((await kopyala(link)) ? t('genel.kopyalandi') : t('genel.kopyala')) }, ikon('kopya', 13), t('genel.kopyala'))))
              : null,
            h(
              'div',
              { class: 'satirDugme' },
              d.sahipBagli ? h('button', { type: 'button', class: 'dugme kucuk', onclick: () => api.telegramSahipSifirla().then(tgYenile) }, ikon('yenile', 13), t('tg.sahipSifirla')) : null,
              h('button', { type: 'button', class: 'dugme kucuk', onclick: () => api.telegramToken('beyin', '').then(tgYenile) }, ikon('cop', 13), t('tg.kaldir'))
            ),
          ]
        : [h('p', { class: 'ipucu' }, t('tg.aciklama')), h('div', { class: 'satirGiris' }, giris, h('button', { type: 'button', class: 'dugme ana', onclick: kaydet }, t('tg.kaydet')))]
    );
  }

  function whatsappBolumu() {
    const t = depo.t;
    const d = wpDurum;
    const durum =
      d.baglanti === 'bagli'
        ? h('p', { class: 'durumSatir iyi' }, h('span', { class: 'katNokta' }), t('wp.bagli', { x: d.numara ? '+' + d.numara : '' }))
        : d.baglanti === 'baglaniyor'
          ? h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('wp.baglaniyor'))
          : d.baglanti === 'qr'
            ? null
            : h('p', { class: 'ipucu' }, d.hata === 'cikisYapildi' ? t('wp.cikisYapildi') : d.hata === 'qrSuresi' ? t('wp.qrSuresi') : t('wp.aciklama'));
    return h(
      'div',
      { class: 'alan wpBaglanti' },
      h('span', { class: 'alanEtiket' }, t('wp.baslik')),
      durum,
      d.baglanti === 'qr' && d.qr ? h('div', { class: 'wpQr' }, h('img', { src: d.qr, alt: t('wp.qrAlt'), width: '220', height: '220' }), h('ol', { class: 'wpAdim' }, h('li', null, t('wp.adim1')), h('li', null, t('wp.adim2')), h('li', null, t('wp.adim3')))) : null,
      h(
        'div',
        { class: 'satirDugme' },
        d.baglanti === 'kapali'
          ? h('button', { type: 'button', class: 'dugme ana', onclick: async () => { const r = await api.whatsappBagla(); if (r && r.hata) bildir(hataMetni(r), true); } }, ikon('telefon', 14), t('wp.bagla'))
          : h('button', { type: 'button', class: 'dugme', onclick: () => api.whatsappCikis() }, ikon('cop', 14), d.baglanti === 'bagli' ? t('wp.cikis') : t('genel.vazgec'))
      )
    );
  }

  function beyinPaneli() {
    const t = depo.t;
    const b = depo.sirket.beyin;
    const mb = depo.bilgi.motorlar || {};
    const ad = h('input', { type: 'text', value: b.ad, maxlength: '40' });
    ad.addEventListener('change', () => ad.value.trim() && api.sirketGuncelle({ beyin: { ad: ad.value.trim() } }));
    const sahip = h('input', { type: 'text', value: b.sahip, maxlength: '40', placeholder: t('kur.sahipOrnek') });
    sahip.addEventListener('change', () => api.sirketGuncelle({ beyin: { sahip: sahip.value.trim() } }));
    const wp = h('input', { type: 'text', value: b.whatsapp || '', maxlength: '60', placeholder: '+90 5xx xxx xx xx' });
    wp.addEventListener('change', () => api.sirketGuncelle({ beyin: { whatsapp: wp.value.trim() } }));
    const tur = b.ses.tur;
    if (tur !== 'yok' && sesler.tur !== tur) queueMicrotask(() => sesleriYukle(tur));
    const anahtarAdi = tur === 'elevenlabs' ? 'elevenlabs' : 'codex';
    const anahtarVar = !!(mb.anahtarVar || {})[anahtarAdi];
    const parca = [];
    if ((tur === 'elevenlabs' || tur === 'openai') && !anahtarVar) {
      const giris = h('input', { type: 'password', autocomplete: 'off', value: anahtarTaslak[anahtarAdi], oninput: () => (anahtarTaslak[anahtarAdi] = giris.value) });
      parca.push(
        alan(t(tur === 'elevenlabs' ? 'ses.anahtarEleven' : 'ses.anahtarOpenai'), giris, t(tur === 'elevenlabs' ? 'ses.anahtarElevenIpucu' : 'motor.anahtarIpucu.codex')),
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
                anahtarTaslak[anahtarAdi] = '';
                sesler.tur = null;
              },
            },
            t('genel.kaydet')
          )
        )
      );
    } else if (tur !== 'yok') {
      if (sesler.hata) parca.push(h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), sesler.hata));
      const sec = h(
        'select',
        { onchange: () => api.sirketGuncelle({ beyin: { ses: { tur, ses: sec.value } } }) },
        [!b.ses.ses ? h('option', { value: '' }, t('ses.secim')) : null, ...sesler.liste.map((v) => h('option', { value: v.id }, v.ad))]
      );
      sec.value = b.ses.ses;
      parca.push(
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
                const r = await konus(t('ses.ornek', { x: b.ad }));
                if (r && r.hata) bildir(hataMetni(r), true);
              },
            },
            ikon('ses', 15),
            t('ses.dinle')
          ),
          tur === 'elevenlabs' ? h('button', { type: 'button', class: 'dugme', onclick: () => api.motorAnahtar({ motor: 'elevenlabs', deger: '' }).then(() => (sesler.tur = null)) }, ikon('cop', 14), t('motor.anahtarSil')) : null
        )
      );
    }
    return h(
      'section',
      { class: 'panel' },
      h('h2', null, t('ayar.beyin')),
      h('div', { class: 'formIki' }, alan(t('kur.beyinAdi'), ad), alan(t('kur.sahip'), sahip)),
      alan(t('ayar.beyinWhatsapp'), wp, t('ayar.beyinWhatsappIpucu', { x: b.ad })),
      whatsappBolumu(),
      telegramBolumu(),
      h(
        'div',
        { class: 'alan' },
        h('span', { class: 'alanEtiket' }, t('kur.sesBaslik')),
        bolmeli(
          ['yok', 'sistem', 'elevenlabs', 'openai'].map((x) => [x, t('ses.' + x)]),
          tur,
          (v) => {
            sesler.tur = null;
            api.sirketGuncelle({ beyin: { ses: { tur: v, ses: '' } } });
          }
        ),
        h('span', { class: 'alanIpucu' }, t('ses.' + tur + 'Aciklama'))
      ),
      parca
    );
  }

  function bolmeli(secenekler, secili, sec) {
    return h(
      'div',
      { class: 'bolmeli' },
      secenekler.map(([deger, etiket]) => h('button', { type: 'button', class: secili === deger ? 'secili' : '', onclick: () => secili !== deger && sec(deger) }, etiket))
    );
  }

  function motorKarti(motor) {
    const t = depo.t;
    const s = depo.sirket;
    const mb = depo.bilgi.motorlar || {};
    const arac = mb[motor];
    const ad = t('motor.' + motor);
    const yontem = s.giris[motor];
    const parcalar = [h('h3', { class: 'motorBaslik' }, ad, mb.secilen === motor ? h('span', { class: 'rozet' }, t('motor.kullanilan')) : null)];

    if (!arac) {
      const komut = (mb.kurulum || {})[motor] || '';
      const kopyaDugme = h('button', { type: 'button', onclick: async () => (kopyaDugme.textContent = (await kopyala(komut)) ? t('genel.kopyalandi') : t('genel.kopyala')) }, t('genel.kopyala'));
      parcalar.push(
        h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('motor.yok', { x: t('motor.arac.' + motor) })),
        h('p', { class: 'ipucu' }, t('motor.yokAciklama.' + motor)),
        h('div', { class: 'komut' }, h('code', null, komut), kopyaDugme),
        h('div', { class: 'satirDugme' }, h('button', { type: 'button', class: 'dugme', onclick: () => api.claudeYolSec(motor) }, t('claude.yolSec')))
      );
      return h('div', { class: 'motorKart' }, parcalar);
    }

    parcalar.push(h('p', { class: 'durumSatir iyi' }, ikon('tik', 16), t('motor.var', { x: t('motor.arac.' + motor), s: arac.surum })), h('code', { class: 'yol' }, arac.yol));
    parcalar.push(
      h(
        'div',
        { class: 'alan' },
        h('span', { class: 'alanEtiket' }, t('motor.giris')),
        bolmeli(
          [
            ['abonelik', t('motor.abonelik')],
            ['api', t('motor.api')],
          ],
          yontem,
          (v) => api.sirketGuncelle({ giris: { ...s.giris, [motor]: v } })
        ),
        h('span', { class: 'alanIpucu' }, t('motor.girisIpucu.' + yontem))
      )
    );

    if (yontem === 'abonelik') {
      const g = arac.giris || {};
      parcalar.push(
        g.girisli
          ? h('p', { class: 'durumSatir iyi' }, ikon('tik', 16), g.hesap ? t('motor.girisli', { x: g.hesap }) : t('motor.girisliHesapsiz'))
          : h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('motor.girissiz')),
        h(
          'div',
          { class: 'satirDugme' },
          h(
            'button',
            {
              type: 'button',
              class: g.girisli ? 'dugme' : 'dugme ana',
              onclick: async () => {
                const r = await api.motorGiris({ motor, sutun: 100, satir: 30 });
                if (!r || r.hata) return bildir(hataMetni(r), true);
                bildir(t('motor.girisAcildi'));
                if (git) git('ofis');
              },
            },
            t(g.girisli ? 'motor.hesapDegistir' : 'motor.girisYap')
          )
        ),
        motor === 'kimi' || motor === 'gemini' ? h('p', { class: 'alanIpucu' }, t('motor.girisNot.' + motor)) : null
      );
    } else {
      const kayitli = !!(mb.anahtarVar || {})[motor];
      const giris = h('input', {
        type: 'password',
        autocomplete: 'off',
        spellcheck: 'false',
        placeholder: kayitli ? t('motor.anahtarKayitli') : { claude: 'sk-ant-…', gemini: 'AIza…' }[motor] || 'sk-…',
        value: anahtarTaslak[motor],
        oninput: () => (anahtarTaslak[motor] = giris.value),
      });
      const kaydet = async (deger) => {
        const r = await api.motorAnahtar({ motor, deger });
        if (!r || r.hata) return bildir(hataMetni(r), true);
        anahtarTaslak[motor] = '';
        bildir(t(deger ? 'motor.anahtarKaydedildi' : 'motor.anahtarSilindi'));
      };
      parcalar.push(
        !mb.sifreliDepo ? h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('motor.depoYok')) : null,
        kayitli ? h('p', { class: 'durumSatir iyi' }, ikon('tik', 16), t('motor.anahtarVar')) : h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('motor.anahtarYok')),
        alan(t('motor.anahtar'), giris, t('motor.anahtarIpucu.' + motor)),
        h(
          'div',
          { class: 'satirDugme' },
          h('button', { type: 'button', class: 'dugme ana', disabled: !mb.sifreliDepo, onclick: () => giris.value.trim() && kaydet(giris.value.trim()) }, t('genel.kaydet')),
          kayitli ? h('button', { type: 'button', class: 'dugme', onclick: () => kaydet('') }, ikon('cop', 14), t('motor.anahtarSil')) : null
        )
      );
    }

    // Kimi ve Gemini modeli aracın kendi ayarından (ya da hesabın varsayılanından) gelir
    if (motor === 'kimi' || motor === 'gemini') {
      parcalar.push(h('p', { class: 'alanIpucu' }, t('motor.modelNot.' + motor)));
      return h('div', { class: 'motorKart' }, parcalar);
    }
    // model düzeni: şef güçlü modelle yönetir, çalışanlar daha az harcayan modelle iş yapar
    const modeller = s.modeller[motor];
    const modelSec = (kat) => {
      let secenekler;
      if (motor === 'claude') {
        secenekler = CLAUDE_MODELLER[kat].map((m) => [m, t('model.' + m)]);
      } else {
        const v = (mb.codexVarsayilan || {})[kat];
        const liste = mb.codexModeller || [];
        secenekler = [['', v ? t('model.otomatikAdli', { x: (liste.find((m) => m.slug === v) || { ad: v }).ad }) : t('model.otomatik')], ...liste.map((m) => [m.slug, m.ad + (m.aciklama ? ' · ' + m.aciklama : '')])];
        if (modeller[kat] && !liste.some((m) => m.slug === modeller[kat])) secenekler.push([modeller[kat], modeller[kat]]);
      }
      const sec = h(
        'select',
        { onchange: () => api.sirketGuncelle({ modeller: { ...s.modeller, [motor]: { ...modeller, [kat]: sec.value } } }) },
        secenekler.map(([d, e]) => h('option', { value: d }, e))
      );
      sec.value = modeller[kat];
      return sec;
    };
    parcalar.push(
      h('h4', { class: 'altBaslik' }, t('ayar.modeller')),
      alan(t('ayar.koordinator'), modelSec('koordinator'), t('ayar.koordinatorIpucu')),
      alan(t('ayar.calisan'), modelSec('calisan'), t('ayar.calisanIpucu'))
    );
    return h('div', { class: 'motorKart' }, parcalar);
  }

  // Güncellemeler: mevcut sürüm, elle kontrol, otomatik kontrol
  let guncel = depo.guncelleme || null;
  api.guncellemeDinle((d) => {
    guncel = d;
    if (kok.isConnected && !kok.hidden) ciz();
  });
  function guncellemePaneli() {
    const t = depo.t;
    const g = guncel || {};
    const s = depo.sirket;
    const satir = {
      gelistirme: [null, t('guncel.gelistirme')],
      kontrol: ['donen', t('guncel.kontrolEdiliyor')],
      yok: ['iyi', t('guncel.guncel')],
      var: ['uyari', t('guncel.var', { x: g.surum })],
      iniyor: ['donen', t('guncel.yuzde', { x: g.yuzde || 0 })],
      indi: ['iyi', t('guncel.hazir', { x: g.surum })],
      hata: ['kotu', g.hataKod ? t('guncel.hataKod.' + g.hataKod) : t('guncel.hataKod.genel'), g.hata],
    }[g.asama] || [null, g.etkin === false ? t('guncel.gelistirme') : t('guncel.bekliyor')];
    return h(
      'section',
      { class: 'panel' },
      h('h2', null, t('guncel.baslik')),
      h('p', { class: 'ipucu' }, t('guncel.mevcut', { x: g.mevcut || depo.bilgi.surum || '' })),
      h('p', { class: 'durumSatir ' + (satir[0] === 'iyi' ? 'iyi' : satir[0] === 'kotu' || satir[0] === 'uyari' ? 'kotu' : ''), title: satir[2] || '' }, satir[0] === 'donen' ? h('span', { class: 'donen' }) : ikon(satir[0] === 'iyi' ? 'tik' : satir[0] ? 'ucgen' : 'saat', 16), satir[1]),
      h(
        'div',
        { class: 'satirDugme' },
        g.asama === 'var' ? h('button', { type: 'button', class: 'dugme ana', onclick: () => api.guncellemeIndir() }, ikon('indir', 14), t('guncel.simdi')) : null,
        g.asama === 'indi' ? h('button', { type: 'button', class: 'dugme ana', onclick: () => api.guncellemeKur() }, ikon('yenile', 14), t('guncel.kur')) : null,
        h('button', { type: 'button', class: 'dugme', disabled: g.etkin === false || g.asama === 'kontrol' || g.asama === 'iniyor', onclick: () => api.guncellemeKontrol() }, ikon('yenile', 14), t('guncel.kontrolEt'))
      ),
      h('div', { class: 'alan yatay' }, anahtar(s.otomatikGuncelleme, (v) => api.sirketGuncelle({ otomatikGuncelleme: v }), t('guncel.otomatik')), h('span', { class: 'alanIpucu' }, t('guncel.otomatikIpucu')))
    );
  }

  // GitHub: giriş gh'nin kendi tarayıcı akışıyla yapılır, şifre ya da jeton uygulamaya girmez
  function githubPaneli() {
    const t = depo.t;
    const g = depo.bilgi.github || {};
    const komut = g.kurulum || '';
    return h(
      'section',
      { class: 'panel' },
      h('h2', null, 'GitHub'),
      !g.var
        ? [h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('github.yok')), h('div', { class: 'komut' }, h('code', null, komut))]
        : [
            g.girisli ? h('p', { class: 'durumSatir iyi' }, ikon('tik', 16), t('github.girisli', { x: g.hesap || '' })) : h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('github.girissiz')),
            h(
              'div',
              { class: 'satirDugme' },
              h(
                'button',
                {
                  type: 'button',
                  class: g.girisli ? 'dugme' : 'dugme ana',
                  onclick: async () => {
                    const r = await api.motorGiris({ motor: 'github', sutun: 100, satir: 30 });
                    if (!r || r.hata) return bildir(hataMetni(r), true);
                    bildir(t('motor.girisAcildi'));
                    if (git) git('ofis');
                  },
                },
                t(g.girisli ? 'motor.hesapDegistir' : 'motor.girisYap')
              )
            ),
          ],
      h('p', { class: 'ipucu' }, t('github.not'))
    );
  }

  function ciz() {
    const t = depo.t;
    const s = depo.sirket;
    const b = depo.bilgi;
    const mb = b.motorlar || {};
    const ad = h('input', { type: 'text', value: s.ad, maxlength: '60' });
    ad.addEventListener('change', () => ad.value.trim() && api.sirketGuncelle({ ad: ad.value.trim() }));
    const dilSec = bolmeli(
      [
        ['tr', 'Türkçe'],
        ['en', 'English'],
      ],
      s.dil,
      async (d) => {
        await api.dilDegistir(d);
        location.reload();
      }
    );
    const izin = h('select', { onchange: () => api.sirketGuncelle({ izinModu: izin.value }) }, ['', 'acceptEdits', 'auto', 'plan', 'bypassPermissions'].map((m) => h('option', { value: m }, t('izin.' + (m || 'varsayilan')))));
    izin.value = s.izinModu || '';
    const secilenAd = mb.secilen ? t('motor.' + mb.secilen) : t('motor.hicbiri');

    doldur(
      kok,
      h('header', { class: 'sayfaBas' }, h('div', null, h('h1', null, t('ayar.baslik')))),
      h(
        'div',
        { class: 'ayarIzgara' },
        beyinPaneli(),
        h('section', { class: 'panel' }, h('h2', null, t('ayar.ofis')), alan(t('ayar.ofisAdi'), ad), h('div', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('ayar.dil')), dilSec, h('span', { class: 'alanIpucu' }, t('ayar.dilIpucu')))),
        h(
          'section',
          { class: 'panel' },
          h('h2', null, t('ayar.calisma')),
          h('div', { class: 'alan yatay' }, anahtar(s.takimModu, (v) => api.sirketGuncelle({ takimModu: v }), t('ayar.takim')), h('span', { class: 'alanIpucu' }, t('ayar.takimIpucu'))),
          alan(t('ayar.izin'), izin, t('ayar.izinIpucu')),
          s.izinModu === 'bypassPermissions' ? h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('izin.tamUyari')) : null,
          h('div', { class: 'alan yatay' }, anahtar(s.tarayiciOnaysiz, (v) => api.sirketGuncelle({ tarayiciOnaysiz: v }), t('ayar.tarayiciOnaysiz')), h('span', { class: 'alanIpucu' }, t('ayar.tarayiciOnaysizIpucu'))),
          h(
            'div',
            { class: 'alan' },
            h('span', { class: 'alanEtiket' }, t('ayar.projeKoku')),
            h(
              'div',
              { class: 'klasorSatir' },
              h('code', { class: 'yol' }, projeKoku || '…'),
              h(
                'button',
                {
                  type: 'button',
                  class: 'dugme',
                  onclick: async () => {
                    const r = await api.katKokuSec();
                    if (r && r.yol) {
                      projeKoku = r.yol;
                      ciz();
                    }
                  },
                },
                ikon('klasor', 14),
                t('katKur.kokDegistir')
              )
            ),
            h('span', { class: 'alanIpucu' }, t('ayar.projeKokuIpucu'))
          ),
          h('div', { class: 'alan yatay' }, anahtar(s.bildirim, (v) => api.sirketGuncelle({ bildirim: v }), t('ayar.bildirim')), h('span', { class: 'alanIpucu' }, t('ayar.bildirimIpucu'))),
          s.bildirim ? h('div', { class: 'alan yatay' }, anahtar(s.bildirimSesi !== false, (v) => api.sirketGuncelle({ bildirimSesi: v }), t('ayar.bildirimSesi')), h('span', { class: 'alanIpucu' }, t('ayar.bildirimSesiIpucu'))) : null
        ),
        h(
          'section',
          { class: 'panel genis' },
          h('h2', null, t('motor.baslik')),
          h('p', { class: 'ipucu' }, t('motor.aciklama')),
          h(
            'div',
            { class: 'alan' },
            h('span', { class: 'alanEtiket' }, t('motor.secim')),
            bolmeli(
              [
                ['otomatik', t('motor.otomatik')],
                ['claude', t('motor.claude')],
                ['codex', t('motor.codex')],
                ['kimi', t('motor.kimi')],
                ['gemini', t('motor.gemini')],
              ],
              s.motor,
              (v) => api.sirketGuncelle({ motor: v })
            ),
            h('span', { class: 'alanIpucu' }, t('motor.secimIpucu'))
          ),
          h('p', { class: 'durumSatir ' + (mb.hazir ? 'iyi' : 'kotu') }, ikon(mb.hazir ? 'tik' : 'ucgen', 16), t(mb.hazir ? 'motor.hazir' : 'motor.hazirDegil', { x: secilenAd })),
          h('div', { class: 'motorIzgara' + (taraniyor ? ' taraniyor' : '') }, motorKarti('claude'), motorKarti('codex'), motorKarti('kimi'), motorKarti('gemini')),
          h(
            'div',
            { class: 'satirDugme' },
            h(
              'button',
              {
                type: 'button',
                class: 'dugme',
                disabled: taraniyor,
                onclick: async () => {
                  taraniyor = true;
                  ciz();
                  const r = await api.claudeYenile();
                  taraniyor = false;
                  ciz();
                  bildir(r && r.motorlar && r.motorlar.secilen ? t('motor.yenilendi') : t('motor.hicbiriYok'), !(r && r.motorlar && r.motorlar.secilen));
                },
              },
              taraniyor ? h('span', { class: 'donen' }) : ikon('yenile', 14),
              t(taraniyor ? 'motor.taraniyor' : 'motor.yenidenTara')
            )
          ),
          h('p', { class: 'ipucu' }, t('motor.gizlilik'))
        ),
        githubPaneli(),
        guncellemePaneli(),
        h(
          'section',
          { class: 'panel' },
          h('h2', null, t('ayar.veri')),
          h('p', { class: 'ipucu' }, t('ayar.veriAciklama')),
          h('code', { class: 'yol' }, b.veriKlasoru || ''),
          h(
            'div',
            { class: 'satirDugme' },
            h('button', { type: 'button', class: 'dugme', onclick: () => api.veriAc() }, ikon('klasor', 15), t('ayar.veriAc')),
            h(
              'button',
              {
                type: 'button',
                class: 'dugme',
                onclick: async () => {
                  const r = await api.yedekAl();
                  if (r && r.hata) bildir(hataMetni(r), true);
                  else if (r && r.tamam) bildir(t('ayar.yedekAlindi', { x: r.yol }));
                },
              },
              ikon('indir', 15),
              t('ayar.yedekAl')
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'dugme',
                onclick: async () => {
                  if (!confirm(t('ayar.yedekOnay'))) return;
                  const r = await api.yedekYukle();
                  if (r && r.hata) bildir(hataMetni(r), true);
                  else if (r && r.tamam) bildir(t('ayar.yedekYuklendi', { x: r.katSayisi }));
                },
              },
              ikon('yenile', 15),
              t('ayar.yedekYukle')
            )
          ),
          h('p', { class: 'ipucu' }, t('ayar.yedekNot')),
          b.sunucuHata ? h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 16), t('ayar.sunucuHata', { x: b.sunucuHata })) : null,
          h('p', { class: 'ipucu' }, t('ayar.surum', { x: b.surum || '' }))
        )
      )
    );
  }

  dinle('sirket', () => {
    if (document.activeElement && kok.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    ciz();
  });
  dinle('bilgi', () => {
    if (document.activeElement && kok.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    ciz();
  });
  ciz();
  return { kok, goster: ciz, gizle() {} };
}
