// Durum motoru, şirket deposu, derleme ve skill yöneticisi sınamaları.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { yeniDurum, olayIsle, takimIsle, goruntu, aracOzet, sirketAyarla, oturumAc, oturumKapat, rolCoz } from '../cekirdek/durum.js';
import { SirketDeposu, normalle, varsayilanSirket, MASA_SAYISI, katGorunumu } from '../cekirdek/sirket.js';
import { derle, ajanMetni, sefMetni, oturumArgumanlari, codexArgumanlari, codexKancaKomutu, OLAYLAR, CODEX_OLAYLAR } from '../cekirdek/derle.js';
import { codexUyarla } from '../cekirdek/durum.js';
import { sohbetIsle, bekleyenSayisi, terminaleMetin, guvenSorusuMu, duzMetin } from '../cekirdek/sohbet.js';
import { mcpIsle } from '../cekirdek/mcp.js';
import { notMetni } from '../cekirdek/surum-notu.js';
import { codexVarsayilan, motorCoz, motorOrtami } from '../cekirdek/motor.js';
import { SkillDeposu, skillBaslik, githubCoz, katalogOku } from '../cekirdek/skiller.js';
import { kod, benzersizKod, turKodu, ccRenk, basHarf } from '../cekirdek/kimlik.js';
import { jsonAyikla } from '../cekirdek/claude.js';
import { cevirici, MOTOR } from '../cekirdek/dil.js';
import { SENARYO } from './senaryo.js';
import { KayitDefteri, olaydanKayit, devirOzeti, durumCikar } from '../cekirdek/kayit.js';
import { projeMetni } from '../cekirdek/derle.js';
import { altAjanIzle, altAjanKarari } from '../cekirdek/sinir.js';
import { onayKomutu } from '../cekirdek/onay-komutu.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ofis-test-'));

// ---------- kimlik ----------
assert.equal(kod('Çağrı Öztürk'), 'cagri-ozturk');
assert.equal(benzersizKod('Şef', new Set()), 'sef-2');
assert.equal(benzersizKod('Kaan', new Set(['kaan'])), 'kaan-2');
assert.equal(turKodu('ofis:kaan'), 'kaan');
assert.equal(ccRenk('#3F88C5'), 'blue');
assert.equal(basHarf('Kaan'), 'KA');
assert.equal(basHarf('ilk son'), 'İS');

