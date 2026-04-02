import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import { FaCheckCircle, FaHome, FaTrophy, FaClock, FaSearch, FaClipboardList, FaCreditCard, FaScroll, FaUser, FaIdCard, FaBullseye, FaMoneyBillWave, FaWallet } from 'react-icons/fa';
import './Dashboard.css';

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    bidsPlaced: 0,
    auctionsJoined: 0,
    wonAuctions: 0,
    activeBids: 0
  });
  const [kycStatus, setKycStatus] = useState(null);
  const [depositStatus, setDepositStatus] = useState(null);
  const [depositBalance, setDepositBalance] = useState({
    totalApproved: 0,
    totalPending: 0,
    totalRejected: 0,
    totalRefunded: 0
  });
  const [walletBalance, setWalletBalance] = useState(0);
  const [recentActivity, setRecentActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    // Redirect admins to admin dashboard
    if (user?.role === 'admin') {
      navigate('/admin/dashboard');
      return;
    }
    
    fetchDashboardData();
  }, [isAuthenticated, user, navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch user profile, stats, deposit balance, and wallet balance
      const [profileRes, kycRes, balanceRes, walletRes] = await Promise.all([
        api.get('/users/profile'),
        api.get('/kyc/status'),
        api.get('/deposits/balance'),
        api.get('/wallet/balance')
      ]);

      if (profileRes.data.success) {
        const userData = profileRes.data.user;
        setDepositStatus({
          eligible: userData.depositEligible || false,
          amount: userData.depositData?.amount || 0,
          status: userData.depositData?.status || 'none'
        });
      }

      if (kycRes.data.success) {
        setKycStatus(kycRes.data.kyc);
      }

      if (balanceRes.data.success) {
        setDepositBalance(balanceRes.data.balance);
      }

      if (walletRes.data.success) {
        setWalletBalance(walletRes.data.balance);
      }

      // TODO: Replace with actual API calls when endpoints are ready
      // For now, using mock data
      setStats({
        bidsPlaced: 0,
        auctionsJoined: 0,
        wonAuctions: 0,
        activeBids: 0
      });

      setRecentActivity([
        // Mock activity - replace with actual API call
        { type: 'bid', message: 'You placed a bid on Property #123', time: '2 hours ago' },
        { type: 'auction', message: 'Auction for Property #456 started', time: '5 hours ago' },
      ]);

      setNotifications([
        { id: 1, type: 'info', message: 'Your KYC is pending approval', read: false, time: '1 day ago' },
        { id: 2, type: 'success', message: 'You won the auction for Property #789', read: false, time: '3 days ago' },
      ]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getKYCStatusBadge = () => {
    if (!kycStatus || kycStatus.status === 'pending') {
      // Check if any step is completed
      if (kycStatus?.emailVerified || kycStatus?.documentUploaded) {
        return { class: 'dashboard-status-warning', text: 'In Progress', action: 'Complete KYC' };
      }
      return { class: 'dashboard-status-pending', text: 'Pending', action: 'Complete KYC' };
    }
    if (kycStatus.status === 'approved') {
      return { class: 'dashboard-status-approved', text: 'Approved', action: null };
    }
    if (kycStatus.status === 'rejected') {
      return { class: 'dashboard-status-rejected', text: 'Rejected', action: 'Resubmit' };
    }
    if (kycStatus.status === 'under_review' || kycStatus.status === 'email_verified' || kycStatus.status === 'document_uploaded') {
      return { class: 'dashboard-status-warning', text: 'Under Review', action: null };
    }
    return { class: 'dashboard-status-pending', text: 'In Progress', action: 'Complete KYC' };
  };

  const getDepositStatusBadge = () => {
    if (!depositStatus || depositStatus.status === 'none') {
      return { class: 'dashboard-status-pending', text: 'Not Paid', action: 'Pay Deposit' };
    }
    if (depositStatus.status === 'pending') {
      return { class: 'dashboard-status-warning', text: 'Pending', action: null };
    }
    if (depositStatus.status === 'approved') {
      return { class: 'dashboard-status-approved', text: 'Approved', action: null };
    }
    return { class: 'dashboard-status-info', text: 'Refunded', action: null };
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      minimumFractionDigits: 0
    }).format(price);
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="dashboard-page">
          <div className="dashboard-loading">Loading...</div>
        </div>
      </div>
    );
  }

  const kycBadge = getKYCStatusBadge();
  const depositBadge = getDepositStatusBadge();

  return (
    <div>
      <Navigation />
      <div className="dashboard-page">
        <div className="dashboard-container">
          {/* Header */}
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Welcome back, {user?.fullName || 'User'}!</h1>
              <p className="dashboard-subtitle">Here's an overview of your account</p>
            </div>
            <div className="dashboard-notifications-wrapper">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="dashboard-notifications-btn"
              >
                🔔
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="dashboard-notification-badge">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="dashboard-notifications-dropdown">
                  <div className="dashboard-notifications-header">
                    <h3>Notifications</h3>
                    <button onClick={() => setShowNotifications(false)}>×</button>
                  </div>
                  <div className="dashboard-notifications-list">
                    {notifications.length === 0 ? (
                      <p className="dashboard-notifications-empty">No notifications</p>
                    ) : (
                      notifications.map((notification) => (
                        <div key={notification.id} className={`dashboard-notification-item ${notification.type}`}>
                          <p>{notification.message}</p>
                          <span>{notification.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Status Cards */}
          <div className="dashboard-status-cards">
            <div className="dashboard-status-card">
              <div className="dashboard-status-icon"><FaIdCard /></div>
              <div className="dashboard-status-content">
                <h3 className="dashboard-status-label">KYC Status</h3>
                <span className={`dashboard-status-badge ${kycBadge.class}`}>
                  {kycBadge.text}
                </span>
                {kycBadge.action && (
                  <button
                    onClick={() => navigate('/kyc-verification')}
                    className="dashboard-status-action"
                  >
                    {kycBadge.action} →
                  </button>
                )}
              </div>
            </div>

            <div className="dashboard-status-card">
              <div className="dashboard-status-icon"><FaMoneyBillWave /></div>
              <div className="dashboard-status-content">
                <h3 className="dashboard-status-label">Deposit Wallet</h3>
                <div className="dashboard-wallet-balance">
                  <p className="dashboard-wallet-amount">
                    {new Intl.NumberFormat('en-NP', {
                      style: 'currency',
                      currency: 'NPR',
                      minimumFractionDigits: 0
                    }).format(depositBalance.totalApproved)}
                  </p>
                  <span className="dashboard-wallet-label">Approved Balance</span>
                </div>
                {depositBalance.totalPending > 0 && (
                  <p className="dashboard-wallet-pending">
                    Pending: {new Intl.NumberFormat('en-NP', {
                      style: 'currency',
                      currency: 'NPR',
                      minimumFractionDigits: 0
                    }).format(depositBalance.totalPending)}
                  </p>
                )}
                <button
                  onClick={() => navigate('/deposits')}
                  className="dashboard-status-action"
                >
                  View History →
                </button>
              </div>
            </div>

            <div className="dashboard-status-card dashboard-wallet-card">
              <div className="dashboard-status-icon"><FaWallet /></div>
              <div className="dashboard-status-content">
                <h3 className="dashboard-status-label">Wallet Balance</h3>
                <div className="dashboard-wallet-balance">
                  <p className="dashboard-wallet-amount">
                    {formatPrice(walletBalance)}
                  </p>
                  <span className="dashboard-wallet-label">Available Balance</span>
                </div>
                <button
                  onClick={() => navigate('/wallet')}
                  className="dashboard-status-action"
                >
                  Top Up →
                </button>
              </div>
            </div>

            <div className="dashboard-status-card">
              <div className="dashboard-status-icon"><FaCheckCircle /></div>
              <div className="dashboard-status-content">
                <h3 className="dashboard-status-label">Account Status</h3>
                <span className="dashboard-status-badge dashboard-status-approved">
                  Active
                </span>
                <p className="dashboard-status-email">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Quick Stats and Quick Links - Side by Side */}
          <div className="dashboard-stats-links-container">
            {/* Quick Stats */}
            <div className="dashboard-section dashboard-section-half">
              <h2 className="dashboard-section-title">Quick Stats</h2>
              <div className="dashboard-stats-grid-2x2">
                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-icon"><FaBullseye /></div>
                  <div className="dashboard-stat-content">
                    <h3 className="dashboard-stat-value">{stats.bidsPlaced}</h3>
                    <p className="dashboard-stat-label">Bids Placed</p>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-icon"><FaHome /></div>
                  <div className="dashboard-stat-content">
                    <h3 className="dashboard-stat-value">{stats.auctionsJoined}</h3>
                    <p className="dashboard-stat-label">Auctions Joined</p>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-icon"><FaTrophy /></div>
                  <div className="dashboard-stat-content">
                    <h3 className="dashboard-stat-value">{stats.wonAuctions}</h3>
                    <p className="dashboard-stat-label">Won Auctions</p>
                  </div>
                </div>

                <div className="dashboard-stat-card">
                  <div className="dashboard-stat-icon"><FaClock /></div>
                  <div className="dashboard-stat-content">
                    <h3 className="dashboard-stat-value">{stats.activeBids}</h3>
                    <p className="dashboard-stat-label">Active Bids</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="dashboard-section dashboard-section-half">
              <h2 className="dashboard-section-title">Quick Links</h2>
              <div className="dashboard-quick-links-2x2">
                <button
                  onClick={() => navigate('/auctions')}
                  className="dashboard-quick-link"
                >
                  <span className="dashboard-quick-link-icon"><FaSearch /></span>
                  <span className="dashboard-quick-link-text">Browse Auctions</span>
                </button>
                <button
                  onClick={() => navigate('/my-bids')}
                  className="dashboard-quick-link"
                >
                  <span className="dashboard-quick-link-icon"><FaClipboardList /></span>
                  <span className="dashboard-quick-link-text">My Bids</span>
                </button>
                <button
                  onClick={() => navigate('/deposits')}
                  className="dashboard-quick-link"
                >
                  <span className="dashboard-quick-link-icon"><FaCreditCard /></span>
                  <span className="dashboard-quick-link-text">Deposit History</span>
                </button>
                <button
                  onClick={() => navigate('/auction-history')}
                  className="dashboard-quick-link"
                >
                  <span className="dashboard-quick-link-icon"><FaScroll /></span>
                  <span className="dashboard-quick-link-text">Auction History</span>
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity and Account Overview - Side by Side */}
          <div className="dashboard-stats-links-container">
            {/* Recent Activity */}
            <div className="dashboard-section dashboard-section-half">
              <h2 className="dashboard-section-title">Recent Activity</h2>
              <div className="dashboard-activity-list-2x1">
                {recentActivity.length === 0 ? (
                  <div className="dashboard-activity-empty">
                    <p>No recent activity</p>
                    <button
                      onClick={() => navigate('/auctions')}
                      className="dashboard-btn dashboard-btn-primary"
                    >
                      Browse Auctions
                    </button>
                  </div>
                ) : (
                  recentActivity.slice(0, 2).map((activity, index) => (
                    <div key={index} className="dashboard-activity-item">
                      <div className={`dashboard-activity-icon ${activity.type}`}>
                        {activity.type === 'bid' ? <FaBullseye /> : <FaHome />}
                      </div>
                      <div className="dashboard-activity-content">
                        <p className="dashboard-activity-message">{activity.message}</p>
                        <span className="dashboard-activity-time">{activity.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Account Overview */}
            <div className="dashboard-section dashboard-section-half">
              <h2 className="dashboard-section-title">Account Overview</h2>
              <div className="dashboard-overview-2x2">
                <div className="dashboard-overview-item">
                  <span className="dashboard-overview-label">Full Name:</span>
                  <span className="dashboard-overview-value">{user?.fullName || 'N/A'}</span>
                </div>
                <div className="dashboard-overview-item">
                  <span className="dashboard-overview-label">Email:</span>
                  <span className="dashboard-overview-value">{user?.email || 'N/A'}</span>
                </div>
                <div className="dashboard-overview-item">
                  <span className="dashboard-overview-label">Phone:</span>
                  <span className="dashboard-overview-value">{user?.phoneNumber || 'N/A'}</span>
                </div>
                <div className="dashboard-overview-item">
                  <span className="dashboard-overview-label">Member Since:</span>
                  <span className="dashboard-overview-value">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

