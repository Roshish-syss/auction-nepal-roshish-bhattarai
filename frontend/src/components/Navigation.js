import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import api from '../services/authService';
import socketService from '../services/socketService';
import { FaHome, FaUser, FaGavel, FaMoneyBillWave, FaHistory, FaBell, FaComments, FaSignOutAlt, FaWallet } from 'react-icons/fa';
import './Navigation.css';

const Navigation = () => {
  const { user, logout, isAuthenticated, getInitials } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPreview, setNotifPreview] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [markingAllNotif, setMarkingAllNotif] = useState(false);
  const userDropdownRef = useRef(null);
  const notifPanelRef = useRef(null);

  const loadUnread = useCallback(() => {
    api
      .get('/notifications/unread-count')
      .then((res) => {
        if (res.data?.success) setUnreadCount(Number(res.data.count) || 0);
      })
      .catch(() => {});
  }, []);

  const fetchNotifPreview = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await api.get('/notifications?limit=6');
      if (res.data?.success) setNotifPreview(res.data.notifications || []);
    } catch {
      setNotifPreview([]);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setNotifPanelOpen(false);
        setDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(event.target)) {
        setNotifPanelOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      setUnreadCount(0);
      setNotifPreview([]);
      return undefined;
    }
    loadUnread();
    const interval = setInterval(loadUnread, 90000);
    const onVis = () => {
      if (document.visibilityState === 'visible') loadUnread();
    };
    document.addEventListener('visibilitychange', onVis);
    const onNotif = () => loadUnread();
    window.addEventListener('auctionnepal-notifications', onNotif);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('auctionnepal-notifications', onNotif);
    };
  }, [isAuthenticated, user?._id, user?.id, loadUnread]);

  useEffect(() => {
    if (notifPanelOpen) fetchNotifPreview();
  }, [notifPanelOpen, fetchNotifPreview]);

  // Real-time notifications via Socket.IO (user_<id> room from chat handler)
  useEffect(() => {
    if (!isAuthenticated()) return undefined;
    const socket = socketService.connect();
    if (!socket) return undefined;

    const onNew = (data) => {
      if (data?.unreadCount != null) setUnreadCount(Number(data.unreadCount));
      if (data?.notification) {
        const n = data.notification;
        setNotifPreview((prev) => {
          const rest = prev.filter((x) => x._id !== n._id);
          const merged = [n, ...rest].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          return merged.slice(0, 6);
        });
      }
    };

    const onCount = (data) => {
      if (data?.count != null) setUnreadCount(Number(data.count));
    };

    socket.on('notification_new', onNew);
    socket.on('notification_unread_count', onCount);

    return () => {
      socket.off('notification_new', onNew);
      socket.off('notification_unread_count', onCount);
    };
  }, [isAuthenticated, user?._id, user?.id]);

  const toggleNotifPanel = () => {
    setNotifPanelOpen((o) => !o);
  };

  const handleMarkAllReadNav = async () => {
    try {
      setMarkingAllNotif(true);
      await api.put('/notifications/read-all');
      setUnreadCount(0);
      setNotifPreview((prev) => prev.map((n) => ({ ...n, read: true })));
      window.dispatchEvent(new Event('auctionnepal-notifications'));
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingAllNotif(false);
    }
  };

  const openNotificationItem = async (n) => {
    const id = n._id || n.id;
    try {
      if (!n.read && id) {
        await api.put(`/notifications/${id}/read`);
      }
      setNotifPreview((prev) =>
        prev.map((x) => (x._id === id || x.id === id ? { ...x, read: true } : x))
      );
    } catch (e) {
      console.error(e);
    }
    setNotifPanelOpen(false);
    if (n.link) navigate(n.link);
  };

  const formatNotifTime = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diffMs = now - date;
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return date.toLocaleDateString('en-NP', { month: 'short', day: 'numeric' });
  };

  const handleLogout = async () => {
    await logout();
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <nav className="nav-container">
      <div className="nav-wrapper">
        <div className="nav-content">
          {/* Logo */}
          <Link to="/" className="nav-logo">
            <Logo className="mb-0" />
          </Link>

          {/* Navigation Links */}
          <div className="nav-links">
            <Link to="/" className="nav-link">
              Home
            </Link>
            <Link to="/auctions" className="nav-link">
              Auctions
            </Link>
            <Link to="/about" className="nav-link">
              About
            </Link>
            <Link to="/contact" className="nav-link">
              Contact
            </Link>
            <Link to="/rules" className="nav-link">
              Rules
            </Link>

            {/* Show User Profile if logged in, otherwise show Login/Register */}
            {isAuthenticated() ? (
              <>
                <div className="nav-notif-wrap" ref={notifPanelRef}>
                  <button
                    type="button"
                    className="nav-bell-link"
                    onClick={toggleNotifPanel}
                    aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                    aria-expanded={notifPanelOpen}
                  >
                    <FaBell className="nav-bell-icon" aria-hidden />
                    {unreadCount > 0 && (
                      <span className="nav-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                  </button>
                  {notifPanelOpen && (
                    <div className="nav-notif-dropdown" role="dialog" aria-label="Recent notifications">
                      <div className="nav-notif-dropdown-toolbar">
                        <button
                          type="button"
                          className="nav-notif-mark-all"
                          onClick={handleMarkAllReadNav}
                          disabled={markingAllNotif || unreadCount === 0}
                        >
                          {markingAllNotif ? '…' : 'Mark all read'}
                        </button>
                        <Link
                          to="/notifications"
                          className="nav-notif-history"
                          onClick={() => setNotifPanelOpen(false)}
                        >
                          History
                        </Link>
                      </div>
                      <div className="nav-notif-list">
                        {notifLoading ? (
                          <div className="nav-notif-loading">Loading…</div>
                        ) : notifPreview.length === 0 ? (
                          <div className="nav-notif-empty">No notifications yet</div>
                        ) : (
                          notifPreview.map((n) => (
                            <button
                              key={n._id || n.id}
                              type="button"
                              className={`nav-notif-item ${!n.read ? 'nav-notif-item--unread' : ''}`}
                              onClick={() => openNotificationItem(n)}
                            >
                              <span className="nav-notif-item-title">{n.title}</span>
                              <span className="nav-notif-item-msg">{n.message}</span>
                              <span className="nav-notif-item-time">{formatNotifTime(n.createdAt)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              <div 
                className="nav-user-profile" 
                ref={userDropdownRef}
                key={`user-profile-${user?._id || user?.id || ''}-${user?.profilePicture?.public_id || user?.profilePicture?.url || ''}`}
              >
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="user-profile-button"
                >
                  <div className="user-avatar">
                    {user?.profilePicture?.url ? (
                      <img 
                        src={`${user.profilePicture.url}?t=${user.profilePicture.uploadedAt ? new Date(user.profilePicture.uploadedAt).getTime() : Date.now()}`}
                        alt={user.fullName || 'User'} 
                        className="user-avatar-image"
                        key={`avatar-${user._id || user.id}-${user.profilePicture.public_id || user.profilePicture.url || ''}`}
                        onError={(e) => {
                          // If image fails to load, show initials instead
                          e.target.style.display = 'none';
                          const parent = e.target.parentElement;
                          if (parent && !parent.querySelector('.avatar-initials')) {
                            const initials = document.createElement('span');
                            initials.className = 'avatar-initials';
                            initials.textContent = getInitials(user?.fullName);
                            parent.appendChild(initials);
                          }
                        }}
                      />
                    ) : (
                      <span key={`initials-${user._id || user.id}-${user.fullName || ''}`}>
                        {getInitials(user?.fullName)}
                      </span>
                    )}
                  </div>
                  <span className="user-name" key={`name-${user?.fullName}`}>{user?.fullName || 'User'}</span>
                  <svg
                    className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="user-dropdown">
                    <Link
                      to="/dashboard"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <FaHome /> Dashboard
                    </Link>
                    <Link
                      to="/profile"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <FaUser /> My Profile
                    </Link>
                    <div className="dropdown-divider"></div>
                    <Link
                      to="/my-bids"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <FaGavel /> My Bids
                    </Link>
                    <Link
                      to="/wallet"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <FaWallet /> My Wallet
                    </Link>
                    <Link
                      to="/deposits"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <FaMoneyBillWave /> Deposit History
                    </Link>
                    <Link
                      to="/auction-history"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <FaHistory /> Auction History
                    </Link>
                    <div className="dropdown-divider"></div>
                    <Link
                      to="/notifications"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <FaBell /> Notifications
                    </Link>
                    <Link
                      to="/chat"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <FaComments /> Messages
                    </Link>
                    <div className="dropdown-divider"></div>
                    <button
                      onClick={handleLogout}
                      className="dropdown-item logout-item"
                    >
                      <FaSignOutAlt /> Logout
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">
                  Login
                </Link>
                <Link to="/register" className="nav-button">
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="nav-mobile-menu">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((o) => !o)}
            >
              {mobileMenuOpen ? (
                <svg className="mobile-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="mobile-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="nav-mobile-backdrop"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="nav-mobile-drawer" role="dialog" aria-modal="true" aria-label="Main navigation">
            <div className="nav-mobile-drawer-inner">
              <div className="nav-mobile-section">
                <Link to="/" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  Home
                </Link>
                <Link to="/auctions" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  Auctions
                </Link>
                <Link to="/about" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  About
                </Link>
                <Link to="/contact" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  Contact
                </Link>
                <Link to="/rules" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  Rules
                </Link>
              </div>

              {isAuthenticated() ? (
                <>
                  <div className="nav-mobile-divider" />
                  <div className="nav-mobile-section">
                    <Link to="/dashboard" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                      <FaHome className="nav-mobile-link-icon" aria-hidden /> Dashboard
                    </Link>
                    <Link to="/profile" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                      <FaUser className="nav-mobile-link-icon" aria-hidden /> My Profile
                    </Link>
                    <Link to="/my-bids" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                      <FaGavel className="nav-mobile-link-icon" aria-hidden /> My Bids
                    </Link>
                    <Link to="/wallet" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                      <FaWallet className="nav-mobile-link-icon" aria-hidden /> My Wallet
                    </Link>
                    <Link to="/deposits" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                      <FaMoneyBillWave className="nav-mobile-link-icon" aria-hidden /> Deposit History
                    </Link>
                    <Link to="/auction-history" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                      <FaHistory className="nav-mobile-link-icon" aria-hidden /> Auction History
                    </Link>
                    <Link to="/notifications" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                      <FaBell className="nav-mobile-link-icon" aria-hidden /> Notifications
                    </Link>
                    <Link to="/chat" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                      <FaComments className="nav-mobile-link-icon" aria-hidden /> Messages
                    </Link>
                  </div>
                  <div className="nav-mobile-divider" />
                  <button
                    type="button"
                    className="nav-mobile-link nav-mobile-link--danger"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <FaSignOutAlt className="nav-mobile-link-icon" aria-hidden /> Logout
                  </button>
                </>
              ) : (
                <>
                  <div className="nav-mobile-divider" />
                  <div className="nav-mobile-actions">
                    <Link to="/login" className="nav-mobile-btn-secondary" onClick={() => setMobileMenuOpen(false)}>
                      Login
                    </Link>
                    <Link to="/register" className="nav-mobile-btn-primary" onClick={() => setMobileMenuOpen(false)}>
                      Register
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navigation;
