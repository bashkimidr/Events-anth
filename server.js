const http = require('http');
const fs   = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

// If the token is absent at startup, generate a one-time in-memory value so the
// guard still works — but log a warning so the operator knows to set it properly.
const UPLOAD_TOKEN = process.env.ADMIN_UPLOAD_PLACEHOLDER_TOKEN || (() => {
    const t = require('crypto').randomBytes(24).toString('hex');
    console.warn('[server] ADMIN_UPLOAD_PLACEHOLDER_TOKEN not set in .env — generated ephemeral token for this process.');
    return t;
})();

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
};

// ── Allow-lists ───────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set([
    '.html', '.css', '.js', '.png', '.jpg', '.jpeg',
    '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.map', '.txt',
]);

// Files served from the root directory
const ALLOWED_ROOT_FILES = new Set([
    'index.html', 'admin.html', 'edit-event.html', 'inbox.html', 'login.html',
    'app.js', 'admin.js', 'edit-event.js', 'inbox.js', 'login.js',
    'db.js', 'geo.js', 'supabase-client.js', 'auth-guard.js', 'public-config.js',
    'style.css', 'favicon.ico', 'robots.txt',
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

    // 1. Handle our Custom File Upload Endpoint
    // TODO: delete this endpoint once all admin image uploads go through Supabase Storage.
    if (req.method === 'POST' && req.url === '/upload') {
        if (req.headers['x-admin-check'] !== UPLOAD_TOKEN) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Forbidden' }));
        }
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const { image, filename } = JSON.parse(body);
                // The image arrives as a data URL: "data:image/jpeg;base64,...(data)..."
                const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

                if (!matches || matches.length !== 3) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid or missing image syntax' }));
                }

                const ext        = path.extname(filename) || '.jpg';
                const base64Data = matches[2];
                const buffer     = Buffer.from(base64Data, 'base64');
                const newFilename = Date.now() + '_' + Math.round(Math.random() * 1E9) + ext;

                // Save it relative to our project structure
                const savePath = path.join(__dirname, 'event-pictures', newFilename);
                fs.writeFileSync(savePath, buffer);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ url: 'event-pictures/' + newFilename }));
            } catch (err) {
                console.error('Upload error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // 2. Serve Static Resources — locked-down allow-list handler

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
            send(res, 200, MIME_TYPES[ext] || 'application/octet-stream', content);
        }
    });

}).listen(PORT, '127.0.0.1', () => {
    console.log(`Development Server running at http://localhost:${PORT}`);
});
