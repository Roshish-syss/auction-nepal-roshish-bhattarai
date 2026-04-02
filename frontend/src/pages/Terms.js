import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import './Terms.css';

const Terms = () => {
  return (
    <div>
      <Navigation />
      <div className="terms-page">
        <div className="terms-container">
          <h1 className="terms-title">Terms & Conditions</h1>
          <div className="terms-content">
            <section className="terms-section">
              <h2>1. User Agreement</h2>
              <p>By using AuctionNepal, you agree to comply with these terms and conditions. If you do not agree, please do not use our services.</p>
            </section>

            <section className="terms-section">
              <h2>2. Account Registration</h2>
              <p>You must provide accurate and complete information when registering. You are responsible for maintaining the security of your account.</p>
            </section>

            <section className="terms-section">
              <h2>3. KYC Verification</h2>
              <p>All users must complete KYC verification to participate in auctions. Verification may take 1-3 business days.</p>
            </section>

            <section className="terms-section">
              <h2>4. Deposits and Payments</h2>
              <p>Deposits are required to participate in auctions. Deposits will be refunded to non-winning bidders within 7-14 business days.</p>
            </section>

            <section className="terms-section">
              <h2>5. Auction Participation</h2>
              <p>Bids placed during auctions are final and binding. The highest bidder at the end of the auction wins the property.</p>
            </section>

            <section className="terms-section">
              <h2>6. Refund Policy</h2>
              <p>Deposits are refunded to non-winning participants. Winning bidders must complete payment within the specified timeframe.</p>
            </section>

            <section className="terms-section">
              <h2>7. Privacy</h2>
              <p>We protect your personal information in accordance with our Privacy Policy. Your data is secure and confidential.</p>
            </section>

            <section className="terms-section">
              <h2>8. Modifications</h2>
              <p>We reserve the right to modify these terms at any time. Users will be notified of significant changes.</p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Terms;

