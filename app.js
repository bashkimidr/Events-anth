import { fetchPublishedEvents, fetchCities, fetchCategories, submitEventRequest } from './db.js';

// State
let events        = [];
let categoriesData = [];
let citiesData    = [];

const iconFallbacks = {
    'Sports':        'dribbble',
    'Education':     'book-open',
    'Music':         'music',
    'Entertainment': 'smile',
};

// User preferences stay client-side
let userPreferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');

// DOM Elements
const eventsGrid          = document.getElementById('events-grid');
const filterContainer     = document.getElementById('filter-container');
const eventCount          = document.getElementById('event-count');
const themeToggle         = document.getElementById('theme-toggle');
const profileModal        = document.getElementById('profile-modal');
const closeProfile        = document.getElementById('close-profile');
const preferencesList     = document.getElementById('preferences-list');
const savePreferences     = document.getElementById('save-preferences');
const adminAddBtn         = document.getElementById('admin-add-btn');
const adminModal          = document.getElementById('admin-modal');
const closeAdmin          = document.getElementById('close-admin');
const saveEvent           = document.getElementById('save-event');
const eventCategorySelect = document.getElementById('event-category');
const eventDetailView     = document.getElementById('event-detail-view');
const pageHeader          = document.querySelector('.header');
const categoriesSection   = document.querySelector('.categories');
const eventsMain          = document.querySelector('.events-main');

let currentDetailEventId = null;

// --- Normalise Supabase row → internal shape used throughout the UI ---
function normalizeEvent(e) {
    return {
        id:           e.id,
        title:        e.title,
        category:     e.categories?.name     || '',
        categorySlug: e.categories?.slug     || '',
        categoryIcon: e.categories?.icon_name || null,
        date:         e.event_date,
        time:         e.event_time            || '',
        location:     e.location              || '',
        city:         e.cities?.name          || '',
        citySlug:     e.cities?.slug          || '',
        baseGoing:    e.base_going            || 0,
        image:        e.image_url             || '',
        price:        e.price                 || '',
        description:  e.description           || '',
        slug:         e.slug                  || '',
    };
}

function getCategoryIcon(categoryName, iconName) {
    const icon = iconName || iconFallbacks[categoryName] || 'calendar';
    return { isLucide: true, value: icon };
}

function formatDate(dateString) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// --- Category filter pills (rendered from DB) ---
function renderCategoryFilters() {
    filterContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-pill active';
    allBtn.setAttribute('data-category', 'All');
    allBtn.title = 'All';
    allBtn.innerHTML = `<i data-lucide="layers"></i><span>All</span>`;
    filterContainer.appendChild(allBtn);

    categoriesData.forEach(cat => {
        const icon = cat.icon_name || iconFallbacks[cat.name] || 'calendar';
        const btn = document.createElement('button');
        btn.className = 'filter-pill';
        btn.setAttribute('data-category', cat.name);
        btn.title = cat.name;
        btn.innerHTML = `<i data-lucide="${icon}"></i><span>${cat.name}</span>`;
        filterContainer.appendChild(btn);
    });

    const myEventsBtn = document.createElement('button');
    myEventsBtn.className = 'filter-pill my-events-btn';
    myEventsBtn.setAttribute('data-category', 'MyEvents');
    myEventsBtn.title = 'My Events';
    myEventsBtn.style.marginLeft = 'auto';
    myEventsBtn.innerHTML = `<i data-lucide="heart"></i><span>My Events</span>`;
    filterContainer.appendChild(myEventsBtn);

    lucide.createIcons();
}

