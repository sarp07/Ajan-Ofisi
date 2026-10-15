// Projeler sayfası: her projenin klasörü, alan adları, bağlı hesapları, test bilgisi ve kayıt defteri.
import { h, doldur, ikon, alan, anahtar, cipGirisi, kopyala } from '../dom.js';
import { depo, api, dinle, bildir, hataMetni, gorunumSec } from '../depo.js';
import { sehirKur, KAT_RENK } from '../sehir.js';
import { katKurAc } from '../katKur.js';

export const PLATFORMLAR = ['appledev', 'apple', 'playconsole', 'github', 'vercel', 'cloudflare', 'supabase', 'firebase', 'expo', 'google', 'gmail', 'telegram', 'instagram', 'x', 'tiktok', 'youtube', 'linkedin', 'facebook', 'discord', 'diger'];
export const PLATFORM_ADI = { appledev: 'Apple Developer', apple: 'App Store Connect', playconsole: 'Google Play Console', github: 'GitHub', vercel: 'Vercel', cloudflare: 'Cloudflare', supabase: 'Supabase', firebase: 'Firebase', expo: 'Expo', google: 'Google', gmail: 'Gmail', telegram: 'Telegram', instagram: 'Instagram', x: 'X', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', facebook: 'Facebook', discord: 'Discord' };

const CATI_ADI = { next: 'Next.js', vite: 'Vite', expo: 'Expo', astro: 'Astro', nuxt: 'Nuxt', remix: 'Remix', nest: 'NestJS', 'react-native': 'React Native', node: 'Node', python: 'Python', go: 'Go' };

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
  const seciliDepo = new Map(); // çok depolu katta Git panelinde açık depo
  let sonSekme = 'genel'; // panelde en son açılan sekme
  const seciliBirim = new Map(); // proje kimliği -> env panelinde açık birim

  async function repoYukle(id) {
    const r = await api.githubRepo(id, seciliDepo.get(id) || '');
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

  // ---------- ada şehir (harita) ----------
  // Kule projelerin katlarından oluşur. Liste görünümü eski kartlardır; seçim bu bilgisayarda hatırlanır.
  let liste = (() => {
    try {
      return localStorage.getItem('projeler.gorunum') === 'liste';
    } catch {
      return false;
    }
  })();
  const sehirKap = h('div', { class: 'sehirKap' });
  const sehirHud = h('div', { class: 'sehirHud' });
  const sehirAraclar = h('div', { class: 'sehirAraclar' });
  const sehirAkis = h('ol', { class: 'sehirAkis' });
  const sehirYan = h('aside', { class: 'sehirYan' });
  const sehirAlan = h('div', { class: 'sehirAlan' }, h('div', { class: 'sehirSahne' }, sehirKap, sehirHud, sehirAraclar, sehirAkis, h('div', { class: 'sehirIpucu' })), sehirYan);
  let sehir = null;
  let haritaSecili = null;
  let saatBilgi = { evre: 'gunduz', saat: '' };
  const calisma = new Map(); // kat -> son araç zamanı
  const hataBitis = new Map(); // kat -> hatanın gösterileceği son an
  const bitti = new Map(); // kat -> "bitti" balonunun son anı
  const envEksik = new Map();
  const ofisKatlari = () => depo.sirket.projeler.filter((p) => p.tur !== 'kisisel');
  function katDurumu(p) {
    const o = depo.oturumlar[p.id] || {};
    if ((hataBitis.get(p.id) || 0) > Date.now()) return 'hata';
    if (o.bekleyen) return 'onay';
    if (o.acik && Date.now() - (calisma.get(p.id) || 0) < 20000) return 'calisiyor';
    if (o.acik) return 'acik';
    return 'bosta';
  }
  function sehirVeri() {
    if (!sehir) return;
    const katlar = ofisKatlari().map((p) => {
      const d = ozetler.get(p.id);
      return { id: p.id, ad: p.ad, durum: katDurumu(p), ekip: [p.sef.ad, ...p.ajanlar.map((a) => a.ad)], sv: Math.min(99, 1 + Math.floor(((d && d.kayitSayisi) || 0) / 40)), baloncuk: (bitti.get(p.id) || 0) > Date.now() ? '✅' : null };
    });
    if (!haritaSecili || !katlar.some((k) => k.id === haritaSecili)) haritaSecili = (katlar.find((k) => k.id === depo.sirket.sonProje) || katlar[katlar.length - 1] || {}).id || null;
    sehir.veriKoy(katlar, haritaSecili);
  }
  function sehirKurulum() {
    if (sehir) return;
    sehir = sehirKur(sehirKap, {
      t: (k, a) => depo.t(k, a),
      katSec: (id) => {
        haritaSecili = id;
        sehirYanCiz();
      },
      kataGir: (id) => kataGir(id),
      katKur: () => katKurAc({ bitti: () => yenile() }),
      kisisel: () => git('kisisel'),
      servisler: () => git('servisler'),
      saat: (evre, saat) => {
        saatBilgi = { evre, saat };
        sehirHudCiz();
      },
    });
    api.beyinOlayDinle((e) => {
      if (!e || !e.katId) return;
      const p = depo.sirket.projeler.find((x) => x.id === e.katId);
      if (!p || p.tur === 'kisisel') return;
      if (e.tur === 'arac' || e.tur === 'istek') calisma.set(p.id, Date.now());
      if (e.tur === 'istek') sehir.asansor(p.id);
      if (e.tur === 'hata') hataBitis.set(p.id, Date.now() + 60000);
      if (e.tur === 'bitti') {
        calisma.delete(p.id);
        bitti.set(p.id, Date.now() + 6000);
      }
      if (['istek', 'bitti', 'onay', 'hata', 'ani'].includes(e.tur)) sehirAkisEkle(p, e);
      sehirVeri();
    });
    setInterval(() => !kok.hidden && !liste && sehirVeri(), 3000);
  }
  async function kataGir(id) {
    await api.sirketGuncelle({ sonProje: id });
    depo.sirket.sonProje = id;
    gorunumSec('kat');
    git('ofis', undefined, true);
  }
  function sehirHudCiz() {
    const t = depo.t;
    const katlar = ofisKatlari();
    const kisi = katlar.reduce((n, p) => n + 1 + p.ajanlar.length, 0);
    const ozet = katlar.map((p) => ozetler.get(p.id)).filter(Boolean);
    const gorev = ozet.reduce((n, d) => n + ((d.acikGorevler && d.acikGorevler.length) || 0), 0);
    const onay = katlar.reduce((n, p) => n + ((depo.oturumlar[p.id] || {}).bekleyen || 0), 0);
    const calisan = katlar.filter((p) => (depo.oturumlar[p.id] || {}).acik).length;
    doldur(
      sehirHud,
      h('div', { class: 'sehirKart' }, h('h1', null, t('sehir.kule', { x: depo.sirket.ad })), h('p', null, t('sehir.ozet', { k: katlar.length, x: kisi }))),
      h('div', { class: 'sehirKart sehirGun' }, h('div', null, h('b', null, String(calisan)), h('span', null, t('sehir.acikKat'))), h('div', null, h('b', null, String(gorev)), h('span', null, t('sehir.acikGorev'))), h('div', { class: onay ? 'uyari' : '' }, h('b', null, String(onay)), h('span', null, t('sehir.onay'))), h('div', null, h('b', null, saatBilgi.saat || '--:--'), h('span', null, t('sehir.evre.' + saatBilgi.evre))))
    );
    doldur(
      sehirAraclar,
      h('button', { type: 'button', class: 'dugme', onclick: () => sehir && sehir.geceGunduz() }, '☾ ', t('sehir.geceGunduz')),
      h('button', { type: 'button', class: 'dugme', onclick: () => gorunumDegis(true) }, ikon('proje', 14), t('sehir.liste')),
      h('button', { type: 'button', class: 'dugme ana', onclick: () => katKurAc({ bitti: () => yenile() }) }, ikon('arti', 14), t('kat.kur'))
    );
  }
  function sehirAkisEkle(p, e) {
    const i = ofisKatlari().findIndex((x) => x.id === p.id);
    const ikonu = { istek: '📨', bitti: '✅', onay: '✋', hata: '❌', ani: '✨' }[e.tur];
    const li = h('li', { class: 'beyinOlay', style: `--r:${KAT_RENK[i % KAT_RENK.length]}` }, h('span', null, ikonu), h('span', null, depo.t('sehir.olay.' + e.tur, { x: p.ad })));
    sehirAkis.prepend(li);
    while (sehirAkis.children.length > 4) sehirAkis.lastChild.remove();
    [...sehirAkis.children].forEach((c, k) => (c.style.opacity = String(1 - k * 0.22)));
  }
  // sağ panel: seçili kat (oyun kartı gibi)
  function sehirYanCiz() {
    const t = depo.t;
    const katlar = ofisKatlari();
    const p = katlar.find((x) => x.id === haritaSecili);
    if (!p) {
      doldur(sehirYan, h('div', { class: 'sehirBos' }, h('h2', null, t('sehir.bosBaslik')), h('p', null, t('sehir.bosAciklama', { x: depo.sirket.beyin.ad })), h('button', { type: 'button', class: 'dugme ana', onclick: () => katKurAc({ bitti: () => yenile() }) }, ikon('arti', 14), t('kat.kur'))));
      return;
    }
    const i = katlar.indexOf(p);
    const renk = KAT_RENK[i % KAT_RENK.length];
    const durum = katDurumu(p);
    const d = ozetler.get(p.id);
    const r = repolar.get(p.id);
    const son = d && d.istekler.length ? d.istekler[d.istekler.length - 1] : null;
    const gorevler = (d && d.acikGorevler) || [];
    const eksik = envEksik.get(p.id);
    if (eksik === undefined) {
      envEksik.set(p.id, null);
      api.ortamDurum(p.id).then((x) => {
        envEksik.set(p.id, x && x.birimler ? x.birimler.reduce((n, b) => n + b.degiskenler.filter((v) => v.durum === 'eksik').length, 0) : null);
        if (haritaSecili === p.id) sehirYanCiz();
      });
    }
    const sv = Math.min(99, 1 + Math.floor(((d && d.kayitSayisi) || 0) / 40));
    doldur(
      sehirYan,
      h(
        'div',
        { class: 'sehirYanBas', style: `--r:${renk}` },
        h('div', { class: 'sehirKatNo' }, t('sehir.katNo', { x: i + 1 }), h('span', { class: 'sehirSv' }, t('sehir.sv', { x: sv }))),
        h('h2', null, p.ad, h('span', { class: 'sehirDurum', 'data-d': durum }, t('sehir.durum.' + durum))),
        p.aciklama ? h('p', null, p.aciklama) : h('code', null, kisaYol(p.klasor || ''))
      ),
      h(
        'div',
        { class: 'sehirYanGovde' },
        h(
          'section',
          null,
          h('h3', null, t('sehir.durumBaslik')),
          r && r.depo ? h('div', { class: 'sehirSatir' }, ikon('dal', 13), h('b', null, r.dal || '-'), h('span', null, r.degisen ? t('github.degisen', { x: r.degisen }) : t('github.temiz'))) : null,
          h('div', { class: 'sehirSatir' }, ikon('kasa', 13), eksik ? h('b', { class: 'kotuYazi' }, t('ortam.eksikSayi', { x: eksik })) : eksik === 0 ? h('b', null, t('ortam.tamam')) : h('span', null, '…')),
          p.portBlok ? h('div', { class: 'sehirSatir' }, ikon('sunucu', 13), h('span', null, t('sehir.portlar')), h('b', null, `${4000 + p.portBlok * 100}–${4000 + p.portBlok * 100 + 99}`)) : null,
          d && d.sonZaman ? h('div', { class: 'sehirSatir' }, ikon('saat', 13), h('span', null, t('proje.kaldi', { x: neZaman(d.sonZaman, t) }))) : null
        ),
        h(
          'section',
          null,
          h('h3', null, t('sehir.gorevler', { x: gorevler.length })),
          gorevler.length ? gorevler.slice(0, 6).map((g) => h('div', { class: 'sehirGorev' }, h('span', { class: 'kutucuk' }), h('span', null, g.metin || String(g)), g.kim ? h('small', null, g.kim) : null)) : h('p', { class: 'sehirSoluk' }, t('sehir.gorevYok'))
        ),
        h('section', null, h('h3', null, t('sehir.ekip', { x: p.ajanlar.length + 1 })), h('div', { class: 'sehirEkip' }, [p.sef, ...p.ajanlar].map((a, k) => h('span', { class: 'sehirUye' + (k === 0 ? ' sef' : '') }, h('span', { style: `background:${a.renk || renk}` }, (a.ad || '?')[0]), a.ad)))),
        son ? h('section', null, h('h3', null, t('sehir.sonIs')), h('div', { class: 'sehirSon' }, son.istek)) : null
      ),
      h('div', { class: 'sehirYanAlt' }, h('button', { type: 'button', class: 'dugme', onclick: () => ac(p) }, ikon('ayar', 14), t('sehir.ayarlar')), h('button', { type: 'button', class: 'dugme ana', onclick: () => kataGir(p.id) }, ikon('ileriOk', 14), t('sehir.kataGir')))
    );
  }
  function gorunumDegis(listeMi) {
    liste = listeMi;
    try {
      localStorage.setItem('projeler.gorunum', liste ? 'liste' : 'harita');
    } catch {
      /* depolama kapalı */
    }
    if (liste && sehir) sehir.gizle();
    ciz();
  }

  function ciz() {
    const t = depo.t;
    const s = depo.sirket;
    kok.classList.toggle('haritaModu', !liste);
    if (!liste) {
      sehirKurulum();
      if (!kok.contains(sehirAlan)) doldur(kok, sehirAlan, perde, cekmece);
      sehirVeri();
      sehirHudCiz();
      sehirYanCiz();
      if (!kok.hidden) sehir.goster();
      return;
    }
    doldur(
      kok,
      h(
        'header',
        { class: 'sayfaBas' },
        h('div', null, h('h1', null, t('proje.baslik')), h('p', null, t('proje.aciklama', { x: s.sef.ad }))),
        h('div', { class: 'satirDugmeler' }, h('button', { type: 'button', class: 'dugme', onclick: () => gorunumDegis(false) }, ikon('ofis', 15), t('sehir.harita')), h('button', { type: 'button', class: 'dugme ana', onclick: () => katKurAc({ bitti: () => yenile() }) }, ikon('arti', 15), t('proje.yeni')))
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

  let kapatmaIsi = null;
  function kapat() {
    if (kapatmaIsi) kapatmaIsi(), (kapatmaIsi = null);
    acik = null;
    cekmece.hidden = true;
    perde.hidden = true;
    ciz();
  }

  // ---------- git ----------
  // Çok depolu kat: ana klasör ve ek depolar (api, web, admin ayrı repolar). Ekleme ve çıkarma hemen kaydedilir;
  // taslaktaki liste de güncellenir ki "Kaydet" eski listeyi geri yazmasın.
  function depolarBolumu(taslak) {
    const t = depo.t;
    const kap = h('section', { class: 'formBolum' });
    taslak.depolar = taslak.depolar || [];
    let calisiyor = false;
    const ciz = () => {
      const repoGiris = h('input', { type: 'text', placeholder: t('depo.repoOrnek'), maxlength: '120' });
      const ekle = async (kaynak) => {
        calisiyor = true;
        ciz();
        const r = await api.depoEkle(taslak.id, kaynak);
        calisiyor = false;
        if (r && r.tamam) {
          taslak.depolar = r.depolar.filter((d) => d.id !== 'ana');
          seciliDepo.delete(taslak.id);
          await repoYukle(taslak.id);
          bildir(t('depo.eklendi'));
        } else if (r && !r.iptal) bildir((r && r.ayrinti) || hataMetni(r), true);
        ciz();
      };
      doldur(
        kap,
        h('h3', null, t('depo.baslik')),
        h('p', { class: 'alanIpucu' }, t('depo.ipucu')),
        h(
          'ol',
          { class: 'ghListe' },
          h('li', { class: 'ghDal simdiki' }, h('code', null, taslak.klasor.split(/[\\/]/).pop()), h('span', { class: 'ghEtiketler' }, h('span', { class: 'ghEtiket iyi' }, t('depo.ana')), h('span', { class: 'alanIpucu' }, taslak.klasor)), h('span')),
          taslak.depolar.map((d) =>
            h(
              'li',
              { class: 'ghDal' },
              h('code', null, d.ad),
              h('span', { class: 'ghEtiketler' }, h('span', { class: 'alanIpucu' }, d.klasor)),
              h('button', {
                type: 'button',
                class: 'simge',
                'aria-label': t('genel.kaldir'),
                title: t('depo.cikar'),
                onclick: async () => {
                  await api.depoCikar(taslak.id, d.id);
                  taslak.depolar = taslak.depolar.filter((x) => x.id !== d.id);
                  seciliDepo.delete(taslak.id);
                  ciz();
                },
              }, ikon('kapat', 15))
            )
          )
        ),
        h(
          'div',
          { class: 'satirDugme' },
          h('button', { type: 'button', class: 'dugme kucuk', disabled: calisiyor, onclick: () => ekle(null) }, calisiyor ? h('span', { class: 'donen' }) : ikon('klasor', 13), t('depo.klasorEkle')),
          (depo.bilgi.github || {}).girisli ? h('span', { class: 'gitCommit' }, repoGiris, h('button', { type: 'button', class: 'dugme kucuk', disabled: calisiyor, onclick: () => (repoGiris.value.trim() ? ekle({ repo: repoGiris.value.trim() }) : repoGiris.focus()) }, ikon('indir', 13), t('depo.klonla'))) : null
        )
      );
    };
    ciz();
    return kap;
  }

  // GitHub yönetimi: dallar (sil, birleştir), PR'lar (aç, birleştir, kapat), depo (gizli/açık, arşiv, ad, sil).
  // Tehlikeli düğmeler önce "emin misin" durumuna geçer; depo silmek için deponun tam adı yazılır.
  function githubYonetimi(projeId, r, yenile, depoAdi = '') {
    const t = depo.t;
    const kap = h('div', { class: 'ghYonetim' });
    let dallar = null;
    let depoB = null;
    let emin = ''; // onay bekleyen düğmenin anahtarı
    let calisan = '';
    let prAcik = false;
    let silAcik = false;
    const yap = async (anahtar, islem, secenek, basari) => {
      calisan = anahtar;
      emin = '';
      ciz();
      const s = await api.githubIslem(projeId, islem, { ...secenek, depo: depoAdi });
      calisan = '';
      if (!s || s.hata) bildir((s && s.ayrinti) || hataMetni(s), true);
      else bildir(basari || t('github.tamam'));
      await yukle();
      await yenile();
    };
    const tehlikeli = (anahtar, yazi, eminYazi, fn, sinif = '') =>
      h('button', { type: 'button', class: 'dugme kucuk ' + sinif + (emin === anahtar ? ' tehlike' : ''), disabled: !!calisan, onclick: () => (emin === anahtar ? fn() : ((emin = anahtar), ciz())) }, calisan === anahtar ? h('span', { class: 'donen' }) : null, emin === anahtar ? eminYazi : yazi);
    async function yukle() {
      const d = await api.githubDallar(projeId, depoAdi);
      dallar = d && d.tamam ? d.dallar : [];
      if (r.githubAdres && (depo.bilgi.github || {}).girisli) {
        const b = await api.githubIslem(projeId, 'depoBilgi', { depo: depoAdi });
        depoB = b && b.tamam ? b.sonuc : null;
      }
      ciz();
    }
    function ciz() {
      const girisli = (depo.bilgi.github || {}).girisli && r.githubAdres;
      const dalSatir = (d) =>
        h(
          'li',
          { class: 'ghDal' + (d.simdiki ? ' simdiki' : '') },
          h('code', null, d.ad),
          h('span', { class: 'ghEtiketler' }, d.simdiki ? h('span', { class: 'ghEtiket iyi' }, t('github.dalSimdiki')) : null, d.korunan ? h('span', { class: 'ghEtiket' }, t('github.dalKorunan')) : null, d.birlesti ? h('span', { class: 'ghEtiket' }, t('github.dalBirlesti')) : null, d.uzakta ? h('span', { class: 'ghEtiket' }, 'GitHub') : null, h('span', { class: 'alanIpucu' }, d.zaman)),
          d.simdiki || d.korunan
            ? null
            : h(
                'span',
                { class: 'satirDugme' },
                tehlikeli('b:' + d.ad, t('github.birlestir'), t('github.birlestirEmin', { x: r.dal }), () => yap('b:' + d.ad, 'dalBirlestir', { dal: d.ad }, t('github.birlesti', { x: d.ad, y: r.dal }))),
                tehlikeli('s:' + d.ad, t('github.sil'), d.birlesti ? t('github.silEmin') : t('github.silZorla'), () => yap('s:' + d.ad, 'dalSil', { dal: d.ad, uzak: d.uzakta, zorla: !d.birlesti }, t('github.silindi', { x: d.ad })), 'cizgili')
              )
        );
      const prSatir = (p) =>
        h(
          'li',
          { class: 'ghDal' },
          h('a', { href: p.adres, target: '_blank', rel: 'noreferrer' }, `#${p.no} ${p.baslik}`),
          h('span', { class: 'ghEtiketler' }, p.taslak ? h('span', { class: 'ghEtiket' }, t('github.taslak')) : null, h('code', null, p.dal)),
          h(
            'span',
            { class: 'satirDugme' },
            tehlikeli('pb:' + p.no, t('github.birlestir'), t('github.prBirlestirEmin'), () => yap('pb:' + p.no, 'prBirlestir', { no: p.no, yontem: 'squash' }, t('github.prBirlesti', { x: p.no }))),
            tehlikeli('pk:' + p.no, t('github.kapat'), t('github.kapatEmin'), () => yap('pk:' + p.no, 'prKapat', { no: p.no }, t('github.prKapandi', { x: p.no })), 'cizgili')
          )
        );
      const prForm = () => {
        const baslik = h('input', { type: 'text', placeholder: t('github.prBaslik'), maxlength: '200' });
        const govde = h('textarea', { rows: '3', placeholder: t('github.prGovde'), maxlength: '4000' });
        setTimeout(() => baslik.focus(), 0);
        return h('div', { class: 'ghForm' }, baslik, govde, h('div', { class: 'satirDugme' }, h('button', { type: 'button', class: 'dugme ana', disabled: !!calisan, onclick: () => (baslik.value.trim() ? ((prAcik = false), yap('prAc', 'prAc', { baslik: baslik.value.trim(), govde: govde.value }, t('github.prAcildi'))) : baslik.focus()) }, t('github.prAc')), h('button', { type: 'button', class: 'dugme', onclick: () => ((prAcik = false), ciz()) }, t('genel.vazgec'))));
      };
      const depoBolumu = () => {
        if (!depoB) return null;
        const gizli = depoB.gorunurluk !== 'PUBLIC';
        const adGiris = h('input', { type: 'text', placeholder: depoB.ad.split('/')[1], maxlength: '100' });
        const silGiris = h('input', { type: 'text', placeholder: depoB.ad, maxlength: '140' });
        return h(
          'div',
          { class: 'ghDepo' },
          h('span', { class: 'alanEtiket' }, t('github.depo')),
          h('p', { class: 'alanIpucu' }, `${depoB.ad} · ${gizli ? t('github.gizli') : t('github.acik')}${depoB.arsiv ? ' · ' + t('github.arsivde') : ''}`),
          h(
            'div',
            { class: 'satirDugme' },
            tehlikeli('gor', gizli ? t('github.acikYap') : t('github.gizliYap'), t('github.gorunurlukEmin'), () => yap('gor', 'depoGorunurluk', { gorunurluk: gizli ? 'public' : 'private' })),
            tehlikeli('ars', depoB.arsiv ? t('github.arsivdenCikar') : t('github.arsivle'), t('github.arsivEmin'), () => yap('ars', 'depoArsivle', { geriAl: depoB.arsiv })),
            h('button', { type: 'button', class: 'dugme kucuk cizgili', onclick: () => ((silAcik = !silAcik), ciz()) }, t('github.depoSil'))
          ),
          h('div', { class: 'gitCommit' }, adGiris, h('button', { type: 'button', class: 'dugme', disabled: !!calisan, onclick: () => (adGiris.value.trim() ? yap('ad', 'depoAdDegistir', { ad: adGiris.value.trim() }, t('github.adDegisti')) : adGiris.focus()) }, t('github.adDegistir'))),
          silAcik ? h('div', { class: 'ghForm tehlikeKutu' }, h('p', { class: 'alanIpucu' }, t('github.silUyari', { x: depoB.ad })), h('div', { class: 'gitCommit' }, silGiris, h('button', { type: 'button', class: 'dugme tehlike', disabled: !!calisan, onclick: () => yap('depoSil', 'depoSil', { onayAdi: silGiris.value.trim() }, t('github.depoSilindi')) }, t('github.depoSilOnay')))) : null
        );
      };
      doldur(
        kap,
        dallar === null
          ? h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('github.okunuyor'))
          : [
              h('span', { class: 'alanEtiket' }, t('github.dallar')),
              h('ol', { class: 'ghListe' }, dallar.map(dalSatir)),
              girisli ? h('span', { class: 'alanEtiket' }, t('github.prler')) : null,
              girisli && r.prler && r.prler.length ? h('ol', { class: 'ghListe' }, r.prler.map(prSatir)) : null,
              girisli ? (prAcik ? prForm() : h('div', { class: 'satirDugme' }, h('button', { type: 'button', class: 'dugme kucuk', onclick: () => ((prAcik = true), ciz()) }, ikon('arti', 13), t('github.prAc')))) : null,
              girisli ? depoBolumu() : null,
            ]
      );
    }
    yukle();
    return kap;
  }

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
      const r = await api.gitIslem(projeId, ad, deger, seciliDepo.get(projeId) || '');
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
      // çok depolu katta depo sekmeleri (api, web, admin...)
      const sekmeler =
        r && r.depolar && r.depolar.length > 1
          ? h(
              'div',
              { class: 'bolmeli depoSekme', role: 'tablist' },
              r.depolar.map((d) =>
                h(
                  'button',
                  {
                    type: 'button',
                    role: 'tab',
                    class: (seciliDepo.get(projeId) || 'ana') === d.id ? 'secili' : '',
                    title: d.klasor,
                    onclick: async () => {
                      seciliDepo.set(projeId, d.id === 'ana' ? '' : d.id);
                      await repoYukle(projeId);
                      ciz_();
                    },
                  },
                  ikon('dal', 12),
                  d.ad
                )
              )
            )
          : null;
      if (!r || !r.depo) return doldur(kap, h('h3', { lang: 'en' }, 'Git'), sekmeler, h('p', { class: 'alanIpucu' }, t('github.depoDegil')));
      const dallar = await api.gitIslem(projeId, 'dallar', '', seciliDepo.get(projeId) || '');
      const liste = dallar && dallar.tamam ? dallar.sonuc : [r.dal];
      const dalSec = h('select', { disabled: !!calisiyor, onchange: () => islem('dalDegistir', dalSec.value, t('github.dalDegisti', { x: dalSec.value })) }, liste.map((d) => h('option', { value: d }, d)));
      dalSec.value = r.dal;
      const mesajGiris = h('input', { type: 'text', value: mesaj, placeholder: t('github.mesaj'), maxlength: '200', oninput: () => (mesaj = mesajGiris.value) });
      const dugme = (ad, ikonAd, metin, onclick, ana) => h('button', { type: 'button', class: 'dugme' + (ana ? ' ana' : ''), disabled: !!calisiyor, onclick }, calisiyor === ad ? h('span', { class: 'donen' }) : ikon(ikonAd, 14), metin);
      const durum = [r.degisen ? t('github.degisen', { x: r.degisen }) : t('github.temiz'), r.ileride ? t('github.ileride', { x: r.ileride }) : null, r.geride ? t('github.geride', { x: r.geride }) : null].filter(Boolean).join(' · ');
      doldur(
        kap,
        h('h3', { lang: 'en' }, 'Git'),
        sekmeler,
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
        githubYonetimi(projeId, r, async () => (await repoYukle(projeId), ciz_()), seciliDepo.get(projeId) || '')
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

  // ---------- ortam değişkenleri (env) ----------
  // Birimler: her repo kökü ve monorepo paketi. Değerler şifreli depoda; gizli olanlar yalnızca göz simgesiyle açılır.
  // Değişiklik hemen kaydedilir, dosyalara yazma ayrı bir adımdır (veritabanı ve port bağları o an çözülür).
  function ortamBolumu(projeId, rozetGuncelle) {
    const t = depo.t;
    const kap = h('section', { class: 'ortamKap' }, h('p', { class: 'durumSatir' }, h('span', { class: 'donen' }), t('ortam.okunuyor')));
    let d = null;
    let yazilmadi = false;
    let topluAcik = false;
    const DURUM_SIRA = { eksik: 0, dosyada: 1, ornek: 2, otomatik: 3, genel: 4, kayitli: 5 };

    const yukle = async () => {
      const r = await api.ortamDurum(projeId);
      if (!r || r.hata) return doldur(kap, h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 14), (r && r.ayrinti) || hataMetni(r)));
      d = r;
      ciz();
    };
    const eksikSay = (b) => b.degiskenler.filter((x) => x.durum === 'eksik').length;
    const degisti = () => {
      yazilmadi = true;
      yukle();
    };

    const yazDugme = (profil) =>
      h(
        'button',
        {
          type: 'button',
          class: 'dugme kucuk' + (profil === 'gelistirme' ? ' ana' : ''),
          onclick: async (e) => {
            const b = e.currentTarget;
            b.disabled = true;
            const r = await api.ortamYaz(projeId, profil);
            b.disabled = false;
            if (!r || r.hata) return bildir((r && r.ayrinti) || hataMetni(r), true);
            yazilmadi = false;
            const yazilan = r.rapor.filter((x) => x.dosya);
            const hatali = r.rapor.filter((x) => x.hata);
            if (hatali.length) bildir(hatali.map((x) => `${x.birim}: ${x.hata}`).join(' · '), true);
            else bildir(yazilan.length ? t('ortam.yazildi', { x: yazilan.map((x) => x.dosya).join(', ') }) : t('ortam.yazilacakYok'));
            yukle();
          },
        },
        ikon(profil === 'test' ? 'kosu' : 'indir', 14),
        t(profil === 'test' ? 'ortam.testYaz' : 'ortam.dosyalaraYaz')
      );

    function satir(birimId, v, genelMi) {
      const giris = h('input', {
        type: v.gizli ? 'password' : 'text',
        class: 'mono',
        value: v.durum === 'kayitli' || (genelMi && v.durum !== 'eksik') ? (v.gizli ? '' : v.gorunen) : '',
        placeholder: v.gizli && (v.durum === 'kayitli' || genelMi) ? '••••••••••' : v.durum === 'otomatik' || v.durum === 'ornek' || v.durum === 'genel' ? v.gorunen : v.durum === 'dosyada' ? t('ortam.dosyadaYer') : t('ortam.degerYok'),
        autocomplete: 'off',
        spellcheck: false,
        'aria-label': v.anahtar,
        onchange: async () => {
          const deger = giris.value;
          if (!deger && v.gizli && v.durum === 'kayitli') return; // boş bırakılan gizli alan değeri silmez
          await api.ortamKoy(projeId, birimId, v.anahtar, deger === '' ? null : { deger });
          degisti();
        },
        onfocus: () => (sonGiris = giris),
      });
      let acikGoz = false;
      const goz = v.gizli && (v.durum === 'kayitli' || genelMi)
        ? h('button', {
            type: 'button',
            class: 'simge kucuk',
            title: t('ortam.goster'),
            onclick: async () => {
              acikGoz = !acikGoz;
              if (acikGoz) {
                const r = await api.ortamGoster(projeId, birimId, v.anahtar);
                giris.type = 'text';
                giris.value = (r && r.deger) || '';
              } else {
                giris.type = 'password';
                giris.value = '';
              }
            },
          }, ikon('goz', 14))
        : null;
      const testAcik = v.testFarkli;
      const testGiris = h('input', {
        type: v.gizli ? 'password' : 'text',
        class: 'mono',
        placeholder: t('ortam.testYer'),
        autocomplete: 'off',
        onchange: async () => {
          await api.ortamKoy(projeId, birimId, v.anahtar, { test: testGiris.value });
          degisti();
        },
      });
      const testKap = h('div', { class: 'ortamTest', hidden: !testAcik }, h('span', { class: 'ortamTestEtiket' }, '.env.test'), testGiris);
      const durumAdi = { kayitli: t('ortam.dKayitli'), genel: t('ortam.dGenel'), otomatik: t('ortam.dOtomatik'), ornek: t('ortam.dOrnek'), dosyada: t('ortam.dDosyada'), eksik: t('ortam.dEksik') }[v.durum] || '';
      return h(
        'div',
        { class: 'ortamSatir', 'data-d': v.durum },
        h('div', { class: 'ortamAnahtar' }, h('code', null, v.anahtar), v.aciklama ? h('span', { class: 'ortamNot', title: v.aciklama }, v.aciklama) : null),
        h('div', { class: 'ortamDeger' }, h('div', { class: 'ortamGiris' }, giris, goz), testKap),
        h('span', { class: 'ortamRozet', 'data-d': v.durum }, durumAdi),
        h(
          'div',
          { class: 'ortamIslem' },
          h('button', {
            type: 'button',
            class: 'simge kucuk' + (v.gizli ? ' secili' : ''),
            title: t(v.gizli ? 'ortam.gizliKapat' : 'ortam.gizliYap'),
            'aria-pressed': String(!!v.gizli),
            onclick: async () => {
              await api.ortamKoy(projeId, birimId, v.anahtar, { gizli: !v.gizli, ...(v.durum === 'kayitli' || genelMi ? {} : { deger: '' }) });
              degisti();
            },
          }, ikon('kasa', 14)),
          h('button', { type: 'button', class: 'simge kucuk' + (testAcik ? ' secili' : ''), title: t('ortam.testFarkli'), onclick: () => (testKap.hidden = !testKap.hidden, testKap.hidden || testGiris.focus()) }, ikon('kosu', 14)),
          v.durum === 'kayitli' || genelMi
            ? h('button', { type: 'button', class: 'simge kucuk', title: t('genel.kaldir'), onclick: async () => (await api.ortamKoy(projeId, birimId, v.anahtar, null), degisti()) }, ikon('cop', 14))
            : h('span', { class: 'simgeYer' })
        )
      );
    }

    let sonGiris = null;
    function ciz() {
      if (!d) return;
      const birimler = d.birimler;
      const toplam = birimler.reduce((n, b) => n + b.degiskenler.length, 0);
      const eksik = birimler.reduce((n, b) => n + eksikSay(b), 0);
      rozetGuncelle(eksik);
      let secili = seciliBirim.get(projeId);
      if (secili !== 'genel' && !birimler.some((b) => b.id === secili)) secili = birimler.length ? birimler[0].id : 'genel';
      seciliBirim.set(projeId, secili);
      const b = birimler.find((x) => x.id === secili);
      const iceAktarilabilir = birimler.reduce((n, x) => n + x.iceAktarilabilir, 0);

      const birimCip = (id, ad, alt, eks) =>
        h(
          'button',
          { type: 'button', role: 'tab', 'aria-selected': String(secili === id), class: 'birimCip' + (secili === id ? ' secili' : ''), onclick: () => (seciliBirim.set(projeId, id), ciz()) },
          h('span', { class: 'birimAd' }, ad),
          alt ? h('span', { class: 'birimAlt' }, alt) : null,
          eks ? h('span', { class: 'sayiRozet kotu' }, eks) : null
        );

      const yeniAnahtar = h('input', { type: 'text', class: 'mono', placeholder: 'STRIPE_SECRET_KEY', maxlength: '120', autocomplete: 'off', spellcheck: false, oninput: () => (yeniAnahtar.value = yeniAnahtar.value.toUpperCase().replace(/[^A-Z0-9_.-]/g, '_')) });
      const yeniDeger = h('input', { type: 'text', class: 'mono', placeholder: t('ortam.degerYer'), autocomplete: 'off', spellcheck: false, onfocus: () => (sonGiris = yeniDeger) });
      const ekle = async () => {
        const a = yeniAnahtar.value.trim();
        if (!a) return yeniAnahtar.focus();
        const r = await api.ortamKoy(projeId, secili, a, { deger: yeniDeger.value });
        if (!r || r.hata) return bildir(r && r.hata === 'anahtar' ? t('ortam.anahtarHata') : (r && r.ayrinti) || hataMetni(r), true);
        degisti();
      };
      yeniDeger.addEventListener('keydown', (e) => e.key === 'Enter' && ekle());
      yeniAnahtar.addEventListener('keydown', (e) => e.key === 'Enter' && yeniDeger.focus());

      const topluMetin = h('textarea', { class: 'mono', rows: '6', spellcheck: false, placeholder: 'API_URL=https://…\nSTRIPE_SECRET_KEY=sk_live_…' });
      const toplu = h(
        'div',
        { class: 'ortamToplu', hidden: !topluAcik },
        topluMetin,
        h('div', { class: 'satirSag' }, h('span', { class: 'alanIpucu' }, t('ortam.topluIpucu')), h('button', { type: 'button', class: 'dugme kucuk', onclick: async () => {
          const r = await api.ortamYapistir(projeId, secili, topluMetin.value);
          if (!r || r.hata) return bildir((r && r.ayrinti) || hataMetni(r), true);
          bildir(t('ortam.topluEklendi', { x: r.adet }));
          topluAcik = false;
          degisti();
        } }, t('genel.ekle')))
      );

      const bagEkle = (ifade) => {
        const g = sonGiris && sonGiris.isConnected ? sonGiris : yeniDeger;
        const i = g.selectionStart ?? g.value.length;
        g.value = g.value.slice(0, i) + ifade + g.value.slice(g.selectionEnd ?? i);
        g.focus();
        g.dispatchEvent(new Event('input'));
      };
      const portAdlari = Object.keys(d.portlar || {});
      const baglar = ['${db}', ...birimler.map((x) => '${port:' + x.kisa + '}'), ...portAdlari.filter((a) => !birimler.some((x) => x.kisa === a)).map((a) => '${port:' + a + '}')];

      const liste = secili === 'genel'
        ? d.genel.map((v) => satir('genel', { ...v, durum: 'genel' }, true))
        : b.degiskenler.slice().sort((x, y) => DURUM_SIRA[x.durum] - DURUM_SIRA[y.durum] || x.anahtar.localeCompare(y.anahtar)).map((v) => satir(b.id, v, false));

      const dosyaSec = b
        ? (() => {
            const sec = h('select', { 'aria-label': t('ortam.hedefDosya'), onchange: async () => (await api.ortamDosya(projeId, b.id, sec.value === b.varsayilan ? '' : sec.value), degisti()) },
              [...new Set([b.varsayilan, '.env', '.env.local', '.env.development', '.env.development.local', b.dosya].filter(Boolean))].map((f) => h('option', { value: f }, f + (f === b.varsayilan ? ' · ' + t('ortam.onerilen') : ''))));
            sec.value = b.dosya || b.varsayilan;
            return sec;
          })()
        : null;

      doldur(
        kap,
        h(
          'div',
          { class: 'ortamUst' },
          h('div', { class: 'ortamOzet' }, h('b', null, t('ortam.ozet', { b: birimler.length, d: toplam })), eksik ? h('span', { class: 'kotuYazi' }, ikon('ucgen', 13), t('ortam.eksikSayi', { x: eksik })) : h('span', { class: 'iyiYazi' }, ikon('tik', 13), t('ortam.tamam')), yazilmadi ? h('span', { class: 'uyariYazi' }, t('ortam.yazilmadi')) : null),
          h('div', { class: 'ortamDugmeler' },
            iceAktarilabilir ? h('button', { type: 'button', class: 'dugme kucuk', title: t('ortam.iceAktarIpucu'), onclick: async () => {
              const r = await api.ortamIceAktar(projeId);
              if (!r || r.hata) return bildir((r && r.ayrinti) || hataMetni(r), true);
              bildir(t('ortam.iceAktarildi', { x: r.adet }));
              yukle();
            } }, ikon('indir', 14), t('ortam.iceAktar', { x: iceAktarilabilir })) : null,
            yazDugme('test'),
            yazDugme('gelistirme'))
        ),
        d.sifreli ? null : h('p', { class: 'durumSatir kotu' }, ikon('ucgen', 14), t('ortam.sifreYok')),
        h('div', { class: 'birimSerit', role: 'tablist' },
          birimCip('genel', t('ortam.genel'), t('ortam.genelAlt'), 0),
          birimler.map((x) => birimCip(x.id, x.ad, x.cati ? CATI_ADI[x.cati] || x.cati : '', eksikSay(x)))),
        b
          ? h('div', { class: 'birimBilgi' },
              h('span', null, ikon('klasor', 13), h('code', null, b.yol === '.' ? b.depo + '/' : b.depo + '/' + b.yol)),
              b.ornekDosya.length ? h('span', null, ikon('dosya', 13), t('ortam.ornekten', { x: b.ornekDosya.join(', ') })) : h('span', { class: 'sonukYazi' }, t('ortam.ornekYok')),
              h('label', { class: 'birimDosya' }, h('span', null, t('ortam.hedefDosya')), dosyaSec))
          : h('p', { class: 'alanIpucu' }, t('ortam.genelIpucu')),
        h('div', { class: 'ortamTablo' },
          h('div', { class: 'ortamBaslik' }, h('span', null, t('ortam.anahtar')), h('span', null, t('ortam.deger')), h('span', null, t('ortam.durum')), h('span', null)),
          liste.length ? liste : h('p', { class: 'bosNot' }, t(secili === 'genel' ? 'ortam.genelBos' : 'ortam.birimBos')),
          h('div', { class: 'ortamSatir yeni' }, yeniAnahtar, h('div', { class: 'ortamDeger' }, yeniDeger), h('button', { type: 'button', class: 'dugme kucuk', onclick: ekle }, ikon('arti', 14), t('genel.ekle')), h('button', { type: 'button', class: 'simge kucuk', title: t('ortam.toplu'), onclick: () => ((topluAcik = !topluAcik), (toplu.hidden = !topluAcik), topluAcik && topluMetin.focus()) }, ikon('kopya', 14)))
        ),
        toplu,
        h('div', { class: 'bagSerit' }, h('span', { class: 'alanIpucu' }, t('ortam.baglar')), baglar.map((x) => h('button', { type: 'button', class: 'cip sade mono', onmousedown: (e) => e.preventDefault(), onclick: () => bagEkle(x) }, x)))
      );
    }
    yukle();
    const dinleyici = api.ortamDinle((v) => v && v.projeId === projeId && kap.isConnected && yukle());
    return { kap, yukle, birak: () => typeof dinleyici === 'function' && dinleyici() };
  }

  function ac(kayit) {
    const t = depo.t;
    const s = depo.sirket;
    const yeni = !!kayit.yeni;
    const taslak = yeni ? { ad: '', klasor: '', aciklama: '', alanAdlari: [], hesaplar: [], kisiler: [], test: { komut: '', adres: '', sorumlu: '', zorunlu: false }, notlar: '' } : JSON.parse(JSON.stringify(kayit));
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

    // WhatsApp kişileri: beyin onlarla yalnızca bu proje hakkında konuşur, eklenince tanışma mesajı gider
    taslak.kisiler = taslak.kisiler || [];
    // Telegram: kişinin bağlanacağı bot (projenin kendi botu yoksa beynin botu) ve proje botu belirteci
    let tg = null;
    let botTaslak = '';
    api.telegramDurum().then((d) => ((tg = d), kisiCiz(), botCiz()));
    const botKullanici = () => (tg && !yeni && tg.projeler[taslak.id] && tg.projeler[taslak.id].kullanici) || (tg && tg.beyin.kullanici) || '';
    const kisiKap = h('div', { class: 'hesaplar' });
    const kisiCiz = () =>
      doldur(
        kisiKap,
        taslak.kisiler.map((k, i) => {
          const ad = h('input', { type: 'text', value: k.ad, maxlength: '40', placeholder: t('proje.kisiAdOrnek'), 'aria-label': t('proje.kisiAd'), oninput: () => (k.ad = ad.value) });
          k.kanal = k.kanal || 'whatsapp';
          const kanal = h('select', { 'aria-label': t('proje.kisiKanal'), onchange: () => ((k.kanal = kanal.value), kisiCiz()) }, h('option', { value: 'whatsapp' }, 'WhatsApp'), h('option', { value: 'telegram' }, 'Telegram'));
          kanal.value = k.kanal;
          const bot = botKullanici();
          const no =
            k.kanal === 'telegram'
              ? k.kod && bot
                ? h('button', { type: 'button', class: 'dugme kucuk', title: t('proje.kisiLinkIpucu'), onclick: async () => bildir((await kopyala(`https://t.me/${bot}?start=${k.kod}`)) ? t('proje.kisiLinkKopyalandi', { x: k.ad }) : t('genel.kopyala')) }, ikon('kopya', 13), t(k.telegramId ? 'proje.kisiTgBagli' : 'proje.kisiLink'))
                : h('span', { class: 'alanIpucu' }, t(bot ? 'proje.kisiKaydetSonra' : 'proje.kisiBotYok'))
              : h('input', { type: 'tel', value: k.numara, maxlength: '30', placeholder: '+90 5xx xxx xx xx', 'aria-label': t('proje.kisiNumara'), oninput: () => (k.numara = no.value) });
          const rol = h('input', { type: 'text', value: k.rol || '', maxlength: '60', placeholder: t('proje.kisiRolOrnek'), 'aria-label': t('proje.kisiRol'), oninput: () => (k.rol = rol.value) });
          return h(
            'div',
            { class: 'hesapSatir kisiSatir' },
            kanal,
            ad,
            no,
            rol,
            h('span', { class: 'kisiDurum' + (k.tanitildi ? ' iyi' : ''), title: t(k.tanitildi ? 'proje.kisiTanitildi' : 'proje.kisiBekliyor') }, ikon(k.tanitildi ? 'tik' : 'saat', 14)),
            h('button', { type: 'button', class: 'simge', 'aria-label': t('genel.kaldir'), onclick: () => (taslak.kisiler.splice(i, 1), kisiCiz()) }, ikon('kapat', 15))
          );
        }),
        h(
          'button',
          {
            type: 'button',
            class: 'dugme kucuk',
            onclick: () => {
              taslak.kisiler.push({ ad: '', numara: '', rol: '' });
              kisiCiz();
              kisiKap.querySelector('.kisiSatir:last-of-type input')?.focus();
            },
          },
          ikon('arti', 14),
          t('proje.kisiEkle')
        )
      );
    kisiCiz();

    // projenin kendi Telegram botu (isteğe bağlı): kişiler bu bota yazar
    const botKap = h('div', { class: 'tgBot' });
    const botCiz = () => {
      if (yeni) return doldur(botKap, h('p', { class: 'alanIpucu' }, t('proje.botYeni')));
      const d = tg && tg.projeler[taslak.id];
      if (d && d.kayitli)
        return doldur(
          botKap,
          h('p', { class: 'durumSatir' + (d.baglanti === 'bagli' ? ' iyi' : d.baglanti === 'hata' ? ' kotu' : '') }, d.baglanti === 'bagli' ? h('span', { class: 'katNokta' }) : ikon('ucgen', 14), d.baglanti === 'bagli' ? '@' + d.kullanici : d.hata || t('wp.baglaniyor')),
          h('button', { type: 'button', class: 'dugme kucuk', onclick: () => api.telegramToken(taslak.id, '').then(() => api.telegramDurum()).then((x) => ((tg = x), botCiz(), kisiCiz())) }, ikon('cop', 13), t('tg.kaldir'))
        );
      const giris = h('input', { type: 'password', value: botTaslak, placeholder: '123456789:AA…', autocomplete: 'off', oninput: () => (botTaslak = giris.value) });
      doldur(
        botKap,
        h('div', { class: 'satirGiris' }, giris, h('button', { type: 'button', class: 'dugme', onclick: async () => {
          const r = await api.telegramToken(taslak.id, botTaslak);
          if (r && r.hata) return bildir(r.ayrinti || hataMetni(r), true);
          botTaslak = '';
          tg = await api.telegramDurum();
          botCiz();
          kisiCiz();
        } }, t('tg.kaydet')))
      );
    };
    botCiz();

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

    // ---------- sekmeli düzen ----------
    // Sol: bölümler (rozetli). Sağ: yalnızca seçili bölüm. Kaydet ve Vazgeç form alanları içindir;
    // depolar, Git ve ortam değişkenleri anında kaydedilir.
    const genelBolum = [
      h(
        'section',
        { class: 'formBolum' },
        h('div', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('proje.klasor')), h('div', { class: 'klasorSatir' }, yolGoster, h('button', { type: 'button', class: 'dugme', onclick: klasorSec }, ikon('klasor', 15), t(taslak.klasor ? 'proje.klasorDegistir' : 'proje.klasorSec'))), h('span', { class: 'alanIpucu' }, t('proje.klasorIpucu'))),
        alan(t('proje.ad'), adGiris),
        alan(t('proje.aciklamaEtiket'), aciklamaGiris, t('proje.aciklamaIpucu', { x: s.sef.ad })),
        h('div', { class: 'alan' }, h('span', { class: 'alanEtiket' }, t('proje.alanAdlari')), alanGiris, h('span', { class: 'alanIpucu' }, t('proje.alanIpucu')))
      ),
      yeni ? null : h('section', { class: 'formBolum tehlikeBolge' }, h('h3', null, t('proje.tehlike')), h('p', { class: 'alanIpucu' }, t('proje.tehlikeIpucu')), silKap),
    ];
    const rozetler = new Map();
    const rozet = (id) => {
      const r = h('span', { class: 'sayiRozet', hidden: true });
      rozetler.set(id, r);
      return r;
    };
    const rozetKoy = (id, n, tur = '') => {
      const r = rozetler.get(id);
      if (!r) return;
      r.hidden = !n;
      r.textContent = n || '';
      r.className = 'sayiRozet' + (tur ? ' ' + tur : '');
    };
    let ortamPanel = null;
    const SEKMELER = [
      { id: 'genel', ikon: 'ayar', ad: t('proje.sGenel'), ciz: () => genelBolum },
      !yeni && { id: 'depolar', ikon: 'dal', ad: t('proje.sDepolar'), ciz: () => [depolarBolumu(taslak), gitBolumu(taslak.id)] },
      !yeni && {
        id: 'ortam',
        ikon: 'kasa',
        ad: t('proje.sOrtam'),
        ciz: () => {
          if (ortamPanel) ortamPanel.birak();
          ortamPanel = ortamBolumu(taslak.id, (n) => rozetKoy('ortam', n, 'kotu'));
          return [h('header', { class: 'sekmeBas' }, h('h3', null, t('proje.sOrtam')), h('p', null, t('ortam.aciklama'))), ortamPanel.kap];
        },
      },
      { id: 'iletisim', ikon: 'telefon', ad: t('proje.sIletisim'), ciz: () => [
        h('section', { class: 'formBolum' }, h('h3', null, t('proje.hesaplar')), h('p', { class: 'alanIpucu' }, t('proje.hesapIpucu')), hesapKap),
        h('section', { class: 'formBolum' }, h('h3', null, t('proje.kisiler')), h('p', { class: 'alanIpucu' }, t('proje.kisiIpucu', { x: s.beyin ? s.beyin.ad : '' })), kisiKap, h('p', { class: 'alanIpucu' }, t('proje.botIpucu')), botKap),
      ] },
      { id: 'test', ikon: 'kosu', ad: t('proje.test'), ciz: () => [
        h(
          'section',
          { class: 'formBolum' },
          h('h3', null, t('proje.test')),
          h('p', { class: 'alanIpucu' }, t('proje.testIpucu')),
          h('div', { class: 'ikili' }, alan(t('proje.testKomut'), komutGiris), alan(t('proje.testAdres'), adresGiris)),
          alan(t('proje.sorumlu'), sorumluSec),
          h('div', { class: 'alan yatay' }, anahtar(taslak.test.zorunlu, (v) => (taslak.test.zorunlu = v), t('proje.kapi')), h('span', { class: 'alanIpucu' }, t('proje.kapiIpucu', { x: s.sef.ad })))
        ),
      ] },
      { id: 'notlar', ikon: 'defter', ad: t('proje.sNotlar'), ciz: () => [
        h('section', { class: 'formBolum' }, h('h3', null, t('proje.notlar')), alan(t('proje.notEtiket', { x: s.sef.ad }), notGiris)),
        yeni ? null : h('section', { class: 'formBolum' }, h('div', { class: 'bolumBas' }, h('h3', null, ikon('defter', 16), t('defter.baslik')), temizleKap), defterKap),
      ] },
    ].filter(Boolean);
    let sekme = SEKMELER.some((x) => x.id === sonSekme) ? sonSekme : 'genel';
    const icerik = h('div', { class: 'sekmeIcerik', role: 'tabpanel' });
    const nav = h('nav', { class: 'sekmeNav', role: 'tablist', 'aria-orientation': 'vertical' });
    const sekmeCiz = () => {
      doldur(
        nav,
        SEKMELER.map((x) =>
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': String(x.id === sekme),
              class: 'sekmeDugme' + (x.id === sekme ? ' secili' : ''),
              onclick: () => {
                if (sekme === x.id) return;
                sekme = sonSekme = x.id;
                sekmeCiz();
              },
              onkeydown: (e) => {
                const i = SEKMELER.findIndex((y) => y.id === sekme);
                const k = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
                if (!k) return;
                e.preventDefault();
                sekme = sonSekme = SEKMELER[(i + k + SEKMELER.length) % SEKMELER.length].id;
                sekmeCiz();
                nav.querySelector('.secili')?.focus();
              },
            },
            ikon(x.ikon, 16),
            h('span', null, x.ad),
            rozetler.get(x.id) || rozet(x.id)
          )
        )
      );
      doldur(icerik, SEKMELER.find((x) => x.id === sekme).ciz());
      icerik.scrollTop = 0;
    };
    // ortam rozeti panel açılmadan da görünsün
    if (!yeni)
      api.ortamDurum(taslak.id).then((r) => r && r.birimler && rozetKoy('ortam', r.birimler.reduce((n, b) => n + b.degiskenler.filter((x) => x.durum === 'eksik').length, 0), 'kotu'));
    const depoSayi = (taslak.depolar || []).length + 1;

    doldur(
      cekmece,
      h(
        'header',
        { class: 'cekmeceBas' },
        h('span', { class: 'projeSimge buyuk' }, ikon('klasor', 30)),
        h(
          'div',
          null,
          baslik,
          yeni
            ? h('p', null, t('proje.yeniAciklama'))
            : h('div', { class: 'basBilgi' }, h('code', { title: taslak.klasor }, kisaYol(taslak.klasor || '')), depoSayi > 1 ? h('span', { class: 'cip sade' }, t('proje.depoSayi', { x: depoSayi })) : null, depo.oturum.acik && depo.oturum.projeId === taslak.id ? h('span', { class: 'hap', 'data-d': 'calisiyor' }, t('proje.calisiyor')) : null)
        ),
        h('button', { type: 'button', class: 'simge', onclick: kapat, 'aria-label': t('genel.kapat') }, ikon('kapat', 18))
      ),
      h('div', { class: 'cekmeceGovde sekmeli' }, nav, icerik),
      h('footer', { class: 'cekmeceAlt' }, h('span', { class: 'alanIpucu' }, t(yeni ? 'proje.yeniAciklama' : 'proje.duzenAciklama', { x: s.sef.ad })), h('div', { class: 'bosluk' }), h('button', { type: 'button', class: 'dugme', onclick: kapat }, t('genel.vazgec')), h('button', { type: 'button', class: 'dugme ana', onclick: kaydet }, t('genel.kaydet')))
    );
    sekmeCiz();
    kapatmaIsi = () => ortamPanel && ortamPanel.birak();
    cekmece.classList.toggle('genis', !yeni);
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
      if (!liste && sehir) {
        if (depo.sirket.sonProje) sehir.sec(depo.sirket.sonProje);
        sehir.goster();
      }
      yenile();
      if (arg && arg.yeni) ac({ yeni: true });
      else if (arg && arg.id) {
        const p = depo.sirket.projeler.find((x) => x.id === arg.id);
        if (p) ac(p);
      }
    },
    gizle() {
      if (sehir) sehir.gizle();
      if (kapatmaIsi) kapatmaIsi(), (kapatmaIsi = null);
      acik = null;
      cekmece.hidden = true;
      perde.hidden = true;
    },
  };
}
