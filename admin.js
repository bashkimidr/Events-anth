import { requireAdmin, attachSignOutButton } from './auth-guard.js';
import { fetchCategories, fetchCities, createEvent, uploadEventImage } from './db.js';
import { supabase } from './supabase-client.js';

const capitalizeWords = str => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : str;

const ICON_OPTIONS = [
    'music','mic','headphones','guitar','trophy','dumbbell','bike',
    'book-open','graduation-cap','school','presentation',
    'utensils','coffee','beer','wine','pizza',
    'palette','image','brush','camera','film',
    'sparkles','party-popper','gift','heart','users','hand-heart','message-circle',
    'tree-pine','mountain','tent','sun',
    'briefcase','calendar','map-pin','ticket',
    'star','flame','rocket','zap','lightbulb',
];

const PALETTE = [
    ['rose',     '#f43f5e', '#fb7185', '#fecdd3'],
    ['orange',   '#fb923c', '#fdba74', '#fed7aa'],
    ['yellow',   '#facc15', '#fde047', '#fef08a'],
    ['lime',     '#84cc16', '#a3e635', '#bef264'],
    ['emerald',  '#10b981', '#34d399', '#a7f3d0'],
    ['cyan',     '#06b6d4', '#22d3ee', '#a5f3fc'],
    ['blue',     '#3b82f6', '#60a5fa', '#bfdbfe'],
    ['violet',   '#8b5cf6', '#a78bfa', '#c4b5fd'],
    ['pink',     '#ec4899', '#f472b6', '#f9a8d4'],
    ['slate',    '#6b7280', '#94a3b8', '#cbd5e1'],
    ['charcoal', '#1f2937', '#475569', '#94a3b8'],
    ['silver',   '#a1a1a6', '#d4d4d8', '#e4e4e7'],
];

function buildIconSelect(currentIcon) {
    const sel = document.createElement('select');
    sel.style.cssText = 'width:100%;margin-top:2px;';
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '— Select icon —';
    sel.appendChild(blank);
    ICON_OPTIONS.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === currentIcon) opt.selected = true;
        sel.appendChild(opt);
    });
    return sel;
}

function buildSwatches(wrap, hiddenInput, currentColor) {
    wrap.querySelectorAll('.color-swatch').forEach(s => s.remove());
    const norm = c => (c || '').toLowerCase();
    PALETTE.forEach(([name, vivid, medium, pastel]) => {
        [vivid, medium, pastel].forEach(hex => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-swatch' + (norm(hex) === norm(currentColor) ? ' selected' : '');
            btn.dataset.color = hex;
            btn.style.background = hex;
            btn.setAttribute('aria-label', name);
            btn.addEventListener('click', () => {
                wrap.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                btn.classList.add('selected');
                hiddenInput.value = hex;
            });
            wrap.appendChild(btn);
        });
    });
}

function buildColorPalette(currentColor) {
    const wrap   = document.createElement('div');
    wrap.className = 'color-palette';
    const hidden = document.createElement('input');
    hidden.type  = 'hidden';
    hidden.className = 'edit-cat-color';
    hidden.value = currentColor || '';
    buildSwatches(wrap, hidden, currentColor);
    wrap.appendChild(hidden);
    return wrap;
}

function renderCategoryRow(li, cat) {
    li.innerHTML = `
        <span class="category-row-icon" style="color:${cat.color || 'inherit'};">
            <i data-lucide="${cat.icon_name || 'calendar'}"></i>
        </span>
        <span class="category-row-name">${cat.name}</span>
        <button type="button" class="category-edit-btn">Edit</button>
    `;
    li.querySelector('.category-edit-btn').addEventListener('click', () => openCategoryEditForm(li, cat));
}

function openCategoryEditForm(li, cat) {
    const nameInput = document.createElement('input');
    nameInput.type  = 'text';
    nameInput.value = cat.name;
    nameInput.placeholder = 'Category name';
    nameInput.style.cssText = 'width:100%;box-sizing:border-box;';

    const iconSelect   = buildIconSelect(cat.icon_name);
    const colorPalette = buildColorPalette(cat.color);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.className = 'save-btn';
    saveBtn.style.cssText = 'flex:1;padding:6px 12px;font-size:13px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText =
        'flex:1;padding:6px 12px;font-size:13px;background:transparent;' +
        'border:1px solid var(--border-color);border-radius:8px;cursor:pointer;' +
        'font-family:inherit;color:var(--text-muted);';

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;';
    btnRow.append(saveBtn, cancelBtn);

    const lbl = (text) => {
        const l = document.createElement('label');
        l.style.cssText = 'display:block;font-size:13px;font-weight:500;margin-bottom:2px;';
        l.textContent = text;
        return l;
    };

    const form = document.createElement('div');
    form.className = 'category-edit-form';
    form.append(lbl('Name'), nameInput, lbl('Icon'), iconSelect, lbl('Color'), colorPalette, btnRow);

    li.innerHTML = '';
    li.appendChild(form);

    saveBtn.addEventListener('click', async () => {
        const name  = nameInput.value.trim();
        const icon  = iconSelect.value;
        const color = colorPalette.querySelector('.edit-cat-color').value;
        if (!name)  { showMessage('Category name is required.', 'error'); return; }
        if (!icon)  { showMessage('Please select an icon.', 'error'); return; }
        if (!color) { showMessage('Please select a color.', 'error'); return; }

        saveBtn.disabled    = true;
        saveBtn.textContent = 'Saving…';

        const { data: updated, error } = await supabase
            .from('categories')
            .update({ name, icon_name: icon, color })
            .eq('id', cat.id)
            .select()
            .single();

        if (error) {
            saveBtn.disabled    = false;
            saveBtn.textContent = 'Save';
            showMessage('Failed to update category: ' + error.message, 'error');
            return;
        }

        const idx = categoriesData.findIndex(c => c.id === cat.id);
        if (idx !== -1) categoriesData[idx] = { ...categoriesData[idx], ...updated };

        renderCategoryRow(li, updated);
        lucide.createIcons({ nodes: [li] });
        showMessage('Category updated.', 'success');
    });

    cancelBtn.addEventListener('click', () => {
        renderCategoryRow(li, cat);
        lucide.createIcons({ nodes: [li] });
    });
}

