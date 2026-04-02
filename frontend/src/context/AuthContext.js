import React, { createContext, useState, useEffect, useContext } from 'react';
import { getAuthToken, logout as logoutService } from '../services/authService';
import api from '../services/authService';

// Simple JWT decode function (or use jwt-decode package after npm install)
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        const decoded = decodeToken(token);
        if (decoded) {
          // Check if token is expired
          const currentTime = Date.now() / 1000;
          if (decoded.exp && decoded.exp < currentTime) {
            // Token expired, try to refresh
            try {
              const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
              if (refreshToken) {
                const response = await api.post('/auth/refresh-token', { refreshToken });
                if (response.data.success && response.data.accessToken) {
                  // Store new token in same storage as refresh token
                  const storage = localStorage.getItem('refreshToken') ? localStorage : sessionStorage;
                  storage.setItem('accessToken', response.data.accessToken);
                  // Fetch user profile with new token
                  const profileResponse = await api.get('/users/profile');
                  if (profileResponse.data.success) {
                    setUser(profileResponse.data.user);
                  } else {
                    logoutService();
                  }
                } else {
                  logoutService();
                }
              } else {
                logoutService();
              }
            } catch (refreshError) {
              console.error('Token refresh error:', refreshError);
              logoutService();
            }
          } else {
            // Token is valid, fetch fresh user data from API
            try {
              const response = await api.get('/users/profile');
              if (response.data.success) {
                setUser(response.data.user);
              } else {
                logoutService();
              }
            } catch (error) {
              // If profile fetch fails, try to refresh token
              if (error.response?.status === 401) {
                try {
                  const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
                  if (refreshToken) {
                    const refreshResponse = await api.post('/auth/refresh-token', { refreshToken });
                    if (refreshResponse.data.success && refreshResponse.data.accessToken) {
                      const storage = localStorage.getItem('refreshToken') ? localStorage : sessionStorage;
                      storage.setItem('accessToken', refreshResponse.data.accessToken);
                      const profileResponse = await api.get('/users/profile');
                      if (profileResponse.data.success) {
                        setUser(profileResponse.data.user);
                      } else {
                        logoutService();
                      }
                    } else {
                      logoutService();
                    }
                  } else {
                    logoutService();
                  }
                } catch (refreshError) {
                  console.error('Token refresh error:', refreshError);
                  logoutService();
                }
              } else {
                // Other error, just log it but don't logout
                console.error('Error fetching profile:', error);
              }
            }
          }
        } else {
          logoutService();
        }
      } catch (error) {
        console.error('Token decode error:', error);
        logoutService();
      }
    }
    setLoading(false);
  };

  const login = async (userData, token) => {
    localStorage.setItem('userFullName', userData.fullName || 'User');
    localStorage.setItem('userEmail', userData.email || '');
    // Set initial user data
    setUser(userData);
    
    // Fetch complete user profile including profile picture
    try {
      const response = await api.get('/users/profile');
      if (response.data.success) {
        setUser(response.data.user);
        localStorage.setItem('userFullName', response.data.user.fullName || 'User');
        localStorage.setItem('userEmail', response.data.user.email || '');
      }
    } catch (error) {
      console.error('Error fetching user profile after login:', error);
      // Keep the initial userData if profile fetch fails
    }
  };

  const logout = async () => {
    await logoutService();
    localStorage.removeItem('userFullName');
    localStorage.removeItem('userEmail');
    setUser(null);
  };

  const isAuthenticated = () => {
    return !!user;
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const updateUser = async () => {
    // Refresh user data from API
    try {
      const response = await api.get('/users/profile');
      if (response.data.success) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    getInitials,
    checkAuth,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

