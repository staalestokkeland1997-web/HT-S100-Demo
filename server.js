#!/usr/bin/env node
// Zero-dependency static file server for running the HT ECDIS demo locally.
// Usage: node server.js [port]   (default port 8000)
//
// Also exposes GET /proxy?url=<encoded-url> — a small CORS proxy restricted
// to the demo's data providers (MET Norway/yr, Kartverket tide, EMODnet,
// coastline data). It lets the browser reach feeds that are otherwise
// CORS-blocked (Kartverket tide) and adds the identifying User-Agent that
// api.met.no's terms of service require. The app auto-detects it at /proxy.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2], 10) || 8000;
const ROOT = __dirname;

// Only these hosts may be proxied — keep this a strict allowlist so the
// proxy can't be abused as an open relay.
const PROXY_HOSTS = new Set([
  'api.met.no',                      // yr / MET Norway weather + ocean
  'vannstand.kartverket.no',         // Kartverket tide API (CORS-blocked in browsers)
  'ows.emodnet-bathymetry.eu',       // EMODnet bathymetry WMS
  'd2ad6b4ur7yvpq.cloudfront.net',   // Natural Earth coastline mirror
  'raw.githubusercontent.com',       // Natural Earth coastline fallback
]);
const PROXY_UA = 'HT-ECDIS-Demo/1.0 (github.com/staalestokkeland1997-web/HT-S100-Demo)';

function handleProxy(req, res, query) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  if (query.get('ping') !== null && !query.get('url')) {
    res.writeHead(200, { ...cors, 'Content-Type': 'text/plain' }).end('ok');
    return;
  }
  let target;
  try { target = new URL(query.get('url') || ''); } catch (e) {
    res.writeHead(400, cors).end('Bad url');
    return;
  }
  if (target.protocol !== 'https:' || !PROXY_HOSTS.has(target.hostname)) {
    res.writeHead(403, cors).end('Host not allowed: ' + target.hostname);
    return;
  }
  fetch(target.href, { headers: { 'User-Agent': PROXY_UA }, redirect: 'follow' })
    .then(async (up) => {
      const buf = Buffer.from(await up.arrayBuffer());
      res.writeHead(up.status, {
        ...cors,
        'Content-Type': up.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(buf);
    })
    .catch((e) => {
      res.writeHead(502, { ...cors, 'Content-Type': 'text/plain' }).end('Upstream error: ' + e.message);
    });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let parsed;
  try {
    parsed = new URL(req.url, 'http://localhost');
  } catch (e) {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (parsed.pathname === '/proxy') {
    handleProxy(req, res, parsed.searchParams);
    return;
  }
  let urlPath;
  try {
    urlPath = decodeURIComponent(parsed.pathname);
  } catch (e) {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + urlPath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`HT ECDIS demo running at http://localhost:${PORT}/  (Ctrl+C to stop)`);
});
