import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import { FaCheck, FaClock, FaTimes, FaCog, FaBed, FaBath, FaRulerCombined, FaMapMarkerAlt } from 'react-icons/fa';
import {
  getAuctionEndDate,
  getAuctionStartDate,
  getAuctionRecordStatus
} from '../utils/auctionDisplay';
import './Auctions.css';

const Auctions = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    cities: [],
    districts: [],
    types: [],
    priceRange: { min: 0, max: 0 }
  });

  // Filters state
  const [filters, setFilters] = useState({
    search: '',
    location: '',
    city: '',
    district: '',
    type: '',
    minPrice: '',
    maxPrice: '',
    status: ''
  });

  const [sortBy, setSortBy] = useState('date-asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalProperties: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [filters, sortBy, currentPage]);

  const fetchFilterOptions = async () => {
    try {
      const response = await api.get('/properties/filters/options');
      if (response.data.success) {
        setFilterOptions(response.data.filters);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: 12,
        ...filters,
        sort: sortBy
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) {
          delete params[key];
        }
      });

      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/properties?${queryString}`);
      
      if (response.data.success) {
        setProperties(response.data.properties);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      location: '',
      city: '',
      district: '',
      type: '',
      minPrice: '',
      maxPrice: '',
      status: ''
    });
    setCurrentPage(1);
  };

  const getStatusBadge = (property) => {
    const now = new Date();
    const end = getAuctionEndDate(property);
    const start = getAuctionStartDate(property);
    const recordStatus = getAuctionRecordStatus(property);
    const { status } = property;

    if (status === 'cancelled' || recordStatus === 'cancelled') {
      return { class: 'auctions-status-ended', text: 'Cancelled', icon: <FaTimes /> };
    }
    if (status === 'completed' || recordStatus === 'completed') {
      return { class: 'auctions-status-completed', text: 'Completed', icon: <FaCheck /> };
    }
    if (end && now > end) {
      return { class: 'auctions-status-ended', text: 'Ended', icon: <FaCheck /> };
    }
    if (status === 'live' || recordStatus === 'live') {
      return { class: 'auctions-status-live', text: 'LIVE', icon: <span className="auctions-status-live-dot" aria-hidden /> };
    }
    if (start && now < start) {
      return { class: 'auctions-status-upcoming', text: 'Upcoming', icon: <FaClock /> };
    }
    if (start && end && now >= start && now <= end) {
      return { class: 'auctions-status-live', text: 'LIVE', icon: <span className="auctions-status-live-dot" aria-hidden /> };
    }
    return { class: 'auctions-status-ended', text: 'Ended', icon: <FaCheck /> };
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-NP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="auctions-layout">
      <Navigation />
      <div className="auctions-page">
        <div className="auctions-container">
          <header className="auctions-header">
            <div className="auctions-header-text">
              <p className="auctions-eyebrow">Browse</p>
              <h1 className="auctions-title">Property auctions</h1>
              <p className="auctions-subtitle">
                Live and upcoming listings across Nepal — filter by location, type, and price.
              </p>
            </div>
          </header>

          {/* Filters and Sort Bar */}
          <div className="auctions-toolbar">
            <div className="auctions-search-bar">
              <input
                type="text"
                placeholder="Search properties..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="auctions-search-input"
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="auctions-filter-toggle"
              >
                {showFilters ? <FaTimes /> : <FaCog />} Filters
              </button>
            </div>

            <div className="auctions-sort">
              <label className="auctions-sort-label">Sort by:</label>
              <select
                value={sortBy}
                onChange={handleSortChange}
                className="auctions-sort-select"
              >
                <option value="date-asc">Auction Date (Earliest)</option>
                <option value="date-desc">Auction Date (Latest)</option>
                <option value="price-asc">Price (Low to High)</option>
                <option value="price-desc">Price (High to Low)</option>
                <option value="popularity">Most Popular</option>
              </select>
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="auctions-filters-panel">
              <div className="auctions-filters-grid">
                <div className="auctions-filter-group">
                  <label className="auctions-filter-label">City</label>
                  <select
                    value={filters.city}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    className="auctions-filter-select"
                  >
                    <option value="">All Cities</option>
                    {filterOptions.cities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div className="auctions-filter-group">
                  <label className="auctions-filter-label">District</label>
                  <select
                    value={filters.district}
                    onChange={(e) => handleFilterChange('district', e.target.value)}
                    className="auctions-filter-select"
                  >
                    <option value="">All Districts</option>
                    {filterOptions.districts.map(district => (
                      <option key={district} value={district}>{district}</option>
                    ))}
                  </select>
                </div>

                <div className="auctions-filter-group">
                  <label className="auctions-filter-label">Property Type</label>
                  <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="auctions-filter-select"
                  >
                    <option value="">All Types</option>
                    <option value="house">House</option>
                    <option value="apartment">Apartment</option>
                    <option value="villa">Villa</option>
                    <option value="land">Land</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>

                <div className="auctions-filter-group">
                  <label className="auctions-filter-label">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="auctions-filter-select"
                  >
                    <option value="">All Status</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="auctions-filter-group">
                  <label className="auctions-filter-label">Min Price (NPR)</label>
                  <input
                    type="number"
                    value={filters.minPrice}
                    onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                    placeholder="Min"
                    className="auctions-filter-input"
                  />
                </div>

                <div className="auctions-filter-group">
                  <label className="auctions-filter-label">Max Price (NPR)</label>
                  <input
                    type="number"
                    value={filters.maxPrice}
                    onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                    placeholder="Max"
                    className="auctions-filter-input"
                  />
                </div>
              </div>

              <div className="auctions-filters-actions">
                <button onClick={clearFilters} className="auctions-btn auctions-btn-secondary">
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="auctions-results-info">
            <p>
              Showing {properties.length} of {pagination.totalProperties} properties
            </p>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="auctions-loading">Loading properties...</div>
          ) : (
            <>
              {/* Properties Grid */}
              {properties.length === 0 ? (
                <div className="auctions-empty">
                  <p>No properties found matching your criteria.</p>
                  <button onClick={clearFilters} className="auctions-btn auctions-btn-primary">
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="auctions-grid">
                  {properties.map((property) => {
                    const statusBadge = getStatusBadge(property);
                    const primaryPhoto = property.photos?.find(p => p.isPrimary) || property.photos?.[0];
                    const auctionStart = getAuctionStartDate(property);
                    const auctionEnd = getAuctionEndDate(property);

                    return (
                      <div key={property._id} className="auctions-card">
                        <Link to={`/auctions/${property._id}`} className="auctions-card-link">
                          <div className="auctions-card-image-wrapper">
                            {primaryPhoto ? (
                              <img
                                src={primaryPhoto.url}
                                alt={property.title}
                                className="auctions-card-image"
                              />
                            ) : (
                              <div className="auctions-card-image-placeholder">
                                <span>No Image</span>
                              </div>
                            )}
                            <span className={`auctions-status-badge ${statusBadge.class}`}>
                              {statusBadge.icon} {statusBadge.text}
                            </span>
                            {property.featured && (
                              <span className="auctions-featured-badge">⭐ Featured</span>
                            )}
                          </div>

                          <div className="auctions-card-content">
                            <h3 className="auctions-card-title">{property.title}</h3>
                            <p className="auctions-card-location">
                              <FaMapMarkerAlt aria-hidden />
                              {property.location.city}
                              {property.location.district && `, ${property.location.district}`}
                            </p>

                            <div className="auctions-card-specs">
                              {property.specifications?.bedrooms && (
                                <span className="auctions-spec-item">
                                  <FaBed /> {property.specifications.bedrooms} Beds
                                </span>
                              )}
                              {property.specifications?.bathrooms && (
                                <span className="auctions-spec-item">
                                  <FaBath /> {property.specifications.bathrooms} Baths
                                </span>
                              )}
                              {property.specifications?.area && (
                                <span className="auctions-spec-item">
                                  <FaRulerCombined /> {property.specifications.area} {property.specifications.areaUnit || 'sqft'}
                                </span>
                              )}
                            </div>

                            <div className="auctions-card-price">
                              <div className="auctions-card-price-info">
                                <span className="auctions-card-price-label">Base Price:</span>
                                <span className="auctions-card-price-value">
                                  {formatPrice(property.basePrice)}
                                </span>
                              </div>
                              {property.currentBid > property.basePrice && (
                                <div className="auctions-card-current-bid">
                                  <span className="auctions-card-bid-label">Current Bid:</span>
                                  <span className="auctions-card-bid-value">
                                    {formatPrice(property.currentBid)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {(auctionStart || auctionEnd) && (
                              <div className="auctions-card-tracking">
                                {auctionStart && (
                                  <div className="auctions-card-time-row">
                                    <span className="auctions-card-time-label">Starts</span>
                                    <time dateTime={auctionStart.toISOString()}>{formatDate(auctionStart)}</time>
                                  </div>
                                )}
                                {auctionEnd && (
                                  <div className="auctions-card-time-row">
                                    <span className="auctions-card-time-label">Ends</span>
                                    <time dateTime={auctionEnd.toISOString()}>{formatDate(auctionEnd)}</time>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="auctions-card-footer">
                              <span className="auctions-card-deposit">
                                Deposit: {formatPrice(property.depositAmount)}
                              </span>
                            </div>

                            {property.bidCount > 0 && (
                              <div className="auctions-card-bids">
                                {property.bidCount} bid{property.bidCount > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="auctions-pagination">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={!pagination.hasPrevPage}
                    className="auctions-pagination-btn"
                  >
                    ← Previous
                  </button>

                  <div className="auctions-pagination-info">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={!pagination.hasNextPage}
                    className="auctions-pagination-btn"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auctions;

