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
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg':'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain'
};

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

                const ext = path.extname(filename) || '.jpg';
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const newFilename = Date.now() + '_' + Math.round(Math.random() * 1E9) + ext;
                
                // Save it relative to our project structure
                const savePath = path.join(__dirname, 'event-pictures', newFilename);
                fs.writeFileSync(savePath, buffer);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ url: 'event-pictures/' + newFilename }));
            } catch (err) {
                console.error("Upload error:", err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // 2. Serve Static Resources Normal Execution
    const urlObj  = new URL(req.url, 'http://localhost');
    const pathname = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
    let filePath  = path.join(__dirname, pathname);

    // Directory traversal guard
    if (!path.resolve(filePath).startsWith(path.resolve(__dirname))) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Forbidden');
    }

    const ext = path.extname(filePath);
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if(err.code === 'ENOENT'){
                res.writeHead(404);
                res.end(`File ${req.url} not found.`);
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
            res.end(content, 'utf-8');
        }
    });

}).listen(PORT, "127.0.0.1", () => {
    console.log(`Development Server running horizontally at http://localhost:${PORT}`);
    console.log(`Access event images natively!`);
});
