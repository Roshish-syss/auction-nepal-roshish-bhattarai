import React from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { FaQuestionCircle, FaBook, FaVideo, FaEnvelope } from 'react-icons/fa';
import './Help.css';

const Help = () => {
  return (
    <div>
      <Navigation />
      <div className="help-page">
        <div className="help-container">
          <div className="help-header">
            <h1 className="help-title">Help Center</h1>
            <p className="help-subtitle">Get assistance with using AuctionNepal</p>
          </div>

          <div className="help-sections">
            <div className="help-section">
              <FaQuestionCircle className="help-section-icon" />
              <h2>Frequently Asked Questions</h2>
              <p>Find answers to common questions about registration, bidding, deposits, and more.</p>
              <a href="/faq" className="help-link">Visit FAQ →</a>
            </div>

            <div className="help-section">
              <FaBook className="help-section-icon" />
              <h2>How-to Guides</h2>
              <p>Step-by-step guides to help you navigate through the platform and complete various tasks.</p>
              <button className="help-link-button">View Guides →</button>
            </div>

            <div className="help-section">
              <FaVideo className="help-section-icon" />
              <h2>Video Tutorials</h2>
              <p>Watch video tutorials to learn how to use AuctionNepal effectively.</p>
              <button className="help-link-button">Watch Videos →</button>
            </div>

            <div className="help-section">
              <FaEnvelope className="help-section-icon" />
              <h2>Contact Support</h2>
              <p>Still need help? Contact our support team for personalized assistance.</p>
              <a href="/contact" className="help-link">Contact Us →</a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Help;

