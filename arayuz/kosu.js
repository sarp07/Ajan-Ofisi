// İnternet yokken oynanan küçük koşu oyunu. Dinozor ve engeller burada piksel piksel çizilir, dışarıdan görsel kullanılmaz.
// Space, ↑ ya da tıklama zıplatır, ↓ eğilir. Skor arttıkça hız artar. En yüksek skor bu bilgisayarda saklanır.

const G = 640; // mantıksal genişlik
const Y = 180; // mantıksal yükseklik
const ZEMIN = 150;
const PIKSEL = 3;

// 1: dolu piksel. Dinozor iki adım karesi ve eğilme karesiyle çizilir.
const DINO = [
  '..........1111111.',
  '.........111111111',
  '.........11.111111',
  '.........111111111',
  '.........111111111',
  '.........11111....',
  '1.......1111111...',
  '1......1111111....',
  '11...111111111....',
  '111111111111111...',
  '.11111111111......',
  '..111111111.......',
  '...1111111........',
];
const ADIM = [
  ['....11..11........', '....1....11.......'],
  ['....11...1........', '....1.....11......'],
];
const EGIK = [
  '......................',
  '.............11111111.',
  '1...........111.111111',
  '11.......1111111111111',
  '1111111111111111111...',
  '.111111111111111......',
  '..11111111111.........',
  '...11..11.............',
  '...1....11............',
];
const KAKTUS = ['..11..', '..11..', '1.11..', '1.11.1', '111111', '..1111', '..11..', '..11..', '..11..', '..11..'];
const KUS = [
  ['....1.........', '...111........', '..11111.......', '111111111111..', '....1111111111', '.....111......'],
  ['..............', '..............', '..11111.......', '111111111111..', '....1111111111', '....111.......', '...11.........'],
];

function cizSekil(c, sekil, x, y, renk) {
  c.fillStyle = renk;
  sekil.forEach((satir, i) => {
    for (let j = 0; j < satir.length; j++) if (satir[j] === '1') c.fillRect(x + j * PIKSEL, y + i * PIKSEL, PIKSEL, PIKSEL);
  });
}

const genislik = (sekil) => Math.max(...sekil.map((s) => s.length)) * PIKSEL;
const yukseklik = (sekil) => sekil.length * PIKSEL;

