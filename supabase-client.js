import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = window.__ENV;

const PLACEHOLDER = 'PASTE_YOUR_PUBLISHABLE_KEY_HERE';

function makeDummyClient() {
    const reject = () => Promise.resolve({ data: null, error: new Error('Supabase client not configured — check public-config.js and .env') });
    return {
        from: () => ({ select: reject, insert: reject, update: reject, delete: reject }),
        auth: { getSession: reject }
    };
}

if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    console.error('[supabase-client] window.__ENV is missing. Make sure public-config.js is loaded before this module.');
}

if (env && env.SUPABASE_PUBLISHABLE_KEY === PLACEHOLDER) {
    console.error('[supabase-client] SUPABASE_PUBLISHABLE_KEY is still the placeholder value. Replace it in .env and re-run npm start.');
}

const isConfigured = env &&
    env.SUPABASE_URL &&
    env.SUPABASE_PUBLISHABLE_KEY &&
    env.SUPABASE_PUBLISHABLE_KEY !== PLACEHOLDER;

export const supabase = isConfigured
    ? createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY)
    : makeDummyClient();
