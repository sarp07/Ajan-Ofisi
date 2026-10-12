// Sürüm notu: GitHub'dan gelen HTML notu sade metne çevirir. Saf mantık, Electron'a bağlı değildir.
// GitHub sürüm notu HTML gelir: sade metne çevrilir (başlık ve maddeler korunur)
export function notMetni(notlar) {
  const ham = Array.isArray(notlar) ? notlar.map((n) => (n && n.note) || '').join('\n\n') : String(notlar || '');
  return ham
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<\s*h[1-6][^>]*>/gi, '\n## ')
    .replace(/<\/\s*(p|li|h[1-6]|ul|ol|div)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 6000);
}
