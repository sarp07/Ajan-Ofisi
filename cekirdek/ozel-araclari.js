// Özel odadaki kişinin (kişisel kat ya da bir katın üyesi) ofisle bağı: iş gerektiğinde beyne iletir.
// Oda konuşması paylaşılmaz; yalnızca kişinin bilerek ilettiği istek beyne gider.
const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });

// ops: { ilet(mesaj) }
export function ozelAraclari(ops) {
  return {
    ofise_ilet: {
      aciklama:
        'Beyne (ofisin yöneticisine) bir iş ya da istek iletir: bir projenin ekran görüntüsü, canlı sitenin ya da uygulamanın görseli, bir katın ekibinden iş, proje bilgisi gibi. Beyin işi ilgili kata verir, sonuç ve dosyalar bu odaya "[Beyin]" diye başlayan mesajla, dosyalar da ekler klasörüne gelir. Yalnızca gereken bilgiyi yaz; sahiple konuşmanın kendisini aktarma.',
      sema: nesne({ mesaj: yazi('İstek: ne lazım, hangi proje, ne için, hangi biçimde (ör. 1080x1080 ekran görüntüsü)') }, ['mesaj']),
      calistir: async (g) => ops.ilet(String(g.mesaj)),
    },
  };
}

export const OZEL_ARAC_ADLARI = ['ofise_ilet'];
