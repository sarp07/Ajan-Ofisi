// Servisler: her katın docker compose servisleri (veritabanı, önbellek, API, web, worker) Docker Desktop üzerinden.
// Kartlarda durum, sağlık, port, CPU ve bellek; başlat, durdur, yeniden başlat ve log. Kat başına kaynak sınırı ve
// "düşerse yeniden kaldır" anahtarı. Ajanlar aynı işleri servis_ araçlarıyla yapar.
import { h, doldur, ikon, anahtar } from '../dom.js';
import { depo, api, dinle, bildir, hataMetni } from '../depo.js';

export function servislerSayfasi() {
  const kok = h('div', { class: 'sayfa servisSayfa' });
  let durum = null;
  let yukleniyor = false;
  let calisan = ''; // süren işlemin anahtarı
  let log = null; // { kat, servis, metin }
  let zamanlayici = 0;

  async function yenile(sessiz) {
    if (yukleniyor) return;
    yukleniyor = true;
    if (!sessiz) ciz();
    const r = await api.servisDurum();
    yukleniyor = false;
    if (r && r.tamam) durum = r;
    else if (!sessiz) bildir(hataMetni(r), true);
    if (kok.isConnected && !kok.hidden) ciz();
  }

  async function is(anahtar, fn) {
    calisan = anahtar;
    ciz();
    const r = await fn();
    calisan = '';
    if (!r || r.hata) bildir(r && r.ayrinti ? r.ayrinti : hataMetni(r), true);
    await yenile(true);
    return r;
  }

  async function logAc(kat, servis) {
    log = { kat, servis, metin: '' };
    ciz();
    const r = await api.servisLog(kat, servis);
    log = { kat, servis, metin: r && r.tamam ? r.metin || depo.t('servis.logBos') : (r && r.ayrinti) || hataMetni(r) };
    ciz();
  }

  const dugme = (anahtarAd, ikonAd, yazi, onclick, sinif = '') =>
    h('button', { type: 'button', class: 'dugme kucuk ' + sinif, disabled: !!calisan, onclick }, calisan === anahtarAd ? h('span', { class: 'donen' }) : ikon(ikonAd, 13), yazi);

  function motorBolumu() {
    const t = depo.t;
    const m = durum.motor;
    if (!m.kurulu) return h('section', { class: 'panel' }, h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 15), t('servis.dockerYok')), h('p', { class: 'ipucu' }, t('servis.dockerKur')));
    if (!m.calisiyor)
      return h(
        'section',
        { class: 'panel' },
        h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 15), t('servis.dockerKapali')),
        h('div', { class: 'satirDugme' }, dugme('motor', 'oynat', t('servis.dockerAc'), () => is('motor', () => api.servisMotorAc()), 'ana'))
      );
    const gb = m.bellek ? Math.round((m.bellek / 1073741824) * 10) / 10 : 0;
    return h('p', { class: 'durumSatir iyi servisMotor' }, h('span', { class: 'katNokta' }), t('servis.dockerCalisiyor', { s: m.surum, c: m.cpu, b: gb, k: m.konteyner }));
  }

  function servisKarti(k, s) {
    const t = depo.t;
    const acik = s.durum === 'running';
    const saglik = s.saglik === 'healthy' ? 'iyi' : s.saglik === 'unhealthy' ? 'kotu' : '';
    return h(
      'li',
      { class: 'servisKart' + (acik ? ' acik' : '') },
      h(
        'div',
        { class: 'servisBas' },
        h('span', { class: 'servisNokta ' + (acik ? saglik || 'iyi' : s.durum === 'restarting' ? 'uyari' : '') }),
        h('b', null, s.ad),
        h('span', { class: 'servisDurum' }, t('servis.durum.' + (['running', 'exited', 'restarting', 'created', 'paused'].includes(s.durum) ? s.durum : 'yok')) + (s.saglik ? ' · ' + s.saglik : ''))
      ),
      h(
        'div',
        { class: 'servisBilgi' },
        s.portlar.length ? h('span', null, ikon('dunya', 12), s.portlar.join(', ')) : null,
        acik && s.cpu ? h('span', null, 'CPU ' + s.cpu) : null,
        acik && s.bellek ? h('span', null, s.bellek.split('/')[0].trim()) : null
      ),
      h(
        'div',
        { class: 'satirDugme' },
        acik
          ? [dugme(`${k.id}:${s.ad}:yeniden`, 'yenile', t('servis.yeniden'), () => is(`${k.id}:${s.ad}:yeniden`, () => api.servisIslem(k.id, 'yeniden', s.ad))), dugme(`${k.id}:${s.ad}:durdur`, 'dur', t('servis.durdur'), () => is(`${k.id}:${s.ad}:durdur`, () => api.servisIslem(k.id, 'durdur', s.ad)))]
          : dugme(`${k.id}:${s.ad}:baslat`, 'oynat', t('servis.baslat'), () => is(`${k.id}:${s.ad}:baslat`, () => api.servisIslem(k.id, 'baslat', s.ad))),
        h('button', { type: 'button', class: 'dugme kucuk', onclick: () => logAc(k.id, s.ad) }, ikon('konsol', 13), t('servis.log'))
      )
    );
  }

  function katBolumu(k) {
    const t = depo.t;
    const a = k.ayar;
    const secili = a.compose;
    const dosyaSec = h(
      'select',
      { class: 'servisDosya', 'aria-label': t('servis.dosya'), onchange: (e) => is('ayar' + k.id, () => api.servisAyar(k.id, { compose: e.target.value })) },
      h('option', { value: '' }, t('servis.dosyaYok')),
      k.dosyalar.map((d) => h('option', { value: d }, d.split(/[\\/]/).slice(-2).join('/')))
    );
    dosyaSec.value = secili;
    const bellek = h('input', { type: 'number', min: '0', step: '256', value: a.bellekMb || '', placeholder: t('servis.sinirYok'), class: 'servisSayi', onchange: () => api.servisAyar(k.id, { bellekMb: Number(bellek.value) || 0 }) });
    const cpu = h('input', { type: 'number', min: '0', step: '0.5', value: a.cpu || '', placeholder: t('servis.sinirYok'), class: 'servisSayi', onchange: () => api.servisAyar(k.id, { cpu: Number(cpu.value) || 0 }) });
    const calisanSayi = k.servisler.filter((s) => s.durum === 'running').length;
    return h(
      'section',
      { class: 'panel servisKat' },
      h(
        'header',
        { class: 'servisKatBas' },
        h('div', null, h('h2', null, k.ad), secili ? h('p', { class: 'ipucu' }, t('servis.ozet', { c: calisanSayi, n: k.servisler.length })) : null),
        secili && durum.motor.calisiyor
          ? h(
              'div',
              { class: 'satirDugme' },
              dugme(k.id + ':hepsi:baslat', 'oynat', t('servis.hepsiniBaslat'), () => is(k.id + ':hepsi:baslat', () => api.servisIslem(k.id, 'baslat', '')), 'ana'),
              dugme(k.id + ':hepsi:durdur', 'dur', t('servis.hepsiniDurdur'), () => is(k.id + ':hepsi:durdur', () => api.servisIslem(k.id, 'durdur', '')))
            )
          : null
      ),
      !k.dosyalar.length
        ? h('p', { class: 'ipucu' }, t('servis.composeYok'))
        : h(
            'div',
            { class: 'servisAyar' },
            h('label', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('servis.dosya')), dosyaSec, !secili && k.oneri ? h('button', { type: 'button', class: 'dugme kucuk', onclick: () => is('ayar' + k.id, () => api.servisAyar(k.id, { compose: k.oneri })) }, ikon('tik', 13), t('servis.oneriKullan', { x: k.oneri.split(/[\\/]/).slice(-2).join('/') })) : null),
            secili ? h('label', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('servis.bellek')), bellek) : null,
            secili ? h('label', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('servis.cpu')), cpu) : null,
            secili ? h('div', { class: 'alan' }, anahtar(!!a.acikTut, (v) => api.servisAyar(k.id, { acikTut: v }), t('servis.acikTut')), h('span', { class: 'alanIpucu' }, t('servis.acikTutIpucu'))) : null
          ),
      k.hata ? h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 15), k.hata) : null,
      k.servisler.length ? h('ol', { class: 'servisListe' }, k.servisler.map((s) => servisKarti(k, s))) : null
    );
  }

  function ciz() {
    const t = depo.t;
    doldur(
      kok,
      h(
        'header',
        { class: 'sayfaBas' },
        h('div', null, h('h1', null, t('servis.baslik')), h('p', null, t('servis.aciklama'))),
        h('div', { class: 'satirDugme' }, h('button', { type: 'button', class: 'dugme', disabled: yukleniyor, onclick: () => yenile() }, yukleniyor ? h('span', { class: 'donen' }) : ikon('yenile', 14), t('test.yenile')))
      ),
      !durum
        ? h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('servis.araniyor'))
        : h(
            'div',
            { class: 'servisIzgara' },
            h('div', { class: 'servisSol' }, motorBolumu(), durum.katlar.length ? durum.katlar.map(katBolumu) : h('p', { class: 'ipucu' }, t('servis.katYok'))),
            log
              ? h(
                  'aside',
                  { class: 'panel servisLog' },
                  h('header', { class: 'servisKatBas' }, h('h2', null, `${log.servis || t('servis.hepsi')} · ${t('servis.log')}`), h('div', { class: 'satirDugme' }, h('button', { type: 'button', class: 'dugme kucuk', onclick: () => logAc(log.kat, log.servis) }, ikon('yenile', 13)), h('button', { type: 'button', class: 'simge', 'aria-label': t('genel.kapat'), onclick: () => ((log = null), ciz()) }, ikon('kapat', 15)))),
                  log.metin ? h('pre', { class: 'servisLogMetin' }, log.metin) : h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('servis.logYukleniyor'))
                )
              : null
          )
    );
    const pre = kok.querySelector('.servisLogMetin');
    if (pre) pre.scrollTop = pre.scrollHeight;
  }

  dinle('sirket', () => kok.isConnected && !kok.hidden && !calisan && yenile(true));
  api.servisDinle(() => kok.isConnected && !kok.hidden && !calisan && yenile(true));
  return {
    kok,
    goster() {
      ciz();
      yenile(!!durum);
      clearInterval(zamanlayici);
      // sayfa açıkken 10 saniyede bir tazelenir
      zamanlayici = setInterval(() => !kok.hidden && kok.isConnected && !calisan && yenile(true), 10000);
    },
    gizle() {
      clearInterval(zamanlayici);
    },
  };
}
