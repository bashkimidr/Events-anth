// Initialize Icons
lucide.createIcons();

// Elements
const eventCategorySelect = document.getElementById('event-category');
const newCategoryGroup = document.getElementById('new-category-group');
const newCategoryName = document.getElementById('new-category-name');
const eventCitySelect = document.getElementById('event-city');
const newCityGroup = document.getElementById('new-city-group');
const newCityName = document.getElementById('new-city-name');
const saveEventBtn = document.getElementById('save-event');

let categoriesData = JSON.parse(localStorage.getItem('app_categoriesData')) || ['Sports', 'Education', 'Music', 'Entertainment'];

// Category Selector Logic
eventCategorySelect.addEventListener('change', (e) => {
    if (e.target.value === 'NEW') {
        newCategoryGroup.style.display = 'block';
    } else {
        newCategoryGroup.style.display = 'none';
        newCategoryName.value = '';
    }
});

// Sync Select Dropdown with categories currently in storage
function syncCategoryDropdown() {
    // Clear all existing options except the last "NEW" one
    while (eventCategorySelect.options.length > 1) {
        eventCategorySelect.remove(0);
    }
    categoriesData.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        // Insert right before the "NEW" option
        eventCategorySelect.insertBefore(opt, eventCategorySelect.lastElementChild);
    });
    eventCategorySelect.value = categoriesData[0] || 'NEW';
}
syncCategoryDropdown();

// City Selector Logic
eventCitySelect.addEventListener('change', (e) => {
    if (e.target.value === 'NEW') {
        newCityGroup.style.display = 'block';
    } else {
        newCityGroup.style.display = 'none';
        newCityName.value = '';
    }
});

function syncCityDropdown() {
    while (eventCitySelect.options.length > 1) {
        eventCitySelect.remove(0);
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
        eventCitySelect.insertBefore(opt, eventCitySelect.lastElementChild);
    });

    if (citiesArray.length > 0) {
        eventCitySelect.value = citiesArray[0];
    } else {
        eventCitySelect.value = 'NEW';
        newCityGroup.style.display = 'block';
    }
}
syncCityDropdown();

saveEventBtn.addEventListener('click', async () => {
    const title = document.getElementById('event-title').value.trim();
    let category = eventCategorySelect.value;
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const location = document.getElementById('event-location').value.trim();
    let city = eventCitySelect.value;
    if (city === 'NEW') {
        const custom = newCityName.value.trim();
        if (!custom) {
            alert('Please enter a new city name.');
            return;
        }
        city = custom.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    const price = document.getElementById('event-price').value.trim();
    const description = document.getElementById('event-description').value.trim();

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

    if (category === 'NEW') {
        const newCatVal = newCategoryName.value.trim();
        if(!newCatVal) {
            alert('Please enter a name for the new category.');
            return;
        }
        category = newCatVal.charAt(0).toUpperCase() + newCatVal.slice(1);

        if(!categoriesData.includes(category)) {
            categoriesData.push(category);
            localStorage.setItem('app_categoriesData', JSON.stringify(categoriesData));
        }
    }

    if(!title || !date || !time || !location || !city) {
        alert('Please fill out Title, City, Date, Time, and Location');
        return;
    }

    let events = JSON.parse(localStorage.getItem('app_events')) || [];

    const newEvent = {
        id: (events.length > 0 ? Math.max(...events.map(e => e.id)) : 0) + 1,
        title,
        category,
        date,
        time,
        location,
        city,
        price,
        description,
        baseGoing: Math.floor(Math.random() * 50) + 1,
        image
    };

    events.push(newEvent);
    localStorage.setItem('app_events', JSON.stringify(events));

    alert('Event successfully published into the system!');

    document.getElementById('event-title').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-time').value = '';
    document.getElementById('event-location').value = '';
    document.getElementById('event-price').value = '';
    document.getElementById('event-description').value = '';
    document.getElementById('event-image-file').value = '';

    newCategoryGroup.style.display = 'none';
    newCityGroup.style.display = 'none';
    newCategoryName.value = '';
    newCityName.value = '';
    syncCategoryDropdown();
    syncCityDropdown();
});
