import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import {
  FaBed,
  FaBath,
  FaRulerCombined,
  FaBuilding,
  FaCar,
  FaChair,
  FaHome,
  FaCheck,
  FaExclamationTriangle,
  FaCreditCard,
  FaCopy,
  FaClock,
  FaDownload,
  FaMapMarkedAlt,
  FaChevronLeft,
  FaShareAlt,
  FaFileAlt,
  FaTimes,
  FaVideo
} from 'react-icons/fa';
import PropertyLocationMap from '../components/PropertyLocationMap';
import { getPropertyMapCoords, getPropertyAddressLine, getOsmSearchUrlForProperty } from '../utils/propertyMap';
import {
  getAuctionEndDate,
  getAuctionStartDate,
  getAuctionRecordStatus,
  isAuctionClosedForDeposits,
  isDepositSubmissionWindowClosed
} from '../utils/auctionDisplay';
import './PropertyDetail.css';

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [depositStatus, setDepositStatus] = useState(null);
  const [kycStatus, setKycStatus] = useState(null);
  const [shareModal, setShareModal] = useState(false);
  const [auctionKeyInput, setAuctionKeyInput] = useState('');

  useEffect(() => {
    fetchPropertyDetails();
    if (isAuthenticated()) {
      checkUserEligibility();
    }
  }, [id, isAuthenticated]);

  const fetchPropertyDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/properties/${id}`);
      if (response.data.success) {
        setProperty(response.data.property);
      }
    } catch (error) {
      console.error('Error fetching property details:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserEligibility = async () => {
    try {
      const [depositRes, kycRes] = await Promise.all([
        api.get(`/deposits/check/${id}`),
        api.get('/kyc/status')
      ]);

      if (depositRes.data.success) {
        const depositData = depositRes.data;
        setDepositStatus({
          eligible: depositData.hasDeposit && depositData.deposit?.status === 'approved',
          status: depositData.deposit?.status || 'none',
          hasDeposit: depositData.hasDeposit,
          depositsAllowed: depositData.depositsAllowed !== false,
          depositsClosedMessage: depositData.depositsClosedMessage || null
        });
      }

      if (kycRes.data.success) {
        setKycStatus(kycRes.data.kyc);
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
    }
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = () => {
    if (!property) return null;

    const now = new Date();
    const end = getAuctionEndDate(property);
    const start = getAuctionStartDate(property);
    const recordStatus = getAuctionRecordStatus(property);
    const { status } = property;

    if (status === 'cancelled' || recordStatus === 'cancelled') {
      return { class: 'property-detail-status-completed', text: 'Cancelled', icon: <FaTimes /> };
    }
    if (status === 'completed' || recordStatus === 'completed') {
      return { class: 'property-detail-status-completed', text: 'Completed', icon: <FaCheck /> };
    }
    if (end && now > end) {
      return { class: 'property-detail-status-completed', text: 'Auction ended', icon: <FaCheck /> };
    }
    if (status === 'live' || recordStatus === 'live') {
      return { class: 'property-detail-status-live', text: 'Live auction', icon: 'live' };
    }
    if (start && now < start) {
      return { class: 'property-detail-status-upcoming', text: 'Upcoming', icon: <FaClock /> };
    }
    if (start && end && now >= start && now <= end) {
      return { class: 'property-detail-status-live', text: 'Live auction', icon: 'live' };
    }
    return { class: 'property-detail-status-completed', text: 'Auction ended', icon: <FaCheck /> };
  };

  const canJoinAuction = () => {
    if (!isAuthenticated() || !property) return false;
    if (['completed', 'cancelled', 'draft'].includes(property.status)) return false;

    const recordStatus = getAuctionRecordStatus(property);
    if (recordStatus === 'completed' || recordStatus === 'cancelled') return false;

    const now = new Date();
    const end = getAuctionEndDate(property);
    const start = getAuctionStartDate(property);
    const inWindow = Boolean(start && end && now >= start && now <= end);
    const beforeStart = Boolean(start && now < start);
    const notPastEnd = Boolean(end && now <= end);

    const auctionJoinable =
      recordStatus === 'live' ||
      recordStatus === 'paused' ||
      (recordStatus === 'scheduled' && notPastEnd && (inWindow || beforeStart));

    if (!auctionJoinable) return false;

    const kycApproved = kycStatus?.status === 'approved';
    const depositApproved = depositStatus?.status === 'approved';

    return kycApproved && depositApproved;
  };

  const needsDeposit = () => {
    if (!isAuthenticated()) return false;
    return depositStatus?.status !== 'approved';
  };

  const canPayDeposit = () =>
    needsDeposit() &&
    !isAuctionClosedForDeposits(property) &&
    !isDepositSubmissionWindowClosed(property) &&
    depositStatus?.depositsAllowed !== false;

  const isAuctionOpenForLive = () => {
    if (!property?.auction) return false;
    const rs = getAuctionRecordStatus(property);
    if (rs === 'completed' || rs === 'cancelled') return false;
    const now = new Date();
    const end = getAuctionEndDate(property);
    const start = getAuctionStartDate(property);
    const inWindow = Boolean(start && end && now >= start && now <= end);
    const beforeStart = Boolean(start && now < start);
    const notPastEnd = Boolean(end && now <= end);
    return (
      rs === 'live' ||
      rs === 'paused' ||
      (rs === 'scheduled' && notPastEnd && (inWindow || beforeStart))
    );
  };

  const openLiveWithKey = () => {
    const key = auctionKeyInput.trim();
    if (!key) return;
    navigate(`/auction/${id}/live?key=${encodeURIComponent(key)}`);
  };

  const recordStatusForUi = property ? getAuctionRecordStatus(property) : null;
  const isListingCancelled =
    property && (property.status === 'cancelled' || recordStatusForUi === 'cancelled');
  const showWinnerHighlight = Boolean(
    property?.auction?.status === 'completed' && property?.auction?.winner?.userId
  );
  const auctionActiveForCta =
    Boolean(property) && !isAuctionClosedForDeposits(property) && !isListingCancelled;
  const showGuestLoginHighlight = Boolean(auctionActiveForCta && !isAuthenticated());
  const showSecretKeyInHighlight = Boolean(
    isAuthenticated() &&
      auctionActiveForCta &&
      isAuctionOpenForLive() &&
      !canJoinAuction()
  );

  /** Bid timeline is only offered during an active live session, not for upcoming/added listings. */
  const showAuctionRecordsLink =
    Boolean(property?.auction) &&
    (recordStatusForUi === 'live' || recordStatusForUi === 'paused');

  const handleShare = () => {
    setShareModal(true);
    if (navigator.share) {
      navigator.share({
        title: property.title,
        text: property.description?.substring(0, 100),
        url: window.location.href
      }).catch(() => {});
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
    setShareModal(false);
  };

  const { hasMapCoords, lat: mapLat, lng: mapLng } = property
    ? getPropertyMapCoords(property)
    : { hasMapCoords: false, lat: null, lng: null };
  const addressLineForMap = property ? getPropertyAddressLine(property) : '';
  const osmSearchUrl = property ? getOsmSearchUrlForProperty(property) : '';

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="property-detail-page">
          <div className="property-detail-container">
            <div className="property-detail-loading">Loading property details…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div>
        <Navigation />
        <div className="property-detail-page">
          <div className="property-detail-container">
            <div className="property-detail-error">
              <h2>Property not found</h2>
              <button type="button" onClick={() => navigate('/auctions')} className="property-detail-btn property-detail-btn-primary">
                Back to auctions
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge();
  const primaryImage = property.photos?.find(p => p.isPrimary) || property.photos?.[0];

  return (
    <div>
      <Navigation />
      <div className="property-detail-page">
        <div className="property-detail-container">
          <div className="property-detail-toolbar">
            <button type="button" onClick={() => navigate('/auctions')} className="property-detail-back-btn">
              <FaChevronLeft aria-hidden />
              Auctions
            </button>
            <button type="button" onClick={handleShare} className="property-detail-share-btn">
              <FaShareAlt aria-hidden />
              Share
            </button>
          </div>

          <header className="property-detail-header">
            <div className="property-detail-header-main">
              <h1 className="property-detail-title">{property.title}</h1>
              <p className="property-detail-location">
                {property.location.address}, {property.location.city}
                {property.location.district && ` · ${property.location.district}`}
                {property.location.province && ` · ${property.location.province}`}
              </p>
            </div>
            {statusBadge && (
              <span className={`property-detail-status-badge ${statusBadge.class}`}>
                {statusBadge.class === 'property-detail-status-live' && (
                  <span className="property-detail-status-dot" aria-hidden />
                )}
                {statusBadge.text}
              </span>
            )}
          </header>

          {/* Image Gallery */}
          {property.photos && property.photos.length > 0 && (
            <div className="property-detail-gallery">
              <div className="property-detail-main-image">
                <img
                  src={property.photos[selectedImageIndex]?.url || primaryImage?.url}
                  alt={property.title}
                  className="property-detail-main-img"
                />
              </div>
              {property.photos.length > 1 && (
                <div className="property-detail-thumbnails">
                  {property.photos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo.url}
                      alt={`${property.title} - ${index + 1}`}
                      className={`property-detail-thumbnail ${selectedImageIndex === index ? 'active' : ''}`}
                      onClick={() => setSelectedImageIndex(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="property-detail-content">
            {/* Left Column */}
            <div className="property-detail-main">
              {/* Description */}
              <section className="property-detail-section" aria-labelledby="pd-desc">
                <h2 id="pd-desc" className="property-detail-section-title">
                  Description
                </h2>
                <p className="property-detail-description">{property.description}</p>
              </section>

              <section className="property-detail-section" aria-labelledby="pd-specs">
                <h2 id="pd-specs" className="property-detail-section-title">
                  Specifications
                </h2>
                <div className="property-detail-specs-grid">
                  {property.specifications?.bedrooms && (
                    <div className="property-detail-spec-item">
                      <span className="property-detail-spec-icon"><FaBed /></span>
                      <div>
                        <span className="property-detail-spec-label">Bedrooms</span>
                        <span className="property-detail-spec-value">{property.specifications.bedrooms}</span>
                      </div>
                    </div>
                  )}
                  {property.specifications?.bathrooms && (
                    <div className="property-detail-spec-item">
                      <span className="property-detail-spec-icon"><FaBath /></span>
                      <div>
                        <span className="property-detail-spec-label">Bathrooms</span>
                        <span className="property-detail-spec-value">{property.specifications.bathrooms}</span>
                      </div>
                    </div>
                  )}
                  {property.specifications?.area && (
                    <div className="property-detail-spec-item">
                      <span className="property-detail-spec-icon"><FaRulerCombined /></span>
                      <div>
                        <span className="property-detail-spec-label">Area</span>
                        <span className="property-detail-spec-value">
                          {property.specifications.area} {property.specifications.areaUnit || 'sqft'}
                        </span>
                      </div>
                    </div>
                  )}
                  {property.specifications?.floors && (
                    <div className="property-detail-spec-item">
                      <span className="property-detail-spec-icon"><FaBuilding /></span>
                      <div>
                        <span className="property-detail-spec-label">Floors</span>
                        <span className="property-detail-spec-value">{property.specifications.floors}</span>
                      </div>
                    </div>
                  )}
                  {property.specifications?.parking !== undefined && (
                    <div className="property-detail-spec-item">
                      <span className="property-detail-spec-icon"><FaCar /></span>
                      <div>
                        <span className="property-detail-spec-label">Parking</span>
                        <span className="property-detail-spec-value">
                          {property.specifications.parking ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  )}
                  {property.specifications?.furnishing && (
                    <div className="property-detail-spec-item">
                      <span className="property-detail-spec-icon"><FaChair /></span>
                      <div>
                        <span className="property-detail-spec-label">Furnishing</span>
                        <span className="property-detail-spec-value">
                          {property.specifications.furnishing}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="property-detail-spec-item">
                    <span className="property-detail-spec-icon"><FaHome /></span>
                    <div>
                      <span className="property-detail-spec-label">Type</span>
                      <span className="property-detail-spec-value capitalize">
                        {property.type}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="property-detail-section" aria-labelledby="pd-loc">
                <h2 id="pd-loc" className="property-detail-section-title">
                  Location
                </h2>
                <div className="property-detail-map-container">
                  {hasMapCoords ? (
                    <PropertyLocationMap
                      key={`${mapLat}-${mapLng}`}
                      lat={mapLat}
                      lng={mapLng}
                      title={property.title}
                      addressLine={addressLineForMap}
                      height={240}
                    />
                  ) : (
                    <div className="property-detail-map-fallback">
                      <FaMapMarkedAlt className="property-detail-map-fallback-icon" aria-hidden />
                      <p>
                        No coordinates are set for this listing. Search the address on OpenStreetMap
                        or ask the admin to add latitude and longitude for an interactive map.
                      </p>
                      <a
                        href={osmSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="property-detail-osm-link"
                      >
                        Open in OpenStreetMap
                      </a>
                    </div>
                  )}
                </div>
              </section>

              {property.documents && property.documents.length > 0 && (
                <section className="property-detail-section" aria-labelledby="pd-docs">
                  <h2 id="pd-docs" className="property-detail-section-title">
                    Documents
                  </h2>
                  <div className="property-detail-documents">
                    {property.documents.map((doc, index) => (
                      <a
                        key={index}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="property-detail-document-item"
                      >
                        <span className="property-detail-document-icon" aria-hidden>
                          <FaFileAlt />
                        </span>
                        <div>
                          <span className="property-detail-document-name">
                            {doc.name || `Document ${index + 1}`}
                          </span>
                          <span className="property-detail-document-type">{doc.type}</span>
                        </div>
                        <span className="property-detail-document-download"><FaDownload /></span>
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <aside className="property-detail-sidebar">
              <div className="property-detail-card">
                <h3 className="property-detail-card-title">Auction</h3>
                
                <div className="property-detail-info-item">
                  <span className="property-detail-info-label">Base Price</span>
                  <span className="property-detail-info-value property-detail-price">
                    {formatPrice(property.basePrice)}
                  </span>
                </div>

                {property.currentBid > property.basePrice && (
                  <div className="property-detail-info-item">
                    <span className="property-detail-info-label">Current Bid</span>
                    <span className="property-detail-info-value property-detail-current-bid">
                      {formatPrice(property.currentBid)}
                    </span>
                  </div>
                )}

                <div className="property-detail-info-item">
                  <span className="property-detail-info-label">Deposit Amount</span>
                  <span className="property-detail-info-value">
                    {formatPrice(property.depositAmount)}
                  </span>
                </div>

                <div className="property-detail-info-item">
                  <span className="property-detail-info-label">Auction Date & Time</span>
                  <span className="property-detail-info-value">
                    {formatDate(property.auctionTime)}
                  </span>
                </div>

                {property.bidCount > 0 && (
                  <div className="property-detail-info-item">
                    <span className="property-detail-info-label">Total Bids</span>
                    <span className="property-detail-info-value">
                      {property.bidCount} bid{property.bidCount > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                <div className="property-detail-auction-highlight">
                  {isListingCancelled && (
                    <p className="property-detail-highlight-cancelled" role="status">
                      This auction was cancelled.
                    </p>
                  )}

                  {!isListingCancelled && showWinnerHighlight && (
                    <div className="property-detail-winner" role="status">
                      <h3 className="property-detail-winner-title">Auction winner</h3>
                      <p className="property-detail-winner-name">
                        {typeof property.auction.winner.userId === 'object'
                          ? property.auction.winner.userId.fullName || 'Winner'
                          : 'Winner'}
                      </p>
                      {property.auction.winner.winningBid != null && (
                        <p className="property-detail-winner-bid">
                          Winning bid: {formatPrice(property.auction.winner.winningBid)}
                        </p>
                      )}
                    </div>
                  )}

                  {!isListingCancelled &&
                    isAuctionClosedForDeposits(property) &&
                    !showWinnerHighlight && (
                      <p className="property-detail-ended-note" role="status">
                        Auction ended.
                      </p>
                    )}

                  {auctionActiveForCta && (
                    <div className="property-detail-highlight-active">
                      {showGuestLoginHighlight && (
                        <button
                          type="button"
                          onClick={() => navigate('/login')}
                          className="property-detail-btn property-detail-btn-primary"
                        >
                          Log in to bid
                        </button>
                      )}

                      {canJoinAuction() && (
                        <button
                          type="button"
                          onClick={() => navigate(`/auction/${id}/live`)}
                          className="property-detail-btn property-detail-btn-primary"
                        >
                          <FaVideo aria-hidden />
                          Join room
                        </button>
                      )}

                      {canPayDeposit() && (
                        <button
                          type="button"
                          onClick={() => navigate(`/deposit/${id}`)}
                          className="property-detail-btn property-detail-btn-primary"
                        >
                          <FaCreditCard aria-hidden />
                          Pay deposit
                        </button>
                      )}

                      {needsDeposit() &&
                        auctionActiveForCta &&
                        !canPayDeposit() &&
                        (depositStatus?.depositsAllowed === false ||
                          isDepositSubmissionWindowClosed(property)) && (
                          <p className="property-detail-eligibility-text" role="status">
                            {depositStatus?.depositsClosedMessage ||
                              'Deposits are closed during the final 10 minutes before the auction starts.'}
                          </p>
                        )}

                      {showSecretKeyInHighlight && (
                        <div className="property-detail-auction-key property-detail-auction-key--in-highlight">
                          <span className="property-detail-auction-key-label">Enter secret key</span>
                          <p className="property-detail-auction-key-hint">
                            Use the secret key from the organizer to open the live room (watch only until your deposit is
                            approved).
                          </p>
                          <div className="property-detail-auction-key-row">
                            <input
                              type="text"
                              value={auctionKeyInput}
                              onChange={(e) => setAuctionKeyInput(e.target.value)}
                              placeholder="Secret key"
                              className="property-detail-auction-key-input"
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              onClick={openLiveWithKey}
                              className="property-detail-btn property-detail-btn-secondary"
                            >
                              Open live room
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="property-detail-actions">
                  {needsDeposit() && isAuctionClosedForDeposits(property) && (
                    <p className="property-detail-eligibility-text" role="status">
                      This auction has ended. New deposits are not accepted.
                    </p>
                  )}

                  {isAuthenticated() && !canJoinAuction() && !needsDeposit() && kycStatus?.status !== 'approved' && (
                    <div className="property-detail-eligibility-message">
                      <p className="property-detail-eligibility-text">
                        <><FaExclamationTriangle /> Complete KYC verification to join auctions</>
                      </p>
                    </div>
                  )}
                </div>

                {showAuctionRecordsLink && (
                  <div className="property-detail-records">
                    <button
                      type="button"
                      className="property-detail-records-link"
                      onClick={() => navigate(`/auctions/${id}/records`)}
                    >
                      Click to view auction records
                    </button>
                    <p className="property-detail-records-hint">
                      Bid amounts over time and live session details for transparency.
                    </p>
                  </div>
                )}
              </div>

              {/* Owner Info */}
              {property.ownerId && (
                <div className="property-detail-card property-detail-card--muted">
                  <h3 className="property-detail-card-title">Listed by</h3>
                  <div className="property-detail-owner-info">
                    <span className="property-detail-owner-name">
                      {property.ownerId.fullName || '—'}
                    </span>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {shareModal && (
        <div className="property-detail-modal-overlay" onClick={() => setShareModal(false)}>
          <div className="property-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="pd-share-title">
            <h3 id="pd-share-title">Share listing</h3>
            <div className="property-detail-share-options">
              <button type="button" onClick={copyLink} className="property-detail-share-option">
                <FaCopy aria-hidden />
                Copy link
              </button>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="property-detail-share-option"
              >
                Facebook
              </a>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(property.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="property-detail-share-option"
              >
                X / Twitter
              </a>
            </div>
            <button
              type="button"
              onClick={() => setShareModal(false)}
              className="property-detail-btn property-detail-btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;

