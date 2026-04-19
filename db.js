import { supabase } from './supabase-client.js';

// ─── Slug helpers ─────────────────────────────────────────────────────────────

function toSlug(text) {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function generateSlug(title) {
    const suffix = Math.random().toString(36).slice(2, 7);
    return toSlug(title) + '-' + suffix;
}

// ─── Public: home page ────────────────────────────────────────────────────────

export async function fetchPublishedEvents() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('events')
        .select('*, cities(name, slug), categories(name, slug, icon_name)')
        .eq('status', 'published')
        .gte('event_date', today)
        .order('event_date', { ascending: true });
    return { data, error };
}

export async function fetchCities() {
    const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name', { ascending: true });
    return { data, error };
}

export async function fetchCategories() {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
    return { data, error };
}

export async function submitEventRequest(payload) {
    const { data, error } = await supabase
        .from('event_submissions')
        .insert([{
            title:           payload.title,
            description:     payload.description,
            category_name:   payload.category_name,
            city_name:       payload.city_name,
            event_date:      payload.event_date,
            event_time:      payload.event_time,
            location:        payload.location,
            price:           payload.price,
            image_url:       payload.image_url,
            submitter_email: payload.submitter_email,
            submitter_phone: payload.submitter_phone,
            status:          'pending'
        }]);
    return { data, error };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { data: session, error };
}

export async function getCurrentUserWithAdminFlag() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { user: null, isAdmin: false };
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
    return { user, isAdmin: !!(profile?.is_admin) };
}

// ─── Admin: events CRUD ───────────────────────────────────────────────────────

export async function fetchAllEvents() {
    const { data, error } = await supabase
        .from('events')
        .select('*, cities(name, slug), categories(name, slug, icon_name)')
        .order('event_date', { ascending: false });
    return { data, error };
}

export async function fetchEventById(id) {
    const { data, error } = await supabase
        .from('events')
        .select('*, cities(name, slug), categories(name, slug, icon_name)')
        .eq('id', id)
        .single();
    return { data, error };
}

export async function createEvent(payload) {
    const slug = payload.slug || generateSlug(payload.title);
    const { data, error } = await supabase
        .from('events')
        .insert([{ ...payload, slug }])
        .select()
        .single();
    return { data, error };
}

export async function updateEvent(id, patch) {
    const { data, error } = await supabase
        .from('events')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
    return { data, error };
}

export async function deleteEvent(id) {
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);
    return { error };
}

// ─── Admin: submissions ───────────────────────────────────────────────────────

export async function fetchPendingSubmissions() {
    const { data, error } = await supabase
        .from('event_submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
    return { data, error };
}

export async function approveSubmission(submissionId) {
    // 1. Read submission
    const { data: sub, error: subErr } = await supabase
        .from('event_submissions')
        .select('*')
        .eq('id', submissionId)
        .single();
    if (subErr) return { data: null, error: subErr };

    // 2. Resolve or create city
    let cityId;
    const { data: existingCity } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', sub.city_name.trim())
        .single();
    if (existingCity) {
        cityId = existingCity.id;
    } else {
        const { data: newCity, error: cityErr } = await supabase
            .from('cities')
            .insert([{ name: sub.city_name.trim(), slug: toSlug(sub.city_name) }])
            .select()
            .single();
        if (cityErr) return { data: null, error: cityErr };
        cityId = newCity.id;
    }

    // 3. Resolve or create category
    let categoryId;
    const { data: existingCat } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', sub.category_name.trim())
        .single();
    if (existingCat) {
        categoryId = existingCat.id;
    } else {
        const { data: newCat, error: catErr } = await supabase
            .from('categories')
            .insert([{ name: sub.category_name.trim(), slug: toSlug(sub.category_name) }])
            .select()
            .single();
        if (catErr) return { data: null, error: catErr };
        categoryId = newCat.id;
    }

    // 4. Insert published event
    const { data: newEvent, error: eventErr } = await supabase
        .from('events')
        .insert([{
            title:       sub.title,
            description: sub.description,
            event_date:  sub.event_date,
            event_time:  sub.event_time,
            location:    sub.location,
            price:       sub.price,
            image_url:   sub.image_url,
            city_id:     cityId,
            category_id: categoryId,
            status:      'published',
            slug:        generateSlug(sub.title),
            base_going:  Math.floor(Math.random() * 30) + 1,
        }])
        .select()
        .single();
    if (eventErr) return { data: null, error: eventErr };

    // 5. Mark submission approved
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateErr } = await supabase
        .from('event_submissions')
        .update({
            status:      'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user?.id ?? null,
        })
        .eq('id', submissionId);
    if (updateErr) return { data: null, error: updateErr };

    return { data: newEvent, error: null };
}

export async function rejectSubmission(submissionId, reason) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('event_submissions')
        .update({
            status:        'rejected',
            reject_reason: reason,
            reviewed_at:   new Date().toISOString(),
            reviewed_by:   user?.id ?? null,
        })
        .eq('id', submissionId)
        .select()
        .single();
    return { data, error };
}

// ─── Admin: image upload ──────────────────────────────────────────────────────

export async function uploadEventImage(file) {
    const ext  = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const { error } = await supabase.storage
        .from('event-images')
        .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) return { data: null, error };
    const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(path);
    return { data: { publicUrl, path }, error: null };
}
