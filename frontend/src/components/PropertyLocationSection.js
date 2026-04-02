import React from 'react';
import PropertyLocationMap from './PropertyLocationMap';
import './PropertyLocationSection.css';
import { getPropertyMapCoords, getPropertyAddressLine, getOsmSearchUrlForProperty } from '../utils/propertyMap';
import { FaMapMarkedAlt } from 'react-icons/fa';

/**
 * Address line + Leaflet map (or OSM search fallback) for property/auction UIs.
 */
const PropertyLocationSection = ({
  property,
  heading = 'Location',
  mapHeight = 240,
  mapClassName = 'property-inline-leaflet-map'
}) => {
  if (!property?.location) return null;

  const { hasMapCoords, lat, lng } = getPropertyMapCoords(property);
  const addressLine = getPropertyAddressLine(property);

  return (
    <div className="property-location-section">
      {heading && <h3 className="property-location-section-title">{heading}</h3>}
      <p className="property-location-section-address">{addressLine || 'Address not set'}</p>
      {hasMapCoords ? (
        <div className="property-location-section-map-wrap">
          <PropertyLocationMap
            lat={lat}
            lng={lng}
            title={property.title}
            addressLine={addressLine}
            height={mapHeight}
            className={mapClassName}
          />
        </div>
      ) : (
        <div className="property-location-section-fallback">
          <FaMapMarkedAlt className="property-location-section-fallback-icon" aria-hidden />
          <a
            href={getOsmSearchUrlForProperty(property)}
            target="_blank"
            rel="noopener noreferrer"
            className="property-location-section-osm-link"
          >
            View area on OpenStreetMap
          </a>
        </div>
      )}
    </div>
  );
};

export default PropertyLocationSection;
