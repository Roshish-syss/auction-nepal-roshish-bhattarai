import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/authService';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { FaCheck } from 'react-icons/fa';
import './KYCVerification.css';

const KYCVerification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: Document, 3: Citizenship Number
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Email verification state
  const [email, setEmail] = useState(user?.email || '');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  
  // Document upload state
  const [documentFile, setDocumentFile] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [documentUploaded, setDocumentUploaded] = useState(false);
  
  // Citizenship number state
  const [citizenshipNumber, setCitizenshipNumber] = useState('');
  
  // KYC status
  const [kycStatus, setKycStatus] = useState(null);
  
  // Modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  useEffect(() => {
    // Redirect admins to admin dashboard
    if (user?.role === 'admin') {
      navigate('/admin/dashboard');
      return;
    }
    fetchKYCStatus();
  }, [user, navigate]);

  const fetchKYCStatus = async () => {
    try {
      const response = await api.get('/kyc/status');
      if (response.data.success) {
        const kyc = response.data.kyc;
        setKycStatus(kyc);
        
        // Pre-fill citizenship number if it exists
        if (kyc.citizenshipNumber) {
          setCitizenshipNumber(kyc.citizenshipNumber);
        }
        
        if (kyc.emailVerified) {
          setOtpVerified(true);
          setStep(2);
        }
        if (kyc.documentUploaded) {
          setDocumentUploaded(true);
          setStep(3);
          // If citizenship number already exists, move to next step or show completion
          if (kyc.citizenshipNumber) {
            // All steps complete, show completion message
          }
        }
        if (kyc.adminApproved) {
          setStep(4); // Approved step
        }
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/kyc/send-otp', { email });
      if (response.data.success) {
        setOtpSent(true);
        setSuccess('OTP sent to your email address');
        // In development, show OTP
        if (response.data.otp) {
          setSuccess(`OTP sent! Check your email. (Development: ${response.data.otp})`);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/kyc/verify-otp', { otp, email });
      if (response.data.success) {
        setOtpVerified(true);
        setSuccess('Email address verified successfully!');
        setTimeout(() => {
          setStep(2);
          setSuccess('');
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
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

      setDocumentFile(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocumentPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentUpload = async () => {
    if (!documentFile) {
      setError('Please select a file to upload');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', documentFile);

      const response = await api.post('/kyc/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setDocumentUploaded(true);
        setSuccess('Citizenship photo uploaded successfully!');
        setTimeout(() => {
          setStep(3);
          setSuccess('');
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  const handleCitizenshipNumberSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/kyc/citizenship-number', { citizenshipNumber });
      if (response.data.success) {
        // Refresh KYC status to get updated data
        await fetchKYCStatus();
        // Show completion modal
        setShowCompletionModal(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add citizenship number');
    } finally {
      setLoading(false);
    }
  };

  if (kycStatus?.adminApproved) {
    return (
      <div>
        <Navigation />
        <div className="kyc-container">
        <div className="kyc-card">
          <div className="kyc-success-icon"><FaCheck /></div>
          <h1>KYC Verified!</h1>
          <p>Your KYC verification has been approved. You can now participate in auctions.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Go to Dashboard
          </button>
        </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (kycStatus?.status === 'rejected') {
    return (
      <div>
        <Navigation />
        <div className="kyc-container">
        <div className="kyc-card">
          <div className="kyc-error-icon">✗</div>
          <h1>KYC Rejected</h1>
          <p className="rejection-reason">
            <strong>Reason:</strong> {kycStatus.rejectionReason}
          </p>
          <p>Please review the rejection reason and resubmit your KYC verification.</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Resubmit KYC
          </button>
        </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="kyc-container">
      <div className="kyc-card">
        <h1 className="kyc-title">KYC Verification</h1>
        <p className="kyc-subtitle">Complete your identity verification to participate in auctions</p>

        {/* Progress Steps */}
        <div className="kyc-progress">
          <div className={`step ${step >= 1 ? 'active' : ''} ${otpVerified ? 'completed' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-label">Email Verification</div>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''} ${documentUploaded ? 'completed' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-label">Upload Document</div>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-label">Citizenship Number</div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="kyc-alert kyc-alert-error">{error}</div>
        )}
        {success && (
          <div className="kyc-alert kyc-alert-success">{success}</div>
        )}

        {/* Step 1: Email Verification */}
        {step === 1 && (
          <div className="kyc-step">
            <h2>Step 1: Verify Email Address</h2>
            {!otpSent ? (
              <form onSubmit={handleSendOTP}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    disabled={otpVerified}
                  />
                </div>
                <button type="submit" disabled={loading || otpVerified} className="btn-primary">
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP}>
                <div className="form-group">
                  <label>Enter OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    maxLength="6"
                    required
                    className="otp-input"
                  />
                  <p className="help-text">OTP sent to {email}</p>
                  <p className="help-text" style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    Please check your email inbox (and spam folder if not received)
                  </p>
                </div>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp('');
                  }}
                  className="btn-secondary"
                >
                  Resend OTP
                </button>
              </form>
            )}
          </div>
        )}

        {/* Step 2: Document Upload */}
        {step === 2 && (
          <div className="kyc-step">
            <h2>Step 2: Upload Citizenship Photo</h2>
            <div className="upload-area">
              {documentPreview ? (
                <div className="preview-container">
                  <img src={documentPreview} alt="Preview" className="document-preview" />
                  <button
                    onClick={() => {
                      setDocumentFile(null);
                      setDocumentPreview(null);
                    }}
                    className="btn-secondary"
                  >
                    Change Image
                  </button>
                </div>
              ) : (
                <label className="upload-label">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="file-input"
                  />
                  <div className="upload-placeholder">
                    <svg className="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p>Click to upload or drag and drop</p>
                    <p className="upload-hint">PNG, JPG up to 5MB</p>
                  </div>
                </label>
              )}
            </div>
            {documentFile && !documentUploaded && (
              <button
                onClick={handleDocumentUpload}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Uploading...' : 'Upload Document'}
              </button>
            )}
          </div>
        )}

        {/* Step 3: Citizenship Number */}
        {step === 3 && (
          <div className="kyc-step">
            <h2>Step 3: Enter Citizenship Number</h2>
            {kycStatus?.citizenshipNumber ? (
              <div className="kyc-info">
                <p><strong>Citizenship Number:</strong> {kycStatus.citizenshipNumber}</p>
                <p>Your citizenship number has been saved and cannot be changed.</p>
                <div className="kyc-info" style={{ marginTop: '1rem' }}>
                  <p><strong>Status:</strong> Under Review</p>
                  <p>Your KYC documents have been submitted. An admin will review and approve your verification. You will be notified once approved.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCitizenshipNumberSubmit}>
                <div className="form-group">
                  <label>Citizenship Number *</label>
                  <input
                    type="text"
                    value={citizenshipNumber}
                    onChange={(e) => setCitizenshipNumber(e.target.value)}
                    placeholder="Enter your citizenship number"
                    required
                  />
                  <p className="help-text">Citizenship number is required to complete your KYC verification. Once submitted, it cannot be changed.</p>
                </div>
                <button type="submit" disabled={loading || !citizenshipNumber.trim()} className="btn-primary">
                  {loading ? 'Saving...' : 'Submit & Complete'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Completion Modal */}
        {showCompletionModal && (
          <div className="kyc-modal-overlay" onClick={() => setShowCompletionModal(false)}>
            <div className="kyc-modal" onClick={(e) => e.stopPropagation()}>
              <div className="kyc-modal-header">
                <h2>KYC Submission Complete</h2>
              </div>
              <div className="kyc-modal-body">
                <div className="kyc-modal-status">
                  <p><strong>Status:</strong> Under Review</p>
                </div>
                <p className="kyc-modal-message">
                  Your KYC documents have been submitted. An admin will review and approve your verification. You will be notified once approved.
                </p>
              </div>
              <div className="kyc-modal-footer">
                <button
                  onClick={() => navigate('/')}
                  className="btn-secondary"
                >
                  Home
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-primary"
                >
                  Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      <Footer />
    </div>
  );
};

export default KYCVerification;

