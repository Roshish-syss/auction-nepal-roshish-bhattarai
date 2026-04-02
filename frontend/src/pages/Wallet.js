import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import { FaWallet, FaPlus, FaCheck, FaClock, FaTimes, FaUpload, FaQrcode, FaMoneyBillWave, FaHistory } from 'react-icons/fa';
import './Wallet.css';

const Wallet = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [qrCodes, setQrCodes] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'khalti',
    phoneNumber: '',
    paymentProof: null,
    agreedToTerms: false
  });

  const [preview, setPreview] = useState(null);
  const [showTopupForm, setShowTopupForm] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    fetchWalletData();
  }, [isAuthenticated, navigate]);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [balanceRes, transactionsRes, qrRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/transactions'),
        api.get('/deposits/qr-codes')
      ]);

      if (balanceRes.data.success) {
        setWalletBalance(balanceRes.data.balance);
      }

      if (transactionsRes.data.success) {
        setTransactions(transactionsRes.data.transactions || []);
      }

      if (qrRes.data.success) {
        setQrCodes(qrRes.data.qrCodes);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      setError('Failed to load wallet data');
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
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }

      setFormData(prev => ({ ...prev, paymentProof: file }));
      setError('');

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

    if (!formData.paymentProof) {
      setError('Please upload payment proof screenshot');
      return;
    }

    if (Number(formData.amount) < 100) {
      setError('Minimum top-up amount is 100 NPR');
      return;
    }

    setSubmitting(true);

    try {
      const submitData = new FormData();
      submitData.append('amount', formData.amount);
      submitData.append('paymentMethod', formData.paymentMethod);
      submitData.append('phoneNumber', formData.phoneNumber);
      submitData.append('agreedToTerms', formData.agreedToTerms.toString());
      submitData.append('file', formData.paymentProof);

      const response = await api.post('/wallet/topup', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setSuccess('Top-up request submitted successfully! Waiting for admin verification.');
        setFormData({
          amount: '',
          paymentMethod: 'khalti',
          phoneNumber: '',
          paymentProof: null,
          agreedToTerms: false
        });
        setPreview(null);
        setShowTopupForm(false);
        setTimeout(() => {
          fetchWalletData();
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit top-up request');
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

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-NP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'topup':
        return <FaPlus className="wallet-transaction-icon wallet-transaction-icon-topup" />;
      case 'deposit':
        return <FaMoneyBillWave className="wallet-transaction-icon wallet-transaction-icon-deposit" />;
      case 'refund':
        return <FaCheck className="wallet-transaction-icon wallet-transaction-icon-refund" />;
      default:
        return <FaWallet className="wallet-transaction-icon" />;
    }
  };

  const getTransactionStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="wallet-status-badge wallet-status-approved"><FaCheck /> Approved</span>;
      case 'pending':
        return <span className="wallet-status-badge wallet-status-pending"><FaClock /> Pending</span>;
      case 'rejected':
        return <span className="wallet-status-badge wallet-status-rejected"><FaTimes /> Rejected</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="wallet-page">
          <div className="wallet-loading">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="wallet-page">
        <div className="wallet-container">
          <div className="wallet-header">
            <div className="wallet-header-content">
              <h1 className="wallet-title">
                <FaWallet className="wallet-title-icon" />
                My Wallet
              </h1>
              <p className="wallet-subtitle">Manage your wallet balance and transactions</p>
            </div>
          </div>

          {error && <div className="wallet-alert wallet-alert-error">{error}</div>}
          {success && <div className="wallet-alert wallet-alert-success">{success}</div>}

          {/* Wallet Balance Card */}
          <div className="wallet-balance-card">
            <div className="wallet-balance-background"></div>
            <div className="wallet-balance-content-wrapper">
              <div className="wallet-balance-header">
                <div className="wallet-balance-icon-wrapper">
                  <FaWallet className="wallet-balance-icon" />
                </div>
                <div className="wallet-balance-info">
                  <p className="wallet-balance-label">Available Balance</p>
                  <h2 className="wallet-balance-amount">{formatPrice(walletBalance)}</h2>
                </div>
              </div>
              <button
                onClick={() => setShowTopupForm(!showTopupForm)}
                className="wallet-btn wallet-btn-primary wallet-topup-btn"
              >
                <FaPlus /> {showTopupForm ? 'Cancel' : 'Top Up Wallet'}
              </button>
            </div>
          </div>

          {/* Top-up Form */}
          {showTopupForm && (
            <div className="wallet-topup-section">
              <h2 className="wallet-section-title">Top Up Wallet</h2>
              
              <div className="wallet-topup-content">
                {/* Left Column - Payment Instructions */}
                <div className="wallet-topup-instructions">
                  {qrCodes && (
                    <>
                      {/* Payment Method Selection */}
                      <div className="wallet-payment-method-selector">
                        <h3>Select Payment Method</h3>
                        <div className="wallet-payment-method-options">
                          <label className={`wallet-payment-method-option ${formData.paymentMethod === 'khalti' ? 'active' : ''}`}>
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="khalti"
                              checked={formData.paymentMethod === 'khalti'}
                              onChange={handleInputChange}
                            />
                            <span>Khalti</span>
                          </label>
                          <label className={`wallet-payment-method-option ${formData.paymentMethod === 'esewa' ? 'active' : ''}`}>
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
                      <div className="wallet-qr-section">
                        <h3>{formData.paymentMethod === 'khalti' ? 'Khalti' : 'eSewa'} Payment QR Code</h3>
                        <div className="wallet-qr-container">
                          <img
                            src={qrCodes[formData.paymentMethod]}
                            alt={`${formData.paymentMethod} QR Code`}
                            className="wallet-qr-image"
                          />
                        </div>
                        <div className="wallet-qr-details">
                          <p className="wallet-qr-account">
                            Account: <strong>{qrCodes[formData.paymentMethod === 'khalti' ? 'khaltiAccount' : 'esewaAccount']}</strong>
                          </p>
                          {formData.paymentMethod === 'esewa' && qrCodes.esewaPhone && (
                            <p className="wallet-qr-phone">
                              Phone: <strong>{qrCodes.esewaPhone}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Payment Instructions */}
                      <div className="wallet-instructions-card">
                        <h3>Payment Instructions</h3>
                        <div className="wallet-instructions-text">
                          {qrCodes.instructions[formData.paymentMethod].split('\n').map((instruction, index) => (
                            <p key={index}>{instruction}</p>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column - Top-up Form */}
                <div className="wallet-topup-form-section">
                  <form onSubmit={handleSubmit} className="wallet-topup-form">
                    <h2 className="wallet-form-title">Top-up Form</h2>

                    <div className="wallet-form-group">
                      <label className="wallet-form-label">Amount (NPR) *</label>
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleInputChange}
                        placeholder="Minimum 100 NPR"
                        min="100"
                        step="1"
                        required
                        className="wallet-form-input"
                      />
                      <p className="wallet-form-help">Minimum top-up amount is 100 NPR</p>
                    </div>

                    <div className="wallet-form-group">
                      <label className="wallet-form-label">Phone Number *</label>
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleInputChange}
                        placeholder="Enter 10-digit phone number"
                        maxLength="10"
                        required
                        className="wallet-form-input"
                      />
                      <p className="wallet-form-help">Phone number used for payment</p>
                    </div>

                    <div className="wallet-form-group">
                      <label className="wallet-form-label">Payment Proof Screenshot *</label>
                      <div className="wallet-upload-area">
                        {preview ? (
                          <div className="wallet-preview-container">
                            <img src={preview} alt="Payment proof preview" className="wallet-preview-image" />
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, paymentProof: null }));
                                setPreview(null);
                              }}
                              className="wallet-btn wallet-btn-secondary"
                            >
                              Remove Image
                            </button>
                          </div>
                        ) : (
                          <label className="wallet-upload-label">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFileChange}
                              className="wallet-file-input"
                              required
                            />
                            <div className="wallet-upload-placeholder">
                              <FaUpload className="wallet-upload-icon" />
                              <p>Click to upload payment screenshot</p>
                              <p className="wallet-upload-hint">PNG, JPG up to 5MB</p>
                            </div>
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="wallet-form-group">
                      <label className="wallet-checkbox-label">
                        <input
                          type="checkbox"
                          name="agreedToTerms"
                          checked={formData.agreedToTerms}
                          onChange={handleInputChange}
                          className="wallet-checkbox"
                          required
                        />
                        <span className="wallet-checkbox-text">
                          I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms & Conditions</a>
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || !formData.agreedToTerms || !formData.paymentProof}
                      className="wallet-btn wallet-btn-primary wallet-btn-large"
                    >
                      {submitting ? 'Submitting...' : `Submit Top-up of ${formData.amount ? formatPrice(Number(formData.amount)) : ''}`}
                    </button>

                    <p className="wallet-note">
                      After submission, your top-up will be reviewed by admin. The amount will be added to your wallet once approved.
                    </p>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div className="wallet-transactions-section">
            <div className="wallet-section-header">
              <h2 className="wallet-section-title">
                <FaHistory className="wallet-section-title-icon" />
                Transaction History
              </h2>
              {transactions.length > 0 && (
                <span className="wallet-transaction-count">{transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}</span>
              )}
            </div>
            
            {transactions.length === 0 ? (
              <div className="wallet-empty-state">
                <div className="wallet-empty-icon-wrapper">
                  <FaWallet className="wallet-empty-icon" />
                </div>
                <h3 className="wallet-empty-title">No transactions yet</h3>
                <p className="wallet-empty-hint">Top up your wallet to get started</p>
                <button
                  onClick={() => setShowTopupForm(true)}
                  className="wallet-btn wallet-btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  <FaPlus /> Top Up Now
                </button>
              </div>
            ) : (
              <div className="wallet-transactions-list">
                {transactions.map((transaction, index) => (
                  <div key={index} className="wallet-transaction-item">
                    <div className="wallet-transaction-icon-container">
                      {getTransactionIcon(transaction.transactionType)}
                    </div>
                    <div className="wallet-transaction-details">
                      <div className="wallet-transaction-header">
                        <h4 className="wallet-transaction-type">
                          {transaction.transactionType === 'topup' && 'Wallet Top-up'}
                          {transaction.transactionType === 'deposit' && 'Auction Deposit'}
                          {transaction.transactionType === 'refund' && 'Refund'}
                          {transaction.transactionType === 'deduction' && 'Deduction'}
                        </h4>
                        <span className={`wallet-transaction-amount-value ${transaction.amount >= 0 ? 'positive' : 'negative'}`}>
                          {transaction.amount >= 0 ? '+' : ''}{formatPrice(Math.abs(transaction.amount))}
                        </span>
                      </div>
                      <p className="wallet-transaction-description">{transaction.description}</p>
                      <div className="wallet-transaction-footer">
                        <p className="wallet-transaction-date">{formatDate(transaction.createdAt)}</p>
                        {transaction.status && getTransactionStatusBadge(transaction.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;

