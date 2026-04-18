// Initialize Icons
lucide.createIcons();

// Mock Data Defaults
const defaultEvents = [
    { id: 1, title: 'Summer Music Fest', category: 'Music', date: '2026-06-15', time: '18:00', location: 'Central Park', city: 'New York', baseGoing: 142, image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&q=80&w=200' },
    { id: 2, title: 'Yoga in the Park', category: 'Sports', date: '2026-04-10', time: '09:00', location: 'Golden Gate Park', city: 'San Francisco', baseGoing: 38, image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=200' },
    { id: 3, title: 'React Workshop', category: 'Education', date: '2026-05-05', time: '14:30', location: 'Tech Hub Building', city: 'Boston', baseGoing: 65, image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=200' },
    { id: 4, title: 'Standup Comedy', category: 'Entertainment', date: '2026-04-20', time: '20:00', location: 'Comedy Club LA', city: 'Los Angeles', baseGoing: 112, image: 'https://images.unsplash.com/photo-1527224857830-43a7ebb85334?auto=format&fit=crop&q=80&w=200' },
    { id: 5, title: 'Marathon 2026', category: 'Sports', date: '2026-09-12', time: '07:00', location: 'City Stadium', city: 'New York', baseGoing: 840, image: '' },
];

let events = JSON.parse(localStorage.getItem('app_events'));
if (!events || events.length === 0) {
    events = defaultEvents;
    localStorage.setItem('app_events', JSON.stringify(events));
}

let categoriesData = JSON.parse(localStorage.getItem('app_categoriesData')) || ['Sports', 'Education', 'Music', 'Entertainment'];
localStorage.setItem('app_categoriesData', JSON.stringify(categoriesData));
const userPreferences = {
    Sports: true,
    Education: false,
    Music: true,
    Entertainment: false
};

// DOM Elements
const eventsGrid = document.getElementById('events-grid');
const filterContainer = document.getElementById('filter-container');
const eventCount = document.getElementById('event-count');
const themeToggle = document.getElementById('theme-toggle');

const profileBtn = document.getElementById('profile-btn');
const navProfileBtn = document.getElementById('nav-profile-btn');
const profileModal = document.getElementById('profile-modal');
const closeProfile = document.getElementById('close-profile');
const preferencesList = document.getElementById('preferences-list');
const savePreferences = document.getElementById('save-preferences');

const adminAddBtn = document.getElementById('admin-add-btn');
const adminModal = document.getElementById('admin-modal');
const closeAdmin = document.getElementById('close-admin');
const saveEvent = document.getElementById('save-event');

// Utility Functions
const categoryResources = {
    'Sports':   { isLucide: true, value: 'dribbble' },
    'Education':{ isLucide: true, value: 'book-open' },
    'Music':    { isLucide: true, value: 'music' },
    'Entertainment': { isLucide: true, value: 'smile' }
};

function getCategoryIcon(category) {
    if(categoryResources[category]) return categoryResources[category];
    return { isLucide: true, value: 'calendar' };
}

function formatDate(dateString) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Render Events
function renderEvents() {
    eventsGrid.innerHTML = '';
    
    const activeCatBtn = document.querySelector('#filter-container .filter-pill.active');
    const categoryFilter = activeCatBtn ? activeCatBtn.getAttribute('data-category') : 'All';
    
    const selectedCityNodes = document.querySelectorAll('#city-filter-container .city-pill.active');
    const selectedCities = Array.from(selectedCityNodes).map(n => n.getAttribute('data-city'));
    const isAllCities = selectedCities.includes('All') || selectedCities.length === 0;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const filteredEvents = events.filter(e => {
        if (e.date < todayStr) return false;

        if (categoryFilter === 'MyEvents') {
            const rsvps = getRSVPs();
            const isGoing = !!rsvps[e.id];
            if (!isGoing) return false;
        } else {
            const matchCat = categoryFilter === 'All' || e.category === categoryFilter;
            if (!matchCat) return false;
        }
        
        const eventCitySafe = (e.city || '').toLowerCase().trim();
        const selectedCitiesSafe = selectedCities.map(c => c.toLowerCase().trim());
        const matchCity = isAllCities || selectedCitiesSafe.includes(eventCitySafe);
        return matchCity;
    });
        
    eventCount.innerText = `${filteredEvents.length} Items`;

    const renderCard = (event) => {
        const catRes = getCategoryIcon(event.category);
        const card = document.createElement('div');
        card.className = 'event-card';
        card.setAttribute('data-cat', event.category);
        
        const iconHtml = catRes.isLucide 
            ? `<i data-lucide="${catRes.value}"></i>` 
            : `<img src="${catRes.value}" style="width: 24px; height: 24px; object-fit: contain; border-radius: 50%; opacity: 0.8;" />`;
            
        let imageHtml = '';
        if (event.image) {
            imageHtml = `<div class="card-image-wrapper"><img src="${event.image}" alt="event image"></div>`;
        } else {
            let placeholderSvg = `<i data-lucide="image" style="width: 80px; height: 80px;"></i>`;
            if (event.category === 'Sports') {
                placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M13 5.5v5l3 3M10 10.5l-3 3 2 5M15 16.5l3 3"/><path d="M9.5 5.5l3-3 3 3"/></svg>`;
            } else if (catRes.isLucide) {
                placeholderSvg = `<i data-lucide="${catRes.value}" style="width: 80px; height: 80px;"></i>`;
            } else {
                placeholderSvg = `<img src="${catRes.value}" style="width: 80px; height: 80px; object-fit: contain;" />`;
            }
            imageHtml = `<div class="card-image-wrapper placeholder-image" style="display:flex; align-items:center; justify-content:center; opacity:0.3;">${placeholderSvg}</div>`;
        }

        card.innerHTML = `
            <div class="card-category-label">${event.category}</div>
            <div class="card-icon" style="z-index: 2; overflow: hidden; display:flex; justify-content:center; align-items:center;">
                ${iconHtml}
            </div>
            ${imageHtml}
            <div class="card-content-wrapper">
                <h3 class="card-title">${event.title}</h3>
                <div class="card-meta">
                    <p class="card-date"><i data-lucide="calendar" class="meta-icon"></i>${formatDate(event.date)}${event.time ? ' <i data-lucide="clock" class="meta-icon" style="margin-left: 6px;"></i> ' + event.time : ''}</p>
                    ${event.location ? '<p class="card-location"><i data-lucide="map-pin" class="meta-icon"></i>' + event.location + (event.city ? ', ' + event.city : '') + '</p>' : ''}
                </div>
            </div>
        `;
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => openEventDetail(event));
        eventsGrid.appendChild(card);
    };

    if (categoryFilter === 'MyEvents') {
        filteredEvents.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        const groupedEvents = {};
        filteredEvents.forEach(e => {
            if (!groupedEvents[e.date]) groupedEvents[e.date] = [];
            groupedEvents[e.date].push(e);
        });

        if (!groupedEvents[todayStr]) {
            groupedEvents[todayStr] = [];
        }

        const sortedDates = Object.keys(groupedEvents).sort((a,b) => new Date(a) - new Date(b));

        sortedDates.forEach(dateStr => {
            const header = document.createElement('div');
            header.style.gridColumn = '1 / -1';
            header.style.width = '100%';
            header.style.borderBottom = '1px solid var(--border-color)';
            header.style.paddingBottom = '8px';
            header.style.marginTop = '16px';
            header.style.marginBottom = '8px';
            
            const isToday = dateStr === todayStr;
            let titleText = isToday ? 'Today' : formatDate(dateStr);
            
            header.innerHTML = `<h3 style="margin: 0; font-size: 16px;">${titleText}</h3>`;
            eventsGrid.appendChild(header);

            const eventsForDate = groupedEvents[dateStr];
            
            if (eventsForDate.length === 0) {
                const emptyTxt = document.createElement('div');
                emptyTxt.style.gridColumn = '1 / -1';
                emptyTxt.style.fontStyle = 'italic';
                emptyTxt.style.color = 'var(--text-muted)';
                emptyTxt.style.fontSize = '14px';
                emptyTxt.style.marginBottom = '16px';
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

// Event Detail View Logic
const eventDetailView = document.getElementById('event-detail-view');
const header = document.querySelector('.header');
const categoriesSection = document.querySelector('.categories');
const eventsMain = document.querySelector('.events-main');

let currentDetailEventId = null;

function getRSVPs() {
    return JSON.parse(localStorage.getItem('userRSVPs') || '{}');
}

function updateRSVPs(rsvps) {
    localStorage.setItem('userRSVPs', JSON.stringify(rsvps));
}

function updateGoingUI(event) {
    const rsvps = getRSVPs();
    const isGoing = !!rsvps[event.id];
    const goingCountElement = document.getElementById('detail-going-count');
    const goingIconElement = document.getElementById('detail-going-icon');
    
    let totalGoing = event.baseGoing || 0;
    if (isGoing) totalGoing += 1;
    
    goingCountElement.innerText = totalGoing;
    
    if (isGoing) {
        goingIconElement.style.filter = 'grayscale(0)';
        goingIconElement.style.opacity = '1';
    } else {
        goingIconElement.style.filter = 'grayscale(1)';
        goingIconElement.style.opacity = '0.4';
    }
}

document.getElementById('detail-going-card').addEventListener('click', () => {
    if (!currentDetailEventId) return;
    const rsvps = getRSVPs();
    const isCurrentlyGoing = !!rsvps[currentDetailEventId];
    
    if (isCurrentlyGoing) {
        delete rsvps[currentDetailEventId];
    } else {
        rsvps[currentDetailEventId] = true;
    }
    updateRSVPs(rsvps);
    
    const ev = events.find(e => e.id === currentDetailEventId);
    if(ev) updateGoingUI(ev);
    
    const card = document.getElementById('detail-going-card');
    card.style.transform = 'scale(0.95)';
    setTimeout(() => card.style.transform = 'scale(1)', 150);
});

document.getElementById('back-to-events').addEventListener('click', () => {
    eventDetailView.style.display = 'none';
    header.style.display = 'flex';
    categoriesSection.style.display = 'flex';
    eventsMain.style.display = 'block';
});

function openEventDetail(event) {
    // Populate Data
    const detailImage = document.getElementById('detail-image');
    if (event.image) {
        detailImage.src = event.image;
        detailImage.style.display = 'block';
    } else {
        // Fallback image if none
        detailImage.src = 'https://images.unsplash.com/photo-1501281668745-f7f5792203b2?auto=format&fit=crop&q=80&w=600';
    }
    
    document.getElementById('detail-title').innerText = event.title;
    
    const dateStr = formatDate(event.date);
    document.getElementById('detail-date-time').innerText = `${dateStr} - ${event.time || ''}`;
    
    document.getElementById('detail-location').innerText = (event.location || 'Location TBA') + (event.city ? `, ${event.city}` : '');
    
    // Price and Description
    document.getElementById('detail-price').innerText = event.price || 'Free';
    
    if (event.description) {
        document.getElementById('detail-description').innerHTML = `<p>${event.description.replace(/\n/g, '<br>')}</p>`;
    } else {
        document.getElementById('detail-description').innerHTML = `<p style="font-style: italic; color: var(--text-muted);">No description provided for this event.</p>`;
    }
    
    // Evaluate RSVP logic from local storage
    currentDetailEventId = event.id;
    updateGoingUI(event);
    
    // Switch views
    header.style.display = 'none';
    categoriesSection.style.display = 'none';
    eventsMain.style.display = 'none';
    
    eventDetailView.style.display = 'block';
    window.scrollTo(0, 0);
}

// Filter Logic
filterContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-pill');
    if(btn) {
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

// Theme Toggle
themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if(isDark) {
        document.body.removeAttribute('data-theme');
        themeToggle.innerHTML = '<i data-lucide="moon"></i>';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i data-lucide="sun"></i>';
    }
    lucide.createIcons();
});

// Profile Modal Logic
function renderPreferences() {
    preferencesList.innerHTML = '';
    categoriesData.forEach(cat => {
        const isActive = userPreferences[cat];
        const item = document.createElement('div');
        item.className = 'toggle-item';
        item.innerHTML = `
            <span>${cat}</span>
            <div class="toggle-switch ${isActive ? 'active' : ''}" data-cat="${cat}"></div>
        `;
        preferencesList.appendChild(item);
    });

    document.querySelectorAll('.toggle-switch').forEach(sw => {
        sw.addEventListener('click', (e) => {
            const el = e.currentTarget;
            el.classList.toggle('active');
            const cat = el.getAttribute('data-cat');
            userPreferences[cat] = el.classList.contains('active');
        });
    });
}

function openProfileModal() {
    renderPreferences();
    profileModal.classList.add('active');
}
if (profileBtn) profileBtn.addEventListener('click', openProfileModal);
if (navProfileBtn) navProfileBtn.addEventListener('click', openProfileModal);
closeProfile.addEventListener('click', () => profileModal.classList.remove('active'));
savePreferences.addEventListener('click', () => {
    profileModal.classList.remove('active');
    alert('Preferences saved! You will receive notifications for your selected categories.');
});

// Admin Modal Logic
adminAddBtn.addEventListener('click', () => adminModal.classList.add('active'));
closeAdmin.addEventListener('click', () => adminModal.classList.remove('active'));

const eventCategorySelect = document.getElementById('event-category');

saveEvent.addEventListener('click', async (e) => {
    try {
        if (e) e.preventDefault();
        const title = document.getElementById('event-title').value;
    let category = eventCategorySelect.value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const location = document.getElementById('event-location').value;
    const city = document.getElementById('event-city').value;
    const price = document.getElementById('event-price').value;
    const description = document.getElementById('event-description').value;
    
    const imageInput = document.getElementById('event-image-file').files[0];
    let image = '';
    
    if (imageInput) {
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageInput);
            });
            const res = await fetch('/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64, filename: imageInput.name })
            });
            const data = await res.json();
            if (data.url) {
                image = data.url;
            }
        } catch(err) {
            console.error("Image upload failed", err);
        }
    }

    const email = document.getElementById('event-email').value.trim();
    const phone = document.getElementById('event-phone').value.trim();

    if(!title || !date || !time || !location || !city || !email || !phone) {
        alert('Please fill out Title, Email, Phone, City, Date, Time, and Location');
        return;
    }


    // Instead of pushing to the public feed, we submit a request.
    const requestedEvent = {
        id: Date.now(),
        title, category, date, time, location, city, price, description, email, phone, image, status: 'Pending'
    };
    
    let requestedEvents;
    try {
        requestedEvents = JSON.parse(localStorage.getItem('app_requested_events'));
    } catch(e) {}
    if (!Array.isArray(requestedEvents)) requestedEvents = [];
    
    requestedEvents.push(requestedEvent);
    localStorage.setItem('app_requested_events', JSON.stringify(requestedEvents));

    alert('Thank you! Your event request has been successfully submitted to the Admin for review.');
    adminModal.classList.remove('active');
    
    // reset form
    document.getElementById('event-title').value = '';
    document.getElementById('event-email').value = '';
    document.getElementById('event-phone').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-time').value = '';
    document.getElementById('event-location').value = '';
    document.getElementById('event-city').value = '';
    document.getElementById('event-price').value = '';
    document.getElementById('event-description').value = '';
    document.getElementById('event-image-file').value = '';
    
    eventCategorySelect.value = category;

    renderEvents(document.querySelector('.filter-pill.active')?.getAttribute('data-category') || 'All');
    } catch(err) {
        alert("CRITICAL ERROR during request save: " + err.message);
        console.error("Save Event Error:", err);
    }
});

// Initial Render
function renderCityFilters() {
    const cityContainer = document.getElementById('city-filter-container');
    if (!cityContainer) return;
    
    const capitalize = (str) => {
        if (!str) return '';
        return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };
    
    const uniqueCities = new Set();
    events.forEach(ev => {
        if (ev.city) uniqueCities.add(capitalize(ev.city.trim()));
    });
    
    let activeCities = Array.from(cityContainer.querySelectorAll('.city-pill.active')).map(b => b.getAttribute('data-city'));
    if (activeCities.length === 0) activeCities = ['All'];
    
    cityContainer.innerHTML = '';
    
    const allBtn = document.createElement('button');
    allBtn.className = `filter-pill city-pill ${activeCities.includes('All') ? 'active' : ''}`;
    allBtn.setAttribute('data-city', 'All');
    allBtn.innerHTML = `<span>All Cities</span>`;
    cityContainer.appendChild(allBtn);
    
    Array.from(uniqueCities).sort().forEach(city => {
        const btn = document.createElement('button');
        btn.className = `filter-pill city-pill ${activeCities.includes(city) ? 'active' : ''}`;
        btn.setAttribute('data-city', city);
        btn.innerHTML = `<span>${city}</span>`;
        cityContainer.appendChild(btn);
    });

    const eventCitySelect = document.getElementById('event-city');
    if (eventCitySelect) {
        eventCitySelect.innerHTML = '';
        Array.from(uniqueCities).sort().forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.innerText = city;
            eventCitySelect.appendChild(opt);
        });
    }
}

