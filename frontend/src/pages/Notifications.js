import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import { FaCheck, FaTrash, FaBell, FaCircle, FaTag, FaMoneyBillWave, FaCheckCircle, FaHammer, FaWallet } from 'react-icons/fa';
import './Notifications.css';

const Notifications = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [filters, setFilters] = useState({ type: '' });
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [filters.type, isAuthenticated, navigate]);

  const bumpNavUnread = () => {
    window.dispatchEvent(new Event('auctionnepal-notifications'));
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications?limit=100');
      
      if (response.data.success) {
        let filtered = response.data.notifications;
        
        if (filters.type) {
          filtered = filtered.filter(n => n.type === filters.type);
        }
        
        setNotifications(filtered);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      await fetchNotifications();
      bumpNavUnread();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await api.put('/notifications/read-all');
      await fetchNotifications();
      bumpNavUnread();
    } catch (error) {
      console.error('Error marking all read:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      await fetchNotifications();
      bumpNavUnread();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
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

  const getTypeIcon = (type) => {
    const iconClass = "notifications-type-icon";
    switch (type) {
      case 'bid':
        return <FaTag className={iconClass} />;
      case 'deposit':
        return <FaMoneyBillWave className={iconClass} />;
      case 'kyc':
        return <FaCheckCircle className={iconClass} />;
      case 'auction':
        return <FaHammer className={iconClass} />;
      case 'wallet':
        return <FaWallet className={iconClass} />;
      case 'system':
        return <FaBell className={iconClass} />;
      default:
        return <FaBell className={iconClass} />;
    }
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="notifications-page">
          <div className="notifications-loading">Loading notifications...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="notifications-page">
        <div className="notifications-container">
          <div className="notifications-header">
            <div className="notifications-header-text">
              <h1 className="notifications-title">Notifications</h1>
              <p className="notifications-subtitle">Bids, deposits, KYC, wallet, and auction updates</p>
            </div>
            <div className="notifications-header-actions">
              <button
                type="button"
                className="notifications-mark-all"
                onClick={handleMarkAllRead}
                disabled={
                  markingAll ||
                  notifications.length === 0 ||
                  notifications.every((n) => n.read)
                }
              >
                {markingAll ? '…' : 'Mark all read'}
              </button>
            </div>
          </div>

          <div className="notifications-filters">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="notifications-filter-select"
            >
              <option value="">All Types</option>
              <option value="bid">Bids</option>
              <option value="deposit">Deposits</option>
              <option value="kyc">KYC</option>
              <option value="auction">Auctions</option>
              <option value="wallet">Wallet</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="notifications-empty">
                <FaBell className="notifications-empty-icon" />
                <p>No notifications found</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id || notification.id}
                  className={`notifications-item ${!notification.read ? 'notifications-item-unread' : ''}`}
                  onClick={() => notification.link && navigate(notification.link)}
                  style={{ cursor: notification.link ? 'pointer' : 'default' }}
                >
                  <div className="notifications-item-content">
                    <div className="notifications-item-icon">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="notifications-item-main">
                      <div className="notifications-item-header">
                        <h3 className="notifications-item-title">{notification.title}</h3>
                        {!notification.read && <FaCircle className="notifications-unread-dot" />}
                      </div>
                      <p className="notifications-item-message">{notification.message}</p>
                      <p className="notifications-item-time">{formatDate(notification.createdAt)}</p>
                    </div>
                    <div className="notifications-item-actions" onClick={(e) => e.stopPropagation()}>
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification._id || notification.id)}
                          className="notifications-btn notifications-btn-secondary"
                          title="Mark as read"
                        >
                          <FaCheck />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification._id || notification.id)}
                        className="notifications-btn notifications-btn-danger"
                        title="Delete"
                      >
                        <FaTrash />
                      </button>
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

export default Notifications;

