// scripts/generate-sitemap.js
// Zero-dependency sitemap generator. Requires Node 18+ (for built-in fetch).
// Run with:
//   SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/generate-sitemap.js
// On Windows CMD:
//   set SUPABASE_SERVICE_ROLE_KEY=sb_secret_... && node scripts/generate-sitemap.js
// On Windows PowerShell:
//   $env:SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."; node scripts/generate-sitemap.js

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    const url        = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
        console.error('Missing SUPABASE_URL in .env');
        process.exit(1);
    }
    if (!serviceKey) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
        console.error('Pass it inline — do NOT save it to .env. Example:');
        console.error('  set SUPABASE_SERVICE_ROLE_KEY=sb_secret_... && node scripts/generate-sitemap.js');
        process.exit(1);
    }

    // Fetch published events via PostgREST
    const eventsEndpoint = `${url}/rest/v1/events?select=slug,updated_at&status=eq.published&order=updated_at.desc`;
    const resp = await fetch(eventsEndpoint, {
        headers: {
            'apikey':        serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
        },
    });
    if (!resp.ok) {
        console.error(`Supabase REST call failed: ${resp.status} ${resp.statusText}`);
        process.exit(1);
    }
    const events = await resp.json();

    const siteUrl = 'https://eventhub.example.com'; // TODO: replace at deploy
    const urls = [
        { loc: `${siteUrl}/`, changefreq: 'daily', priority: '1.0' },
        ...events.map(e => ({
            loc:        `${siteUrl}/event/${e.slug}`,
            lastmod:    e.updated_at ? e.updated_at.split('T')[0] : undefined,
            changefreq: 'weekly',
            priority:   '0.8',
        })),
    ];

    const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map(u =>
            `  <url>\n` +
            `    <loc>${u.loc}</loc>\n` +
            (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
            `    <changefreq>${u.changefreq}</changefreq>\n` +
            `    <priority>${u.priority}</priority>\n` +
            `  </url>`
        ).join('\n') +
        `\n</urlset>\n`;

    const outPath = path.join(__dirname, '..', 'sitemap.xml');
    fs.writeFileSync(outPath, xml);
    console.log(`Generated sitemap with ${urls.length} URLs at ${outPath}`);
}

main().catch(err => {
    console.error('Sitemap generation failed:', err.message);
    process.exit(1);
});
