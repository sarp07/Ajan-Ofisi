// Küçük DOM yardımcıları. Satır içi HTML yok: her şey createElement ile kurulur.
export const $ = (secici, kok = document) => kok.querySelector(secici);

export function h(etiket, ozellik, ...cocuk) {
  const el = document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellik || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'renk') el.style.background = v;
    else if (k === 'yaziRenk') el.style.color = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'disabled') el.disabled = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  ekle(el, cocuk);
  return el;
}

export function ekle(el, cocuk) {
  for (const c of [cocuk].flat(4)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function doldur(el, ...cocuk) {
  el.replaceChildren();
  return ekle(el, cocuk);
}

const IKON = {
  ofis: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M9 10h.01M15 10h.01',
  ekip: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  skill: 'M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z',
  kural: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  ayar: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z',
  arti: 'M12 5v14M5 12h14',
  cop: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  oynat: 'M7 4.5v15l12-7.5-12-7.5z',
  dur: 'M6.5 6.5h11v11h-11z',
  klasor: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 9.7v8.8A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-11z',
  yenile: 'M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5',
  kapat: 'M6 6l12 12M18 6L6 18',
  asagi: 'M6 9l6 6 6-6',
  yukari: 'M6 15l6-6 6 6',
  sihir: 'M5 19L15 9M14 5l.7 1.8L16.5 7.5l-1.8.7L14 10l-.7-1.8L11.5 7.5l1.8-.7L14 5zM19 12l.5 1.3 1.3.5-1.3.5L19 15.6l-.5-1.3-1.3-.5 1.3-.5L19 12zM7 4l.4 1 1 .4-1 .4L7 6.8l-.4-1-1-.4 1-.4L7 4z',
  kopya: 'M9 9h10v11H9zM5 15V4h10',
  tik: 'M5 12.5l4.5 4.5L19 7.5',
  disari: 'M14 5h5v5M19 5l-8 8M11 6H6v12h12v-5',
  goz: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.7a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4z',
  kalem: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  proje: 'M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11zM4 9.5h16M8 13h5M8 16h8',
  defter: 'M6 4h11a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM5 18a2 2 0 0 1 2-2h11M9 8h6M9 11.5h4',
  saat: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  zil: 'M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2zM10 20.5a2 2 0 0 0 4 0',
  dunya: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18',
  ucgen: 'M12 4l9 16H3l9-16zM12 10v4.5M12 17.2v.3',
  gonder: 'M4.5 12h13M12.5 6l6 6-6 6',
  geri: 'M19 12H6M11 6l-6 6 6 6',
  mik: 'M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3zM6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6',
  kalp: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  dosya: 'M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5zM14 3.5V8h4M9 12.5h6M9 16h6',
  indir: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14',
  ekran: 'M3.5 5h17v11h-17zM9 20h6M12 16v4',
  telefon: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  tablet: 'M6.5 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  android: 'M7 9h10v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9zM7 9a5 5 0 0 1 10 0M9.5 6.5L8 4.5M14.5 6.5L16 4.5M10 18v2.5M14 18v2.5',
  konsol: 'M4 5.5h16v13H4zM7.5 10l2.5 2-2.5 2M12 14.5h4',
  dal: 'M7 4v11M7 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM17 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17 9c0 4-10 2-10 6',
  bulut: 'M7.5 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18.4 10a4.2 4.2 0 0 1-.9 8.5h-10z',
  hedef: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  megafon: 'M4 10v4h3l7 4.5v-13L7 10H4zM17.5 9a4 4 0 0 1 0 6M7 14l1.5 5.5',
  firca: 'M14.5 4.5l5 5-8 8-5-5 8-8zM6.5 12.5l-2 6.5 6.5-2',
  kod: 'M8.5 7l-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15',
  kasa: 'M4.5 6.5h15v12h-15zM4.5 10.5h15M8 14.5h3',
  kosu: 'M14 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9 21l2.5-6 2.5 2v4M6.5 11.5l3-3.5 4 1 2 3h3M11.5 15l1-5',
  buyutec: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM15.5 15.5l5 5',
  ileriOk: 'M5 12h13M13 6l6 6-6 6',
  kalkan: 'M12 3.5l7 2.8v5.2c0 4.4-3 7.9-7 9-4-1.1-7-4.6-7-9V6.3l7-2.8zM9 12l2.2 2.2L15.5 10',
  beyin: 'M9.5 4.5a3 3 0 0 0-3 3v.3a3 3 0 0 0-2 5.2 3 3 0 0 0 2.5 4.8 2.8 2.8 0 0 0 5 1.2V5.7a2.4 2.4 0 0 0-2.5-1.2zM14.5 4.5a3 3 0 0 1 3 3v.3a3 3 0 0 1 2 5.2 3 3 0 0 1-2.5 4.8 2.8 2.8 0 0 1-5 1.2',
  ses: 'M5 9.5h3l4-3.5v12l-4-3.5H5v-5zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11',
  sessiz: 'M5 9.5h3l4-3.5v12l-4-3.5H5v-5zM16 9.5l5 5M21 9.5l-5 5',
};

export function ikon(ad, boyut = 18) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', boyut);
  svg.setAttribute('height', boyut);
  svg.setAttribute('fill', ad === 'oynat' || ad === 'dur' ? 'currentColor' : 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', ad === 'oynat' || ad === 'dur' ? '0' : '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', IKON[ad] || '');
  svg.append(p);
  return svg;
}

// Etiketli form alanı
export function alan(etiket, kontrol, ipucu) {
  return h('label', { class: 'alan' }, h('span', { class: 'alanEtiket' }, etiket), kontrol, ipucu ? h('span', { class: 'alanIpucu' }, ipucu) : null);
}

// Açık kapalı anahtar
export function anahtar(acik, degisti, etiket) {
  const giris = h('input', { type: 'checkbox', checked: acik, onchange: () => degisti(giris.checked) });
  return h('label', { class: 'anahtar' }, giris, h('span', { class: 'anahtarRay' }), etiket ? h('span', { class: 'anahtarEtiket' }, etiket) : null);
}

// Etiket girişi: Enter ya da virgülle eklenir
export function cipGirisi(degerler, degisti, yerTutucu, enCok = 8) {
  const kap = h('div', { class: 'cipGiris' });
  let liste = degerler.slice();
  const giris = h('input', { type: 'text', placeholder: yerTutucu || '' });
  const ciz = () => {
    doldur(
      kap,
      liste.map((d, i) =>
        h(
          'span',
          { class: 'cip' },
          d,
          h('button', {
            type: 'button',
            'aria-label': 'x',
            onclick: () => {
              liste.splice(i, 1);
              degisti(liste.slice());
              ciz();
            },
          }, '×')
        )
      ),
      giris
    );
  };
  const ekleDeger = () => {
    const v = giris.value.replace(/,/g, '').trim();
    if (v && !liste.includes(v) && liste.length < enCok) {
      liste.push(v);
      degisti(liste.slice());
    }
    giris.value = '';
    ciz();
    giris.focus();
  };
  giris.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      ekleDeger();
    } else if (e.key === 'Backspace' && !giris.value && liste.length) {
      liste.pop();
      degisti(liste.slice());
      ciz();
      giris.focus();
    }
  });
  giris.addEventListener('blur', () => giris.value.trim() && ekleDeger());
  ciz();
  kap.ayarla = (yeni) => {
    liste = yeni.slice();
    ciz();
  };
  return kap;
}

