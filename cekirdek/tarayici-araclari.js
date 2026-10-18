// Tarayıcı odasının MCP araçları ve sahibin onayı. Beyin bütün katların hesaplarını, kat şefi yalnızca kendi katınınkileri görür.
// Okuma araçları serbesttir. Tıklama ve yazma motorun kendi onay penceresinden geçer (bkz. ONAYSIZ_ARACLAR).
const nesne = (ozellik, gerekli = []) => ({ type: 'object', properties: ozellik, required: gerekli, additionalProperties: false });
const yazi = (aciklama) => ({ type: 'string', description: aciklama });

// Sahibe sormadan çalışabilen araçlar. Geri kalanlar (tarayici_tikla, tarayici_yaz) her seferinde onay ister.
export const ONAYSIZ_ARACLAR = ['tarayicilar', 'tarayici_ac', 'tarayici_yeni', 'tarayici_git', 'tarayici_metin', 'tarayici_goruntu', 'tarayici_konsol', 'tarayici_cihaz', 'tarayici_alanlar', 'tarayici_kaydir', 'tarayici_kapat', 'tarayici_indirilenler', 'sahip_onayi', 'whatsapp_yaz', 'whatsapp_gecmis', 'telegram_yaz'];
export const ONAYLI_ARACLAR = ['tarayici_tikla', 'tarayici_yaz', 'tarayici_tus', 'tarayici_fare', 'tarayici_dosya_yukle'];

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
    tarayici_yeni: {
      aciklama: 'Hesap gerektirmeyen yeni bir sekme açar ve adrese gider (canlı site, yerel sunucu, belge, rakip site). Dönen hesap_id ile öbür tarayici_ araçlarını kullan. Katın en çok 6 serbest sekmesi olur; işin bitince tarayici_kapat ile kapat.',
      sema: nesne({ adres: yazi('Tam adres (https://... ya da http://localhost:...)'), ad: yazi('Sekmenin kısa adı (isteğe bağlı)') }, ['adres']),
      calistir: async (g) => ops.yeni(String(g.adres), g.ad ? String(g.ad) : ''),
    },
    tarayici_fare: {
      aciklama: 'Gerçek fare kullanır: ekran görüntüsündeki (tarayici_goruntu) x,y noktasına tıklar, çift tıklar, sağ tıklar, üzerine gelir ya da x2,y2 noktasına sürükler. Öğe numarasıyla bulunamayan yerler için (tuval, harita, sürükle bırak, menü) kullan. ' + KURAL,
      sema: nesne({ hesap_id: hesapId, x: { type: 'number' }, y: { type: 'number' }, eylem: { type: 'string', enum: ['tikla', 'cift', 'sag', 'uzerine', 'surukle'] }, x2: { type: 'number' }, y2: { type: 'number' } }, ['hesap_id', 'x', 'y']),
      calistir: async (g) => ops.fare(String(g.hesap_id), { x: g.x, y: g.y, eylem: g.eylem || 'tikla', x2: g.x2, y2: g.y2 }),
    },
    tarayici_dosya_yukle: {
      aciklama: 'Sayfaya bilgisayardan dosya yükler (görsel, belge, video). Hedef bir dosya alanıysa doğrudan seçer; "Yükle", "Fotoğraf ekle" gibi bir düğmeyse tıklar ve açılan seçme penceresine dosyaları verir. Hedef verilmezse sayfadaki ilk dosya alanı kullanılır. Dosya yolları tam yol olmalı (proje klasörü, tasarım assets klasörü, indirilenler, sohbete eklenen dosyalar). Sonra tarayici_goruntu ile yüklemenin bittiğini kontrol et. ' + KURAL,
      sema: nesne({ hesap_id: hesapId, dosyalar: { type: 'array', items: { type: 'string' }, description: 'Yüklenecek dosyaların tam yolları' }, no: yazi('Dosya alanının ya da yükle düğmesinin tarayici_alanlar numarası'), etiket: yazi('Düğmenin ya da alanın görünen adı'), secici: yazi('CSS seçici') }, ['hesap_id', 'dosyalar']),
      calistir: async (g) => ops.dosyaYukle(String(g.hesap_id), Array.isArray(g.dosyalar) ? g.dosyalar.map(String) : [String(g.dosyalar || '')], { no: g.no ? String(g.no) : '', etiket: g.etiket ? String(g.etiket) : '', secici: g.secici ? String(g.secici) : '' }),
    },
    tarayici_indirilenler: {
      aciklama: 'Tarayıcıdan indirilen dosyaları listeler: ad, tam yol, boyut ve durum (iniyor, tamam, durdu, iptal, hata). İndirmeler sormadan İndirilenler klasörüne gider; inen dosyayı buradaki yoldan okuyup kullanabilirsin. hesap_id verilirse yalnızca o sekmenin indirmeleri.',
      sema: nesne({ hesap_id: yazi('İsteğe bağlı: yalnızca bu sekmenin indirmeleri') }),
      calistir: async (g) => ops.indirmeler(g.hesap_id ? String(g.hesap_id) : ''),
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
      aciklama: 'Açık sayfanın ekran görüntüsünü verir. Görüntüdeki bir noktaya tarayici_fare ile tıklayabilirsin.',
      sema: nesne({ hesap_id: hesapId }, ['hesap_id']),
      calistir: async (g) => {
        const r = await ops.goruntu(String(g.hesap_id));
        return { icerik: [{ type: 'image', data: r.veri, mimeType: 'image/png' }, { type: 'text', text: `Görüntü ${r.en}x${r.boy} piksel. tarayici_fare koordinatları bu görüntüye göredir (sol üst 0,0).` }] };
      },
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
      aciklama: 'Klavye tuşuna basar: tek harf ya da işaret (a, w, /, 1), Space, Enter, Tab, Escape, Backspace, ArrowDown, ArrowUp, PageDown ya da Cmd+A (tümünü seç), Cmd+C, Cmd+V, Cmd+X, Cmd+Z gibi birleşimler; bunlar sayfada gerçekten çalışır. ' + KURAL,
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
    whatsapp_gecmis: {
      aciklama: 'WhatsApp hafızan: sahiple, projelere kayıtlı kişilerle ve senin yazdığın numaralarla olan eski mesajları getirir (uygulama kapalıyken gelenler dahil). numara verilirse o kişiyle konuşma, ara verilirse içinde o kelime geçen mesajlar; ikisi de boşsa konuştuğun kişilerin listesi ve son mesajlar. Biri "geçmişte ne dedi, cevap verdi mi" diye sorarsa önce buna bak. Başka sohbetler kaydedilmez.',
      sema: nesne({ numara: yazi('Kişinin numarası (ülke koduyla) ya da adı'), ara: yazi('Aranacak kelime'), son: { type: 'number', description: 'En çok kaç mesaj (varsayılan 40, en çok 200)' } }),
      calistir: async (g) => ops.whatsappGecmis({ numara: g.numara ? String(g.numara) : '', ara: g.ara ? String(g.ara) : '', son: Number(g.son) || 40 }),
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
