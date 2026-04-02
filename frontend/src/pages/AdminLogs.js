import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminNavigation from '../components/AdminNavigation';
import api from '../services/authService';
import './AdminLogs.css';

const AdminLogs = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ page: 1 });

  useEffect(() => {
    if (!isAuthenticated() || user?.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchLogs();
  }, [filters.page, isAuthenticated, user, navigate]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', filters.page);
      params.append('limit', '50');

      const response = await api.get(`/admin/logs?${params.toString()}`);
      if (response.data.success) {
        setLogs(response.data.logs);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleString('en-NP');

  const getLogTypeClass = (type) => {
    switch (type) {
      case 'user_registration': return 'admin-logs-type-user';
      case 'deposit_submission': return 'admin-logs-type-deposit';
      default: return 'admin-logs-type-default';
    }
  };

  if (loading) {
    return (
      <div>
        <AdminNavigation />
        <div className="admin-logs-page"><div className="admin-logs-loading">Loading logs...</div></div>
      </div>
    );
  }

  return (
    <div>
      <AdminNavigation />
      <div className="admin-logs-page">
        <div className="admin-logs-container">
          <div className="admin-logs-header">
            <h1 className="admin-logs-title">Activity Logs</h1>
            <p className="admin-logs-subtitle">System activity and audit trail</p>
          </div>

          <div className="admin-logs-list">
            {logs.length === 0 ? (
              <div className="admin-logs-empty">No logs found</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={`admin-logs-item ${getLogTypeClass(log.type)}`}>
                  <div className="admin-logs-item-content">
                    <div className="admin-logs-item-type">{log.type.replace('_', ' ').toUpperCase()}</div>
                    <div className="admin-logs-item-description">{log.description}</div>
                    <div className="admin-logs-item-meta">
                      <span>User: {log.userName || 'N/A'}</span>
                      <span>Time: {formatDate(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;

