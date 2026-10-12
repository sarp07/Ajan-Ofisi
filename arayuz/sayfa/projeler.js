// Projeler sayfası: her projenin klasörü, alan adları, bağlı hesapları, test bilgisi ve kayıt defteri.
import { h, doldur, ikon, alan, anahtar, cipGirisi } from '../dom.js';
import { depo, api, dinle, bildir, hataMetni } from '../depo.js';
import { katKurAc } from '../katKur.js';

export const PLATFORMLAR = ['whatsapp', 'telegram', 'gmail', 'instagram', 'x', 'tiktok', 'youtube', 'linkedin', 'facebook', 'discord', 'github', 'vercel', 'cloudflare', 'supabase', 'google', 'apple', 'diger'];
export const PLATFORM_ADI = { gmail: 'Gmail', instagram: 'Instagram', x: 'X', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', facebook: 'Facebook', telegram: 'Telegram', discord: 'Discord', whatsapp: 'WhatsApp', github: 'GitHub', vercel: 'Vercel', cloudflare: 'Cloudflare', supabase: 'Supabase', google: 'Google', apple: 'Apple' };

export function neZaman(z, t) {
  if (!z) return '';
  const dk = Math.floor((Date.now() - z) / 60000);
  if (dk < 1) return t('zaman.simdi');
  if (dk < 60) return t('zaman.dk', { x: dk });
  const sa = Math.floor(dk / 60);
  if (sa < 24) return t('zaman.sa', { x: sa });
  return t('zaman.gun', { x: Math.floor(sa / 24) });
}

// Uzun yolun sonu daha anlamlıdır: baştan kısaltılır
const kisaYol = (p) => (p.length > 46 ? '…' + p.slice(-45) : p);

const tarihSaat = (z) => {
  const d = new Date(z);
  const iki = (n) => String(n).padStart(2, '0');
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)} ${iki(d.getHours())}:${iki(d.getMinutes())}`;
};

export function projelerSayfasi({ git }) {
  const kok = h('div', { class: 'sayfa projeSayfa' });
  const cekmece = h('div', { class: 'cekmece', hidden: true });
  const perde = h('div', { class: 'perde', hidden: true, onclick: () => kapat() });
  let acik = null;
  const ozetler = new Map(); // proje kimliği -> kayıt durumu
  const repolar = new Map(); // proje kimliği -> git ve GitHub durumu

  async function repoYukle(id) {
    const r = await api.githubRepo(id);
    repolar.set(id, r && !r.hata ? r : { depo: false });
  }

  function repoSatiri(p) {
    const t = depo.t;
    const r = repolar.get(p.id);
    if (!r || !r.depo) return null;
    const parca = [r.dal || t('github.dalYok'), r.degisen ? t('github.degisen', { x: r.degisen }) : t('github.temiz')];
    if (r.ileride) parca.push(t('github.ileride', { x: r.ileride }));
    if (r.geride) parca.push(t('github.geride', { x: r.geride }));
    if (r.prler && r.prler.length) parca.push(t('github.pr', { x: r.prler.length }));
    return h(
      'div',
      { class: 'repoSatir' },
      ikon('dal', 13),
      h('span', null, parca.join(' · ')),
      r.githubAdres ? h('a', { href: r.githubAdres, target: '_blank', rel: 'noreferrer', onclick: (e) => e.stopPropagation() }, 'GitHub') : null
    );
  }

  async function ozetYukle(id) {
    const r = await api.kayitOku(id);
    if (r && r.durum) ozetler.set(id, r.durum);
    return r;
  }

  function kart(p) {
    const t = depo.t;
    const s = depo.sirket;
    const calisiyor = depo.oturum.acik && depo.oturum.projeId === p.id;
    const etkin = s.sonProje === p.id;
    const d = ozetler.get(p.id);
    const son = d && d.istekler.length ? d.istekler[d.istekler.length - 1] : null;
    const bilgi = [p.hesaplar.length ? t('proje.hesapSayi', { x: p.hesaplar.length }) : null, p.test.zorunlu ? t('proje.kapiAcik') : null, d && d.acikGorevler.length ? t('proje.acikGorev', { x: d.acikGorevler.length }) : null].filter(Boolean);
    return h(
      'div',
      { class: 'projeKart' + (etkin ? ' etkin' : ''), role: 'button', tabindex: '0', onclick: () => ac(p), onkeydown: (e) => e.key === 'Enter' && ac(p) },
      h(
        'div',
        { class: 'projeUst' },
        h('span', { class: 'projeSimge' }, ikon('klasor', 20)),
        h('div', { class: 'projeAdKap' }, h('div', { class: 'projeAd' }, p.ad), h('div', { class: 'projeYol', title: p.klasor }, p.klasor ? kisaYol(p.klasor) : t('proje.klasorYok'))),
        calisiyor ? h('span', { class: 'hap', 'data-d': 'calisiyor' }, t('proje.calisiyor')) : etkin ? h('span', { class: 'hap' }, t('proje.etkin')) : null
      ),
      p.aciklama ? h('p', { class: 'projeAciklama' }, p.aciklama) : null,
      p.alanAdlari.length
        ? h('div', { class: 'cipler' }, p.alanAdlari.slice(0, 3).map((x) => h('span', { class: 'cip sade' }, x)), p.alanAdlari.length > 3 ? h('span', { class: 'cip sade' }, '+' + (p.alanAdlari.length - 3)) : null)
        : null,
      bilgi.length ? h('div', { class: 'projeBilgi' }, bilgi.join(' · ')) : null,
      repoSatiri(p),
      h(
        'div',
        { class: 'projeKaldi' },
        h('span', { class: 'projeKaldiEtiket' }, ikon('saat', 13), d && d.sonZaman ? t('proje.kaldi', { x: neZaman(d.sonZaman, t) }) : t('proje.kayitYok')),
        son ? h('p', null, son.istek) : null
      ),
      h(
        'div',
        { class: 'projeAlt' },
        h(
          'button',
          {
            type: 'button',
            class: 'dugme kucuk' + (etkin ? '' : ' ana'),
            onclick: async (e) => {
              e.stopPropagation();
              if (!depo.oturum.acik) await api.sirketGuncelle({ sonProje: p.id });
              git('ofis');
            },
          },
          ikon('ofis', 14),
          t('proje.ofisteAc')
        )
      )
    );
  }

  function ciz() {
    const t = depo.t;
    const s = depo.sirket;
    doldur(
      kok,
      h(
        'header',
        { class: 'sayfaBas' },
        h('div', null, h('h1', null, t('proje.baslik')), h('p', null, t('proje.aciklama', { x: s.sef.ad }))),
        h('button', { type: 'button', class: 'dugme ana', onclick: () => katKurAc({ bitti: () => yenile() }) }, ikon('arti', 15), t('proje.yeni'))
      ),
      h(
        'div',
        { class: 'projeIzgara' },
        s.projeler.map((p) => kart(p)),
        h('button', { type: 'button', class: 'projeKart bosKutu', onclick: () => katKurAc({ bitti: () => yenile() }) }, h('span', { class: 'artiDaire' }, ikon('arti', 22)), h('span', { class: 'bosKutuYazi' }, h('b', null, t('proje.ekleBaslik')), h('span', null, t('proje.ekleAciklama'))))
      ),
      perde,
      cekmece
    );
  }

  async function yenile() {
    await Promise.all(depo.sirket.projeler.flatMap((p) => [ozetYukle(p.id), repoYukle(p.id)]));
    if (!acik) ciz();
  }

  function kapat() {
    acik = null;
    cekmece.hidden = true;
    perde.hidden = true;
    ciz();
  }

  // ---------- git ----------
  // Sahibin düğmeyle yaptığı git işlemleri: dal, pull, commit, push, GitHub'a bağlama
  function gitBolumu(projeId) {
    const t = depo.t;
    const kap = h('section', { class: 'formBolum gitBolum' }, h('h3', { lang: 'en' }, 'Git'), h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('github.okunuyor')));
    let mesaj = '';
    let calisiyor = '';
    let dalAciliyor = false;
    const islem = async (ad, deger, basari) => {
      calisiyor = ad;
      await ciz_();
      const r = await api.gitIslem(projeId, ad, deger);
      calisiyor = '';
      if (!r || r.hata) bildir(hataMetni(r), true);
      else {
        bildir(basari || t('github.tamam'));
        if (ad === 'commit') mesaj = '';
      }
      await repoYukle(projeId);
      await ciz_();
    };
    const ciz_ = async () => {
      const r = repolar.get(projeId) || (await repoYukle(projeId), repolar.get(projeId));
      if (!r || !r.depo) return doldur(kap, h('h3', { lang: 'en' }, 'Git'), h('p', { class: 'alanIpucu' }, t('github.depoDegil')));
      const dallar = await api.gitIslem(projeId, 'dallar');
      const liste = dallar && dallar.tamam ? dallar.sonuc : [r.dal];
      const dalSec = h('select', { disabled: !!calisiyor, onchange: () => islem('dalDegistir', dalSec.value, t('github.dalDegisti', { x: dalSec.value })) }, liste.map((d) => h('option', { value: d }, d)));
      dalSec.value = r.dal;
      const mesajGiris = h('input', { type: 'text', value: mesaj, placeholder: t('github.mesaj'), maxlength: '200', oninput: () => (mesaj = mesajGiris.value) });
      const dugme = (ad, ikonAd, metin, onclick, ana) => h('button', { type: 'button', class: 'dugme' + (ana ? ' ana' : ''), disabled: !!calisiyor, onclick }, calisiyor === ad ? h('span', { class: 'donen' }) : ikon(ikonAd, 14), metin);
      const durum = [r.degisen ? t('github.degisen', { x: r.degisen }) : t('github.temiz'), r.ileride ? t('github.ileride', { x: r.ileride }) : null, r.geride ? t('github.geride', { x: r.geride }) : null].filter(Boolean).join(' · ');
      doldur(
        kap,
        h('h3', { lang: 'en' }, 'Git'),
        h('div', { class: 'gitUst' }, ikon('dal', 14), dalSec, h('span', { class: 'alanIpucu' }, durum), r.githubAdres ? h('a', { href: r.githubAdres, target: '_blank', rel: 'noreferrer' }, 'GitHub') : null),
        h(
          'div',
          { class: 'satirDugme' },
          dugme('pull', 'indir', 'Pull', () => islem('pull')),
          dugme('push', 'gonder', 'Push', () => islem('push')),
          dugme('dalOlustur', 'dal', t('github.yeniDal'), () => ((dalAciliyor = !dalAciliyor), ciz_())),
          !r.uzak && (depo.bilgi.github || {}).girisli ? dugme('githubaBagla', 'disari', t('github.bagla'), () => islem('githubaBagla', '', t('github.baglandi'))) : null
        ),
        dalAciliyor
          ? (() => {
              const dalGiris = h('input', { type: 'text', placeholder: t('github.dalAdi'), maxlength: '80' });
              const olustur = () => {
                const ad = dalGiris.value.trim();
                if (!ad) return dalGiris.focus();
                dalAciliyor = false;
                islem('dalOlustur', ad, t('github.dalDegisti', { x: ad }));
              };
              dalGiris.addEventListener('keydown', (e) => e.key === 'Enter' && olustur());
              setTimeout(() => dalGiris.focus(), 0);
              return h('div', { class: 'gitCommit' }, dalGiris, h('button', { type: 'button', class: 'dugme ana', onclick: olustur }, t('github.olustur')));
            })()
          : null,
        r.degisen
          ? h(
              'div',
              { class: 'gitCommit' },
              mesajGiris,
              dugme('commit', 'tik', 'Commit', () => (mesaj.trim() ? islem('commit', mesaj.trim()) : mesajGiris.focus()), true)
            )
          : null,
        r.kayitlar.length ? h('ol', { class: 'gitKayitlar' }, r.kayitlar.slice(0, 5).map((k) => h('li', null, h('code', null, k.kisa), h('span', null, k.konu), h('time', null, k.zaman)))) : null,
        r.prler && r.prler.length ? h('div', { class: 'gitPrler' }, h('span', { class: 'alanEtiket' }, t('github.pr', { x: r.prler.length })), r.prler.map((p) => h('a', { href: p.adres, target: '_blank', rel: 'noreferrer' }, `#${p.no} ${p.baslik}`))) : null
      );
    };
    ciz_();
    return kap;
  }

  // ---------- kayıt defteri ----------
  function defterCiz(kap, r) {
    const t = depo.t;
    const d = r.durum;
    const kayitlar = r.kayitlar.filter((k) => k.tur !== 'oturum' || k.metin !== 'bitti');
    if (!r.kayitlar.length) return doldur(kap, h('p', { class: 'alanIpucu' }, t('defter.bos')));
    const son = d.istekler[d.istekler.length - 1];
    doldur(
      kap,
      h(
        'div',
        { class: 'kaldiKutu' },
        h('h4', null, ikon('saat', 15), t('defter.kaldi')),
        son ? h('dl', null, h('dt', null, t('defter.sonIstek')), h('dd', null, son.istek), h('dt', null, t('defter.sonSonuc')), h('dd', { class: son.sonuc ? '' : 'soluk' }, son.sonuc || t('defter.yarim'))) : null,
        d.acikGorevler.length ? h('dl', null, h('dt', null, t('defter.acik')), h('dd', null, h('ul', null, d.acikGorevler.map((g) => h('li', null, g.metin + (g.kim ? ' (' + g.kim + ')' : '')))))) : null,
        h('p', { class: 'alanIpucu' }, t('defter.ipucu', { x: depo.sirket.sef.ad }))
      ),
      h(
        'ol',
        { class: 'defter' },
        kayitlar
          .slice(-80)
          .reverse()
          .map((k) =>
            h(
              'li',
              { 'data-tur': k.tur },
              h('time', null, tarihSaat(k.z)),
              h('span', { class: 'defterTur' }, t('defter.tur.' + k.tur) + (k.kim && k.tur !== 'sonuc' ? ' · ' + k.kim : '')),
              h('p', null, k.tur === 'oturum' ? t('defter.oturum.' + k.metin) : k.metin)
            )
          )
      )
    );
  }

  // ---------- düzenleyici ----------
  function ac(kayit) {
    const t = depo.t;
    const s = depo.sirket;
    const yeni = !!kayit.yeni;
    const taslak = yeni ? { ad: '', klasor: '', aciklama: '', alanAdlari: [], hesaplar: [], test: { komut: '', adres: '', sorumlu: '', zorunlu: false }, notlar: '' } : JSON.parse(JSON.stringify(kayit));
    acik = taslak;
    let adElle = !yeni;

    const baslik = h('h2', null, yeni ? t('proje.yeniBaslik') : taslak.ad);
    const adGiris = h('input', { type: 'text', value: taslak.ad, maxlength: '60', placeholder: t('proje.adOrnek'), oninput: () => ((taslak.ad = adGiris.value), (adElle = true)) });
    const yolGoster = h('code', { class: 'yol' }, taslak.klasor || t('proje.klasorSecilmedi'));
    const klasorSec = async () => {
      const r = await api.projeKlasorSec();
      if (!r || !r.tamam) return;
      taslak.klasor = r.klasor;
      yolGoster.textContent = r.klasor;
      if (!adElle || !taslak.ad.trim()) {
        taslak.ad = r.klasor.split(/[\\/]/).filter(Boolean).pop() || '';
        adGiris.value = taslak.ad;
      }
    };
    const aciklamaGiris = h('textarea', { rows: '2', value: taslak.aciklama, maxlength: '600', placeholder: t('proje.aciklamaOrnek'), oninput: () => (taslak.aciklama = aciklamaGiris.value) });
    const alanGiris = cipGirisi(taslak.alanAdlari, (v) => (taslak.alanAdlari = v), t('proje.alanOrnek'), 20);

    // bağlı hesaplar
    const hesapKap = h('div', { class: 'hesaplar' });
    const hesapCiz = () =>
      doldur(
        hesapKap,
        taslak.hesaplar.map((hs, i) => {
          const pl = h('select', { 'aria-label': t('proje.platform'), onchange: () => (hs.platform = pl.value) }, PLATFORMLAR.map((x) => h('option', { value: x }, PLATFORM_ADI[x] || t('proje.diger'))));
          pl.value = hs.platform;
          const ad = h('input', { type: 'text', value: hs.ad, maxlength: '80', placeholder: t('proje.hesapOrnek'), 'aria-label': t('proje.hesapAd'), oninput: () => (hs.ad = ad.value) });
          const not = h('input', { type: 'text', value: hs.not, maxlength: '200', placeholder: t('proje.hesapNotOrnek'), 'aria-label': t('proje.hesapNot'), oninput: () => (hs.not = not.value) });
          return h(
            'div',
            { class: 'hesapSatir' },
            pl,
            ad,
            not,
            h('button', {
              type: 'button',
              class: 'simge',
              'aria-label': t('genel.kaldir'),
              onclick: () => {
                taslak.hesaplar.splice(i, 1);
                hesapCiz();
              },
            }, ikon('kapat', 15))
          );
        }),
        h(
          'button',
          {
            type: 'button',
            class: 'dugme kucuk',
            onclick: () => {
              taslak.hesaplar.push({ platform: 'instagram', ad: '', not: '' });
              hesapCiz();
              hesapKap.querySelector('.hesapSatir:last-of-type input')?.focus();
            },
          },
          ikon('arti', 14),
          t('proje.hesapEkle')
        )
      );
    hesapCiz();

    // test
    const komutGiris = h('input', { type: 'text', class: 'mono', value: taslak.test.komut, maxlength: '300', placeholder: 'npm test', oninput: () => (taslak.test.komut = komutGiris.value) });
    const adresGiris = h('input', { type: 'text', value: taslak.test.adres, maxlength: '300', placeholder: 'https://staging.ornek.com', oninput: () => (taslak.test.adres = adresGiris.value) });
    const sorumluSec = h('select', { onchange: () => (taslak.test.sorumlu = sorumluSec.value) }, h('option', { value: '' }, t('proje.sorumluYok')), s.ajanlar.map((a) => h('option', { value: a.id }, a.ad + (a.unvan ? ' · ' + a.unvan : ''))));
    sorumluSec.value = s.ajanlar.some((a) => a.id === taslak.test.sorumlu) ? taslak.test.sorumlu : '';
    const notGiris = h('textarea', { rows: '5', value: taslak.notlar, maxlength: '4000', placeholder: t('proje.notOrnek'), oninput: () => (taslak.notlar = notGiris.value) });

    const defterKap = h('div', { class: 'defterKap' }, h('p', { class: 'alanIpucu' }, '…'));
    const temizleKap = h('div', { class: 'silKap' });
    const temizleCiz = (sor) =>
      doldur(
        temizleKap,
        sor
          ? [
              h('span', null, t('defter.temizleEmin')),
              h(
                'button',
                {
                  type: 'button',
                  class: 'dugme tehlike kucuk',
                  onclick: async () => {
                    await api.kayitTemizle(taslak.id);
                    temizleCiz(false);
                    defterCiz(defterKap, await ozetYukle(taslak.id));
                  },
                },
                t('defter.temizleEvet')
              ),
              h('button', { type: 'button', class: 'dugme kucuk', onclick: () => temizleCiz(false) }, t('genel.vazgec')),
            ]
          : h('button', { type: 'button', class: 'dugme hayalet kucuk', onclick: () => temizleCiz(true) }, ikon('cop', 14), t('defter.temizle'))
      );
    if (!yeni) {
      temizleCiz(false);
      ozetYukle(taslak.id).then((r) => acik === taslak && r && r.kayitlar && defterCiz(defterKap, r));
    }

    const silKap = h('div', { class: 'silKap' });
    const silCiz = (sor) =>
      doldur(
        silKap,
        sor
          ? [
              h('span', null, t('proje.silEmin', { x: taslak.ad })),
              h(
                'button',
                {
                  type: 'button',
                  class: 'dugme tehlike',
                  onclick: async () => {
                    const r = await api.projeSil(taslak.id);
                    if (r && r.hata) return bildir(r.hata === 'acik' ? t('proje.silAcik') : hataMetni(r), true);
                    ozetler.delete(taslak.id);
                    kapat();
                  },
                },
                t('proje.silEvet')
              ),
              h('button', { type: 'button', class: 'dugme', onclick: () => silCiz(false) }, t('genel.vazgec')),
            ]
          : h('button', { type: 'button', class: 'dugme hayalet tehlike', onclick: () => silCiz(true) }, ikon('cop', 15), t('proje.sil'))
      );
    if (!yeni) silCiz(false);

    const kaydet = async () => {
      if (!taslak.klasor) return bildir(t('proje.klasorGerekli'), true);
      taslak.hesaplar = taslak.hesaplar.filter((x) => x.ad.trim());
      const r = await api.projeKaydet(taslak);
      if (!r || r.hata) return bildir(hataMetni(r), true);
      bildir(t(depo.oturum.acik && depo.oturum.projeId === r.proje.id ? 'proje.kaydedildiOturum' : 'proje.kaydedildi', { x: r.proje.ad }));
      kapat();
    };

    doldur(
      cekmece,
      h('header', { class: 'cekmeceBas' }, h('span', { class: 'projeSimge buyuk' }, ikon('klasor', 30)), h('div', null, baslik, h('p', null, t(yeni ? 'proje.yeniAciklama' : 'proje.duzenAciklama', { x: s.sef.ad }))), h('button', { type: 'button', class: 'simge', onclick: kapat, 'aria-label': t('genel.kapat') }, ikon('kapat', 18))),
      h(
        'div',
        { class: 'cekmeceGovde' },
        h(
          'section',
          { class: 'formBolum' },
          h('div', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('proje.klasor')), h('div', { class: 'klasorSatir' }, yolGoster, h('button', { type: 'button', class: 'dugme', onclick: klasorSec }, ikon('klasor', 15), t(taslak.klasor ? 'proje.klasorDegistir' : 'proje.klasorSec'))), h('span', { class: 'alanIpucu' }, t('proje.klasorIpucu'))),
          alan(t('proje.ad'), adGiris),
          alan(t('proje.aciklamaEtiket'), aciklamaGiris, t('proje.aciklamaIpucu', { x: s.sef.ad })),
          h('div', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('proje.alanAdlari')), alanGiris, h('span', { class: 'alanIpucu' }, t('proje.alanIpucu')))
        ),
        yeni ? null : gitBolumu(taslak.id),
        h('section', { class: 'formBolum' }, h('h3', null, t('proje.hesaplar')), h('p', { class: 'alanIpucu' }, t('proje.hesapIpucu')), hesapKap),
        h(
          'section',
          { class: 'formBolum' },
          h('h3', null, t('proje.test')),
          h('p', { class: 'alanIpucu' }, t('proje.testIpucu')),
          h('div', { class: 'ikili' }, alan(t('proje.testKomut'), komutGiris), alan(t('proje.testAdres'), adresGiris)),
          alan(t('proje.sorumlu'), sorumluSec),
          h('div', { class: 'alan yatay' }, anahtar(taslak.test.zorunlu, (v) => (taslak.test.zorunlu = v), t('proje.kapi')), h('span', { class: 'alanIpucu' }, t('proje.kapiIpucu', { x: s.sef.ad })))
        ),
        h('section', { class: 'formBolum' }, h('h3', null, t('proje.notlar')), alan(t('proje.notEtiket', { x: s.sef.ad }), notGiris)),
        yeni ? null : h('section', { class: 'formBolum' }, h('div', { class: 'bolumBas' }, h('h3', null, ikon('defter', 16), t('defter.baslik')), temizleKap), defterKap)
      ),
      h('footer', { class: 'cekmeceAlt' }, silKap, h('div', { class: 'bosluk' }), h('button', { type: 'button', class: 'dugme', onclick: kapat }, t('genel.vazgec')), h('button', { type: 'button', class: 'dugme ana', onclick: kaydet }, t('genel.kaydet')))
    );
    cekmece.hidden = false;
    perde.hidden = false;
    cekmece.scrollTop = 0;
    if (yeni) klasorSec();
  }

  dinle('sirket', () => {
    if (!acik) ciz();
  });
  dinle('oturum', () => !acik && ciz());
  api.kayitDinle(({ projeId }) => {
    if (kok.hidden) return;
    ozetYukle(projeId).then(() => !acik && ciz());
  });
  ciz();

  return {
    kok,
    goster(arg) {
      ciz();
      yenile();
      if (arg && arg.yeni) ac({ yeni: true });
      else if (arg && arg.id) {
        const p = depo.sirket.projeler.find((x) => x.id === arg.id);
        if (p) ac(p);
      }
    },
    gizle() {
      acik = null;
      cekmece.hidden = true;
      perde.hidden = true;
    },
  };
}
