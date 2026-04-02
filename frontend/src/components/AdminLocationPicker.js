import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

const pinIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const DEFAULT_CENTER = [27.7172, 85.324];

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const z = map.getZoom();
      map.setView([lat, lng], z < 12 ? 15 : z, { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

/**
 * Pick or adjust property coordinates on an OSM/Leaflet map.
 */
const AdminLocationPicker = ({ latitude, longitude, onChange }) => {
  const lat = latitude !== '' && latitude != null ? Number(latitude) : NaN;
  const lng = longitude !== '' && longitude != null ? Number(longitude) : NaN;
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);

  const center = useMemo(() => (hasPin ? [lat, lng] : DEFAULT_CENTER), [hasPin, lat, lng]);
  const initialZoom = hasPin ? 15 : 7;

  const handlePick = (plat, plng) => {
    onChange(Number(plat.toFixed(6)), Number(plng.toFixed(6)));
  };

  return (
    <div className="admin-location-picker">
      <p className="admin-location-picker-hint">
        Click the map to place a pin, or drag the marker. You can also type latitude and longitude below. Use
        &quot;Look up from address&quot; after filling address fields.
      </p>
      <MapContainer
        center={center}
        zoom={initialZoom}
        scrollWheelZoom
        className="admin-location-picker-map"
        style={{ height: 280, width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onPick={handlePick} />
        {hasPin && <MapRecenter lat={lat} lng={lng} />}
        {hasPin && (
          <Marker
            position={[lat, lng]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                handlePick(p.lat, p.lng);
              }
            }}
          >
            <Popup>Property location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default AdminLocationPicker;
