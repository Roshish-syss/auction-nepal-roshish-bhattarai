import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import api from '../services/authService';
import { FaCheck } from 'react-icons/fa';
import './Rules.css';

const Rules = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasAgreed, setHasAgreed] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      checkAgreementStatus();
    }
  }, [isAuthenticated]);

  const checkAgreementStatus = async () => {
    try {
      const response = await api.get('/users/profile');
      if (response.data.success) {
        setHasAgreed(response.data.user.agreedToTerms || false);
      }
    } catch (error) {
      console.error('Error checking agreement status:', error);
    }
  };

  const handleAgree = async () => {
    if (!agreed) {
      setError('Please check the agreement checkbox');
      return;
    }

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.put('/users/profile', {
        agreedToTerms: true,
        agreedToTermsAt: new Date().toISOString()
      });

      if (response.data.success) {
        setSuccess('Thank you for agreeing to our terms and conditions!');
        setHasAgreed(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save agreement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navigation />
      <div className="rules-page">
        <div className="rules-container">
          <div className="rules-header">
            <h1 className="rules-title">Rules & Regulations</h1>
            <p className="rules-subtitle">Please read and agree to our terms and conditions</p>
          </div>

          {error && <div className="rules-alert rules-alert-error">{error}</div>}
          {success && <div className="rules-alert rules-alert-success">{success}</div>}

          {hasAgreed && (
            <div className="rules-alert rules-alert-info">
              <><FaCheck /> You have already agreed to our terms and conditions.</>
            </div>
          )}

          <div className="rules-content">
            <div className="rules-section">
              <h2 className="rules-section-title">1. General Terms</h2>
              <p className="rules-section-text">
                By accessing and using AuctionNepal, you agree to be bound by these Terms and Conditions. 
                If you do not agree with any part of these terms, you must not use our platform.
              </p>
              <ul className="rules-list">
                <li>You must be at least 18 years old to participate in auctions</li>
                <li>You must provide accurate and complete information during registration</li>
                <li>You are responsible for maintaining the confidentiality of your account</li>
                <li>You must notify us immediately of any unauthorized use of your account</li>
              </ul>
            </div>

            <div className="rules-section">
              <h2 className="rules-section-title">2. KYC Verification</h2>
              <p className="rules-section-text">
                All users must complete KYC (Know Your Customer) verification before participating in auctions.
              </p>
              <ul className="rules-list">
                <li>Valid citizenship document is required</li>
                <li>Phone number verification via OTP is mandatory</li>
                <li>KYC verification must be approved by admin before auction participation</li>
                <li>Providing false information will result in account suspension</li>
              </ul>
            </div>

            <div className="rules-section">
              <h2 className="rules-section-title">3. Deposit Requirements</h2>
              <p className="rules-section-text">
                A refundable deposit is required to participate in auctions.
              </p>
              <ul className="rules-list">
                <li>Deposit amount is specified for each auction</li>
                <li>Deposit must be verified by admin before bidding</li>
                <li>Deposits are refunded to non-winning bidders automatically</li>
                <li>Winning bidders' deposits are applied towards the purchase</li>
              </ul>
            </div>

            <div className="rules-section">
              <h2 className="rules-section-title">4. Auction Rules</h2>
              <p className="rules-section-text">
                All auctions are conducted according to the following rules:
              </p>
              <ul className="rules-list">
                <li>Bids are final and cannot be retracted once submitted</li>
                <li>Minimum bid increment requirements apply</li>
                <li>Highest bidder at auction end wins the property</li>
                <li>All bids are time-stamped and recorded</li>
                <li>Bid manipulation or fraudulent activity will result in immediate ban</li>
              </ul>
            </div>

            <div className="rules-section">
              <h2 className="rules-section-title">5. Payment Terms</h2>
              <p className="rules-section-text">
                Payment terms and conditions for auction winners:
              </p>
              <ul className="rules-list">
                <li>Winning bidder must complete payment within specified timeframe</li>
                <li>Deposit is applied towards final payment</li>
                <li>Failure to complete payment may result in deposit forfeiture</li>
                <li>All transactions are final and non-refundable unless otherwise stated</li>
              </ul>
            </div>

            <div className="rules-section">
              <h2 className="rules-section-title">6. Prohibited Activities</h2>
              <p className="rules-section-text">
                The following activities are strictly prohibited:
              </p>
              <ul className="rules-list">
                <li>Creating multiple accounts to manipulate auctions</li>
                <li>Bid shilling or collusion with other bidders</li>
                <li>Using automated bidding software or bots</li>
                <li>Providing false information or documents</li>
                <li>Harassing or threatening other users</li>
              </ul>
            </div>

            <div className="rules-section">
              <h2 className="rules-section-title">7. Liability and Disclaimers</h2>
              <p className="rules-section-text">
                AuctionNepal acts as a platform facilitator only:
              </p>
              <ul className="rules-list">
                <li>We are not responsible for the accuracy of property listings</li>
                <li>Users are advised to inspect properties before bidding</li>
                <li>We are not liable for disputes between buyers and sellers</li>
                <li>Platform availability is provided "as is" without warranties</li>
              </ul>
            </div>

            <div className="rules-section">
              <h2 className="rules-section-title">8. Privacy Policy</h2>
              <p className="rules-section-text">
                Your privacy is important to us:
              </p>
              <ul className="rules-list">
                <li>We collect and store your personal information securely</li>
                <li>KYC documents are encrypted and stored securely</li>
                <li>We do not share your information with third parties without consent</li>
                <li>You can request access to or deletion of your data</li>
              </ul>
            </div>

            <div className="rules-section">
              <h2 className="rules-section-title">9. Account Termination</h2>
              <p className="rules-section-text">
                We reserve the right to suspend or terminate accounts:
              </p>
              <ul className="rules-list">
                <li>For violation of terms and conditions</li>
                <li>For fraudulent or suspicious activity</li>
                <li>For failure to complete payments</li>
                <li>At our sole discretion for any reason</li>
              </ul>
            </div>

            <div className="rules-section">
              <h2 className="rules-section-title">10. Changes to Terms</h2>
              <p className="rules-section-text">
                We may update these terms from time to time:
              </p>
              <ul className="rules-list">
                <li>Users will be notified of significant changes</li>
                <li>Continued use of the platform constitutes acceptance</li>
                <li>Terms version is tracked and dated</li>
              </ul>
            </div>

            <div className="rules-footer">
              <p className="rules-version">Version 1.0 - Last Updated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {isAuthenticated && !hasAgreed && (
            <div className="rules-agreement">
              <label className="rules-checkbox-label">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="rules-checkbox"
                />
                <span className="rules-checkbox-text">
                  I have read and agree to the Rules & Regulations and Terms & Conditions
                </span>
              </label>
              <button
                onClick={handleAgree}
                disabled={loading || !agreed}
                className="rules-btn rules-btn-primary"
              >
                {loading ? 'Processing...' : 'I Agree'}
              </button>
            </div>
          )}

          {!isAuthenticated && (
            <div className="rules-login-prompt">
              <p>Please log in to agree to our terms and conditions</p>
              <button
                onClick={() => navigate('/login')}
                className="rules-btn rules-btn-primary"
              >
                Login
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Rules;

