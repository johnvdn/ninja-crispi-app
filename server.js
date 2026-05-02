const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ── Rate limiting (simple in-memory, per IP) ──────────
const rateLimitMap = new Map();
const RATE_LIMIT = 30;       // max requests
const RATE_WINDOW = 60000;   // per 60 seconds

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return true;
}

// ── Request handler ───────────────────────────────────
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // ── Serve the app HTML ───────────────────────────────
  if (req.method === 'GET' && (parsedUrl.pathname === '/' || parsedUrl.pathname === '/index.html')) {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch(e) {
      res.writeHead(500); res.end('App file not found');
    }
    return;
  }

  // ── Proxy to Anthropic API ───────────────────────────
  if (req.method === 'POST' && parsedUrl.pathname === '/api/chat') {
    if (!API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable not set on server' }));
      return;
    }

    if (!checkRateLimit(ip)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many requests — please wait a moment' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 100000) req.destroy(); });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch(e) {
        console.error('JSON parse error:', e.message, 'Body length:', body.length);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      // Build payload — model set server-side only
      const payload = JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: parsed.system || '',
        messages: (parsed.messages || []).map(m => ({
          role: m.role,
          content: String(m.content)
        }))
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          if (proxyRes.statusCode !== 200) {
            console.error('Anthropic error:', proxyRes.statusCode, data.substring(0, 300));
          }
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });

      proxyReq.on('error', (e) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upstream error: ' + e.message }));
      });

      proxyReq.write(payload);
      proxyReq.end();
    });
    return;
  }

  // ── 404 ─────────────────────────────────────────────
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`✅ Ninja CRISPi PRO server running on port ${PORT}`);
  console.log(`   API key: ${API_KEY ? '✅ set (' + API_KEY.substring(0,12) + '…)' : '❌ NOT SET — set ANTHROPIC_API_KEY env var'}`);
});
