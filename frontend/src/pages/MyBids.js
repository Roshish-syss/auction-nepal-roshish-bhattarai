import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import { FaCheck, FaTimes, FaClock, FaTrophy, FaEye } from 'react-icons/fa';
import './MyBids.css';

const MyBids = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState([]);
  const [filters, setFilters] = useState({ status: '', auctionId: '' });

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    fetchBids();
  }, [filters.status, filters.auctionId, isAuthenticated, navigate]);

  const fetchBids = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.auctionId) params.append('auctionId', filters.auctionId);

      const response = await api.get(`/bids/my-bids?${params.toString()}`);
      
      if (response.data.success) {
        setBids(response.data.bids);
      }
    } catch (error) {
      console.error('Error fetching bids:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status, isHighest) => {
    if (isHighest) {
      return <span className="my-bids-status-badge my-bids-status-winning"><FaTrophy /> Highest Bid</span>;
    }
    
    switch (status) {
      case 'accepted':
        return <span className="my-bids-status-badge my-bids-status-accepted"><FaCheck /> Accepted</span>;
      case 'outbid':
        return <span className="my-bids-status-badge my-bids-status-outbid"><FaTimes /> Outbid</span>;
      case 'winning':
        return <span className="my-bids-status-badge my-bids-status-winning"><FaTrophy /> Winning</span>;
      case 'pending':
        return <span className="my-bids-status-badge my-bids-status-pending"><FaClock /> Pending</span>;
      default:
        return <span className="my-bids-status-badge my-bids-status-pending"><FaClock /> {status}</span>;
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
    return new Date(date).toLocaleString('en-NP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="my-bids-page">
          <div className="my-bids-container">
            <div className="my-bids-loading">Loading bids...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="my-bids-page">
        <div className="my-bids-container">
          <div className="my-bids-header">
            <h1 className="my-bids-title">My Bids</h1>
            <p className="my-bids-subtitle">View all your bidding activity</p>
          </div>

          <div className="my-bids-filters">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="my-bids-filter-select"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="outbid">Outbid</option>
              <option value="winning">Winning</option>
            </select>
          </div>

          <div className="my-bids-list">
            {bids.length === 0 ? (
              <div className="my-bids-empty">No bids found</div>
            ) : (
              bids.map((bid) => (
                <div key={bid._id} className={`my-bids-item ${bid.isHighest ? 'my-bids-item-winning' : ''}`}>
                  <div className="my-bids-item-content">
                    <div className="my-bids-item-main">
                      <h3 className="my-bids-item-title">
                        {bid.propertyId?.title || 'Property'}
                      </h3>
                      <div className="my-bids-item-details">
                        <span className="my-bids-item-detail">
                          Bid Amount: <strong>{formatPrice(bid.bidAmount)}</strong>
                        </span>
                        {bid.previousBid && (
                          <span className="my-bids-item-detail">
                            Previous Bid: {formatPrice(bid.previousBid)}
                          </span>
                        )}
                        <span className="my-bids-item-detail">
                          Time: {formatDate(bid.timestamp)}
                        </span>
                        {bid.auction && (
                          <span className="my-bids-item-detail">
                            Auction Status: <strong>{bid.auction.status}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="my-bids-item-status">
                      {getStatusBadge(bid.status, bid.isHighest)}
                      {bid.propertyId && (
                        <button
                          onClick={() => navigate(`/auctions/${bid.propertyId._id}`)}
                          className="my-bids-btn my-bids-btn-primary"
                        >
                          <FaEye /> View Property
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyBids;

