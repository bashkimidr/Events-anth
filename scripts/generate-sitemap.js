const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env. Run with:');
        console.error('  SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/generate-sitemap.js');
        process.exit(1);
    }

    const supabase = createClient(url, key);
    const { data: events, error } = await supabase
        .from('events')
        .select('slug, updated_at')
        .eq('status', 'published')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Supabase error:', error.message);
        process.exit(1);
    }

    const site = 'https://eventhub.example.com'; // TODO: replace at deploy
    const urls = [
        { loc: `${site}/`, changefreq: 'daily', priority: '1.0' },
        ...(events || []).map(e => ({
            loc:        `${site}/event/${e.slug}`,
            lastmod:    e.updated_at,
            changefreq: 'weekly',
            priority:   '0.8',
        })),
    ];

    const urlXml = urls.map(u =>
        `  <url>\n    <loc>${u.loc}</loc>\n` +
        (u.lastmod ? `    <lastmod>${u.lastmod.split('T')[0]}</lastmod>\n` : '') +
        `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlXml}\n</urlset>\n`;

    const outPath = path.join(__dirname, '..', 'sitemap.xml');
    fs.writeFileSync(outPath, xml);
    console.log(`Generated sitemap with ${urls.length} URLs → ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