// Madde listesi düzenleyici (kurallar için)
export function listeDuzenleyici(maddeler, degisti, yerTutucu) {
  const kap = h('div', { class: 'listeDuz' });
  let liste = maddeler.slice();
  const yeni = h('textarea', { rows: '1', placeholder: yerTutucu || '' });
  const boyla = (ta) => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(220, ta.scrollHeight + 2) + 'px';
  };
  const ciz = () => {
    doldur(
      kap,
      liste.map((m, i) => {
        const ta = h('textarea', { rows: '1', value: m });
        ta.addEventListener('input', () => {
          liste[i] = ta.value;
          boyla(ta);
        });
        ta.addEventListener('change', () => {
          liste[i] = ta.value.trim();
          if (!liste[i]) liste.splice(i, 1);
          degisti(liste.slice());
          ciz();
        });
        requestAnimationFrame(() => boyla(ta));
        return h(
          'div',
          { class: 'listeSatir' },
          h('span', { class: 'listeNo' }, i + 1),
          ta,
          h('button', {
            type: 'button',
            class: 'simge',
            'aria-label': 'x',
            onclick: () => {
              liste.splice(i, 1);
              degisti(liste.slice());
              ciz();
            },
          }, ikon('kapat', 15))
        );
      }),
      h('div', { class: 'listeSatir yeni' }, h('span', { class: 'listeNo' }, '+'), yeni)
    );
  };
  yeni.addEventListener('input', () => boyla(yeni));
  yeni.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const v = yeni.value.trim();
      if (!v) return;
      liste.push(v);
      yeni.value = '';
      degisti(liste.slice());
      ciz();
      yeni.focus();
    }
  });
  ciz();
  kap.ayarla = (y) => {
    liste = y.slice();
    ciz();
  };
  kap.al = () => liste.slice();
  return kap;
}

export async function kopyala(metin) {
  try {
    await navigator.clipboard.writeText(metin);
    return true;
  } catch {
    return false;
  }
}

const iki = (n) => String(n).padStart(2, '0');
export const saatYaz = (z) => {
  const d = new Date(z);
  return iki(d.getHours()) + ':' + iki(d.getMinutes()) + ':' + iki(d.getSeconds());
};

