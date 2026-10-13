// Şirketi Claude Code eklentisine derler: ajan tanımları, etkin skiller ve canlı olay bağlantısı.
// Çıktı uygulamanın kendi veri klasörüne yazılır. Kullanıcının projelerine ve ~/.claude ayarlarına dokunulmaz.
// Oturum şu bayraklarla açılır: claude --plugin-dir <eklenti> --append-system-prompt-file <sef.md>
import fs from 'node:fs';
import path from 'node:path';
import { ccRenk } from './kimlik.js';

export const EKLENTI_ADI = 'ofis';

// HTTP ile gönderilen olaylar. SessionStart yalnızca komut türünü desteklediği için listede yok:
// oturumu uygulama kendisi başlattığından başlangıcı ve bitişi zaten biliyor.
export const OLAYLAR = [
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionDenied',
  'Notification',
  'Stop',
  'StopFailure',
  'SubagentStart',
  'SubagentStop',
  'TeammateIdle',
  'TaskCreated',
  'TaskCompleted',
];

const M = {
  tr: {
    kurallarin: 'Senin kuralların',
    sirketKurallari: 'Şirket kuralları',
    ekip: 'Ekip',
    ekipAciklama: 'Şirkette seninle birlikte çalışanlar. Biriyle konuşman gerekirse adını kullanarak mesaj at.',
    sef: 'işi dağıtan ve sonucu toplayan kişi',
    skiller: 'Skillerin',
    skillAciklama: 'Şu skiller sana atandı. İlgili işte önce skili çalıştır, sonra kendi bilginle devam et:',
    ekibin: 'Ekibin',
    ekipCagri: 'Ekip üyesi çağırırken ajan türü olarak tam şu adı kullan ve kısa adını isim olarak ver:',
    ekipYok: 'Ekipte henüz kimse yok. Her işi kendin yap. İş bir uzman gerektiriyorsa kullanıcıya uygulamanın Ekip sayfasından o uzmanı eklemesini öner.',
    tur: 'tür',
    isim: 'isim',
    kimlik: (ad, unvan, sirket) => `Adın ${ad}. ${sirket} adlı şirkette ${unvan || 'ekip üyesi'} olarak çalışıyorsun.`,
    alanlar: 'İlgilendiğin alanlar',
    alan: 'Alanlar',
    kullan: 'Ne zaman',
    gorev: 'Görev listesinde sana ait bir iş varsa işe başlarken sürüyor, bitirince tamamlandı olarak işaretle.',
    yardimciKurali: 'Yardımcı sınırı: her ekip üyesi aynı anda en fazla bir yardımcı alabilir (kendisi ve bir kopyası); takım dışı yardımcıların toplamı ekip sayısını geçemez. Yeni ajan açmadan önce SendMessage ile mevcut üyeye ya da boşta duran yardımcıya iş ver. İşi biten yardımcıyı kapat. Sınır aşılırsa ajan açma isteği reddedilir.',
    gorevSef: 'Ekibe iş dağıtırken her işi görev listesine yaz ve sahibini ata. Ekip üyesi işi teslim ettiğinde görevi tamamlandı olarak işaretlememişse sen işaretle.',
    proje: 'Üzerinde çalışılan proje',
    klasor: 'Klasör',
    alanAdlari: 'Alan adları',
    hesaplar: 'Bu projeye bağlı hesaplar',
    hesapNot: 'Bu liste yalnızca hangi hesabın bu projeye ait olduğunu gösterir. Şifre ve giriş bilgisi burada yoktur, kullanıcıdan da isteme. Giriş gereken yerde dur ve kullanıcının kendisinin giriş yapmasını iste. Bu hesaplarda paylaşım, silme ya da ayar değişikliği yapmadan önce kullanıcıdan açık onay al.',
    test: 'Test',
    testKomut: 'Test komutu',
    testAdres: 'Test adresi',
    testKapisi: (kim) => `Bir işi bitti saymadan önce ${kim ? kim + ' adlı ekip üyesine' : 'ekipteki test sorumlusuna, yoksa kendin'} doğrulat. Doğrulamadan geçmeyen işi kullanıcıya bitti diye bildirme, neyin kaldığını söyle.`,
    notlar: 'Proje notları',
    tarayici: 'Tarayıcı',
    tarayiciKurali: 'Web işleri için yalnızca uygulamanın kendi tarayıcısını kullan (tarayici_ araçları): Apple Developer, App Store Connect, Google Play Console, GitHub, Vercel gibi bağlı hesaplar ve projenin Test sekmesi orada açıktır, girişler hazırdır. Asla yeni Chrome, Safari ya da başka bir tarayıcı penceresi açma; open, start, xdg-open komutlarıyla adres açma, Playwright ya da Puppeteer ile tarayıcı başlatma. Gereken hesap listede yoksa sahibe Tarayıcı sayfasından eklemesini söyle. WhatsApp tarayıcıda kullanılmaz.',
    skillOncelik: 'Skill öncelikli çalışma',
    skillOncelikKurali: 'Kabiliyetlerin skillerle güçlendirildi; işi skilleri temel alarak kur. Her işe başlamadan önce sana atanan ve şirkette açık olan skillere bak. Uyan bir skill varsa önce onu çalıştır ya da SKILL.md dosyasını okuyup adımlarını uygula, sonra kendi bilginle tamamla. Ekibe iş verirken ilgili skilin adını da yaz. Raporunda hangi skilleri kullandığını belirt. Oturum sırasında "[Ofis] Yeni skill eklendi" haberi gelirse o skili listene ekle ve uyan ilk işte kullan; "kapatıldı" haberi gelirse kullanmayı bırak.',
    githubBaslik: 'GitHub',
    githubKurali: 'Dal, PR ve depo işleri için github_dallar, github_dal_sil, github_pr_ac, github_pr_birlestir, github_pr_kapat ve github_depo araçlarını kullan. İş bitince kendi açtığın ve birleşen dalları sil. PR birleştirme ve depo ayarı değişikliği sahibin onayına gider; depo silme senin işin değildir.',
    surumler: 'Sürüm numaraları',
    surumKurali: 'Sürüm numarası ANA.KÜÇÜK.YAMA biçimindedir (anlamsal sürümleme). Yalnızca hata düzeltmesi: son rakam artar (1.1.0 → 1.1.1). Geriye uyumlu yeni özellik: orta rakam artar, son rakam sıfırlanır (1.1.1 → 1.2.0). Uyumu bozan büyük değişiklik: ilk rakam artar, diğerleri sıfırlanır (1.2.0 → 2.0.0). Rakamlar 9\'da devretmez, 1.0.9\'dan sonra 1.0.10 gelebilir. Mağaza uygulamalarında build numarası (iOS CFBundleVersion, Android versionCode) her yüklemede artar ve sürüm numarasından ayrıdır. Sürümü değiştirmeden önce hangi türde olduğunu ve nedenini sahibe söyle.',
    ortakBaslik: 'Veritabanı ve portlar',
    ortakKurali: 'Bilgisayarda ortak bir Postgres var; her proje içinde kendi veritabanını ve kullanıcısını alır. Projenin zaten kendi Postgres\'i varsa (ör. compose dosyasında) ona dokunma ve onu kullanmaya devam et; yeni bir veritabanı gerektiğinde ise yeni Postgres kabı kurma, docker-compose dosyasına postgres servisi ekleme, 5432 portunu kullanma. Bağlantıyı ortak_db aracıyla al ve .env dosyasına DATABASE_URL olarak yaz; şifreyi koda ya da commit\'e koyma. Test veritabanını ortak_db_test ile aç, işin bitince sil. Uygulamanın dinleyeceği portları (api, web, worker) port_ayir ile katın port bloğundan al; 3000, 5173, 8080 gibi sabit portlar seçme.',
    surecler: 'Süreçler',
    surecKurali: 'Başlattığın sunucu ve süreçlerin PID numarasını kaydet, işin bitince yalnızca o PID ile kapat (kill <pid>). pkill, killall ya da desenle süreç öldürme kullanma: bilgisayardaki başka uygulamaları (Docker, Ajan Ofisi, ekip arkadaşlarının sunucuları) da kapatır. Docker Desktop\'ı ya da Docker sanal makinesini kapatma, yeniden başlatma. Docker\'ı ham komutla (docker, docker compose) kullanma: veritabanı, önbellek, API gibi servisler için servisler, servis_baslat, servis_durdur, servis_yeniden, servis_derle, servis_log ve servis_komut araçlarını kullan. Test veritabanını servis_komut ile aç, işin bitince sil. Bu araçların yapamadığı bir Docker işi gerekirse sahipten iste.',
    testAraclari: 'Test araçların',
    testAraclariAciklama: (p) =>
      `Uygulamanın ofis araçlarıyla işi kendin dene, sahibe "dene" deme. ${p === 'darwin' ? 'iOS: ios_cihazlar ile simülatörleri listele, ios_ac ile aç, ios_kur ve ios_baslat ile uygulamayı kur ve başlat, ios_goruntu ile ekrana bak. ' : 'Bu bilgisayar Mac değil, iOS simülatörü yok. '}Android: android_cihazlar, android_kur, android_adres, android_goruntu (emülatör ya da bağlı cihaz açık olmalı). Web: tarayicilar listesindeki Test sekmesini tarayici_ac ile aç, tarayici_cihaz ile iPhone ya da Android moduna al, tarayici_goruntu ile bak, tarayici_konsol ile hataları oku. Bir işi bitti saymadan önce ilgili testi yap ve sonucu raporuna yaz.`,
    digerSkiller: 'Kullanabileceğin diğer skiller',
    digerSkillAciklama: 'Şirkette açık olan skiller. İşin bir skile uyuyorsa sormadan kullan.',
    ekipAciklamaCodex: 'Şirkette seninle birlikte çalışanlar. İşini bitirince son mesajında ne yaptığını ve neyin kaldığını kısaca yaz, sonucu şef toplar.',
    ekipCagriCodex: 'Ekip üyesi çağırırken spawn_agent aracında agent_type olarak tam şu adı kullan. Her üyeye işi tek mesajda, gereken bütün bilgiyle ver ve sonuçlarını bekleyip topla:',
    skillAciklamaCodex: 'Şu skiller sana atandı. İlgili işte önce skilin SKILL.md dosyasını oku ve oradaki adımları uygula, sonra kendi bilginle devam et:',
    gorevSefCodex: 'İşi dağıtırken planını güncel tut. Ekipten gelen her sonucu kontrol et, eksik varsa aynı üyeye geri gönder.',
  },
  en: {
    kurallarin: 'Your rules',
    sirketKurallari: 'Company rules',
    ekip: 'Team',
    ekipAciklama: 'The people who work with you in this company. To talk to one of them, message them by name.',
    sef: 'hands out the work and collects the results',
    skiller: 'Your skills',
    skillAciklama: 'These skills are assigned to you. For matching work run the skill first, then continue with your own knowledge:',
    ekibin: 'Your team',
    ekipCagri: 'When you call a team member, use exactly this agent type and pass the short name as the name:',
    ekipYok: 'Nobody is on the team yet. Do every job yourself. If a job needs a specialist, suggest that the user add one from the Team page of the app.',
    tur: 'type',
    isim: 'name',
    kimlik: (ad, unvan, sirket) => `Your name is ${ad}. You work at the company called ${sirket} as ${unvan || 'a team member'}.`,
    alanlar: 'Your areas',
    alan: 'Areas',
    kullan: 'When',
    gorev: 'If a job on the task list is yours, mark it in progress when you start and completed when you finish.',
    yardimciKurali: 'Helper limit: each team member can have at most one helper at a time (itself and one copy); helpers outside the team can be at most as many as the team. Before opening a new agent, give the work to an existing member or an idle helper with SendMessage. Shut down helpers whose work is done. Requests over the limit are refused.',
    gorevSef: 'When you hand out work, put every job on the task list and assign its owner. If a team member hands work in without marking the task completed, mark it yourself.',
    proje: 'The project being worked on',
    klasor: 'Folder',
    alanAdlari: 'Domains',
    hesaplar: 'Accounts linked to this project',
    hesapNot: 'This list only shows which accounts belong to this project. It holds no passwords or login details, and you must not ask the user for them. Where a login is needed, stop and ask the user to sign in themselves. Get explicit approval from the user before posting, deleting or changing settings on these accounts.',
    test: 'Testing',
    testKomut: 'Test command',
    testAdres: 'Test address',
    testKapisi: (kim) => `Before you call a job done, have ${kim ? 'the team member named ' + kim : 'the tester on the team, or yourself if there is none,'} verify it. Do not report unverified work to the user as finished, say what is left.`,
    notlar: 'Project notes',
    tarayici: 'Browser',
    tarayiciKurali: 'For web work use only the app\'s own browser (the tarayici_ tools): linked accounts such as Apple Developer, App Store Connect, Google Play Console, GitHub and Vercel, and the project\'s Test tab are open there and already signed in. Never open a new Chrome, Safari or any other browser window; do not open addresses with open, start or xdg-open, and do not launch a browser with Playwright or Puppeteer. If an account you need is missing, ask the owner to add it on the Browser page. WhatsApp is not used in the browser.',
    skillOncelik: 'Skill first',
    skillOncelikKurali: 'Your abilities are extended with skills; build the work on top of them. Before starting any job, look at the skills assigned to you and the ones turned on in the company. If one matches, run it first or read its SKILL.md and follow its steps, then finish with your own knowledge. When you hand work to the team, name the relevant skill. Say which skills you used in your report. If an "[Office] New skill added" message arrives during the session, add that skill to your list and use it on the first matching job; if a "turned off" message arrives, stop using it.',
    githubBaslik: 'GitHub',
    githubKurali: 'For branches, pull requests and repository work use the github_dallar, github_dal_sil, github_pr_ac, github_pr_birlestir, github_pr_kapat and github_depo tools. When work is done, delete the branches you opened that were merged. Merging a PR and changing repository settings go to the owner for approval; deleting a repository is never your job.',
    surumler: 'Version numbers',
    surumKurali: 'Version numbers are MAJOR.MINOR.PATCH (semantic versioning). Bug fixes only: the last number goes up (1.1.0 → 1.1.1). Backward compatible new features: the middle number goes up and the last resets (1.1.1 → 1.2.0). Big breaking changes: the first number goes up and the others reset (1.2.0 → 2.0.0). Numbers do not roll over at 9; 1.0.10 can follow 1.0.9. For store apps the build number (iOS CFBundleVersion, Android versionCode) goes up on every upload and is separate from the version. Before changing the version, tell the owner which kind it is and why.',
    ortakBaslik: 'Database and ports',
    ortakKurali: 'There is a shared Postgres on this computer; each project gets its own database and user in it. If the project already has its own Postgres (for example in its compose file), leave it alone and keep using it; when a new database is needed, do not start a new Postgres container, do not add a postgres service to docker-compose, do not use port 5432. Get the connection with the ortak_db tool and put it in .env as DATABASE_URL; never put the password in code or commits. Create test databases with ortak_db_test and drop them when done. Get the ports your app listens on (api, web, worker) from the floor\'s port block with port_ayir; do not pick fixed ports such as 3000, 5173 or 8080.',
    surecler: 'Processes',
    surecKurali: 'Record the PID of every server and process you start and when you are done stop only that PID (kill <pid>). Never use pkill, killall or pattern matching to kill processes: it also stops other apps on the computer (Docker, Ajan Ofisi, your teammates\' servers). Never quit or restart Docker Desktop or its virtual machine. Do not use Docker with raw commands (docker, docker compose): for services such as databases, caches and APIs use the servisler, servis_baslat, servis_durdur, servis_yeniden, servis_derle, servis_log and servis_komut tools. Create test databases with servis_komut and drop them when you are done. If you need a Docker job these tools cannot do, ask the owner.',
    testAraclari: 'Your test tools',
    testAraclariAciklama: (p) =>
      `Try the work yourself with the app's ofis tools instead of asking the owner to try it. ${p === 'darwin' ? 'iOS: list simulators with ios_cihazlar, open one with ios_ac, install and launch with ios_kur and ios_baslat, look at the screen with ios_goruntu. ' : 'This computer is not a Mac, so there is no iOS Simulator. '}Android: android_cihazlar, android_kur, android_adres, android_goruntu (an emulator or connected device must be running). Web: open the Test tab from tarayicilar with tarayici_ac, switch to iPhone or Android with tarayici_cihaz, look with tarayici_goruntu and read errors with tarayici_konsol. Before you call a job done, run the matching test and put the result in your report.`,
    digerSkiller: 'Other skills you can use',
    digerSkillAciklama: 'Skills that are on in this company. If the job matches a skill, use it without asking.',
    ekipAciklamaCodex: 'The people who work with you in this company. When you finish, end with a short note on what you did and what is left. The chief collects the results.',
    ekipCagriCodex: 'When you call a team member, pass exactly this name as agent_type to the spawn_agent tool. Give each member the whole job in one message with everything they need, then wait for and collect the results:',
    skillAciklamaCodex: 'These skills are assigned to you. For matching work first read the skill SKILL.md file and follow its steps, then continue with your own knowledge:',
    gorevSefCodex: 'Keep your plan up to date while you hand out work. Check every result from the team and send it back to the same member if something is missing.',
  },
};

