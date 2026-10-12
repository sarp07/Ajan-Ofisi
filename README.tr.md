<p align="center">
  <img src="docs/tr/ofis.png" width="860" alt="Ajan Ofisi: Claude Code ekibin için canlı ofis">
</p>

<h1 align="center">Ajan Ofisi</h1>

<p align="center">
  Claude Code ekibin için canlı bir ofis. Çalışanlarına isim ver, görev ve skill tanımla,<br>
  şefle konuş ve işin yapılışını izle. macOS, Windows ve Linux için.
</p>

<p align="center">
  <a href="https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-mac-arm64.dmg"><img src="https://img.shields.io/badge/macOS%20i%C3%A7in%20indir-000000?style=for-the-badge&logo=apple&logoColor=white" alt="macOS için Ajan Ofisi'ni indir" height="44"></a>
  <a href="https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-win-x64.exe"><img src="https://img.shields.io/badge/Windows%20i%C3%A7in%20indir-0A64AD?style=for-the-badge" alt="Windows için Ajan Ofisi'ni indir" height="44"></a>
  <a href="https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-linux-x86_64.AppImage"><img src="https://img.shields.io/badge/Linux%20i%C3%A7in%20indir-2B2B2B?style=for-the-badge&logo=linux&logoColor=white" alt="Linux için Ajan Ofisi'ni indir" height="44"></a>
</p>

<p align="center"><a href="README.md">English</a> · <b>Türkçe</b></p>

---

## Özellikler

- 🧠 **Beyin:** tek muhatabın. Bedeni yok, ona istediğin adı verirsin. Projelerin için katlar açar, her kata bir şef ve ekip önerir, kat şefleriyle konuşur ve sana tek bir rapor verir. İstersen cevaplarını sesli okur (bilgisayar sesi, ElevenLabs ya da OpenAI).
- ⚙️ **Claude ya da OpenAI:** ekip Claude Code ya da OpenAI Codex ile çalışır. Uygulama kurulu ve giriş yapılmış olanı kendisi bulur, istersen Ayarlar'dan değiştirirsin. Abonelikle giriş ya da şifreli saklanan API anahtarı.
- 🏢 **Katlar:** her proje bir kat, her katın kendi şefi ve ekibi var. Katlar aynı anda çalışır. Kat şefleri güçlü modelle yönetir, çalışanlar daha az harcayan modelle iş yapar.
- 💬 **Konuşma paneli:** şefin cevapları, sana sorduğu sorular ve onay istekleri tek yerde toplanır. Terminali takip etmen gerekmez, cevabını panelden yazarsın.
- 🫶 **Kişisel kat:** şefi beyindir. Sağlık danışmanı, iş koçu, reklamcı, tasarımcı, yazılımcı gibi istediğin kişileri seçersin, her birinin ayrı odası olur. Odalarda bire bir, özel konuşursun. PDF ve resim eklersin, konuşmayı PDF ya da Markdown olarak indirirsin.
- 🌐 **Tarayıcı odası:** WhatsApp Web, Telegram, Gmail, LinkedIn ve diğer hesapların uygulamanın içinde kendi kalıcı profillerinde açılır. Girişi bir kez sen yaparsın, şifreni uygulama görmez. Ekip bu hesapları kullanırken tıklama ve yazma her seferinde senin onayına gelir.
- 📱 **Test alanları:** projenin test adresi için Test sekmesi, iOS simülatörü ve Android emülatörü araçları. Ajanlar konsol hatalarını da okur.
- 🐙 **Geliştirici dostu:** yeni katı var olan klasörden, sıfırdan (git ve GitHub reposuyla) ya da GitHub'dan klonlayarak açarsın. Her proje kartında dal, değişiklik, açık PR'lar; pull, commit, push ve yeni dal tek tık. Tarayıcıda iPhone, iPad, Android modları ve hata konsolu.
- 📒 **Kayıt defteri:** her katta ne istendiği, kimin ne teslim ettiği ve hangi görevin açık kaldığı yazılır. Yeni oturum kısa bir "kaldığın yer" notuyla başlar.
- ✨ **Skiller, kurallar ve eğitim:** hazır skiller, kendi skillerin, şirket kuralları ve çalışana verdiğin geri bildirimin kalıcı kurala dönüşmesi.
- 💾 **Yedek:** şirketin tamamını tek dosyaya yedekler, başka bilgisayarda geri yüklersin.
- 🔔 **Bildirimler ve izinler:** iş bitince ya da onay gerekince bildirim gelir. macOS izinleri ilk açılışta tek adımda istenir.
- 🌍 **Türkçe ve İngilizce.**

İşi olmayan çalışanlar yeni iş gelene kadar kahve köşesine, masa tenisine ya da oyun alanına gider.

<p align="center">
  <img src="docs/tr/mola.png" width="400">
  <img src="docs/tr/ekip.png" width="400">
  <img src="docs/tr/defter.png" width="400">
  <img src="docs/tr/skiller.png" width="400">
</p>

## Kurulum

