// Ofis sayfası: kat şeridi, canlı sahne, katın terminali ve şefle konuşma paneli, ekip ve görev paneli.
import { h, doldur, ikon, kopyala, saatYaz, mdMetin, ayirici } from '../dom.js';
import { Beyin3D } from '../beyin3d.js';
import { depo, api, dinle, bildir, hataMetni, kisiBilgi, seciliKat, terminalKati, gorunumSec } from '../depo.js';
import { Sahne } from '../sahne.js';
import { sessizMi, sessizYap } from '../ses.js';
import { odaSecici } from '../odaSecici.js';
import { petek } from '../petek.js';
import { basHarf, MISAFIR_RENK } from '../../cekirdek/kimlik.js';
import { neZaman } from './projeler.js';

const YER = { masa: 'yer.masa', kutuphane: 'yer.kutuphane', kahve: 'yer.kahve', oyun: 'yer.oyun' };

function sure(ms, t) {
  const sn = Math.max(0, Math.floor(ms / 1000));
  if (sn < 60) return t('sure.sn', { x: sn });
  const dk = Math.floor(sn / 60);
  if (dk < 60) return t('sure.dk', { x: dk });
  return t('sure.sa', { x: Math.floor(dk / 60), y: dk % 60 });
}

export function ofisSayfasi({ git }) {
  const t = () => depo.t;
  let secili = null;
  let term = null;
  let fit = null;
  let dockBuyuk = false;
  let sirketIzi = '';
  let kullanildi = false;

  // ---------- iskelet ----------
  const tuval = h('canvas', { class: 'tuval', 'aria-label': 'Ofis' });
  const bosKart = h('div', { class: 'bosKart', hidden: true });
  const yakinlik = h(
    'div',
    { class: 'yakinlik' },
    h('button', { type: 'button', title: '−', onclick: () => sahne.yakinlas(0.8) }, '−'),
    h('button', { type: 'button', title: '+', onclick: () => sahne.yakinlas(1.25) }, '+'),
    h('button', { type: 'button', class: 'sigdir', onclick: () => sahne.sigdir() })
  );
  // beyin seçiliyken sahnenin yerinde bina özeti görünür
  const binaPanel = h('div', { class: 'bina', hidden: true });
  // asansör: binada katlar arası geçiş (▲ ▼ ve kat listesi)
  const asansor = h('nav', { class: 'asansor', hidden: true });
  const sahneKap = h('section', { class: 'sahne' }, tuval, yakinlik, bosKart, asansor, binaPanel);
  const beyinMi = () => depo.gorunum === 'beyin';
  // özel sohbet: "ozel:<kat>:<ajan>"
  const ozelBilgi = () => {
    const m = /^ozel:([^:]+):(.+)$/.exec(depo.gorunum);
    if (!m) return null;
    const kat = depo.sirket.projeler.find((p) => p.id === m[1]);
    const ajan = kat && kat.ajanlar.find((a) => a.id === m[2]);
    return ajan ? { kat, ajan, anahtar: depo.gorunum } : null;
  };
  const ozelMi = () => depo.gorunum.startsWith('ozel:');
  // kişisel kat seçili ve özel sohbete girilmemiş
  const kisiselMi = () => depo.gorunum === 'kat' && (depo.sirket.projeler.find((p) => p.id === depo.sirket.sonProje) || {}).tur === 'kisisel';
  // sahnenin yerine panel gösterilen görünümler
  const panelMi = () => beyinMi() || ozelMi() || kisiselMi();
  // konuşmanın karşı tarafı: beyin, özel sohbetteki kişi ya da katın şefi
  const muhatap = () => (beyinMi() ? depo.sirket.beyin.ad : ozelMi() ? (ozelBilgi() || { ajan: { ad: '' } }).ajan.ad : depo.sirket.sef.ad);

  const dockBas = h('div', { class: 'dockBas' });
  const termKap = h('div', { class: 'termKap' });
  const termBos = h('div', { class: 'termBos' });

  // konuşma paneli: şefin cevapları, soruları ve onay istekleri
  const sohbetBas = h('div', { class: 'sohbetBas' });
  const sohbetListe = h('ol', { class: 'sohbetListe', 'aria-live': 'polite' });
  const sohbetGiris = h('textarea', { class: 'sohbetGiris', rows: '1', maxlength: '8000' });
  const sohbetGonder = h('button', { type: 'button', class: 'sohbetGonder', onclick: () => sohbetYolla() }, ikon('gonder', 16));
  // özel odalarda dosya ekleme: seçilen dosyalar odanın klasörüne kopyalanır, mesajla birlikte kişiye bildirilir
  let bekleyenEkler = [];
  const ekKap = h('div', { class: 'ekKap', hidden: true });
  const ekDugme = h('button', { type: 'button', class: 'sohbetEk', hidden: true, onclick: () => dosyaEkle() }, ikon('arti', 16));
  // konuşarak yazma: bas, konuş, tekrar bas. Kayıt yazıya çevrilip gönderilir.
  const mikDugme = h('button', { type: 'button', class: 'sohbetEk mik', onclick: () => mikrofon() }, ikon('mik', 16));
  const sohbet = h('section', { class: 'sohbet' }, sohbetBas, sohbetListe, ekKap, h('div', { class: 'sohbetYaz' }, ekDugme, sohbetGiris, mikDugme, sohbetGonder));
  let kayit = null; // { kaydedici, parcalar, akim, bas, sayac }
  async function mikrofon() {
    const tt = depo.t;
    if (kayit) return kayit.kaydedici.stop();
    if (!depo.oturum.acik || depo.oturum.giris) return bildir(tt('sohbet.kapali'), true);
    const v = await api.sesYaziyaVar();
    if (!v || !v.var) return bildir(tt('ses.yaziyaAnahtarYok'), true);
    let akim;
    try {
      akim = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return bildir(tt('ses.mikIzin'), true);
    }
    const tur = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported(x)) || '';
    const kaydedici = new MediaRecorder(akim, tur ? { mimeType: tur } : undefined);
    kayit = { kaydedici, parcalar: [], akim, bas: Date.now() };
    kaydedici.ondataavailable = (e) => e.data.size && kayit.parcalar.push(e.data);
    kaydedici.onstop = async () => {
      const k = kayit;
      kayit = null;
      clearInterval(k.sayac);
      k.akim.getTracks().forEach((x) => x.stop());
      mikCiz(true);
      const blob = new Blob(k.parcalar, { type: kaydedici.mimeType || 'audio/webm' });
      const veri = await new Promise((coz) => {
        const o = new FileReader();
        o.onload = () => coz(String(o.result).split(',')[1] || '');
        o.readAsDataURL(blob);
      });
      const r = await api.sesYaziya(veri, blob.type);
      mikCiz(false);
      if (!r || r.hata) return bildir(hataMetni(r), true);
      if (!r.metin) return bildir(tt('ses.duyulmadi'), true);
      sohbetGiris.value = (sohbetGiris.value ? sohbetGiris.value + ' ' : '') + r.metin;
      boyutla();
      sohbetYolla();
    };
    kaydedici.start();
    kayit.sayac = setInterval(() => mikCiz(false), 500);
    mikCiz(false);
  }
  function mikCiz(ceviriyor) {
    const tt = depo.t;
    mikDugme.classList.toggle('kayit', !!kayit);
    mikDugme.classList.toggle('ceviriyor', !!ceviriyor);
    mikDugme.disabled = !!ceviriyor;
    const sn = kayit ? Math.floor((Date.now() - kayit.bas) / 1000) : 0;
    mikDugme.title = ceviriyor ? tt('ses.ceviriyor') : kayit ? tt('ses.dinliyor', { x: sn }) : tt('ses.konus');
    mikDugme.setAttribute('aria-label', mikDugme.title);
    doldur(mikDugme, ceviriyor ? h('span', { class: 'donen' }) : kayit ? h('span', { class: 'mikSure' }, `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, '0')}`) : ikon('mik', 16));
  }
  const termAlan = h('div', { class: 'termAlan' }, termKap, termBos);
  const dockGovde = h('div', { class: 'dockGovde' }, termAlan, sohbet);
  const dock = h('section', { class: 'dock' }, dockBas, dockGovde);

  // kat şeridi: her proje bir kat
  const katSerit = h('nav', { class: 'katSerit', 'aria-label': 'Katlar' });

  const ekipEl = h('ul', { class: 'ekip' });
  const ekipAdet = h('span', { class: 'adet' });
  const gorevEl = h('div');
  const gorevAdet = h('span', { class: 'adet' });
  const akisEl = h('ol', { class: 'akis' });
  const yanBaslik = { ekip: h('span'), gorev: h('span'), akis: h('span') };
  const yan = h(
    'aside',
    { class: 'yan' },
    h('section', { class: 'bolum' }, h('h2', null, yanBaslik.ekip, ekipAdet), ekipEl),
    h('section', { class: 'bolum' }, h('h2', null, yanBaslik.gorev, gorevAdet), gorevEl),
    h('section', { class: 'bolum akisBolum' }, h('h2', null, yanBaslik.akis), akisEl)
  );

  // ---------- elle ayarlanan düzen ----------
  // Sahne ile alt bölüm, terminal ile sohbet, ana alan ile yan panel arasındaki ayırıcılar. Ölçüler bu bilgisayarda hatırlanır.
  const DUZEN = 'ofis.duzen';
  let duzen = {};
  try {
    duzen = JSON.parse(localStorage.getItem(DUZEN) || '{}') || {};
  } catch {
    duzen = {};
  }
  const duzenKaydet = () => {
    try {
      localStorage.setItem(DUZEN, JSON.stringify(duzen));
    } catch {
      /* depolama kapalı */
    }
  };
  const ofisSol = h('div', { class: 'ofisSol' });
  const duzenUygula = () => {
    dock.style.height = duzen.dock ? duzen.dock + 'px' : '';
    sohbet.style.width = duzen.sohbet ? duzen.sohbet + 'px' : '';
    yan.style.width = duzen.yan ? duzen.yan + 'px' : '';
    requestAnimationFrame(sigdirTerm);
  };
  const sinirla = (x, alt, ust) => Math.round(Math.max(alt, Math.min(ust, x)));
  let ilk = 0;
  const dockAyirici = ayirici({
    yon: 'yatay',
    etiket: 'dock',
    basla: () => (ilk = dock.getBoundingClientRect().height),
    ayarla: (f) => ((duzen.dock = sinirla(ilk - f, 150, ofisSol.clientHeight - 160)), duzenUygula()),
    bitir: duzenKaydet,
    sifirla: () => (delete duzen.dock, duzenKaydet(), duzenUygula()),
  });
  const sohbetAyirici = ayirici({
    yon: 'dikey',
    etiket: 'sohbet',
    basla: () => (ilk = sohbet.getBoundingClientRect().width),
    ayarla: (f) => ((duzen.sohbet = sinirla(ilk - f, 260, dockGovde.clientWidth - 240)), duzenUygula()),
    bitir: duzenKaydet,
    sifirla: () => (delete duzen.sohbet, duzenKaydet(), duzenUygula()),
  });
  const yanAyirici = ayirici({
    yon: 'dikey',
    etiket: 'yan',
    basla: () => (ilk = yan.getBoundingClientRect().width),
    ayarla: (f) => ((duzen.yan = sinirla(ilk - f, 220, 560)), duzenUygula()),
    bitir: duzenKaydet,
    sifirla: () => (delete duzen.yan, duzenKaydet(), duzenUygula()),
  });
  dockGovde.insertBefore(sohbetAyirici, sohbet);
  ofisSol.append(katSerit, sahneKap, dockAyirici, dock);
  const kok = h('div', { class: 'ofisSayfa' }, ofisSol, yanAyirici, yan);
  duzenUygula();

  const sahne = new Sahne(tuval, {
    t: depo.t,
    secildi: (id) => {
      secili = id;
      ekipCiz();
    },
    bosMasa: (i) => git('ekip', { yeni: true, masa: i }),
    katSec: (id) => kataGit(id),
  });

  // ---------- terminal ----------
  function termKur() {
    if (term || !window.Terminal) return;
    term = new window.Terminal({
      fontFamily: '"SF Mono", ui-monospace, Menlo, Consolas, "Cascadia Mono", monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 6000,
      macOptionIsMeta: true,
      allowTransparency: false,
      theme: {
        background: '#0E1117',
        foreground: '#DCE2EC',
        cursor: '#17B8A6',
        selectionBackground: 'rgba(23,184,166,0.32)',
        black: '#1A1F29',
        brightBlack: '#5D6577',
        red: '#F7768E',
        brightRed: '#FF9A9E',
        green: '#57B26A',
        brightGreen: '#8AD79B',
        yellow: '#E0AF68',
        brightYellow: '#F6C177',
        blue: '#5AA2E6',
        brightBlue: '#9CC8F4',
        magenta: '#BB9AF7',
        brightMagenta: '#D4BFFF',
        cyan: '#17B8A6',
        brightCyan: '#7DCFFF',
        white: '#C8CED9',
        brightWhite: '#F2F4F8',
      },
    });
    fit = new window.FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(termKap);
    term.onData((d) => api.oturumYaz(bagliKat, d));
    term.onResize(({ cols, rows }) => api.oturumBoyut(bagliKat, cols, rows));
    term.attachCustomKeyEventHandler((e) => {
      // seçim varken kopyala (macOS: Cmd+C, diğerleri: Ctrl+Shift+C)
      const kopya = e.type === 'keydown' && e.key.toLowerCase() === 'c' && (api.mac ? e.metaKey : e.ctrlKey && e.shiftKey);
      if (kopya && term.hasSelection()) {
        kopyala(term.getSelection());
        return false;
      }
      return true;
    });
    api.ptyVeri((v) => v.kat === bagliKat && term.write(v.d));
    api.ptyCikis((v) => {
      if (v.kat === bagliKat) term.write('\r\n\x1b[2m' + depo.t('oturum.kapandi') + '\x1b[0m\r\n');
    });
    new ResizeObserver(() => sigdirTerm()).observe(termKap);
    bagliKat = null;
    termBagla();
  }

  // Terminal bir seferde tek katı gösterir. Kat değişince o katın ekranı ana süreçteki tampondan geri yüklenir.
  let bagliKat = null;
  function termBagla() {
    if (!term) return;
    const kat = terminalKati();
    if (kat === bagliKat) return;
    bagliKat = kat;
    term.reset();
    api.oturumTampon(kat).then((b) => {
      if (bagliKat !== kat) return;
      if (b && b.tampon) term.write(b.tampon);
      if (b && b.acik) api.oturumBoyut(kat, term.cols, term.rows);
    });
  }

  function sigdirTerm() {
    if (!term || !termKap.clientWidth || termKap.hidden) return;
    try {
      fit.fit();
    } catch {
      /* gizliyken ölçülemez */
    }
  }

  const projeBul = (id) => depo.sirket.projeler.find((p) => p.id === id) || null;
  const etkinProje = () => (beyinMi() || ozelMi() ? null : projeBul(depo.oturum.acik ? depo.oturum.projeId : depo.sirket.sonProje));

  // Projenin kayıt defterinden "kaldığı yer" bilgisi: başlangıç panelinde gösterilir
  let kaldi = { id: null, durum: null };
  async function kaldiYukle() {
    const pr = etkinProje();
    if (!pr) return (kaldi = { id: null, durum: null });
    const r = await api.kayitOku(pr.id);
    kaldi = { id: pr.id, durum: r && r.durum ? r.durum : null };
    if (!depo.oturum.acik) dockCiz();
  }

  async function baslat(surdur = false) {
    if (beyinMi()) return beyinBaslat();
    if (ozelMi()) return ozelBaslat(surdur === true);
    const proje = etkinProje();
    if (!proje) return projeSec(true);
    termKur();
    kullanildi = true;
    dockCiz(true);
    sigdirTerm();
    bagliKat = proje.id;
    term.reset();
    const s = await api.oturumBaslat({ projeId: proje.id, surdur: surdur === true, sutun: term.cols, satir: term.rows });
    if (!s || s.hata) {
      bildir(hataMetni(s), true);
      kullanildi = false;
      dockCiz();
      return;
    }
    sirketIzi = izHesapla();
    term.focus();
  }

  async function beyinBaslat() {
    termKur();
    kullanildi = true;
    dockCiz(true);
    sigdirTerm();
    bagliKat = 'beyin';
    term.reset();
    const s = await api.oturumBaslat({ beyin: true, sutun: term.cols, satir: term.rows });
    if (!s || s.hata) {
      bildir(hataMetni(s), true);
      kullanildi = false;
      dockCiz();
      return;
    }
    term.focus();
  }

  async function ozelBaslat(surdur) {
    const o = ozelBilgi();
    if (!o) return;
    termKur();
    kullanildi = true;
    dockCiz(true);
    sigdirTerm();
    bagliKat = o.anahtar;
    term.reset();
    const s = await api.oturumBaslat({ ozel: { katId: o.kat.id, ajanId: o.ajan.id }, surdur, sutun: term.cols, satir: term.rows });
    if (!s || s.hata) {
      bildir(hataMetni(s), true);
      kullanildi = false;
      dockCiz();
      return;
    }
    term.focus();
  }

  async function projeSec(sonraBaslat) {
    const s = await api.projeSec();
    if (!s || !s.tamam) return;
    if (sonraBaslat === true) baslat();
    else kaldiYukle();
  }

  const izHesapla = () => {
    const pr = etkinProje();
    return JSON.stringify([depo.sirket.ajanlar, depo.sirket.kurallar, depo.sirket.sef, depo.skiller.filter((x) => x.etkin).map((x) => x.id), pr && [pr.ad, pr.aciklama, pr.alanAdlari, pr.hesaplar, pr.test, pr.notlar]]);
  };

  // Hangi motor ve şef modeliyle çalışılacağını gösterir. Tıklayınca Ayarlar açılır.
  function motorCipi(mb) {
    const tt = depo.t;
    const motor = depo.oturum.acik && depo.oturum.motor ? depo.oturum.motor : mb.secilen;
    if (!motor) return null;
    const s = depo.sirket;
    const model = motor === 'claude' ? s.sef.model || s.modeller.claude.koordinator : s.sef.codexModel || s.modeller.codex.koordinator || (mb.codexVarsayilan || {}).koordinator || '';
    const eksik = !depo.oturum.acik && !mb.hazir;
    return h(
      'button',
      { type: 'button', class: 'motorCip' + (eksik ? ' eksik' : ''), title: tt(eksik ? 'motor.cipEksik' : 'motor.cipIpucu'), disabled: depo.oturum.acik, onclick: () => git('ayarlar') },
      h('b', null, tt('motor.' + motor)),
      model ? h('span', null, model) : null,
      eksik ? ikon('ucgen', 12) : null
    );
  }

  // ---------- dock başlığı ve boş hali ----------
  function dockCiz(basliyor = false) {
    const tt = depo.t;
    const acik = depo.oturum.acik || basliyor;
    const proje = etkinProje();
    const mb = depo.bilgi.motorlar || {};
    const claudeVar = !!mb.secilen;
    const girisAcik = depo.oturum.acik && depo.oturum.giris;

    const degisti = depo.oturum.acik && sirketIzi && sirketIzi !== izHesapla();
    doldur(
      dockBas,
      h(
        'div',
        { class: 'dockSol' },
        h('span', { class: 'dockBaslik' }, girisAcik ? tt('dock.giris', { x: tt('motor.' + depo.oturum.motor) }) : tt('dock.baslik', { x: muhatap() })),
        girisAcik ? null : motorCipi(mb)
      ),
      degisti ? h('span', { class: 'dockNot' }, tt('dock.degisti')) : null,
      h(
        'div',
        { class: 'dockSag' },
        depo.oturum.acik
          ? h('button', { type: 'button', class: 'dugme', onclick: () => api.oturumDurdur(terminalKati()) }, ikon('dur', 12), tt('oturum.durdur'))
          : kisiselMi()
          ? null
          : [
              proje && proje.sonOturum && !basliyor && !ozelMi() ? h('button', { type: 'button', class: 'dugme', disabled: !claudeVar, title: tt('oturum.surdurIpucu'), onclick: () => baslat(true) }, ikon('yenile', 13), tt('oturum.surdur')) : null,
              h('button', { type: 'button', class: 'dugme ana', disabled: !claudeVar || basliyor, onclick: () => baslat() }, ikon('oynat', 12), tt('oturum.baslat')),
            ],
        h(
          'button',
          {
            type: 'button',
            class: 'simge',
            title: tt(dockBuyuk ? 'dock.kucult' : 'dock.buyut'),
            onclick: () => {
              dockBuyuk = !dockBuyuk;
              kok.classList.toggle('dockBuyuk', dockBuyuk);
              // büyüt/küçült düğmesi elle verilen yüksekliği sıfırlar
              delete duzen.dock;
              duzenKaydet();
              duzenUygula();
              dockCiz();
              requestAnimationFrame(sigdirTerm);
            },
          },
          ikon(dockBuyuk ? 'asagi' : 'yukari', 16)
        )
      )
    );

    // gövde: terminal ya da başlangıç paneli
    const terminalGoster = acik || kullanildi;
    termKap.hidden = !acik && !terminalGoster;
    termBos.hidden = !termKap.hidden;
    if (termBos.hidden) {
      requestAnimationFrame(sigdirTerm);
      return;
    }
    if (!claudeVar) {
      const komutlar = mb.kurulum || {};
      const komutSatiri = (komut) => {
        const kopyaDugme = h('button', { type: 'button', onclick: async () => (kopyaDugme.textContent = (await kopyala(komut)) ? tt('genel.kopyalandi') : tt('genel.kopyala')) }, tt('genel.kopyala'));
        return h('div', { class: 'komut' }, h('code', null, komut), kopyaDugme);
      };
      doldur(
        termBos,
        h('h3', null, tt('motor.yokBaslik')),
        h('p', null, tt('motor.yokGenel')),
        h('p', { class: 'ipucu' }, tt('motor.claude')),
        komutSatiri(komutlar.claude || ''),
        h('p', { class: 'ipucu' }, tt('motor.codex')),
        komutSatiri(komutlar.codex || ''),
        h(
          'div',
          { class: 'satirDugme' },
          h(
            'button',
            {
              type: 'button',
              class: 'dugme ana',
              onclick: async () => {
                await api.claudeYenile();
                dockCiz();
              },
            },
            ikon('yenile', 14),
            tt('claude.yenidenDene')
          ),
          h('button', { type: 'button', class: 'dugme', onclick: () => git('ayarlar') }, ikon('ayar', 14), tt('motor.ayarlaraGit'))
        )
      );
      return;
    }
    if (kisiselMi()) {
      doldur(termBos, h('h3', null, tt('kisisel.baslik')), h('p', null, tt('kisisel.dock', { x: depo.sirket.beyin.ad })));
      return;
    }
    if (ozelMi()) {
      const o = ozelBilgi();
      const kayitli = o && depo.sirket.ozelOturumlar && depo.sirket.ozelOturumlar[`${o.kat.id}:${o.ajan.id}`];
      doldur(
        termBos,
        h('h3', null, tt('ozel.hazir', { x: muhatap() })),
        h('p', null, tt('ozel.aciklama', { x: muhatap() })),
        h(
          'div',
          { class: 'satirDugme' },
          h('button', { type: 'button', class: 'dugme ana buyuk', onclick: () => baslat() }, ikon('gonder', 14), tt('ozel.baslat')),
          kayitli ? h('button', { type: 'button', class: 'dugme buyuk', onclick: () => baslat(true) }, ikon('yenile', 15), tt('ozel.surdur')) : null
        )
      );
      return;
    }
    if (beyinMi()) {
      doldur(
        termBos,
        h('h3', null, tt('beyin.hazir', { x: muhatap() })),
        h('p', null, tt('beyin.aciklama', { x: muhatap() })),
        h('div', { class: 'satirDugme' }, h('button', { type: 'button', class: 'dugme ana buyuk', onclick: () => baslat() }, ikon('beyin', 15), tt('beyin.baslat', { x: muhatap() })))
      );
      return;
    }
    const kd = proje && kaldi.id === proje.id ? kaldi.durum : null;
    const sonIs = kd && kd.istekler.length ? kd.istekler[kd.istekler.length - 1] : null;
    doldur(
      termBos,
      h('h3', null, proje ? tt('baslangic.hazir', { x: depo.sirket.sef.ad }) : tt('baslangic.projeYok')),
      h('p', null, proje ? tt('baslangic.aciklama', { x: proje.ad }) : tt('baslangic.projeAciklama')),
      sonIs
        ? h(
            'div',
            { class: 'kaldiSerit' },
            h('span', { class: 'kaldiEtiket' }, ikon('saat', 14), tt('baslangic.kaldi', { x: neZaman(kd.sonZaman, tt) })),
            h('p', null, sonIs.istek),
            h('span', { class: 'kaldiNot' }, tt('baslangic.kaldiNot', { x: depo.sirket.sef.ad }))
          )
        : null,
      h(
        'div',
        { class: 'satirDugme' },
        proje ? h('button', { type: 'button', class: 'dugme ana buyuk', onclick: () => baslat() }, ikon('oynat', 13), tt(sonIs ? 'oturum.baslatDevir' : 'oturum.baslat')) : null,
        proje && proje.sonOturum && sonIs ? h('button', { type: 'button', class: 'dugme buyuk', title: tt('oturum.surdurIpucu'), onclick: () => baslat(true) }, ikon('yenile', 15), tt('oturum.surdur')) : null,
        h('button', { type: 'button', class: proje ? 'dugme buyuk' : 'dugme ana buyuk', onclick: () => projeSec(!proje) }, ikon('klasor', 15), tt(proje ? 'proje.degistir' : 'proje.sec'))
      ),
      h('p', { class: 'ipucu' }, tt('baslangic.giris'))
    );
  }

  // ---------- kat şeridi ----------
  // Ofis katları (kişisel kat hariç), alttan üste. Kat numarası binadaki sırasıdır.
  const ofisKatlari = () => depo.sirket.projeler.filter((p) => p.tur !== 'kisisel');
  function katSeritCiz() {
    const tt = depo.t;
    const secili = seciliKat();
    const katlar = ofisKatlari();
    const kisisel = kisiselMi() || ozelMi();
    const aktif = katlar.find((p) => p.id === secili);
    doldur(
      katSerit,
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': beyinMi() ? 'true' : 'false',
          class: 'katDugme beyinDugme' + (beyinMi() ? ' secili' : '') + ((depo.oturumlar.beyin || {}).acik ? ' acik' : ''),
          title: tt('beyin.ipucu'),
          onclick: () => gorunumSec('beyin'),
        },
        ikon('beyin', 16),
        h('span', { class: 'katAd' }, depo.sirket.beyin.ad),
        (depo.oturumlar.beyin || {}).acik ? h('span', { class: 'katNokta' }) : null,
        (depo.oturumlar.beyin || {}).bekleyen ? h('span', { class: 'katBekleyen' }, String(depo.oturumlar.beyin.bekleyen)) : null
      ),
      h('span', { class: 'katAyrac', 'aria-hidden': 'true' }),
      kisisel
        ? h('span', { class: 'katBaslik' }, h('span', { class: 'katNo kisisel' }, ikon('kalp', 12)), tt('gez.kisisel'))
        : aktif && !beyinMi()
          ? h('span', { class: 'katBaslik' }, h('span', { class: 'katNo' }, String(katlar.indexOf(aktif) + 1)), aktif.ad, (depo.oturumlar[aktif.id] || {}).acik ? h('span', { class: 'katNokta' }) : null)
          : h('span', { class: 'katEtiket' }, tt('beyin.serit')),
      // açık özel sohbetler yalnızca kişisel alanda
      kisisel ? ozelCipleri() : null,
      h('div', { class: 'bosluk' }),
      // katlar artık Projeler'deki şehirden açılır; katta iken oraya dönüş
      !kisisel && !beyinMi() && katlar.length ? h('button', { type: 'button', class: 'katEkle', onclick: () => git('projeler') }, ikon('geri', 14), tt('beyin.sehreDon')) : null
    );
    asansorCiz();
  }

  // Asansör ve bina: aktif katın üstü ve altı. Oturumu açık katın ışıkları yanar.
  function asansorCiz() {
    const tt = depo.t;
    const katlar = ofisKatlari();
    const secili = seciliKat();
    const goster = !panelMi() && katlar.length > 0 && katlar.some((p) => p.id === secili);
    const bilgi = katlar.map((p, i) => ({ id: p.id, no: i + 1, ad: p.ad, acik: !!(depo.oturumlar[p.id] || {}).acik, bekleyen: (depo.oturumlar[p.id] || {}).bekleyen || 0 }));
    sahne.binaAyarla(goster ? bilgi : [], goster ? secili : null);
    asansor.hidden = !goster || katlar.length < 2;
    if (asansor.hidden) return;
    const i = katlar.findIndex((p) => p.id === secili);
    doldur(
      asansor,
      h('button', { type: 'button', class: 'asansorOk', disabled: i >= katlar.length - 1, title: tt('bina.ust'), 'aria-label': tt('bina.ust'), onclick: () => kataGit(katlar[i + 1].id) }, ikon('yukari', 16)),
      h(
        'ol',
        { class: 'asansorKatlar' },
        [...bilgi].reverse().map((k) =>
          h(
            'li',
            null,
            h(
              'button',
              { type: 'button', class: 'asansorKat' + (k.id === secili ? ' secili' : '') + (k.acik ? ' acik' : ''), title: k.ad + (k.acik ? ' · ' + tt('kat.calisiyor') : ''), 'aria-current': k.id === secili ? 'true' : null, onclick: () => kataGit(k.id) },
              h('span', { class: 'asansorNo' }, String(k.no)),
              h('span', { class: 'asansorAd' }, k.ad),
              k.bekleyen ? h('span', { class: 'katBekleyen' }, String(k.bekleyen)) : null
            )
          )
        )
      ),
      h('button', { type: 'button', class: 'asansorOk', disabled: i <= 0, title: tt('bina.alt'), 'aria-label': tt('bina.alt'), onclick: () => kataGit(katlar[i - 1].id) }, ikon('asagi', 16))
    );
  }

  const odaIkonu = (a) => {
    const sb = (depo.odaSablonlari || []).find((x) => x.id === a.oda);
    return sb ? ikon(sb.simge, 16) : a.ad.slice(0, 1);
  };

  function ozelCipleri() {
    const anahtarlar = new Set(Object.keys(depo.oturumlar).filter((k) => k.startsWith('ozel:') && depo.oturumlar[k].acik));
    if (ozelMi()) anahtarlar.add(depo.gorunum);
    if (!anahtarlar.size) return null;
    return h(
      'div',
      { class: 'katListe ozelListe' },
      [...anahtarlar].map((k) => {
        const [, katId, ajanId] = k.split(':');
        const kat = depo.sirket.projeler.find((p) => p.id === katId);
        const a = kat && kat.ajanlar.find((x) => x.id === ajanId);
        if (!a) return null;
        const o = depo.oturumlar[k] || {};
        return h(
          'button',
          { type: 'button', class: 'katDugme ozelDugmeCip' + (depo.gorunum === k ? ' secili' : ''), title: depo.t('ozel.baslik', { x: a.ad }), onclick: () => gorunumSec(k) },
          h('span', { class: 'odaSimge kucuk', style: `background:${a.renk}` }, a.ad.slice(0, 1)),
          h('span', { class: 'katAd' }, a.ad),
          o.acik ? h('span', { class: 'katNokta' }) : null,
          o.bekleyen ? h('span', { class: 'katBekleyen' }, String(o.bekleyen)) : null
        );
      })
    );
  }

  async function kataGit(id) {
    if (id !== depo.sirket.sonProje) await api.sirketGuncelle({ sonProje: id });
    gorunumSec('kat');
  }

  // ---------- bina özeti (beyin görünümü) ----------
  function binaCiz() {
    const tt = depo.t;
    const panel = panelMi();
    kok.classList.toggle('beyinModu', panel);
    kok.classList.toggle('ozelModu', ozelMi());
    kok.classList.toggle('kisiselModu', kisiselMi());
    binaPanel.hidden = !panel;
    if (beyin3d && !beyinMi()) beyin3d.gizle();
    tuval.hidden = panel;
    yakinlik.hidden = panel;
    if (panel) bosKart.hidden = true;
    if (!panel) return;
    if (kisiselMi()) return odalarCiz();
    if (ozelMi()) return odaCiz();
    // beyin görünümü: canlı beyin (bir kez kurulur, görünürken çizilir)
    beyinPanelCiz();
  }

  // ---------- canlı beyin ----------
  // Her proje bir lob, her anı ve not bir nöron. Olaylar çekirdekten loba sinyal olarak gider.
  let beyin3d = null;
  let beyinVeri = null;
  let beyinYukleniyor = false;
  let beyinPanelAcik = (() => {
    try {
      return localStorage.getItem('beyin.panel') !== '0';
    } catch {
      return true;
    }
  })();
  let seciliNot = null;
  let notAra = '';
  const beyinKap = h('div', { class: 'beyinKap' });
  const beyinHud = h('div', { class: 'beyinHud' });
  const beyinAkis = h('ol', { class: 'beyinAkis', 'aria-live': 'off' });
  const beyinAraclar = h('div', { class: 'beyinAraclar' });
  const beyinYan = h('aside', { class: 'beyinYan' });
  const beyinSahne = h('div', { class: 'beyinSahne' }, beyinKap, beyinHud, beyinAraclar, beyinAkis);
  const beyinGovde = h('div', { class: 'beyinGovde' }, beyinSahne, beyinYan);
  let sonBeyinOlay = Date.now();
  let gerginBitis = 0;

  function beyinKur() {
    if (beyin3d) return;
    const tt = depo.t;
    beyin3d = new Beyin3D(beyinKap, {
      notTikla: (n) => notAc(n.id),
      lobTikla: () => {},
      turAdi: (tur) => tt('beyin.tur.' + tur),
    });
    api.beyinOlayDinle((e) => {
      if (!e || !beyin3d) return;
      sonBeyinOlay = Date.now();
      if (e.tur === 'hata') gerginBitis = Date.now() + 60000;
      beyin3d.olay(e.katId);
      beyinAkisEkle(e);
      if (e.tur === 'ani') beyinYenile();
    });
    setInterval(() => {
      if (!beyin3d || !beyin3d.calisiyor) return;
      const o = depo.oturumlar || {};
      const bekleyen = Object.values(o).some((x) => x && x.bekleyen);
      const bos = Date.now() - sonBeyinOlay > 120000;
      beyin3d.ruhAyarla({ gergin: Date.now() < gerginBitis, ruya: bos && !bekleyen });
      ruhCiz(Date.now() < gerginBitis ? 'gergin' : bekleyen ? 'mesgul' : bos ? 'ruya' : 'odakli');
    }, 2000);
    setInterval(() => beyin3d && beyin3d.calisiyor && beyinYenile(), 60000);
  }

  let ruhSimdi = '';
  function ruhCiz(ruh) {
    if (ruh === ruhSimdi) return;
    ruhSimdi = ruh;
    const e = beyinHud.querySelector('.beyinRuh');
    if (e) {
      e.dataset.r = ruh;
      e.lastChild.textContent = depo.t('beyin.ruh.' + ruh);
    }
  }

  async function beyinYenile() {
    if (beyinYukleniyor) return;
    beyinYukleniyor = true;
    try {
      const v = await api.beyinVeri();
      if (!v || v.hata) return;
      beyinVeri = v;
      beyin3d.veriKoy(v, depo.sirket.beyin.ad);
      beyinHudCiz();
      beyinYanCiz();
    } finally {
      beyinYukleniyor = false;
    }
  }

  function beyinHudCiz() {
    const tt = depo.t;
    const v = beyinVeri;
    if (!v) return;
    const not = v.notlar.length;
    const ani = v.katlar.reduce((n, k) => n + k.anilar.length, 0);
    doldur(
      beyinHud,
      h(
        'div',
        { class: 'beyinSeviye' },
        h('div', { class: 'beyinRozet' }, h('span', null, tt('beyin.sv')), h('b', null, String(v.seviye))),
        h(
          'div',
          null,
          h('div', { class: 'beyinAdSatir' }, h('b', null, depo.sirket.beyin.ad), h('span', { class: 'beyinRuh', 'data-r': ruhSimdi || 'odakli' }, h('i'), h('span', null, tt('beyin.ruh.' + (ruhSimdi || 'odakli'))))),
          h('div', { class: 'beyinXp' }, h('div', { style: `width:${Math.round((v.xp / v.sinir) * 100)}%` })),
          h('small', null, tt('beyin.xp', { x: v.xp.toLocaleString(depo.sirket.dil), y: v.sinir.toLocaleString(depo.sirket.dil) }))
        )
      ),
      h('div', { class: 'beyinSayilar' }, h('div', null, h('b', null, String(ani)), h('span', null, tt('beyin.ani'))), h('div', null, h('b', null, String(not)), h('span', null, tt('beyin.notSayi'))), h('div', null, h('b', null, String(v.katlar.length)), h('span', null, tt('beyin.lob'))))
    );
    doldur(
      beyinAraclar,
      h('button', { type: 'button', class: 'dugme kucuk' + (beyin3d.kontrol.autoRotate ? ' secili' : ''), onclick: (e) => (beyin3d.dondur(!beyin3d.kontrol.autoRotate), e.currentTarget.classList.toggle('secili', beyin3d.kontrol.autoRotate)) }, tt('beyin.dondur')),
      h(
        'button',
        {
          type: 'button',
          class: 'dugme kucuk' + (beyinPanelAcik ? ' secili' : ''),
          onclick: () => {
            beyinPanelAcik = !beyinPanelAcik;
            try {
              localStorage.setItem('beyin.panel', beyinPanelAcik ? '1' : '0');
            } catch {
              /* depolama kapalı */
            }
            beyinGovde.classList.toggle('panelKapali', !beyinPanelAcik);
            beyinHudCiz();
          },
        },
        ikon('klasor', 13),
        tt('beyin.klasorler')
      )
    );
  }

  const OLAY_IKON = { istek: '💬', arac: '⚙️', bitti: '✅', ekip: '👥', onay: '✋', hata: '❌', ani: '✨', ara: '🔎' };
  const OLAY_XP = { bitti: 25, ani: 40, istek: 10 };
  function beyinAkisEkle(e) {
    const tt = depo.t;
    const kat = depo.sirket.projeler.find((p) => p.id === e.katId);
    const ad = e.katId === 'beyin' || !kat ? depo.sirket.beyin.ad : kat.ad;
    const lob = beyin3d.loblar.find((l) => l.id === (kat ? kat.id : 'beyin'));
    const ek = e.metin || (e.arac ? e.arac : '');
    const xp = OLAY_XP[e.tur] || 0;
    const li = h('li', { class: 'beyinOlay', style: `--r:${lob ? lob.renk : '#17b8a6'}` }, h('span', null, OLAY_IKON[e.tur] || '•'), h('span', null, tt('beyin.olay.' + e.tur, { x: ad }), ek ? h('em', null, ' · ' + String(ek).slice(0, 60)) : null), xp ? h('span', { class: 'beyinXpArti' }, '+' + xp + ' XP') : null);
    beyinAkis.prepend(li);
    while (beyinAkis.children.length > 4) beyinAkis.lastChild.remove();
    [...beyinAkis.children].forEach((c, i) => (c.style.opacity = String(1 - i * 0.22)));
    if (xp && beyinVeri) {
      beyinVeri.xp += xp;
      if (beyinVeri.xp >= beyinVeri.sinir) {
        beyinVeri.xp -= beyinVeri.sinir;
        beyinVeri.seviye++;
        beyinVeri.sinir = Math.round(beyinVeri.sinir * 1.18);
        bildir(tt('beyin.seviyeAtladi', { x: depo.sirket.beyin.ad, y: beyinVeri.seviye }));
      }
      beyinHudCiz();
    }
  }

  // sağ panel: Obsidian benzeri klasör ağacı ve not önizlemesi
  function beyinYanCiz() {
    const tt = depo.t;
    const v = beyinVeri;
    if (!v) return;
    const q = notAra.toLocaleLowerCase(depo.sirket.dil);
    const notlar = q ? v.notlar.filter((n) => n.baslik.toLocaleLowerCase(depo.sirket.dil).includes(q) || n.ozet.toLocaleLowerCase(depo.sirket.dil).includes(q)) : v.notlar;
    const gruplar = new Map();
    for (const n of notlar) {
      const k = n.klasor || '';
      if (!gruplar.has(k)) gruplar.set(k, []);
      gruplar.get(k).push(n);
    }
    const ara = h('input', { type: 'search', class: 'beyinAra', value: notAra, placeholder: tt('beyin.ara'), oninput: () => ((notAra = ara.value), beyinYanCiz(), document.querySelector('.beyinAra')?.focus()) });
    doldur(
      beyinYan,
      h('div', { class: 'beyinYanBas' }, h('b', null, tt('beyin.klasor')), h('button', { type: 'button', class: 'simge kucuk', title: tt('beyin.klasorAc'), onclick: () => api.beyinKlasorAc() }, ikon('disari', 14)), ara),
      h(
        'div',
        { class: 'beyinAgac' },
        notlar.length
          ? [...gruplar.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([k, liste]) => [
                h('div', { class: 'beyinDal' }, ikon('klasor', 13), h('span', null, k || tt('beyin.kok')), h('small', null, String(liste.length))),
                liste.slice(0, 60).map((n) => h('button', { type: 'button', class: 'beyinDal alt' + (seciliNot && seciliNot.id === n.id ? ' secili' : ''), onclick: () => notAc(n.id) }, h('span', null, n.baslik))),
              ])
          : h('p', { class: 'beyinBos' }, tt(q ? 'beyin.aramaBos' : 'beyin.notYok', { x: depo.sirket.beyin.ad }))
      ),
      seciliNot ? h('div', { class: 'beyinNot' }, h('h3', null, seciliNot.baslik), h('div', { class: 'beyinNotMeta' }, [seciliNot.bilgi.tur, seciliNot.bilgi.proje, seciliNot.bilgi.tarih].filter(Boolean).join(' · ')), notGovde(seciliNot.metin)) : null
    );
  }

  // basit Markdown: başlıklar, listeler, [[bağlantılar]] tıklanabilir
  function notGovde(metin) {
    const kap = h('div', { class: 'beyinNotGovde' });
    for (const satir of String(metin || '').split('\n').slice(0, 200)) {
      if (!satir.trim()) continue;
      if (/^#\s/.test(satir) && seciliNot && satir.slice(2).trim() === seciliNot.baslik) continue;
      const bas = /^(#{1,3})\s+(.*)$/.exec(satir);
      const el = bas ? h('h4') : /^\s*[-*]\s+/.test(satir) ? h('p', { class: 'madde' }) : h('p');
      const govde = bas ? bas[2] : satir.replace(/^\s*[-*]\s+/, '');
      let son = 0;
      for (const m of govde.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
        el.append(document.createTextNode(govde.slice(son, m.index)));
        const hedef = m[1].trim();
        el.append(h('a', { href: '#', onclick: (e) => (e.preventDefault(), notAcBaslik(hedef)) }, hedef));
        son = m.index + m[0].length;
      }
      el.append(document.createTextNode(govde.slice(son)));
      kap.append(el);
    }
    return kap;
  }

  async function notAc(id) {
    const r = await api.beyinNot(id);
    if (!r || !r.tamam) return;
    seciliNot = r.not;
    if (!beyinPanelAcik) {
      beyinPanelAcik = true;
      beyinGovde.classList.remove('panelKapali');
    }
    beyinYanCiz();
  }
  function notAcBaslik(baslik) {
    const n = beyinVeri && beyinVeri.notlar.find((x) => x.baslik.toLocaleLowerCase(depo.sirket.dil) === baslik.toLocaleLowerCase(depo.sirket.dil));
    if (n) notAc(n.id);
    else bildir(depo.t('beyin.notBulunamadi', { x: baslik }), true);
  }

  function beyinPanelCiz() {
    if (!binaPanel.contains(beyinGovde)) doldur(binaPanel, beyinGovde);
    beyinGovde.classList.toggle('panelKapali', !beyinPanelAcik);
    beyinKur();
    beyin3d.goster();
    beyinYenile();
  }

  // Kişisel kat: beynin odası ve her kişinin ayrı odası. Oda seçici boş katta kendiliğinden açılır.
  let odaSeciliyor = false;
  const odaSecim = new Set();
  function odaSeciciBolumu(kat) {
    const tt = depo.t;
    const mevcut = new Set(kat.ajanlar.map((a) => a.oda).filter(Boolean));
    const kurDugme = h('button', { type: 'button', class: 'dugme ana', disabled: !odaSecim.size }, tt('oda.kur', { x: odaSecim.size }));
    kurDugme.addEventListener('click', async () => {
      const r = await api.odaKur(kat.id, [...odaSecim]);
      if (!r || r.hata) return bildir(hataMetni(r), true);
      bildir(tt('oda.kuruldu', { x: r.kurulan.length }));
      odaSecim.clear();
      odaSeciliyor = false;
      binaCiz();
    });
    return h(
      'section',
      { class: 'odaSecBolum' },
      h('h3', null, tt(kat.ajanlar.length ? 'oda.ekleBaslik' : 'oda.secBaslik')),
      h('p', null, tt('oda.secAciklama')),
      odaSecici({ secili: odaSecim, mevcut, degisti: (x) => ((kurDugme.disabled = !x.size), (kurDugme.textContent = tt('oda.kur', { x: x.size }))) }),
      h(
        'div',
        { class: 'satirDugme' },
        kurDugme,
        h('button', { type: 'button', class: 'dugme', onclick: () => git('ekip') }, ikon('arti', 14), tt('oda.kendiKisin')),
        kat.ajanlar.length ? h('button', { type: 'button', class: 'dugme hayalet', onclick: () => ((odaSeciliyor = false), odaSecim.clear(), binaCiz()) }, tt('oda.vazgec')) : null
      )
    );
  }

  // Kişisel kat: petek görünümü. Ortada beynin odası, çevresinde kişilerin odaları, kenarda yeni oda ekleme.
  // Petek bir kez kurulur, yeniden çizimde yalnızca odalar güncellenir (kamera konumu korunur).
  let petekKap = null;
  let petekCizer = null;
  function odalarCiz() {
    const tt = depo.t;
    const kat = depo.sirket.projeler.find((p) => p.id === depo.sirket.sonProje);
    if (!petekKap) {
      petekKap = h('div', { class: 'petekKap' });
      petekCizer = petek(petekKap, {
        etiket: tt('kisisel.petekEtiket'),
        tikla: (o) => {
          if (o.tur === 'beyin') gorunumSec('beyin');
          else if (o.tur === 'ekle') {
            odaSeciliyor = true;
            binaCiz();
            setTimeout(() => binaPanel.querySelector('.odaSecBolum')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
          } else gorunumSec(o.anahtar);
        },
      });
    }
    const odalar = [
      { anahtar: 'beyin', tur: 'beyin', ad: depo.sirket.beyin.ad, alt: tt('kisisel.beyinOdasi'), acik: !!(depo.oturumlar.beyin || {}).acik },
      ...kat.ajanlar.map((a) => ({
        anahtar: `ozel:${kat.id}:${a.id}`,
        tur: 'kisi',
        ad: a.ad,
        alt: (a.unvan || tt('ekip.unvanYok')) + ' · ' + tt(a.mod === 'calisma' ? 'oda.calisma' : 'oda.sohbet'),
        oda: a.oda,
        renk: a.renk,
        gorunus: a.gorunus,
        acik: !!(depo.oturumlar[`ozel:${kat.id}:${a.id}`] || {}).acik,
      })),
      { anahtar: 'ekle', tur: 'ekle', ad: tt('oda.ekleBaslik') },
    ];
    doldur(
      binaPanel,
      h('header', { class: 'binaBas' }, h('h2', null, tt('kisisel.baslik')), h('p', null, tt('kisisel.aciklama', { x: depo.sirket.beyin.ad }))),
      petekKap,
      h('p', { class: 'petekIpucu' }, tt('kisisel.petekIpucu')),
      // klavye ve ekran okuyucu için: aynı odalar düğme olarak
      h(
        'ul',
        { class: 'gizliErisim' },
        odalar.map((o) => h('li', null, h('button', { type: 'button', onclick: () => (o.tur === 'beyin' ? gorunumSec('beyin') : o.tur === 'ekle' ? ((odaSeciliyor = true), binaCiz()) : gorunumSec(o.anahtar)) }, o.ad + (o.alt ? ' · ' + o.alt : ''))))
      ),
      !kat.ajanlar.length || odaSeciliyor ? odaSeciciBolumu(kat) : null
    );
    petekCizer.guncelle(odalar);
  }

  // Özel sohbetin odası: kim olduğu, gizlilik notu, ürettiği dosyalar ve dışa aktarma
  let odaDosya = { anahtar: null, ekler: [], ciktilar: [] };
  async function odaDosyalariYukle() {
    if (!ozelMi()) return;
    const anahtar = depo.gorunum;
    const r = await api.odaDosyalar(anahtar);
    if (r && !r.hata && depo.gorunum === anahtar) {
      odaDosya = { anahtar, ekler: r.ekler, ciktilar: r.ciktilar };
      odaCiz();
    }
  }

  function odaCiz() {
    const tt = depo.t;
    const o = ozelBilgi();
    if (!o) {
      doldur(binaPanel, h('div', { class: 'binaBos' }, h('p', null, tt('ozel.yok'))));
      return;
    }
    if (odaDosya.anahtar !== depo.gorunum) {
      odaDosya = { anahtar: depo.gorunum, ekler: [], ciktilar: [] };
      queueMicrotask(odaDosyalariYukle);
    }
    const sb = (depo.odaSablonlari || []).find((x) => x.id === o.ajan.oda);
    const calisma = o.ajan.mod === 'calisma';
    const disa = (bicim) => async () => {
      const r = await api.odaDisaAktar(depo.gorunum, bicim);
      if (r && r.hata) bildir(hataMetni(r), true);
      else if (r && r.tamam) bildir(tt('oda.kaydedildi', { x: r.yol }));
    };
    doldur(
      binaPanel,
      h(
        'header',
        { class: 'odaBas' },
        h('span', { class: 'odaSimge buyuk', style: `background:${o.ajan.renk}` }, sb ? ikon(sb.simge, 24) : o.ajan.ad.slice(0, 1)),
        h(
          'div',
          { class: 'odaKim' },
          h('h2', null, o.ajan.ad, h('span', { class: 'odaMod' + (calisma ? ' calisma' : '') }, tt(calisma ? 'oda.calisma' : 'oda.sohbet'))),
          h('p', null, (o.ajan.unvan ? o.ajan.unvan + ' · ' : '') + o.kat.ad)
        ),
        h(
          'div',
          { class: 'odaAraclar' },
          // başlık çubuğu gizli olduğu için oturumu bitirme düğmesi burada
          depo.oturum.acik && !depo.oturum.giris ? h('button', { type: 'button', class: 'dugme', onclick: () => api.oturumDurdur(depo.gorunum) }, ikon('dur', 12), tt('ozel.bitir')) : null,
          h('button', { type: 'button', class: 'dugme', title: tt('oda.mdIpucu'), onclick: disa('md') }, ikon('indir', 14), 'Markdown'),
          h('button', { type: 'button', class: 'dugme', title: tt('oda.pdfIpucu'), onclick: disa('pdf') }, ikon('indir', 14), 'PDF'),
          h('button', { type: 'button', class: 'simge', title: tt('oda.klasor'), onclick: () => api.odaKlasor(depo.gorunum) }, ikon('klasor', 16)),
          h('button', { type: 'button', class: 'simge', title: tt('ozel.kataDon', { x: o.kat.ad }), onclick: () => kataGit(o.kat.id) }, ikon('kapat', 16))
        )
      ),
      h('p', { class: 'odaNot' }, ikon('kalkan', 14), tt('ozel.gizlilik', { x: depo.sirket.beyin.ad })),
      odaDosya.ciktilar.length || odaDosya.ekler.length
        ? h(
            'div',
            { class: 'odaDosyalar' },
            odaDosya.ciktilar.length ? h('span', { class: 'odaDosyaBaslik' }, tt('oda.ciktilar')) : null,
            odaDosya.ciktilar.slice(0, 8).map((d) => h('button', { type: 'button', class: 'ekCip cikti', title: d.yol, onclick: () => api.odaAc(depo.gorunum, d.yol) }, ikon('dosya', 13), h('span', null, d.ad))),
            odaDosya.ekler.length ? h('span', { class: 'odaDosyaBaslik' }, tt('oda.ekler')) : null,
            odaDosya.ekler.slice(0, 6).map((d) => h('button', { type: 'button', class: 'ekCip', title: d.yol, onclick: () => api.odaAc(depo.gorunum, d.yol) }, ikon('dosya', 13), h('span', null, d.ad)))
          )
        : null
    );
  }

  // ---------- konuşma paneli ----------
  function sohbetYolla() {
    let metin = sohbetGiris.value.trim();
    if (!metin && !bekleyenEkler.length) return;
    if (!depo.oturum.acik || depo.oturum.giris) return bildir(depo.t('sohbet.kapali'), true);
    // ekler mesajın sonunda "[Ek] yol" satırları olarak gider: kişi dosyayı oradan okur, panel çip olarak gösterir
    if (bekleyenEkler.length) metin = (metin || depo.t('oda.eklerBak')) + '\n\n' + bekleyenEkler.map((e) => '[Ek] ' + e.yol).join('\n');
    api.sohbetYaz(seciliKat(), metin).then((r) => {
      if (r && r.hata) return bildir(hataMetni(r), true);
      sohbetGiris.value = '';
      bekleyenEkler = [];
      ekCiz();
      boyutla();
    });
  }

  async function dosyaEkle(yollar) {
    if (!ozelMi()) return;
    const r = await api.odaEkle(depo.gorunum, yollar);
    if (!r || r.hata) return r && r.hata && bildir(hataMetni(r), true);
    if (r.iptal) return;
    bekleyenEkler = [...bekleyenEkler, ...r.eklenen].slice(0, 10);
    ekCiz();
    odaDosyalariYukle();
    sohbetGiris.focus();
  }

  function ekCiz() {
    ekKap.hidden = !bekleyenEkler.length;
    doldur(
      ekKap,
      bekleyenEkler.map((e, i) =>
        h('span', { class: 'ekCip' }, ikon('dosya', 13), h('span', null, e.ad), h('button', { type: 'button', 'aria-label': depo.t('genel.kaldir'), onclick: () => ((bekleyenEkler = bekleyenEkler.filter((_, j) => j !== i)), ekCiz()) }, ikon('kapat', 12)))
      )
    );
  }

  // sürükle bırak: özel odada dosyalar sohbet alanına bırakılabilir
  sohbet.addEventListener('dragover', (e) => {
    if (!ozelMi()) return;
    e.preventDefault();
    sohbet.classList.add('birak');
  });
  sohbet.addEventListener('dragleave', () => sohbet.classList.remove('birak'));
  sohbet.addEventListener('drop', (e) => {
    sohbet.classList.remove('birak');
    if (!ozelMi()) return;
    e.preventDefault();
    const yollar = [...(e.dataTransfer.files || [])].map((f) => api.dosyaYolu(f)).filter(Boolean);
    if (yollar.length) dosyaEkle(yollar);
  });
  const boyutla = () => {
    sohbetGiris.style.height = 'auto';
    sohbetGiris.style.height = Math.min(140, sohbetGiris.scrollHeight) + 'px';
  };
  sohbetGiris.addEventListener('input', boyutla);
  sohbetGiris.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sohbetYolla();
    }
  });

  let sohbetIzi = '';
  function sohbetCiz() {
    const tt = depo.t;
    const acik = depo.oturum.acik && !depo.oturum.giris;
    const liste = depo.sohbet || [];
    const bekleyen = liste.filter((m) => m.acik).length;
    doldur(
      sohbetBas,
      h('span', { class: 'sohbetBaslik' }, tt('sohbet.baslik', { x: muhatap() })),
      bekleyen ? h('span', { class: 'sohbetRozet' }, tt('sohbet.bekliyor', { x: bekleyen })) : null,
      // beynin sesi açılıp kapatılabilir
      beyinMi() && depo.sirket.beyin.ses.tur !== 'yok'
        ? h(
            'button',
            {
              type: 'button',
              class: 'simge sohbetSes' + (sessizMi() ? ' kapali' : ''),
              title: tt(sessizMi() ? 'ses.ac' : 'ses.kapat'),
              'aria-pressed': sessizMi() ? 'true' : 'false',
              onclick: () => {
                sessizYap(!sessizMi());
                sohbetIzi = '';
                sohbetCiz();
              },
            },
            ikon(sessizMi() ? 'sessiz' : 'ses', 15)
          )
        : null
    );
    sohbetGiris.disabled = !acik;
    sohbetGonder.disabled = !acik;
    ekDugme.hidden = !ozelMi();
    ekDugme.disabled = !acik;
    if (!kayit) {
      mikDugme.disabled = !acik;
      mikDugme.title = tt('ses.konus');
    }
    ekDugme.title = tt('oda.ekle');
    ekDugme.setAttribute('aria-label', tt('oda.ekle'));
    sohbetGiris.placeholder = acik ? tt('sohbet.yerTutucu', { x: muhatap() }) : tt('sohbet.kapaliYer');
    sohbetGonder.setAttribute('aria-label', tt('sohbet.gonder'));
    sohbetGiris.title = tt('sohbet.ipucu');
    // cevap beklenirken "düşünüyor", oturum yeni açıldıysa "hazırlanıyor" göstergesi
    const son = liste[liste.length - 1];
    const dusunuyor = acik && son && son.kim === 'sen' && !liste.some((m) => m.acik);
    const gecen = acik ? Date.now() - (depo.oturum.baslangic || 0) : Infinity;
    const hazirlaniyor = acik && !liste.length && gecen < 7000;
    if (hazirlaniyor) setTimeout(() => sohbetCiz(), 7000 - gecen + 50);
    const iz = JSON.stringify([depo.gorunum, seciliKat(), acik, dusunuyor, hazirlaniyor, liste.length, liste.map((m) => m.id + (m.acik ? 1 : 0)).join(), depo.t('sohbet.baslik')]);
    if (iz === sohbetIzi) return;
    sohbetIzi = iz;
    const altta = sohbetListe.scrollHeight - sohbetListe.scrollTop - sohbetListe.clientHeight < 40;
    if (hazirlaniyor) {
      doldur(sohbetListe, h('li', { class: 'sohbetBos hazirlaniyor' }, h('span', { class: 'nabiz' }, h('i'), h('i'), h('i')), h('p', null, tt('sohbet.hazirlaniyor', { x: muhatap() }))));
      return;
    }
    if (!liste.length && ozelMi()) {
      doldur(sohbetListe, h('li', { class: 'sohbetBos odaBos' }, odaBosIcerik(acik)));
      return;
    }
    if (!liste.length) {
      doldur(sohbetListe, h('li', { class: 'sohbetBos' }, h('p', null, tt(acik ? (beyinMi() ? 'sohbet.bosAcikBeyin' : ozelMi() ? 'sohbet.bosAcikOzel' : 'sohbet.bosAcik') : beyinMi() ? 'sohbet.bosBeyin' : ozelMi() ? 'sohbet.bosOzel' : kisiselMi() ? 'sohbet.bosKisisel' : 'sohbet.bos', { x: muhatap() }))));
      return;
    }
    doldur(
      sohbetListe,
      liste.map((m) => {
        const kim = m.kim === 'sen' ? tt('sohbet.sen') : m.ad || tt('sohbet.sistem');
        const ust = h('div', { class: 'mesajUst' }, h('b', null, kim), h('time', null, saatYaz(m.z)));
        if (m.tur === 'onay') {
          return h(
            'li',
            { class: 'mesaj onay' + (m.acik ? ' acik' : '') },
            ust,
            h('p', { class: 'mesajBaslik' }, ikon('kalkan', 14), m.arac === 'guven' ? tt('sohbet.guvenBaslik') : tt('sohbet.onayIstiyor', { x: m.arac || '' })),
            m.arac === 'guven' ? h('p', { class: 'mesajNot' }, tt('sohbet.guvenAciklama')) : null,
            h('pre', { class: 'mesajKod' }, m.metin),
            m.acik
              ? h(
                  'div',
                  { class: 'satirDugme' },
                  h('button', { type: 'button', class: 'dugme ana', onclick: () => api.sohbetOnay(seciliKat(), true, m.id) }, ikon('tik', 13), tt(m.arac === 'guven' ? 'sohbet.guven' : 'sohbet.izinVer')),
                  h('button', { type: 'button', class: 'dugme', onclick: () => api.sohbetOnay(seciliKat(), false, m.id) }, tt('sohbet.reddet'))
                )
              : h('p', { class: 'mesajNot' }, tt(m.reddedildi ? 'sohbet.reddedildi' : 'sohbet.cevaplandi'))
          );
        }
        if (m.tur === 'soru') {
          return h(
            'li',
            { class: 'mesaj soru' + (m.acik ? ' acik' : '') },
            ust,
            (m.sorular || [{ soru: m.metin, secenekler: [] }]).map((q) =>
              h('div', { class: 'soruBlok' }, h('p', null, q.soru), q.secenekler.length ? h('ol', { class: 'secenekler' }, q.secenekler.map((x) => h('li', null, x))) : null)
            ),
            h('p', { class: 'mesajNot' }, tt(m.acik ? 'sohbet.soruIpucu' : 'sohbet.cevaplandi'))
          );
        }
        // sahibin yazdığı olduğu gibi (ekler çip olarak), şefin ve beynin cevabı biçimli gösterilir
        let govde;
        if (m.kim === 'sen') {
          const satirlar = m.metin.split('\n');
          const ekler = satirlar.filter((x) => x.startsWith('[Ek] ')).map((x) => x.slice(5));
          const yazi = satirlar.filter((x) => !x.startsWith('[Ek] ')).join('\n').trim();
          govde = h('div', null, yazi ? h('div', { class: 'mesajMetin' }, yazi) : null, ekler.length ? h('div', { class: 'ekSatir' }, ekler.map((y) => h('button', { type: 'button', class: 'ekCip', onclick: () => ozelMi() && api.odaAc(depo.gorunum, y) }, ikon('dosya', 13), h('span', null, y.split(/[\\/]/).pop())))) : null);
        } else govde = m.tur === 'hata' ? h('div', { class: 'mesajMetin' }, m.metin) : mdMetin(m.metin);
        return h('li', { class: 'mesaj ' + (m.kim === 'sen' ? 'sen' : m.kim === 'iletim' ? 'iletim' : m.tur === 'hata' ? 'hata' : 'sef') }, ust, govde);
      })
    );
    if (dusunuyor) sohbetListe.append(h('li', { class: 'mesaj sef dusunuyor', 'aria-label': tt('sohbet.dusunuyor', { x: muhatap() }) }, h('div', { class: 'mesajUst' }, h('b', null, muhatap())), h('span', { class: 'nokta' }, h('i'), h('i'), h('i'))));
    if (altta || liste[liste.length - 1].kim === 'sen' || bekleyen) sohbetListe.scrollTop = sohbetListe.scrollHeight;
  }

  // Özel odanın boş konuşması: kapalıysa başlat düğmeleri, açıksa örnek sorular
  function odaBosIcerik(acik) {
    const tt = depo.t;
    const o = ozelBilgi();
    if (!o) return h('p', null, tt('ozel.yok'));
    const sb = (depo.odaSablonlari || []).find((x) => x.id === o.ajan.oda);
    const ornekler = sb ? (sb[depo.sirket.dil] || sb.tr).ornekler || [] : [];
    const kayitli = depo.sirket.ozelOturumlar && depo.sirket.ozelOturumlar[`${o.kat.id}:${o.ajan.id}`];
    if (!acik) {
      return [
        h('p', null, tt('ozel.aciklama', { x: o.ajan.ad })),
        h(
          'div',
          { class: 'satirDugme ortala' },
          h('button', { type: 'button', class: 'dugme ana buyuk', onclick: () => baslat() }, ikon('gonder', 14), tt('ozel.baslat')),
          kayitli ? h('button', { type: 'button', class: 'dugme buyuk', onclick: () => baslat(true) }, ikon('yenile', 15), tt('ozel.surdur')) : null
        ),
      ];
    }
    return [
      h('p', null, tt('sohbet.bosAcikOzel', { x: o.ajan.ad })),
      ornekler.length
        ? h(
            'div',
            { class: 'ornekler' },
            ornekler.map((x) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'ornek',
                  onclick: () => {
                    sohbetGiris.value = x;
                    boyutla();
                    sohbetGiris.focus();
                  },
                },
                x
              )
            )
          )
        : null,
    ];
  }

  // ---------- yan panel: ekip ----------
  const satirlar = new Map();
  const yaz = (el, metin) => {
    if (el.textContent !== metin) el.textContent = metin;
  };

  function satirYap() {
    const avatar = h('span', { class: 'avatar' });
    const ad = h('div', { class: 'kimAd' });
    const alt = h('div', { class: 'kimAlt' });
    const is = h('div', { class: 'kimIs' });
    const hap = h('span', { class: 'hap' });
    const li = h('li', { class: 'satir' }, avatar, h('div', { class: 'kim' }, ad, alt, is), hap);
    return { li, avatar, ad, alt, is, hap, detay: null };
  }

  function detayYap(a, simdi) {
    const tt = depo.t;
    return h(
      'div',
      { class: 'detay' },
      h(
        'dl',
        null,
        h('dt', null, tt('detay.durumda')),
        h('dd', null, sure(simdi - a.durumZamani, tt)),
        h('dt', null, tt('detay.arac')),
        h('dd', null, a.aracSayisi),
        h('dt', null, tt('detay.gelis')),
        h('dd', null, saatYaz(a.gelis))
      ),
      a.gecmis.length
        ? h(
            'ul',
            null,
            a.gecmis
              .slice(-8)
              .reverse()
              .map((g) => h('li', null, h('time', null, saatYaz(g.z)), h('span', null, g.metin)))
          )
        : h('div', { class: 'bosYazi' }, tt('detay.yok'))
    );
  }

  function ekipCiz() {
    const tt = depo.t;
    const simdi = Date.now();
    const canli = depo.canli.ajanlar;
    const istenen = [];
    // şirket kadrosu: şef, sonra çalışanlar. Ofiste olmayan soluk görünür.
    const kadro = [{ id: 'sef', ...depo.sirket.sef }, ...depo.sirket.ajanlar];
    for (const k of kadro) {
      const buradakiler = canli.filter((a) => a.rol === k.id);
      if (!buradakiler.length) istenen.push({ anahtar: 'yok:' + k.id, k, a: null });
      for (const a of buradakiler) istenen.push({ anahtar: a.id, k, a });
    }
    for (const a of canli.filter((x) => x.rol === 'misafir')) istenen.push({ anahtar: a.id, k: { ad: a.ad, unvan: tt('misafir.unvan'), alanlar: [], renk: MISAFIR_RENK }, a });

    const gecerli = new Set(istenen.map((x) => x.anahtar));
    for (const [anahtar, s] of satirlar) {
      if (!gecerli.has(anahtar)) {
        s.li.remove();
        satirlar.delete(anahtar);
      }
    }
    istenen.forEach(({ anahtar, k, a }, i) => {
      let s = satirlar.get(anahtar);
      if (!s) {
        s = satirYap();
        satirlar.set(anahtar, s);
      }
      if (ekipEl.children[i] !== s.li) ekipEl.insertBefore(s.li, ekipEl.children[i] || null);
      s.avatar.style.background = k.renk;
      yaz(s.avatar, basHarf(a ? a.ad : k.ad));
      yaz(s.ad, a ? a.ad : k.ad);
      yaz(s.alt, [k.unvan, ...(k.alanlar || []).slice(0, 2)].filter(Boolean).join(' · '));
      if (!a) {
        s.li.className = 'satir yok';
        s.li.removeAttribute('data-id');
        s.li.removeAttribute('tabindex');
        yaz(s.is, '');
        yaz(s.hap, tt('durum.yok'));
        s.hap.removeAttribute('data-d');
        if (s.detay) {
          s.detay.remove();
          s.detay = null;
        }
        return;
      }
      const kisi = sahne.kisiler.get(a.id);
      const is = a.durum === 'bosta' ? (kisi && YER[kisi.kat] ? tt(YER[kisi.kat]) : tt('durum.bosta')) + ' · ' + sure(simdi - a.durumZamani, tt) : a.ozet || '';
      s.li.className = 'satir' + (secili === a.id ? ' secili' : '');
      s.li.setAttribute('data-id', a.id);
      s.li.setAttribute('tabindex', '0');
      s.li.setAttribute('role', 'button');
      yaz(s.is, is);
      yaz(s.hap, tt('durum.' + a.durum));
      s.hap.setAttribute('data-d', a.durum);
      if (secili === a.id) {
        const yeni = detayYap(a, simdi);
        if (s.detay) s.detay.replaceWith(yeni);
        else s.li.append(yeni);
        s.detay = yeni;
      } else if (s.detay) {
        s.detay.remove();
        s.detay = null;
      }
    });
    yaz(ekipAdet, canli.length ? tt('ekip.ofiste', { x: canli.length }) : '');
  }

  function sec(id) {
    secili = secili === id ? null : id;
    sahne.sec(secili);
    if (secili) sahne.odakla(secili);
    ekipCiz();
  }
  ekipEl.addEventListener('click', (e) => {
    if (e.target.closest('.detay')) return;
    const li = e.target.closest('[data-id]');
    if (li) sec(li.getAttribute('data-id'));
  });
  ekipEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('[data-id]');
    if (li) {
      e.preventDefault();
      sec(li.getAttribute('data-id'));
    }
  });

  // ---------- görevler ve akış ----------
  function gorevCiz() {
    const tt = depo.t;
    const g = depo.canli.gorevler;
    if (!g.length) {
      doldur(gorevEl, h('div', { class: 'bosYazi' }, tt('gorev.yok')));
      yaz(gorevAdet, '');
      return;
    }
    const say = (d) => g.filter((x) => x.durum === d).length;
    const acik = [...g.filter((x) => x.durum === 'suruyor'), ...g.filter((x) => x.durum === 'bekliyor')];
    doldur(
      gorevEl,
      h(
        'div',
        { class: 'gorevSayac' },
        h('div', null, h('b', null, say('bekliyor')), h('span', null, tt('pano.bekliyorK'))),
        h('div', null, h('b', null, say('suruyor')), h('span', null, tt('pano.suruyorK'))),
        h('div', null, h('b', null, say('bitti')), h('span', null, tt('pano.bittiK')))
      ),
      acik.length
        ? h(
            'ul',
            { class: 'gorevListe' },
            acik.map((x) => {
              const isaret = h('span', { class: 'isaret' });
              if (x.renk && x.durum === 'suruyor') isaret.style.background = x.renk;
              return h('li', { 'data-d': x.durum, title: x.baslik }, isaret, h('span', { class: 'gBaslik' }, x.baslik), x.sahip ? h('span', { class: 'gSahip' }, x.sahip) : null);
            })
          )
        : h('div', { class: 'bosYazi' }, tt('gorev.kalmadi'))
    );
    yaz(gorevAdet, tt('gorev.adet', { x: g.length }));
  }

  let akisIz = '';
  function akisCiz(zorla) {
    const tt = depo.t;
    const liste = depo.canli.akis.slice(-70).reverse();
    const iz = liste.length + ':' + (liste[0] ? liste[0].z + liste[0].metin : '');
    if (iz === akisIz && !zorla) return;
    akisIz = iz;
    if (!liste.length) {
      doldur(akisEl, h('li', null, h('span'), h('span', { class: 'ne' }, tt('akis.yok'))));
      return;
    }
    doldur(
      akisEl,
      liste.map((o) => {
        const b = o.rol ? kisiBilgi(o.rol) : null;
        return h('li', { 'data-t': o.tur }, h('time', null, saatYaz(o.z)), h('div', null, h('span', { class: 'kimden', yaziRenk: b ? b.renk : '#8C94A6' }, o.ad), ' ', h('span', { class: 'ne' }, o.metin)));
      })
    );
  }

  function bosCiz() {
    const tt = depo.t;
    const bos = !panelMi() && !depo.canli.ajanlar.length;
    bosKart.hidden = !bos;
    if (!bos) return;
    doldur(bosKart, h('h3', null, tt('bos.baslik')), h('p', null, tt(depo.sirket.ajanlar.length ? 'bos.aciklama' : 'bos.kimseYok', { x: depo.sirket.sef.ad })));
  }

  function metinleriYaz() {
    const tt = depo.t;
    yaz(yanBaslik.ekip, tt('yan.ekip'));
    yaz(yanBaslik.gorev, tt('yan.gorevler'));
    yaz(yanBaslik.akis, tt('yan.akis'));
    yakinlik.querySelector('.sigdir').textContent = tt('sahne.sigdir');
  }

  // ---------- abonelikler ----------
  dinle('sirket', () => {
    sahne.sirketAl(depo.sirket, depo.t);
    katSeritCiz();
    binaCiz();
    sohbetCiz();
    metinleriYaz();
    ekipCiz();
    gorevCiz();
    akisCiz(true);
    bosCiz();
    dockCiz();
  });
  dinle('canli', () => {
    if (secili && !depo.canli.ajanlar.some((a) => a.id === secili)) {
      secili = null;
      sahne.sec(null);
    }
    sahne.veriAl(depo.canli);
    ekipCiz();
    gorevCiz();
    akisCiz();
    bosCiz();
  });
  let dosyaZ = null;
  dinle('sohbet', () => {
    sohbetCiz();
    // odadaki kişi yeni bir şey ürettiyse çıktı listesi yenilenir
    if (ozelMi()) {
      clearTimeout(dosyaZ);
      dosyaZ = setTimeout(odaDosyalariYukle, 600);
    }
  });
  dinle('kat', () => {
    binaCiz();
    termBagla();
    kaldiYukle();
    dockCiz();
    katSeritCiz();
    sohbetCiz();
  });
  dinle('oturum', () => {
    katSeritCiz();
    binaCiz();
    sohbetCiz();
    termBagla();
    // giriş ekranı gibi başka yerden açılan oturumlarda terminal henüz kurulmamış olabilir
    if (depo.oturum.acik && !term) {
      termKur();
      kullanildi = true;
      requestAnimationFrame(() => {
        sigdirTerm();
        if (term) term.focus();
      });
    }
    dockCiz();
    if (!depo.oturum.acik) kaldiYukle();
  });
  dinle('bilgi', () => dockCiz());
  dinle('skiller', () => dockCiz());
  setInterval(() => kok.isConnected && !kok.hidden && ekipCiz(), 1000);

  sahne.sirketAl(depo.sirket, depo.t);
  sahne.veriAl(depo.canli);
  metinleriYaz();
  ekipCiz();
  gorevCiz();
  akisCiz(true);
  bosCiz();
  katSeritCiz();
  binaCiz();
  sohbetCiz();
  if (depo.oturum.acik) {
    requestAnimationFrame(() => {
      termKur();
      kullanildi = true;
      sirketIzi = izHesapla();
      dockCiz();
    });
  }
  dockCiz();

  return {
    kok,
    sahne,
    goster() {
      sahne.calisiyor = true;
      if (beyin3d && beyinMi()) beyin3d.goster();
      if (!depo.oturum.acik) {
        dockCiz();
        kaldiYukle();
      }
      requestAnimationFrame(() => {
        sahne.boyutla();
        sigdirTerm();
      });
    },
    gizle() {
      sahne.calisiyor = false;
      if (beyin3d) beyin3d.gizle();
    },
  };
}
