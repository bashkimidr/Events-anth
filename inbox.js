// Initialize Icons
lucide.createIcons();

// Inbox Render Logic
const requestedEventsContainer = document.getElementById('requested-events-container');

function renderRequestedEvents() {
    let requests;
    try {
        requests = JSON.parse(localStorage.getItem('app_requested_events'));
    } catch(e) {}
    if (!Array.isArray(requests)) requests = [];
    requestedEventsContainer.innerHTML = '';
    
    if (requests.length === 0) {
        requestedEventsContainer.innerHTML = '<p style="color: var(--text-muted); text-align:center;">No pending requests.</p>';
        return;
    }
    
    requests.forEach(req => {
        const card = document.createElement('div');
        card.style.background = 'var(--bg-color)';
        card.style.padding = '16px';
        card.style.borderRadius = 'var(--card-radius)';
        card.style.border = '1px solid lightgray';
        card.style.marginBottom = '16px';
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div style="flex: 1;">
                    <h3 style="margin:0 0 4px 0; font-size:16px;">${req.title} <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(${req.category})</span></h3>
                    <p style="margin:0; font-size:13px; color:var(--text-muted);">${req.date} &bull; ${req.time} &bull; ${req.location}, ${req.city}</p>
                    <p style="margin:6px 0 0 0; font-size:13px;"><strong>Contact:</strong> ${req.email} | ${req.phone}</p>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px; margin-left: 12px;">
                    <button class="approve-btn" data-id="${req.id}" style="background:#4caf50; color:white; border:none; padding:6px 12px; border-radius:12px; cursor:pointer;">Approve</button>
                    <button class="deny-btn" data-id="${req.id}" style="background:#f44336; color:white; border:none; padding:6px 12px; border-radius:12px; cursor:pointer;">Deny</button>
                </div>
            </div>
            <button class="view-btn" data-id="${req.id}" style="background: transparent; color: var(--accent-color); border: 1px solid var(--accent-color); padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; margin-bottom: 8px;">View Event Details</button>
            <div id="details-${req.id}" style="display: none; border-top: 1px dashed var(--border-color); padding-top: 12px; margin-top: 8px;">
                ${req.image ? `<img src="${req.image}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-bottom: 12px; object-fit: cover;">` : ''}
                <p style="margin:0 0 6px 0; font-size:13px;"><strong>Price:</strong> ${req.price || 'Not specified'}</p>
                <p style="margin:0; font-size:13px; line-height: 1.4;"><strong>Description:</strong><br>${req.description || 'No description provided.'}</p>
            </div>
        `;
        requestedEventsContainer.appendChild(card);
    });
    
    // Attach buttons
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const reqId = parseInt(e.target.getAttribute('data-id'));
            approveRequest(reqId);
        });
    });
    document.querySelectorAll('.deny-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const reqId = parseInt(e.target.getAttribute('data-id'));
            denyRequest(reqId);
        });
    });
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const reqId = e.target.getAttribute('data-id');
            const detailsDiv = document.getElementById(`details-${reqId}`);
            if (detailsDiv.style.display === 'none') {
                detailsDiv.style.display = 'block';
                e.target.innerText = 'Hide Event Details';
            } else {
                detailsDiv.style.display = 'none';
                e.target.innerText = 'View Event Details';
            }
        });
    });
}

function approveRequest(reqId) {
    let requests;
    try {
        requests = JSON.parse(localStorage.getItem('app_requested_events'));
    } catch(e) {}
    if (!Array.isArray(requests)) requests = [];
    const index = requests.findIndex(r => r.id === reqId);
    if (index === -1) return;
    
    const req = requests[index];
    
    // push to master
    let events = JSON.parse(localStorage.getItem('app_events')) || [];
    const newEvent = {
        id: (events.length > 0 ? Math.max(...events.map(e => e.id)) : 0) + 1,
        title: req.title,
        category: req.category,
        date: req.date,
        time: req.time,
        location: req.location,
        city: req.city,
        price: req.price || '',
        description: req.description || '',
        baseGoing: Math.floor(Math.random() * 50) + 1,
        image: req.image
    };
    events.push(newEvent);
    localStorage.setItem('app_events', JSON.stringify(events));
    
    // remove from inbox
    requests.splice(index, 1);
    localStorage.setItem('app_requested_events', JSON.stringify(requests));
    
    renderRequestedEvents();
    alert('Request approved and published!');
}

function denyRequest(reqId) {
    if(!confirm("Are you sure you want to deny this request?")) return;
    let requests;
    try {
        requests = JSON.parse(localStorage.getItem('app_requested_events'));
    } catch(e) {}
    if (!Array.isArray(requests)) requests = [];
    const index = requests.findIndex(r => r.id === reqId);
    if (index === -1) return;
    
    requests.splice(index, 1);
    localStorage.setItem('app_requested_events', JSON.stringify(requests));
    renderRequestedEvents();
}

renderRequestedEvents();