const PLATFORM_ADI = { appledev: 'Apple Developer', apple: 'App Store Connect', playconsole: 'Google Play Console', github: 'GitHub', vercel: 'Vercel', cloudflare: 'Cloudflare', supabase: 'Supabase', firebase: 'Firebase', expo: 'Expo', google: 'Google', gmail: 'Gmail', telegram: 'Telegram', instagram: 'Instagram', x: 'X', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', facebook: 'Facebook', discord: 'Discord' };

// Proje kartının talimata eklenen hali. Şef için tam, ekip üyeleri için kısa.
export function projeMetni(sirket, proje, { tam = true } = {}) {
  if (!proje) return '';
  const m = M[sirket.dil] || M.tr;
  const b = [`## ${m.proje}: ${proje.ad}`];
  const satir = [];
  if (proje.aciklama) satir.push(proje.aciklama);
  if (proje.klasor) satir.push(`${m.klasor}: ${proje.klasor}`);
  if (proje.alanAdlari.length) satir.push(`${m.alanAdlari}: ${proje.alanAdlari.join(', ')}`);
  if (satir.length) b.push(satir.join('\n'));
  if (proje.hesaplar.length) {
    b.push(`### ${m.hesaplar}\n\n${m.hesapNot}\n\n` + proje.hesaplar.map((h) => `- ${PLATFORM_ADI[h.platform] || h.not || '?'}: ${h.ad}${h.not && PLATFORM_ADI[h.platform] ? ' (' + h.not + ')' : ''}`).join('\n'));
  }
  const t = proje.test;
  const sorumlu = t.sorumlu ? (proje.ajanlar || sirket.ajanlar).find((a) => a.id === t.sorumlu) : null;
  const testSatir = [];
  if (t.komut) testSatir.push(`${m.testKomut}: \`${t.komut}\``);
  if (t.adres) testSatir.push(`${m.testAdres}: ${t.adres}`);
  if (t.zorunlu && tam) testSatir.push(m.testKapisi(sorumlu ? sorumlu.ad : ''));
  if (testSatir.length) b.push(`### ${m.test}\n\n` + testSatir.join('\n'));
  b.push(`### ${m.tarayici}\n\n${m.tarayiciKurali}`);
  b.push(`### ${m.skillOncelik}\n\n${m.skillOncelikKurali}`);
  b.push(`### ${m.ortakBaslik}\n\n${m.ortakKurali}`);
  b.push(`### ${m.surecler}\n\n${m.surecKurali}`);
  b.push(`### ${m.surumler}\n\n${m.surumKurali}`);
  b.push(`### ${m.githubBaslik}\n\n${m.githubKurali}`);
  if (tam && proje.notlar.trim()) b.push(`### ${m.notlar}\n\n${proje.notlar.trim()}`);
  return b.length > 1 ? b.join('\n\n') : '';
}

const y = (s) => JSON.stringify(String(s ?? '')); // YAML çift tırnaklı dize olarak da geçerlidir

function liste(maddeler) {
  return maddeler.map((m, i) => `${i + 1}. ${m}`).join('\n');
}

// Ekip üyesinin talimat gövdesi. motor: 'claude' ya da 'codex'. skillKlasoru: Codex'te skillerin derlendiği klasör.
export function ajanGovde(sirket, ajan, skillBilgi = {}, proje = null, { motor = 'claude', skillKlasoru = '' } = {}) {
  const m = M[sirket.dil] || M.tr;
  const codex = motor === 'codex';
  const bolum = [];
  bolum.push(m.kimlik(ajan.ad, ajan.unvan, sirket.ad) + (ajan.alanlar.length ? ` ${m.alanlar}: ${ajan.alanlar.join(', ')}.` : ''));
  if ((ajan.talimat || '').trim()) bolum.push(ajan.talimat.trim());
  if (ajan.kurallar.length) bolum.push(`## ${m.kurallarin}\n\n${liste(ajan.kurallar)}`);
  if (sirket.kurallar.length) bolum.push(`## ${m.sirketKurallari}\n\n${liste(sirket.kurallar.map((k) => k.metin))}`);
  // atanan skiller öncelikli, şirkette açık olan diğer bütün skiller de her ajana açıktır
  const atanan = ajan.skiller.filter((id) => skillBilgi[id]);
  const diger = Object.keys(skillBilgi).filter((id) => !atanan.includes(id));
  const ac = (id) => (skillBilgi[id].aciklama ? '. ' + skillBilgi[id].aciklama.slice(0, 160) : '');
  const yol = (id) => (codex ? path.join(skillKlasoru, id, 'SKILL.md') : `/${EKLENTI_ADI}:${id}`);
  if (atanan.length) bolum.push(`## ${m.skiller}\n\n${codex ? m.skillAciklamaCodex : m.skillAciklama}\n\n${liste(atanan.map((id) => yol(id) + ac(id)))}`);
  if (diger.length) bolum.push(`## ${m.digerSkiller}\n\n${m.digerSkillAciklama}\n\n${liste(diger.map((id) => yol(id) + ac(id)))}`);
  const digerleri = sirket.ajanlar.filter((a) => a.id !== ajan.id);
  const satirlar = [
    `${sirket.sef.ad} (${sirket.sef.unvan}): ${m.sef}`,
    ...digerleri.map((a) => `${a.ad} (${m.isim}: ${a.id})${a.unvan ? ': ' + a.unvan : ''}${a.alanlar.length ? '. ' + m.alan + ': ' + a.alanlar.join(', ') : ''}`),
  ];
  bolum.push(codex ? `## ${m.ekip}\n\n${m.ekipAciklamaCodex}\n\n${liste(satirlar)}` : `## ${m.ekip}\n\n${m.ekipAciklama}\n\n${liste(satirlar)}\n\n${m.gorev}`);
  const projeBolum = projeMetni(sirket, proje, { tam: false });
  if (projeBolum) bolum.push(projeBolum);
  return bolum.join('\n\n');
}

export function ajanTanimi(sirket, ajan) {
  const m = M[sirket.dil] || M.tr;
  return [ajan.ad + (ajan.unvan ? ', ' + ajan.unvan : ''), ajan.alanlar.length ? m.alan + ': ' + ajan.alanlar.join(', ') : '', ajan.cagri].filter(Boolean).join('. ');
}

// Claude Code ajan dosyası
export function ajanMetni(sirket, ajan, skillBilgi = {}, proje = null) {
  const on = ['---', `name: ${ajan.id}`, `description: ${y(ajanTanimi(sirket, ajan))}`];
  const model = ajan.model || sirket.modeller.claude.calisan;
  if (model) on.push(`model: ${model}`);
  if (ajan.hafiza) on.push('memory: user');
  on.push(`color: ${ccRenk(ajan.renk)}`, '---', '');
  return on.join('\n') + '\n' + ajanGovde(sirket, ajan, skillBilgi, proje) + '\n';
}

// Codex rol dosyası (TOML). JSON dizesi TOML temel dizesi olarak da geçerlidir.
export function codexRolMetni(sirket, ajan, skillBilgi, proje, { skillKlasoru, model }) {
  const satir = [];
  if (model) satir.push(`model = ${JSON.stringify(model)}`);
  satir.push(`developer_instructions = ${JSON.stringify(ajanGovde(sirket, ajan, skillBilgi, proje, { motor: 'codex', skillKlasoru }))}`);
  return satir.join('\n') + '\n';
}

// Özel sohbet: sahip ekipten biriyle bire bir konuşur. Beyin ve şef bu konuşmayı görmez, kişi proje dosyalarına dokunmaz.
const OZEL = {
  tr: (ad, sahip, calisma) =>
    `Bu özel bir sohbet. ${sahip ? sahip + ' adlı sahibinle' : 'Sahibinle'} bire bir konuşuyorsun. Bu konuşma beyinle, kat şefiyle ya da ekiple paylaşılmaz, sen de paylaşma. ${calisma ? 'Yalnızca kendi oda klasöründe çalış, dışındaki dosyalara dokunma.' : 'Dosya yazma ya da değiştirme, komut çalıştırma. Yalnızca konuş, dinle, eklenen dosyaları oku ve uzmanlığınla yardım et.'} Kısa ve doğal cümleler kur.`,
  en: (ad, sahip, calisma) =>
    `This is a private chat. You are talking one to one with ${sahip ? 'your owner ' + sahip : 'your owner'}. This conversation is not shared with the brain, the floor chief or the team, and you must not share it either. ${calisma ? 'Work only inside your own room folder and never touch files outside it.' : 'Do not write or change files or run commands. Only talk, listen, read attached files and help with your expertise.'} Use short, natural sentences.`,
};

export function ozelMetni(sirket, ajan, { klasor = '', calisma = false } = {}) {
  const m = M[sirket.dil] || M.tr;
  const dil = sirket.dil === 'en' ? 'en' : 'tr';
  const bolum = [m.kimlik(ajan.ad, ajan.unvan, sirket.ad) + (ajan.alanlar.length ? ` ${m.alanlar}: ${ajan.alanlar.join(', ')}.` : '')];
  if ((ajan.talimat || '').trim()) bolum.push(ajan.talimat.trim());
  if (ajan.kurallar.length) bolum.push(`## ${m.kurallarin}\n\n${liste(ajan.kurallar)}`);
  bolum.push(OZEL[dil](ajan.ad, (sirket.beyin && sirket.beyin.sahip) || '', calisma));
  if (klasor) bolum.push(dil === 'en' ? `Your room folder: ${klasor}. Files the owner attaches are in its ekler folder; read them when they are mentioned.${calisma ? ' Save what you produce into its ciktilar folder.' : ''}` : `Oda klasörün: ${klasor}. Sahibin eklediği dosyalar ekler klasöründe, bahsedildiğinde oku.${calisma ? ' Ürettiklerini ciktilar klasörüne kaydet.' : ''}`);
  return bolum.join('\n\n') + '\n';
}

export function sefMetni(sirket, { proje = null, devir = '', motor = 'claude' } = {}) {
  const m = M[sirket.dil] || M.tr;
  const codex = motor === 'codex';
  const bolum = [];
  bolum.push(`# ${sirket.ad}`);
  bolum.push(m.kimlik(sirket.sef.ad, sirket.sef.unvan, sirket.ad));
  bolum.push((sirket.sef.talimat || '').trim());
  if (sirket.ajanlar.length) {
    const satir = (a) =>
      codex
        ? `${a.ad} (agent_type: ${a.id})${a.unvan ? '. ' + a.unvan : ''}${a.alanlar.length ? '. ' + m.alan + ': ' + a.alanlar.join(', ') : ''}.${a.cagri ? ' ' + m.kullan + ': ' + a.cagri : ''}`
        : `${a.ad} (${m.tur}: ${EKLENTI_ADI}:${a.id}, ${m.isim}: ${a.id})${a.unvan ? '. ' + a.unvan : ''}${a.alanlar.length ? '. ' + m.alan + ': ' + a.alanlar.join(', ') : ''}.${a.cagri ? ' ' + m.kullan + ': ' + a.cagri : ''}`;
    bolum.push(`## ${m.ekibin}\n\n${codex ? m.ekipCagriCodex : m.ekipCagri}\n\n${liste(sirket.ajanlar.map(satir))}\n\n${codex ? m.gorevSefCodex : m.gorevSef}\n\n${m.yardimciKurali}`);
  } else {
    bolum.push(`## ${m.ekibin}\n\n${m.ekipYok}`);
  }
  if (sirket.kurallar.length) bolum.push(`## ${m.sirketKurallari}\n\n${liste(sirket.kurallar.map((k) => k.metin))}`);
  if (proje) bolum.push(`## ${m.testAraclari}\n\n${m.testAraclariAciklama(process.platform)}`);
  bolum.push(projeMetni(sirket, proje));
  bolum.push(devir);
  return bolum.filter(Boolean).join('\n\n') + '\n';
}

function temizle(klasor) {
  fs.rmSync(klasor, { recursive: true, force: true });
  fs.mkdirSync(klasor, { recursive: true });
}

// Skil içindeki eklenti yolu göndermelerini bu eklentinin düzenine uyarlar
function skillYolDuzelt(klasor, id) {
  const kalip = new RegExp('\\$\\{CLAUDE_PLUGIN_ROOT\\}/(?:\\.claude/)?skills/' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=[/"\'\\s`])', 'g');
  const gez = (d, derinlik) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (derinlik < 3) gez(p, derinlik + 1);
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        const s = fs.readFileSync(p, 'utf8');
        if (s.includes('${CLAUDE_PLUGIN_ROOT}')) {
          const yeni = s.replace(kalip, '${CLAUDE_PLUGIN_ROOT}/skills/' + id);
          if (yeni !== s) fs.writeFileSync(p, yeni);
        }
      }
    }
  };
  gez(klasor, 0);
}

