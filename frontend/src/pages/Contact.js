import React, { useState } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import api from '../services/authService';
import './Contact.css';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // In a real app, you would send this to your backend API
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // TODO: Replace with actual API call
      // const response = await api.post('/contact', formData);
      
      setSuccess('Thank you for contacting us! We will get back to you soon.');
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navigation />
      <div className="contact-page">
        <div className="contact-hero">
          <h1 className="contact-hero-title">Contact Us</h1>
          <p className="contact-hero-subtitle">Get in touch with our team</p>
        </div>

        <div className="contact-container">
          <div className="contact-content">
            <div className="contact-info">
              <h2 className="contact-info-title">Get In Touch</h2>
              <p className="contact-info-text">
                Have questions or need assistance? We're here to help. Reach out to us through 
                any of the following methods.
              </p>

              <div className="contact-details">
                <div className="contact-detail-item">
                  <div className="contact-detail-icon">📧</div>
                  <div className="contact-detail-content">
                    <h3 className="contact-detail-title">Email</h3>
                    <p className="contact-detail-text">support@auctionnepal.com</p>
                    <p className="contact-detail-text">info@auctionnepal.com</p>
                  </div>
                </div>

                <div className="contact-detail-item">
                  <div className="contact-detail-icon">📞</div>
                  <div className="contact-detail-content">
                    <h3 className="contact-detail-title">Phone</h3>
                    <p className="contact-detail-text">+977-1-XXXXXXX</p>
                    <p className="contact-detail-text">+977-98XXXXXXXX</p>
                  </div>
                </div>

                <div className="contact-detail-item">
                  <div className="contact-detail-icon">📍</div>
                  <div className="contact-detail-content">
                    <h3 className="contact-detail-title">Office</h3>
                    <p className="contact-detail-text">Kathmandu, Nepal</p>
                    <p className="contact-detail-text">Business Hours: 9 AM - 6 PM (NST)</p>
                  </div>
                </div>
              </div>

              <div className="contact-social">
                <h3 className="contact-social-title">Follow Us</h3>
                <div className="contact-social-links">
                  <a href="#" className="contact-social-link">Facebook</a>
                  <a href="#" className="contact-social-link">Twitter</a>
                  <a href="#" className="contact-social-link">LinkedIn</a>
                  <a href="#" className="contact-social-link">Instagram</a>
                </div>
              </div>
            </div>

            <div className="contact-form-container">
              <h2 className="contact-form-title">Send us a Message</h2>
              
              {error && <div className="contact-alert contact-alert-error">{error}</div>}
              {success && <div className="contact-alert contact-alert-success">{success}</div>}

              <form onSubmit={handleSubmit} className="contact-form">
                <div className="contact-form-group">
                  <label className="contact-form-label">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="contact-form-input"
                    required
                  />
                </div>

                <div className="contact-form-group">
                  <label className="contact-form-label">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="contact-form-input"
                    required
                  />
                </div>

                <div className="contact-form-group">
                  <label className="contact-form-label">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="contact-form-input"
                  />
                </div>

                <div className="contact-form-group">
                  <label className="contact-form-label">Subject *</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="contact-form-input"
                    required
                  />
                </div>

                <div className="contact-form-group">
                  <label className="contact-form-label">Message *</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    className="contact-form-textarea"
                    rows="6"
                    required
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="contact-form-btn"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Contact;

