// Uygulama arkadayken ekranın köşesinde çıkan küçük güncelleme penceresi
import { doldur } from './dom.js';
import { cevirici } from '../cekirdek/dil.js';
import { ARAYUZ } from './metin.js';
import { guncellemeIcerik } from './guncelleme.js';

const api = window.ofis;
const kok = document.getElementById('kok');
let t = cevirici(ARAYUZ, 'tr');
let durum = null;

const eylem = {
  indir: () => api.guncellemeIndir(),
  kur: () => api.guncellemeKur(),
  sonra: () => api.guncellemeSonra(),
  uygulamadaAc: () => api.guncellemeUygulamadaAc(),
};

const ciz = () => doldur(kok, guncellemeIcerik(durum, t, eylem, { kucuk: true }));

api.guncellemeDinle((d) => {
  durum = d;
  ciz();
});

(async () => {
  const b = await api.baslangic();
  t = cevirici(ARAYUZ, b.sirket.dil);
  document.documentElement.lang = b.sirket.dil;
  durum = await api.guncellemeDurum();
  ciz();
})();
