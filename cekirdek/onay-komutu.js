// Sahibin telefondan yazdığı onay komutunu çözer. Yapay zekâ kullanılmaz, yalnızca kalıp eşleşir.
// Döner: { tur: 'kod', evet, kod } | { tur: 'hepsi', evet } | { tur: 'tek', evet } | null
const EVET = /^(onay|onayla|onaylıyorum|onay veriyorum|onaylıyorum hepsini|evet|ok|tamam|approve|yes)$/;
const HAYIR = /^(ret|reddet|hayır|hayir|reject|no)$/;

export function onayKomutu(metin) {
  const s = String(metin || '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[.!]+$/, '')
    .replace(/\s+/g, ' ');
  if (!s || s.length > 40) return null;
  const kelime = (w) => (EVET.test(w) ? true : HAYIR.test(w) ? false : null);
  let m = /^(\S+) (\d{4})$/.exec(s);
  if (m && kelime(m[1]) !== null) return { tur: 'kod', evet: kelime(m[1]), kod: m[2] };
  m = /^(hepsini|tümünü|tumunu|ikisini de|hepsi) (\S+)$/.exec(s) || /^(\S+) (all|hepsini|hepsi)$/.exec(s);
  if (m) {
    const e = kelime(m[2]) ?? kelime(m[1]);
    if (e !== null) return { tur: 'hepsi', evet: e };
  }
  if (kelime(s) !== null) return { tur: 'tek', evet: kelime(s) };
  return null;
}
