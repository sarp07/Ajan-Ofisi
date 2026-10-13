// Yerel alıcı. Yalnızca 127.0.0.1 üzerinde dinler, dışarıdan erişilemez.
// Claude Code ve Codex her olayda JSON gövdesini POST /olay/<anahtar>[/<etiket>] adresine gönderir.
// Etiket olayın hangi oturumdan geldiğini söyler (aynı anda birden fazla oturum açık olabilir).
// MCP istekleri POST /mcp/<anahtar>[/<kat>] adresine gelir (bkz. mcp.js).
import http from 'node:http';

const SINIR = 4_000_000;

function govdeOku(istek, bitti) {
  let govde = '';
  let boyut = 0;
  istek.setEncoding('utf8');
  istek.on('data', (p) => {
    boyut += p.length;
    if (boyut > SINIR) {
      istek.destroy();
      return;
    }
    govde += p;
  });
  istek.on('end', () => bitti(govde));
}

export function kancaSunucu({ port, anahtar, olay, mcp = null }) {
  const yol = '/olay/' + anahtar;
  const mcpYol = '/mcp/' + anahtar;
  const sunucu = http.createServer((istek, yanit) => {
    const url = String(istek.url || '');
    // /mcp/<anahtar>: beyin. /mcp/<anahtar>/<kat>: o katın şefi (yalnızca kendi katının araçları)
    if (mcp && (url === mcpYol || url.startsWith(mcpYol + '/'))) {
      const kapsam = url === mcpYol ? '' : decodeURIComponent(url.slice(mcpYol.length + 1)).slice(0, 40);
      // durumsuz sunucu: SSE akışı açılmaz
      if (istek.method !== 'POST') {
        yanit.writeHead(405, { allow: 'POST' }).end();
        return;
      }
      govdeOku(istek, async (govde) => {
        let veri;
        try {
          veri = JSON.parse(govde);
        } catch {
          yanit.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Bozuk JSON' } }));
          return;
        }
        try {
          const cevap = await mcp(veri, kapsam);
          if (!cevap) yanit.writeHead(202).end();
          else yanit.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(cevap));
        } catch (e) {
          yanit.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: String(e.message || e) } }));
        }
      });
      return;
    }
    const etiketli = url.startsWith(yol + '/');
    if (istek.method !== 'POST' || (url !== yol && !etiketli)) {
      yanit.writeHead(404).end();
      return;
    }
    govdeOku(istek, (govde) => {
      // boş 2xx: motor bunu "karar yok, devam et" olarak yorumlar. Olay bir karar döndürürse (ör. alt ajan sınırı) o gönderilir.
      let karar = null;
      try {
        let etiket = '';
        if (etiketli) etiket = decodeURIComponent(url.slice(yol.length + 1)).slice(0, 80);
        karar = olay(JSON.parse(govde), etiket) || null;
      } catch {
        /* bozuk gövde: yok say */
      }
      if (karar) yanit.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(karar));
      else yanit.writeHead(204).end();
    });
  });
  return new Promise((coz, reddet) => {
    sunucu.once('error', reddet);
    sunucu.listen(port, '127.0.0.1', () => coz(sunucu));
  });
}