// ---------- şirket deposu ----------
const depo = new SirketDeposu(path.join(tmp, 'sirket'));
depo.yukle('tr');
assert.equal(depo.veri.ajanlar.length, 0, 'şirket boş başlar');
assert.equal(depo.veri.sef.ad, 'Atlas');
assert.equal(depo.veri.beyin.ad, 'Beyin');
assert.throws(() => depo.sablondanEkle('backend'), /kat/, 'kat seçmeden ekip kurulmaz');
fs.mkdirSync(path.join(tmp, 'p1'));
const pr = depo.projeKaydet({ klasor: path.join(tmp, 'p1') });
depo.guncelle({ sonProje: pr.id });
const ekip = () => depo.proje(pr.id).ajanlar;
assert.equal(ekip().length, 0, 'yeni kat boş başlar');
const kaan = depo.sablondanEkle('backend');
depo.sablondanEkle('seo');
depo.sablondanEkle('frontend');
assert.equal(kaan.id, 'kaan');
assert.deepEqual(ekip().map((a) => a.masa), [0, 1, 2]);
const ozel = depo.ajanKaydet({ ad: 'Çeviri Uzmanı', unvan: 'Çevirmen', alanlar: 'İngilizce, Almanca', talimat: 'Çevir.' });
assert.equal(ozel.id, 'ceviri-uzmani');
assert.deepEqual(ozel.alanlar, ['İngilizce', 'Almanca']);
depo.ajanKaydet({ id: 'kaan', kurallar: ['Test yazmadan bitti deme.'] });
assert.deepEqual(ekip()[0].kurallar, ['Test yazmadan bitti deme.']);
assert.equal(ekip()[0].ad, 'Kaan', 'kısmi güncelleme diğer alanları korur');
// ikinci katın ekibi ayrıdır
fs.mkdirSync(path.join(tmp, 'p2'));
const pr2 = depo.projeKaydet({ klasor: path.join(tmp, 'p2') });
depo.sablondanEkle('backend', pr2.id);
assert.equal(depo.proje(pr2.id).ajanlar.length, 1);
assert.equal(ekip().length, 4);
depo.sefKaydet({ ad: 'Nil' }, pr2.id);
assert.equal(depo.proje(pr2.id).sef.ad, 'Nil');
assert.equal(depo.proje(pr.id).sef.ad, 'Atlas');
assert.equal(katGorunumu(depo.veri, depo.proje(pr2.id)).sef.ad, 'Nil');
depo.projeSil(pr2.id);
// bozuk girdi güvenli hale gelir
const kotu = normalle({ ad: 5, ajanlar: [{ ad: 'x'.repeat(500), model: 'yok', renk: 'kirmizi', masa: 99 }, null, 'a'], kurallar: [{ metin: '' }, 'iyi kural'], izinModu: 'hepsiSerbest' });
assert.equal(kotu.ajanlar.length, 1);
assert.equal(kotu.ajanlar[0].ad.length, 60);
assert.equal(kotu.ajanlar[0].model, '');
assert.match(kotu.ajanlar[0].renk, /^#[0-9A-F]{6}$/i);
assert.equal(kotu.ajanlar[0].masa, 0);
assert.equal(kotu.izinModu, '', 'bilinmeyen izin modu kabul edilmez');
assert.equal(normalle({ izinModu: 'bypassPermissions' }).izinModu, 'bypassPermissions', 'tam yetki sahibin seçimiyle kabul edilir');
assert.deepEqual(kotu.kurallar.map((k) => k.metin), ['iyi kural']);
// masa sayısı dolunca kalanlar ortak masaya düşer
const cok = normalle({ ajanlar: Array.from({ length: MASA_SAYISI + 2 }, (_, i) => ({ ad: 'A' + i })) });
assert.deepEqual(cok.ajanlar.slice(-2).map((a) => a.masa), [-1, -1]);
// dil değişimi: dokunulmamış varsayılanlar çevrilir, kullanıcının yazdıkları kalır
depo.guncelle({ kurallar: [...depo.veri.kurallar, { metin: 'Benim kuralım.' }] });
depo.dilDegistir('en');
assert.equal(depo.veri.sef.unvan, 'Chief');
assert.equal(depo.proje(pr.id).sef.unvan, 'Chief', 'katın şefi de çevrilir');
assert.equal(depo.veri.beyin.ad, 'Brain');
assert.equal(depo.veri.kurallar.at(-1).metin, 'Benim kuralım.');
depo.dilDegistir('tr');
// dosyadan geri okuma
const depo2 = new SirketDeposu(path.join(tmp, 'sirket'));
depo2.yukle('en');
assert.equal(depo2.proje(pr.id).ajanlar.length, 4);
assert.equal(depo2.veri.dil, 'tr');

// 0.2.x verisinden taşıma: ortak ekip katlara, şefin adı beyne geçer
const gocVeri = normalle({ surum: 1, kurulumBitti: true, sef: { ad: 'Mahmut' }, ajanlar: [{ ad: 'Kerem' }], projeler: [{ klasor: '/a' }, { klasor: '/b' }] });
assert.equal(gocVeri.beyin.ad, 'Mahmut');
assert.equal(gocVeri.ajanlar.length, 0);
assert.deepEqual(gocVeri.projeler.map((p) => p.ajanlar.map((a) => a.ad)), [['Kerem'], ['Kerem']]);
assert.deepEqual(gocVeri.projeler.map((p) => p.sef.ad), ['Atlas', 'Atlas'], 'kat şefi beyinle aynı adı taşımaz');
assert.equal(normalle(gocVeri).projeler[0].ajanlar.length, 1, 'taşıma bir kez yapılır');
// projesi olmayan eski veri: ekip havuzda bekler, ilk kata taşınır
fs.mkdirSync(path.join(tmp, 'havuz'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'havuz', 'sirket.json'), JSON.stringify({ surum: 1, kurulumBitti: true, ajanlar: [{ ad: 'Elif' }] }));
const hd = new SirketDeposu(path.join(tmp, 'havuz'));
hd.yukle();
assert.equal(hd.veri.ajanlar.length, 1);
const hp = hd.projeKaydet({ klasor: '/c' });
assert.deepEqual(hd.proje(hp.id).ajanlar.map((a) => a.ad), ['Elif']);
assert.equal(hd.veri.ajanlar.length, 0);
// model düzeni: 0.2.1 sonrası kısa süre düz tutulan biçim Claude ayarı sayılır
assert.deepEqual(normalle({ modeller: { koordinator: 'sonnet', calisan: 'haiku' } }).modeller.claude, { koordinator: 'sonnet', calisan: 'haiku' });
assert.deepEqual(normalle({}).modeller, { claude: { koordinator: 'opus', calisan: 'sonnet' }, codex: { koordinator: '', calisan: '' } });

// ---------- motorlar ----------
const codexListe = [
  { slug: 'gpt-6.1-sol', aciklama: 'Latest workhorse model for coding and everyday work.' },
  { slug: 'gpt-6-astra', aciklama: 'Frontier intelligence for the most demanding work.' },
  { slug: 'gpt-6-luna', aciklama: 'Fast and affordable model for easier tasks.' },
];
assert.deepEqual(codexVarsayilan(codexListe), { koordinator: 'gpt-6-astra', calisan: 'gpt-6.1-sol' });
assert.deepEqual(codexVarsayilan([]), { koordinator: '', calisan: '' });
const md = { claude: { yol: '/c', giris: { girisli: false } }, codex: { yol: '/x', giris: { girisli: true } } };
const ms = normalle({});
assert.equal(motorCoz(ms, md, { claude: false, codex: false }), 'codex', 'otomatik: girişi hazır olan seçilir');
assert.equal(motorCoz({ ...ms, giris: { claude: 'api', codex: 'abonelik' } }, md, { claude: true, codex: false }), 'claude', 'anahtarı olan hazır sayılır');
assert.equal(motorCoz({ ...ms, motor: 'claude' }, { claude: null, codex: md.codex }, {}), null, 'seçili motor yoksa başkasına geçilmez');
const ortamA = motorOrtami('claude', ms, { ANTHROPIC_API_KEY: 'kabuktan', PATH: '/bin' }, '');
assert.equal(ortamA.ANTHROPIC_API_KEY, undefined, 'abonelikte kabuktaki anahtar girişi ezmez');
const ortamB = motorOrtami('codex', { ...ms, giris: { claude: 'abonelik', codex: 'api' } }, {}, 'sk-x', { codexApiKlasoru: '/v/codex-api' });
assert.equal(ortamB.OPENAI_API_KEY, 'sk-x');
assert.equal(ortamB.CODEX_HOME, '/v/codex-api', 'anahtarlı Codex kullanıcının ~/.codex girişine dokunmaz');
// Codex araç adları ofis diline çevrilir
assert.equal(codexUyarla({ tool_name: 'collaborationspawn_agent', tool_input: { agent_type: 'kerem' } }).tool_input.subagent_type, 'kerem');
assert.equal(codexUyarla({ tool_name: 'exec_command', tool_input: { cmd: 'npm test' } }).tool_input.command, 'npm test');
assert.equal(codexUyarla({ tool_name: 'apply_patch', tool_input: { input: '*** Begin Patch\n*** Update File: src/a.js\n' } }).tool_input.file_path, 'src/a.js');
assert.equal(codexUyarla({ tool_name: 'Bash', tool_input: {} }).tool_name, 'Bash', 'Claude araçlarına dokunulmaz');
assert.match(codexKancaKomutu('http://127.0.0.1:1/olay/k/e', 'darwin'), /^curl .*--data-binary @- 'http:\/\/127\.0\.0\.1:1\/olay\/k\/e'/);
assert.match(codexKancaKomutu('http://127.0.0.1:1/olay/k/e', 'win32'), /^curl\.exe /);

// ---------- konuşma paneli ----------
{
  const kat = { sef: { ad: 'Atlas' }, ajanlar: [{ id: 'kerem', ad: 'Kerem' }] };
  const l = [];
  sohbetIsle(l, { hook_event_name: 'UserPromptSubmit', prompt: 'Siteyi güncelle' }, kat);
  sohbetIsle(l, { hook_event_name: 'UserPromptSubmit', prompt: '<task-notification>x' }, kat);
  sohbetIsle(l, { hook_event_name: 'PermissionRequest', agent_id: 'a1', agent_type: 'ofis:kerem', tool_name: 'Bash', tool_input: { command: 'npm i' } }, kat);
  assert.equal(l.length, 2, 'motor bildirimi panele düşmez');
  assert.deepEqual([l[1].kim, l[1].ad, l[1].tur, l[1].metin], ['uye', 'Kerem', 'onay', 'npm i']);
  assert.equal(bekleyenSayisi(l), 1);
  sohbetIsle(l, { hook_event_name: 'PostToolUse', agent_id: 'a1', tool_name: 'Bash' }, kat);
  assert.equal(bekleyenSayisi(l), 0, 'araç çalışınca onay kapanır');
  sohbetIsle(l, { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [{ question: 'Hangi renk?', options: [{ label: 'Mavi' }, { label: 'Yeşil' }] }] } }, kat);
  assert.deepEqual(l.at(-1).sorular[0].secenekler, ['Mavi', 'Yeşil']);
  sohbetIsle(l, { hook_event_name: 'Stop', last_assistant_message: 'Bitti.' }, kat);
  assert.equal(bekleyenSayisi(l), 0, 'tur bitince bekleyenler kapanır');
  assert.deepEqual([l.at(-1).kim, l.at(-1).metin], ['sef', 'Bitti.']);
  assert.equal(terminaleMetin('a\r\nb\x1b[31m'), '\x1b[200~a\nb[31m\x1b[201~', 'köşeli yapıştırma, kaçış karakteri atılır');
  assert.ok(guvenSorusuMu('claude', duzMetin('\x1b[1m❯ No, exit\r\n  Yes, I trust this folder')));
  assert.ok(!guvenSorusuMu('claude', duzMetin('Do you trust me?')));
}

