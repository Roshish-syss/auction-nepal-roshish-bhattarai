import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminNavigation from '../components/AdminNavigation';
import api from '../services/authService';
import { FaChartLine, FaUsers, FaHome, FaGavel, FaMoneyBillWave } from 'react-icons/fa';
import './AdminAnalytics.css';

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    userGrowth: [],
    revenueStats: [],
    propertyStats: [],
    auctionStats: []
  });

  useEffect(() => {
    if (!isAuthenticated() || user?.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchAnalytics();
  }, [isAuthenticated, user, navigate]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/analytics');
      if (response.data.success) {
        setAnalytics(response.data.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', minimumFractionDigits: 0 }).format(price || 0);

  if (loading) {
    return (
      <div>
        <AdminNavigation />
        <div className="admin-analytics-page"><div className="admin-analytics-loading">Loading analytics...</div></div>
      </div>
    );
  }

  return (
    <div>
      <AdminNavigation />
      <div className="admin-analytics-page">
        <div className="admin-analytics-container">
          <div className="admin-analytics-header">
            <h1 className="admin-analytics-title">Analytics & Reports</h1>
            <p className="admin-analytics-subtitle">Platform performance insights</p>
          </div>

          <div className="admin-analytics-stats">
            <div className="admin-analytics-stat-card">
              <FaUsers className="admin-analytics-stat-icon" />
              <h3>User Growth</h3>
              <p>{analytics.userGrowth?.length || 0} new users (last 30 days)</p>
            </div>
            <div className="admin-analytics-stat-card">
              <FaMoneyBillWave className="admin-analytics-stat-icon" />
              <h3>Total Revenue</h3>
              <p>{formatPrice(analytics.revenueStats?.reduce((sum, r) => sum + (r.total || 0), 0) || 0)}</p>
            </div>
            <div className="admin-analytics-stat-card">
              <FaHome className="admin-analytics-stat-icon" />
              <h3>Properties</h3>
              <p>{analytics.propertyStats?.length || 0} total properties</p>
            </div>
            <div className="admin-analytics-stat-card">
              <FaGavel className="admin-analytics-stat-icon" />
              <h3>Auctions</h3>
              <p>{analytics.auctionStats?.reduce((sum, a) => sum + (a.count || 0), 0) || 0} total auctions</p>
            </div>
          </div>

          <div className="admin-analytics-section">
            <h2 className="admin-analytics-section-title">Property Types Distribution</h2>
            <div className="admin-analytics-list">
              {analytics.propertyStats?.map((stat, idx) => (
                <div key={idx} className="admin-analytics-item">
                  <span className="admin-analytics-item-label">{stat._id || 'Unknown'}</span>
                  <span className="admin-analytics-item-value">{stat.count || 0} properties</span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-analytics-section">
            <h2 className="admin-analytics-section-title">Auction Status Distribution</h2>
            <div className="admin-analytics-list">
              {analytics.auctionStats?.map((stat, idx) => (
                <div key={idx} className="admin-analytics-item">
                  <span className="admin-analytics-item-label">{stat._id || 'Unknown'}</span>
                  <span className="admin-analytics-item-value">{stat.count || 0} auctions</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;

