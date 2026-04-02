import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminNavigation from '../components/AdminNavigation';
import api from '../services/authService';
import { FaCheck, FaTimes, FaEye, FaSpinner, FaWallet, FaMoneyBillWave } from 'react-icons/fa';
import './AdminDeposits.css';

const AdminDeposits = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState([]);
  const [walletTopups, setWalletTopups] = useState([]);
  const [activeTab, setActiveTab] = useState('deposits'); // 'deposits' or 'wallet-topups'
  const [filters, setFilters] = useState({
    status: '',
    page: 1
  });
  const [pagination, setPagination] = useState({
    totalPages: 1,
    currentPage: 1,
    total: 0
  });
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    if (!isAuthenticated() || user?.role !== 'admin') {
      navigate('/login');
      return;
    }
    if (activeTab === 'deposits') {
      fetchDeposits();
    } else {
      fetchWalletTopups();
    }
  }, [filters.status, filters.page, activeTab, isAuthenticated, user, navigate]);

  const fetchDeposits = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      params.append('page', filters.page);
      params.append('limit', '20');

      const response = await api.get(`/admin/deposits?${params.toString()}`);
      
      if (response.data.success) {
        setDeposits(response.data.deposits);
        setPagination({
          totalPages: response.data.totalPages,
          currentPage: response.data.currentPage,
          total: response.data.total
        });
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletTopups = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      params.append('page', filters.page);
      params.append('limit', '20');

      const response = await api.get(`/admin/wallet/topups?${params.toString()}`);
      
      if (response.data.success) {
        setWalletTopups(response.data.topups);
        setPagination({
          totalPages: response.data.totalPages,
          currentPage: response.data.currentPage,
          total: response.data.total
        });
      }
    } catch (error) {
      console.error('Error fetching wallet top-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (depositId) => {
    const confirmMsg = activeTab === 'deposits' 
      ? 'Are you sure you want to approve this deposit?'
      : 'Are you sure you want to approve this wallet top-up?';
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setProcessing(depositId);
      const endpoint = activeTab === 'deposits'
        ? `/admin/deposits/${depositId}/approve`
        : `/admin/wallet/topups/${depositId}/approve`;
      
      const response = await api.post(endpoint);

      if (response.data.success) {
        if (activeTab === 'deposits') {
          fetchDeposits();
        } else {
          fetchWalletTopups();
        }
        if (selectedDeposit?._id === depositId) {
          setSelectedDeposit(null);
        }
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error approving');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (depositId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    const confirmMsg = activeTab === 'deposits'
      ? 'Are you sure you want to reject this deposit?'
      : 'Are you sure you want to reject this wallet top-up?';

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setProcessing(depositId);
      const endpoint = activeTab === 'deposits'
        ? `/admin/deposits/${depositId}/reject`
        : `/admin/wallet/topups/${depositId}/reject`;
      
      const response = await api.post(endpoint, {
        reason: rejectionReason
      });

      if (response.data.success) {
        if (activeTab === 'deposits') {
          fetchDeposits();
        } else {
          fetchWalletTopups();
        }
        setSelectedDeposit(null);
        setRejectionReason('');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error rejecting');
    } finally {
      setProcessing(null);
    }
  };

  const handleViewDetails = async (depositId) => {
    try {
      if (activeTab === 'deposits') {
        const response = await api.get(`/admin/deposits/${depositId}`);
        if (response.data.success) {
          setSelectedDeposit(response.data.deposit);
        }
      } else {
        // For wallet top-ups, find it in the list
        const topup = walletTopups.find(t => t._id === depositId);
        if (topup) {
          setSelectedDeposit(topup);
        }
      }
    } catch (error) {
      console.error('Error fetching details:', error);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'approved': return 'admin-deposits-status-approved';
      case 'pending': return 'admin-deposits-status-pending';
      case 'rejected': return 'admin-deposits-status-rejected';
      case 'verified': return 'admin-deposits-status-verified';
      default: return 'admin-deposits-status-pending';
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
        <AdminNavigation />
        <div className="admin-deposits-page">
          <div className="admin-deposits-loading">Loading deposits...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminNavigation />
      <div className="admin-deposits-page">
        <div className="admin-deposits-container">
          {/* Header */}
          <div className="admin-deposits-header">
            <h1 className="admin-deposits-title">Deposit & Wallet Verification</h1>
            <p className="admin-deposits-subtitle">Review and verify user deposits and wallet top-ups</p>
          </div>

          {/* Tabs */}
          <div className="admin-deposits-tabs">
            <button
              className={`admin-deposits-tab ${activeTab === 'deposits' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('deposits');
                setFilters({ ...filters, page: 1 });
              }}
            >
              <FaMoneyBillWave /> Auction Deposits
            </button>
            <button
              className={`admin-deposits-tab ${activeTab === 'wallet-topups' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('wallet-topups');
                setFilters({ ...filters, page: 1 });
              }}
            >
              <FaWallet /> Wallet Top-ups
            </button>
          </div>

          {/* Filters */}
          <div className="admin-deposits-filters">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
              className="admin-deposits-filter-select"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Deposits/Topups List */}
          <div className="admin-deposits-list">
            {activeTab === 'deposits' ? (
              deposits.length === 0 ? (
                <div className="admin-deposits-empty">No deposits found</div>
              ) : (
                deposits.map((deposit) => (
                  <div key={deposit._id} className="admin-deposits-item">
                    <div className="admin-deposits-item-content">
                      <div className="admin-deposits-item-info">
                        <h3 className="admin-deposits-item-title">
                          {deposit.propertyId?.title || 'Property'}
                        </h3>
                        <p className="admin-deposits-item-user">
                          User: {deposit.userId?.fullName || 'N/A'} ({deposit.userId?.email || 'N/A'})
                        </p>
                        <div className="admin-deposits-item-details">
                          <span className="admin-deposits-item-detail">
                            Amount: <strong>{formatPrice(deposit.amount)}</strong>
                          </span>
                          <span className="admin-deposits-item-detail">
                            Method: <strong>{deposit.paymentMethod?.toUpperCase()}</strong>
                          </span>
                          <span className="admin-deposits-item-detail">
                            Date: {formatDate(deposit.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="admin-deposits-item-actions">
                        <span className={`admin-deposits-status-badge ${getStatusBadgeClass(deposit.status)}`}>
                          {deposit.status}
                        </span>
                        <button
                          onClick={() => handleViewDetails(deposit._id)}
                          className="admin-deposits-btn admin-deposits-btn-secondary"
                        >
                          <FaEye /> View
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              walletTopups.length === 0 ? (
                <div className="admin-deposits-empty">No wallet top-ups found</div>
              ) : (
                walletTopups.map((topup) => (
                  <div key={topup._id} className="admin-deposits-item">
                    <div className="admin-deposits-item-content">
                      <div className="admin-deposits-item-info">
                        <h3 className="admin-deposits-item-title">
                          Wallet Top-up
                        </h3>
                        <p className="admin-deposits-item-user">
                          User: {topup.userName || 'N/A'} ({topup.userEmail || 'N/A'})
                        </p>
                        <div className="admin-deposits-item-details">
                          <span className="admin-deposits-item-detail">
                            Amount: <strong>{formatPrice(topup.amount)}</strong>
                          </span>
                          <span className="admin-deposits-item-detail">
                            Method: <strong>{topup.paymentMethod?.toUpperCase()}</strong>
                          </span>
                          <span className="admin-deposits-item-detail">
                            Date: {formatDate(topup.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="admin-deposits-item-actions">
                        <span className={`admin-deposits-status-badge ${getStatusBadgeClass(topup.status)}`}>
                          {topup.status}
                        </span>
                        <button
                          onClick={() => handleViewDetails(topup._id)}
                          className="admin-deposits-btn admin-deposits-btn-secondary"
                        >
                          <FaEye /> View
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="admin-deposits-pagination">
              <button
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={filters.page === 1}
                className="admin-deposits-page-btn"
              >
                Previous
              </button>
              <span className="admin-deposits-page-info">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={filters.page === pagination.totalPages}
                className="admin-deposits-page-btn"
              >
                Next
              </button>
            </div>
          )}

          {/* Detail Modal */}
          {selectedDeposit && (
            <div className="admin-deposits-modal-overlay" onClick={() => setSelectedDeposit(null)}>
              <div className="admin-deposits-modal" onClick={(e) => e.stopPropagation()}>
                <div className="admin-deposits-modal-header">
                  <h2>Deposit Details</h2>
                  <button
                    onClick={() => setSelectedDeposit(null)}
                    className="admin-deposits-modal-close"
                  >
                    <FaTimes />
                  </button>
                </div>
                
                <div className="admin-deposits-modal-body">
                  <div className="admin-deposits-detail-section">
                    <h3>User Information</h3>
                    <p><strong>Name:</strong> {activeTab === 'deposits' ? selectedDeposit.userId?.fullName : selectedDeposit.userName}</p>
                    <p><strong>Email:</strong> {activeTab === 'deposits' ? selectedDeposit.userId?.email : selectedDeposit.userEmail}</p>
                    <p><strong>Phone:</strong> {activeTab === 'deposits' ? selectedDeposit.userId?.phoneNumber : selectedDeposit.userPhone}</p>
                  </div>

                  {activeTab === 'deposits' && (
                    <div className="admin-deposits-detail-section">
                      <h3>Property Information</h3>
                      <p><strong>Property:</strong> {selectedDeposit.propertyId?.title}</p>
                      <p><strong>Base Price:</strong> {formatPrice(selectedDeposit.propertyId?.basePrice || 0)}</p>
                    </div>
                  )}

                  <div className="admin-deposits-detail-section">
                    <h3>{activeTab === 'deposits' ? 'Deposit' : 'Top-up'} Information</h3>
                    <p><strong>Amount:</strong> {formatPrice(selectedDeposit.amount)}</p>
                    <p><strong>Payment Method:</strong> {selectedDeposit.paymentMethod?.toUpperCase()}</p>
                    <p><strong>Phone Number:</strong> {activeTab === 'deposits' ? selectedDeposit.phoneNumber : selectedDeposit.phoneNumber}</p>
                    <p><strong>Status:</strong> 
                      <span className={`admin-deposits-status-badge ${getStatusBadgeClass(selectedDeposit.status)}`}>
                        {selectedDeposit.status}
                      </span>
                    </p>
                    <p><strong>Submitted:</strong> {formatDate(selectedDeposit.createdAt)}</p>
                  </div>

                  <div className="admin-deposits-detail-section">
                    <h3>Payment Proof</h3>
                    {(selectedDeposit.paymentProof?.url || selectedDeposit.paymentProof) ? (
                      <img
                        src={selectedDeposit.paymentProof?.url || selectedDeposit.paymentProof}
                        alt="Payment proof"
                        className="admin-deposits-payment-proof"
                      />
                    ) : (
                      <p>No payment proof available</p>
                    )}
                  </div>

                  {selectedDeposit.rejectionReason && (
                    <div className="admin-deposits-detail-section admin-deposits-rejection-reason">
                      <h3>Rejection Reason</h3>
                      <p>{selectedDeposit.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {selectedDeposit.status === 'pending' && (
                  <div className="admin-deposits-modal-footer">
                    <div className="admin-deposits-reject-form">
                      <input
                        type="text"
                        placeholder="Rejection reason (required for rejection)"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="admin-deposits-reject-input"
                      />
                    </div>
                    <div className="admin-deposits-modal-actions">
                      <button
                        onClick={() => handleApprove(selectedDeposit._id)}
                        disabled={processing === selectedDeposit._id}
                        className="admin-deposits-btn admin-deposits-btn-success"
                      >
                        {processing === selectedDeposit._id ? (
                          <><FaSpinner className="admin-deposits-spinner" /> Processing...</>
                        ) : (
                          <><FaCheck /> Approve</>
                        )}
                      </button>
                      <button
                        onClick={() => handleReject(selectedDeposit._id)}
                        disabled={processing === selectedDeposit._id || (!rejectionReason.trim() && activeTab === 'deposits')}
                        className="admin-deposits-btn admin-deposits-btn-danger"
                      >
                        {processing === selectedDeposit._id ? (
                          <><FaSpinner className="admin-deposits-spinner" /> Processing...</>
                        ) : (
                          <><FaTimes /> Reject</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AdminDeposits;