// ---------- güncelleme notları ----------
assert.equal(notMetni('<h2>Yeni</h2><ul><li>Bir &amp; iki</li><li>Üç</li></ul>'), '## Yeni\n- Bir & iki\n- Üç');
assert.equal(notMetni([{ version: '1', note: '<p>a</p>' }, { version: '2', note: 'b' }]), 'a\n\nb');
assert.equal(notMetni(null), '');

// ---------- MCP ----------
{
  const araclar = { selam: { aciklama: 'a', sema: { type: 'object' }, calistir: async (g) => 'merhaba ' + g.ad }, hata: { aciklama: 'b', sema: { type: 'object' }, calistir: async () => { throw new Error('olmadı'); } } };
  const ilk = await mcpIsle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, araclar);
  assert.equal(ilk.result.protocolVersion, '2025-06-18');
  assert.equal(await mcpIsle({ jsonrpc: '2.0', method: 'notifications/initialized' }, araclar), null, 'bildirimin yanıtı olmaz');
  assert.deepEqual((await mcpIsle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, araclar)).result.tools.map((x) => x.name), ['selam', 'hata']);
  assert.equal((await mcpIsle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'selam', arguments: { ad: 'Sarp' } } }, araclar)).result.content[0].text, 'merhaba Sarp');
  const h = await mcpIsle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'hata', arguments: {} } }, araclar);
  assert.deepEqual([h.result.isError, h.result.content[0].text], [true, 'olmadı'], 'araç hatası modele döner');
  assert.equal((await mcpIsle({ jsonrpc: '2.0', id: 5, method: 'yok' }, araclar)).error.code, -32601);
}

