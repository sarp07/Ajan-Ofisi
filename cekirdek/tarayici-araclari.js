// Tarayıcı odasının MCP araçları ve sahibin onayı. Beyin bütün katların hesaplarını, kat şefi yalnızca kendi katınınkileri görür.
// Okuma araçları serbesttir. Tıklama ve yazma motorun kendi onay penceresinden geçer (bkz. ONAYSIZ_ARACLAR).
const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });

// Sahibe sormadan çalışabilen araçlar. Geri kalanlar (tarayici_tikla, tarayici_yaz) her seferinde onay ister.
export const ONAYSIZ_ARACLAR = ['tarayicilar', 'tarayici_ac', 'tarayici_git', 'tarayici_metin', 'tarayici_goruntu', 'tarayici_konsol', 'tarayici_cihaz', 'sahip_onayi'];
export const ONAYLI_ARACLAR = ['tarayici_tikla', 'tarayici_yaz'];

const KURAL =
  'Paylaşım yapan, mesaj gönderen, silen, satın alan ya da hesap ayarını değiştiren bir tıklama veya yazmadan ÖNCE sahip_onayi ile sahibe ne yapacağını sor. Giriş ekranı çıkarsa dur: şifreyi asla isteme ve yazma, sahibe Tarayıcı sayfasından kendisinin giriş yapmasını söyle.';

// ops: { hesaplar(), ac(id, adres), git(id, adres), metin(id), goruntu(id), konsol(id, seviye), cihaz(id, ad), tikla(id, hedef), yaz(id, girdi), onay(soru) }
export function tarayiciAraclari(ops) {
  const hesapId = yazi('Hesabın kimliği (tarayicilar listesinden)');
  return {
    tarayicilar: {
      aciklama: 'Kullanabileceğin bağlı hesapları listeler: kimlik, kat, platform, ad, tarayıcısı açık mı ve açık sayfanın adresi. ' + KURAL,
      sema: nesne({}),
      calistir: async () => ops.hesaplar(),
    },
    tarayici_ac: {
      aciklama: 'Hesabın tarayıcısını kendi kalıcı profiliyle açar. Adres verilirse oraya gider, verilmezse hesabın ana sayfası açılır.',
      sema: nesne({ hesap_id: hesapId, adres: yazi('Gidilecek tam adres (isteğe bağlı)') }, ['hesap_id']),
      calistir: async (g) => ops.ac(String(g.hesap_id), g.adres ? String(g.adres) : ''),
    },
    tarayici_git: {
      aciklama: 'Açık tarayıcıda bir adrese gider.',
      sema: nesne({ hesap_id: hesapId, adres: yazi('Tam adres (https://...)') }, ['hesap_id', 'adres']),
      calistir: async (g) => ops.git(String(g.hesap_id), String(g.adres)),
    },
    tarayici_metin: {
      aciklama: 'Açık sayfanın başlığını, adresini ve görünen yazısını verir. Sayfada ne olduğunu anlamak için önce bunu kullan.',
      sema: nesne({ hesap_id: hesapId }, ['hesap_id']),
      calistir: async (g) => ops.metin(String(g.hesap_id)),
    },
    tarayici_goruntu: {
      aciklama: 'Açık sayfanın ekran görüntüsünü verir.',
      sema: nesne({ hesap_id: hesapId }, ['hesap_id']),
      calistir: async (g) => ({ icerik: [{ type: 'image', data: await ops.goruntu(String(g.hesap_id)), mimeType: 'image/png' }] }),
    },
    tarayici_konsol: {
      aciklama: 'Açık sayfanın konsol kayıtlarını verir: hatalar, uyarılar, yüklenemeyen adresler. Web testinde sayfayı açtıktan sonra mutlaka kontrol et.',
      sema: nesne({ hesap_id: hesapId, seviye: { type: 'string', enum: ['', 'error', 'warning', 'info', 'debug'], description: 'Yalnızca bu seviye (boşsa hepsi)' } }, ['hesap_id']),
      calistir: async (g) => ops.konsol(String(g.hesap_id), g.seviye ? String(g.seviye) : ''),
    },
    tarayici_cihaz: {
      aciklama: 'Sayfayı bir cihaz modunda açar: masaustu, iphone, ipad ya da android. Responsive tasarımı denemek için kullan, sonra tarayici_goruntu ile bak.',
      sema: nesne({ hesap_id: hesapId, cihaz: { type: 'string', enum: ['masaustu', 'iphone', 'ipad', 'android'] } }, ['hesap_id', 'cihaz']),
      calistir: async (g) => ops.cihaz(String(g.hesap_id), String(g.cihaz)),
    },
    tarayici_tikla: {
      aciklama: 'Sayfada görünen yazısı ya da CSS seçicisi verilen öğeye tıklar. ' + KURAL,
      sema: nesne({ hesap_id: hesapId, metin: yazi('Öğenin görünen yazısı'), secici: yazi('CSS seçicisi (metin yerine)') }, ['hesap_id']),
      calistir: async (g) => ops.tikla(String(g.hesap_id), { metin: g.metin ? String(g.metin) : '', secici: g.secici ? String(g.secici) : '' }),
    },
    tarayici_yaz: {
      aciklama: 'Bir alana yazı yazar. Seçici verilmezse odaktaki alana yazar. enter true ise ardından Enter tuşuna basar (çoğu sohbette mesajı gönderir). ' + KURAL,
      sema: nesne({ hesap_id: hesapId, metin: yazi('Yazılacak metin'), secici: yazi('Alanın CSS seçicisi (isteğe bağlı)'), enter: { type: 'boolean' } }, ['hesap_id', 'metin']),
      calistir: async (g) => ops.yaz(String(g.hesap_id), { metin: String(g.metin), secici: g.secici ? String(g.secici) : '', enter: !!g.enter }),
    },
    sahip_onayi: {
      aciklama: 'Sahibe evet ya da hayır sorusu sorar ve cevabını bekler (en çok 10 dakika). Soru konuşma panelinde onay kartı olarak çıkar. Dışarıya etkisi olan her işten önce kullan.',
      sema: nesne({ soru: yazi('Sahibe sorulacak kısa ve net soru. Ne yapılacağını ve nerede yapılacağını söyle.') }, ['soru']),
      calistir: async (g) => ((await ops.onay(String(g.soru))) ? 'Sahip onayladı.' : 'Sahip onaylamadı. Bu işi yapma.'),
    },
  };
}