function skillKopyala(skiller, klasor, { claudeYolu = false } = {}) {
  fs.mkdirSync(klasor, { recursive: true });
  for (const s of skiller) {
    const varis = path.join(klasor, s.id);
    fs.cpSync(s.klasor, varis, { recursive: true, filter: (kaynak) => !['.git', 'node_modules', '.ofis.json'].includes(path.basename(kaynak)) });
    if (claudeYolu) skillYolDuzelt(varis, s.id);
  }
}

// Canlı olayların gideceği adres. etiket: hangi oturumdan geldiğini ayırmak için.
export function olayAdresi(port, anahtar, etiket = '') {
  return `http://127.0.0.1:${port}/olay/${anahtar}${etiket ? '/' + encodeURIComponent(etiket) : ''}`;
}

// skiller: [{ id, klasor, aciklama }] yalnızca etkin olanlar
// proje: üzerinde çalışılan proje kartı. devir: kayıt defterinden çıkan "kaldığın yer" notu.
// motor: 'claude' (eklenti klasörü) ya da 'codex' (rol dosyaları ve talimat). codexModel: { koordinator, calisan } çözülmüş adlar.
export function derle(sirket, { hedef, skiller = [], port, anahtar, etiket = '', proje = null, devir = '', motor = 'claude', codexModel = null }) {
  if (motor === 'codex') return codexDerle(sirket, { hedef, skiller, port, anahtar, etiket, proje, devir, codexModel });
  const eklenti = path.join(hedef, EKLENTI_ADI);
  temizle(eklenti);
  fs.mkdirSync(path.join(eklenti, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(eklenti, 'agents'));
  fs.mkdirSync(path.join(eklenti, 'hooks'));

  fs.writeFileSync(
    path.join(eklenti, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: EKLENTI_ADI, displayName: sirket.ad, version: '1.0.0', description: 'Ajan Ofisi: ' + sirket.ad, author: { name: sirket.ad } }, null, 2) + '\n'
  );

  const skillBilgi = Object.fromEntries(skiller.map((s) => [s.id, s]));
  for (const a of sirket.ajanlar) fs.writeFileSync(path.join(eklenti, 'agents', a.id + '.md'), ajanMetni(sirket, a, skillBilgi, proje));
  skillKopyala(skiller, path.join(eklenti, 'skills'), { claudeYolu: true });

  const adres = olayAdresi(port, anahtar, etiket);
  const hooks = {};
  for (const olay of OLAYLAR) hooks[olay] = [{ hooks: [{ type: 'http', url: adres, timeout: 2 }] }];
  fs.writeFileSync(path.join(eklenti, 'hooks', 'hooks.json'), JSON.stringify({ hooks }, null, 2) + '\n');

  const sefDosya = path.join(hedef, 'sef.md');
  fs.writeFileSync(sefDosya, sefMetni(sirket, { proje, devir }));
  return { motor: 'claude', eklenti, sefDosya };
}

