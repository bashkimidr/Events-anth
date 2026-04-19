const GEO_CACHE_KEY     = 'geoCache';
const CITY_OVERRIDE_KEY = 'userCityOverride';
const GEO_TIMEOUT_MS    = 2500;
const MAX_DISTANCE_KM   = 500;

export async function getVisitorLocation() {
    // localStorage override takes priority — user manually selected a city
    const override = localStorage.getItem(CITY_OVERRIDE_KEY);
    if (override) return { overrideCity: override };

    // sessionStorage cache avoids repeat API calls within the same tab session
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
        try { return JSON.parse(cached); } catch (_) { /* corrupted cache, fall through */ }
    }

    try {
        const controller = new AbortController();
        const timer      = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
        const res        = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) return null;
        const data     = await res.json();
        const location = { lat: data.latitude, lon: data.longitude, city: data.city || '' };
        sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(location));
        return location;
    } catch (_) {
        return null;
    }
}

export function setUserCityOverride(cityName) {
    localStorage.setItem(CITY_OVERRIDE_KEY, cityName);
}

export function clearUserCityOverride() {
    localStorage.removeItem(CITY_OVERRIDE_KEY);
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2
               + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
               * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

// Returns the nearest city object (must have .lat and .lon fields) within MAX_DISTANCE_KM,
// or null if no city qualifies. Cities without coordinates are skipped.
export function findNearestCity(location, cities) {
    if (!location?.lat || !location?.lon) return null;

    let nearest = null;
    let minDist = Infinity;

    for (const city of cities) {
        if (city.lat == null || city.lon == null) continue;
        const dist = haversineKm(location.lat, location.lon, city.lat, city.lon);
        if (dist < minDist) { minDist = dist; nearest = city; }
    }

    return minDist <= MAX_DISTANCE_KM ? nearest : null;
}
