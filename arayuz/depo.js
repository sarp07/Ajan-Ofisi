// Arayüzün ortak durumu: şirket, kurulu skiller, canlı ofis görüntüsü, oturum.
import { cevirici } from '../cekirdek/dil.js';
import { ARAYUZ } from './metin.js';

export const api = window.ofis;

export const depo = {
  sirket: null,
  skiller: [],
  katalog: [],
  sablonlar: [],
  bilgi: {},
  // seçili katın oturumu ve canlı görüntüsü. Bütün katlarınki oturumlar / canlilar / sohbetler içinde.
  oturum: { acik: false },
  oturumlar: {},
  canli: { ajanlar: [], gorevler: [], akis: [], oturumlar: [], yogunluk: 0 },
  canlilar: {},
  sohbet: [],
  sohbetler: {},
  // 'kat': seçili projenin katı, 'beyin': beynin konuşması ve bina özeti, 'ozel:<kat>:<ajan>': bire bir özel sohbet
  gorunum: 'kat',
  t: (k) => k,
};

const dinleyiciler = new Map();

export function dinle(konu, fn) {
  if (!dinleyiciler.has(konu)) dinleyiciler.set(konu, new Set());
  dinleyiciler.get(konu).add(fn);
  return () => dinleyiciler.get(konu).delete(fn);
}

export function yayinla(konu) {
  for (const fn of dinleyiciler.get(konu) || []) fn();
}

export function sirketKoy(sirket) {
  const dilDegisti = !depo.sirket || depo.sirket.dil !== sirket.dil;
  depo.sirket = sirket;
  if (dilDegisti) {
    depo.t = cevirici(ARAYUZ, sirket.dil);
    document.documentElement.lang = sirket.dil;
  }
  yayinla('sirket');
  return dilDegisti;
}

export async function yukle() {
  const b = await api.baslangic();
  depo.skiller = b.skiller;
  depo.katalog = b.katalog;
  depo.sablonlar = b.sablonlar;
  depo.odaSablonlari = b.odaSablonlari || [];
  depo.guncelleme = b.guncelleme || null;
  depo.yenilikler = b.yenilikler || null;
  depo.bilgi = b.bilgi;
  depo.oturumlar = b.oturumlar || {};
  sirketKoy(b.sirket);
  depo.canli = await api.durumAl();
  if (depo.sirket.sonProje) depo.canlilar[depo.sirket.sonProje] = depo.canli;
  depo.sohbet = await api.sohbetAl();
  if (depo.sirket.sonProje) depo.sohbetler[depo.sirket.sonProje] = depo.sohbet;
  seciliyiGuncelle();
  api.sirketDinle((s) => {
    const katDegisti = !depo.sirket || depo.sirket.sonProje !== s.sonProje;
    sirketKoy(s);
    if (katDegisti) katDegisti_();
  });
  api.durumDinle((v) => {
    depo.canlilar[v.kat] = v;
    if (v.kat === seciliKat()) {
      depo.canli = v;
      yayinla('canli');
    }
  });
  api.sohbetDinle((v) => {
    if (v.kat === 'beyin') beyinSesi(v.liste);
    depo.sohbetler[v.kat] = v.liste;
    if (v.kat === seciliKat()) {
      depo.sohbet = v.liste;
      yayinla('sohbet');
    }
  });
  api.bilgiDinle((v) => {
    depo.bilgi = v;
    yayinla('bilgi');
  });
  api.oturumDinle((v) => {
    depo.oturumlar = v || {};
    seciliyiGuncelle();
    yayinla('oturum');
  });
}

// Beynin yeni cevabı sesli okunur (ses seçildiyse ve kapatılmadıysa)
let sonOkunan = null;
async function beyinSesi(liste) {
  const son = [...liste].reverse().find((m) => m.kim === 'sef' && m.tur === 'mesaj');
  if (!son || son.id === sonOkunan) return;
  const ilk = sonOkunan === null && (depo.sohbetler.beyin || []).some((m) => m.id === son.id);
  sonOkunan = son.id;
  if (ilk) return;
  const { konus, sessizMi } = await import('./ses.js');
  if (sessizMi()) return;
  const r = await konus(son.metin);
  if (r && r.hata) bildir(hataMetni(r), true);
}

// Seçili kat: Ofis sayfasında görünen proje ya da beyin. Abonelik girişi açıksa terminal onu gösterir.
export const seciliKat = () => (depo.gorunum === 'beyin' || depo.gorunum.startsWith('ozel:') || depo.gorunum.startsWith('tasarim:') ? depo.gorunum : (depo.sirket && depo.sirket.sonProje) || '');

export function gorunumSec(g) {
  if (depo.gorunum === g) return;
  depo.gorunum = g;
  katDegisti_();
}

function seciliyiGuncelle() {
  const giris = depo.oturumlar.giris;
  depo.oturum = giris && giris.acik ? giris : depo.oturumlar[seciliKat()] || { acik: false };
}

// Kat değişince o katın canlı görüntüsü ve konuşması yüklenir
async function katDegisti_() {
  const kat = seciliKat();
  seciliyiGuncelle();
  depo.canli = depo.canlilar[kat] || (await api.durumAl(kat));
  depo.sohbet = depo.sohbetler[kat] || (await api.sohbetAl(kat));
  yayinla('kat');
  yayinla('canli');
  yayinla('sohbet');
  yayinla('oturum');
}

// Terminalin bağlı olduğu oturum: giriş açıksa giriş, değilse seçili kat
export const terminalKati = () => (depo.oturumlar.giris && depo.oturumlar.giris.acik ? 'giris' : seciliKat());

// Ofisteki kişinin şirketteki kaydı
export function kisiBilgi(rolId) {
  const s = depo.sirket;
  if (rolId === 'sef') return { ...s.sef, id: 'sef', sef: true };
  return s.ajanlar.find((a) => a.id === rolId) || null;
}

let bildirimZ = null;
export function bildir(metin, kotu = false) {
  const el = document.getElementById('bildirim');
  el.textContent = metin;
  el.className = 'bildirim' + (kotu ? ' kotu' : '');
  el.hidden = false;
  clearTimeout(bildirimZ);
  bildirimZ = setTimeout(() => (el.hidden = true), kotu ? 9000 : 5000);
}

// Ana süreçten gelen hata kodunu okunur metne çevirir
export function hataMetni(s) {
  const t = depo.t;
  const anahtar = 'hata.' + (s && s.hata);
  const m = t(anahtar);
  const taban = m === anahtar ? t('hata.genel') : m;
  return s && s.ayrinti ? taban + ' ' + s.ayrinti : taban;
}
