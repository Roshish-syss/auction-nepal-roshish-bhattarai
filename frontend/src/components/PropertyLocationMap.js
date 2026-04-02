import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

const PropertyLocationMap = ({
  lat,
  lng,
  title,
  addressLine,
  height = 400,
  className = 'property-detail-leaflet-map'
}) => {
  const position = [lat, lng];

  return (
    <MapContainer
      center={position}
      zoom={15}
      scrollWheelZoom
      style={{ height, width: '100%' }}
      className={className}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position} icon={pinIcon}>
        <Popup>
          {title && <strong>{title}</strong>}
          {addressLine && (
            <div style={{ marginTop: title ? 8 : 0, maxWidth: 220 }}>{addressLine}</div>
          )}
        </Popup>
      </Marker>
    </MapContainer>
  );
};

export default PropertyLocationMap;