// Codex'e gönderilen olaylar. Codex yalnızca komut türünde hook çalıştırır: olay gövdesi curl ile yerel alıcıya iletilir.
export const CODEX_OLAYLAR = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop', 'SubagentStart', 'SubagentStop'];

export function codexKancaKomutu(adres, platform = process.platform) {
  // sunucu yalnızca bir karar (ör. alt ajan reddi) varsa gövde döndürür; o zaman çıktı motora gider
  if (platform === 'win32') return `curl.exe -s -m 2 -H "content-type: application/json" --data-binary @- "${adres}"`;
  return `curl -s -m 2 -H 'content-type: application/json' --data-binary @- '${adres}' 2>/dev/null || true`;
}

function codexDerle(sirket, { hedef, skiller, port, anahtar, etiket, proje, devir, codexModel }) {
  const kok = path.join(hedef, 'codex');
  temizle(kok);
  const skillKlasoru = path.join(kok, 'skills');
  skillKopyala(skiller, skillKlasoru);
  const skillBilgi = Object.fromEntries(skiller.map((s) => [s.id, s]));
  fs.mkdirSync(path.join(kok, 'agents'));
  const roller = sirket.ajanlar.map((a) => {
    const dosya = path.join(kok, 'agents', a.id + '.toml');
    const model = a.codexModel || (codexModel && codexModel.calisan) || '';
    fs.writeFileSync(dosya, codexRolMetni(sirket, a, skillBilgi, proje, { skillKlasoru, model }));
    return { id: a.id, aciklama: ajanTanimi(sirket, a), dosya, model };
  });
  // Codex'te ekip skillerine şef de ulaşabilsin diye talimata skill listesi eklenir
  let talimat = sefMetni(sirket, { proje, devir, motor: 'codex' });
  if (skiller.length) {
    const m = M[sirket.dil] || M.tr;
    talimat += `\n## ${m.skiller}\n\n${m.skillAciklamaCodex}\n\n${liste(skiller.map((s) => path.join(skillKlasoru, s.id, 'SKILL.md') + (s.aciklama ? '. ' + s.aciklama.slice(0, 200) : '')))}\n`;
  }
  const sefDosya = path.join(hedef, 'sef-codex.md');
  fs.writeFileSync(sefDosya, talimat);
  const koordinator = sirket.sef.codexModel || (codexModel && codexModel.koordinator) || '';
  return { motor: 'codex', roller, talimat, sefDosya, koordinator, kancaKomutu: codexKancaKomutu(olayAdresi(port, anahtar, etiket)) };
}

