// Kişisel kat oda seçici: hazır oda şablonlarından istenenler seçilir. Hiçbiri zorunlu değildir.
import { h, ikon } from './dom.js';
import { depo } from './depo.js';

// secili: seçilen şablon kimlikleri (Set, yerinde değişir). mevcut: zaten kurulu olanlar (seçilemez).
export function odaSecici({ secili, mevcut = new Set(), degisti = () => {} }) {
  const t = depo.t;
  const dil = depo.sirket.dil;
  return h(
    'div',
    { class: 'odaSecici', role: 'group' },
    (depo.odaSablonlari || []).map((o) => {
      const d = o[dil] || o.tr;
      const kurulu = mevcut.has(o.id);
      const kart = h(
        'button',
        {
          type: 'button',
          class: 'odaKart' + (secili.has(o.id) ? ' secili' : '') + (kurulu ? ' kurulu' : ''),
          'aria-pressed': secili.has(o.id) ? 'true' : 'false',
          disabled: kurulu,
          onclick: () => {
            if (secili.has(o.id)) secili.delete(o.id);
            else secili.add(o.id);
            kart.classList.toggle('secili', secili.has(o.id));
            kart.setAttribute('aria-pressed', secili.has(o.id) ? 'true' : 'false');
            degisti(secili);
          },
        },
        h('span', { class: 'odaSimge', style: `background:${o.renk}` }, ikon(o.simge, 16)),
        h(
          'span',
          { class: 'odaKartYazi' },
          h('b', null, d.unvan),
          h('span', null, d.ad + ' · ' + t(o.mod === 'calisma' ? 'oda.calisma' : 'oda.sohbet'))
        ),
        h('span', { class: 'odaTik' }, ikon(kurulu ? 'tik' : secili.has(o.id) ? 'tik' : 'arti', 14))
      );
      return kart;
    })
  );
}
