import { fetchPublishedEvents, fetchCities, fetchCategories, submitEventRequest } from './db.js';
import { getVisitorLocation, findNearestCity, setUserCityOverride, clearUserCityOverride } from './geo.js';

// State
let events        = [];
let categoriesData = [];
let citiesData    = [];
let activeCity    = '';

const iconFallbacks = {
    'Sports':        'dribbble',
    'Education':     'book-open',
    'Music':         'music',
    'Entertainment': 'smile',
};

// User preferences stay client-side
let userPreferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');

// DOM Elements
const eventsGrid             = document.getElementById('events-grid');
const filterContainer        = document.getElementById('filter-container');
const cityFilterContainer    = document.getElementById('city-filter-container');
const eventCount             = document.getElementById('event-count');
const themeToggle            = document.getElementById('theme-toggle');
const myEventsBtn            = document.getElementById('my-events-btn');
const profileModal           = document.getElementById('profile-modal');
const closeProfile           = document.getElementById('close-profile');
const preferencesList        = document.getElementById('preferences-list');
const savePreferences        = document.getElementById('save-preferences');
const adminAddBtn            = document.getElementById('admin-add-btn');
const adminModal             = document.getElementById('admin-modal');
const closeAdmin             = document.getElementById('close-admin');
const saveEvent              = document.getElementById('save-event');
const eventCategorySelect    = document.getElementById('event-category');
const eventDetailView        = document.getElementById('event-detail-view');
const pageHeader             = document.querySelector('.header');
const eventsMain             = document.querySelector('.events-main');
const mobileFilters          = document.getElementById('mobile-filters');
const filterPanelCategories  = document.getElementById('filter-panel-categories');
const filterPanelCities      = document.getElementById('filter-panel-cities');
const filterCardCategories   = document.getElementById('filter-card-categories');
const filterCardCities       = document.getElementById('filter-card-cities');
const filterCardCatLabel     = document.getElementById('filter-card-categories-label');
const filterCardCityLabel    = document.getElementById('filter-card-cities-label');

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

const capitalizeWords = str => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : str;

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

    lucide.createIcons();
}

// --- City filter pills + modal select (rendered from DB) ---
function renderCityFilters() {
    cityFilterContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `filter-pill city-pill ${!activeCity ? 'active' : ''}`;
    allBtn.setAttribute('data-city', 'All');
    allBtn.innerHTML = `<span>All Cities</span>`;
    cityFilterContainer.appendChild(allBtn);

    citiesData.forEach(city => {
        const btn = document.createElement('button');
        btn.className = `filter-pill city-pill ${activeCity === city.name ? 'active' : ''}`;
        btn.setAttribute('data-city', city.name);
        btn.innerHTML = `<span>${capitalizeWords(city.name)}</span>`;
        cityFilterContainer.appendChild(btn);
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

    const isMyEvents     = myEventsBtn.classList.contains('active');
    const activeCatBtn   = !isMyEvents && document.querySelector('#filter-container .filter-pill.active');
    const categoryFilter = isMyEvents ? 'MyEvents' : (activeCatBtn ? activeCatBtn.getAttribute('data-category') : 'All');

    const isAllCities = !activeCity;

    const today    = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const filteredEvents = events.filter(e => {
        if (e.date < todayStr) return false;

        if (categoryFilter === 'MyEvents') {
            if (!getRSVPs()[e.id]) return false;
        } else {
            if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
        }

        return isAllCities || (e.city || '').toLowerCase().trim() === activeCity.toLowerCase().trim();
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
                    ${event.location ? '<p class="card-location"><i data-lucide="map-pin" class="meta-icon"></i>' + event.location + (event.city ? ', ' + capitalizeWords(event.city) : '') + '</p>' : ''}
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
    updateFilterCardLabels();
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
    eventDetailView.style.display = 'none';
    pageHeader.style.display      = 'flex';
    mobileFilters.style.display   = '';
    eventsMain.style.display      = 'block';
});

function openEventDetail(event) {
    const detailImage = document.getElementById('detail-image');
    detailImage.src          = event.image || 'https://images.unsplash.com/photo-1501281668745-f7f5792203b2?auto=format&fit=crop&q=80&w=600';
    detailImage.style.display = 'block';

    document.getElementById('detail-title').innerText     = event.title;
    document.getElementById('detail-date-time').innerText = `${formatDate(event.date)} - ${event.time || ''}`;
    document.getElementById('detail-location').innerText  = (event.location || 'Location TBA') + (event.city ? `, ${capitalizeWords(event.city)}` : '');
    document.getElementById('detail-price').innerText     = event.price || 'Free';

    document.getElementById('detail-description').innerHTML = event.description
        ? `<p>${event.description.replace(/\n/g, '<br>')}</p>`
        : `<p style="font-style:italic;color:var(--text-muted);">No description provided for this event.</p>`;

    currentDetailEventId = event.id;
    updateGoingUI(event);

    pageHeader.style.display      = 'none';
    mobileFilters.style.display   = 'none';
    eventsMain.style.display      = 'none';
    eventDetailView.style.display     = 'block';
    window.scrollTo(0, 0);
}

// --- Filter listeners ---
filterContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-pill');
    if (btn) {
        myEventsBtn.classList.remove('active');
        document.querySelectorAll('#filter-container .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderEvents();
        updateCategoryCardVisual(btn.getAttribute('data-category'));
        closeAllFilterPanels();
    }
});

myEventsBtn.addEventListener('click', () => {
    const wasActive = myEventsBtn.classList.contains('active');
    myEventsBtn.classList.toggle('active');
    if (!wasActive) {
        document.querySelectorAll('#filter-container .filter-pill').forEach(b => b.classList.remove('active'));
    } else {
        const allPill = document.querySelector('#filter-container .filter-pill[data-category="All"]');
        if (allPill) allPill.classList.add('active');
    }
    renderEvents();
    updateCategoryCardVisual(myEventsBtn.classList.contains('active') ? 'MyEvents' : 'All');
});

cityFilterContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.city-pill');
    if (!btn) return;
    const city = btn.getAttribute('data-city');
    activeCity = (city === 'All' || city === activeCity) ? '' : city;
    document.querySelectorAll('.city-pill').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-city') === (activeCity || 'All'));
    });
    if (activeCity) setUserCityOverride(activeCity);
    else clearUserCityOverride();
    document.getElementById('geo-banner').style.display = 'none';
    renderEvents();
    updateCityCardVisual(activeCity);
    closeAllFilterPanels();
});

