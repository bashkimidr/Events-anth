import { requireAdmin, attachSignOutButton } from './auth-guard.js';
import { fetchPendingSubmissions, approveSubmission } from './db.js';
import { supabase } from './supabase-client.js';

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

// ── Image helpers ─────────────────────────────────────────────────────────────
function dataUrlToBlob(dataUrl) {
    const arr       = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime      = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr      = atob(arr[1]);
    const u8        = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
    return new Blob([u8], { type: mime });
}

function slugifyTitle(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
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

        const fmtTime        = sub.event_time && window.formatTimeShort ? window.formatTimeShort(sub.event_time) : sub.event_time;
        const dateLabel      = [sub.event_date, fmtTime].filter(Boolean).join(' · ');
        const locLabel       = [sub.location, sub.city_name].filter(Boolean).join(', ');
        const recurrenceText = window.formatRecurrenceText ? window.formatRecurrenceText(sub) : null;

        const inlineImageHtml = (sub.pending_image_data && sub.pending_image_data.length > 0)
            ? `<img src="${sub.pending_image_data}"
                    style="max-width:100%;max-height:300px;border-radius:8px;
                           margin:12px 0;object-fit:contain;display:block;">`
            : '';

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
                        <strong>Contact:</strong> ${sub.submitter_email || '—'}
                    </p>
                    ${recurrenceText ? `<p style="margin:4px 0 0;font-size:13px;"><strong>Recurs:</strong> ${recurrenceText}</p>` : ''}
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

            ${inlineImageHtml}

            <button class="details-btn"
                style="margin-top:10px;background:transparent;color:var(--accent-color);
                       border:1px solid var(--accent-color);padding:4px 12px;border-radius:6px;
                       cursor:pointer;font-size:13px;font-family:inherit;">
                View Details
            </button>

            <div class="details-panel" style="display:none;border-top:1px dashed var(--border-color);
                                               padding-top:12px;margin-top:10px;">
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

        // ── Approve ───────────────────────────────────────────────────────────
        card.querySelector('.approve-btn').addEventListener('click', async (e) => {
            if (!confirm('Approve and publish this event?')) return;

            const btn = e.currentTarget;
            btn.disabled    = true;
            btn.textContent = 'Approving…';

            try {
                // 1. Upload image to Storage if pending_image_data exists
                let imageUrl = null;
                if (sub.pending_image_data && sub.pending_image_data.length > 0) {
                    const blob     = dataUrlToBlob(sub.pending_image_data);
                    const filename = `${Date.now()}_${slugifyTitle(sub.title)}.jpg`;
                    const { error: uploadErr } = await supabase.storage
                        .from('event-images')
                        .upload(filename, blob, { contentType: 'image/jpeg' });
                    if (uploadErr) throw new Error('Image upload failed: ' + uploadErr.message);
                    const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(filename);
                    imageUrl = urlData.publicUrl;
                }

                // 2. Create event (resolves city/category, inserts published event)
                const { data: newEvent, error: approveErr } = await approveSubmission(sub.id);
                if (approveErr) throw new Error('Approval failed: ' + approveErr.message);

                // 3. Patch image_url and recurrence fields onto the newly-created event
                const patch = {};
                if (imageUrl) patch.image_url = imageUrl;
                if (sub.recurrence_type) {
                    patch.recurrence_type     = sub.recurrence_type;
                    patch.recurrence_day      = sub.recurrence_day      ?? null;
                    patch.recurrence_end_date = sub.recurrence_end_date ?? null;
                    patch.recurrence_note     = sub.recurrence_note     ?? null;
                }
                if (Object.keys(patch).length > 0 && newEvent) {
                    const { error: patchErr } = await supabase
                        .from('events').update(patch).eq('id', newEvent.id);
                    if (patchErr) throw new Error('Event patch failed: ' + patchErr.message);
                }

                // 4. Delete submission row — only after all DB steps confirmed
                const { error: deleteErr } = await supabase
                    .from('event_submissions').delete().eq('id', sub.id);
                if (deleteErr) throw new Error('Submission delete failed: ' + deleteErr.message);

                document.getElementById(`sub-card-${sub.id}`)?.remove();
                showToast('Approved and published.', 'success');
                if (!container.children.length) renderSubmissions([]);

            } catch (err) {
                console.error('[inbox] approve error:', err);
                btn.disabled    = false;
                btn.textContent = 'Approve';
                showToast(err.message, 'error');
            }
        });

        // ── Reject ────────────────────────────────────────────────────────────
        card.querySelector('.reject-btn').addEventListener('click', async (e) => {
            if (!confirm('Reject and delete this submission?')) return;

            const btn = e.currentTarget;
            btn.disabled    = true;
            btn.textContent = 'Rejecting…';

            // Delete submission row — no Storage ops needed (image never left the DB)
            const { error } = await supabase.from('event_submissions').delete().eq('id', sub.id);
            if (error) {
                btn.disabled    = false;
                btn.textContent = 'Reject';
                showToast('Rejection failed: ' + error.message, 'error');
                return;
            }

            document.getElementById(`sub-card-${sub.id}`)?.remove();
            showToast('Submission deleted.', 'success');
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