export function kosuOyunu(tuval, { yazilar }) {
  const c = tuval.getContext('2d');
  const oran = window.devicePixelRatio || 1;
  tuval.width = G * oran;
  tuval.height = Y * oran;
  c.scale(oran, oran);
  const stil = getComputedStyle(document.documentElement);
  const renk = { dino: stil.getPropertyValue('--vurgu').trim() || '#17b8a6', engel: stil.getPropertyValue('--soluk').trim() || '#98a0b2', zemin: stil.getPropertyValue('--cizgi2').trim() || '#343b4b', yazi: stil.getPropertyValue('--yazi').trim() || '#e9ecf2' };

  let rekor = 0;
  try {
    rekor = Number(localStorage.getItem('ofis.kosuRekor')) || 0;
  } catch {
    rekor = 0;
  }

  let durum = 'bekle'; // bekle | oyna | bitti
  let dinoY = 0; // zeminden yükseklik
  let hiz = 0;
  let hizY = 0;
  let egik = false;
  let skor = 0;
  let engeller = [];
  let sonraki = 0;
  let kare = 0;
  let zeminKay = 0;
  let istek = 0;
  let son = 0;

  function sifirla() {
    dinoY = 0;
    hizY = 0;
    hiz = 6;
    skor = 0;
    engeller = [];
    sonraki = 40;
    egik = false;
  }

  function zipla() {
    if (durum !== 'oyna') {
      sifirla();
      durum = 'oyna';
      return;
    }
    if (dinoY === 0) hizY = 11.5;
  }

  function engelEkle() {
    const kus = skor > 400 && Math.random() < 0.3;
    if (kus) {
      const yuk = [18, 46, 70][Math.floor(Math.random() * 3)];
      engeller.push({ tur: 'kus', x: G + 10, yuk });
    } else {
      const adet = 1 + Math.floor(Math.random() * (skor > 250 ? 3 : 2));
      engeller.push({ tur: 'kaktus', x: G + 10, adet });
    }
    sonraki = 45 + Math.random() * 60 - Math.min(20, hiz * 1.5);
  }

  function kutu(e) {
    if (e.tur === 'kus') {
      const k = KUS[0];
      return { x: e.x, y: ZEMIN - e.yuk - yukseklik(k), g: genislik(k), y2: yukseklik(k) };
    }
    const g = genislik(KAKTUS) * e.adet + (e.adet - 1) * 3;
    return { x: e.x, y: ZEMIN - yukseklik(KAKTUS), g, y2: yukseklik(KAKTUS) };
  }

  function dinoKutu() {
    const sekil = egik && dinoY === 0 ? EGIK : DINO;
    const yuk = yukseklik(sekil) + (sekil === DINO ? 2 * PIKSEL : 0);
    // çarpışma kutusu biraz içeriden: dokunur dokunmaz yanmasın
    return { x: 40 + 6, y: ZEMIN - dinoY - yuk + 6, g: genislik(sekil) - 14, y2: yuk - 10 };
  }

  const carpisti = (a, b) => a.x < b.x + b.g && a.x + a.g > b.x && a.y < b.y + b.y2 && a.y + a.y2 > b.y;

  function guncelle() {
    kare++;
    if (durum !== 'oyna') return;
    skor += hiz / 6;
    hiz = Math.min(15, 6 + skor / 300);
    zeminKay = (zeminKay + hiz) % 24;
    if (dinoY > 0 || hizY > 0) {
      dinoY += hizY;
      hizY -= egik ? 1.6 : 0.75;
      if (dinoY <= 0) {
        dinoY = 0;
        hizY = 0;
      }
    }
    for (const e of engeller) e.x -= hiz * (e.tur === 'kus' ? 1.1 : 1);
    engeller = engeller.filter((e) => e.x > -80);
    if (--sonraki <= 0) engelEkle();
    const d = dinoKutu();
    if (engeller.some((e) => carpisti(d, kutu(e)))) {
      durum = 'bitti';
      if (Math.floor(skor) > rekor) {
        rekor = Math.floor(skor);
        try {
          localStorage.setItem('ofis.kosuRekor', String(rekor));
        } catch {
          /* depolama kapalı */
        }
      }
    }
  }

  function ciz() {
    c.clearRect(0, 0, G, Y);
    // zemin ve kayan taşlar
    c.fillStyle = renk.zemin;
    c.fillRect(0, ZEMIN, G, 2);
    for (let x = -zeminKay; x < G; x += 24) c.fillRect(x + ((x * 7) % 11), ZEMIN + 7 + ((x * 3) % 5), 3, 2);
    for (const e of engeller) {
      if (e.tur === 'kus') cizSekil(c, KUS[Math.floor(kare / 10) % 2], e.x, ZEMIN - e.yuk - yukseklik(KUS[0]), renk.engel);
      else for (let i = 0; i < e.adet; i++) cizSekil(c, KAKTUS, e.x + i * (genislik(KAKTUS) + 3), ZEMIN - yukseklik(KAKTUS), renk.engel);
    }
    // dinozor
    if (egik && dinoY === 0 && durum === 'oyna') cizSekil(c, EGIK, 40, ZEMIN - yukseklik(EGIK), renk.dino);
    else {
      const govdeY = ZEMIN - dinoY - yukseklik(DINO) - 2 * PIKSEL;
      cizSekil(c, DINO, 40, govdeY, renk.dino);
      const ayak = durum === 'oyna' && dinoY === 0 ? ADIM[Math.floor(kare / 6) % 2] : ADIM[0];
      cizSekil(c, ayak, 40, govdeY + yukseklik(DINO), renk.dino);
    }
    // skor
    c.fillStyle = renk.yazi;
    c.font = '600 13px ui-monospace, Menlo, monospace';
    c.textAlign = 'right';
    c.fillText(`${yazilar.rekor} ${String(rekor).padStart(5, '0')}   ${String(Math.floor(skor)).padStart(5, '0')}`, G - 10, 22);
    if (durum !== 'oyna') {
      c.textAlign = 'center';
      c.font = '600 14px system-ui, sans-serif';
      c.fillText(durum === 'bitti' ? yazilar.bitti : yazilar.basla, G / 2, 70);
    }
  }

  function dongu(z) {
    istek = requestAnimationFrame(dongu);
    // ekran tazeleme hızından bağımsız: saniyede 60 adım
    if (!son) son = z;
    let fark = Math.min(100, z - son);
    while (fark >= 1000 / 60) {
      guncelle();
      fark -= 1000 / 60;
      son += 1000 / 60;
    }
    ciz();
  }

  const tus = (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      zipla();
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      egik = true;
    }
  };
  const birak = (e) => e.code === 'ArrowDown' && (egik = false);
  tuval.addEventListener('pointerdown', zipla);
  window.addEventListener('keydown', tus);
  window.addEventListener('keyup', birak);
  sifirla();
  istek = requestAnimationFrame(dongu);

  return {
    durdur() {
      cancelAnimationFrame(istek);
      window.removeEventListener('keydown', tus);
      window.removeEventListener('keyup', birak);
    },
  };
}