// --- Filter card panels: exclusive single-panel-open logic ---
function closeAllFilterPanels() {
    filterCardCategories.setAttribute('aria-expanded', 'false');
    filterCardCities.setAttribute('aria-expanded', 'false');
    filterPanelCategories.setAttribute('aria-hidden', 'true');
    filterPanelCities.setAttribute('aria-hidden', 'true');
}

filterCardCategories.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = filterCardCategories.getAttribute('aria-expanded') === 'true';
    closeAllFilterPanels();
    if (!isOpen) {
        filterCardCategories.setAttribute('aria-expanded', 'true');
        filterPanelCategories.setAttribute('aria-hidden', 'false');
    }
});

filterCardCities.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = filterCardCities.getAttribute('aria-expanded') === 'true';
    closeAllFilterPanels();
    if (!isOpen) {
        filterCardCities.setAttribute('aria-expanded', 'true');
        filterPanelCities.setAttribute('aria-hidden', 'false');
    }
});

function updateCategoryCardVisual(catName) {
    const iconEl = filterCardCategories.querySelector('.filter-card-icon');
    if (catName === 'All') {
        filterCardCategories.style.background  = '';
        filterCardCategories.style.color       = '';
        filterCardCategories.style.borderColor = '';
        if (iconEl) { iconEl.setAttribute('data-lucide', 'layers'); lucide.createIcons({ nodes: [iconEl] }); }
    } else if (catName === 'MyEvents') {
        filterCardCategories.style.background  = '';
        filterCardCategories.style.color       = '';
        filterCardCategories.style.borderColor = '';
        if (iconEl) { iconEl.setAttribute('data-lucide', 'heart'); lucide.createIcons({ nodes: [iconEl] }); }
    } else {
        filterCardCategories.style.background  = `var(--cat-${catName})`;
        filterCardCategories.style.color       = `var(--icon-${catName})`;
        filterCardCategories.style.borderColor = 'transparent';
        const icon = iconFallbacks[catName] || 'calendar';
        if (iconEl) { iconEl.setAttribute('data-lucide', icon); lucide.createIcons({ nodes: [iconEl] }); }
    }
}

function updateCityCardVisual(cityName) {
    if (!cityName) {
        filterCardCities.style.background  = '';
        filterCardCities.style.color       = '';
        filterCardCities.style.borderColor = '';
    } else {
        filterCardCities.style.background  = 'var(--pill-bg)';
        filterCardCities.style.color       = 'var(--text-color)';
        filterCardCities.style.borderColor = 'var(--text-color)';
    }
}

function updateFilterCardLabels() {
    const isMyEvents   = myEventsBtn.classList.contains('active');
    const activeCatBtn = document.querySelector('#filter-container .filter-pill.active');
    const catName      = isMyEvents ? 'My Events' : (activeCatBtn?.getAttribute('data-category') || 'All');
    filterCardCatLabel.textContent  = (catName === 'All') ? 'All Categories' : catName;

    filterCardCityLabel.textContent = activeCity ? capitalizeWords(activeCity) : 'All Cities';
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
    if (!e.target.closest('#mobile-filters')) {
        closeAllFilterPanels();
    }
});

searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length > 0) searchDropdown.style.display = 'flex';
});

// --- Geo banner ---
function showGeoBanner(cityName) {
    document.getElementById('geo-city-name').textContent = cityName;
    document.getElementById('geo-banner').style.display = '';
}

document.getElementById('geo-change-btn').addEventListener('click', () => {
    closeAllFilterPanels();
    filterCardCities.setAttribute('aria-expanded', 'true');
    filterPanelCities.setAttribute('aria-hidden', 'false');
    filterCardCities.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('geo-dismiss-btn').addEventListener('click', () => {
    document.getElementById('geo-banner').style.display = 'none';
    sessionStorage.setItem('geoBannerDismissed', '1');
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

    // Resolve geo before city pills render so activeCity is set correctly
    const location = await getVisitorLocation();
    if (location?.overrideCity) {
        if (citiesData.some(c => c.name === location.overrideCity)) {
            activeCity = location.overrideCity;
        }
    } else if (location?.lat && !sessionStorage.getItem('geoBannerDismissed')) {
        const nearest = findNearestCity(location, citiesData);
        if (nearest) {
            activeCity = nearest.name;
            showGeoBanner(nearest.name);
        }
    }

    renderCategoryFilters();
    renderCityFilters();
    renderEvents();
}

init();