// --- City filter pills + modal select (rendered from DB) ---
function renderCityFilters() {
    const cityContainer = document.getElementById('city-filter-container');
    if (!cityContainer) return;

    let activeCities = Array.from(cityContainer.querySelectorAll('.city-pill.active'))
        .map(b => b.getAttribute('data-city'));
    if (activeCities.length === 0) activeCities = ['All'];

    cityContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `filter-pill city-pill ${activeCities.includes('All') ? 'active' : ''}`;
    allBtn.setAttribute('data-city', 'All');
    allBtn.innerHTML = `<span>All Cities</span>`;
    cityContainer.appendChild(allBtn);

    citiesData.forEach(city => {
        const btn = document.createElement('button');
        btn.className = `filter-pill city-pill ${activeCities.includes(city.name) ? 'active' : ''}`;
        btn.setAttribute('data-city', city.name);
        btn.innerHTML = `<span>${city.name}</span>`;
        cityContainer.appendChild(btn);
    });

    // Populate city select in request modal
    const eventCitySelect = document.getElementById('event-city');
    if (eventCitySelect) {
        eventCitySelect.innerHTML = '';
        citiesData.forEach(city => {
            const opt = document.createElement('option');
            opt.value = city.name;
            opt.innerText = city.name;
            eventCitySelect.appendChild(opt);
        });
    }

    // Populate category select in request modal
    if (eventCategorySelect) {
        eventCategorySelect.innerHTML = '';
        categoriesData.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.innerText = cat.name;
            eventCategorySelect.appendChild(opt);
        });
    }
}

// --- Loading / Empty / Error states ---
function showLoadingState() {
    eventsGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px 0;color:var(--text-muted);font-size:15px;">
            Loading events…
        </div>`;
    eventCount.innerText = '';
}

function showEmptyState() {
    eventsGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px 0;color:var(--text-muted);font-size:15px;">
            No upcoming events yet — check back soon!
        </div>`;
    eventCount.innerText = '0 Items';
}

