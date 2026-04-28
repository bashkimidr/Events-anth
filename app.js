import { fetchPublishedEvents, fetchCities, fetchCategories } from './db.js';
import { supabase } from './supabase-client.js';
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
const pageHeader             = document.querySelector('.header');
const eventsMain             = document.querySelector('.events-main');
const mobileFilters          = document.getElementById('mobile-filters');
const filterPanelCategories  = document.getElementById('filter-panel-categories');
const filterPanelCities      = document.getElementById('filter-panel-cities');
const filterCardCategories   = document.getElementById('filter-card-categories');
const filterCardCities       = document.getElementById('filter-card-cities');
const filterCardCatLabel     = document.getElementById('filter-card-categories-label');
const filterCardCityLabel    = document.getElementById('filter-card-cities-label');
const aboutSection           = document.getElementById('about-section');


// --- Normalise Supabase row → internal shape used throughout the UI ---
function normalizeEvent(e) {
    return {
        id:                  e.id,
        title:               e.title,
        category:            e.categories?.name     || '',
        categorySlug:        e.categories?.slug     || '',
        categoryIcon:        e.categories?.icon_name || null,
        categoryColor:       e.categories?.color     || null,
        date:                e.event_date,
        time:                e.event_time            || '',
        event_time:          e.event_time            || '',
        location:            e.location              || '',
        city:                e.cities?.name          || '',
        citySlug:            e.cities?.slug          || '',
        baseGoing:           e.base_going            || 0,
        image:               e.image_url             || '',
        price:               e.price                 || '',
        description:         e.description           || '',
        slug:                e.slug                  || '',
        recurrence_type:     e.recurrence_type       || null,
        recurrence_day:      e.recurrence_day        != null ? e.recurrence_day : null,
        recurrence_end_date: e.recurrence_end_date   || null,
        recurrence_note:     e.recurrence_note       || null,
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

// --- Dynamic category CSS vars from DB colors ---
function getContrastColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#1a1a1a' : '#ffffff';
}

function injectCategoryVars(categories) {
    categories.forEach(cat => {
        if (!cat.color) return;
        const name = cat.name;
        document.documentElement.style.setProperty(`--cat-${name}`, cat.color);
        document.documentElement.style.setProperty(`--icon-${name}`, getContrastColor(cat.color));
    });
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

// --- About section visibility ---
function updateAboutVisibility() {
    if (!aboutSection) return;
    const isMyEvents    = myEventsBtn.classList.contains('active');
    const catActive     = (filterCardCategories.dataset.category || 'All') !== 'All';
    const cityActive    = !!activeCity;
    const searchActive  = searchInput.value.trim().length > 0;
    const hidden = isMyEvents || catActive || cityActive || searchActive;
    aboutSection.classList.toggle('hidden', hidden);
}

// --- Render events grid ---
function renderEvents() {
    updateAboutVisibility();
    eventsGrid.innerHTML = '';

    const isMyEvents     = myEventsBtn.classList.contains('active');
    const categoryFilter = isMyEvents ? 'MyEvents' : (filterCardCategories.dataset.category || 'All');

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
    updateFilterCardLabels();

    if (filteredEvents.length === 0 && categoryFilter !== 'MyEvents') {
        showEmptyState();
        return;
    }

    const renderCard = (event) => {
        const catRes = getCategoryIcon(event.category, event.categoryIcon);

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

        const link = document.createElement('a');
        link.href  = `/event/${event.slug}`;
        link.style.textDecoration = 'none';
        link.style.color          = 'inherit';
        link.style.display        = 'block';

        const card = document.createElement('div');
        card.className = 'event-card';
        card.setAttribute('data-cat', event.category);
        const recurrenceText = window.formatRecurrenceText ? window.formatRecurrenceText(event) : null;

        card.innerHTML = `
            <div class="card-category-label">${event.category}</div>
            <div class="card-icon" style="z-index:2;overflow:hidden;display:flex;justify-content:center;align-items:center;color:${event.categoryColor || 'inherit'};">
                ${iconHtml}
            </div>
            ${imageHtml}
            <div class="card-content-wrapper">
                <h3 class="card-title">${event.title}</h3>
                <div class="card-meta">
                    <p class="card-date"><i data-lucide="calendar" class="meta-icon"></i>${formatDate(event.date)}${recurrenceText ? ' <i data-lucide="repeat" class="meta-icon" style="margin-left:6px;"></i>' : ''} <i data-lucide="clock" class="meta-icon" style="margin-left:6px;"></i> ${event.time ? (window.formatTimeShort ? window.formatTimeShort(event.time) : event.time) : 'All day'}</p>
                    ${event.location ? '<p class="card-location"><i data-lucide="map-pin" class="meta-icon"></i>' + event.location + (event.city ? ', ' + capitalizeWords(event.city) : '') + '</p>' : ''}
                </div>
            </div>
        `;

        link.appendChild(card);
        eventsGrid.appendChild(link);
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

// --- RSVP helpers (used by My Events filter) ---
function getRSVPs() { return JSON.parse(localStorage.getItem('userRSVPs') || '{}'); }

// --- Filter listeners ---
filterContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-pill');
    if (btn) {
        const catName = btn.getAttribute('data-category');
        myEventsBtn.classList.remove('active');
        document.querySelectorAll('#filter-container .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterCardCategories.dataset.category = catName;
        renderEvents();
        updateCategoryCardVisual(catName);
        closeAllFilterPanels();
    }
});

myEventsBtn.addEventListener('click', () => {
    const wasActive = myEventsBtn.classList.contains('active');
    myEventsBtn.classList.toggle('active');
    if (!wasActive) {
        document.querySelectorAll('#filter-container .filter-pill').forEach(b => b.classList.remove('active'));
        filterCardCategories.dataset.category = 'MyEvents';
    } else {
        const allPill = document.querySelector('#filter-container .filter-pill[data-category="All"]');
        if (allPill) allPill.classList.add('active');
        filterCardCategories.dataset.category = 'All';
    }
    renderEvents();
    updateCategoryCardVisual(myEventsBtn.classList.contains('active') ? 'MyEvents' : 'All');
});

cityFilterContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.city-pill');
    if (!btn) return;
    const city = btn.getAttribute('data-city');
    activeCity = (city === 'All' || city === activeCity) ? '' : city;
    filterCardCities.dataset.city = activeCity || 'All';
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
    // Bug 3: blur focus out of any panel before aria-hiding it
    const focused = document.activeElement;
    if (filterPanelCategories.contains(focused) || filterPanelCities.contains(focused)) {
        focused.blur();
    }
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
    const isMyEvents = myEventsBtn.classList.contains('active');
    const catName    = isMyEvents ? 'MyEvents' : (filterCardCategories.dataset.category || 'All');
    filterCardCatLabel.textContent  = (catName === 'All') ? 'All Categories'
                                    : (catName === 'MyEvents') ? 'My Events'
                                    : catName;

    filterCardCityLabel.textContent = activeCity ? capitalizeWords(activeCity) : 'All Cities';
}

// --- Theme toggle ---
// Sync icon on load with whatever the inline script already applied
if (document.documentElement.getAttribute('data-theme') === 'dark') {
    themeToggle.innerHTML = '<i data-lucide="sun"></i>';
}

themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        themeToggle.innerHTML = '<i data-lucide="moon"></i>';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
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

// --- Image resize helper (canvas-based, no external libs) ---
async function resizeImageToBase64(file, maxWidth = 1200, jpegQuality = 0.85, maxBytes = 1024 * 1024) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a JPG, PNG, or WEBP image.');
    }

    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
    });

    const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Could not decode image'));
        i.src = dataUrl;
    });

    let targetW = img.width;
    let targetH = img.height;
    if (targetW > maxWidth) {
        targetH = Math.round(targetH * (maxWidth / targetW));
        targetW = maxWidth;
    }

    const canvas = document.createElement('canvas');
    canvas.width  = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const resizedDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);

    const sizeBytes = Math.ceil((resizedDataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
    if (sizeBytes > maxBytes) {
        throw new Error('Image is too detailed even after resizing. Try a simpler/smaller image.');
    }

    return resizedDataUrl;
}

// --- Request modal → Supabase event_submissions ---
adminAddBtn.addEventListener('click', () => adminModal.classList.add('active'));
closeAdmin.addEventListener('click', () => adminModal.classList.remove('active'));

document.getElementById('recurring-checkbox').addEventListener('change', (e) => {
    document.getElementById('recurrence-fields').style.display = e.target.checked ? 'block' : 'none';
    if (!e.target.checked) {
        document.getElementById('recurrence-type').value = '';
        document.getElementById('recurrence-day-weekly-wrap').style.display  = 'none';
        document.getElementById('recurrence-day-monthly-wrap').style.display = 'none';
    }
});

document.getElementById('recurrence-type').addEventListener('change', (e) => {
    document.getElementById('recurrence-day-weekly-wrap').style.display  = e.target.value === 'weekly'  ? 'block' : 'none';
    document.getElementById('recurrence-day-monthly-wrap').style.display = e.target.value === 'monthly' ? 'block' : 'none';
});

saveEvent.addEventListener('click', async (e) => {
    try {
        if (e) e.preventDefault();

        const title       = document.getElementById('event-title').value.trim();
        const category    = eventCategorySelect.value;
        const date        = document.getElementById('event-date').value;
        const time        = document.getElementById('event-time').value;
        const location    = document.getElementById('event-location').value.trim();
        const address     = document.getElementById('event-address').value.trim() || null;
        const city        = document.getElementById('event-city').value;
        const price       = document.getElementById('event-price').value.trim();
        const description = document.getElementById('event-description').value.trim();
        const email       = document.getElementById('event-email').value.trim();

        if (!title || !date || !location || !city || !email) {
            alert('Please fill out Title, Email, City, Date, and Location');
            return;
        }

        // Recurrence
        const isRecurring       = document.getElementById('recurring-checkbox').checked;
        const recurrenceType    = isRecurring ? (document.getElementById('recurrence-type').value || null) : null;
        const recurrenceEndDate = isRecurring ? (document.getElementById('recurrence-end-date').value || null) : null;
        let   recurrenceDay     = null;
        if (isRecurring && recurrenceType === 'weekly') {
            recurrenceDay = parseInt(document.getElementById('recurrence-day-weekly').value, 10);
        } else if (isRecurring && recurrenceType === 'monthly') {
            recurrenceDay = parseInt(document.getElementById('recurrence-day-monthly').value, 10);
        }
        if (isRecurring && !recurrenceType) {
            alert('Please select how this event repeats.');
            return;
        }

        let pendingImageData = null;
        const fileInput = document.getElementById('event-image-file');
        if (fileInput && fileInput.files && fileInput.files[0]) {
            try {
                pendingImageData = await resizeImageToBase64(fileInput.files[0]);
            } catch (err) {
                alert(err.message);
                return;
            }
        }

        const btn = document.getElementById('save-event');
        btn.disabled    = true;
        btn.textContent = 'Submitting…';

        const { error } = await supabase.from('event_submissions').insert([{
            title,
            description,
            category_name:        category,
            city_name:            city,
            event_date:           date,
            event_time:           time || null,
            location,
            address,
            price,
            submitter_email:      email,
            pending_image_data:   pendingImageData,
            status:               'pending',
            recurrence_type:      recurrenceType,
            recurrence_day:       recurrenceDay,
            recurrence_end_date:  recurrenceEndDate,
            recurrence_note:      null,
        }]);

        btn.disabled    = false;
        btn.textContent = 'Submit Request';

        if (error) {
            alert('Submission failed: ' + error.message);
            return;
        }

        alert('Thank you! Your event request has been submitted for review.');
        adminModal.classList.remove('active');

        ['event-title','event-email','event-date','event-time',
         'event-location','event-address','event-price','event-description','event-image-file',
         'recurrence-type','recurrence-end-date']
            .forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('recurring-checkbox').checked            = false;
        document.getElementById('recurrence-fields').style.display       = 'none';
        document.getElementById('recurrence-day-weekly-wrap').style.display  = 'none';
        document.getElementById('recurrence-day-monthly-wrap').style.display = 'none';

    } catch (err) {
        alert('Error during submission: ' + err.message);
        console.error('Save Event Error:', err);
    }
});

// --- Search ---
const searchInput    = document.getElementById('search-input');
const searchDropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', (e) => {
    updateAboutVisibility();
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
    injectCategoryVars(categoriesData);

    // Explicitly reset card state to "All" before any render or geo override
    filterCardCategories.dataset.category = 'All';
    filterCardCities.dataset.city         = 'All';
    updateCategoryCardVisual('All');
    updateCityCardVisual('');

    // Resolve geo — may override city card only, never the category card
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
    if (activeCity) {
        filterCardCities.dataset.city = activeCity;
        updateCityCardVisual(activeCity);
    }

    renderCategoryFilters();
    renderCityFilters();
    renderEvents();
}

init();
