import axios from 'axios';

// Production (Render static site): set REACT_APP_API_URL at build time, e.g. https://your-api.onrender.com/api
const API_URL = (() => {
  const fromEnv = process.env.REACT_APP_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[AuctionNepal] REACT_APP_API_URL is not set. In Render → Static Site → Environment, set it to your API base URL, e.g. https://your-api.onrender.com/api, then rebuild.'
    );
    return '';
  }
  return 'http://localhost:5000/api';
})();

/** Used by error helpers to tell missing env apart from real network failures */
export function getApiBaseUrl() {
  return API_URL;
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const register = async (userData) => {
  try {
    const payload = {
      ...userData,
      email: String(userData.email || '').trim().toLowerCase(),
      phoneNumber: String(userData.phoneNumber || '').replace(/\D/g, '').slice(0, 10)
    };
    const response = await api.post('/auth/register', payload);
    // Store both tokens in sessionStorage (registration doesn't have remember me)
    if (response.data.accessToken && response.data.refreshToken) {
      sessionStorage.setItem('accessToken', response.data.accessToken);
      sessionStorage.setItem('refreshToken', response.data.refreshToken);
    }
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const login = async (credentials) => {
  try {
    const response = await api.post('/auth/login', {
      email: String(credentials.email || '').trim().toLowerCase(),
      password: credentials.password,
      rememberMe: credentials.rememberMe || false
    });
    // Store both tokens
    if (response.data.accessToken && response.data.refreshToken) {
      if (credentials.rememberMe) {
        // Store in localStorage for 30 days persistence
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.setItem('rememberMe', 'true');
      } else {
        // Store in sessionStorage (cleared when tab closes)
        sessionStorage.setItem('accessToken', response.data.accessToken);
        sessionStorage.setItem('refreshToken', response.data.refreshToken);
        localStorage.removeItem('rememberMe');
      }
    }
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  // Get refresh token before clearing
  const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
  
  // Clear tokens from both storages
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('token'); // Legacy support
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('token'); // Legacy support
  
  // Call backend to invalidate refresh token (fire and forget)
  if (refreshToken) {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch (error) {
      // Ignore errors during logout cleanup - tokens are already cleared locally
      console.error('Error during logout cleanup:', error);
    }
  }
};

export const getAuthToken = () => {
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
};

export const getRefreshToken = () => {
  return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
};

export const refreshAccessToken = async () => {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post('/auth/refresh-token', {
      refreshToken
    });

    if (response.data.accessToken) {
      const storage = localStorage.getItem('refreshToken') ? localStorage : sessionStorage;
      storage.setItem('accessToken', response.data.accessToken);
      return response.data.accessToken;
    }
  } catch (error) {
    // If refresh fails, clear tokens and logout
    logout();
    throw error;
  }
};

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/** 401 on these routes means bad credentials/body, not an expired access token — never run refresh + hard redirect. */
function isPublicAuth401(config) {
  if (!config?.url) return false;
  const joined = `${config.baseURL || ''}${config.url}`.split('?')[0].replace(/\/+$/, '');
  return /\/auth\/(login|register|forgot-password|reset-password|refresh-token)$/.test(joined);
}

// Response interceptor to handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && isPublicAuth401(originalRequest)) {
      return Promise.reject(error);
    }

    // If error is 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

