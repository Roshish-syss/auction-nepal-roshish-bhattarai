import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import './Privacy.css';

const Privacy = () => {
  return (
    <div>
      <Navigation />
      <div className="privacy-page">
        <div className="privacy-container">
          <h1 className="privacy-title">Privacy Policy</h1>
          <div className="privacy-content">
            <section className="privacy-section">
              <h2>1. Information We Collect</h2>
              <p>We collect information you provide directly, including name, email, phone number, and identification documents for KYC verification.</p>
            </section>

            <section className="privacy-section">
              <h2>2. How We Use Your Information</h2>
              <p>Your information is used to provide our services, verify your identity, process payments, and communicate with you about auctions and account updates.</p>
            </section>

            <section className="privacy-section">
              <h2>3. Data Security</h2>
              <p>We implement security measures to protect your personal information. All data is encrypted and stored securely.</p>
            </section>

            <section className="privacy-section">
              <h2>4. Sharing Information</h2>
              <p>We do not sell your personal information. We may share information only as necessary to provide services or as required by law.</p>
            </section>

            <section className="privacy-section">
              <h2>5. Cookies</h2>
              <p>We use cookies to enhance your experience. You can control cookie preferences through your browser settings.</p>
            </section>

            <section className="privacy-section">
              <h2>6. Your Rights</h2>
              <p>You have the right to access, update, or delete your personal information. Contact us to exercise these rights.</p>
            </section>

            <section className="privacy-section">
              <h2>7. Contact Us</h2>
              <p>For privacy-related questions, contact us at privacy@auctionnepal.com or through our contact page.</p>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Privacy;

