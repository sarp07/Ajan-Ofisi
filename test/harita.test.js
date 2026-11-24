// Kod haritası sınamaları: grafik dizini, arama, ajan araçları, git dışlama.
// GRAPHIFY_YOLU verilirse gerçek graphify ile küçük bir depo da haritalanır.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { grafikDizini, puanla, haritaAraclari, KodHaritasi, gitDisla, uvOrtami, graphifyOrtami, graphifyYolu, GRAPHIFY_PAKET, HARITA_ARAC_ADLARI } from '../cekirdek/harita.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ofis-harita-'));

// ---------- dizin ve puan ----------
const grafik = {
  directed: false,
  nodes: [
    { id: 'pencere_trade', label: 'TradeWindow', source_file: 'src/ui/trade.js', source_location: 'L12', community: 1, community_name: 'trade' },
    { id: 'pencere_trade_ac', label: 'ac()', source_file: 'src/ui/trade.js', source_location: 'L30', community: 1, community_name: 'trade' },
    { id: 'sunucu_trade', label: 'tradeIstegi()', source_file: 'server/trade.cpp', source_location: 'L5', community: 2, community_name: 'sunucu' },
    { id: 'pelerin', label: 'CapeWindow', source_file: 'src/ui/pelerin.js', source_location: 'L1', community: 3, community_name: 'pelerin' },
  ],
  links: [
    { source: 'pencere_trade', target: 'pencere_trade_ac', relation: 'contains', source_file: 'src/ui/trade.js', source_location: 'L30' },
    { source: 'pencere_trade_ac', target: 'sunucu_trade', relation: 'calls', source_file: 'src/ui/trade.js', source_location: 'L33' },
    { source: 'yok', target: 'pelerin', relation: 'calls' },
  ],
};
const dz = grafikDizini(grafik);
assert.equal(dz.dugumler.length, 4);
assert.equal(dz.komsu.get('pencere_trade_ac').length, 2, 'yönsüz grafikte iki uçtan da komşu');
assert.equal(dz.komsu.get('pelerin'), undefined, 'olmayan düğüme bağ atlanır');
assert.equal(puanla(grafik.nodes[0], 'TradeWindow'), 100);
assert.equal(puanla(grafik.nodes[0], 'trade'), 60);
assert.equal(puanla(grafik.nodes[3], 'pelerin.js'), 35);
assert.equal(puanla(grafik.nodes[3], 'ui pelerin'), 25);
assert.equal(puanla(grafik.nodes[2], 'xyz'), 0);
assert.equal(puanla(grafik.nodes[1], 'ac'), 100, 'sondaki () yok sayılır');

// ---------- araçlar (sahte harita) ----------
const kok = path.join(tmp, 'oyun');
fs.mkdirSync(path.join(kok, 'graphify-out'), { recursive: true });
fs.writeFileSync(path.join(kok, 'graphify-out', 'graph.json'), JSON.stringify(grafik));
fs.writeFileSync(path.join(kok, 'graphify-out', 'GRAPH_REPORT.md'), '# Rapor\n\nAna bölümler: trade, sunucu');
const harita = new KodHaritasi({ yol: () => null, env: () => process.env });
const araclar = haritaAraclari({ depolar: () => [{ ad: 'oyun', klasor: kok }], harita });
assert.deepEqual(Object.keys(araclar), HARITA_ARAC_ADLARI);

const ara = await araclar.harita_ara.calistir({ sorgu: 'trade' });
assert.equal(ara.sonuclar[0].ad, 'TradeWindow');
assert.equal(ara.sonuclar[0].dosya, 'src/ui/trade.js');
assert.equal(ara.sonuclar[0].satir, 12);
assert.equal(ara.sonuclar[0].depo, undefined, 'tek depoda depo adı yazılmaz');
assert.match(await araclar.harita_ara.calistir({ sorgu: 'qqq' }), /bulunamadı/);

const komsu = await araclar.harita_komsular.calistir({ dugum: 'ac' });
assert.equal(komsu.ad, 'ac()');
assert.deepEqual(komsu.baglar.map((b) => b.ad).sort(), ['TradeWindow', 'tradeIstegi()']);

const yol = await araclar.harita_yol.calistir({ baslangic: 'TradeWindow', hedef: 'tradeIstegi' });
assert.equal(yol.adim, 2);
assert.deepEqual(yol.zincir.map((z) => z.ad), ['TradeWindow', 'ac()', 'tradeIstegi()']);
assert.match(await araclar.harita_yol.calistir({ baslangic: 'TradeWindow', hedef: 'CapeWindow' }), /bulunamadı/);

assert.match(await araclar.harita_ozet.calistir({}), /Ana bölümler/);

// grafik dosyası değişince önbellek tazelenir
const yeni = { ...grafik, nodes: [...grafik.nodes, { id: 'envanter', label: 'Inventory', source_file: 'src/ui/env.js', source_location: 'L3' }] };
fs.writeFileSync(path.join(kok, 'graphify-out', 'graph.json'), JSON.stringify(yeni));
const ileri = new Date(Date.now() + 5000);
fs.utimesSync(path.join(kok, 'graphify-out', 'graph.json'), ileri, ileri);
assert.equal((await araclar.harita_ara.calistir({ sorgu: 'Inventory' })).sonuclar[0].satir, 3);

