import { supabase } from './supabase-client.js';

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
