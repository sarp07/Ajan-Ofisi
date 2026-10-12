// Yerel MCP sunucusu (streamable HTTP, durumsuz, yalnızca JSON yanıt). Beyin katları bu araçlarla yönetir.
// Yalnızca 127.0.0.1 üzerinde, gizli anahtarlı adreste dinlenir (bkz. kanca-sunucu.js).
// araclar: { ad: { aciklama, sema, calistir(girdi) -> Promise<string|object> } }

const SURUMLER = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const hata = (id, kod, mesaj) => ({ jsonrpc: '2.0', id: id ?? null, error: { code: kod, message: mesaj } });
const sonuc = (id, result) => ({ jsonrpc: '2.0', id, result });

async function tekIsle(istek, araclar, bilgi) {
  if (!istek || typeof istek !== 'object' || istek.jsonrpc !== '2.0' || typeof istek.method !== 'string') return hata(istek && istek.id, -32600, 'Geçersiz istek');
  const { id, method, params = {} } = istek;
  // bildirimlerin (id yok) yanıtı olmaz
  if (id === undefined || id === null) return null;
  switch (method) {
    case 'initialize': {
      const istenen = params && typeof params.protocolVersion === 'string' ? params.protocolVersion : SURUMLER[0];
      return sonuc(id, {
        protocolVersion: SURUMLER.includes(istenen) ? istenen : SURUMLER[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'ajan-ofisi', version: bilgi.surum || '0' },
        instructions: bilgi.aciklama || '',
      });
    }
    case 'ping':
      return sonuc(id, {});
    case 'tools/list':
      return sonuc(id, { tools: Object.entries(araclar).map(([name, a]) => ({ name, description: a.aciklama, inputSchema: a.sema })) });
    case 'tools/call': {
      const a = araclar[params && params.name];
      if (!a) return hata(id, -32602, 'Bilinmeyen araç: ' + (params && params.name));
      try {
        const cikti = await a.calistir(params.arguments && typeof params.arguments === 'object' ? params.arguments : {});
        // araç hazır MCP içeriği döndürebilir (ör. ekran görüntüsü)
        if (cikti && Array.isArray(cikti.icerik)) return sonuc(id, { content: cikti.icerik, isError: false });
        const metin = typeof cikti === 'string' ? cikti : JSON.stringify(cikti, null, 2);
        return sonuc(id, { content: [{ type: 'text', text: metin }], isError: false });
      } catch (e) {
        // araç hatası modelin göreceği şekilde döner, protokol hatası değildir
        return sonuc(id, { content: [{ type: 'text', text: String((e && e.message) || e) }], isError: true });
      }
    }
    default:
      return hata(id, -32601, 'Bilinmeyen yöntem: ' + method);
  }
}

// govde: ayrıştırılmış JSON (tek istek ya da dizi). Döner: yanıt (nesne ya da dizi) ya da null (yalnızca bildirim).
export async function mcpIsle(govde, araclar, bilgi = {}) {
  if (Array.isArray(govde)) {
    const yanitlar = (await Promise.all(govde.map((g) => tekIsle(g, araclar, bilgi)))).filter(Boolean);
    return yanitlar.length ? yanitlar : null;
  }
  return tekIsle(govde, araclar, bilgi);
}
