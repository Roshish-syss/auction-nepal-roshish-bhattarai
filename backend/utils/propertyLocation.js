/**
 * Normalize location payload from admin API (JSON) for Property.location
 */
function normalizePropertyLocation(loc) {
  if (!loc || typeof loc !== 'object') {
    return null;
  }

  const out = {
    address: String(loc.address || '').trim(),
    city: String(loc.city || '').trim(),
    district: loc.district ? String(loc.district).trim() : undefined,
    province: loc.province ? String(loc.province).trim() : undefined
  };

  if (loc.coordinates === null) {
    return out;
  }

  if (loc.coordinates && typeof loc.coordinates === 'object') {
    const lat = Number(loc.coordinates.latitude);
    const lng = Number(loc.coordinates.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.coordinates = { latitude: lat, longitude: lng };
    }
  }

  return out;
}

module.exports = { normalizePropertyLocation };