function showErrorState(retryFn) {
    eventsGrid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px 0;color:var(--text-muted);font-size:15px;">
            <p style="margin-bottom:12px;">Could not load events. Check your connection and try again.</p>
            <button id="retry-btn" class="save-btn" style="max-width:140px;">Retry</button>
        </div>`;
    eventCount.innerText = '';
    document.getElementById('retry-btn')?.addEventListener('click', retryFn);
}

// --- Render events grid ---
function renderEvents() {
    eventsGrid.innerHTML = '';

    const activeCatBtn   = document.querySelector('#filter-container .filter-pill.active');
    const categoryFilter = activeCatBtn ? activeCatBtn.getAttribute('data-category') : 'All';

    const selectedCityNodes  = document.querySelectorAll('#city-filter-container .city-pill.active');
    const selectedCities     = Array.from(selectedCityNodes).map(n => n.getAttribute('data-city'));
    const isAllCities        = selectedCities.includes('All') || selectedCities.length === 0;

    const today    = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const filteredEvents = events.filter(e => {
        if (e.date < todayStr) return false;

        if (categoryFilter === 'MyEvents') {
            if (!getRSVPs()[e.id]) return false;
        } else {
            if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
        }

        const eventCitySafe    = (e.city || '').toLowerCase().trim();
        const selectedCitiesSafe = selectedCities.map(c => c.toLowerCase().trim());
        return isAllCities || selectedCitiesSafe.includes(eventCitySafe);
    });

    eventCount.innerText = `${filteredEvents.length} Items`;

    if (filteredEvents.length === 0 && categoryFilter !== 'MyEvents') {
        showEmptyState();
        return;
    }

    const renderCard = (event) => {
        const catRes = getCategoryIcon(event.category, event.categoryIcon);
        const card   = document.createElement('div');
        card.className = 'event-card';
        card.setAttribute('data-cat', event.category);

        const iconHtml = catRes.isLucide
            ? `<i data-lucide="${catRes.value}"></i>`
            : `<img src="${catRes.value}" style="width:24px;height:24px;object-fit:contain;border-radius:50%;opacity:0.8;" />`;

        let imageHtml = '';
        if (event.image) {
            imageHtml = `<div class="card-image-wrapper"><img src="${event.image}" alt="event image"></div>`;
        } else {
            const placeholderSvg = catRes.isLucide
                ? `<i data-lucide="${catRes.value}" style="width:80px;height:80px;"></i>`
                : `<img src="${catRes.value}" style="width:80px;height:80px;object-fit:contain;" />`;
            imageHtml = `<div class="card-image-wrapper placeholder-image" style="display:flex;align-items:center;justify-content:center;opacity:0.3;">${placeholderSvg}</div>`;
        }

        card.innerHTML = `
            <div class="card-category-label">${event.category}</div>
            <div class="card-icon" style="z-index:2;overflow:hidden;display:flex;justify-content:center;align-items:center;">
                ${iconHtml}
            </div>
            ${imageHtml}
            <div class="card-content-wrapper">
                <h3 class="card-title">${event.title}</h3>
                <div class="card-meta">
                    <p class="card-date"><i data-lucide="calendar" class="meta-icon"></i>${formatDate(event.date)}${event.time ? ' <i data-lucide="clock" class="meta-icon" style="margin-left:6px;"></i> ' + event.time : ''}</p>
                    ${event.location ? '<p class="card-location"><i data-lucide="map-pin" class="meta-icon"></i>' + event.location + (event.city ? ', ' + event.city : '') + '</p>' : ''}
                </div>
            </div>
        `;
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => openEventDetail(event));
        eventsGrid.appendChild(card);
    };

    if (categoryFilter === 'MyEvents') {
        filteredEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

        const groupedEvents = {};
        filteredEvents.forEach(e => {
            if (!groupedEvents[e.date]) groupedEvents[e.date] = [];
            groupedEvents[e.date].push(e);
        });
        if (!groupedEvents[todayStr]) groupedEvents[todayStr] = [];

        Object.keys(groupedEvents).sort((a, b) => new Date(a) - new Date(b)).forEach(dateStr => {
            const headerEl = document.createElement('div');
            headerEl.style.cssText = 'grid-column:1/-1;width:100%;border-bottom:1px solid var(--border-color);padding-bottom:8px;margin-top:16px;margin-bottom:8px;';
            headerEl.innerHTML = `<h3 style="margin:0;font-size:16px;">${dateStr === todayStr ? 'Today' : formatDate(dateStr)}</h3>`;
            eventsGrid.appendChild(headerEl);

            const eventsForDate = groupedEvents[dateStr];
            if (eventsForDate.length === 0) {
                const emptyTxt = document.createElement('div');
                emptyTxt.style.cssText = 'grid-column:1/-1;font-style:italic;color:var(--text-muted);font-size:14px;margin-bottom:16px;';
                emptyTxt.innerText = 'You dont have any events today';
                eventsGrid.appendChild(emptyTxt);
            } else {
                eventsForDate.forEach(event => renderCard(event));
            }
        });
    } else {
        filteredEvents.forEach(event => renderCard(event));
    }

    lucide.createIcons();
}

// --- RSVP (stays localStorage) ---
function getRSVPs()         { return JSON.parse(localStorage.getItem('userRSVPs') || '{}'); }
function updateRSVPs(rsvps) { localStorage.setItem('userRSVPs', JSON.stringify(rsvps)); }

function updateGoingUI(event) {
    const rsvps   = getRSVPs();
    const isGoing = !!rsvps[event.id];
    const totalGoing = (event.baseGoing || 0) + (isGoing ? 1 : 0);

    document.getElementById('detail-going-count').innerText = totalGoing;
    const icon = document.getElementById('detail-going-icon');
    icon.style.filter  = isGoing ? 'grayscale(0)' : 'grayscale(1)';
    icon.style.opacity = isGoing ? '1' : '0.4';
}

document.getElementById('detail-going-card').addEventListener('click', () => {
    if (!currentDetailEventId) return;
    const rsvps = getRSVPs();
    if (rsvps[currentDetailEventId]) {
        delete rsvps[currentDetailEventId];
    } else {
        rsvps[currentDetailEventId] = true;
    }
    updateRSVPs(rsvps);
    const ev = events.find(e => e.id === currentDetailEventId);
    if (ev) updateGoingUI(ev);
    const card = document.getElementById('detail-going-card');
    card.style.transform = 'scale(0.95)';
    setTimeout(() => card.style.transform = 'scale(1)', 150);
});

document.getElementById('back-to-events').addEventListener('click', () => {
    eventDetailView.style.display  = 'none';
    pageHeader.style.display       = 'flex';
    categoriesSection.style.display = 'flex';
    eventsMain.style.display       = 'block';
});

function openEventDetail(event) {
    const detailImage = document.getElementById('detail-image');
    detailImage.src          = event.image || 'https://images.unsplash.com/photo-1501281668745-f7f5792203b2?auto=format&fit=crop&q=80&w=600';
    detailImage.style.display = 'block';

    document.getElementById('detail-title').innerText     = event.title;
    document.getElementById('detail-date-time').innerText = `${formatDate(event.date)} - ${event.time || ''}`;
    document.getElementById('detail-location').innerText  = (event.location || 'Location TBA') + (event.city ? `, ${event.city}` : '');
    document.getElementById('detail-price').innerText     = event.price || 'Free';

    document.getElementById('detail-description').innerHTML = event.description
        ? `<p>${event.description.replace(/\n/g, '<br>')}</p>`
        : `<p style="font-style:italic;color:var(--text-muted);">No description provided for this event.</p>`;

    currentDetailEventId = event.id;
    updateGoingUI(event);

    pageHeader.style.display        = 'none';
    categoriesSection.style.display = 'none';
    eventsMain.style.display        = 'none';
    eventDetailView.style.display   = 'block';
    window.scrollTo(0, 0);
}

// --- Filter listeners ---
filterContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-pill');
    if (btn) {
        document.querySelectorAll('#filter-container .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderEvents();
    }
});

const cityFilterContainer = document.getElementById('city-filter-container');
if (cityFilterContainer) {
    cityFilterContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.city-pill');
        if (!btn) return;
        const city = btn.getAttribute('data-city');
        if (city === 'All') {
            document.querySelectorAll('.city-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        } else {
            document.querySelector('.city-pill[data-city="All"]').classList.remove('active');
            btn.classList.toggle('active');
            if (document.querySelectorAll('.city-pill.active').length === 0) {
                document.querySelector('.city-pill[data-city="All"]').classList.add('active');
            }
        }
        renderEvents();
    });
}

// --- Theme toggle ---
themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.body.removeAttribute('data-theme');
        themeToggle.innerHTML = '<i data-lucide="moon"></i>';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i data-lucide="sun"></i>';
    }
    lucide.createIcons();
});

// --- Profile modal ---
function renderPreferences() {
    preferencesList.innerHTML = '';
    categoriesData.forEach(cat => {
        const isActive = !!userPreferences[cat.name];
        const item = document.createElement('div');
        item.className = 'toggle-item';
        item.innerHTML = `
            <span>${cat.name}</span>
            <div class="toggle-switch ${isActive ? 'active' : ''}" data-cat="${cat.name}"></div>
        `;
        preferencesList.appendChild(item);
    });
    document.querySelectorAll('.toggle-switch').forEach(sw => {
        sw.addEventListener('click', (e) => {
            const el  = e.currentTarget;
            el.classList.toggle('active');
            userPreferences[el.getAttribute('data-cat')] = el.classList.contains('active');
        });
    });
}

closeProfile.addEventListener('click', () => profileModal.classList.remove('active'));
savePreferences.addEventListener('click', () => {
    localStorage.setItem('userPreferences', JSON.stringify(userPreferences));
    profileModal.classList.remove('active');
    alert('Preferences saved! You will receive notifications for your selected categories.');
});

// --- Request modal → Supabase event_submissions ---
adminAddBtn.addEventListener('click', () => adminModal.classList.add('active'));
closeAdmin.addEventListener('click', () => adminModal.classList.remove('active'));

saveEvent.addEventListener('click', async (e) => {
    try {
        if (e) e.preventDefault();

        const title       = document.getElementById('event-title').value.trim();
        const category    = eventCategorySelect.value;
        const date        = document.getElementById('event-date').value;
        const time        = document.getElementById('event-time').value;
        const location    = document.getElementById('event-location').value.trim();
        const city        = document.getElementById('event-city').value;
        const price       = document.getElementById('event-price').value.trim();
        const description = document.getElementById('event-description').value.trim();
        const email       = document.getElementById('event-email').value.trim();
        const phone       = document.getElementById('event-phone').value.trim();

        if (!title || !date || !time || !location || !city || !email || !phone) {
            alert('Please fill out Title, Email, Phone, City, Date, Time, and Location');
            return;
        }

        let image_url = '';
        const imageInput = document.getElementById('event-image-file').files[0];
        if (imageInput) {
            try {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = ev => resolve(ev.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageInput);
                });
                const res  = await fetch('/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64, filename: imageInput.name })
                });
                const data = await res.json();
                if (data.url) image_url = data.url;
            } catch (err) {
                console.error('Image upload failed', err);
            }
        }

        const btn = document.getElementById('save-event');
        btn.disabled    = true;
        btn.textContent = 'Submitting…';

        const { error } = await submitEventRequest({
            title, description,
            category_name:   category,
            city_name:       city,
            event_date:      date,
            event_time:      time,
            location, price, image_url,
            submitter_email: email,
            submitter_phone: phone,
        });

        btn.disabled    = false;
        btn.textContent = 'Submit Request';

        if (error) {
            alert('Submission failed: ' + error.message);
            return;
        }

        alert('Thank you! Your event request has been submitted for review.');
        adminModal.classList.remove('active');

        ['event-title','event-email','event-phone','event-date','event-time',
         'event-location','event-price','event-description','event-image-file']
            .forEach(id => { document.getElementById(id).value = ''; });

    } catch (err) {
        alert('Error during submission: ' + err.message);
        console.error('Save Event Error:', err);
    }
});

// --- Search ---
const searchInput    = document.getElementById('search-input');
const searchDropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) { searchDropdown.style.display = 'none'; return; }

    const matches = events.filter(ev =>
        ev.title.toLowerCase().includes(query) ||
        ev.category.toLowerCase().includes(query) ||
        (ev.location && ev.location.toLowerCase().includes(query))
    );

    if (matches.length === 0) {
        searchDropdown.innerHTML = '<div style="padding:12px 16px;color:var(--text-muted);font-size:14px;text-align:center;">No results found</div>';
        searchDropdown.style.display = 'flex';
        return;
    }

    searchDropdown.innerHTML = '';
    matches.forEach(match => {
        const catRes   = getCategoryIcon(match.category, match.categoryIcon);
        const iconHtml = catRes.isLucide
            ? `<i data-lucide="${catRes.value}"></i>`
            : `<img src="${catRes.value}" style="width:16px;height:16px;border-radius:50%;object-fit:cover;" />`;
        const safeClass = match.category.replace(/\s+/g, '-');
        const item = document.createElement('div');
        item.className = 'search-dropdown-item';
        item.innerHTML = `
            <div class="search-item-icon" style="background:var(--cat-${safeClass});color:var(--icon-${safeClass});">
                ${iconHtml}
            </div>
            <div class="search-item-details">
                <span class="search-item-title">${match.title}</span>
                <span class="search-item-meta">${formatDate(match.date)}${match.location ? ' • ' + match.location : ''}</span>
            </div>
        `;
        item.addEventListener('click', () => {
            searchInput.value = '';
            searchDropdown.style.display = 'none';
            openEventDetail(match);
        });
        searchDropdown.appendChild(item);
    });
    lucide.createIcons();
    searchDropdown.style.display = 'flex';
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = 'none';
    }
});

searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length > 0) searchDropdown.style.display = 'flex';
});

// --- Bootstrap ---
async function init() {
    lucide.createIcons();
    showLoadingState();

    const [eventsResult, citiesResult, categoriesResult] = await Promise.all([
        fetchPublishedEvents(),
        fetchCities(),
        fetchCategories(),
    ]);

    const firstError = eventsResult.error || citiesResult.error || categoriesResult.error;
    if (firstError) {
        console.error('Failed to load data from Supabase:', firstError);
        showErrorState(init);
        return;
    }

    events         = (eventsResult.data     || []).map(normalizeEvent);
    citiesData     = citiesResult.data      || [];
    categoriesData = categoriesResult.data  || [];

    renderCategoryFilters();
    renderCityFilters();
    renderEvents();
}

init();
