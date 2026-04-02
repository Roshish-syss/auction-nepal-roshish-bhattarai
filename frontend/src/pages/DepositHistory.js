import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import { FaCheck, FaClock, FaTimes, FaExclamationTriangle, FaEye, FaMoneyBillWave, FaFilter, FaHome, FaSync, FaHistory } from 'react-icons/fa';
import './DepositHistory.css';

const DepositHistory = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState([]);
  const [filters, setFilters] = useState({ status: '' });
  const [balance, setBalance] = useState({
    totalApproved: 0,
    totalPending: 0,
    totalRejected: 0
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    fetchDeposits();
  }, [filters.status, isAuthenticated, navigate]);

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const [depositsRes, balanceRes] = await Promise.all([
        api.get('/deposits/my-deposits'),
        api.get('/deposits/balance').catch(() => ({ data: { success: false } }))
      ]);
      
      if (depositsRes.data.success) {
        let filteredDeposits = depositsRes.data.deposits;
        
        if (filters.status) {
          filteredDeposits = filteredDeposits.filter(d => d.status === filters.status);
        }
        
        setDeposits(filteredDeposits);
      }
      
      if (balanceRes.data.success) {
        setBalance({
          totalApproved: balanceRes.data.balance.totalApproved || 0,
          totalPending: balanceRes.data.balance.totalPending || 0,
          totalRejected: balanceRes.data.balance.totalRejected || 0,
          totalRefunded: balanceRes.data.balance.totalRefunded || 0
        });
      } else if (depositsRes.data.success) {
        // Fallback to deposits response
        setBalance({
          totalApproved: depositsRes.data.totalApproved || 0,
          totalPending: depositsRes.data.totalPending || 0,
          totalRejected: depositsRes.data.totalRejected || 0,
          totalRefunded: 0
        });
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
      case 'verified':
        return <span className="deposit-history-status-badge deposit-history-status-approved"><FaCheck /> Approved</span>;
      case 'pending':
        return <span className="deposit-history-status-badge deposit-history-status-pending"><FaClock /> Pending</span>;
      case 'rejected':
        return <span className="deposit-history-status-badge deposit-history-status-rejected"><FaTimes /> Rejected</span>;
      case 'refunded':
        return <span className="deposit-history-status-badge deposit-history-status-refunded"><FaCheck /> Refunded</span>;
      default:
        return <span className="deposit-history-status-badge deposit-history-status-pending"><FaClock /> {status}</span>;
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
        <div className="deposit-history-page">
          <div className="deposit-history-loading">Loading deposits...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="deposit-history-page">
        <div className="deposit-history-container">
          {/* Header */}
          <div className="deposit-history-header">
            <div className="deposit-history-header-content">
              <h1 className="deposit-history-title">
                <FaHistory className="deposit-history-title-icon" />
                Deposit History
              </h1>
              <p className="deposit-history-subtitle">View all your deposit transactions</p>
            </div>
            <button
              onClick={fetchDeposits}
              className="deposit-history-refresh-btn"
              title="Refresh"
            >
              <FaSync /> Refresh
            </button>
          </div>

          {/* Balance Cards */}
          <div className="deposit-history-balance-cards">
            <div className="deposit-history-balance-card deposit-history-balance-card-primary">
              <div className="deposit-history-balance-background"></div>
              <div className="deposit-history-balance-content">
                <div className="deposit-history-balance-icon-wrapper">
                  <FaMoneyBillWave className="deposit-history-balance-icon" />
                </div>
                <div className="deposit-history-balance-info">
                  <p className="deposit-history-balance-label">Approved Deposits</p>
                  <h2 className="deposit-history-balance-amount">
                    {formatPrice(balance.totalApproved)}
                  </h2>
                </div>
              </div>
            </div>
            
            {balance.totalPending > 0 && (
              <div className="deposit-history-balance-card deposit-history-balance-card-pending">
                <div className="deposit-history-balance-icon-wrapper">
                  <FaClock className="deposit-history-balance-icon" />
                </div>
                <div className="deposit-history-balance-info">
                  <p className="deposit-history-balance-label">Pending</p>
                  <h3 className="deposit-history-balance-amount-small">
                    {formatPrice(balance.totalPending)}
                  </h3>
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="deposit-history-filters">
            <div className="deposit-history-filter-wrapper">
              <FaFilter className="deposit-history-filter-icon" />
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="deposit-history-filter-select"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            {deposits.length > 0 && (
              <span className="deposit-history-count">
                {deposits.length} {deposits.length === 1 ? 'deposit' : 'deposits'}
              </span>
            )}
          </div>

          {/* Deposits List */}
          <div className="deposit-history-list">
            {deposits.length === 0 ? (
              <div className="deposit-history-empty">
                <div className="deposit-history-empty-icon-wrapper">
                  <FaExclamationTriangle className="deposit-history-empty-icon" />
                </div>
                <h3 className="deposit-history-empty-title">No deposits found</h3>
                <p className="deposit-history-empty-text">
                  {filters.status 
                    ? `No deposits with status "${filters.status}"` 
                    : 'You haven\'t made any deposits yet'}
                </p>
                {filters.status && (
                  <button
                    onClick={() => setFilters({ status: '' })}
                    className="deposit-history-btn deposit-history-btn-primary"
                    style={{ marginTop: '1rem' }}
                  >
                    View All Deposits
                  </button>
                )}
              </div>
            ) : (
              deposits.map((deposit) => (
                <div key={deposit._id} className="deposit-history-item">
                  <div className="deposit-history-item-content">
                    <div className="deposit-history-item-main">
                      <div className="deposit-history-item-header">
                        <h3 className="deposit-history-item-title">
                          {deposit.propertyId?.title || 'Property'}
                        </h3>
                        <span className="deposit-history-item-amount">
                          {formatPrice(deposit.amount)}
                        </span>
                      </div>
                      
                      <div className="deposit-history-item-meta">
                        <div className="deposit-history-item-meta-item">
                          <span className="deposit-history-meta-label">Payment Method:</span>
                          <span className="deposit-history-meta-value">
                            {deposit.paymentMethod === 'wallet' ? '💰 Wallet' : deposit.paymentMethod?.toUpperCase() || 'N/A'}
                          </span>
                        </div>
                        <div className="deposit-history-item-meta-item">
                          <span className="deposit-history-meta-label">Date:</span>
                          <span className="deposit-history-meta-value">{formatDate(deposit.createdAt)}</span>
                        </div>
                      </div>

                      {deposit.rejectionReason && (
                        <div className="deposit-history-rejection-reason">
                          <FaTimes className="deposit-history-rejection-icon" />
                          <div>
                            <strong>Rejection Reason:</strong>
                            <p>{deposit.rejectionReason}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="deposit-history-item-actions">
                      {getStatusBadge(deposit.status)}
                      <div className="deposit-history-item-buttons">
                        {deposit.paymentProof?.url && deposit.paymentProof.url !== 'wallet_balance' && (
                          <button
                            onClick={() => window.open(deposit.paymentProof.url, '_blank')}
                            className="deposit-history-btn deposit-history-btn-secondary"
                          >
                            <FaEye /> View Proof
                          </button>
                        )}
                        {deposit.propertyId && (
                          <button
                            onClick={() => navigate(`/auctions/${deposit.propertyId._id || deposit.propertyId}`)}
                            className="deposit-history-btn deposit-history-btn-primary"
                          >
                            <FaHome /> View Property
                          </button>
                        )}
                      </div>
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

export default DepositHistory;