// çok depolu kat: depo adı yazılır, depo süzgeci çalışır, olmayan depo hata verir
const ikinci = path.join(tmp, 'api');
fs.mkdirSync(path.join(ikinci, 'graphify-out'), { recursive: true });
fs.writeFileSync(path.join(ikinci, 'graphify-out', 'graph.json'), JSON.stringify({ nodes: [{ id: 'a', label: 'TradeController', source_file: 'trade.ts', source_location: 'L2' }], links: [] }));
const coklu = haritaAraclari({ depolar: () => [{ ad: 'oyun', klasor: kok }, { ad: 'api', klasor: ikinci }], harita });
const cs = await coklu.harita_ara.calistir({ sorgu: 'Trade' });
assert.ok(cs.sonuclar.some((s) => s.depo === 'api') && cs.sonuclar.some((s) => s.depo === 'oyun'));
assert.ok((await coklu.harita_ara.calistir({ sorgu: 'Trade', depo: 'api' })).sonuclar.every((s) => s.depo === 'api'));
await assert.rejects(coklu.harita_ara.calistir({ sorgu: 'x', depo: 'mobil' }), /adlı depo yok/);
assert.equal(await coklu.harita_yol.calistir({ baslangic: 'TradeController', hedef: 'TradeWindow' }), 'İki düğüm farklı depolarda; depolar arası yol yok.');

// harita yoksa anlaşılır hata
const bos = haritaAraclari({ depolar: () => [{ ad: 'bos', klasor: path.join(tmp, 'bos') }], harita });
await assert.rejects(bos.harita_ara.calistir({ sorgu: 'x' }), /henüz yok/);
// graphify kurulu değilse güncelleme hatası açıklanır
assert.match(await bos.harita_guncelle.calistir({}), /graphify henüz kurulmadı/);

// ---------- git dışlama ----------
const depo = path.join(tmp, 'depo');
fs.mkdirSync(path.join(depo, '.git', 'info'), { recursive: true });
fs.writeFileSync(path.join(depo, '.git', 'info', 'exclude'), '# var olan\n*.log');
assert.equal(gitDisla(depo), true);
assert.equal(gitDisla(depo), true);
const exc = fs.readFileSync(path.join(depo, '.git', 'info', 'exclude'), 'utf8');
assert.equal(exc.split('\n').filter((s) => s === 'graphify-out/').length, 1, 'bir kez yazılır');
assert.ok(exc.startsWith('# var olan\n*.log\n'), 'var olan satırlar korunur');
// worktree: .git dosyası asıl klasörü gösterir, ortak klasöre yazılır
const ana = path.join(tmp, 'ana-git');
fs.mkdirSync(path.join(ana, 'worktrees', 'w1'), { recursive: true });
fs.writeFileSync(path.join(ana, 'worktrees', 'w1', 'commondir'), '../..');
const wt = path.join(tmp, 'wt');
fs.mkdirSync(wt);
fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${path.join(ana, 'worktrees', 'w1')}\n`);
assert.equal(gitDisla(wt), true);
assert.match(fs.readFileSync(path.join(ana, 'info', 'exclude'), 'utf8'), /^graphify-out\/$/m);
assert.equal(gitDisla(path.join(tmp, 'git-yok')), false);

// ---------- ortamlar ----------
const uo = uvOrtami({ PATH: '/bin' }, '/x/araclar');
assert.equal(uo.UV_TOOL_BIN_DIR, path.join('/x/araclar', 'graphify', 'bin'));
assert.equal(uo.UV_PYTHON_PREFERENCE, 'only-managed');
assert.equal(uo.PATH, '/bin');
assert.equal(graphifyOrtami({}).GRAPHIFY_BACKEND, 'none', 'yapay zeka çağrısı kapalı');

// kullanıcının kendi graphify'ı kullanılmaz; yalnızca sürümü yazılmış kendi kurulumumuz
const ar = path.join(tmp, 'araclar');
const gbin = path.join(ar, 'graphify', 'bin', process.platform === 'win32' ? 'graphify.exe' : 'graphify');
fs.mkdirSync(path.dirname(gbin), { recursive: true });
fs.writeFileSync(gbin, '');
assert.equal(graphifyYolu({ PATH: path.dirname(gbin) }, ar), null, 'sürüm dosyası yoksa yarım kurulum sayılır');
fs.writeFileSync(path.join(ar, 'graphify', 'surum.txt'), 'graphifyy==0.0.1\n');
assert.equal(graphifyYolu({}, ar), null, 'eski sürüm yeniden kurulur');
fs.writeFileSync(path.join(ar, 'graphify', 'surum.txt'), GRAPHIFY_PAKET + '\n');
assert.equal(graphifyYolu({}, ar), gbin);

// ---------- gerçek graphify (isteğe bağlı) ----------
if (process.env.GRAPHIFY_YOLU) {
  const kaynak = path.join(tmp, 'gercek');
  fs.mkdirSync(path.join(kaynak, '.git', 'info'), { recursive: true });
  fs.writeFileSync(path.join(kaynak, 'a.js'), 'export function selam() { return yardimci(); }\nfunction yardimci() { return 1; }\n');
  const gercek = new KodHaritasi({ yol: () => process.env.GRAPHIFY_YOLU, env: () => process.env });
  const s = await gercek.simdiGuncelle(kaynak);
  assert.equal(s.sonHata, '', s.sonHata);
  assert.ok(s.hazir);
  const g = haritaAraclari({ depolar: () => [{ ad: 'gercek', klasor: kaynak }], harita: gercek });
  const r = await g.harita_ara.calistir({ sorgu: 'selam' });
  assert.equal(r.sonuclar[0].dosya, 'a.js');
  const k = await g.harita_komsular.calistir({ dugum: 'selam' });
  assert.ok(k.baglar.some((b) => /yardimci/.test(b.ad)), JSON.stringify(k.baglar));
  assert.match(fs.readFileSync(path.join(kaynak, '.git', 'info', 'exclude'), 'utf8'), /graphify-out\//);
  console.log('gerçek graphify: tamam');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('harita sınamaları geçti');
