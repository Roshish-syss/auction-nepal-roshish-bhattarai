import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import { FaHome, FaTrophy, FaClipboardList, FaCamera, FaTimes, FaCheck, FaChartBar, FaEdit, FaLock, FaCheckCircle, FaSpinner, FaMoneyBillWave, FaSync } from 'react-icons/fa';
import './Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const { user: authUser, isAuthenticated, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview, edit, password, kyc, deposits
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile data
  const [profile, setProfile] = useState(null);
  const [kycStatus, setKycStatus] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositBalance, setDepositBalance] = useState({
    totalApproved: 0,
    totalPending: 0,
    totalRejected: 0,
    totalRefunded: 0
  });
  const [stats, setStats] = useState({
    totalBids: 0,
    activeDeposits: 0,
    wonAuctions: 0
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    fullName: '',
    phoneNumber: ''
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Profile picture state
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  const fetchDepositsAndBalance = async () => {
    try {
      const [depositsRes, balanceRes, walletRes] = await Promise.all([
        api.get('/deposits/my-deposits'),
        api.get('/deposits/balance'),
        api.get('/wallet/balance').catch(() => ({ data: { success: false } })) // Optional, don't fail if wallet endpoint doesn't exist
      ]);

      if (depositsRes.data.success) {
        const depositsList = depositsRes.data.deposits || [];
        setDeposits(depositsList);
        const activeDeposits = depositsList.filter(
          d => d.status === 'approved' || d.status === 'pending' || d.status === 'verified'
        ).length;
        setStats(prev => ({ ...prev, activeDeposits }));
      }

      if (balanceRes.data.success) {
        setDepositBalance({
          totalApproved: balanceRes.data.balance.totalApproved || 0,
          totalPending: balanceRes.data.balance.totalPending || 0,
          totalRejected: balanceRes.data.balance.totalRejected || 0,
          totalRefunded: balanceRes.data.balance.totalRefunded || 0
        });
      }

      if (walletRes.data.success) {
        setWalletBalance(walletRes.data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
    }
  };

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [profileRes, kycRes] = await Promise.all([
        api.get('/users/profile'),
        api.get('/kyc/status').catch(() => ({ data: { success: false } }))
      ]);

      if (profileRes.data.success) {
        const userData = profileRes.data.user;
        setProfile(userData);
        setEditForm({
          fullName: userData.fullName || '',
          phoneNumber: userData.phoneNumber || ''
        });
        if (userData.profilePicture?.url) {
          setProfilePicturePreview(userData.profilePicture.url);
        }
      }

      if (kycRes.data.success) {
        setKycStatus(kycRes.data.kyc);
      }

      // Fetch deposits and balance if on deposits tab
      if (activeTab === 'deposits') {
        await fetchDepositsAndBalance();
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    // Redirect admins to admin dashboard
    if (authUser?.role === 'admin') {
      navigate('/admin/dashboard');
      return;
    }
    fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, navigate, authUser]);

  // Refetch data when deposits tab becomes active
  useEffect(() => {
    if (activeTab === 'deposits' && isAuthenticated() && authUser?.role !== 'admin') {
      fetchDepositsAndBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAuthenticated, authUser]);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editForm.fullName.trim()) {
      setError('Full name is required');
      return;
    }

    if (!editForm.phoneNumber.match(/^[0-9]{10}$/)) {
      setError('Phone number must be 10 digits');
      return;
    }

    try {
      setSaving(true);
      const response = await api.put('/users/profile', editForm);

      if (response.data.success) {
        setSuccess('Profile updated successfully');
        setProfile(response.data.user);
        // Update auth context to refresh Navigation
        if (updateUser) {
          await updateUser();
        }
        // Refresh deposits and balance data
        await fetchDepositsAndBalance();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!passwordForm.currentPassword) {
      setError('Current password is required');
      return;
    }

    try {
      setSaving(true);
      const response = await api.put('/users/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword
      });

      if (response.data.success) {
        setSuccess('Password changed successfully');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Change password error:', err);
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const getKYCStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'profile-status-approved';
      case 'pending': return 'profile-status-pending';
      case 'rejected': return 'profile-status-rejected';
      case 'under_review':
      case 'email_verified':
      case 'document_uploaded':
        return 'profile-status-pending'; // Use pending style for "Under Review"
      default: return 'profile-status-pending';
    }
  };

  const getKYCStatusText = (kyc) => {
    if (!kyc) {
      return 'Not Started';
    }
    
    const status = kyc.status;
    
    // Handle specific statuses
    if (status === 'approved') {
      return 'Verified';
    }
    if (status === 'rejected') {
      return 'Rejected';
    }
    if (status === 'under_review' || status === 'email_verified' || status === 'document_uploaded') {
      return 'Under Review';
    }
    
    // Handle pending status with progress check
    if (status === 'pending') {
      if (!kyc.emailVerified && !kyc.documentUploaded) {
        return 'Not Started';
      }
      return 'Under Review';
    }
    
    // Default fallback
    return 'Under Review';
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicturePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      setUploadingPicture(true);
      setError('');
      setSuccess('');

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/users/upload-profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setSuccess('Profile picture updated successfully');
        setProfile(prev => ({
          ...prev,
          profilePicture: response.data.profilePicture
        }));
        // Update auth context to refresh Navigation
        if (updateUser) {
          updateUser();
        }
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload profile picture');
      // Reset preview on error
      if (profile?.profilePicture?.url) {
        setProfilePicturePreview(profile.profilePicture.url);
      } else {
        setProfilePicturePreview(null);
      }
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleDeleteProfilePicture = async () => {
    if (!window.confirm('Are you sure you want to delete your profile picture?')) {
      return;
    }

    try {
      setUploadingPicture(true);
      setError('');
      setSuccess('');

      const response = await api.delete('/users/delete-profile-picture');

      if (response.data.success) {
        setSuccess('Profile picture deleted successfully');
        setProfilePicturePreview(null);
        setProfile(prev => ({
          ...prev,
          profilePicture: { url: null, public_id: null, uploadedAt: null }
        }));
        // Update auth context to refresh Navigation
        if (updateUser) {
          updateUser();
        }
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="profile-page">
          <div className="profile-loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <Navigation />
        <div className="profile-page">
          <div className="profile-error">Failed to load profile</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="profile-page">
        <div className="profile-container">
          {/* Header */}
          <div className="profile-header">
          </div>

          {/* Alerts */}
          {error && <div className="profile-alert profile-alert-error">{error}</div>}
          {success && <div className="profile-alert profile-alert-success">{success}</div>}

          {/* Main Content */}
          <div className="profile-content">
            {/* Sidebar */}
            <div className="profile-sidebar">
              <div className="profile-user-card">
                <div className="profile-avatar-container">
                  {profilePicturePreview ? (
                    <img 
                      src={profilePicturePreview} 
                      alt="Profile" 
                      className="profile-avatar-image"
                    />
                  ) : (
                    <div className="profile-avatar">
                      {profile.fullName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <label className="profile-avatar-upload-btn" htmlFor="profile-picture-input">
                    {uploadingPicture ? (
                      <FaSpinner className="profile-upload-spinner" />
                    ) : (
                      <FaCamera />
                    )}
                  </label>
                  <input
                    id="profile-picture-input"
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="profile-picture-input"
                    disabled={uploadingPicture}
                  />
                  {profilePicturePreview && (
                    <button
                      onClick={handleDeleteProfilePicture}
                      className="profile-avatar-delete-btn"
                      disabled={uploadingPicture}
                      title="Delete profile picture"
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
                <h2 className="profile-user-name">{profile.fullName}</h2>
                <p className="profile-user-email">{profile.email}</p>
                <div className={`profile-status-badge ${profile.kycVerified ? 'profile-status-verified' : 'profile-status-unverified'}`}>
                  {profile.kycVerified ? <> Verified</> : <> Unverified</>}
                </div>
              </div>

              <nav className="profile-nav">
                <button
                  className={`profile-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  <FaChartBar /> Overview
                </button>
                <button
                  className={`profile-nav-item ${activeTab === 'edit' ? 'active' : ''}`}
                  onClick={() => setActiveTab('edit')}
                >
                  <FaEdit /> Edit Profile
                </button>
                <button
                  className={`profile-nav-item ${activeTab === 'password' ? 'active' : ''}`}
                  onClick={() => setActiveTab('password')}
                >
                  <FaLock /> Change Password
                </button>
                <button
                  className={`profile-nav-item ${activeTab === 'kyc' ? 'active' : ''}`}
                  onClick={() => setActiveTab('kyc')}
                >
                  <FaCheckCircle /> KYC Status
                </button>
                <button
                  className={`profile-nav-item ${activeTab === 'deposits' ? 'active' : ''}`}
                  onClick={() => setActiveTab('deposits')}
                >
                  <FaClipboardList /> Deposits
                </button>
              </nav>
            </div>

            {/* Content Area */}
            <div className="profile-main">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="profile-section">
                  <h2 className="profile-section-title">Account Overview</h2>
                  
                  <div className="profile-stats-grid">
                    <div className="profile-stat-card">
                      <div className="profile-stat-icon"><FaHome /></div>
                      <div className="profile-stat-content">
                        <p className="profile-stat-label">Active Deposits</p>
                        <p className="profile-stat-value">{stats.activeDeposits}</p>
                      </div>
                    </div>
                    <div className="profile-stat-card">
                      <div className="profile-stat-icon"><FaClipboardList /></div>
                      <div className="profile-stat-content">
                        <p className="profile-stat-label">Total Bids</p>
                        <p className="profile-stat-value">{stats.totalBids}</p>
                      </div>
                    </div>
                    <div className="profile-stat-card">
                      <div className="profile-stat-icon"><FaTrophy /></div>
                      <div className="profile-stat-content">
                        <p className="profile-stat-label">Won Auctions</p>
                        <p className="profile-stat-value">{stats.wonAuctions}</p>
                      </div>
                    </div>
                  </div>

                  <div className="profile-info-card">
                    <h3 className="profile-info-card-title">Personal Information</h3>
                    <div className="profile-info-list">
                      <div className="profile-info-item">
                        <span className="profile-info-label">Full Name:</span>
                        <span className="profile-info-value">{profile.fullName}</span>
                      </div>
                      <div className="profile-info-item">
                        <span className="profile-info-label">Email:</span>
                        <span className="profile-info-value">{profile.email}</span>
                      </div>
                      <div className="profile-info-item">
                        <span className="profile-info-label">Phone Number:</span>
                        <span className="profile-info-value">{profile.phoneNumber}</span>
                      </div>
                      <div className="profile-info-item">
                        <span className="profile-info-label">Account Created:</span>
                        <span className="profile-info-value">{formatDate(profile.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Profile Tab */}
              {activeTab === 'edit' && (
                <div className="profile-section">
                  <h2 className="profile-section-title">Edit Profile</h2>
                  
                  <form onSubmit={handleUpdateProfile} className="profile-form">
                    <div className="profile-form-group">
                      <label className="profile-form-label">Full Name *</label>
                      <input
                        type="text"
                        name="fullName"
                        value={editForm.fullName}
                        onChange={handleEditChange}
                        className="profile-form-input"
                        required
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">Email</label>
                      <input
                        type="email"
                        value={profile.email}
                        className="profile-form-input"
                        disabled
                      />
                      <p className="profile-form-help">Email cannot be changed</p>
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">Phone Number *</label>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={editForm.phoneNumber}
                        onChange={handleEditChange}
                        className="profile-form-input"
                        maxLength="10"
                        required
                      />
                      <p className="profile-form-help">10-digit phone number</p>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="profile-btn profile-btn-primary"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </form>
                </div>
              )}

              {/* Change Password Tab */}
              {activeTab === 'password' && (
                <div className="profile-section">
                  <h2 className="profile-section-title">Change Password</h2>
                  
                  <form onSubmit={handleChangePassword} className="profile-form">
                    <div className="profile-form-group">
                      <label className="profile-form-label">Current Password *</label>
                      <input
                        type="password"
                        name="currentPassword"
                        value={passwordForm.currentPassword}
                        onChange={handlePasswordChange}
                        className="profile-form-input"
                        required
                      />
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">New Password *</label>
                      <input
                        type="password"
                        name="newPassword"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                        className="profile-form-input"
                        minLength="6"
                        required
                      />
                      <p className="profile-form-help">At least 6 characters</p>
                    </div>

                    <div className="profile-form-group">
                      <label className="profile-form-label">Confirm New Password *</label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                        className="profile-form-input"
                        minLength="6"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="profile-btn profile-btn-primary"
                    >
                      {saving ? 'Changing...' : 'Change Password'}
                    </button>
                  </form>
                </div>
              )}

              {/* KYC Status Tab */}
              {activeTab === 'kyc' && (
                <div className="profile-section">
                  <h2 className="profile-section-title">KYC Verification Status</h2>
                  
                  <div className="profile-kyc-card">
                    <div className="profile-kyc-header">
                      <h3>Current Status</h3>
                      <span className={`profile-status-badge-large ${getKYCStatusColor(kycStatus?.status || 'pending')}`}>
                        {getKYCStatusText(kycStatus)}
                      </span>
                    </div>

                    <div className="profile-kyc-steps">
                      <div className={`profile-kyc-step ${kycStatus?.emailVerified ? 'completed' : ''}`}>
                        <div className="profile-kyc-step-number">
                          {kycStatus?.emailVerified ? <FaCheck /> : '1'}
                        </div>
                        <div className="profile-kyc-step-content">
                          <h4>Email Verification</h4>
                          <p>{kycStatus?.emailVerified ? 'Email verified successfully' : 'Verify your email address'}</p>
                        </div>
                      </div>

                      <div className={`profile-kyc-step ${kycStatus?.documentUploaded ? 'completed' : ''}`}>
                        <div className="profile-kyc-step-number">
                          {kycStatus?.documentUploaded ? <FaCheck /> : '2'}
                        </div>
                        <div className="profile-kyc-step-content">
                          <h4>Document Upload</h4>
                          <p>{kycStatus?.documentUploaded ? 'Citizenship document uploaded' : 'Upload citizenship document'}</p>
                        </div>
                      </div>

                      <div className={`profile-kyc-step ${kycStatus?.adminApproved ? 'completed' : ''}`}>
                        <div className="profile-kyc-step-number">
                          {kycStatus?.adminApproved ? <FaCheck /> : '3'}
                        </div>
                        <div className="profile-kyc-step-content">
                          <h4>Admin Approval</h4>
                          <p>{kycStatus?.adminApproved ? 'Approved by admin' : 'Waiting for admin approval'}</p>
                        </div>
                      </div>
                    </div>

                    {!kycStatus || kycStatus.status !== 'approved' ? (
                      <div className="profile-kyc-actions">
                        <button
                          onClick={() => navigate('/kyc-verification')}
                          className="profile-btn profile-btn-primary"
                        >
                          {kycStatus ? 'Continue KYC Verification' : 'Start KYC Verification'}
                        </button>
                      </div>
                    ) : (
                      <div className="profile-kyc-success">
                        <p><FaCheck /> Your KYC verification is complete. You can now participate in auctions.</p>
                      </div>
                    )}

                    {kycStatus?.status === 'rejected' && kycStatus?.rejectionReason && (
                      <div className="profile-kyc-rejection">
                        <h4>Rejection Reason:</h4>
                        <p>{kycStatus.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Deposits Tab */}
              {activeTab === 'deposits' && (
                <div className="profile-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h2 className="profile-section-title" style={{ marginBottom: 0 }}>Deposit History</h2>
                    <button
                      onClick={fetchDepositsAndBalance}
                      className="profile-btn profile-btn-secondary"
                      style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
                      title="Refresh data"
                    >
                      <FaSync /> Refresh
                    </button>
                  </div>
                  
                  {/* Wallet Balance Card */}
                  <div className="profile-deposit-balance-card">
                    <div className="profile-deposit-balance-header">
                      <FaMoneyBillWave className="profile-deposit-balance-icon" />
                      <h3>Wallet Balance</h3>
                    </div>
                    <div className="profile-deposit-balance-amount">
                      {formatPrice(walletBalance)}
                    </div>
                    <p className="profile-deposit-balance-label">Available Balance</p>
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb', fontSize: '0.8125rem', color: 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span>Total Approved Deposits:</span>
                        <span style={{ fontWeight: '500', color: '#111827' }}>
                          {formatPrice(depositBalance.totalApproved)}
                        </span>
                      </div>
                      {depositBalance.totalPending > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#f59e0b' }}>
                          <span>Pending Deposits:</span>
                          <span style={{ fontWeight: '500' }}>
                            {formatPrice(depositBalance.totalPending)}
                          </span>
                        </div>
                      )}
                      {depositBalance.totalRejected > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                          <span>Rejected Deposits:</span>
                          <span style={{ fontWeight: '500' }}>
                            {formatPrice(depositBalance.totalRejected)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        onClick={() => navigate('/wallet')}
                        className="profile-btn profile-btn-secondary"
                        style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }}
                      >
                        Manage Wallet
                      </button>
                      <button
                        onClick={() => navigate('/deposits')}
                        className="profile-btn profile-btn-primary"
                        style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }}
                      >
                        Deposit History
                      </button>
                    </div>
                  </div>

                  {/* Recent Deposits */}
                  <div className="profile-deposits-list">
                    <h3 className="profile-section-subtitle">Recent Deposits</h3>
                    {deposits.length === 0 ? (
                      <div className="profile-empty-state">
                        <p>No deposits yet. Start by making a deposit for an auction.</p>
                        <button
                          onClick={() => navigate('/auctions')}
                          className="profile-btn profile-btn-primary"
                        >
                          Browse Auctions
                        </button>
                      </div>
                    ) : (
                      deposits.slice(0, 5).map((deposit) => (
                        <div key={deposit._id} className="profile-deposit-item">
                          <div className="profile-deposit-item-info">
                            <h4>{deposit.propertyId?.title || 'Property'}</h4>
                            <p>{new Date(deposit.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="profile-deposit-item-details">
                            <span className="profile-deposit-amount">
                              {formatPrice(deposit.amount)}
                            </span>
                            <span className={`profile-deposit-status profile-deposit-status-${deposit.status}`}>
                              {deposit.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

