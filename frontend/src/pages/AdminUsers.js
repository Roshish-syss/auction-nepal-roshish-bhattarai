import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminNavigation from '../components/AdminNavigation';
import api from '../services/authService';
import { FaEdit, FaTrash, FaEye, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import './AdminUsers.css';

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ search: '', role: '', kycVerified: '', page: 1 });
  const [pagination, setPagination] = useState({ totalPages: 1, currentPage: 1, total: 0 });

  useEffect(() => {
    if (!isAuthenticated() || user?.role !== 'admin') {
      navigate('/login');
      return;
    }
    fetchUsers();
  }, [filters, isAuthenticated, user, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.role) params.append('role', filters.role);
      if (filters.kycVerified) params.append('kycVerified', filters.kycVerified);
      params.append('page', filters.page);
      params.append('limit', '20');

      const response = await api.get(`/admin/users?${params.toString()}`);
      if (response.data.success) {
        setUsers(response.data.users);
        setPagination({ totalPages: response.data.totalPages, currentPage: response.data.currentPage, total: response.data.total });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting user');
    }
  };

  if (loading) {
    return (
      <div>
        <AdminNavigation />
        <div className="admin-users-page"><div className="admin-users-loading">Loading users...</div></div>
      </div>
    );
  }

  return (
    <div>
      <AdminNavigation />
      <div className="admin-users-page">
        <div className="admin-users-container">
          <div className="admin-users-header">
            <h1 className="admin-users-title">User Management</h1>
            <p className="admin-users-subtitle">Manage all users</p>
          </div>

          <div className="admin-users-filters">
            <input type="text" placeholder="Search users..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })} className="admin-users-search-input" />
            <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })} className="admin-users-filter-select">
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <select value={filters.kycVerified} onChange={(e) => setFilters({ ...filters, kycVerified: e.target.value, page: 1 })} className="admin-users-filter-select">
              <option value="">All KYC Status</option>
              <option value="true">Verified</option>
              <option value="false">Not Verified</option>
            </select>
          </div>

          <div className="admin-users-list">
            {users.length === 0 ? (
              <div className="admin-users-empty">No users found</div>
            ) : (
              users.map((u) => (
                <div key={u._id} className="admin-users-item">
                  <div className="admin-users-item-content">
                    <div>
                      <h3 className="admin-users-item-name">{u.fullName}</h3>
                      <p className="admin-users-item-email">{u.email}</p>
                      <p className="admin-users-item-phone">{u.phoneNumber}</p>
                      <div className="admin-users-item-badges">
                        <span className={`admin-users-badge ${u.role === 'admin' ? 'admin-users-badge-admin' : 'admin-users-badge-user'}`}>{u.role}</span>
                        {u.kycVerified ? <span className="admin-users-badge admin-users-badge-verified"><FaCheckCircle /> Verified</span> : <span className="admin-users-badge admin-users-badge-unverified"><FaTimesCircle /> Not Verified</span>}
                      </div>
                    </div>
                    <div className="admin-users-item-actions">
                      <button onClick={() => handleDelete(u._id)} className="admin-users-btn admin-users-btn-danger"><FaTrash /> Delete</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="admin-users-pagination">
              <button onClick={() => setFilters({ ...filters, page: filters.page - 1 })} disabled={filters.page === 1} className="admin-users-page-btn">Previous</button>
              <span className="admin-users-page-info">Page {pagination.currentPage} of {pagination.totalPages}</span>
              <button onClick={() => setFilters({ ...filters, page: filters.page + 1 })} disabled={filters.page === pagination.totalPages} className="admin-users-page-btn">Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;

