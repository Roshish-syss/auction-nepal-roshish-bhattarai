import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import api from '../services/authService';
import { FaCheck, FaClock, FaWallet } from 'react-icons/fa';
import PropertyLocationSection from '../components/PropertyLocationSection';
import { isAuctionClosedForDeposits } from '../utils/auctionDisplay';
import './DepositPayment.css';

const DepositPayment = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [property, setProperty] = useState(null);
  const [qrCodes, setQrCodes] = useState(null);
  const [depositInfo, setDepositInfo] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [useWallet, setUseWallet] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    paymentMethod: 'khalti',
    phoneNumber: user?.phoneNumber || '',
    paymentProof: null,
    agreedToTerms: false
  });

  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [propertyId, isAuthenticated, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [propertyRes, qrRes, depositRes, walletRes] = await Promise.all([
        api.get(`/properties/${propertyId}`),
        api.get('/deposits/qr-codes'),
        api.get(`/deposits/check/${propertyId}`),
        api.get('/wallet/balance')
      ]);

      if (propertyRes.data.success) {
        setProperty(propertyRes.data.property);
      }

      if (qrRes.data.success) {
        setQrCodes(qrRes.data.qrCodes);
      }

      if (depositRes.data.success) {
        setDepositInfo(depositRes.data);
        if (depositRes.data.hasDeposit && depositRes.data.deposit.status === 'approved') {
          setSuccess('Your deposit has already been approved for this auction!');
        }
      }

      if (walletRes.data.success) {
        setWalletBalance(walletRes.data.balance);
        // Auto-select wallet if user has sufficient balance
        if (walletRes.data.balance >= propertyRes.data.property?.depositAmount) {
          setUseWallet(true);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load deposit information');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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

      setFormData(prev => ({ ...prev, paymentProof: file }));
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.agreedToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    // If using wallet, use wallet endpoint
    if (useWallet) {
      if (walletBalance < property.depositAmount) {
        setError(`Insufficient wallet balance. Current: ${formatPrice(walletBalance)}, Required: ${formatPrice(property.depositAmount)}`);
        return;
      }

      setSubmitting(true);
      try {
        const response = await api.post('/wallet/use-for-deposit', {
          propertyId: propertyId,
          auctionId: property.auction?._id || propertyId,
          amount: property.depositAmount
        });

        if (response.data.success) {
          setSuccess('Deposit paid successfully from wallet balance!');
          setTimeout(() => {
            navigate('/deposits');
          }, 2000);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to pay deposit from wallet');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Original payment via QR code flow
    if (!formData.paymentProof) {
      setError('Please upload payment proof screenshot');
      return;
    }

    setSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('propertyId', propertyId);
      submitData.append('auctionId', property.auction?._id || propertyId); // Use auction ID if available
      submitData.append('amount', property.depositAmount);
      submitData.append('paymentMethod', formData.paymentMethod);
      submitData.append('phoneNumber', formData.phoneNumber);
      submitData.append('agreedToTerms', formData.agreedToTerms.toString());
      submitData.append('file', formData.paymentProof);

      const response = await api.post('/deposits/submit', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setSuccess('Deposit submitted successfully! Waiting for admin verification.');
        setTimeout(() => {
          navigate('/deposits');
        }, 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit deposit');
    } finally {
      setSubmitting(false);
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
        <Navigation />
        <div className="deposit-payment-page">
          <div className="deposit-payment-loading">Loading...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!property) {
    return (
      <div>
        <Navigation />
        <div className="deposit-payment-page">
          <div className="deposit-payment-error">
            <h2>Property Not Found</h2>
            <button onClick={() => navigate('/auctions')} className="deposit-payment-btn deposit-payment-btn-primary">
              Back to Auctions
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Check if deposit already approved
  if (depositInfo?.hasDeposit && depositInfo.deposit.status === 'approved') {
    return (
      <div>
        <Navigation />
        <div className="deposit-payment-page">
          <div className="deposit-payment-container">
            <div className="deposit-payment-card deposit-payment-success">
              <div className="deposit-payment-success-icon"><FaCheck /></div>
              <h1>Deposit Already Approved</h1>
              <p>Your deposit of {formatPrice(depositInfo.deposit.amount)} has been approved.</p>
              <p>You can now participate in this auction.</p>
              <button onClick={() => navigate(`/auctions/${propertyId}`)} className="deposit-payment-btn deposit-payment-btn-primary">
                View Property
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Check if deposit is pending
  if (depositInfo?.hasDeposit && depositInfo.deposit.status === 'pending') {
    return (
      <div>
        <Navigation />
        <div className="deposit-payment-page">
          <div className="deposit-payment-container">
            <div className="deposit-payment-card deposit-payment-pending">
              <div className="deposit-payment-pending-icon"><FaClock /></div>
              <h1>Deposit Under Review</h1>
              <p>Your deposit of {formatPrice(depositInfo.deposit.amount)} is currently being reviewed by admin.</p>
              <p>You will be notified once it's approved.</p>
              <button onClick={() => navigate('/deposits')} className="deposit-payment-btn deposit-payment-btn-primary">
                View Deposit Status
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (isAuctionClosedForDeposits(property)) {
    return (
      <div>
        <Navigation />
        <div className="deposit-payment-page">
          <div className="deposit-payment-container">
            <div className="deposit-payment-card">
              <h1 className="deposit-payment-title">Deposits closed</h1>
              <p>This auction has ended. New deposits are not accepted.</p>
              <button
                type="button"
                onClick={() => navigate(`/auctions/${propertyId}`)}
                className="deposit-payment-btn deposit-payment-btn-primary"
              >
                Back to property
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="deposit-payment-page">
        <div className="deposit-payment-container">
          <button onClick={() => navigate(`/auctions/${propertyId}`)} className="deposit-payment-back-btn">
            ← Back to Property
          </button>

          <div className="deposit-payment-header">
            <h1 className="deposit-payment-title">Pay Deposit</h1>
            <p className="deposit-payment-subtitle">
              Deposit required to participate in auction for: <strong>{property.title}</strong>
            </p>
          </div>

          {error && <div className="deposit-payment-alert deposit-payment-alert-error">{error}</div>}
          {success && <div className="deposit-payment-alert deposit-payment-alert-success">{success}</div>}

          <div className="deposit-payment-content">
            {/* Left Column - Payment Instructions */}
            <div className="deposit-payment-instructions">
              <div className="deposit-payment-info-card">
                <h2 className="deposit-payment-info-title">Deposit Information</h2>
                <div className="deposit-payment-info-item">
                  <span className="deposit-payment-info-label">Required Amount:</span>
                  <span className="deposit-payment-info-value">{formatPrice(property.depositAmount)}</span>
                </div>
                <div className="deposit-payment-info-item">
                  <span className="deposit-payment-info-label">Property:</span>
                  <span className="deposit-payment-info-value">{property.title}</span>
                </div>
                <PropertyLocationSection
                  property={property}
                  heading="Property location"
                  mapHeight={200}
                />
                <div className="deposit-payment-info-item">
                  <span className="deposit-payment-info-label">Wallet Balance:</span>
                  <span className={`deposit-payment-info-value ${walletBalance >= property.depositAmount ? 'text-success' : 'text-warning'}`}>
                    {formatPrice(walletBalance)}
                  </span>
                </div>
              </div>

              {/* Payment Method Toggle */}
              <div className="deposit-payment-method-toggle">
                <h3>Payment Option</h3>
                <div className="deposit-payment-method-options">
                  <label className={`deposit-payment-method-option ${useWallet ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={useWallet}
                      onChange={() => setUseWallet(true)}
                      disabled={walletBalance < property.depositAmount}
                    />
                    <span><FaWallet /> Use Wallet Balance</span>
                    {walletBalance < property.depositAmount && (
                      <small className="deposit-payment-insufficient">Insufficient balance</small>
                    )}
                  </label>
                  <label className={`deposit-payment-method-option ${!useWallet ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={!useWallet}
                      onChange={() => setUseWallet(false)}
                    />
                    <span>Pay via QR Code</span>
                  </label>
                </div>
              </div>

              {qrCodes && !useWallet && (
                <>
                  {/* Payment Method Selection */}
                  <div className="deposit-payment-method-selector">
                    <h3>Select Payment Method</h3>
                    <div className="deposit-payment-method-options">
                      <label className={`deposit-payment-method-option ${formData.paymentMethod === 'khalti' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="khalti"
                          checked={formData.paymentMethod === 'khalti'}
                          onChange={handleInputChange}
                        />
                        <span>Khalti</span>
                      </label>
                      <label className={`deposit-payment-method-option ${formData.paymentMethod === 'esewa' ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="esewa"
                          checked={formData.paymentMethod === 'esewa'}
                          onChange={handleInputChange}
                        />
                        <span>eSewa</span>
                      </label>
                    </div>
                  </div>

                  {/* QR Code Display */}
                  <div className="deposit-payment-qr-section">
                    <h3>
                      {formData.paymentMethod === 'khalti' ? 'Khalti' : 'eSewa'} Payment QR Code
                    </h3>
                    <div className="deposit-payment-qr-container">
                      <img
                        src={qrCodes[formData.paymentMethod]}
                        alt={`${formData.paymentMethod} QR Code`}
                        className="deposit-payment-qr-image"
                        onError={(e) => {
                          e.target.src = '/images/qr-placeholder.png';
                        }}
                      />
                    </div>
                    <div className="deposit-payment-qr-details">
                      <p className="deposit-payment-qr-account">
                        Account: <strong>{qrCodes[formData.paymentMethod === 'khalti' ? 'khaltiAccount' : 'esewaAccount']}</strong>
                      </p>
                      {formData.paymentMethod === 'esewa' && qrCodes.esewaPhone && (
                        <p className="deposit-payment-qr-phone">
                          Phone: <strong>{qrCodes.esewaPhone}</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Payment Instructions */}
                  <div className="deposit-payment-instructions-card">
                    <h3>Payment Instructions</h3>
                    <div className="deposit-payment-instructions-text">
                      {qrCodes.instructions[formData.paymentMethod].split('\n').map((instruction, index) => (
                        <p key={index}>{instruction}</p>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Column - Deposit Form */}
            <div className="deposit-payment-form-section">
              <form onSubmit={handleSubmit} className="deposit-payment-form">
                <h2 className="deposit-payment-form-title">
                  {useWallet ? 'Pay from Wallet' : 'Deposit Submission Form'}
                </h2>

                {useWallet ? (
                  <div className="deposit-payment-wallet-info">
                    <div className="deposit-payment-wallet-summary">
                      <p><strong>Required:</strong> {formatPrice(property.depositAmount)}</p>
                      <p><strong>Available:</strong> {formatPrice(walletBalance)}</p>
                      <p className="deposit-payment-wallet-remaining">
                        <strong>After payment:</strong> {formatPrice(walletBalance - property.depositAmount)}
                      </p>
                    </div>
                    <p className="deposit-payment-wallet-note">
                      The deposit amount will be deducted from your wallet balance immediately. Your deposit will be approved automatically.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="deposit-payment-form-group">
                      <label className="deposit-payment-form-label">Phone Number *</label>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                        placeholder="Enter 10-digit phone number"
                        maxLength="10"
                        required={!useWallet}
                        className="deposit-payment-form-input"
                      />
                      <p className="deposit-payment-form-help">Phone number used for payment</p>
                    </div>

                    <div className="deposit-payment-form-group">
                      <label className="deposit-payment-form-label">Payment Proof Screenshot *</label>
                  <div className="deposit-payment-upload-area">
                    {preview ? (
                      <div className="deposit-payment-preview-container">
                        <img src={preview} alt="Payment proof preview" className="deposit-payment-preview-image" />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, paymentProof: null }));
                            setPreview(null);
                          }}
                          className="deposit-payment-btn deposit-payment-btn-secondary"
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <label className="deposit-payment-upload-label">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="deposit-payment-file-input"
                          required
                        />
                        <div className="deposit-payment-upload-placeholder">
                          <svg className="deposit-payment-upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p>Click to upload payment screenshot</p>
                          <p className="deposit-payment-upload-hint">PNG, JPG up to 5MB</p>
                        </div>
                      </label>
                    )}
                  </div>
                    </div>
                  </>
                )}

                <div className="deposit-payment-form-group">
                  <label className="deposit-payment-checkbox-label">
                    <input
                      type="checkbox"
                      name="agreedToTerms"
                      checked={formData.agreedToTerms}
                      onChange={handleInputChange}
                      className="deposit-payment-checkbox"
                      required
                    />
                    <span className="deposit-payment-checkbox-text">
                      I agree to the <a href="/rules" target="_blank" rel="noopener noreferrer">Rules & Regulations</a> and understand that:
                    </span>
                  </label>
                  <ul className="deposit-payment-terms-list">
                    <li>Deposit is refundable if I don't win the auction</li>
                    <li>Deposit will be applied towards purchase if I win</li>
                    <li>Deposit verification may take 24-48 hours</li>
                    <li>I must provide accurate payment information</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !formData.agreedToTerms || (!useWallet && !formData.paymentProof) || (useWallet && walletBalance < property.depositAmount)}
                  className="deposit-payment-btn deposit-payment-btn-primary deposit-payment-btn-large"
                >
                  {submitting ? 'Processing...' : useWallet ? `Pay ${formatPrice(property.depositAmount)} from Wallet` : `Submit Deposit of ${formatPrice(property.depositAmount)}`}
                </button>

                <p className="deposit-payment-note">
                  After submission, your deposit will be reviewed by admin. You will be notified via email once approved.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DepositPayment;