// Codex oturumunun bağımsız değişkenleri. Kullanıcının ~/.codex ayarlarına dosya yazılmaz, her şey -c ile verilir.
const CODEX_IZIN = { '': ['-s', 'workspace-write', '-a', 'on-request'], acceptEdits: ['-s', 'workspace-write', '-a', 'on-request'], auto: ['--approve-for-me'], plan: ['-s', 'read-only', '-a', 'on-request'], bypassPermissions: ['--dangerously-bypass-approvals-and-sandbox'] };

export function codexArgumanlari(sirket, cikti, { klasor, surdur = '' }) {
  const arg = surdur ? ['resume', surdur] : [];
  arg.push('-C', klasor, '--enable', 'multi_agent', '--dangerously-bypass-hook-trust');
  if (cikti.koordinator) arg.push('-m', cikti.koordinator);
  arg.push(...(CODEX_IZIN[sirket.izinModu] || CODEX_IZIN['']));
  arg.push('-c', 'developer_instructions=' + JSON.stringify(cikti.talimat));
  for (const r of cikti.roller) {
    arg.push('-c', `agents.${r.id}.description=${JSON.stringify(r.aciklama || r.id)}`);
    arg.push('-c', `agents.${r.id}.config_file=${JSON.stringify(r.dosya)}`);
  }
  const kanca = `[{hooks=[{type="command",command=${JSON.stringify(cikti.kancaKomutu)}}]}]`;
  for (const olay of CODEX_OLAYLAR) arg.push('-c', `hooks.${olay}=${kanca}`);
  return arg;
}

// Oturumu açan komut satırı bağımsız değişkenleri
// surdur: önceki oturumun kimliği verilirse o konuşma olduğu gibi geri yüklenir (daha çok jeton harcar).
export function oturumArgumanlari(sirket, { eklenti, sefDosya, oturumId, surdur = '', ad = '' }) {
  const arg = ['--plugin-dir', eklenti, '--append-system-prompt-file', sefDosya, ...(surdur ? ['--resume', surdur] : ['--session-id', oturumId]), '--name', ad || sirket.ad];
  const model = sirket.sef.model || sirket.modeller.claude.koordinator;
  if (model) arg.push('--model', model);
  if (sirket.izinModu) arg.push('--permission-mode', sirket.izinModu);
  // ajanlar yeni tarayıcı açmaz: uygulamanın kendi tarayıcısı kullanılır
  // desenle süreç öldürmek başka uygulamaları da kapatabilir (Docker, ofisin kendisi): yalnızca PID ile kill
  arg.push('--disallowedTools', 'mcp__claude-in-chrome,Bash(pkill:*),Bash(killall:*),Bash(docker:*),Bash(docker-compose:*)');
  return arg;
}
