const axios = require('axios');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Forward geocode via OSM Nominatim (server-side only; respect usage policy).
 * Set GEOCODE_USER_AGENT in env to a string that identifies your app and contact.
 */
async function geocodeSearch(query) {
  const q = String(query || '').trim();
  if (q.length < 3) {
    const err = new Error('Query must be at least 3 characters');
    err.status = 400;
    throw err;
  }

  const userAgent =
    process.env.GEOCODE_USER_AGENT ||
    'AuctionNepal/1.0 (https://github.com/auctionnepal; geocode)';

  let data;
  try {
    const res = await axios.get(NOMINATIM_URL, {
      params: { format: 'json', limit: 1, q },
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json'
      },
      timeout: 12000,
      validateStatus: (s) => s === 200
    });
    data = res.data;
  } catch (e) {
    const err = new Error('Geocoding service unavailable');
    err.status = 502;
    throw err;
  }
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const hit = data[0];
  return {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    displayName: hit.display_name
  };
}

module.exports = { geocodeSearch };
