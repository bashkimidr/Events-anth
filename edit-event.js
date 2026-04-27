import { requireAdmin, attachSignOutButton } from './auth-guard.js';
import { fetchAllEvents, fetchCategories, fetchCities, updateEvent, deleteEvent, uploadEventImage } from './db.js';
import { supabase } from './supabase-client.js';

const capitalizeWords = str => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : str;

// ── Auth gate ─────────────────────────────────────────────────────────────────
const currentUser = await requireAdmin();

lucide.createIcons();
attachSignOutButton('#signout-btn');
document.getElementById('admin-email').textContent = currentUser.email;

// ── State ─────────────────────────────────────────────────────────────────────
let eventsCache   = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

let categoriesData = [];
let citiesData     = [];
let selectedEvent  = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const editSearchInput      = document.getElementById('edit-search-input');
const editSearchDropdown   = document.getElementById('edit-search-dropdown');
const editFormWrap         = document.getElementById('edit-form-wrap');
const editEventCategory    = document.getElementById('edit-event-category');
const editEventCity        = document.getElementById('edit-event-city');
const editNewCityGroup     = document.getElementById('edit-new-city-group');
const editNewCityName      = document.getElementById('edit-new-city-name');
const formMessage          = document.getElementById('form-message');
const imagePreview         = document.getElementById('current-image-preview');
const editRecurringCb      = document.getElementById('edit-recurring-checkbox');
const editRecurrenceFields = document.getElementById('edit-recurrence-fields');
const editRecurrenceType   = document.getElementById('edit-recurrence-type');
const editDayWeeklyWrap    = document.getElementById('edit-recurrence-day-weekly-wrap');
const editDayMonthlyWrap   = document.getElementById('edit-recurrence-day-monthly-wrap');

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
    formMessage.className     = '';
    formMessage.textContent   = '';
}

function toSlug(text) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ── Load category + city dropdowns ────────────────────────────────────────────
async function loadDropdowns() {
    const [catRes, cityRes] = await Promise.all([fetchCategories(), fetchCities()]);
    categoriesData = catRes.data  || [];
    citiesData     = cityRes.data || [];

    editEventCategory.innerHTML = '';
    categoriesData.forEach(cat => {
        const opt = document.createElement('option');
        opt.value       = cat.id;
        opt.textContent = cat.name;
        editEventCategory.appendChild(opt);
    });

    rebuildCitySelect();
}

function rebuildCitySelect(keepValue) {
    editEventCity.innerHTML = '';
    citiesData.forEach(city => {
        const opt = document.createElement('option');
        opt.value       = city.id;
        opt.textContent = capitalizeWords(city.name);
        editEventCity.appendChild(opt);
    });
    const newOpt = document.createElement('option');
    newOpt.value       = 'NEW';
    newOpt.textContent = '-- Add New City --';
    editEventCity.appendChild(newOpt);
    if (keepValue) editEventCity.value = keepValue;
}

await loadDropdowns();

// ── Recurrence toggle ─────────────────────────────────────────────────────────
editRecurringCb.addEventListener('change', () => {
    editRecurrenceFields.style.display = editRecurringCb.checked ? 'block' : 'none';
    if (!editRecurringCb.checked) {
        editRecurrenceType.value      = '';
        editDayWeeklyWrap.style.display  = 'none';
        editDayMonthlyWrap.style.display = 'none';
    }
});

editRecurrenceType.addEventListener('change', () => {
    editDayWeeklyWrap.style.display  = editRecurrenceType.value === 'weekly'  ? 'block' : 'none';
    editDayMonthlyWrap.style.display = editRecurrenceType.value === 'monthly' ? 'block' : 'none';
});

editEventCity.addEventListener('change', () => {
    const isNew = editEventCity.value === 'NEW';
    editNewCityGroup.style.display = isNew ? 'block' : 'none';
    if (!isNew) editNewCityName.value = '';
});

// ── Events cache + search ─────────────────────────────────────────────────────
async function getEvents() {
    const now = Date.now();
    if (!eventsCache || now - cacheLoadedAt > CACHE_TTL_MS) {
        const { data, error } = await fetchAllEvents();
        if (error) return [];
        eventsCache   = data || [];
        cacheLoadedAt = now;
    }
    return eventsCache;
}

