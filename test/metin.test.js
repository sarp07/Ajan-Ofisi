// Arayüz ve motor metinlerinin iki dilde de eksiksiz olduğunu ve kullanılan her anahtarın tanımlı olduğunu denetler.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARAYUZ } from '../arayuz/metin.js';
import { MOTOR } from '../cekirdek/dil.js';

const kok = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const [ad, s] of [['arayüz', ARAYUZ], ['motor', MOTOR]]) {
  const tr = Object.keys(s.tr).sort();
  const en = Object.keys(s.en).sort();
  assert.deepEqual(tr.filter((k) => !en.includes(k)), [], ad + ': İngilizcede eksik');
  assert.deepEqual(en.filter((k) => !tr.includes(k)), [], ad + ': Türkçede eksik');
  for (const dil of ['tr', 'en']) for (const [k, v] of Object.entries(s[dil])) assert.ok(typeof v === 'string' && v.length, `${ad} ${dil} ${k} boş`);
  // kullanıcıya görünen metinde tire ya da uzun çizgi cümle ayırıcı olarak kullanılmaz
  for (const dil of ['tr', 'en']) for (const [k, v] of Object.entries(s[dil])) assert.ok(!/[—–]| - /.test(v), `${ad} ${dil} ${k} çizgi içeriyor`);
}

const dosyalar = [];
const gez = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) gez(path.join(d, e.name));
    else if (e.name.endsWith('.js') && e.name !== 'metin.js') dosyalar.push(path.join(d, e.name));
  }
};
gez(path.join(kok, 'arayuz'));
const tanimli = new Set(Object.keys(ARAYUZ.tr));
const kullanilan = new Set();
const onekler = new Set();
for (const f of dosyalar) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/\b(?:t|tt|t_)\(\s*'([a-zA-Z0-9_.]+)'\s*([,)+])/g)) (m[2] === '+' ? onekler : kullanilan).add(m[1]);
  // koşullu anahtarlar: t(x ? 'a' : 'b')
  for (const m of s.matchAll(/\b(?:t|tt)\([^()?]*\?\s*'([a-zA-Z0-9_.]+)'\s*:\s*'([a-zA-Z0-9_.]+)'/g)) {
    kullanilan.add(m[1]);
    kullanilan.add(m[2]);
  }
}
const eksik = [...kullanilan].filter((k) => !tanimli.has(k));
assert.deepEqual(eksik, [], 'tanımsız anahtar');
for (const o of onekler) assert.ok([...tanimli].some((k) => k.startsWith(o)), 'önek için anahtar yok: ' + o);
console.log('metin: tamam (' + tanimli.size + ' arayüz anahtarı, ' + kullanilan.size + ' doğrudan kullanım)');
