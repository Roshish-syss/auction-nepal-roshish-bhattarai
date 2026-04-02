export function getPropertyMapCoords(property) {
  const c = property?.location?.coordinates;
  if (!c) {
    return { hasMapCoords: false, lat: null, lng: null };
  }
  const lat = Number(c.latitude);
  const lng = Number(c.longitude);
  const hasMapCoords = Number.isFinite(lat) && Number.isFinite(lng);
  return { hasMapCoords, lat, lng };
}

export function getPropertyAddressLine(property) {
  if (!property?.location) return '';
  const { address, city, district, province } = property.location;
  return [address, city, district, province].filter(Boolean).join(', ');
}

export function getOsmSearchUrlForProperty(property) {
  const line = getPropertyAddressLine(property);
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(line || 'Nepal')}`;
}
