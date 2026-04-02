import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import { FaTrophy, FaClock, FaCheckCircle, FaTimesCircle, FaEye } from 'react-icons/fa';
import './AuctionHistory.css';

const AuctionHistory = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState([]);
  const [filters, setFilters] = useState({ status: '' });

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    fetchAuctionHistory();
  }, [filters.status, isAuthenticated, navigate]);

  const fetchAuctionHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get('/bids/auction-history');
      
      if (response.data.success) {
        let filteredAuctions = response.data.auctions;
        
        if (filters.status) {
          filteredAuctions = filteredAuctions.filter(a => 
            a.auction.status === filters.status
          );
        }
        
        setAuctions(filteredAuctions);
      }
    } catch (error) {
      console.error('Error fetching auction history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="auction-history-status-badge auction-history-status-completed"><FaCheckCircle /> Completed</span>;
      case 'live':
        return <span className="auction-history-status-badge auction-history-status-live"><FaClock /> Live</span>;
      case 'scheduled':
        return <span className="auction-history-status-badge auction-history-status-scheduled"><FaClock /> Scheduled</span>;
      default:
        return <span className="auction-history-status-badge auction-history-status-scheduled"><FaClock /> {status}</span>;
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
        <div className="auction-history-page">
          <div className="auction-history-container">
            <div className="auction-history-loading">Loading auction history...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="auction-history-page">
        <div className="auction-history-container">
          <div className="auction-history-header">
            <h1 className="auction-history-title">Auction History</h1>
            <p className="auction-history-subtitle">View all auctions you've participated in</p>
          </div>

          <div className="auction-history-filters">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="auction-history-filter-select"
            >
              <option value="">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="auction-history-list">
            {auctions.length === 0 ? (
              <div className="auction-history-empty">No auction history found</div>
            ) : (
              auctions.map((item, idx) => {
                const auction = item.auction;
                const isWinner = item.isWinner;
                
                return (
                  <div key={auction._id || idx} className={`auction-history-item ${isWinner ? 'auction-history-item-winner' : ''}`}>
                    <div className="auction-history-item-content">
                      <div className="auction-history-item-main">
                        <div className="auction-history-item-header">
                          <h3 className="auction-history-item-title">
                            {auction.propertyId?.title || 'Property'}
                          </h3>
                          {isWinner && (
                            <span className="auction-history-winner-badge">
                              <FaTrophy /> Winner
                            </span>
                          )}
                        </div>
                        <div className="auction-history-item-details">
                          <span className="auction-history-item-detail">
                            Your Bids: <strong>{item.userBidCount}</strong>
                          </span>
                          <span className="auction-history-item-detail">
                            Highest Bid: <strong>{formatPrice(item.highestUserBid)}</strong>
                          </span>
                          {auction.currentBid && (
                            <span className="auction-history-item-detail">
                              Final Bid: <strong>{formatPrice(auction.currentBid)}</strong>
                            </span>
                          )}
                          {auction.highestBidder && (
                            <span className="auction-history-item-detail">
                              Winner: {auction.highestBidder.fullName}
                            </span>
                          )}
                          {auction.startTime && (
                            <span className="auction-history-item-detail">
                              Started: {formatDate(auction.startTime)}
                            </span>
                          )}
                        </div>
                        <div className="auction-history-item-bids">
                          <details className="auction-history-bids-details">
                            <summary>View Your Bids ({item.bids.length})</summary>
                            <div className="auction-history-bids-list">
                              {item.bids.map((bid) => (
                                <div key={bid._id} className="auction-history-bid-item">
                                  <span>{formatPrice(bid.bidAmount)}</span>
                                  <span>{formatDate(bid.timestamp)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      </div>
                      <div className="auction-history-item-status">
                        {getStatusBadge(auction.status)}
                        {auction.propertyId && (
                          <button
                            onClick={() => navigate(`/auctions/${auction.propertyId._id}`)}
                            className="auction-history-btn auction-history-btn-primary"
                          >
                            <FaEye /> View Property
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctionHistory;

