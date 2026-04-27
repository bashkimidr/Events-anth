import { fetchEventBySlug, fetchPublishedEventsByCity } from './db.js';
import { supabase } from './supabase-client.js';

const SITE_CONFIG = window.SITE_CONFIG || {};

const capitalizeWords = str => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : str;

const iconFallbacks = {
    'Sports':        'dribbble',
    'Education':     'book-open',
    'Music':         'music',
    'Entertainment': 'smile',
};

function formatDate(dateString) {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
}

function getRSVPs()         { return JSON.parse(localStorage.getItem('userRSVPs') || '{}'); }
function updateRSVPs(rsvps) { localStorage.setItem('userRSVPs', JSON.stringify(rsvps)); }

function showError() {
    document.getElementById('event-loading').style.display = 'none';
    document.getElementById('event-error').style.display   = 'block';
}

function setMeta(selector, attr, value) {
    const el = document.querySelector(selector);
    if (el && value) el.setAttribute(attr, value);
}

function updateSEO(event, slug) {
    const cityName  = capitalizeWords(event.cities?.name || '');
    const dateStr   = event.event_date ? formatDate(event.event_date) : '';
    const descBase  = event.description ? event.description.slice(0, 80).replace(/\s+\S*$/, '') + '…' : '';
    const metaDesc  = `${event.title} on ${dateStr} at ${event.location}${cityName ? ', ' + cityName : ''}. ${descBase}`.trim();
    const pageTitle = `${event.title} · ${SITE_CONFIG.name || 'Eventeria'}`;
    const canonical = `${SITE_CONFIG.url || ''}/event/${slug}`;
    const ogImage   = event.image_url || (SITE_CONFIG.url + (SITE_CONFIG.defaultOgImage || '/social-og-default.png'));

    document.title = pageTitle;
    setMeta('meta[name="description"]',          'content', metaDesc);
    setMeta('link[rel="canonical"]',             'href',    canonical);

    setMeta('meta[property="og:title"]',         'content', pageTitle);
    setMeta('meta[property="og:description"]',   'content', metaDesc);
    setMeta('meta[property="og:url"]',           'content', canonical);
    setMeta('meta[property="og:image"]',         'content', ogImage);

    setMeta('meta[name="twitter:title"]',        'content', pageTitle);
    setMeta('meta[name="twitter:description"]',  'content', metaDesc.slice(0, 200));
    setMeta('meta[name="twitter:image"]',        'content', ogImage);

    // JSON-LD Event schema
    const schema = {
        '@context': 'https://schema.org',
        '@type':    'Event',
        'name':     event.title,
        'startDate': `${event.event_date}T${event.event_time || '00:00:00'}`,
        'endDate':   `${event.event_date}T${event.event_time || '00:00:00'}`,
        'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
        'eventStatus':         'https://schema.org/EventScheduled',
        'location': {
            '@type': 'Place',
            'name':  event.location || cityName,
            'address': {
                '@type':           'PostalAddress',
                'addressLocality': event.cities?.name || '',
                'addressCountry':  'US',
            },
        },
        'description': event.description || `${event.title} in ${event.cities?.name || ''}`,
        'image': event.image_url ? [event.image_url] : [(SITE_CONFIG.url || '') + (SITE_CONFIG.defaultOgImage || '/social-og-default.png')],
        'offers': {
            '@type':          'Offer',
            'price':          event.price || '0',
            'priceCurrency':  'USD',
            'availability':   'https://schema.org/InStock',
            'url':            canonical,
        },
        'organizer': {
            '@type': 'Organization',
            'name':  SITE_CONFIG.name || 'Eventeria',
            'url':   SITE_CONFIG.url  || '',
        },
    };

    // eventSchedule for structured recurrence types (skip custom note — no clean mapping)
    if (event.recurrence_type && !event.recurrence_note) {
        const byDayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const scheduleFreq = event.recurrence_type === 'daily'   ? 'P1D'
                           : event.recurrence_type === 'weekly'  ? 'P1W'
                           : event.recurrence_type === 'monthly' ? 'P1M'
                           : null;
        if (scheduleFreq) {
            const schedule = {
                '@type':           'Schedule',
                'repeatFrequency': scheduleFreq,
                'startDate':       event.event_date,
            };
            if (event.recurrence_end_date) schedule.endDate = event.recurrence_end_date;
            if (event.recurrence_type === 'weekly' && event.recurrence_day != null) {
                schedule.byDay = [byDayNames[event.recurrence_day]];
            }
            if (event.recurrence_type === 'monthly' && event.recurrence_day != null) {
                schedule.byMonthDay = [event.recurrence_day];
            }
            schema.eventSchedule = schedule;
        }
    }

    const schemaEl = document.getElementById('event-schema');
    if (schemaEl) schemaEl.textContent = JSON.stringify(schema, null, 2);
}

