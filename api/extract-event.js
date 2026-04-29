export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let url;
  try {
    const body = req.body || {};
    url = (body.url || '').trim();
    if (!url) throw new Error('URL required');
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http(s) URLs supported');
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventeriaBot/1.0; +https://eventeria.app)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!pageRes.ok) {
      return res.status(400).json({ error: `Source returned ${pageRes.status}` });
    }
    const html = await pageRes.text();

    const extracted = extractEventData(html, url);

    if (extracted.imageUrl) {
      try {
        const imgController = new AbortController();
        const imgTimeout = setTimeout(() => imgController.abort(), 8000);
        const imgRes = await fetch(extracted.imageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EventeriaBot/1.0)' },
          signal: imgController.signal,
        });
        clearTimeout(imgTimeout);

        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
          if (allowed.some(t => contentType.includes(t))) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf.length < 3 * 1024 * 1024) {
              extracted.imageBase64 = `data:${contentType};base64,${buf.toString('base64')}`;
            }
          }
        }
      } catch (e) {
        extracted.imageError = e.message;
      }
    }

    return res.status(200).json(extracted);
  } catch (err) {
    console.error('[extract-event] error:', err);
    return res.status(500).json({ error: err.message || 'Extraction failed' });
  }
}

function extractEventData(html, sourceUrl) {
  const result = {
    title: null,
    description: null,
    eventDate: null,
    eventTime: null,
    location: null,
    address: null,
    price: null,
    imageUrl: null,
    sourceUrl,
    sourceMethod: null,
  };

  // 1. JSON-LD Event schema
  const ldMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const ld of ldMatches) {
    try {
      const jsonText = ld.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      const parsed = JSON.parse(jsonText);
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
      for (const item of items) {
        const type = item['@type'];
        const isEvent =
          type === 'Event' ||
          (Array.isArray(type) && type.includes('Event')) ||
          (typeof type === 'string' && type.endsWith('Event'));
        if (!isEvent) continue;

        if (item.name)        result.title       = item.name;
        if (item.description) result.description = item.description;

        if (item.startDate) {
          const d = new Date(item.startDate);
          if (!isNaN(d)) {
            result.eventDate = d.toISOString().slice(0, 10);
            if (item.startDate.includes('T')) {
              result.eventTime = d.toTimeString().slice(0, 5);
            }
          }
        }

        if (item.location) {
          const loc = Array.isArray(item.location) ? item.location[0] : item.location;
          if (loc) {
            result.location = loc.name || (typeof loc === 'string' ? loc : null);
            if (loc.address) {
              if (typeof loc.address === 'string') {
                result.address = loc.address;
              } else {
                const a = loc.address;
                result.address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode]
                  .filter(Boolean).join(', ');
              }
            }
          }
        }

        if (item.image) {
          result.imageUrl = Array.isArray(item.image)
            ? item.image[0]
            : (typeof item.image === 'string' ? item.image : item.image?.url || null);
        }

        if (item.offers) {
          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          if (offer?.price != null)     result.price = String(offer.price);
          else if (offer?.lowPrice != null) result.price = String(offer.lowPrice);
        }

        if (result.title) {
          result.sourceMethod = 'json-ld';
          return result;
        }
      }
    } catch (e) {
      // malformed JSON-LD, try next block
    }
  }

  // 2. OpenGraph + meta fallback
  const ogMatch = prop => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
      'i'
    );
    const m = html.match(re);
    if (m) return m[1];
    // also try content-first order
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
      'i'
    );
    const m2 = html.match(re2);
    return m2 ? m2[1] : null;
  };
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  result.title       = ogMatch('og:title') || (titleMatch ? titleMatch[1].trim() : null);
  result.description = ogMatch('og:description') || ogMatch('description');
  result.imageUrl    = ogMatch('og:image');

  if (result.title) result.sourceMethod = 'opengraph';
  return result;
}
