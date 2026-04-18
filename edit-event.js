// Initialize Icons
lucide.createIcons();

let categoriesData = JSON.parse(localStorage.getItem('app_categoriesData')) || ['Sports', 'Education', 'Music', 'Entertainment'];

// --- Admin Change Event Logic ---
const editSearchInput = document.getElementById('edit-search-input');
const editSearchDropdown = document.getElementById('edit-search-dropdown');
const editFormWrap = document.getElementById('edit-form-wrap');

const editEventCategory = document.getElementById('edit-event-category');
const editEventId = document.getElementById('edit-event-id');
const editEventCity = document.getElementById('edit-event-city');
const editNewCityGroup = document.getElementById('edit-new-city-group');
const editNewCityName = document.getElementById('edit-new-city-name');

function syncEditCategoryDropdown() {
    editEventCategory.innerHTML = '';
    categoriesData.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        editEventCategory.appendChild(opt);
    });
}
syncEditCategoryDropdown();

// City Selector Logic
editEventCity.addEventListener('change', (e) => {
    if (e.target.value === 'NEW') {
        editNewCityGroup.style.display = 'block';
    } else {
        editNewCityGroup.style.display = 'none';
        editNewCityName.value = '';
    }
});

function syncEditCityDropdown() {
    while (editEventCity.options.length > 1) {
        editEventCity.remove(0);
    }
    
    let allEvents = JSON.parse(localStorage.getItem('app_events')) || [];
    const capitalize = (str) => {
        if (!str) return '';
        return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };
    
    const uniqueCities = new Set();
    allEvents.forEach(ev => {
        if (ev.city) uniqueCities.add(capitalize(ev.city.trim()));
    });
    
    const citiesArray = Array.from(uniqueCities).sort();
    citiesArray.forEach(city => {
        const opt = document.createElement('option');
        opt.value = city;
        opt.innerText = city;
        editEventCity.insertBefore(opt, editEventCity.lastElementChild);
    });
}
syncEditCityDropdown();

editSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
        editSearchDropdown.style.display = 'none';
        return;
    }
    
    let allEvents = JSON.parse(localStorage.getItem('app_events')) || [];
    const matches = allEvents.filter(ev => 
        ev.title.toLowerCase().includes(query) || 
        ev.category.toLowerCase().includes(query) ||
        (ev.location && ev.location.toLowerCase().includes(query))
    );
    
    if (matches.length === 0) {
        editSearchDropdown.innerHTML = '<div style="padding: 12px 16px; color: var(--text-muted); font-size: 14px; text-align: center;">No results found</div>';
        editSearchDropdown.style.display = 'flex';
        return;
    }
    
    editSearchDropdown.innerHTML = '';
    matches.forEach(match => {
        const item = document.createElement('div');
        item.style.padding = '12px 16px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid var(--border-color)';
        item.innerHTML = `<strong>${match.title}</strong> <span style="color: var(--text-muted); font-size: 12px;">(${match.date})</span>`;
        
        item.addEventListener('click', () => {
            editSearchInput.value = '';
            editSearchDropdown.style.display = 'none';
            openEditForm(match);
        });
        
        editSearchDropdown.appendChild(item);
    });
    
    editSearchDropdown.style.display = 'flex';
});

document.addEventListener('click', (e) => {
    if (!editSearchInput.contains(e.target) && !editSearchDropdown.contains(e.target)) {
        editSearchDropdown.style.display = 'none';
    }
});

editSearchInput.addEventListener('focus', () => {
    if (editSearchInput.value.trim().length > 0) {
        editSearchDropdown.style.display = 'flex';
    }
});

function openEditForm(eventMatch) {
    syncEditCategoryDropdown();
    editFormWrap.style.display = 'block';
    
    editEventId.value = eventMatch.id;
    document.getElementById('edit-event-title').value = eventMatch.title || '';
    editEventCategory.value = eventMatch.category || '';
    document.getElementById('edit-event-date').value = eventMatch.date || '';
    document.getElementById('edit-event-time').value = eventMatch.time || '';
    document.getElementById('edit-event-location').value = eventMatch.location || '';
    document.getElementById('edit-event-price').value = eventMatch.price || '';
    
    syncEditCityDropdown();
    editEventCity.value = eventMatch.city || '';
    // If it didn't strictly match a known city (should barely happen), switch to NEW and fill the box securely
    if(eventMatch.city && editEventCity.value !== eventMatch.city) {
        editEventCity.value = 'NEW';
        editNewCityGroup.style.display = 'block';
        editNewCityName.value = eventMatch.city;
    } else {
        editNewCityGroup.style.display = 'none';
        editNewCityName.value = '';
    }
    
    document.getElementById('edit-event-description').value = eventMatch.description || '';
}

document.getElementById('edit-save-event').addEventListener('click', async () => {
    const idToEdit = parseInt(editEventId.value);
    if (!idToEdit) return;

    let allEvents = JSON.parse(localStorage.getItem('app_events')) || [];
    const eventIndex = allEvents.findIndex(e => e.id === idToEdit);
    
    if(eventIndex === -1) {
        alert('Event not found.');
        return;
    }
    
    const eventObj = allEvents[eventIndex];
    
    // Update basic text fields
    eventObj.title = document.getElementById('edit-event-title').value.trim();
    eventObj.category = editEventCategory.value;
    eventObj.date = document.getElementById('edit-event-date').value;
    eventObj.time = document.getElementById('edit-event-time').value;
    eventObj.location = document.getElementById('edit-event-location').value.trim();
    eventObj.price = document.getElementById('edit-event-price').value.trim();
    
    let editCity = editEventCity.value;
    if (editCity === 'NEW') {
        const custom = editNewCityName.value.trim();
        if (!custom) {
            alert('Please enter a new city name.');
            return;
        }
        editCity = custom.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    eventObj.city = editCity;
    
    eventObj.description = document.getElementById('edit-event-description').value.trim();
    
    // Check if new image was uploaded
    const imageInput = document.getElementById('edit-event-image-file').files[0];
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
                eventObj.image = data.url;
            }
        } catch(err) {
            console.error("Image upload failed", err);
        }
    }
    
    allEvents[eventIndex] = eventObj;
    localStorage.setItem('app_events', JSON.stringify(allEvents));
    
    alert('Event changes saved successfully!');
    editFormWrap.style.display = 'none';
    document.getElementById('edit-event-image-file').value = '';
});

document.getElementById('edit-delete-event').addEventListener('click', () => {
    const idToEdit = parseInt(editEventId.value);
    if (!idToEdit) return;
    
    if(!confirm('Are you strictly sure you want to permanently delete this event? This action cannot be undone.')) {
        return;
    }

    let allEvents = JSON.parse(localStorage.getItem('app_events')) || [];
    const newEvents = allEvents.filter(e => e.id !== idToEdit);
    
    localStorage.setItem('app_events', JSON.stringify(newEvents));
    
    alert('Event permanently deleted.');
    editFormWrap.style.display = 'none';
    document.getElementById('edit-event-image-file').value = '';
});
