const http = require('http');
const fs   = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const PORT = 3000;

const MIME_TYPES = {
    '.html':  'text/html',
    '.css':   'text/css',
    '.js':    'text/javascript',
    '.png':   'image/png',
    '.jpg':   'image/jpeg',
    '.jpeg':  'image/jpeg',
    '.gif':   'image/gif',
    '.svg':   'image/svg+xml',
    '.ico':   'image/x-icon',
    '.webp':  'image/webp',
    '.woff':  'font/woff',
    '.woff2': 'font/woff2',
    '.map':   'application/json',
    '.txt':   'text/plain',
    '.xml':   'application/xml',
};

// ── Allow-lists ───────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([
    '.html', '.css', '.js', '.png', '.jpg', '.jpeg',
    '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.map', '.txt', '.xml',
]);

// Files served from the root directory
const ALLOWED_ROOT_FILES = new Set([
    'index.html', 'admin.html', 'edit-event.html', 'inbox.html', 'login.html', 'event.html',
    'app.js', 'admin.js', 'edit-event.js', 'inbox.js', 'login.js', 'event.js',
    'db.js', 'geo.js', 'supabase-client.js', 'auth-guard.js', 'public-config.js', 'site-config.js',
    'style.css', 'legal.css', 'favicon.ico', 'robots.txt', 'sitemap.xml',
    'privacy.html', 'terms.html', 'cookies.html',
    'social-og-default.png',
]);

// Sub-folders whose contents may be served
const ALLOWED_FOLDERS = new Set(['event-pictures', 'icons']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(res, status, contentType, body) {
    res.writeHead(status, { 'Content-Type': contentType });
    res.end(body);
}

function reject(res, req, status, msg) {
    console.log(`[${req.method}] ${req.url} → ${status} ${msg}`);
    send(res, status, 'text/plain', msg);
}

http.createServer((req, res) => {

    // Serve Static Resources — locked-down allow-list handler

    // Step 1: traversal pre-check on the RAW URL before the URL API normalises
    // away `..` and `%2e%2e`.  Decode first so encoded dots are caught too.
    const rawPathOnly = req.url.split(/[?#]/)[0];
    let rawDecoded;
    try { rawDecoded = decodeURIComponent(rawPathOnly); } catch (_) { rawDecoded = rawPathOnly; }
    if (rawDecoded.split('/').some(s => s === '..')) {
        return reject(res, req, 403, 'Forbidden');
    }

    // Step 2: parse URL, discard query + hash (safe to normalise now — no .. present)
    let rawPath;
    try {
        rawPath = new URL(req.url, 'http://localhost').pathname;
    } catch (_) {
        return reject(res, req, 400, 'Bad Request');
    }

    // Step 3: decode percent-encoding so we can inspect the raw characters
    let decoded;
    try {
        decoded = decodeURIComponent(rawPath);
    } catch (_) {
        return reject(res, req, 400, 'Bad Request');
    }

    // Step 4: reject null bytes, backslashes, control characters anywhere in path
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f\\]/.test(decoded)) {
        return reject(res, req, 403, 'Forbidden');
    }

    // Step 5: strip leading slash, default to index.html
    let relative = decoded.replace(/^\/+/, '') || 'index.html';

    // Clean URL rewrites for legal pages
    if (relative === 'privacy' || relative === 'privacy/')   relative = 'privacy.html';
    else if (relative === 'terms' || relative === 'terms/')  relative = 'terms.html';
    else if (relative === 'cookies' || relative === 'cookies/') relative = 'cookies.html';

    // SPA rewrite: /event/<slug> → event.html (traversal already blocked above)
    if (/^event\/[a-z0-9][a-z0-9-]*\/?$/i.test(relative)) {
        relative = 'event.html';
    }

    // Step 6: secondary .. check on the post-normalisation path (defence in depth)
    const segments = relative.split('/');
    if (segments.some(s => s === '..')) {
        return reject(res, req, 403, 'Forbidden');
    }

    // Step 7: reject hidden files / paths (any segment starting with `.`)
    if (segments.some(s => s.startsWith('.'))) {
        return reject(res, req, 403, 'Forbidden');
    }

    // Step 8: resolve to absolute path and verify it stays inside __dirname
    // path.relative is platform-agnostic for the "did we escape?" question
    const resolvedPath = path.resolve(__dirname, relative);
    const rel          = path.relative(__dirname, resolvedPath);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
        return reject(res, req, 403, 'Forbidden');
    }

    // Step 9: extension must be in allow-list (404 so attackers can't probe what exists)
    const ext = path.extname(relative).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return reject(res, req, 404, 'Not Found');
    }

    // Step 10: path must be either an allowed root file or inside an allowed folder
    const topSegment = segments[0];
    const isRootFile  = segments.length === 1 && ALLOWED_ROOT_FILES.has(topSegment);
    const isInFolder  = segments.length >= 2   && ALLOWED_FOLDERS.has(topSegment);

    if (!isRootFile && !isInFolder) {
        return reject(res, req, 404, 'Not Found');
    }

    // Step 11: read and serve
    fs.readFile(resolvedPath, (err, content) => {
        const status = err ? (err.code === 'ENOENT' ? 404 : 500) : 200;
        console.log(`[${req.method}] ${req.url} → ${status} (${relative})`);

        if (err) {
            send(res, status, 'text/plain', err.code === 'ENOENT' ? 'Not Found' : `Server Error: ${err.code}`);
        } else {
            if (ext === '.html') {
                // CSP: 'unsafe-eval' needed for Supabase CDN bundle; esm.sh in connect-src because Supabase fetches its own sub-modules from there at runtime. 'unsafe-inline' tolerates legacy inline style attributes until a cleanup pass.
                res.setHeader('Content-Security-Policy',
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://unpkg.com; " +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                    "font-src 'self' https://fonts.gstatic.com; " +
                    "img-src 'self' data: https:; " +
                    "connect-src 'self' https://ipwho.is https://*.supabase.co wss://*.supabase.co https://esm.sh https://unpkg.com; " +
                    "frame-ancestors 'none';"
                );
            }
            send(res, 200, MIME_TYPES[ext] || 'application/octet-stream', content);
        }
    });

}).listen(PORT, '127.0.0.1', () => {
    console.log(`Development Server running at http://localhost:${PORT}`);
});
