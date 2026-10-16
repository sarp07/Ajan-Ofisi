// Tasarım önizlemesine eklenen seçici katman. Kum havuzlu çerçevede çalışır, ana pencereyle yalnızca postMessage ile konuşur.
// Seçim modunda üzerine gelinen öğe çerçevelenir, tıklanınca seçilir; çift tıklanan yazı yerinde düzenlenir.
// Canlı düzenlemeler yalnızca önizlemeye uygulanır, dosyaya tasarımcı ajan yazar.
(() => {
  if (window.__ofisSecici) return;
  window.__ofisSecici = true;
  const ust = window.parent;
  if (!ust || ust === window) return;
  const yolla = (veri) => ust.postMessage({ ofisTasarim: true, ...veri }, '*');
  let secimModu = false;
  let secili = null;
  let uzerinde = null;
  let duzenlenen = null;

  const kat = document.createElement('div');
  kat.setAttribute('data-ofis-katman', '');
  kat.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const kutu = (renk, dolgu) => {
    const k = document.createElement('div');
    k.style.cssText = `position:fixed;display:none;box-sizing:border-box;border:1.5px solid ${renk};background:${dolgu};border-radius:2px;transition:all 60ms linear`;
    const e = document.createElement('span');
    e.style.cssText = `position:absolute;left:-1.5px;top:-20px;font:600 10.5px/18px -apple-system,Segoe UI,sans-serif;padding:0 6px;border-radius:4px 4px 0 0;color:#04221f;background:${renk};white-space:nowrap`;
    k.append(e);
    kat.append(k);
    return { k, e };
  };
  const hover = kutu('#5aa2e6', 'rgba(90,162,230,0.10)');
  const secim = kutu('#17b8a6', 'rgba(23,184,166,0.08)');
  const tak = () => document.body && !kat.isConnected && document.documentElement.append(kat);

  const benim = (el) => !el || el === kat || kat.contains(el);
  const etiketAdi = (el) => {
    const t = el.tagName.toLowerCase();
    const s = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean)[0] : '';
    return t + (el.id ? '#' + el.id : s ? '.' + s : '');
  };
  const tur = (el) => {
    const t = el.tagName.toLowerCase();
    if (t === 'button' || el.getAttribute('role') === 'button' || (t === 'input' && /submit|button/.test(el.type))) return 'button';
    if (t === 'a') return 'link';
    if (t === 'img' || t === 'svg' || t === 'picture' || t === 'video') return 'image';
    if (/^(input|textarea|select)$/.test(t)) return 'input';
    if (/^(section|header|footer|main|nav|article|aside)$/.test(t)) return 'section';
    if (/^(h[1-6]|p|span|strong|em|li|label|small|blockquote|figcaption)$/.test(t)) return 'text';
    return 'container';
  };

  // Okunur ve benzersiz CSS yolu: id varsa oradan, yoksa etiket + sınıf + sıra
  function yol(el) {
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const parca = [];
    let x = el;
    while (x && x.nodeType === 1 && x !== document.documentElement) {
      if (x === document.body) {
        parca.unshift('body');
        break;
      }
      if (x.id && document.querySelectorAll('#' + CSS.escape(x.id)).length === 1) {
        parca.unshift('#' + CSS.escape(x.id));
        break;
      }
      let p = x.tagName.toLowerCase();
      const s = typeof x.className === 'string' ? x.className.trim().split(/\s+/).filter((c) => c && !/^(is-|has-)/.test(c))[0] : '';
      if (s) p += '.' + CSS.escape(s);
      const ana = x.parentElement;
      if (ana) {
        const es = [...ana.children].filter((c) => c.tagName === x.tagName);
        if (es.length > 1) p += `:nth-of-type(${es.indexOf(x) + 1})`;
      }
      parca.unshift(p);
      x = ana;
    }
    return parca.join(' > ');
  }

  const STILLER = ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'textAlign', 'padding', 'margin', 'borderRadius', 'border', 'width', 'height', 'display', 'gap', 'opacity'];
  function bilgi(el) {
    const cs = getComputedStyle(el);
    const stil = {};
    for (const k of STILLER) stil[k] = cs[k];
    const zincir = [];
    for (let x = el.parentElement; x && x !== document.documentElement; x = x.parentElement) {
      zincir.unshift({ ad: etiketAdi(x), yol: yol(x), tur: tur(x) });
      if (x === document.body) break;
    }
    const salt = [...el.childNodes].every((n) => n.nodeType === 3 || (n.nodeType === 1 && /^(BR|B|I|EM|STRONG|SPAN|SMALL)$/.test(n.tagName)));
    const html = el.outerHTML;
    return {
      yol: yol(el),
      ad: etiketAdi(el),
      tur: tur(el),
      metin: (el.innerText || '').trim().slice(0, 400),
      html: html.length > 3000 ? html.slice(0, 3000) + '…' : html,
      stil,
      zincir,
      yaziDuzenlenir: salt && !!(el.innerText || '').trim(),
      kaynak: el.tagName === 'IMG' ? el.getAttribute('src') || '' : '',
      sayfa: decodeURIComponent(location.pathname.split('/').pop() || 'index.html'),
    };
  }

  function konumla(o, el, metin) {
    if (!el || !el.isConnected) return (o.k.style.display = 'none');
    const r = el.getBoundingClientRect();
    o.k.style.display = 'block';
    o.k.style.left = r.left + 'px';
    o.k.style.top = r.top + 'px';
    o.k.style.width = Math.max(2, r.width) + 'px';
    o.k.style.height = Math.max(2, r.height) + 'px';
    o.e.textContent = metin;
    o.e.style.top = r.top < 22 ? '0px' : '-20px';
  }
  let bekliyor = false;
  const yenile = () => {
    if (bekliyor) return;
    bekliyor = true;
    requestAnimationFrame(() => {
      bekliyor = false;
      konumla(hover, secimModu && uzerinde !== secili ? uzerinde : null, uzerinde ? etiketAdi(uzerinde) : '');
      konumla(secim, secili, secili ? etiketAdi(secili) : '');
    });
  };

  function sec(el) {
    if (!el || benim(el)) return;
    secili = el;
    yenile();
    yolla({ tur: 'secildi', bilgi: bilgi(el) });
  }

  document.addEventListener(
    'mouseover',
    (e) => {
      if (!secimModu || benim(e.target)) return;
      uzerinde = e.target;
      yenile();
    },
    true
  );
  document.addEventListener(
    'mouseout',
    (e) => {
      if (secimModu && !e.relatedTarget) {
        uzerinde = null;
        yenile();
      }
    },
    true
  );
  // seçim modunda tıklamalar sayfaya gitmez (bağlantı açılmaz, form gönderilmez)
  const yut = (e) => {
    if (!secimModu || benim(e.target) || (duzenlenen && duzenlenen.contains(e.target))) return;
    e.preventDefault();
    e.stopPropagation();
  };
  for (const ad of ['mousedown', 'mouseup', 'submit', 'pointerdown', 'pointerup']) document.addEventListener(ad, yut, true);
  document.addEventListener(
    'click',
    (e) => {
      if (!secimModu || benim(e.target) || (duzenlenen && duzenlenen.contains(e.target))) return;
      e.preventDefault();
      e.stopPropagation();
      sec(e.target);
    },
    true
  );
  // çift tıklanan yazı yerinde düzenlenir
  document.addEventListener(
    'dblclick',
    (e) => {
      if (!secimModu || benim(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      sec(el);
      if (bilgi(el).yaziDuzenlenir) yaziDuzenle(el);
    },
    true
  );

  function yaziDuzenle(el) {
    if (duzenlenen) duzenlenen.blur();
    const eski = el.innerText;
    duzenlenen = el;
    el.setAttribute('contenteditable', 'plaintext-only');
    el.style.outline = '2px dashed #17b8a6';
    el.style.outlineOffset = '2px';
    el.focus();
    const s = getSelection();
    s.selectAllChildren(el);
    const bitir = (iptal) => {
      el.removeEventListener('blur', bulanik);
      el.removeEventListener('keydown', tus);
      el.removeAttribute('contenteditable');
      el.style.outline = '';
      el.style.outlineOffset = '';
      duzenlenen = null;
      if (iptal) el.innerText = eski;
      else if (el.innerText !== eski) yolla({ tur: 'duzenleme', duzen: { yol: yol(el), ad: etiketAdi(el), ozellik: 'metin', eski: eski.slice(0, 400), deger: el.innerText.slice(0, 2000) } });
      yenile();
    };
    const bulanik = () => bitir(false);
    const tus = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        bitir(true);
        el.blur();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      }
    };
    el.addEventListener('blur', bulanik);
    el.addEventListener('keydown', tus);
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && secimModu && !duzenlenen) {
        if (secili) {
          secili = null;
          yenile();
          yolla({ tur: 'secildi', bilgi: null });
        } else yolla({ tur: 'secimKapat' });
      }
    },
    true
  );
  // kaydırma konumu ana pencereye bildirilir: ajan dosyayı yazınca önizleme aynı yerden açılır
  let kaydirZ = null;
  addEventListener('scroll', yenile, { passive: true, capture: true });
  addEventListener(
    'scroll',
    () => {
      clearTimeout(kaydirZ);
      kaydirZ = setTimeout(() => yolla({ tur: 'kaydir', y: Math.round(scrollY) }), 200);
    },
    { passive: true }
  );
  addEventListener('resize', yenile);

  const bul = (y) => {
    try {
      return y ? document.querySelector(y) : null;
    } catch {
      return null;
    }
  };
  const CSS_ADI = { color: 'color', backgroundColor: 'background-color', fontSize: 'font-size', fontWeight: 'font-weight', padding: 'padding', margin: 'margin', borderRadius: 'border-radius', textAlign: 'text-align', gap: 'gap', width: 'width', opacity: 'opacity' };

  addEventListener('message', (e) => {
    if (e.source !== ust || !e.data || !e.data.ofisTasarim) return;
    const d = e.data;
    if (d.tur === 'mod') {
      secimModu = !!d.secim;
      tak();
      document.documentElement.style.cursor = secimModu ? 'crosshair' : '';
      if (!secimModu) uzerinde = null;
      yenile();
    } else if (d.tur === 'sec') {
      sec(bul(d.yol));
      if (secili) secili.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (d.tur === 'birak') {
      secili = null;
      yenile();
    } else if (d.tur === 'stil') {
      const el = bul(d.yol);
      const ad = CSS_ADI[d.ozellik];
      if (el && ad) {
        el.style.setProperty(ad, String(d.deger || ''));
        yenile();
      }
    } else if (d.tur === 'metin') {
      const el = bul(d.yol);
      if (el) el.innerText = String(d.deger || '');
      yenile();
    } else if (d.tur === 'gorsel') {
      const el = bul(d.yol);
      if (el && el.tagName === 'IMG') el.src = String(d.deger || '');
      yenile();
    } else if (d.tur === 'gorunum') {
      // seçim yeniden yüklemeden sonra korunur
      tak();
      if (d.yol) sec(bul(d.yol));
    }
  });

  const hazir = () => {
    tak();
    const y = Number(new URLSearchParams(location.search).get('ofisY')) || 0;
    if (y) requestAnimationFrame(() => scrollTo(0, y));
    yolla({ tur: 'yuklendi', sayfa: decodeURIComponent(location.pathname.split('/').pop() || 'index.html'), baslik: document.title || '' });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hazir);
  else hazir();
})();
