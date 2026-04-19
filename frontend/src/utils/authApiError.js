import { getApiBaseUrl } from '../services/authService';

/**
 * Normalizes axios errors from /auth endpoints (message + express-validator errors array).
 */
export function getAuthApiError(error, fallbackMessage) {
  const data = error.response?.data;
  const fieldErrors = {};

  if (!error.response) {
    let general;
    if (error.code === 'ECONNABORTED') {
      general = 'Request timed out. Please try again.';
    } else if (error.message === 'Network Error') {
      const base = getApiBaseUrl();
      general = !base
        ? 'Server URL is not set. Add REACT_APP_API_URL (e.g. https://your-api.onrender.com/api) in your host environment and redeploy the frontend.'
        : 'Unable to reach the API. Confirm the backend is running, the URL is correct, and CORS (FRONTEND_URL on the server) includes this site’s origin.';
    } else {
      general = fallbackMessage;
    }
    return { general, fieldErrors };
  }

  if (Array.isArray(data?.errors)) {
    for (const e of data.errors) {
      const path = e.path || e.param;
      if (path) {
        fieldErrors[path] = e.msg || e.message || String(e);
      }
    }
  }

  let general = data?.message || fallbackMessage;
  if (Object.keys(fieldErrors).length > 0 && data?.message === 'Validation failed') {
    general = 'Please correct the errors below.';
  }

  return { general, fieldErrors };
}