// Şef ve beyin cevaplarındaki sade Markdown'ı güvenli DOM'a çevirir (innerHTML kullanılmaz).
// Desteklenen: başlık, madde ve numaralı liste, kod bloğu, satır içi kod, kalın, italik.
function satirIci(metin) {
  const parca = [];
  const kalip = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*)/g;
  let son = 0;
  for (const m of metin.matchAll(kalip)) {
    if (m.index > son) parca.push(metin.slice(son, m.index));
    const t = m[0];
    if (t.startsWith('`')) parca.push(h('code', null, t.slice(1, -1)));
    else if (t.startsWith('**') || t.startsWith('__')) parca.push(h('b', null, t.slice(2, -2)));
    else parca.push(h('i', null, t.slice(1, -1)));
    son = m.index + t.length;
  }
  if (son < metin.length) parca.push(metin.slice(son));
  return parca;
}

export function mdMetin(metin) {
  const kap = h('div', { class: 'md' });
  const satirlar = String(metin || '').replace(/\r\n?/g, '\n').split('\n');
  let liste = null;
  let kod = null;
  let paragraf = [];
  const paragrafBitir = () => {
    if (paragraf.length) {
      const p = h('p');
      paragraf.forEach((s, i) => {
        if (i) p.append(h('br'));
        ekle(p, satirIci(s));
      });
      kap.append(p);
    }
    paragraf = [];
  };
  let tablo = null;
  const hucreler = (s) => s.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((x) => x.trim());
  const tabloBitir = () => {
    if (!tablo) return;
    // ikinci satır |---|---| ayırıcıysa ilk satır başlıktır
    const ayirici = tablo.length > 1 && tablo[1].every((x) => /^:?-{2,}:?$/.test(x));
    const bas = ayirici ? tablo[0] : null;
    const govde = ayirici ? tablo.slice(2) : tablo;
    kap.append(
      h('div', { class: 'mdTablo' }, h('table', null, bas ? h('thead', null, h('tr', null, bas.map((x) => ekle(h('th'), satirIci(x))))) : null, h('tbody', null, govde.map((r) => h('tr', null, r.map((x) => ekle(h('td'), satirIci(x))))))))
    );
    tablo = null;
  };
  for (const s of satirlar) {
    if (!kod && /^\s*\|.*\|\s*$/.test(s)) {
      paragrafBitir();
      liste = null;
      (tablo = tablo || []).push(hucreler(s));
      continue;
    }
    tabloBitir();
    if (kod) {
      if (/^\s*```/.test(s)) {
        kap.append(h('pre', null, h('code', null, kod.join('\n'))));
        kod = null;
      } else kod.push(s);
      continue;
    }
    if (/^\s*```/.test(s)) {
      paragrafBitir();
      liste = null;
      kod = [];
      continue;
    }
    const madde = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(s);
    if (madde) {
      paragrafBitir();
      const tur = madde[1] ? 'ol' : 'ul';
      if (!liste || liste.tagName.toLowerCase() !== tur) {
        liste = h(tur);
        kap.append(liste);
      }
      liste.append(ekle(h('li'), satirIci(madde[2])));
      continue;
    }
    const baslik = /^\s*#{1,6}\s+(.*)$/.exec(s);
    if (baslik) {
      paragrafBitir();
      liste = null;
      kap.append(ekle(h('h4'), satirIci(baslik[1])));
      continue;
    }
    if (!s.trim()) {
      paragrafBitir();
      liste = null;
      continue;
    }
    liste = null;
    paragraf.push(s);
  }
  tabloBitir();
  if (kod) kap.append(h('pre', null, h('code', null, kod.join('\n'))));
  paragrafBitir();
  return kap;
}

// Sürüklenebilir ayırıcı: iki bölümün arasına konur, sürükleyince ölçü değişir, çift tıklayınca varsayılana döner.
// yon: 'yatay' (yükseklik değişir) ya da 'dikey' (genişlik değişir). ayarla(fark) sürükleme boyunca çağrılır.
export function ayirici({ yon, basla, ayarla, bitir, sifirla, etiket }) {
  const el = h('div', { class: 'ayirici ' + yon, role: 'separator', 'aria-orientation': yon === 'yatay' ? 'horizontal' : 'vertical', 'aria-label': etiket || '', tabindex: '0' });
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const bas = yon === 'yatay' ? e.clientY : e.clientX;
    basla && basla();
    document.body.classList.add('surukleniyor', yon === 'yatay' ? 'surukleY' : 'surukleX');
    const hareket = (ev) => ayarla((yon === 'yatay' ? ev.clientY : ev.clientX) - bas);
    const birak = () => {
      el.removeEventListener('pointermove', hareket);
      el.removeEventListener('pointerup', birak);
      el.removeEventListener('pointercancel', birak);
      document.body.classList.remove('surukleniyor', 'surukleY', 'surukleX');
      bitir && bitir();
    };
    el.addEventListener('pointermove', hareket);
    el.addEventListener('pointerup', birak);
    el.addEventListener('pointercancel', birak);
  });
  el.addEventListener('dblclick', () => sifirla && sifirla());
  // klavyeyle de ayarlanabilir
  el.addEventListener('keydown', (e) => {
    const adim = e.shiftKey ? 40 : 12;
    const k = { ArrowUp: -adim, ArrowLeft: -adim, ArrowDown: adim, ArrowRight: adim }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    basla && basla();
    ayarla(k);
    bitir && bitir();
  });
  return el;
}
