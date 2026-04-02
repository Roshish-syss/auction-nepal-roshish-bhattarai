import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminNavigation from '../components/AdminNavigation';
import api from '../services/authService';
import {
  FaEye,
  FaStop,
  FaPause,
  FaPlay,
  FaBroadcastTower,
  FaGavel,
  FaFilter,
  FaSpinner,
  FaLayerGroup,
  FaUser,
  FaClock,
  FaKey,
  FaTrophy
} from 'react-icons/fa';
import './AdminAuctions.css';

const AdminAuctions = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState([]);
  const [filters, setFilters] = useState({ status: '', page: 1 });
  const [pagination, setPagination] = useState({ totalPages: 1, currentPage: 1, total: 0 });
  const [joinKeyDrafts, setJoinKeyDrafts] = useState({});

  useEffect(() => {
    if (!isAuthenticated() || user?.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchAuctions();
  }, [filters.status, filters.page, isAuthenticated, user, navigate]);

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      params.append('page', filters.page);
      params.append('limit', '20');

      const response = await api.get(`/admin/auctions?${params.toString()}`);
      if (response.data.success) {
        setAuctions(response.data.auctions);
        setPagination({
          totalPages: response.data.totalPages,
          currentPage: response.data.currentPage,
          total: response.data.total
        });
      }
    } catch (error) {
      console.error('Error fetching auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndAuction = async (auctionId) => {
    if (!window.confirm('Are you sure you want to end this auction?')) return;
    try {
      await api.post(`/admin/auctions/${auctionId}/end`);
      fetchAuctions();
    } catch (error) {
      alert(error.response?.data?.message || 'Error ending auction');
    }
  };

  const handlePauseAuction = async (auctionId) => {
    try {
      await api.post(`/admin/auctions/${auctionId}/pause`);
      fetchAuctions();
    } catch (error) {
      alert(error.response?.data?.message || 'Error pausing auction');
    }
  };

  const handleResumeAuction = async (auctionId) => {
    try {
      await api.post(`/admin/auctions/${auctionId}/resume`);
      fetchAuctions();
    } catch (error) {
      alert(error.response?.data?.message || 'Error resuming auction');
    }
  };

  const saveJoinKey = async (auctionId) => {
    const raw = (joinKeyDrafts[auctionId] || '').trim();
    if (raw.length < 4) {
      alert('Join key must be at least 4 characters.');
      return;
    }
    try {
      await api.patch(`/admin/auctions/${auctionId}/join-key`, { secretCode: raw });
      setJoinKeyDrafts((p) => ({ ...p, [auctionId]: '' }));
      alert('Join key saved. Share it with guests who have not paid a deposit.');
      fetchAuctions();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not update join key');
    }
  };

  const propertyIdFor = (auction) =>
    auction.propertyId?._id || auction.propertyId;

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      minimumFractionDigits: 0
    }).format(price);

  const formatDateTime = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-NP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusMeta = (status) => {
    switch (status) {
      case 'live':
        return { className: 'admin-auctions-pill--live', label: 'Live', dot: true };
      case 'paused':
        return { className: 'admin-auctions-pill--paused', label: 'Paused', dot: false };
      case 'scheduled':
        return { className: 'admin-auctions-pill--scheduled', label: 'Scheduled', dot: false };
      case 'completed':
        return { className: 'admin-auctions-pill--completed', label: 'Completed', dot: false };
      case 'cancelled':
        return { className: 'admin-auctions-pill--cancelled', label: 'Cancelled', dot: false };
      default:
        return { className: 'admin-auctions-pill--scheduled', label: status || 'Unknown', dot: false };
    }
  };

  const liveCount = auctions.filter((a) => a.status === 'live').length;

  return (
    <div className="admin-auctions-root">
      <AdminNavigation />
      <div className="admin-auctions-page">
        <div className="admin-auctions-bg" aria-hidden />
        <div className="admin-auctions-container">
          <header className="admin-auctions-hero">
            <div className="admin-auctions-hero-text">
              <p className="admin-auctions-eyebrow">
                <FaGavel aria-hidden className="admin-auctions-eyebrow-icon" />
                Operations
              </p>
              <h1 className="admin-auctions-title">Auction monitoring</h1>
              <p className="admin-auctions-subtitle">
                Track live sessions, pause or end auctions, and open the bidder room in one place.
              </p>
            </div>
            <div className="admin-auctions-hero-stats">
              <div className="admin-auctions-stat-card">
                <span className="admin-auctions-stat-value">{loading ? '—' : pagination.total}</span>
                <span className="admin-auctions-stat-label">In this view</span>
              </div>
              <div className="admin-auctions-stat-card admin-auctions-stat-card--accent">
                <span className="admin-auctions-stat-value">{loading ? '—' : liveCount}</span>
                <span className="admin-auctions-stat-label">Live on page</span>
              </div>
            </div>
          </header>

          <div className="admin-auctions-toolbar">
            <label className="admin-auctions-filter-label" htmlFor="admin-auctions-status">
              <FaFilter aria-hidden />
              Status
            </label>
            <div className="admin-auctions-filter-wrap">
              <select
                id="admin-auctions-status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                className="admin-auctions-filter-select"
              >
                <option value="">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <button
              type="button"
              className="admin-auctions-refresh"
              onClick={() => fetchAuctions()}
              disabled={loading}
              title="Refresh list"
            >
              <FaSpinner className={loading ? 'admin-auctions-refresh-spin' : ''} aria-hidden />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="admin-auctions-loading">
              <FaSpinner className="admin-auctions-loading-icon" aria-hidden />
              <p>Loading auctions…</p>
            </div>
          ) : (
            <>
              <div className="admin-auctions-list">
                {auctions.length === 0 ? (
                  <div className="admin-auctions-empty">
                    <div className="admin-auctions-empty-icon">
                      <FaLayerGroup aria-hidden />
                    </div>
                    <h2 className="admin-auctions-empty-title">No auctions in this filter</h2>
                    <p className="admin-auctions-empty-hint">
                      Auctions are created for each <strong>upcoming</strong> property. Add listings under{' '}
                      <strong>Properties</strong>, then return here or choose another status.
                    </p>
                    <button
                      type="button"
                      className="admin-auctions-empty-btn"
                      onClick={() => navigate('/admin/properties')}
                    >
                      Go to properties
                    </button>
                  </div>
                ) : (
                  auctions.map((auction, index) => {
                    const meta = getStatusMeta(auction.status);
                    return (
                      <article
                        key={auction._id}
                        className="admin-auctions-card"
                        style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                        data-status={auction.status}
                      >
                        <div className="admin-auctions-card-accent" aria-hidden />
                        <div className="admin-auctions-card-main">
                          <div className="admin-auctions-card-header">
                            <h2 className="admin-auctions-card-title">
                              {auction.propertyId?.title || 'Untitled property'}
                            </h2>
                            <span className={`admin-auctions-pill ${meta.className}`}>
                              {meta.dot && <span className="admin-auctions-pill-dot" aria-hidden />}
                              {meta.label}
                            </span>
                          </div>

                          <div className="admin-auctions-card-chips">
                            <div className="admin-auctions-chip">
                              <span className="admin-auctions-chip-label">Current bid</span>
                              <span className="admin-auctions-chip-value">
                                {formatPrice(auction.currentBid ?? 0)}
                              </span>
                            </div>
                            <div className="admin-auctions-chip">
                              <span className="admin-auctions-chip-label">Bids</span>
                              <span className="admin-auctions-chip-value">{auction.bidCount ?? 0}</span>
                            </div>
                            <div className="admin-auctions-chip admin-auctions-chip--wide">
                              <span className="admin-auctions-chip-label">
                                <FaClock aria-hidden /> Window
                              </span>
                              <span className="admin-auctions-chip-value admin-auctions-chip-value--muted">
                                {formatDateTime(auction.startTime)} → {formatDateTime(auction.endTime)}
                              </span>
                            </div>
                          </div>

                          {auction.highestBidder && (
                            <p className="admin-auctions-card-bidder">
                              <FaUser aria-hidden className="admin-auctions-card-bidder-icon" />
                              <span>
                                Leading bidder:{' '}
                                <strong>{auction.highestBidder.fullName}</strong>
                              </span>
                            </p>
                          )}

                          {auction.status === 'completed' && auction.winner?.userId && (
                            <p className="admin-auctions-card-winner">
                              <FaTrophy aria-hidden className="admin-auctions-card-winner-icon" />
                              <span>
                                <strong>Auction winner:</strong>{' '}
                                {typeof auction.winner.userId === 'object'
                                  ? auction.winner.userId.fullName || '—'
                                  : '—'}
                                {auction.winner.winningBid != null && (
                                  <> · {formatPrice(auction.winner.winningBid)}</>
                                )}
                              </span>
                            </p>
                          )}

                          <div className="admin-auctions-card-joinkey">
                            <span className="admin-auctions-card-joinkey-label">
                              <FaKey aria-hidden /> Guest join key
                            </span>
                            <p className="admin-auctions-card-joinkey-hint">
                              Lets users without a deposit watch the live room. Bidding still requires deposit.
                            </p>
                            <div className="admin-auctions-card-joinkey-row">
                              <input
                                type="text"
                                value={joinKeyDrafts[auction._id] ?? ''}
                                onChange={(e) =>
                                  setJoinKeyDrafts((p) => ({
                                    ...p,
                                    [auction._id]: e.target.value
                                  }))
                                }
                                placeholder="New key (min 4 characters)"
                                className="admin-auctions-card-joinkey-input"
                                autoComplete="off"
                              />
                              <button
                                type="button"
                                className="admin-auctions-btn admin-auctions-btn-ghost"
                                onClick={() => saveJoinKey(auction._id)}
                              >
                                Save key
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="admin-auctions-card-actions">
                          <button
                            type="button"
                            onClick={() => navigate(`/auctions/${propertyIdFor(auction)}`)}
                            className="admin-auctions-btn admin-auctions-btn-ghost"
                          >
                            <FaEye aria-hidden /> Listing
                          </button>
                          {(auction.status === 'live' || auction.status === 'paused') && (
                            <button
                              type="button"
                              onClick={() => navigate(`/auction/${propertyIdFor(auction)}/live`)}
                              className="admin-auctions-btn admin-auctions-btn-primary"
                            >
                              <FaBroadcastTower aria-hidden /> Live room
                            </button>
                          )}
                          {auction.status === 'live' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePauseAuction(auction._id)}
                                className="admin-auctions-btn admin-auctions-btn-warning"
                              >
                                <FaPause aria-hidden /> Pause
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEndAuction(auction._id)}
                                className="admin-auctions-btn admin-auctions-btn-danger"
                              >
                                <FaStop aria-hidden /> End
                              </button>
                            </>
                          )}
                          {auction.status === 'paused' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleResumeAuction(auction._id)}
                                className="admin-auctions-btn admin-auctions-btn-success"
                              >
                                <FaPlay aria-hidden /> Resume
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEndAuction(auction._id)}
                                className="admin-auctions-btn admin-auctions-btn-danger"
                              >
                                <FaStop aria-hidden /> End
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              {pagination.totalPages > 1 && (
                <nav className="admin-auctions-pagination" aria-label="Auction list pages">
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    disabled={filters.page === 1}
                    className="admin-auctions-page-btn"
                  >
                    Previous
                  </button>
                  <span className="admin-auctions-page-info">
                    Page <strong>{pagination.currentPage}</strong> of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    disabled={filters.page === pagination.totalPages}
                    className="admin-auctions-page-btn"
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAuctions;
