import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { register as registerService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { getAuthApiError } from '../utils/authApiError';
import { passwordMeetsAllRules } from '../utils/passwordRules';
import PasswordRequirements from '../components/PasswordRequirements';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Register = () => {
  const { login, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated() && user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value: raw } = e.target;
    const value = name === 'phoneNumber' ? raw.replace(/\D/g, '').slice(0, 10) : raw;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setError('');
    setSuccess('');
  };

  const validate = () => {
    const next = {};
    const fullName = formData.fullName.trim();
    if (!fullName) {
      next.fullName = 'Full name is required';
    } else if (fullName.length < 2) {
      next.fullName = 'Please enter your full name (at least 2 characters)';
    }

    const email = formData.email.trim();
    if (!email) {
      next.email = 'Email is required';
    } else if (!EMAIL_RE.test(email)) {
      next.email = 'Please enter a valid email address';
    }

    const phoneDigits = formData.phoneNumber.replace(/\D/g, '');
    if (!phoneDigits) {
      next.phoneNumber = 'Phone number is required';
    } else if (phoneDigits.length !== 10) {
      next.phoneNumber = 'Phone number must be exactly 10 digits';
    }

    if (!formData.password) {
      next.password = 'Password is required';
    } else if (!passwordMeetsAllRules(formData.password)) {
      next.password = 'Password must meet all requirements below';
    }

    if (!formData.confirmPassword) {
      next.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      next.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(next);
    const hasErrors = Object.keys(next).length > 0;
    setError(hasErrors ? 'Please correct the errors below.' : '');
    return !hasErrors;
  };

  const fieldRing = (name) =>
    fieldErrors[name]
      ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
      : 'border-gray-300 focus:border-blue-500';

  const passwordAriaDescribedBy = [
    ...(fieldErrors.password ? ['password-error'] : []),
    'password-requirements',
  ].join(' ');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});

    if (!validate()) {
      return;
    }

    setLoading(true);

    const payload = {
      ...formData,
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      phoneNumber: formData.phoneNumber.replace(/\D/g, '')
    };

    try {
      const response = await registerService(payload);
      if (response.success) {
        // Tokens are already stored in authService
        // Update auth context
        await login(response.user, response.accessToken);
        setSuccess('Account created successfully! Redirecting...');
        setTimeout(() => {
          // Redirect based on user role
          if (response.user.role === 'admin') {
            navigate('/admin/dashboard');
          } else {
            navigate('/dashboard');
          }
        }, 1500);
      } else {
        setError(response.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      const { general, fieldErrors: apiFields } = getAuthApiError(
        err,
        'Registration failed. Please try again.'
      );
      setError(general);
      if (Object.keys(apiFields).length) {
        setFieldErrors(apiFields);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4 py-4 overflow-x-hidden overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md my-auto">
        {/* Logo */}
        <div className="flex justify-center mb-3">
          <Logo className="mb-0" size="small" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">
          Create your account
        </h1>
        <div className="text-center mb-4">
          <Link to="/login" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            Or sign in to your existing account
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex gap-2"
            role="alert"
          >
            <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div
            className="mb-3 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm flex gap-2"
            role="status"
          >
            <svg className="h-5 w-5 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5" noValidate>
          {/* Full Name Field */}
          <div>
            <label htmlFor="fullName" className="block text-xs font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              autoComplete="name"
              aria-invalid={!!fieldErrors.fullName}
              aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
              className={`block w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${fieldRing('fullName')}`}
            />
            {fieldErrors.fullName && (
              <p id="fullName-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.fullName}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              autoComplete="email"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={`block w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${fieldRing('email')}`}
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Phone Number Field */}
          <div>
            <label htmlFor="phoneNumber" className="block text-xs font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="Enter 10-digit phone number"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              aria-invalid={!!fieldErrors.phoneNumber}
              aria-describedby={fieldErrors.phoneNumber ? 'phoneNumber-error' : undefined}
              className={`block w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${fieldRing('phoneNumber')}`}
            />
            {fieldErrors.phoneNumber && (
              <p id="phoneNumber-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.phoneNumber}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a strong password"
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={passwordAriaDescribedBy}
                className={`block w-full px-3 py-2 pr-9 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${fieldRing('password')}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center"
              >
                <svg
                  className={`h-4 w-4 ${showPassword ? 'text-blue-600' : 'text-gray-400'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            <PasswordRequirements password={formData.password} />
            {fieldErrors.password && (
              <p id="password-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                autoComplete="new-password"
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                className={`block w-full px-3 py-2 pr-9 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${fieldRing('confirmPassword')}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center"
              >
                <svg
                  className={`h-4 w-4 ${showConfirmPassword ? 'text-blue-600' : 'text-gray-400'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {showConfirmPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p id="confirmPassword-error" className="mt-1 text-xs text-red-600">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* Create Account Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed mt-3"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        {/* Back to Home */}
        <div className="mt-3 text-center">
          <Link to="/" className="inline-flex items-center text-xs text-blue-600 hover:text-blue-700">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;