function updateGoingUI(eventId, goingCount) {
    const isGoing = !!getRSVPs()[eventId];
    document.getElementById('event-going-count').innerText = Math.max(0, goingCount);
    const icon = document.getElementById('event-going-icon');
    icon.style.filter  = isGoing ? 'grayscale(0)' : 'grayscale(1)';
    icon.style.opacity = isGoing ? '1'             : '0.4';
}

function renderEventContent(event, slug) {
    const cityName = capitalizeWords(event.cities?.name || '');
    const catName  = event.categories?.name || '';
    const catIcon  = event.categories?.icon_name || iconFallbacks[catName] || 'calendar';

    // Cover image
    const coverEl = document.getElementById('event-cover');
    if (event.image_url) {
        coverEl.innerHTML = `<img src="${event.image_url}" alt="${event.title}">`;
    } else {
        coverEl.innerHTML = `
            <div class="event-cover-placeholder" style="background:var(--cat-${catName});">
                <i data-lucide="${catIcon}" style="color:var(--icon-${catName});"></i>
            </div>`;
    }

    // Category badge
    const badgeEl = document.getElementById('event-category-badge');
    badgeEl.style.background = `var(--cat-${catName})`;
    badgeEl.style.color      = `var(--icon-${catName})`;
    badgeEl.innerHTML        = `<i data-lucide="${catIcon}"></i>${catName}`;

    // Title
    document.getElementById('event-title').textContent = event.title;

    // Date + time
    const dateStr       = event.event_date ? formatDate(event.event_date) : 'Date TBA';
    const recurrenceText = window.formatRecurrenceText ? window.formatRecurrenceText(event) : null;
    const timeStr       = (!recurrenceText && event.event_time) ? ` · ${event.event_time}` : '';
    document.getElementById('event-date-time').textContent = dateStr + timeStr;

    const recurrenceRow = document.getElementById('event-recurrence-row');
    const recurrenceEl  = document.getElementById('event-recurrence');
    if (recurrenceText && recurrenceRow && recurrenceEl) {
        recurrenceEl.textContent    = recurrenceText;
        recurrenceRow.style.display = 'flex';
    } else if (recurrenceRow) {
        recurrenceRow.style.display = 'none';
    }

    // Info cards
    document.getElementById('event-price').textContent    = event.price || 'Free';
    document.getElementById('event-location').textContent = (event.location || 'TBA') + (cityName ? `, ${cityName}` : '');

    // Description
    const descEl = document.getElementById('event-description');
    if (event.description) {
        descEl.innerHTML = event.description
            .split(/\n+/)
            .map(p => `<p>${p}</p>`)
            .join('');
    } else {
        descEl.innerHTML = '<p style="font-style:italic;color:var(--text-muted);">No description provided for this event.</p>';
    }

    // Map
    const mapSection = document.getElementById('event-map-section');
    if (event.address && mapSection) {
        document.getElementById('event-map-address').textContent = event.address;
        document.getElementById('event-map-iframe').src =
            `https://www.google.com/maps?q=${encodeURIComponent(event.address)}&output=embed`;
        mapSection.style.display = 'block';
    }

    // RSVP — DB is source of truth for count; localStorage gates per-device toggle
    let currentCount = event.going_count ?? 0;
    updateGoingUI(event.id, currentCount);

    document.getElementById('event-going-card').addEventListener('click', async () => {
        const rsvps   = getRSVPs();
        const isGoing = !!rsvps[event.id];

        // Optimistic update
        if (isGoing) {
            delete rsvps[event.id];
            currentCount = Math.max(0, currentCount - 1);
        } else {
            rsvps[event.id] = true;
            currentCount += 1;
        }
        updateRSVPs(rsvps);
        updateGoingUI(event.id, currentCount);

        const card = document.getElementById('event-going-card');
        card.style.transform = 'scale(0.95)';
        setTimeout(() => card.style.transform = 'scale(1)', 150);

        // Persist to DB; revert on error
        const { error } = await supabase
            .from('events')
            .update({ going_count: currentCount })
            .eq('id', event.id);

        if (error) {
            // Revert optimistic update
            currentCount = isGoing ? currentCount + 1 : Math.max(0, currentCount - 1);
            if (isGoing) rsvps[event.id] = true; else delete rsvps[event.id];
            updateRSVPs(rsvps);
            updateGoingUI(event.id, currentCount);
            console.error('[RSVP] update failed:', error.message);
        }
    });

    // Show content
    document.getElementById('event-loading').style.display = 'none';
    document.getElementById('event-content').style.display = 'block';

    lucide.createIcons();
}

