// Tarayıcı odasının MCP araçları ve sahibin onayı. Beyin bütün katların hesaplarını, kat şefi yalnızca kendi katınınkileri görür.
// Okuma araçları serbesttir. Tıklama ve yazma motorun kendi onay penceresinden geçer (bkz. ONAYSIZ_ARACLAR).
const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });

// Sahibe sormadan çalışabilen araçlar. Geri kalanlar (tarayici_tikla, tarayici_yaz) her seferinde onay ister.
export const ONAYSIZ_ARACLAR = ['tarayicilar', 'tarayici_ac', 'tarayici_git', 'tarayici_metin', 'tarayici_goruntu', 'tarayici_konsol', 'tarayici_cihaz', 'tarayici_alanlar', 'tarayici_kaydir', 'tarayici_kapat', 'sahip_onayi', 'whatsapp_yaz', 'telegram_yaz'];
export const ONAYLI_ARACLAR = ['tarayici_tikla', 'tarayici_yaz', 'tarayici_tus'];

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
    tarayici_alanlar: {
      aciklama: 'Sayfadaki tıklanabilir ve yazılabilir öğeleri numarasıyla listeler: alanlar, metin kutuları, açılır listeler, düğmeler, bağlantılar. Açık pencere (ör. LinkedIn düzenleme penceresi), iç çerçeveler ve gölge DOM dahildir; penceredekiler önce gelir. Tıklamadan ve yazmadan önce bunu çağır, sonra öğeye no ile eriş.',
      sema: nesne({ hesap_id: hesapId }, ['hesap_id']),
      calistir: async (g) => ops.alanlar(String(g.hesap_id)),
    },
    tarayici_tikla: {
      aciklama: 'Bir öğeye gerçek fare tıklamasıyla tıklar. En güvenilir yol: tarayici_alanlar listesindeki no. Ya da görünen yazı veya CSS seçici. ' + KURAL,
      sema: nesne({ hesap_id: hesapId, no: yazi('tarayici_alanlar listesindeki numara, ör. 0.14'), metin: yazi('Öğenin görünen yazısı ya da etiketi'), secici: yazi('CSS seçicisi') }, ['hesap_id']),
      calistir: async (g) => ops.tikla(String(g.hesap_id), { no: g.no ? String(g.no) : '', metin: g.metin ? String(g.metin) : '', secici: g.secici ? String(g.secici) : '' }),
    },
    tarayici_yaz: {
      aciklama: 'Bir alana gerçek klavye girişi gibi yazar ve alanın son değerini döndürür (yazının alana düştüğünü buradan doğrula). Alan: tarayici_alanlar no, etiket (ör. "Başlık") ya da CSS seçici; hiçbiri verilmezse odaktaki alan. temizle true: alanın içindeki metni tamamen siler ve yerine yazar (dolu alanı değiştirmek için bunu kullan; sahipten alanı boşaltmasını isteme). enter true: sonra Enter. Açılır listede (select) metin seçeneğin adıdır. ' + KURAL,
      sema: nesne({ hesap_id: hesapId, metin: yazi('Yazılacak metin'), no: yazi('tarayici_alanlar numarası'), etiket: yazi('Alanın etiketi ya da yer tutucusu'), secici: yazi('CSS seçicisi'), temizle: { type: 'boolean' }, enter: { type: 'boolean' } }, ['hesap_id', 'metin']),
      calistir: async (g) => ops.yaz(String(g.hesap_id), { metin: String(g.metin), no: g.no ? String(g.no) : '', etiket: g.etiket ? String(g.etiket) : '', secici: g.secici ? String(g.secici) : '', temizle: !!g.temizle, enter: !!g.enter }),
    },
    tarayici_tus: {
      aciklama: 'Klavye tuşuna basar: Enter, Tab, Escape, Backspace, ArrowDown, ArrowUp, PageDown ya da Cmd+A (tümünü seç), Cmd+C, Cmd+V, Cmd+X, Cmd+Z gibi birleşimler; bunlar sayfada gerçekten çalışır. ' + KURAL,
      sema: nesne({ hesap_id: hesapId, tus: yazi('Tuş ya da birleşim') }, ['hesap_id', 'tus']),
      calistir: async (g) => ops.tus(String(g.hesap_id), String(g.tus)),
    },
    tarayici_kaydir: {
      aciklama: 'Sayfayı ya da açık pencerenin içini kaydırır.',
      sema: nesne({ hesap_id: hesapId, yon: { type: 'string', enum: ['asagi', 'yukari'] }, miktar: { type: 'number', description: 'Piksel (varsayılan 600)' } }, ['hesap_id']),
      calistir: async (g) => ops.kaydir(String(g.hesap_id), { yon: g.yon === 'yukari' ? 'yukari' : 'asagi', miktar: g.miktar }),
    },
    tarayici_kapat: {
      aciklama: 'Hesabın tarayıcı sekmesini kapatır (oturumu ve girişi silinmez, tarayici_ac ile yeniden açılır).',
      sema: nesne({ hesap_id: hesapId }, ['hesap_id']),
      calistir: async (g) => ops.kapat(String(g.hesap_id)),
    },
    whatsapp_yaz: {
      aciklama: 'Beynin bağlı WhatsApp numarasından mesaj, fotoğraf ya da dosya gönderir (tarayıcı gerekmez). numara verilmezse sahibe gider ve onay sorulmaz. dosya verilirse (jpg, png, pdf, mp4, mp3, docx...) metin açıklama olur. Başka numaraya yazarken, ya da sahip dışında birine dosya gönderirken araç önce sahibin onayını ister.',
      sema: nesne({ metin: yazi('Gönderilecek mesaj ya da dosyanın açıklaması'), numara: yazi('Ülke koduyla telefon numarası (ör. +90 5xx xxx xx xx). Boş bırakılırsa sahibe gider.'), dosya: yazi('Gönderilecek dosyanın tam yolu (isteğe bağlı), en çok 64 MB') }, ['metin']),
      calistir: async (g) => ops.whatsappYaz(g.numara ? String(g.numara) : '', String(g.metin), g.dosya ? String(g.dosya) : ''),
    },
    telegram_yaz: {
      aciklama: 'Telegram botundan mesaj, fotoğraf ya da dosya gönderir. kime boşsa sahibe gider. kime bir proje kişisinin adıysa o kişiye gider (kişinin bota bir kez yazmış olması gerekir). Kişiye dosya göndermek sahibin onayına bağlıdır.',
      sema: nesne({ metin: yazi('Gönderilecek mesaj ya da dosyanın açıklaması'), kime: yazi('Boş: sahip. Ya da proje kişisinin adı (ör. Su).'), dosya: yazi('Gönderilecek dosyanın tam yolu (isteğe bağlı), en çok 50 MB') }, ['metin']),
      calistir: async (g) => ops.telegramYaz(g.kime ? String(g.kime) : '', String(g.metin), g.dosya ? String(g.dosya) : ''),
    },
    sahip_onayi: {
      aciklama: 'Sahibe evet ya da hayır sorusu sorar ve cevabını bekler (en çok 10 dakika). Soru konuşma panelinde onay kartı olarak çıkar. Dışarıya etkisi olan her işten önce kullan.',
      sema: nesne({ soru: yazi('Sahibe sorulacak kısa ve net soru. Ne yapılacağını ve nerede yapılacağını söyle.') }, ['soru']),
      calistir: async (g) => ((await ops.onay(String(g.soru))) ? 'Sahip onayladı.' : 'Sahip onaylamadı. Bu işi yapma.'),
    },
  };
}
