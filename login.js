import { signIn, signOut, getCurrentUserWithAdminFlag } from './db.js';

const emailInput  = document.getElementById('login-email');
const passInput   = document.getElementById('login-password');
const loginBtn    = document.getElementById('login-btn');
const errorBox    = document.getElementById('login-error');

function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const next   = params.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) return next;
    return '/admin.html';
}

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
}

function clearError() {
    errorBox.style.display = 'none';
    errorBox.textContent   = '';
}

// If already signed in and admin, skip the login form
async function checkExistingSession() {
    const { user, isAdmin } = await getCurrentUserWithAdminFlag();
    if (user && isAdmin) {
        window.location.replace(getRedirectTarget());
    }
}
checkExistingSession();

loginBtn.addEventListener('click', async () => {
    clearError();

    const email    = emailInput.value.trim();
    const password = passInput.value;

    if (!email || !password) {
        showError('Please enter your email and password.');
        return;
    }

    loginBtn.disabled    = true;
    loginBtn.textContent = 'Signing in…';

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
        loginBtn.disabled    = false;
        loginBtn.textContent = 'Sign In';
        showError('Invalid email or password.');
        return;
    }

    // Verify the signed-in account has admin privileges
    const { user, isAdmin } = await getCurrentUserWithAdminFlag();

    if (!isAdmin) {
        await signOut();
        loginBtn.disabled    = false;
        loginBtn.textContent = 'Sign In';
        showError("Your account isn't an admin.");
        return;
    }

    // Success — redirect (user object no longer referenced after this point)
    void user;
    window.location.replace(getRedirectTarget());
});

// Allow submit on Enter key from either field
[emailInput, passInput].forEach(el => {
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });
});
