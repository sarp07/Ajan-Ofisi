// Ajanlar için GitHub araçları: dallar, PR'lar ve depo ayarları. Ham gh ya da git komutu yerine bunlar kullanılır.
// Korunan dallar silinemez. PR birleştirme ve depo ayarı değişikliği sahibin onayına bağlıdır. Depo silme aracı yoktur:
// geri alınamadığı için yalnızca sahip panelden yapar.
import { dalListesi, githubIslem } from './github.js';

const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });

// ortam(): { git, gh, env, klasor } katın deposu. onay(soru): sahibin onayı (true/false)
export function githubAraclari(ortam, onay, { beyin = false } = {}) {
  // depo: çok depolu katlarda hangi depo (adıyla); boşsa ana depo
  const kat = { ...(beyin ? { kat_id: yazi('Katın kimliği') } : {}), depo: yazi('Depo adı (çok depolu katlarda, ör. api, web). Boşsa ana depo.') };
  const gk = beyin ? ['kat_id'] : [];
  const o = (g) => ortam(beyin ? String(g.kat_id || '') : '', g.depo ? String(g.depo) : '');
  const is = (g, islem, s) => githubIslem({ ...o(g), islem, s });
  return {
    github_dallar: {
      aciklama: 'Katın deposundaki dalları listeler: şu anki dal, birleştirilmiş mi, uzakta var mı, korunan mı, son commit zamanı.',
      sema: nesne({ ...kat }, gk),
      calistir: async (g) => dalListesi(o(g)),
    },
    github_dal_sil: {
      aciklama: 'Birleştirilmiş bir dalı siler (yerelde, uzak true ise GitHub\'da da). main, master, varsayılan dal ve şu anki dal silinemez. Birleştirilmemiş dalı silmek sahibin onayına bağlıdır.',
      sema: nesne({ ...kat, dal: yazi('Dalın adı'), uzak: { type: 'boolean', description: 'GitHub\'daki dal da silinsin mi' } }, [...gk, 'dal']),
      calistir: async (g) => {
        try {
          return await is(g, 'dalSil', { dal: String(g.dal), uzak: !!g.uzak });
        } catch (e) {
          if (!/birleştirilmemiş/.test(String(e.message))) throw e;
          if (!(await onay(`"${g.dal}" dalı birleştirilmemiş değişiklikler içeriyor. Yine de silinsin mi${g.uzak ? ' (GitHub\'daki dal da)' : ''}?`))) return 'Sahip onaylamadı, dal silinmedi.';
          return is(g, 'dalSil', { dal: String(g.dal), uzak: !!g.uzak, zorla: true });
        }
      },
    },
    github_pr_ac: {
      aciklama: 'Şu anki dalı GitHub\'a gönderir ve PR açar. Başlık ve açıklama net olsun: ne değişti, nasıl test edildi.',
      sema: nesne({ ...kat, baslik: yazi('PR başlığı'), govde: yazi('PR açıklaması'), taban: yazi('Hedef dal (boşsa varsayılan dal)'), taslak: { type: 'boolean' } }, [...gk, 'baslik']),
      calistir: async (g) => is(g, 'prAc', { baslik: String(g.baslik), govde: String(g.govde || ''), taban: g.taban ? String(g.taban) : '', taslak: !!g.taslak }),
    },
    github_pr_birlestir: {
      aciklama: 'Bir PR\'ı birleştirir (varsayılan squash, dal da silinir). Her zaman sahibin onayına bağlıdır; önce testlerin geçtiğinden emin ol.',
      sema: nesne({ ...kat, no: { type: 'number', description: 'PR numarası' }, yontem: { type: 'string', enum: ['squash', 'merge', 'rebase'] }, ozet: yazi('Sahibe gösterilecek kısa özet: ne birleşiyor, testler') }, [...gk, 'no']),
      calistir: async (g) => {
        if (!(await onay(`PR #${g.no} birleştirilsin mi (${g.yontem || 'squash'})?\n\n${g.ozet || ''}`))) return 'Sahip onaylamadı, PR birleştirilmedi.';
        return is(g, 'prBirlestir', { no: g.no, yontem: g.yontem });
      },
    },
    github_pr_kapat: {
      aciklama: 'Bir PR\'ı birleştirmeden kapatır (sonra yeniden açılabilir).',
      sema: nesne({ ...kat, no: { type: 'number' }, yorum: yazi('Kapatma nedeni') }, [...gk, 'no']),
      calistir: async (g) => is(g, 'prKapat', { no: g.no, yorum: g.yorum ? String(g.yorum) : '' }),
    },
    github_depo: {
      aciklama: 'Deponun ayarını değiştirir: arsivle, arsivden_cikar, gizli, acik. Her zaman sahibin onayına bağlıdır. Depo silinemez.',
      sema: nesne({ ...kat, islem: { type: 'string', enum: ['arsivle', 'arsivden_cikar', 'gizli', 'acik'] } }, [...gk, 'islem']),
      calistir: async (g) => {
        const ne = { arsivle: 'arşivlensin', arsivden_cikar: 'arşivden çıkarılsın', gizli: 'gizli yapılsın', acik: 'herkese açık yapılsın' }[g.islem];
        if (!ne) throw new Error('Geçersiz işlem');
        if (!(await onay(`Kat deposu ${ne} mı?`))) return 'Sahip onaylamadı.';
        if (g.islem === 'arsivle' || g.islem === 'arsivden_cikar') return is(g, 'depoArsivle', { geriAl: g.islem === 'arsivden_cikar' });
        return is(g, 'depoGorunurluk', { gorunurluk: g.islem === 'acik' ? 'public' : 'private' });
      },
    },
  };
}

export const GITHUB_ARAC_ADLARI = ['github_dallar', 'github_dal_sil', 'github_pr_ac', 'github_pr_birlestir', 'github_pr_kapat', 'github_depo'];
