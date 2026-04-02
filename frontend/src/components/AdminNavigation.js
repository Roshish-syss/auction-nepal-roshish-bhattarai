import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { FaHome, FaUsers, FaGavel, FaClipboardCheck, FaCog, FaChartLine, FaFileAlt, FaSignOutAlt, FaChevronDown, FaBars, FaTimes } from 'react-icons/fa';
import './AdminNavigation.css';

const AdminNavigation = () => {
  const { user, logout, isAuthenticated, getInitials } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  if (!isAuthenticated() || user?.role !== 'admin') {
    return null; // Don't show admin nav if not admin
  }

  return (
    <nav className="admin-nav-container">
      <div className="admin-nav-wrapper">
        <div className="admin-nav-content">
          {/* Logo */}
          <Link to="/admin/dashboard" className="admin-nav-logo">
            <Logo className="mb-0" />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="admin-nav-links">
            <Link to="/admin/dashboard" className={`admin-nav-link ${isActive('/admin/dashboard') ? 'active' : ''}`}>
              <FaHome className="admin-nav-icon" />
              <span>Dashboard</span>
            </Link>
            <Link to="/admin/users" className={`admin-nav-link ${isActive('/admin/users') ? 'active' : ''}`}>
              <FaUsers className="admin-nav-icon" />
              <span>Users</span>
            </Link>
            <Link to="/admin/properties" className={`admin-nav-link ${isActive('/admin/properties') ? 'active' : ''}`}>
              <FaHome className="admin-nav-icon" />
              <span>Properties</span>
            </Link>
            <Link to="/admin/auctions" className={`admin-nav-link ${isActive('/admin/auctions') ? 'active' : ''}`}>
              <FaGavel className="admin-nav-icon" />
              <span>Auctions</span>
            </Link>
            <Link to="/admin/deposits" className={`admin-nav-link ${isActive('/admin/deposits') ? 'active' : ''}`}>
              <FaClipboardCheck className="admin-nav-icon" />
              <span>Deposits</span>
            </Link>
            <Link to="/admin/kyc" className={`admin-nav-link ${isActive('/admin/kyc') ? 'active' : ''}`}>
              <FaUsers className="admin-nav-icon" />
              <span>KYC</span>
            </Link>
            <Link to="/admin/analytics" className={`admin-nav-link ${isActive('/admin/analytics') ? 'active' : ''}`}>
              <FaChartLine className="admin-nav-icon" />
              <span>Analytics</span>
            </Link>
            <Link to="/admin/settings" className={`admin-nav-link ${isActive('/admin/settings') ? 'active' : ''}`}>
              <FaCog className="admin-nav-icon" />
              <span>Settings</span>
            </Link>
            <Link to="/admin/logs" className={`admin-nav-link ${isActive('/admin/logs') ? 'active' : ''}`}>
              <FaFileAlt className="admin-nav-icon" />
              <span>Logs</span>
            </Link>

            {/* Admin Profile Dropdown */}
            <div className="admin-nav-user-profile" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="admin-user-profile-button"
              >
                <div className="admin-user-avatar">
                  {user?.profilePicture?.url ? (
                    <img
                      src={user.profilePicture.url}
                      alt={user.fullName || 'Admin'}
                      className="admin-user-avatar-image"
                    />
                  ) : (
                    getInitials(user?.fullName || 'Admin')
                  )}
                </div>
                <span className="admin-user-name">{user?.fullName || 'Admin'}</span>
                <FaChevronDown className={`admin-dropdown-arrow ${dropdownOpen ? 'open' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="admin-user-dropdown">
                  <div className="admin-dropdown-header">
                    <div className="admin-dropdown-user-info">
                      <div className="admin-dropdown-avatar">
                        {user?.profilePicture?.url ? (
                          <img
                            src={user.profilePicture.url}
                            alt={user.fullName || 'Admin'}
                            className="admin-dropdown-avatar-image"
                          />
                        ) : (
                          getInitials(user?.fullName || 'Admin')
                        )}
                      </div>
                      <div>
                        <div className="admin-dropdown-name">{user?.fullName || 'Admin'}</div>
                        <div className="admin-dropdown-email">{user?.email || ''}</div>
                        <div className="admin-dropdown-role">Administrator</div>
                      </div>
                    </div>
                  </div>
                  <div className="admin-dropdown-divider"></div>
                  <Link
                    to="/admin/settings"
                    className="admin-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <FaCog className="admin-dropdown-item-icon" />
                    Settings
                  </Link>
                  <div className="admin-dropdown-divider"></div>
                  <button
                    onClick={handleLogout}
                    className="admin-dropdown-item admin-logout-item"
                  >
                    <FaSignOutAlt className="admin-dropdown-item-icon" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="admin-mobile-menu-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="admin-mobile-menu">
          <Link to="/admin/dashboard" className="admin-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            <FaHome className="admin-mobile-icon" />
            Dashboard
          </Link>
          <Link to="/admin/users" className="admin-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            <FaUsers className="admin-mobile-icon" />
            Users
          </Link>
          <Link to="/admin/properties" className="admin-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            <FaHome className="admin-mobile-icon" />
            Properties
          </Link>
          <Link to="/admin/auctions" className="admin-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            <FaGavel className="admin-mobile-icon" />
            Auctions
          </Link>
          <Link to="/admin/deposits" className="admin-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            <FaClipboardCheck className="admin-mobile-icon" />
            Deposits
          </Link>
          <Link to="/admin/kyc" className="admin-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            <FaUsers className="admin-mobile-icon" />
            KYC
          </Link>
          <Link to="/admin/analytics" className="admin-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            <FaChartLine className="admin-mobile-icon" />
            Analytics
          </Link>
          <Link to="/admin/settings" className="admin-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            <FaCog className="admin-mobile-icon" />
            Settings
          </Link>
          <Link to="/admin/logs" className="admin-mobile-link" onClick={() => setMobileMenuOpen(false)}>
            <FaFileAlt className="admin-mobile-icon" />
            Logs
          </Link>
          <div className="admin-mobile-divider"></div>
          <button onClick={handleLogout} className="admin-mobile-link admin-mobile-logout">
            <FaSignOutAlt className="admin-mobile-icon" />
            Logout
          </button>
        </div>
      )}
    </nav>
  );
};

export default AdminNavigation;