async function renderCategoriesList() {
    const list = document.getElementById('categories-list');
    if (!list) return;

    const { data: cats, error } = await supabase
        .from('categories')
        .select('id, name, slug, icon_name, color')
        .order('name', { ascending: true });

    if (error) {
        list.innerHTML = `<li style="color:#c62828;padding:8px;font-size:13px;">Failed to load categories: ${error.message}</li>`;
        return;
    }

    list.innerHTML = '';
    (cats || []).forEach(cat => {
        const li = document.createElement('li');
        li.className = 'category-row';
        li.dataset.id = cat.id;
        renderCategoryRow(li, cat);
        list.appendChild(li);
    });
    lucide.createIcons();
}

function initCategoryPicker() {
    const wrap   = document.getElementById('new-category-color-palette');
    const hidden = document.getElementById('new-category-color');
    if (!wrap || !hidden) return;
    buildSwatches(wrap, hidden, null);
}

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
        opt.textContent = capitalizeWords(city.name);
        eventCitySelect.appendChild(opt);
    });
    const newCityOpt = document.createElement('option');
    newCityOpt.value       = 'NEW';
    newCityOpt.textContent = '-- Add New City --';
    eventCitySelect.appendChild(newCityOpt);
}

await loadDropdowns();
initCategoryPicker();
renderCategoriesList();

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

// ── Recurrence toggle ─────────────────────────────────────────────────────────
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

// ── Publish handler ───────────────────────────────────────────────────────────
saveEventBtn.addEventListener('click', async () => {
    clearMessage();

    // Validate required fields
    const fields = [
        ['event-title',       'Event Title'],
        ['event-date',        'Date'],
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
        const name      = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const iconName  = document.getElementById('new-category-icon')?.value || '';
        const color     = document.getElementById('new-category-color')?.value || '';
        if (!iconName) {
            document.getElementById('new-category-icon')?.focus();
            showMessage('Please select an icon for the new category.', 'error');
            return;
        }
        if (!color) {
            showMessage('Please select a color for the new category.', 'error');
            return;
        }
        const { data: newCat, error: catErr } = await supabase
            .from('categories')
            .insert([{ name, slug: toSlug(name), icon_name: iconName, color }])
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

    // Recurrence
    const isRecurring    = document.getElementById('recurring-checkbox').checked;
    const recurrenceType = isRecurring ? (document.getElementById('recurrence-type').value || null) : null;
    if (isRecurring && !recurrenceType) {
        showMessage('Please select how this event repeats.', 'error');
        return;
    }
    let recurrenceDay = null;
    if (isRecurring && recurrenceType === 'weekly') {
        recurrenceDay = parseInt(document.getElementById('recurrence-day-weekly').value, 10);
    } else if (isRecurring && recurrenceType === 'monthly') {
        recurrenceDay = parseInt(document.getElementById('recurrence-day-monthly').value, 10);
    }
    const recurrenceEndDate = isRecurring ? (document.getElementById('recurrence-end-date').value || null) : null;
    const recurrenceNote    = isRecurring ? (document.getElementById('recurrence-note').value.trim() || null) : null;

    const { error } = await createEvent({
        title:               vals['event-title'],
        description:         vals['event-description'],
        event_date:          vals['event-date'],
        event_time:          document.getElementById('event-time').value.trim() || null,
        location:            vals['event-location'],
        address:             document.getElementById('event-address').value.trim() || null,
        price:               vals['event-price'],
        image_url,
        category_id:         categoryId,
        city_id:             cityId,
        status:              'published',
        base_going:          Math.floor(Math.random() * 50) + 1,
        recurrence_type:     recurrenceType,
        recurrence_day:      recurrenceDay,
        recurrence_end_date: recurrenceEndDate,
        recurrence_note:     recurrenceNote,
    });

    saveEventBtn.disabled    = false;
    saveEventBtn.textContent = 'Publish Event';

    if (error) {
        showMessage('Failed to publish event: ' + error.message, 'error');
        return;
    }

    showMessage('Event published!', 'success');

    // Reset form
    ['event-title', 'event-date', 'event-time', 'event-location', 'event-address',
     'event-price', 'event-description', 'event-image-file',
     'new-category-name', 'new-city-name',
     'recurrence-type', 'recurrence-end-date', 'recurrence-note'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('recurring-checkbox').checked            = false;
    document.getElementById('recurrence-fields').style.display       = 'none';
    document.getElementById('recurrence-day-weekly-wrap').style.display  = 'none';
    document.getElementById('recurrence-day-monthly-wrap').style.display = 'none';
    newCategoryGroup.style.display = 'none';
    newCityGroup.style.display     = 'none';
    const iconSel = document.getElementById('new-category-icon');
    if (iconSel) iconSel.selectedIndex = 0;
    const colorInput = document.getElementById('new-category-color');
    if (colorInput) colorInput.value = '';
    document.getElementById('new-category-color-palette')
        ?.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    await loadDropdowns();
});
