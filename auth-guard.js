import { getCurrentUserWithAdminFlag, signOut } from './db.js';

export async function requireAdmin({ redirect = '/login.html' } = {}) {
    const { user, isAdmin } = await getCurrentUserWithAdminFlag();

    if (!user) {
        window.location.replace(redirect + '?next=' + encodeURIComponent(window.location.pathname));
        return new Promise(() => {});
    }

    if (!isAdmin) {
        document.body.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                        min-height:100vh;font-family:Inter,sans-serif;gap:16px;padding:24px;text-align:center;">
                <p style="font-size:16px;color:#333;margin:0;">
                    You're signed in but not authorized to view this page.
                </p>
                <button id="unauth-signout-btn"
                        style="padding:8px 24px;border:none;border-radius:8px;
                               background:#e53935;color:#fff;cursor:pointer;font-size:14px;">
                    Sign Out
                </button>
            </div>`;
        document.getElementById('unauth-signout-btn').addEventListener('click', async () => {
            await signOut();
            window.location.replace('/login.html');
        });
        return new Promise(() => {});
    }

    return user;
}

export function attachSignOutButton(selector) {
    const btn = document.querySelector(selector);
    if (!btn) return;
    btn.addEventListener('click', async () => {
        await signOut();
        window.location.replace('/login.html');
    });
}
