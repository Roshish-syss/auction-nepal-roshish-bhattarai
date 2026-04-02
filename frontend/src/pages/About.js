import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { FaHome, FaLock, FaBolt, FaMoneyBillWave, FaCheckCircle } from 'react-icons/fa';
import './About.css';

const About = () => {
  return (
    <div>
      <Navigation />
      <div className="about-page">
        <div className="about-hero">
          <div className="about-hero-content">
            <h1 className="about-hero-title">About AuctionNepal</h1>
            <p className="about-hero-subtitle">
              Revolutionizing real estate auctions in Nepal
            </p>
          </div>
        </div>

        <div className="about-container">
          <div className="about-section">
            <h2 className="about-section-title">Our Mission</h2>
            <p className="about-section-text">
              To create a transparent, secure, and efficient platform for real estate auctions in Nepal, 
              making property transactions accessible to everyone while ensuring fairness and integrity 
              in every auction.
            </p>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">Our Vision</h2>
            <p className="about-section-text">
              To become Nepal's leading online real estate auction platform, trusted by thousands of 
              buyers and sellers, and recognized for innovation, reliability, and customer satisfaction.
            </p>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">Who We Are</h2>
            <p className="about-section-text">
              AuctionNepal is a modern digital platform designed to bridge the gap between property 
              sellers and buyers in Nepal. We leverage cutting-edge technology to facilitate secure, 
              transparent, and efficient real estate auctions.
            </p>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">What We Offer</h2>
            <div className="about-features">
              <div className="about-feature">
                <div className="about-feature-icon"><FaHome /></div>
                <h3 className="about-feature-title">Property Auctions</h3>
                <p className="about-feature-text">
                  Browse and bid on a wide variety of properties including houses, apartments, land, 
                  and commercial spaces.
                </p>
              </div>
              <div className="about-feature">
                <div className="about-feature-icon"><FaLock /></div>
                <h3 className="about-feature-title">Secure Transactions</h3>
                <p className="about-feature-text">
                  All transactions are secured with KYC verification and encrypted payment processing.
                </p>
              </div>
              <div className="about-feature">
                <div className="about-feature-icon"><FaBolt /></div>
                <h3 className="about-feature-title">Live Bidding</h3>
                <p className="about-feature-text">
                  Participate in real-time auctions with instant bid updates and notifications.
                </p>
              </div>
              <div className="about-feature">
                <div className="about-feature-icon"><FaMoneyBillWave /></div>
                <h3 className="about-feature-title">Transparent Pricing</h3>
                <p className="about-feature-text">
                  Clear pricing, deposit requirements, and automatic refunds for non-winners.
                </p>
              </div>
              <div className="about-feature">
                <div className="about-feature-icon"><FaCheckCircle /></div>
                <h3 className="about-feature-title">Verified Users</h3>
                <p className="about-feature-text">
                  All participants are verified through KYC process ensuring a safe environment.
                </p>
              </div>
              <div className="about-feature">
                <div className="about-feature-icon">📱</div>
                <h3 className="about-feature-title">Easy Access</h3>
                <p className="about-feature-text">
                  Access auctions from anywhere, anytime with our user-friendly platform.
                </p>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">Our Values</h2>
            <div className="about-values">
              <div className="about-value">
                <h3 className="about-value-title">Transparency</h3>
                <p className="about-value-text">
                  We believe in complete transparency in all transactions and processes.
                </p>
              </div>
              <div className="about-value">
                <h3 className="about-value-title">Security</h3>
                <p className="about-value-text">
                  Your data and transactions are protected with industry-standard security measures.
                </p>
              </div>
              <div className="about-value">
                <h3 className="about-value-title">Integrity</h3>
                <p className="about-value-text">
                  We conduct business with the highest ethical standards and integrity.
                </p>
              </div>
              <div className="about-value">
                <h3 className="about-value-title">Innovation</h3>
                <p className="about-value-text">
                  We continuously innovate to improve user experience and platform capabilities.
                </p>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h2 className="about-section-title">Join Us</h2>
            <p className="about-section-text">
              Whether you're looking to buy your dream property or sell your real estate assets, 
              AuctionNepal provides the tools and platform you need for successful transactions.
            </p>
            <div className="about-cta">
              <a href="/register" className="about-cta-btn">Get Started</a>
              <a href="/auctions" className="about-cta-btn-Secondary">Browse Auctions</a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default About;