// ---------- skill yöneticisi ----------
assert.deepEqual(skillBaslik('---\nname: a-b\ndescription: >\n  uzun\n  metin\nlicense: MIT\n---\ngovde'), { ad: 'a-b', aciklama: 'uzun metin', lisans: 'MIT' });
assert.deepEqual(githubCoz('https://github.com/obra/superpowers/tree/main/skills/brainstorming'), { repo: 'obra/superpowers', yol: 'skills/brainstorming', ref: 'main' });
assert.deepEqual(githubCoz('cloudflare/security-audit-skill'), { repo: 'cloudflare/security-audit-skill', yol: '', ref: '' });
assert.equal(githubCoz('https://example.com/x'), null);
assert.equal(githubCoz('a/b/../../etc'), null);
const katalog = katalogOku();
assert.ok(katalog.length >= 14);
for (const k of katalog) {
  assert.match(k.ref, /^[0-9a-f]{40}$/, k.id + ' sabit sürüme bağlı olmalı');
  assert.ok(k.tr && k.en && k.lisans && k.repo && k.yol, k.id);
}
// sahte depo: iki skill, bir sembolik bağ ve dışarı taşan dosya denemesi
const kaynak = path.join(tmp, 'depo-src', 'ornek-main');
fs.mkdirSync(path.join(kaynak, 'skills', 'bir', 'scripts'), { recursive: true });
fs.mkdirSync(path.join(kaynak, 'skills', 'iki'), { recursive: true });
fs.writeFileSync(path.join(kaynak, 'skills', 'bir', 'SKILL.md'), '---\nname: bir\ndescription: "Birinci. python ${CLAUDE_PLUGIN_ROOT}/.claude/skills/bir/scripts/a.py"\n---\nKomut: python "${CLAUDE_PLUGIN_ROOT}/.claude/skills/bir/scripts/a.py"\n');
fs.writeFileSync(path.join(kaynak, 'skills', 'bir', 'scripts', 'a.py'), 'print(1)\n');
fs.writeFileSync(path.join(kaynak, 'skills', 'iki', 'SKILL.md'), '---\nname: iki\ndescription: Ikinci\n---\n');
fs.symlinkSync('/etc/passwd', path.join(kaynak, 'skills', 'bir', 'gizli'));
const tar = await import('tar');
const arsiv = path.join(tmp, 'depo.tgz');
await tar.c({ gzip: true, file: arsiv, cwd: path.join(tmp, 'depo-src') }, ['ornek-main']);
const skiller = new SkillDeposu(path.join(tmp, 'skiller'), { indir: async () => ({ arsiv }) });
assert.deepEqual(await skiller.githubdanEkle({ repo: 'x/ornek', yol: 'skills/bir', ref: 'main', lisans: 'MIT' }), ['bir']);
assert.deepEqual((await skiller.githubdanEkle({ repo: 'x/ornek' })).sort(), ['bir', 'iki']);
assert.equal(fs.existsSync(path.join(tmp, 'skiller', 'bir', 'gizli')), false, 'sembolik bağ alınmaz');
assert.equal(fs.existsSync(path.join(tmp, 'skiller', 'bir', 'scripts', 'a.py')), true);
await assert.rejects(skiller.githubdanEkle({ repo: 'x/ornek', yol: 'olmayan' }));
await assert.rejects(skiller.githubdanEkle({ repo: '../x' }));
const yid = skiller.yeniYaz({ ad: 'Kod İnceleme', aciklama: 'PR öncesi kullan', govde: '1. Oku' });
assert.equal(yid, 'kod-inceleme');
assert.deepEqual(skiller.klasordenEkle(path.join(kaynak, 'skills')).sort(), ['bir', 'iki']);
assert.deepEqual(skiller.liste().map((s) => s.id), ['bir', 'iki', 'kod-inceleme']);
assert.equal(skiller.liste()[0].kaynak.tur, 'klasor');
skiller.sil('iki');
assert.equal(skiller.liste().length, 2);
assert.throws(() => skiller.sil('../sirket'));