editSearchInput.addEventListener('focus', async () => {
    await getEvents();
    if (editSearchInput.value.trim()) triggerSearch(editSearchInput.value);
});

editSearchInput.addEventListener('input', (e) => triggerSearch(e.target.value));

async function triggerSearch(raw) {
    const query = raw.toLowerCase().trim();
    if (!query) { editSearchDropdown.style.display = 'none'; return; }

    const all     = await getEvents();
    const matches = all.filter(ev =>
        (ev.title || '').toLowerCase().includes(query) ||
        (ev.categories?.name || '').toLowerCase().includes(query) ||
        (ev.location || '').toLowerCase().includes(query)
    );

    editSearchDropdown.innerHTML = '';

    if (matches.length === 0) {
        editSearchDropdown.innerHTML =
            '<div style="padding:12px 16px;color:var(--text-muted);font-size:14px;text-align:center;">No results found</div>';
        editSearchDropdown.style.display = 'flex';
        return;
    }

    matches.forEach(ev => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--border-color);';
        item.innerHTML = `<strong>${ev.title}</strong>
            <span style="color:var(--text-muted);font-size:12px;margin-left:6px;">(${ev.event_date})</span>`;
        item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-color)');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('click', () => {
            editSearchInput.value = '';
            editSearchDropdown.style.display = 'none';
            openEditForm(ev);
        });
        editSearchDropdown.appendChild(item);
    });

    editSearchDropdown.style.display = 'flex';
}

document.addEventListener('click', (e) => {
    if (!editSearchInput.contains(e.target) && !editSearchDropdown.contains(e.target)) {
        editSearchDropdown.style.display = 'none';
    }
});

