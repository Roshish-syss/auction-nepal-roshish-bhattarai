import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminNavigation from '../components/AdminNavigation';
import api from '../services/authService';
import { FaPlus, FaEdit, FaTrash, FaEye, FaSpinner, FaMapMarkerAlt } from 'react-icons/fa';
import AdminLocationPicker from '../components/AdminLocationPicker';
import './AdminProperties.css';

const AdminProperties = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    page: 1
  });
  const [pagination, setPagination] = useState({
    totalPages: 1,
    currentPage: 1,
    total: 0
  });
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    city: '',
    district: '',
    province: '',
    type: 'house',
    bedrooms: '',
    bathrooms: '',
    area: '',
    areaUnit: 'sqft',
    basePrice: '',
    depositAmount: '',
    auctionTime: '',
    auctionDuration: '60',
    latitude: '',
    longitude: ''
  });
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated() || user?.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchProperties();
  }, [filters.status, filters.search, filters.page, isAuthenticated, user, navigate]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      params.append('page', filters.page);
      params.append('limit', '20');

      const response = await api.get(`/admin/properties?${params.toString()}`);
      
      if (response.data.success) {
        setProperties(response.data.properties);
        setPagination({
          totalPages: response.data.totalPages,
          currentPage: response.data.currentPage,
          total: response.data.total
        });
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeocodeFromAddress = async () => {
    if (!formData.address?.trim() || !formData.city?.trim()) {
      alert('Enter address and city before looking up coordinates.');
      return;
    }
    const q = [formData.address, formData.city, formData.district, formData.province, 'Nepal']
      .filter(Boolean)
      .join(', ');
    setGeocodeLoading(true);
    try {
      const response = await api.get('/admin/geocode', { params: { q } });
      if (response.data.success) {
        setFormData((prev) => ({
          ...prev,
          latitude: String(response.data.lat),
          longitude: String(response.data.lng)
        }));
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          'No location found. Try a fuller address or place the pin on the map manually.'
      );
    } finally {
      setGeocodeLoading(false);
    }
  };

  const clearMapPin = () => {
    setFormData((prev) => ({ ...prev, latitude: '', longitude: '' }));
  };

  const handleDelete = async (propertyId) => {
    if (!window.confirm('Are you sure you want to delete this property?')) {
      return;
    }

    try {
      const response = await api.delete(`/admin/properties/${propertyId}`);
      if (response.data.success) {
        fetchProperties();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting property');
    }
  };

  const handleEdit = (property) => {
    setEditingProperty(property);
    setFormData({
      title: property.title || '',
      description: property.description || '',
      address: property.location?.address || '',
      city: property.location?.city || '',
      district: property.location?.district || '',
      province: property.location?.province || '',
      type: property.type || 'house',
      bedrooms: property.specifications?.bedrooms || '',
      bathrooms: property.specifications?.bathrooms || '',
      area: property.specifications?.area || '',
      areaUnit: property.specifications?.areaUnit || 'sqft',
      basePrice: property.basePrice || '',
      depositAmount: property.depositAmount || '',
      auctionTime: property.auctionTime ? new Date(property.auctionTime).toISOString().slice(0, 16) : '',
      auctionDuration: property.auctionDuration || '60',
      latitude:
        property.location?.coordinates?.latitude != null &&
        property.location?.coordinates?.latitude !== ''
          ? String(property.location.coordinates.latitude)
          : '',
      longitude:
        property.location?.coordinates?.longitude != null &&
        property.location?.coordinates?.longitude !== ''
          ? String(property.location.coordinates.longitude)
          : ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      
      // Add form fields
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('type', formData.type);
      formDataToSend.append('basePrice', formData.basePrice);
      formDataToSend.append('depositAmount', formData.depositAmount);
      formDataToSend.append('auctionTime', new Date(formData.auctionTime).toISOString());
      formDataToSend.append('auctionDuration', formData.auctionDuration);

      // Location (optional map coordinates)
      const location = {
        address: formData.address,
        city: formData.city,
        district: formData.district,
        province: formData.province
      };
      const latNum = formData.latitude !== '' ? Number(formData.latitude) : NaN;
      const lngNum = formData.longitude !== '' ? Number(formData.longitude) : NaN;
      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        location.coordinates = { latitude: latNum, longitude: lngNum };
      }
      formDataToSend.append('location', JSON.stringify(location));

      // Specifications
      const specifications = {
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : undefined,
        area: parseFloat(formData.area),
        areaUnit: formData.areaUnit
      };
      formDataToSend.append('specifications', JSON.stringify(specifications));

      // Add files
      files.forEach(file => {
        formDataToSend.append('files', file);
      });

      const endpoint = editingProperty
        ? `/admin/properties/${editingProperty._id}`
        : '/admin/properties';

      const method = editingProperty ? 'PUT' : 'POST';

      const response = await api({
        method,
        url: endpoint,
        data: formDataToSend,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setShowForm(false);
        setEditingProperty(null);
        setFormData({
          title: '',
          description: '',
          address: '',
          city: '',
          district: '',
          province: '',
          type: 'house',
          bedrooms: '',
          bathrooms: '',
          area: '',
          areaUnit: 'sqft',
          basePrice: '',
          depositAmount: '',
          auctionTime: '',
          auctionDuration: '60',
          latitude: '',
          longitude: ''
        });
        setFiles([]);
        fetchProperties();
      }
    } catch (error) {
      console.error('Error saving property:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || error.message || 'Error saving property';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'live': return 'admin-properties-status-live';
      case 'upcoming': return 'admin-properties-status-upcoming';
      case 'completed': return 'admin-properties-status-completed';
      case 'draft': return 'admin-properties-status-draft';
      default: return 'admin-properties-status-draft';
    }
  };

  if (loading) {
    return (
      <div>
        <AdminNavigation />
        <div className="admin-properties-page">
          <div className="admin-properties-loading">Loading properties...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminNavigation />
      <div className="admin-properties-page">
        <div className="admin-properties-container">
          {/* Header */}
          <div className="admin-properties-header">
            <div>
              <h1 className="admin-properties-title">Property Management</h1>
              <p className="admin-properties-subtitle">Create and manage properties</p>
            </div>
            <button
              onClick={() => {
                setEditingProperty(null);
                setFormData({
                  title: '',
                  description: '',
                  address: '',
                  city: '',
                  district: '',
                  province: '',
                  type: 'house',
                  bedrooms: '',
                  bathrooms: '',
                  area: '',
                  areaUnit: 'sqft',
                  basePrice: '',
                  depositAmount: '',
                  auctionTime: '',
                  auctionDuration: '60',
                  latitude: '',
                  longitude: ''
                });
                setFiles([]);
                setShowForm(true);
              }}
              className="admin-properties-btn admin-properties-btn-primary"
            >
              <FaPlus /> Create Property
            </button>
          </div>

          {/* Filters */}
          <div className="admin-properties-filters">
            <input
              type="text"
              placeholder="Search properties..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              className="admin-properties-search-input"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="admin-properties-filter-select"
              aria-describedby="admin-properties-auctions-hint"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <p id="admin-properties-auctions-hint" className="admin-properties-filter-hint">
            Active bidding is under <strong>Auctions</strong> (auction status: live / scheduled).
          </p>

          {/* Properties List */}
          <div className="admin-properties-list">
            {properties.length === 0 ? (
              <div className="admin-properties-empty">No properties found</div>
            ) : (
              properties.map((property) => (
                <div key={property._id} className="admin-properties-item">
                  <div className="admin-properties-item-image">
                    {property.photos?.[0]?.url ? (
                      <img src={property.photos[0].url} alt={property.title} />
                    ) : (
                      <div className="admin-properties-item-placeholder">No Image</div>
                    )}
                  </div>
                  <div className="admin-properties-item-content">
                    <div className="admin-properties-item-header">
                      <h3 className="admin-properties-item-title">{property.title}</h3>
                      <span className={`admin-properties-status-badge ${getStatusBadgeClass(property.status)}`}>
                        {property.status}
                      </span>
                    </div>
                    <p className="admin-properties-item-location">
                      {property.location?.coordinates?.latitude != null &&
                        property.location?.coordinates?.longitude != null && (
                          <span title="Map location set" style={{ marginRight: 6, display: 'inline-flex', verticalAlign: 'middle' }}>
                            <FaMapMarkerAlt style={{ color: '#2563eb' }} aria-hidden />
                          </span>
                        )}
                      {property.location?.city}, {property.location?.district}
                    </p>
                    <div className="admin-properties-item-details">
                      <span>Base Price: <strong>{formatPrice(property.basePrice)}</strong></span>
                      <span>Deposit: <strong>{formatPrice(property.depositAmount)}</strong></span>
                      {property.auctionTime && (
                        <span>Auction: {new Date(property.auctionTime).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="admin-properties-item-actions">
                    <button
                      onClick={() => navigate(`/auctions/${property._id}`)}
                      className="admin-properties-btn admin-properties-btn-secondary"
                    >
                      <FaEye /> View
                    </button>
                    <button
                      onClick={() => handleEdit(property)}
                      className="admin-properties-btn admin-properties-btn-secondary"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(property._id)}
                      className="admin-properties-btn admin-properties-btn-danger"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="admin-properties-pagination">
              <button
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={filters.page === 1}
                className="admin-properties-page-btn"
              >
                Previous
              </button>
              <span className="admin-properties-page-info">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={filters.page === pagination.totalPages}
                className="admin-properties-page-btn"
              >
                Next
              </button>
            </div>
          )}

          {/* Form Modal */}
          {showForm && (
            <div className="admin-properties-modal-overlay" onClick={() => setShowForm(false)}>
              <div className="admin-properties-modal" onClick={(e) => e.stopPropagation()}>
                <div className="admin-properties-modal-header">
                  <h2>{editingProperty ? 'Edit Property' : 'Create Property'}</h2>
                  <button
                    onClick={() => setShowForm(false)}
                    className="admin-properties-modal-close"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="admin-properties-form">
                  <div className="admin-properties-form-row">
                    <div className="admin-properties-form-group">
                      <label>Title *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="admin-properties-form-group">
                      <label>Type *</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        required
                      >
                        <option value="house">House</option>
                        <option value="apartment">Apartment</option>
                        <option value="villa">Villa</option>
                        <option value="land">Land</option>
                        <option value="commercial">Commercial</option>
                      </select>
                    </div>
                  </div>

                  <div className="admin-properties-form-group">
                    <label>Description *</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="4"
                      required
                    />
                  </div>

                  <div className="admin-properties-form-row">
                    <div className="admin-properties-form-group">
                      <label>Address *</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        required
                      />
                    </div>
                    <div className="admin-properties-form-group">
                      <label>City *</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="admin-properties-form-row">
                    <div className="admin-properties-form-group">
                      <label>District</label>
                      <input
                        type="text"
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      />
                    </div>
                    <div className="admin-properties-form-group">
                      <label>Province</label>
                      <input
                        type="text"
                        value={formData.province}
                        onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="admin-properties-form-group">
                    <h3 className="admin-location-section-title">Map location (optional)</h3>
                    <p className="admin-location-picker-hint">
                      Use your address to suggest coordinates, enter latitude/longitude manually, or click the map.
                      The pin appears on property, auction, and deposit pages when set.
                    </p>
                    <AdminLocationPicker
                      latitude={formData.latitude}
                      longitude={formData.longitude}
                      onChange={(lat, lng) =>
                        setFormData((prev) => ({
                          ...prev,
                          latitude: String(lat),
                          longitude: String(lng)
                        }))
                      }
                    />
                    <div className="admin-location-coords-row">
                      <div className="admin-properties-form-group">
                        <label>Latitude</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g. 27.7172"
                          value={formData.latitude}
                          onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                        />
                      </div>
                      <div className="admin-properties-form-group">
                        <label>Longitude</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g. 85.3240"
                          value={formData.longitude}
                          onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="admin-location-actions-row">
                      <button
                        type="button"
                        className="admin-location-geocode-btn"
                        onClick={handleGeocodeFromAddress}
                        disabled={geocodeLoading || !formData.address?.trim() || !formData.city?.trim()}
                      >
                        {geocodeLoading ? 'Looking up…' : 'Look up from address'}
                      </button>
                      <button type="button" className="admin-location-clear-btn" onClick={clearMapPin}>
                        Clear map pin
                      </button>
                    </div>
                  </div>

                  <div className="admin-properties-form-row">
                    <div className="admin-properties-form-group">
                      <label>Bedrooms</label>
                      <input
                        type="number"
                        value={formData.bedrooms}
                        onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                      />
                    </div>
                    <div className="admin-properties-form-group">
                      <label>Bathrooms</label>
                      <input
                        type="number"
                        value={formData.bathrooms}
                        onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                      />
                    </div>
                    <div className="admin-properties-form-group">
                      <label>Area *</label>
                      <input
                        type="number"
                        value={formData.area}
                        onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                        required
                      />
                    </div>
                    <div className="admin-properties-form-group">
                      <label>Area Unit</label>
                      <select
                        value={formData.areaUnit}
                        onChange={(e) => setFormData({ ...formData, areaUnit: e.target.value })}
                      >
                        <option value="sqft">Square Feet</option>
                        <option value="sqm">Square Meters</option>
                        <option value="aana">Aana</option>
                        <option value="ropani">Ropani</option>
                      </select>
                    </div>
                  </div>

                  <div className="admin-properties-form-row">
                    <div className="admin-properties-form-group">
                      <label>Base Price (NPR) *</label>
                      <input
                        type="number"
                        value={formData.basePrice}
                        onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                        required
                      />
                    </div>
                    <div className="admin-properties-form-group">
                      <label>Deposit Amount (NPR) *</label>
                      <input
                        type="number"
                        value={formData.depositAmount}
                        onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="admin-properties-form-row">
                    <div className="admin-properties-form-group">
                      <label>Auction Time *</label>
                      <input
                        type="datetime-local"
                        value={formData.auctionTime}
                        onChange={(e) => setFormData({ ...formData, auctionTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="admin-properties-form-group">
                      <label>Duration (minutes)</label>
                      <input
                        type="number"
                        value={formData.auctionDuration}
                        onChange={(e) => setFormData({ ...formData, auctionDuration: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="admin-properties-form-group">
                    <label>{editingProperty ? 'Add more photos (optional)' : 'Property photos'}</label>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => setFiles(Array.from(e.target.files))}
                    />
                  </div>

                  <div className="admin-properties-form-actions">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="admin-properties-btn admin-properties-btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="admin-properties-btn admin-properties-btn-primary"
                    >
                      {submitting ? (
                        <><FaSpinner className="admin-properties-spinner" /> Saving...</>
                      ) : (
                        editingProperty ? 'Update Property' : 'Create Property'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProperties;