Gereksinimler: [Claude Code](https://code.claude.com/docs/en/setup) ve Claude Code içeren bir hesap (Pro, Max, Team, Enterprise ya da Console). Claude Code kurulu değilse uygulama ilk açılışta kurulum komutunu gösterir.

### Yöntem 1: İndir (en kolayı)

| Sistem | Dosya |
| --- | --- |
| macOS, Apple Silicon | [AjanOfisi-mac-arm64.dmg](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-mac-arm64.dmg) |
| macOS, Intel | [AjanOfisi-mac-x64.dmg](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-mac-x64.dmg) |
| Windows | [AjanOfisi-win-x64.exe](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-win-x64.exe) |
| Linux | [AppImage](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-linux-x86_64.AppImage) ya da [deb](https://github.com/sarp07/Ajan-Ofisi/releases/latest/download/AjanOfisi-linux-amd64.deb) |

macOS'ta dmg dosyasını aç ve **Ajan Ofisi** uygulamasını **Uygulamalar** klasörüne sürükle. Uygulama Apple tarafından imzalanmış ve onaylanmıştır (notarized), diğer uygulamalar gibi doğrudan açılır.

Windows kurulum dosyası henüz imzalı değil. SmartScreen uyarısı çıkarsa **Ek bilgi** ve ardından **Yine de çalıştır** seç.

### Yöntem 2: Kaynak koddan çalıştır

[Node.js](https://nodejs.org) 22 ya da üstü gerekir.

```bash
git clone https://github.com/sarp07/Ajan-Ofisi.git
cd Ajan-Ofisi
npm install
npm start
```

Terminal kullanmak istemiyorsan macOS'ta `Ac.command`, Windows'ta `Ac.bat` dosyasına çift tıkla. Linux'ta `./ac.sh` yaz.

## İlk açılış

1. Ofisine ve şefine isim ver, dili seç.
2. İlk çalışanları hazır kişilerden seç ya da **Şimdilik geç** de, sonra **Ekip** sayfasından eklersin.
3. Skilleri seç ya da geç.
4. **Projeler** sayfasından proje klasörünü ekle, **Ofis** sayfasında **Başlat**'a bas.
5. Claude Code ilk seferde hesabına giriş yapmanı ve klasöre güvenmeni ister. İkisi de pencerenin altındaki terminalde olur.

## Nasıl çalışır

Ajan Ofisi, Claude Code'u uygulamanın içinde çalıştırır. Her oturum açılışında şirketin (ekip, kurallar, skiller) bir Claude Code eklentisine derlenir ve Claude Code gömülü terminalde bu eklentiyle başlar. Ofis, Claude Code'un kendi olaylarını bu bilgisayarda dinler ve gerçekte ne oluyorsa onu çizer.

## Gizlilik ve güvenlik

- Uygulama Claude şifreni ya da anahtarını **görmez ve saklamaz**. Giriş, Claude Code'un kendi giriş adımıyla yapılır.
- Canlı olaylar yalnızca bu bilgisayarda (`127.0.0.1`), her açılışta değişen gizli bir anahtarla alınır. Dışarıya açık kapı yoktur.
- Projelerine ve `~/.claude` klasörüne hiçbir şey yazılmaz. Bütün veri uygulamanın kendi veri klasöründe durur.
- Uygulama şifre istemez ve tutmaz. Her bağlı hesabın tarayıcı oturumu kendi profilinde durur, API anahtarları sistemin şifreli deposunda saklanır.
- Bütün izinleri atlayan çalışma modu kabul edilmez. Başlangıç kuralları canlı veritabanına yazmayı, yayına almayı, ödeme ve cüzdan işlemlerini senin onayına bağlar.
- Skiller kendi depolarından, sabit bir sürüme bağlı olarak indirilir.

## Bilmen gerekenler

- Takım modu Claude Code'un ajan takımlarını kullanır. Bu, Claude Code tarafında deneysel bir özelliktir ve daha çok kullanım harcar. **Ayarlar** sayfasından kapatabilirsin.
- Katlar aynı anda çalışır. Her katın kendi oturumu ve kayıt defteri vardır.

## Verin nerede durur

| Sistem | Klasör |
| --- | --- |
| macOS | `~/Library/Application Support/Ajan Ofisi` |
| Windows | `%APPDATA%\Ajan Ofisi` |
| Linux | `~/.config/Ajan Ofisi` |

Kaldırmak için uygulamayı ve bu klasörü sil.

## Geliştirme

```bash
npm test              # durum motoru, şirket ve proje deposu, eklenti derleyici, skiller, kayıt defteri, metinler
npm run yayin:mac     # Apple Silicon ve Intel için imzalı, Apple onaylı dmg; GitHub sürümüne yükler
npm run paket:win     # Windows kurulum dosyası
npm run paket:linux   # AppImage ve deb
```

`npm run yayin:mac` için Mac'te Developer ID sertifikası ve onay profili gerekir, ayrıntı `betik/yayin-mac.sh` dosyasının başında. Windows ve Linux kurulum dosyalarını GitHub Actions üretir: `v` ile başlayan her etikette ikisi de üretilip sürüme eklenir. Paketlemeden sonra `paket/sonra.cjs`, kurulum dosyasına yalnızca uygulamanın kendi dosyalarının girdiğini denetler, fazlası varsa derlemeyi durdurur.

| Klasör | İçerik |
| --- | --- |
| `main.js`, `preload.cjs` | Electron ana süreci ve arayüz köprüsü |
| `cekirdek/` | Şirket deposu, eklenti derleyici, durum motoru, kayıt defteri, skill yöneticisi |
| `arayuz/` | Ofis sahnesi ve sayfalar (çatı ya da paketleyici yok) |
| `katalog/` | Hazır skill listesi |

## Lisans

[MIT](LICENSE) © solazan. Katalogdaki skiller kendi depolarından indirilir ve kendi lisanslarına tabidir.
