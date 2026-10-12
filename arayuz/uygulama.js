// Uygulama kabuğu: üst çubuk, sol gezinme ve sayfalar.
import { h, doldur, ikon } from './dom.js';
import { depo, api, dinle, yukle, bildir } from './depo.js';
import { ofisSayfasi } from './sayfa/ofis.js';
import { ekipSayfasi } from './sayfa/ekip.js';
import { projelerSayfasi } from './sayfa/projeler.js';
import { skillerSayfasi } from './sayfa/skiller.js';
import { kurallarSayfasi } from './sayfa/kurallar.js';
import { ayarlarSayfasi } from './sayfa/ayarlar.js';
import { tarayiciSayfasi } from './sayfa/tarayici.js';
import { testSayfasi } from './sayfa/test.js';
import { servislerSayfasi } from './sayfa/servisler.js';
import { kurulum } from './sayfa/kurulum.js';
import { guncellemeKur } from './guncelleme.js';
import { cevrimdisiKur } from './cevrimdisi.js';

const SAYFALAR = [
  ['ofis', 'ofis', ofisSayfasi],
  ['projeler', 'proje', projelerSayfasi],
  ['ekip', 'ekip', ekipSayfasi],
  ['tarayici', 'dunya', tarayiciSayfasi],
  ['test', 'telefon', testSayfasi],
  ['servisler', 'sunucu', servislerSayfasi],
  ['skiller', 'skill', skillerSayfasi],
  ['kurallar', 'kural', kurallarSayfasi],
  ['ayarlar', 'ayar', ayarlarSayfasi],
];

const kurulan = new Map();
let simdiki = null;

function git(ad, arg) {
  const icerik = document.getElementById('icerik');
  if (simdiki && simdiki !== ad) {
    const eski = kurulan.get(simdiki);
    eski.kok.hidden = true;
    eski.gizle();
  }
  if (!kurulan.has(ad)) {
    const tanim = SAYFALAR.find((s) => s[0] === ad);
    const sayfa = tanim[2]({ git });
    kurulan.set(ad, sayfa);
    icerik.append(sayfa.kok);
  }
  const sayfa = kurulan.get(ad);
  sayfa.kok.hidden = false;
  simdiki = ad;
  sayfa.goster(arg);
  rayCiz();
}

function rayCiz() {
  const t = depo.t;
  doldur(
    document.getElementById('ray'),
    SAYFALAR.map(([ad, simge]) =>
      h('button', { type: 'button', class: 'rayDugme' + (simdiki === ad ? ' secili' : ''), onclick: () => git(ad), 'aria-current': simdiki === ad ? 'page' : null }, ikon(simge, 20), h('span', null, t('gez.' + ad)))
    )
  );
}

function ustCiz() {
  const t = depo.t;
  const s = depo.sirket;
  const canli = depo.canli.ajanlar;
  const n = canli.length;
  let durum = 'kapali';
  let yazi = t('ust.kapali');
  if (depo.bilgi.sunucuHata) {
    durum = 'hata';
    yazi = t('ust.sunucuHata');
  } else if (depo.oturum.acik) {
    const proje = depo.oturum.projeAd || '';
    const o = depo.canli.oturumlar.find((x) => x.id === depo.oturum.oturumId);
    durum = o && o.olayGeldi ? 'canli' : 'bekle';
    yazi = (o && o.olayGeldi ? t('ust.canli', { x: n }) : t('ust.acik')) + (proje ? ' · ' + proje : '');
  } else if (n) {
    durum = 'canli';
    yazi = t('ust.canli', { x: n });
  }
  const cal = canli.filter((a) => a.durum === 'calisiyor' || a.durum === 'arastiriyor').length;
  const bos = canli.filter((a) => a.durum === 'bosta').length;
  const onay = canli.filter((a) => a.durum === 'onay').length;
  const hata = canli.filter((a) => a.durum === 'hata').length;
  const ust = document.getElementById('ust');
  ust.classList.toggle('duz', !api.mac);
  doldur(
    ust,
    h('div', { class: 'marka' }, h('span', { class: 'markaIsaret', 'aria-hidden': 'true' }), h('span', null, s.ad)),
    h('div', { class: 'baglanti', 'data-durum': durum }, h('span', { class: 'lamba' }), h('span', null, yazi)),
    h('div', { class: 'bosluk' }),
    n
      ? h(
          'div',
          { class: 'sayaclar' },
          [
            h('div', { class: 'sayac' }, h('b', null, cal), t('ust.calisiyor')),
            h('div', { class: 'sayac' }, h('b', null, bos), t('ust.bosta')),
            onay ? h('div', { class: 'sayac uyari' }, h('b', null, onay), t('ust.onay')) : null,
            hata ? h('div', { class: 'sayac uyari' }, h('b', null, hata), t('ust.hata')) : null,
          ].filter(Boolean)
        )
      : null
  );
}

// Açılış ekranı: motorlar aranırken görünür, en az kısa bir an kalır ki göz kırpar gibi kaybolmasın
const acilisBas = Date.now();
// açılış yazısı şirket yüklenmeden gösterilir: dil sistemden seçilir
{
  const alt = document.getElementById('acilisAlt');
  if (alt) alt.textContent = (navigator.language || '').toLowerCase().startsWith('tr') ? 'Claude ve OpenAI aranıyor…' : 'Looking for Claude and OpenAI…';
}
async function acilisKapat() {
  const el = document.getElementById('acilis');
  if (!el) return;
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
  const sinir = Date.now() + 4000;
  while (!depo.bilgi.motorlar && Date.now() < sinir) await bekle(120);
  await bekle(Math.max(0, 900 - (Date.now() - acilisBas)));
  el.classList.add('bitti');
  setTimeout(() => el.remove(), 600);
}

async function basla() {
  await yukle();
  acilisKapat();
  dinle('sirket', () => {
    ustCiz();
    rayCiz();
    document.title = depo.sirket.ad;
  });
  dinle('canli', ustCiz);
  dinle('oturum', ustCiz);
  dinle('bilgi', ustCiz);
  document.title = depo.sirket.ad;
  ustCiz();
  git('ofis');
  // güncelleme rozeti üst çubuğun sağında durur; ustCiz her seferinde çubuğu yeniden çizdiği için ayrı bir kapta tutulur
  const guncelKap = document.createElement('div');
  guncelKap.className = 'guncelKap';
  document.body.append(guncelKap);
  guncellemeKur({ api, depo, ustRozetKap: guncelKap });
  cevrimdisiKur({ api, depo, bildir });
  if (!depo.sirket.kurulumBitti) {
    document.body.append(kurulum({ bitti: () => git('ofis') }));
  }
}

basla();
