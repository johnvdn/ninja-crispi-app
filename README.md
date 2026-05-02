# Ninja CRISPi PRO AI Companion — Server

A tiny Node.js proxy server. Users open your URL — no API key, no setup.

## Deploy to Render (free, 2 minutes)

1. Push this folder to a GitHub repo
2. Go to render.com → New → Web Service → connect your repo
3. Set:
   - Build command: (leave empty)
   - Start command: `node server.js`
4. Add environment variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key from console.anthropic.com
5. Click Deploy → copy the URL → share with anyone

## Deploy to Railway (free, 2 minutes)

1. Go to railway.app → New Project → Deploy from GitHub
2. Add variable: `ANTHROPIC_API_KEY = sk-ant-...`
3. Done — Railway auto-detects Node and runs `npm start`

## Run locally

```bash
ANTHROPIC_API_KEY=sk-ant-... node server.js
# Open http://localhost:3000
```

## Files

- `server.js` — proxy server (holds API key, rate limits to 30 req/min/IP)
- `app.html`  — the full CRISPi PRO companion app
- `package.json` — Node metadata

## Cost estimate

At typical internal demo usage (~200 questions/day):
~$0.30–0.80/day with claude-sonnet-4
