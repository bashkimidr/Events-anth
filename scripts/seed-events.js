// Run with: SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/seed-events.js
// DO NOT save the service role key to .env — pass it at the command line only.

const path = require('path');
// Load .env for SUPABASE_URL only — SERVICE_ROLE_KEY must come from the shell environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
    console.error('ERROR: SUPABASE_URL is missing. Check your .env file.');
    process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set.');
    console.error('Pass it at runtime — do NOT add it to .env:');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/seed-events.js');
    process.exit(1);
}

if (SERVICE_ROLE_KEY.startsWith('sb_publishable_')) {
    console.error('ERROR: You passed the publishable key instead of the service role (secret) key.');
    console.error('The service role key starts with sb_secret_ and is found under Project Settings → API → Secret keys.');
    process.exit(1);
}

// Use node-fetch-compatible approach — Supabase REST API directly via fetch (available in Node 18+)
const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function query(table, method = 'GET', body = null, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${params}`;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${table}: ${res.status} ${text}`);
    return text ? JSON.parse(text) : [];
}

async function main() {
    console.log('Fetching existing cities and categories...');

    const cities = await query('cities', 'GET', null, '?select=id,slug&order=name.asc');
    const categories = await query('categories', 'GET', null, '?select=id,slug&order=name.asc');

    if (!cities.length || !categories.length) {
        console.error('No cities or categories found. Make sure the schema migration has run and rows are present.');
        process.exit(1);
    }

    console.log('Cities found:', cities.map(c => c.slug).join(', '));
    console.log('Categories found:', categories.map(c => c.slug).join(', '));

    // Pick by slug — fall back to first row if slug not found
    const cityFor = (slug) => (cities.find(c => c.slug === slug) || cities[0]).id;
    const catFor  = (slug) => (categories.find(c => c.slug === slug) || categories[0]).id;

    // Dates a few weeks out from script-run date
    const weekOut  = offsetDate(14);
    const twoWeeks = offsetDate(21);
    const threeW   = offsetDate(28);

    const events = [
        {
            slug:        'summer-music-fest-2026',
            title:       'Summer Music Fest 2026',
            description: 'An outdoor celebration of live music spanning three stages with local and national artists.',
            event_date:  weekOut,
            event_time:  '18:00',
            location:    'Riverside Amphitheater',
            city_id:     cityFor('new-york'),
            category_id: catFor('music'),
            price:       '25.00',
            status:      'published',
            base_going:  42
        },
        {
            slug:        'yoga-in-the-park-2026',
            title:       'Yoga in the Park 2026',
            description: 'A free sunrise yoga session for all levels. Bring your mat and enjoy the fresh air.',
            event_date:  twoWeeks,
            event_time:  '07:30',
            location:    'Central Park East Lawn',
            city_id:     cityFor('new-york'),
            category_id: catFor('health'),
            price:       '0.00',
            status:      'published',
            base_going:  18
        },
        {
            slug:        'react-workshop-2026',
            title:       'React Workshop 2026',
            description: 'A hands-on full-day workshop covering React 19, hooks, and modern state management.',
            event_date:  threeW,
            event_time:  '09:00',
            location:    'TechHub Conference Center',
            city_id:     cityFor('san-francisco'),
            category_id: catFor('technology'),
            price:       '49.00',
            status:      'published',
            base_going:  31
        }
    ];

    // Check for existing slugs to avoid duplicate key errors
    const existing = await query('events', 'GET', null,
        `?slug=in.(${events.map(e => `"${e.slug}"`).join(',')})&select=slug`);
    const existingSlugs = new Set(existing.map(e => e.slug));

    const toInsert = events.filter(e => {
        if (existingSlugs.has(e.slug)) {
            console.log(`SKIP: "${e.slug}" already exists.`);
            return false;
        }
        return true;
    });

    if (!toInsert.length) {
        console.log('All seed events already exist — nothing to insert.');
        return;
    }

    const inserted = await query('events', 'POST', toInsert);
    console.log(`Inserted ${inserted.length} event(s):`);
    inserted.forEach(e => console.log(`  ✓ [${e.id}] ${e.title} (${e.event_date})`));
}

function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

main().catch(err => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});
