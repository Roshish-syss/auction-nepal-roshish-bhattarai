import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminNavigation from '../components/AdminNavigation';
import api from '../services/authService';
import { FaUsers, FaHome, FaGavel, FaClipboardCheck, FaCheckCircle, FaExclamationTriangle, FaChartLine, FaEye } from 'react-icons/fa';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProperties: 0,
    totalAuctions: 0,
    pendingKYCs: 0,
    pendingDeposits: 0,
    totalRevenue: 0,
    activeAuctions: 0
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }

    // Check if user is admin
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }

    fetchDashboardStats();
  }, [isAuthenticated, user, navigate]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/dashboard/stats');
      
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
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
        <AdminNavigation />
        <div className="admin-dashboard-page">
          <div className="admin-dashboard-loading">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdminNavigation />
      <div className="admin-dashboard-page">
        <div className="admin-dashboard-container">
          {/* Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">Admin Dashboard</h1>
            <p className="admin-dashboard-subtitle">Welcome back, {user?.fullName}</p>
          </div>

          {/* Stats Grid */}
          <div className="admin-dashboard-stats-grid">
            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-icon admin-dashboard-stat-icon-blue">
                <FaUsers />
              </div>
              <div className="admin-dashboard-stat-content">
                <p className="admin-dashboard-stat-label">Total Users</p>
                <p className="admin-dashboard-stat-value">{stats.totalUsers}</p>
              </div>
              <button
                onClick={() => navigate('/admin/users')}
                className="admin-dashboard-stat-action"
              >
                View All
              </button>
            </div>

            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-icon admin-dashboard-stat-icon-green">
                <FaHome />
              </div>
              <div className="admin-dashboard-stat-content">
                <p className="admin-dashboard-stat-label">Total Properties</p>
                <p className="admin-dashboard-stat-value">{stats.totalProperties}</p>
              </div>
              <button
                onClick={() => navigate('/admin/properties')}
                className="admin-dashboard-stat-action"
              >
                Manage
              </button>
            </div>

            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-icon admin-dashboard-stat-icon-purple">
                <FaGavel />
              </div>
              <div className="admin-dashboard-stat-content">
                <p className="admin-dashboard-stat-label">Total Auctions</p>
                <p className="admin-dashboard-stat-value">{stats.totalAuctions}</p>
              </div>
              <button
                onClick={() => navigate('/admin/auctions')}
                className="admin-dashboard-stat-action"
              >
                Monitor
              </button>
            </div>

            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-icon admin-dashboard-stat-icon-orange">
                <FaClipboardCheck />
              </div>
              <div className="admin-dashboard-stat-content">
                <p className="admin-dashboard-stat-label">Pending KYCs</p>
                <p className="admin-dashboard-stat-value">{stats.pendingKYCs}</p>
              </div>
              <button
                onClick={() => navigate('/admin/kyc')}
                className="admin-dashboard-stat-action"
              >
                Review
              </button>
            </div>

            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-icon admin-dashboard-stat-icon-red">
                <FaExclamationTriangle />
              </div>
              <div className="admin-dashboard-stat-content">
                <p className="admin-dashboard-stat-label">Pending Deposits</p>
                <p className="admin-dashboard-stat-value">{stats.pendingDeposits || 0}</p>
                {stats.pendingWalletTopups > 0 && (
                  <p className="admin-dashboard-stat-sublabel">
                    {stats.pendingWalletTopups} wallet top-up{stats.pendingWalletTopups > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate('/admin/deposits')}
                className="admin-dashboard-stat-action"
              >
                Verify
              </button>
            </div>

            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-icon admin-dashboard-stat-icon-teal">
                <FaChartLine />
              </div>
              <div className="admin-dashboard-stat-content">
                <p className="admin-dashboard-stat-label">Total Revenue</p>
                <p className="admin-dashboard-stat-value">{formatPrice(stats.totalRevenue)}</p>
              </div>
              <button
                onClick={() => navigate('/admin/analytics')}
                className="admin-dashboard-stat-action"
              >
                View Report
              </button>
            </div>

            <div className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-icon admin-dashboard-stat-icon-indigo">
                <FaEye />
              </div>
              <div className="admin-dashboard-stat-content">
                <p className="admin-dashboard-stat-label">Active Auctions</p>
                <p className="admin-dashboard-stat-value">{stats.activeAuctions}</p>
              </div>
              <button
                onClick={() => navigate('/admin/auctions?status=live')}
                className="admin-dashboard-stat-action"
              >
                View Live
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="admin-dashboard-section">
            <h2 className="admin-dashboard-section-title">Quick Actions</h2>
            <div className="admin-dashboard-actions-grid">
              <button
                onClick={() => navigate('/admin/properties/new')}
                className="admin-dashboard-action-card"
              >
                <FaHome className="admin-dashboard-action-icon" />
                <span>Create Property</span>
              </button>
              <button
                onClick={() => navigate('/admin/kyc')}
                className="admin-dashboard-action-card"
              >
                <FaCheckCircle className="admin-dashboard-action-icon" />
                <span>Review KYCs</span>
              </button>
              <button
                onClick={() => navigate('/admin/deposits')}
                className="admin-dashboard-action-card"
              >
                <FaClipboardCheck className="admin-dashboard-action-icon" />
                <span>Verify Deposits</span>
              </button>
              <button
                onClick={() => navigate('/admin/analytics')}
                className="admin-dashboard-action-card"
              >
                <FaChartLine className="admin-dashboard-action-icon" />
                <span>View Analytics</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