// ── Populate form from selected event ─────────────────────────────────────────
function openEditForm(ev) {
    selectedEvent = ev;
    clearMessage();
    editFormWrap.style.display = 'block';

    document.getElementById('edit-event-id').value          = ev.id;
    document.getElementById('edit-event-title').value       = ev.title        || '';
    document.getElementById('edit-event-date').value        = ev.event_date   || '';
    document.getElementById('edit-event-time').value        = ev.event_time   || '';
    document.getElementById('edit-event-location').value    = ev.location     || '';
    document.getElementById('edit-event-address').value     = ev.address      || '';
    document.getElementById('edit-event-price').value       = ev.price        || '';
    document.getElementById('edit-event-description').value = ev.description  || '';
    document.getElementById('edit-event-image-file').value  = '';

    // Recurrence pre-fill
    const hasRecurrence = !!ev.recurrence_type || !!ev.recurrence_note;
    editRecurringCb.checked           = hasRecurrence;
    editRecurrenceFields.style.display = hasRecurrence ? 'block' : 'none';
    editRecurrenceType.value           = ev.recurrence_type || '';
    editDayWeeklyWrap.style.display    = ev.recurrence_type === 'weekly'  ? 'block' : 'none';
    editDayMonthlyWrap.style.display   = ev.recurrence_type === 'monthly' ? 'block' : 'none';
    if (ev.recurrence_type === 'weekly' && ev.recurrence_day != null) {
        document.getElementById('edit-recurrence-day-weekly').value = ev.recurrence_day;
    }
    if (ev.recurrence_type === 'monthly' && ev.recurrence_day != null) {
        document.getElementById('edit-recurrence-day-monthly').value = ev.recurrence_day;
    }
    document.getElementById('edit-recurrence-end-date').value = ev.recurrence_end_date || '';
    document.getElementById('edit-recurrence-note').value     = ev.recurrence_note     || '';

    // Image preview
    if (ev.image_url) {
        imagePreview.src          = ev.image_url;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.style.display = 'none';
        imagePreview.src           = '';
    }

    // Category select
    if (ev.category_id) editEventCategory.value = ev.category_id;

    // City select — match by id, fall back to showing NEW input
    rebuildCitySelect(ev.city_id);
    if (editEventCity.value !== ev.city_id) {
        editEventCity.value            = 'NEW';
        editNewCityGroup.style.display = 'block';
        editNewCityName.value          = ev.cities?.name || '';
    } else {
        editNewCityGroup.style.display = 'none';
        editNewCityName.value          = '';
    }

    editFormWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Save changes ──────────────────────────────────────────────────────────────
document.getElementById('edit-save-event').addEventListener('click', async () => {
    clearMessage();

    const id = document.getElementById('edit-event-id').value;
    if (!id) return;

    const title       = document.getElementById('edit-event-title').value.trim();
    const date        = document.getElementById('edit-event-date').value;
    const time        = document.getElementById('edit-event-time').value;
    const location    = document.getElementById('edit-event-location').value.trim();
    const price       = document.getElementById('edit-event-price').value.trim();
    const description = document.getElementById('edit-event-description').value.trim();

    if (!title || !date || !location) {
        showMessage('Title, date and location are required.', 'error');
        return;
    }

    // Resolve city
    let cityId;
    if (editEventCity.value === 'NEW') {
        const rawName = editNewCityName.value.trim();
        if (!rawName) {
            editNewCityName.focus();
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
        rebuildCitySelect(cityId);
    } else {
        cityId = editEventCity.value;
    }

    // Upload new image if provided
    let image_url = selectedEvent?.image_url || '';
    const imageFile = document.getElementById('edit-event-image-file').files[0];
    if (imageFile) {
        const { data: imgData, error: imgErr } = await uploadEventImage(imageFile);
        if (imgErr) { showMessage('Image upload failed: ' + imgErr.message, 'error'); return; }
        image_url = imgData.publicUrl;
    }

    // Recurrence
    const isRecurring       = editRecurringCb.checked;
    const recurrenceType    = isRecurring ? (editRecurrenceType.value || null) : null;
    let   recurrenceDay     = null;
    if (isRecurring && recurrenceType === 'weekly') {
        recurrenceDay = parseInt(document.getElementById('edit-recurrence-day-weekly').value, 10);
    } else if (isRecurring && recurrenceType === 'monthly') {
        recurrenceDay = parseInt(document.getElementById('edit-recurrence-day-monthly').value, 10);
    }
    const recurrenceEndDate = isRecurring ? (document.getElementById('edit-recurrence-end-date').value || null) : null;
    const recurrenceNote    = isRecurring ? (document.getElementById('edit-recurrence-note').value.trim() || null) : null;

    const saveBtn         = document.getElementById('edit-save-event');
    saveBtn.disabled      = true;
    saveBtn.textContent   = 'Saving…';

    const { data: updated, error } = await updateEvent(id, {
        title, description,
        event_date:          date,
        event_time:          time || null,
        location,
        address:             document.getElementById('edit-event-address').value.trim() || null,
        price,
        image_url,
        category_id:         editEventCategory.value,
        city_id:             cityId,
        recurrence_type:     recurrenceType,
        recurrence_day:      recurrenceDay,
        recurrence_end_date: recurrenceEndDate,
        recurrence_note:     recurrenceNote,
    });

    saveBtn.disabled    = false;
    saveBtn.textContent = 'Save Changes';

    if (error) {
        showMessage('Failed to save: ' + error.message, 'error');
        return;
    }

    // Update cache entry
    if (eventsCache && updated) {
        const idx = eventsCache.findIndex(e => e.id === id);
        if (idx !== -1) eventsCache[idx] = { ...eventsCache[idx], ...updated };
    }

    if (updated?.image_url) {
        imagePreview.src          = updated.image_url;
        imagePreview.style.display = 'block';
    }

    showMessage('Changes saved!', 'success');
});

// ── Delete event ──────────────────────────────────────────────────────────────
document.getElementById('edit-delete-event').addEventListener('click', async () => {
    const id = document.getElementById('edit-event-id').value;
    if (!id) return;

    if (!confirm('Permanently delete this event? This cannot be undone.')) return;

    const delBtn         = document.getElementById('edit-delete-event');
    delBtn.disabled      = true;
    delBtn.textContent   = 'Deleting…';

    const { error } = await deleteEvent(id);

    delBtn.disabled    = false;
    delBtn.textContent = 'Delete Event';

    if (error) {
        showMessage('Delete failed: ' + error.message, 'error');
        return;
    }

    // Remove from cache
    if (eventsCache) eventsCache = eventsCache.filter(e => e.id !== id);

    selectedEvent = null;
    editFormWrap.style.display              = 'none';
    document.getElementById('edit-event-image-file').value = '';
    showMessage('Event deleted.', 'success');
});