async function renderMoreEvents(event) {
    if (!event.city_id && !event.cities?.name) return;
    const cityId = event.city_id;
    if (!cityId) return;

    const { data, error } = await fetchPublishedEventsByCity(cityId, event.id);
    if (error || !data || data.length === 0) return;

    const section  = document.getElementById('more-events-section');
    const divider  = document.getElementById('event-section-divider');
    const heading  = document.getElementById('more-events-heading');
    const grid     = document.getElementById('more-events-grid');
    const cityName = capitalizeWords(event.cities?.name || 'this city');

    heading.textContent = `More events in ${cityName}`;
    grid.innerHTML = '';

    data.forEach(e => {
        const cat     = e.categories?.name || '';
        const icon    = e.categories?.icon_name || iconFallbacks[cat] || 'calendar';
        const dateStr = e.event_date ? new Date(e.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

        const imageHtml = e.image_url
            ? `<div class="card-image-wrapper"><img src="${e.image_url}" alt="${e.title}"></div>`
            : `<div class="card-image-wrapper placeholder-image" style="display:flex;align-items:center;justify-content:center;opacity:0.3;">
                   <i data-lucide="${icon}" style="width:60px;height:60px;"></i>
               </div>`;

        const link = document.createElement('a');
        link.href  = `/event/${e.slug}`;

        const card = document.createElement('div');
        card.className = 'event-card';
        card.setAttribute('data-cat', cat);
        card.innerHTML = `
            <div class="card-category-label">${cat}</div>
            <div class="card-icon" style="z-index:2;overflow:hidden;display:flex;justify-content:center;align-items:center;">
                <i data-lucide="${icon}"></i>
            </div>
            ${imageHtml}
            <div class="card-content-wrapper">
                <h3 class="card-title">${e.title}</h3>
                <div class="card-meta">
                    <p class="card-date"><i data-lucide="calendar" class="meta-icon"></i>${dateStr}</p>
                    ${e.location ? `<p class="card-location"><i data-lucide="map-pin" class="meta-icon"></i>${e.location}</p>` : ''}
                </div>
            </div>`;

        link.appendChild(card);
        grid.appendChild(link);
    });

    section.style.display = 'block';
    if (divider) divider.style.display = 'block';
    lucide.createIcons();
}

function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        btn.innerHTML = '<i data-lucide="sun"></i>';
        lucide.createIcons({ nodes: [btn] });
    }
    btn.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            btn.innerHTML = '<i data-lucide="moon"></i>';
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            btn.innerHTML = '<i data-lucide="sun"></i>';
        }
        lucide.createIcons({ nodes: [btn] });
    });
}

async function init() {
    lucide.createIcons();
    initThemeToggle();

    const parts = window.location.pathname.split('/').filter(Boolean);
    // Expect: ['event', '<slug>']
    const slug = parts[1];
    if (!slug) { showError(); return; }

    const { data: event, error } = await fetchEventBySlug(slug);
    if (error) {
        console.error('[event.js] fetchEventBySlug error:', error.message);
        showError();
        return;
    }
    if (!event) { showError(); return; }

    updateSEO(event, slug);
    renderEventContent(event, slug);
    renderMoreEvents(event);
}

init();
