import React, { useState, useEffect } from 'react';
import api from '../services/authService';
import AdminNavigation from '../components/AdminNavigation';
import './AdminKYC.css';

const AdminKYC = () => {
  const [kycs, setKycs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKYC, setSelectedKYC] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchKYCs();
  }, [filter]);

  const fetchKYCs = async () => {
    try {
      setLoading(true);
      const endpoint = filter === 'pending' 
        ? '/kyc/admin/pending' 
        : `/kyc/admin/all?status=${filter === 'all' ? '' : filter}`;
      
      const response = await api.get(endpoint);
      if (response.data.success) {
        setKycs(response.data.kycs || []);
      }
    } catch (error) {
      console.error('Error fetching KYCs:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewKYCDetails = async (kycId) => {
    try {
      const response = await api.get(`/kyc/admin/${kycId}`);
      if (response.data.success) {
        setSelectedKYC(response.data.kyc);
      }
    } catch (error) {
      console.error('Error fetching KYC details:', error);
    }
  };

  const handleApprove = async (kycId) => {
    if (!window.confirm('Are you sure you want to approve this KYC verification?')) {
      return;
    }

    try {
      const response = await api.post(`/kyc/admin/approve/${kycId}`);
      if (response.data.success) {
        alert('KYC approved successfully!');
        fetchKYCs();
        setSelectedKYC(null);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to approve KYC');
    }
  };

  const handleReject = async (kycId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    if (!window.confirm('Are you sure you want to reject this KYC verification?')) {
      return;
    }

    try {
      const response = await api.post(`/kyc/admin/reject/${kycId}`, {
        rejectionReason
      });
      if (response.data.success) {
        alert('KYC rejected successfully!');
        fetchKYCs();
        setSelectedKYC(null);
        setRejectionReason('');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to reject KYC');
    }
  };

  const getStatusBadge = (status) => {
    const statuses = {
      pending: { class: 'badge-pending', text: 'Pending' },
      email_verified: { class: 'badge-info', text: 'Email Verified' },
      document_uploaded: { class: 'badge-warning', text: 'Document Uploaded' },
      under_review: { class: 'badge-warning', text: 'Under Review' },
      approved: { class: 'badge-success', text: 'Approved' },
      rejected: { class: 'badge-error', text: 'Rejected' }
    };
    const statusInfo = statuses[status] || statuses.pending;
    return <span className={`badge ${statusInfo.class}`}>{statusInfo.text}</span>;
  };

  if (loading) {
    return (
      <div className="admin-kyc-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <AdminNavigation />
      <div className="admin-kyc-container">
      <div className="admin-kyc-header">
        <h1>KYC Verification Management</h1>
        <div className="filter-tabs">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button
            className={filter === 'under_review' ? 'active' : ''}
            onClick={() => setFilter('under_review')}
          >
            Under Review
          </button>
          <button
            className={filter === 'approved' ? 'active' : ''}
            onClick={() => setFilter('approved')}
          >
            Approved
          </button>
          <button
            className={filter === 'rejected' ? 'active' : ''}
            onClick={() => setFilter('rejected')}
          >
            Rejected
          </button>
        </div>
      </div>

      <div className="admin-kyc-content">
        <div className="kyc-list">
          <h2>KYC Applications ({kycs.length})</h2>
          {kycs.length === 0 ? (
            <div className="empty-state">No KYC applications found</div>
          ) : (
            <div className="kyc-table">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {kycs.map((kyc) => (
                    <tr key={kyc._id}>
                      <td>
                        {kyc.userId?.fullName || 'N/A'}
                        <br />
                        <small>{kyc.userId?.email}</small>
                      </td>
                      <td>{kyc.email || kyc.userId?.email}</td>
                      <td>{getStatusBadge(kyc.status)}</td>
                      <td>{new Date(kyc.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          onClick={() => viewKYCDetails(kyc._id)}
                          className="btn-view"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedKYC && (
          <div className="kyc-details-panel">
            <div className="panel-header">
              <h2>KYC Details</h2>
              <button onClick={() => setSelectedKYC(null)} className="close-btn">×</button>
            </div>

            <div className="panel-content">
              <div className="detail-section">
                <h3>User Information</h3>
                <p><strong>Name:</strong> {selectedKYC.userId?.fullName}</p>
                <p><strong>Email:</strong> {selectedKYC.userId?.email}</p>
                <p><strong>Email:</strong> {selectedKYC.email || selectedKYC.userId?.email}</p>
                {selectedKYC.citizenshipNumber && (
                  <p><strong>Citizenship Number:</strong> {selectedKYC.citizenshipNumber}</p>
                )}
              </div>

              <div className="detail-section">
                <h3>Verification Status</h3>
                <p><strong>Email Verified:</strong> {selectedKYC.emailVerified ? 'Yes' : 'No'}</p>
                <p><strong>Document Uploaded:</strong> {selectedKYC.citizenshipPhoto?.url ? 'Yes' : 'No'}</p>
                <p><strong>Status:</strong> {getStatusBadge(selectedKYC.status)}</p>
                {selectedKYC.rejectionReason && (
                  <p><strong>Rejection Reason:</strong> {selectedKYC.rejectionReason}</p>
                )}
              </div>

              {selectedKYC.citizenshipPhoto?.url && (
                <div className="detail-section">
                  <h3>Citizenship Document</h3>
                  <img
                    src={selectedKYC.citizenshipPhoto.url}
                    alt="Citizenship"
                    className="citizenship-image"
                  />
                </div>
              )}

              {selectedKYC.status !== 'approved' && selectedKYC.status !== 'rejected' && (
                <div className="detail-section actions-section">
                  <h3>Actions</h3>
                  <button
                    onClick={() => handleApprove(selectedKYC._id)}
                    className="btn-approve"
                  >
                    Approve KYC
                  </button>
                  <div className="reject-form">
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      rows="3"
                    />
                    <button
                      onClick={() => handleReject(selectedKYC._id)}
                      className="btn-reject"
                      disabled={!rejectionReason.trim()}
                    >
                      Reject KYC
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default AdminKYC;

