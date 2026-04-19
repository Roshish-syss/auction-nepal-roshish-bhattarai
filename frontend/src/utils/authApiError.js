/**
 * Normalizes axios errors from /auth endpoints (message + express-validator errors array).
 */
export function getAuthApiError(error, fallbackMessage) {
  const data = error.response?.data;
  const fieldErrors = {};

  if (!error.response) {
    const general =
      error.code === 'ECONNABORTED'
        ? 'Request timed out. Please try again.'
        : error.message === 'Network Error'
          ? 'Unable to reach the server. Check your connection and try again.'
          : fallbackMessage;
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
