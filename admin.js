import { requireAdmin, attachSignOutButton } from './auth-guard.js';
import { fetchCategories, fetchCities, createEvent, uploadEventImage } from './db.js';
import { supabase } from './supabase-client.js';

// ── Auth gate ─────────────────────────────────────────────────────────────────
const currentUser = await requireAdmin();

lucide.createIcons();
attachSignOutButton('#signout-btn');
document.getElementById('admin-email').textContent = currentUser.email;

// ── State ─────────────────────────────────────────────────────────────────────
let categoriesData = [];
let citiesData     = [];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const eventCategorySelect = document.getElementById('event-category');
const newCategoryGroup    = document.getElementById('new-category-group');
const newCategoryName     = document.getElementById('new-category-name');
const eventCitySelect     = document.getElementById('event-city');
const newCityGroup        = document.getElementById('new-city-group');
const newCityName         = document.getElementById('new-city-name');
const saveEventBtn        = document.getElementById('save-event');
const formMessage         = document.getElementById('form-message');

// ── Inline feedback ───────────────────────────────────────────────────────────
function showMessage(text, type = 'success') {
    formMessage.textContent   = text;
    formMessage.className     = type;
    formMessage.style.display = 'block';
    if (type === 'success') {
        setTimeout(() => { formMessage.style.display = 'none'; }, 4000);
    }
}

function clearMessage() {
    formMessage.style.display = 'none';
    formMessage.textContent   = '';
    formMessage.className     = '';
}

// ── Slug helper ───────────────────────────────────────────────────────────────
function toSlug(text) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Populate dropdowns from DB ────────────────────────────────────────────────
async function loadDropdowns() {
    const [catResult, cityResult] = await Promise.all([fetchCategories(), fetchCities()]);

    if (catResult.error || cityResult.error) {
        showMessage('Failed to load categories/cities from the database.', 'error');
        return;
    }

    categoriesData = catResult.data  || [];
    citiesData     = cityResult.data || [];

    eventCategorySelect.innerHTML = '';
    categoriesData.forEach(cat => {
        const opt = document.createElement('option');
        opt.value       = cat.id;
        opt.textContent = cat.name;
        eventCategorySelect.appendChild(opt);
    });
    const newCatOpt = document.createElement('option');
    newCatOpt.value       = 'NEW';
    newCatOpt.textContent = '-- Add New Category --';
    eventCategorySelect.appendChild(newCatOpt);

    eventCitySelect.innerHTML = '';
    citiesData.forEach(city => {
        const opt = document.createElement('option');
        opt.value       = city.id;
        opt.textContent = city.name;
        eventCitySelect.appendChild(opt);
    });
    const newCityOpt = document.createElement('option');
    newCityOpt.value       = 'NEW';
    newCityOpt.textContent = '-- Add New City --';
    eventCitySelect.appendChild(newCityOpt);
}

await loadDropdowns();

// ── Show/hide new-entry inputs ────────────────────────────────────────────────
eventCategorySelect.addEventListener('change', () => {
    const isNew = eventCategorySelect.value === 'NEW';
    newCategoryGroup.style.display = isNew ? 'block' : 'none';
    if (!isNew) newCategoryName.value = '';
});

eventCitySelect.addEventListener('change', () => {
    const isNew = eventCitySelect.value === 'NEW';
    newCityGroup.style.display = isNew ? 'block' : 'none';
    if (!isNew) newCityName.value = '';
});

// ── Publish handler ───────────────────────────────────────────────────────────
saveEventBtn.addEventListener('click', async () => {
    clearMessage();

    // Validate required fields
    const fields = [
        ['event-title',       'Event Title'],
        ['event-date',        'Date'],
        ['event-time',        'Time'],
        ['event-location',    'Location'],
        ['event-price',       'Price'],
        ['event-description', 'Description'],
    ];
    const vals = {};
    for (const [id, label] of fields) {
        const el  = document.getElementById(id);
        const val = el.value.trim();
        if (!val) {
            el.focus();
            showMessage(`${label} is required.`, 'error');
            return;
        }
        vals[id] = val;
    }

    // Resolve category
    let categoryId;
    if (eventCategorySelect.value === 'NEW') {
        const rawName = newCategoryName.value.trim();
        if (!rawName) {
            newCategoryName.focus();
            showMessage('New category name is required.', 'error');
            return;
        }
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const { data: newCat, error: catErr } = await supabase
            .from('categories')
            .insert([{ name, slug: toSlug(name) }])
            .select()
            .single();
        if (catErr) { showMessage('Failed to create category: ' + catErr.message, 'error'); return; }
        categoryId = newCat.id;
        categoriesData.push(newCat);
    } else {
        categoryId = eventCategorySelect.value;
        if (!categoryId) { showMessage('Please select a category.', 'error'); return; }
    }

    // Resolve city
    let cityId;
    if (eventCitySelect.value === 'NEW') {
        const rawName = newCityName.value.trim();
        if (!rawName) {
            newCityName.focus();
            showMessage('New city name is required.', 'error');
            return;
        }
        const name = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const { data: newCity, error: cityErr } = await supabase
            .from('cities')
            .insert([{ name, slug: toSlug(name) }])
            .select()
            .single();
        if (cityErr) { showMessage('Failed to create city: ' + cityErr.message, 'error'); return; }
        cityId = newCity.id;
        citiesData.push(newCity);
    } else {
        cityId = eventCitySelect.value;
        if (!cityId) { showMessage('Please select a city.', 'error'); return; }
    }

    // Upload image if provided
    let image_url = '';
    const imageFile = document.getElementById('event-image-file').files[0];
    if (imageFile) {
        const { data: imgData, error: imgErr } = await uploadEventImage(imageFile);
        if (imgErr) { showMessage('Image upload failed: ' + imgErr.message, 'error'); return; }
        image_url = imgData.publicUrl;
    }

    saveEventBtn.disabled    = true;
    saveEventBtn.textContent = 'Publishing…';

    const { error } = await createEvent({
        title:       vals['event-title'],
        description: vals['event-description'],
        event_date:  vals['event-date'],
        event_time:  vals['event-time'],
        location:    vals['event-location'],
        price:       vals['event-price'],
        image_url,
        category_id: categoryId,
        city_id:     cityId,
        status:      'published',
        base_going:  Math.floor(Math.random() * 50) + 1,
    });

    saveEventBtn.disabled    = false;
    saveEventBtn.textContent = 'Publish Event';

    if (error) {
        showMessage('Failed to publish event: ' + error.message, 'error');
        return;
    }

    showMessage('Event published!', 'success');

    // Reset form
    ['event-title', 'event-date', 'event-time', 'event-location',
     'event-price', 'event-description', 'event-image-file',
     'new-category-name', 'new-city-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    newCategoryGroup.style.display = 'none';
    newCityGroup.style.display     = 'none';
    await loadDropdowns();
});