// ---------- derleme ----------
const sirket = katGorunumu(depo.veri, depo.proje(pr.id));
sirket.ajanlar[0].skiller = ['bir'];
const cikti = derle(sirket, { hedef: path.join(tmp, 'calisma'), skiller: skiller.liste(), port: 47821, anahtar: 'k'.repeat(36) });
const ajanMd = fs.readFileSync(path.join(cikti.eklenti, 'agents', 'kaan.md'), 'utf8');
assert.match(ajanMd, /^---\nname: kaan\ndescription: "Kaan, Backend uzmanı\. Alanlar: API/);
assert.match(ajanMd, /memory: user\ncolor: blue\n---/);
assert.match(ajanMd, /Adın Kaan\. Şirketim adlı şirkette Backend uzmanı olarak çalışıyorsun\./);
assert.match(ajanMd, /## Senin kuralların\n\n1\. Test yazmadan bitti deme\./);
assert.match(ajanMd, /## Şirket kuralları\n\n1\. /);
assert.match(ajanMd, /\/ofis:bir/);
assert.match(ajanMd, /Mert \(isim: mert\): SEO uzmanı/);
const sefMd = fs.readFileSync(cikti.sefDosya, 'utf8');
assert.match(sefMd, /Adın Atlas\./);
assert.match(sefMd, /Kaan \(tür: ofis:kaan, isim: kaan\)\. Backend uzmanı\. Alanlar: API/);
assert.match(sefMetni(varsayilanSirket('en')), /Nobody is on the team yet/);
assert.match(ajanMetni(normalle({ dil: 'en', ajanlar: [{ ad: 'Leo', unvan: 'Backend specialist' }] }), normalle({ dil: 'en', ajanlar: [{ ad: 'Leo', unvan: 'Backend specialist' }] }).ajanlar[0]), /Your name is Leo\./);
const hooks = JSON.parse(fs.readFileSync(path.join(cikti.eklenti, 'hooks', 'hooks.json'), 'utf8')).hooks;
assert.deepEqual(Object.keys(hooks), OLAYLAR);
assert.equal(hooks.PreToolUse[0].hooks[0].type, 'http');
assert.match(hooks.PreToolUse[0].hooks[0].url, /^http:\/\/127\.0\.0\.1:47821\/olay\/k{36}$/);
assert.ok(!OLAYLAR.includes('SessionStart'), 'SessionStart http desteklemez');
const skillMd = fs.readFileSync(path.join(cikti.eklenti, 'skills', 'bir', 'SKILL.md'), 'utf8');
assert.ok(skillMd.includes('"${CLAUDE_PLUGIN_ROOT}/skills/bir/scripts/a.py"') && !skillMd.includes('.claude/skills'), 'eklenti yolu düzeltilir');
assert.equal(fs.existsSync(path.join(cikti.eklenti, 'skills', 'bir', '.ofis.json')), false);
assert.deepEqual(oturumArgumanlari(sirket, { ...cikti, oturumId: 'u' }).slice(0, 6), ['--plugin-dir', cikti.eklenti, '--append-system-prompt-file', cikti.sefDosya, '--session-id', 'u']);
assert.deepEqual(oturumArgumanlari(sirket, { ...cikti, oturumId: 'u' }).slice(-6), ['--model', 'opus', '--permission-mode', 'auto', '--disallowedTools', 'mcp__claude-in-chrome,Bash(pkill:*),Bash(killall:*),Bash(docker:*),Bash(docker-compose:*)'], 'şef varsayılan olarak güçlü modelle ve otomatik izin moduyla açılır, harici tarayıcı kullanmaz');
assert.equal(normalle({ izinModu: '' }).izinModu, 'auto', 'varsayılanda kalan eski ayar bir kez otomatiğe geçer');
assert.equal(normalle({ izinModu: '', izinGecisi: 1 }).izinModu, '', 'geçişten sonra seçilen "her seferinde sor" korunur');
assert.equal(normalle({ izinModu: 'plan' }).izinModu, 'plan');
assert.match(ajanMd, /\nmodel: sonnet\n/, 'çalışan varsayılan olarak dengeli modelle çalışır');
// etiketli olay adresi: hangi oturumdan geldiği ayrılır
const etiketli = derle(sirket, { hedef: path.join(tmp, 'calisma'), skiller: [], port: 2, anahtar: 'b', etiket: 'o1' });
assert.match(JSON.parse(fs.readFileSync(path.join(etiketli.eklenti, 'hooks', 'hooks.json'), 'utf8')).hooks.Stop[0].hooks[0].url, /\/olay\/b\/o1$/);
// Codex derlemesi: rol dosyaları, talimat ve hook'lar -c ile verilir
const cx = derle(sirket, { hedef: path.join(tmp, 'calisma'), skiller: skiller.liste(), port: 3, anahtar: 'c', etiket: 'o2', motor: 'codex', codexModel: { koordinator: 'gpt-6-astra', calisan: 'gpt-6.1-sol' } });
assert.equal(cx.motor, 'codex');
assert.equal(cx.koordinator, 'gpt-6-astra');
const rol = fs.readFileSync(cx.roller.find((r) => r.id === 'kaan').dosya, 'utf8');
assert.match(rol, /^model = "gpt-6\.1-sol"\ndeveloper_instructions = "Adın Kaan\./);
assert.match(rol, /skills[\\/]bir[\\/]SKILL\.md/, 'Codex çalışanı skill dosyasının yolunu bilir');
assert.match(cx.talimat, /Kaan \(agent_type: kaan\)/);
const cxArg = codexArgumanlari(sirket, cx, { klasor: '/proje' });
assert.deepEqual(cxArg.slice(0, 6), ['-C', '/proje', '--enable', 'multi_agent', '--dangerously-bypass-hook-trust', '-m']);
assert.ok(cxArg.includes('agents.kaan.config_file=' + JSON.stringify(cx.roller.find((r) => r.id === 'kaan').dosya)));
assert.equal(cxArg.filter((a) => a.startsWith('hooks.')).length, CODEX_OLAYLAR.length);
assert.deepEqual(codexArgumanlari(sirket, cx, { klasor: '/p', surdur: 'abc' }).slice(0, 2), ['resume', 'abc']);
assert.ok(codexArgumanlari({ ...sirket, izinModu: 'plan' }, cx, { klasor: '/p' }).join(' ').includes('-s read-only'));
// ikinci derleme eskiyi temizler
sirket.ajanlar = sirket.ajanlar.filter((a) => a.id !== 'mert');
derle(sirket, { hedef: path.join(tmp, 'calisma'), skiller: [], port: 1, anahtar: 'a' });
assert.equal(fs.existsSync(path.join(cikti.eklenti, 'agents', 'mert.md')), false);
assert.deepEqual(fs.readdirSync(path.join(cikti.eklenti, 'skills')), []);

// ---------- durum motoru ----------
const d = yeniDurum();
const s2 = normalle({ dil: 'tr', sef: { ad: 'Atlas' }, ajanlar: ['seo', 'frontend', 'backend', 'arastirmaci', 'qa'].map((id, i) => ({ id, ad: ['Mert', 'Elif', 'Kaan', 'Defne', 'Cem'][i], unvan: id })) });
sirketAyarla(d, s2);
let z = 1_700_000_000_000;
oturumAc(d, { oturumId: 'yerel-1', cwd: '/p/Fainera' }, z);
assert.equal(goruntu(d, z).ajanlar[0].ad, 'Atlas', 'şef oturum açılınca gelir');
for (const ev of SENARYO) olayIsle(d, ev, (z += 500));
const g = goruntu(d, z);
const A = Object.fromEntries(g.ajanlar.map((a) => [a.id, a]));
assert.deepEqual(g.ajanlar.map((a) => a.rol), ['sef', 'seo', 'frontend', 'backend', 'arastirmaci', 'qa'], 'tek şef: olay oturumu yerel oturuma bağlanır');
assert.equal(A['a:seo'].ad, 'Mert', 'ofiste kişinin adı görünür');
assert.equal(A['sef@yerel-1'].durum, 'bosta');
assert.equal(A['a:arastirmaci'].durum, 'arastiriyor');
assert.equal(A['a:backend'].ozet, 'muhasebe testlerini çalıştır');
assert.equal(A['a:frontend'].durum, 'onay');
assert.equal(A['a:qa'].durum, 'bosta');
assert.equal(A['a:seo'].mesaj.kimeId, 'a:frontend');
assert.equal(A['a:seo'].mesaj.kime, 'Elif');
const G = Object.fromEntries(g.gorevler.map((x) => [x.id, x]));
assert.equal(G['1'].durum, 'suruyor');
assert.equal(G['1'].sahip, 'Mert');
assert.equal(G['4'].durum, 'bitti');
assert.ok(g.akis.some((x) => x.metin === 'ekibe çağırıyor: Mert'));
assert.equal(g.oturumlar[0].olayGeldi, true);

// gerçek Claude Code olay biçimi: eklenti önekli tür, adı olmayan alt ajan
const d4 = yeniDurum();
sirketAyarla(d4, s2);
oturumAc(d4, { oturumId: 'y', cwd: '/p' }, z);
const o = { session_id: 'baska-kimlik', cwd: '/p' };
olayIsle(d4, { ...o, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { description: 'x', prompt: 'y', subagent_type: 'ofis:arastirmaci' } }, z);
olayIsle(d4, { ...o, hook_event_name: 'SubagentStart', agent_id: 'a8b1', agent_type: 'ofis:arastirmaci' }, z);
olayIsle(d4, { ...o, hook_event_name: 'PreToolUse', agent_id: 'a8b1', agent_type: 'ofis:arastirmaci', tool_name: 'Bash', tool_input: { command: 'echo 4', description: 'Print' } }, z);
assert.equal(d4.ajanlar.get('a:arastirmaci').ad, 'Defne');
assert.equal(d4.ajanlar.get('a:arastirmaci').durum, 'calisiyor');
olayIsle(d4, { ...o, hook_event_name: 'SubagentStop', agent_id: 'a8b1', agent_type: 'ofis:arastirmaci' }, z);
assert.equal(d4.ajanlar.get('a:arastirmaci').durum, 'bosta', 'şirket çalışanı işi bitince ofiste kalır');
// aynı çalışan yeniden çağrılınca aynı kişi olarak döner
olayIsle(d4, { ...o, hook_event_name: 'SubagentStart', agent_id: 'ffff', agent_type: 'ofis:arastirmaci' }, z);
assert.equal(d4.ajanlar.size, 2);
// tanımsız yardımcı gelir ve işi bitince gider
olayIsle(d4, { ...o, hook_event_name: 'PreToolUse', agent_id: 'x9', agent_type: 'Explore', tool_name: 'Glob', tool_input: { pattern: '*' } }, z);
assert.equal(d4.ajanlar.get('s:x9').rol, 'misafir');
olayIsle(d4, { ...o, hook_event_name: 'SubagentStop', agent_id: 'x9', agent_type: 'Explore' }, z);
assert.equal(d4.ajanlar.has('s:x9'), false);
// şirket değişince ofisteki ad güncellenir
s2.ajanlar.find((a) => a.id === 'arastirmaci').ad = 'Derin';
sirketAyarla(d4, s2);
assert.equal(d4.ajanlar.get('a:arastirmaci').ad, 'Derin');
// oturum kapanınca ofis boşalır
oturumKapat(d4, 'y', z);
assert.equal(d4.ajanlar.size, 0);

// takım dosyası
const d3 = yeniDurum();
sirketAyarla(d3, s2);
takimIsle(d3, [{ ad: 'session-1', uyeler: [{ ad: 'team-lead', agentId: 'l', tur: 'team-lead' }, { ad: 'qa', agentId: 'q', tur: 'ofis:qa' }] }], z);
assert.deepEqual([...d3.ajanlar.keys()], ['a:qa']);
olayIsle(d3, { session_id: 's', hook_event_name: 'PreToolUse', agent_id: 'q', tool_name: 'Bash', tool_input: { command: 'npm test' } }, z);
assert.equal(d3.ajanlar.get('a:qa').durum, 'calisiyor');
takimIsle(d3, [], z);
assert.equal(d3.ajanlar.has('a:qa'), false);

// çeviri
const en = cevirici(MOTOR, 'en');
assert.equal(aracOzet(en, 'Read', { file_path: '/a/b/c.ts' }), 'reading: c.ts');
assert.equal(aracOzet(cevirici(MOTOR, 'tr'), 'WebFetch', { url: 'https://docs.rs/axum' }), 'sayfa: docs.rs');
assert.equal(rolCoz(d, 'ofis:seo'), 'seo');
assert.equal(rolCoz(d, null, 'Elif'), 'frontend');
assert.equal(rolCoz(d, 'general-purpose'), 'misafir');
assert.deepEqual(jsonAyikla('```json\n{"ad":"x","k":["}"]}\n```'), { ad: 'x', k: ['}'] });

// ---------- projeler ----------
const pd = new SirketDeposu(path.join(tmp, 'sirket-proje'));
pd.yukle('tr');
const eski = normalle({ projeler: ['/a/fainera', '/b/blog'], sonProje: '/b/blog' });
assert.deepEqual(eski.projeler.map((p) => p.ad), ['fainera', 'blog'], 'eski sürümdeki klasör listesi projeye çevrilir');
assert.equal(eski.sonProje, eski.projeler[1].id);
const fain = pd.projeKaydet({
  klasor: '/a/fainera',
  ad: 'FainEra',
  alanAdlari: ['https://fainera.com/', 'fainera.com', 'fee.fainera.com'],
  hesaplar: [{ platform: 'instagram', ad: '@fainera', sifre: 'gizli' }, { platform: 'bilinmeyen', ad: 'panel', not: 'Yönetim' }, { platform: 'x', ad: '' }],
  test: { komut: 'npm test', adres: 'https://staging.fainera.com', sorumlu: 'cem', zorunlu: true },
  notlar: 'Canlıya ben çıkarım.',
});
pd.sablondanEkle('qa', fain.id);
assert.match(fain.id, /^[a-z0-9]{10}$/);
assert.deepEqual(fain.alanAdlari, ['fainera.com', 'fee.fainera.com']);
assert.deepEqual(fain.hesaplar.map((h) => [h.platform, h.ad]), [['instagram', '@fainera'], ['diger', 'panel']]);
assert.ok(!JSON.stringify(pd.veri).includes('gizli'), 'hesap kaydında şifre alanı tutulmaz');
assert.equal(pd.projeKlasorden('/a/fainera').id, fain.id, 'aynı klasör ikinci kez proje olmaz');
const blog = pd.projeKlasorden('/b/blog');
assert.equal(blog.ad, 'blog');
pd.guncelle({ sonProje: blog.id });
pd.projeKaydet({ id: fain.id, sonOturum: '11111111-2222-3333-4444-555555555555' });
assert.equal(pd.proje(fain.id).ad, 'FainEra', 'kısmi proje güncellemesi diğer alanları korur');
pd.projeSil(blog.id);
assert.equal(pd.veri.sonProje, null);
assert.equal(pd.veri.projeler.length, 1);
const pm = projeMetni(pd.veri, pd.proje(fain.id));
assert.match(pm, /## Üzerinde çalışılan proje: FainEra/);
assert.match(pm, /- Instagram: @fainera\n- Yönetim: panel/);
assert.match(pm, /Şifre ve giriş bilgisi burada yoktur/);
assert.match(pm, /Cem adlı ekip üyesine doğrulat/);
assert.ok(!projeMetni(pd.veri, pd.proje(fain.id), { tam: false }).includes('Canlıya ben çıkarım'), 'ekip üyesine kısa kart gider');
assert.equal(projeMetni(pd.veri, null), '');

// ---------- kayıt defteri ----------
const defter = new KayitDefteri(path.join(tmp, 'kayit'));
assert.throws(() => defter.dosya('../x'));
assert.deepEqual(defter.oku(fain.id), []);
const sk = katGorunumu(pd.veri, pd.proje(fain.id));
const yaz = (ev, oturum = 'o1') => {
  const k = olaydanKayit(ev, sk);
  return k ? defter.ekle(fain.id, { ...k, oturum }) : null;
};
assert.equal(yaz({ hook_event_name: 'UserPromptSubmit', prompt: '/login' }), null, 'komutlar deftere girmez');
assert.equal(yaz({ hook_event_name: 'UserPromptSubmit', prompt: '<task-notification> <task-id>x</task-id>' }), null, 'motorun kendi bildirimleri sahibin isteği sayılmaz');
assert.equal(yaz({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } }), null);
yaz({ hook_event_name: 'UserPromptSubmit', prompt: 'Ödeme formunu düzelt' });
// gerçek takım modu biçimi: tür önek olmadan gelir, kimlik "a<isim>-<hex>"
assert.equal(yaz({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { description: 'Form testi', subagent_type: 'ofis:cem', name: 'cem' } }).kim, 'Cem');
yaz({ hook_event_name: 'Stop', last_assistant_message: 'Cem çalışıyor, bekliyorum.' });
yaz({ hook_event_name: 'TaskCreated', task_id: '1', task_subject: 'Formu test et', teammate_name: 'cem' });
yaz({ hook_event_name: 'TaskCreated', task_id: '2', task_subject: 'Mobil görünüm' });
assert.equal(yaz({ hook_event_name: 'SubagentStop', agent_id: 'acem-0abc', agent_type: 'cem', last_assistant_message: '14 test geçti.' }).kim, 'Cem');
yaz({ hook_event_name: 'TaskCompleted', task_id: '1', task_subject: 'Formu test et' });
yaz({ hook_event_name: 'Stop', last_assistant_message: 'Form düzeldi, Cem doğruladı.' });
assert.equal(yaz({ hook_event_name: 'Stop', agent_id: 'acem-0abc', last_assistant_message: 'x' }), null, 'ekip üyesinin sözü şefin sonucu sayılmaz');
yaz({ hook_event_name: 'UserPromptSubmit', prompt: 'Şimdi mobil görünümü yap' });
const kayitlar = defter.oku(fain.id);
assert.deepEqual(kayitlar.map((k) => k.tur), ['istek', 'atama', 'sonuc', 'gorev', 'gorev', 'teslim', 'gorevBitti', 'sonuc', 'istek']);
const dc = durumCikar(kayitlar);
assert.equal(dc.istekler.length, 2);
assert.equal(dc.istekler[0].sonuc, 'Form düzeldi, Cem doğruladı.');
assert.equal(dc.istekler[0].onceki, 'Cem çalışıyor, bekliyorum.');
assert.equal(dc.istekler[1].sonuc, '', 'yarım kalan iş sonuçsuz görünür');
assert.deepEqual(dc.acikGorevler.map((g) => g.metin), ['Mobil görünüm']);
const devir = devirOzeti(kayitlar, 'tr');
assert.match(devir, /^## Kaldığın yer/);
assert.match(devir, /2\. İstek: Şimdi mobil görünümü yap\n   Sonuç: sonuç kaydı yok/);
assert.match(devir, /- Mobil görünüm/);
assert.match(devir, /- Cem: 14 test geçti\./);
assert.ok(devir.length < 3000, 'devir notu kısa kalır');
assert.match(devirOzeti(kayitlar, 'en'), /^## Where you left off/);
assert.equal(devirOzeti([], 'tr'), '');
// uzun metin kırpılır, bozuk satır okumayı durdurmaz
defter.ekle(fain.id, { tur: 'sonuc', metin: 'x'.repeat(9000) });
fs.appendFileSync(defter.dosya(fain.id), '{yarim\n');
assert.equal(defter.oku(fain.id).at(-1).metin.length, 2000);
// şef talimatına proje kartı ve devir notu eklenir
const sefTam = sefMetni(pd.veri, { proje: pd.proje(fain.id), devir });
assert.ok(sefTam.indexOf('## Üzerinde çalışılan proje') < sefTam.indexOf('## Kaldığın yer'));
assert.deepEqual(oturumArgumanlari(pd.veri, { eklenti: 'e', sefDosya: 'f', oturumId: 'u', surdur: 'eski' }).slice(4, 6), ['--resume', 'eski']);
defter.sil(fain.id);
assert.deepEqual(defter.oku(fain.id), []);

// gerçek takım modu olayları: ekip üyesi önek olmadan ve arka planda çalışır
const d5 = yeniDurum();
sirketAyarla(d5, s2);
oturumAc(d5, { oturumId: 'y5', cwd: '/p' }, z);
const o5 = { session_id: 'y5', cwd: '/p' };
olayIsle(d5, { ...o5, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { description: 'x', prompt: 'y', subagent_type: 'ofis:arastirmaci', name: 'arastirmaci' } }, z);
olayIsle(d5, { ...o5, hook_event_name: 'SubagentStart', agent_id: 'aarastirmaci-0abcd9', agent_type: 'arastirmaci' }, z);
olayIsle(d5, { ...o5, hook_event_name: 'Stop', last_assistant_message: 'bekliyorum' }, z);
olayIsle(d5, { ...o5, hook_event_name: 'PermissionRequest', agent_id: 'aarastirmaci-0abcd9', agent_type: 'arastirmaci', tool_name: 'Bash', tool_input: { command: 'wc -l a' } }, z);
assert.equal(d5.ajanlar.get('a:arastirmaci').durum, 'onay');
olayIsle(d5, { ...o5, hook_event_name: 'PreToolUse', agent_id: 'aarastirmaci-0abcd9', agent_type: 'arastirmaci', tool_name: 'SendMessage', tool_input: { to: 'team-lead', summary: 'bitti' } }, z);
assert.equal(d5.ajanlar.get('a:arastirmaci').ozet, 'mesaj: Atlas', 'takım lideri şefin adıyla görünür');
olayIsle(d5, { ...o5, hook_event_name: 'SubagentStop', agent_id: 'aarastirmaci-0abcd9', agent_type: 'arastirmaci' }, z);
olayIsle(d5, { ...o5, hook_event_name: 'TeammateIdle', agent_id: 'aarastirmaci-0abcd9', agent_type: 'arastirmaci', teammate_name: 'arastirmaci', team_name: 'session-1' }, z);
assert.equal(d5.ajanlar.get('a:arastirmaci').durum, 'bosta');
assert.equal(d5.ajanlar.size, 2);

// ---------- alt ajan sınırı: her üye en fazla bir yardımcı, takım dışı yardımcılar ekip sayısı kadar ----------
{
  const ds = yeniDurum();
  sirketAyarla(ds, normalle({ dil: 'tr', sef: { ad: 'Atlas' }, ajanlar: [{ id: 'cem', ad: 'Cem' }, { id: 'elif', ad: 'Elif' }] }));
  const c = new Map();
  const iste = (tip, ad) => altAjanKarari(ds, c, { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: tip, name: ad } }, { uyeSayisi: 2 });
  const basla = (id, tip) => altAjanIzle(ds, c, { hook_event_name: 'SubagentStart', agent_id: id, agent_type: tip });
  assert.equal(iste('ofis:cem'), null);
  basla('a1', 'ofis:cem');
  assert.equal(iste('ofis:cem', 'cem-2'), null, 'Cem bir yardımcı alabilir');
  basla('a2', 'ofis:cem');
  assert.match(iste('ofis:cem', 'cem-final').neden, /Cem zaten bir yardımcıyla/);
  altAjanIzle(ds, c, { hook_event_name: 'SubagentStop', agent_id: 'a2' });
  assert.equal(iste('ofis:cem'), null, 'yardımcı bitince yenisi açılabilir');
  basla('g1', 'general-purpose');
  basla('g2', 'general-purpose');
  assert.match(iste('general-purpose', 'z yedek').neden, /en fazla 2/);
  assert.equal(altAjanKarari(ds, c, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: {} }), null);
  assert.equal(altAjanKarari(ds, c, { hook_event_name: 'PreToolUse', agent_id: 'g1', tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose' } }), null, 'alt ajanın kendi çağrısı sayılmaz');
}

// ---------- telefondan onay komutları ----------
assert.deepEqual(onayKomutu('onay 4821'), { tur: 'kod', evet: true, kod: '4821' });
assert.deepEqual(onayKomutu('Ret 4821'), { tur: 'kod', evet: false, kod: '4821' });
assert.deepEqual(onayKomutu('approve 1234'), { tur: 'kod', evet: true, kod: '1234' });
assert.deepEqual(onayKomutu('Hepsini onayla'), { tur: 'hepsi', evet: true });
assert.deepEqual(onayKomutu('ikisini de onayla'), { tur: 'hepsi', evet: true });
assert.deepEqual(onayKomutu('approve all'), { tur: 'hepsi', evet: true });
assert.deepEqual(onayKomutu('hepsini reddet'), { tur: 'hepsi', evet: false });
assert.deepEqual(onayKomutu('Onaylıyorum.'), { tur: 'tek', evet: true });
assert.deepEqual(onayKomutu('Onay veriyorum'), { tur: 'tek', evet: true });
assert.equal(onayKomutu('onay veriyorum ama önce testleri çalıştırsın'), null, 'uzun cümle beyne gider');
assert.equal(onayKomutu('HarDress ne durumda?'), null);
assert.equal(onayKomutu('onay 12345'), null);

// yapıştırma etiketi atılır, iletilen haber sahibin mesajı sayılmaz
{
  const l = [];
  sohbetIsle(l, { hook_event_name: 'UserPromptSubmit', prompt: '<pasted_content id="47cc">\n[Ofis] Yeni skill eklendi:\n- x\n</pasted_content>' }, { sef: { ad: 'Atlas' }, ajanlar: [] });
  assert.equal(l[0].kim, 'iletim');
  assert.equal(l[0].ad, 'Ofis');
  assert.ok(!l[0].metin.includes('pasted_content'));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('tüm kontroller geçti');
