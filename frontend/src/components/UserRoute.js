import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const UserRoute = ({ children, allowAdmin = false }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'admin' && !allowAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default UserRoute;