renderCityFilters();
renderEvents();

// Search Logic
const searchInput = document.getElementById('search-input');
const searchDropdown = document.getElementById('search-dropdown');

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
        searchDropdown.style.display = 'none';
        return;
    }
    
    const matches = events.filter(ev => 
        ev.title.toLowerCase().includes(query) || 
        ev.category.toLowerCase().includes(query) ||
        (ev.location && ev.location.toLowerCase().includes(query))
    );
    
    if (matches.length === 0) {
        searchDropdown.innerHTML = '<div style="padding: 12px 16px; color: var(--text-muted); font-size: 14px; text-align: center;">No results found</div>';
        searchDropdown.style.display = 'flex';
        return;
    }
    
    searchDropdown.innerHTML = '';
    matches.forEach(match => {
        const catRes = getCategoryIcon(match.category);
        const iconHtml = catRes.isLucide 
            ? `<i data-lucide="${catRes.value}"></i>` 
            : `<img src="${catRes.value}" style="width: 16px; height: 16px; border-radius: 50%; object-fit: cover;" />`;
            
        const safeClass = match.category.replace(/\s+/g,'-');
        
        const item = document.createElement('div');
        item.className = 'search-dropdown-item';
        item.innerHTML = `
            <div class="search-item-icon" style="background: var(--cat-${safeClass}); color: var(--icon-${safeClass});">
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

// Hide dropdown when clicking away
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = 'none';
    }
});

searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length > 0) {
        searchDropdown.style.display = 'flex';
    }
});
