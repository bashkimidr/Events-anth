const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
    console.error('ERROR: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY missing from .env');
    process.exit(1);
}

if (key === 'PASTE_YOUR_PUBLISHABLE_KEY_HERE') {
    console.error('ERROR: Replace PASTE_YOUR_PUBLISHABLE_KEY_HERE in .env with your real publishable key.');
    process.exit(1);
}

const fs = require('fs');
const outPath = path.join(__dirname, '..', 'public-config.js');

const content = `window.__ENV = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key })};\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('public-config.js written.');
