import { requireAdmin, attachSignOutButton } from './auth-guard.js';
import { fetchPendingSubmissions, approveSubmission, rejectSubmission } from './db.js';

// ── Auth gate ─────────────────────────────────────────────────────────────────
const currentUser = await requireAdmin();

lucide.createIcons();
attachSignOutButton('#signout-btn');
document.getElementById('admin-email').textContent = currentUser.email;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const container = document.getElementById('submissions-container');
const toast     = document.getElementById('page-toast');

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(text, type = 'success') {
    clearTimeout(toastTimer);
    toast.textContent   = text;
    toast.className     = type;
    toast.style.display = 'block';
    toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderSubmissions(submissions) {
    container.innerHTML = '';

    if (!submissions.length) {
        container.innerHTML =
            '<p style="color:var(--text-muted);text-align:center;padding:24px 0;">No pending submissions right now.</p>';
        return;
    }

    submissions.forEach(sub => {
        const card = document.createElement('div');
        card.id = `sub-card-${sub.id}`;
        card.style.cssText =
            'background:var(--bg-color);padding:16px;border-radius:var(--card-radius);' +
            'border:1px solid var(--border-color);';

        const dateLabel = [sub.event_date, sub.event_time].filter(Boolean).join(' · ');
        const locLabel  = [sub.location, sub.city_name].filter(Boolean).join(', ');

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                <div style="flex:1;min-width:0;">
                    <h3 style="margin:0 0 4px;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${sub.title}
                        <span style="font-size:12px;font-weight:400;color:var(--text-muted);margin-left:6px;">
                            ${sub.category_name || ''}
                        </span>
                    </h3>
                    <p style="margin:0 0 3px;font-size:13px;color:var(--text-muted);">
                        ${dateLabel}${locLabel ? ' &bull; ' + locLabel : ''}
                    </p>
                    <p style="margin:0;font-size:13px;">
                        <strong>Contact:</strong> ${sub.submitter_email || '—'} | ${sub.submitter_phone || '—'}
                    </p>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0;">
                    <button class="approve-btn"
                        style="background:#2e7d32;color:#fff;border:none;padding:6px 14px;
                               border-radius:12px;cursor:pointer;font-size:13px;font-family:inherit;">
                        Approve
                    </button>
                    <button class="reject-btn"
                        style="background:#c62828;color:#fff;border:none;padding:6px 14px;
                               border-radius:12px;cursor:pointer;font-size:13px;font-family:inherit;">
                        Reject
                    </button>
                </div>
            </div>

            <button class="details-btn"
                style="margin-top:10px;background:transparent;color:var(--accent-color);
                       border:1px solid var(--accent-color);padding:4px 12px;border-radius:6px;
                       cursor:pointer;font-size:13px;font-family:inherit;">
                View Details
            </button>

            <div class="details-panel" style="display:none;border-top:1px dashed var(--border-color);
                                               padding-top:12px;margin-top:10px;">
                ${sub.image_url
                    ? `<img src="${sub.image_url}"
                            style="max-width:100%;max-height:200px;border-radius:8px;
                                   margin-bottom:12px;object-fit:cover;">`
                    : ''}
                <p style="margin:0 0 6px;font-size:13px;">
                    <strong>Price:</strong> ${sub.price || 'Not specified'}
                </p>
                <p style="margin:0;font-size:13px;line-height:1.5;">
                    <strong>Description:</strong><br>
                    ${sub.description || 'No description provided.'}
                </p>
            </div>
        `;

        // Details toggle
        card.querySelector('.details-btn').addEventListener('click', (e) => {
            const panel = card.querySelector('.details-panel');
            const open  = panel.style.display === 'block';
            panel.style.display  = open ? 'none' : 'block';
            e.currentTarget.textContent = open ? 'View Details' : 'Hide Details';
        });

        // Approve
        card.querySelector('.approve-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled    = true;
            btn.textContent = 'Approving…';

            const { error } = await approveSubmission(sub.id);
            if (error) {
                btn.disabled    = false;
                btn.textContent = 'Approve';
                showToast('Approval failed: ' + error.message, 'error');
                return;
            }

            document.getElementById(`sub-card-${sub.id}`)?.remove();
            showToast('Approved and published.', 'success');
            if (!container.children.length) renderSubmissions([]);
        });

        // Reject
        card.querySelector('.reject-btn').addEventListener('click', async (e) => {
            const reason = prompt('Reason for rejection (required):')?.trim();
            if (!reason) return;

            const btn = e.currentTarget;
            btn.disabled    = true;
            btn.textContent = 'Rejecting…';

            const { error } = await rejectSubmission(sub.id, reason);
            if (error) {
                btn.disabled    = false;
                btn.textContent = 'Reject';
                showToast('Rejection failed: ' + error.message, 'error');
                return;
            }

            document.getElementById(`sub-card-${sub.id}`)?.remove();
            showToast('Submission rejected.', 'success');
            if (!container.children.length) renderSubmissions([]);
        });

        container.appendChild(card);
    });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    container.innerHTML =
        '<p style="color:var(--text-muted);text-align:center;padding:24px 0;">Loading submissions…</p>';

    const { data, error } = await fetchPendingSubmissions();

    if (error) {
        container.innerHTML =
            `<p style="color:#c62828;text-align:center;padding:24px 0;">
                Failed to load submissions: ${error.message}
             </p>`;
        return;
    }

    renderSubmissions(data || []);
    lucide.createIcons();
}

init();
