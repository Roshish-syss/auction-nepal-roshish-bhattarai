import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminNavigation from '../components/AdminNavigation';
import api from '../services/authService';
import { FaSave } from 'react-icons/fa';
import './AdminSettings.css';

const AdminSettings = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    defaultDepositAmount: '50000',
    auctionRules: '',
    platformName: 'AuctionNepal',
    contactEmail: 'admin@auctionnepal.com',
    contactPhone: '9800000000'
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated() || user?.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchSettings();
  }, [isAuthenticated, user, navigate]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/settings');
      if (response.data.success) {
        const s = response.data.settings;
        setSettings({
          defaultDepositAmount: s.defaultDepositAmount?.toString() || '50000',
          auctionRules: s.auctionRules || '',
          platformName: s.platformName || 'AuctionNepal',
          contactEmail: s.contactEmail || 'admin@auctionnepal.com',
          contactPhone: s.contactPhone || '9800000000'
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.put('/admin/settings', settings);
      if (response.data.success) {
        alert('Settings saved successfully');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <AdminNavigation />
        <div className="admin-settings-page">
          <div className="admin-settings-loading">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
        <AdminNavigation />
      <div className="admin-settings-page">
        <div className="admin-settings-container">
          <div className="admin-settings-header">
            <h1 className="admin-settings-title">Admin Settings</h1>
            <p className="admin-settings-subtitle">Configure platform settings</p>
          </div>

          <form onSubmit={handleSubmit} className="admin-settings-form">
            <div className="admin-settings-section">
              <h2 className="admin-settings-section-title">Deposit Configuration</h2>
              <div className="admin-settings-form-group">
                <label>Default Deposit Amount (NPR)</label>
                <input type="number" value={settings.defaultDepositAmount} onChange={(e) => setSettings({ ...settings, defaultDepositAmount: e.target.value })} />
              </div>
            </div>

            <div className="admin-settings-section">
              <h2 className="admin-settings-section-title">Platform Information</h2>
              <div className="admin-settings-form-group">
                <label>Platform Name</label>
                <input type="text" value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} />
              </div>
              <div className="admin-settings-form-group">
                <label>Contact Email</label>
                <input type="email" value={settings.contactEmail} onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })} />
              </div>
              <div className="admin-settings-form-group">
                <label>Contact Phone</label>
                <input type="text" value={settings.contactPhone} onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })} />
              </div>
            </div>

            <div className="admin-settings-section">
              <h2 className="admin-settings-section-title">Auction Rules</h2>
              <div className="admin-settings-form-group">
                <label>Auction Rules & Guidelines</label>
                <textarea rows="10" value={settings.auctionRules} onChange={(e) => setSettings({ ...settings, auctionRules: e.target.value })} placeholder="Enter auction rules and guidelines..." />
              </div>
            </div>

            <div className="admin-settings-form-actions">
              <button type="submit" disabled={saving} className="admin-settings-btn admin-settings-btn-primary">
                <FaSave /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;

