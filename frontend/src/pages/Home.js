import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import api from '../services/authService';
import {
  getAuctionEndDate,
  getAuctionStartDate,
  getAuctionRecordStatus
} from '../utils/auctionDisplay';

const FEATURED_LIMIT = 6;

function formatNpr(price) {
  if (price == null || Number.isNaN(Number(price))) return '—';
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 0
  }).format(Number(price));
}

/** Bottom overlay: "Starts in …" / "Ends in …" for featured cards */
function getAuctionTimingOverlay(property) {
  const now = new Date();
  const end = getAuctionEndDate(property);
  const start = getAuctionStartDate(property);
  const recordStatus = getAuctionRecordStatus(property);
  const { status } = property;

  const inWindow = start && end && now >= start && now <= end;
  const isLive =
    status === 'live' ||
    recordStatus === 'live' ||
    inWindow;

  const prefixEnd = 'Ends in';
  const prefixStart = 'Starts in';

  const countdown = (target, mode) => {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return mode === 'end' ? 'Ending soon' : 'Starting soon';
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    const p = mode === 'end' ? prefixEnd : prefixStart;
    if (days >= 1) return `${p} ${days} day${days !== 1 ? 's' : ''}`;
    if (hours >= 1) return `${p} ${hours}h ${mins % 60}m`;
    return `${p} ${Math.max(1, mins)}m`;
  };

  if (isLive && end && now < end) {
    return countdown(end, 'end');
  }
  if (start && now < start) {
    return countdown(start, 'start');
  }
  if (end && now < end) {
    return countdown(end, 'end');
  }
  return null;
}

function getFeaturedStatusUi(property) {
  const now = new Date();
  const end = getAuctionEndDate(property);
  const start = getAuctionStartDate(property);
  const recordStatus = getAuctionRecordStatus(property);
  const { status } = property;

  if (status === 'cancelled' || recordStatus === 'cancelled') {
    return { badgeClass: 'bg-gray-500', label: 'Cancelled' };
  }
  if (status === 'live' || recordStatus === 'live') {
    return { badgeClass: 'bg-red-500', label: 'Live' };
  }
  if (start && end && now >= start && now <= end) {
    return { badgeClass: 'bg-red-500', label: 'Live' };
  }
  if (start && now < start) {
    return { badgeClass: 'bg-blue-500', label: 'Upcoming' };
  }
  return { badgeClass: 'bg-blue-500', label: 'Upcoming' };
}

const Home = () => {
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featured, setFeatured] = useState([]);
  const [listedCount, setListedCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setFeaturedLoading(true);
        const [statsRes, response, responseLive] = await Promise.all([
          api.get('/properties?limit=1'),
          api.get('/properties?limit=40&sort=date-asc&status=upcoming'),
          api.get('/properties?limit=40&sort=date-asc&status=live')
        ]);

        if (cancelled) return;

        if (statsRes.data.success && statsRes.data.pagination) {
          setListedCount(statsRes.data.pagination.totalProperties);
        }

        const fromUpcoming = response.data.success ? response.data.properties || [] : [];
        const fromLive = responseLive.data.success ? responseLive.data.properties || [] : [];

        const byId = new Map();
        [...fromLive, ...fromUpcoming].forEach((p) => {
          if (p && p._id) byId.set(p._id.toString(), p);
        });
        const merged = Array.from(byId.values());

        merged.sort((a, b) => {
          const liveRank = (p) =>
            p.status === 'live' || getAuctionRecordStatus(p) === 'live' ? 0 : 1;
          const ra = liveRank(a);
          const rb = liveRank(b);
          if (ra !== rb) return ra - rb;
          const ta = a.auctionTime ? new Date(a.auctionTime).getTime() : 0;
          const tb = b.auctionTime ? new Date(b.auctionTime).getTime() : 0;
          return ta - tb;
        });

        setFeatured(merged.slice(0, FEATURED_LIMIT));
      } catch (e) {
        console.error('Error loading featured properties:', e);
        if (!cancelled) {
          setFeatured([]);
          setListedCount(null);
        }
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navigation />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-white pt-8 pb-12 sm:pt-12 sm:pb-20">
        <div className="container mx-auto px-4 max-w-full">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-5 sm:space-y-6 min-w-0">
              {/* Tag */}
              <span className="inline-block px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm font-medium max-w-full text-left">
                Nepal's First Secure & Real-Time Property Auction Platform
              </span>

              {/* Headline */}
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-tight break-words">
                Modern Real Estate{' '}
                <span className="text-blue-600">Auctions</span>
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Digitalize property trading in Nepal with transparent, secure, and real-time auction platform. 
                Buy, sell, and rent properties with confidence through our innovative bidding system.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition text-center"
                >
                  Get Started
                </Link>
                <Link
                  to="/auctions"
                  className="bg-white text-gray-700 px-8 py-3 rounded-lg font-medium border-2 border-gray-300 hover:border-gray-400 transition text-center"
                >
                  Browse Auctions
                </Link>
              </div>
            </div>

            {/* Right Column - Property Image with Overlays */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="/hero-property.png"
                  alt="Modern Property"
                  className="w-full min-h-[220px] h-[38vh] sm:h-[420px] md:h-[500px] max-h-[560px] object-cover"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80';
                  }}
                />
                {/* Live Badge */}
                <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    <div>
                      <div className="font-bold">Live</div>
                      <div className="text-xs">Real-Time Bidding</div>
                    </div>
                  </div>
                </div>
                {/* Properties Count Badge */}
                <div className="absolute bottom-4 left-4 bg-white px-4 py-3 rounded-lg shadow-lg">
                  <div className="text-3xl font-bold text-blue-600">
                    {listedCount != null ? listedCount : '—'}
                  </div>
                  <div className="text-sm text-gray-600">Properties listed</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg text-center">
              <p className="text-gray-700">
                All bids are visible in real-time with complete transparency and fairness.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg text-center">
              <p className="text-gray-700">
                Instant refunds for non-winning bidders. No delays, no hassles.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg text-center">
              <p className="text-gray-700">
                Compliant with all regulations and standards for online property auctions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-12 sm:py-20 bg-white">
        <div className="container mx-auto px-4 max-w-full">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 px-1">Key Features</h2>
            <p className="text-lg text-gray-600">
              Everything you need for secure, transparent, and efficient property auctions.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Automatic KYC Verification</h3>
              <p className="text-gray-600">
                Identity verification using citizenship card + OTP. Only verified users can participate in auctions.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Secure Deposits via eSewa/Khalti</h3>
              <p className="text-gray-600">
                Safe, transparent digital transactions through trusted payment gateways. Your money is protected.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Real-Time Auction Updates</h3>
              <p className="text-gray-600">
                Socket.IO ensures instant bid reflection. See live updates as bids are placed in real-time.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">AI Chatbot Assistance</h3>
              <p className="text-gray-600">
                24/7 automated help for new users. Get instant answers to your questions about properties and bidding.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Admin Monitoring & Fraud Detection</h3>
              <p className="text-gray-600">
                Ensures fair and safe bidding environment. Advanced monitoring systems detect and prevent fraudulent activities.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Instant Refund System</h3>
              <p className="text-gray-600">
                Non-winning bidder deposits returned automatically. Quick and hassle-free refund process.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 sm:py-20 bg-gray-50">
        <div className="container mx-auto px-4 max-w-full">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 px-1">How It Works</h2>
            <p className="text-lg text-gray-600">
              A simple 3-step process to start bidding on properties.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-1/4 right-1/4 h-0.5 bg-blue-300 -z-10"></div>

            {/* Step 1 */}
            <div className="bg-blue-50 p-5 sm:p-8 rounded-xl shadow-md relative">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                1
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 mt-4">Register & Verify Identity</h3>
              <p className="text-gray-600">
                Create your account and complete KYC verification with citizenship card and OTP authentication.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-blue-50 p-5 sm:p-8 rounded-xl shadow-md relative">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                2
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 mt-4">Browse Properties & Submit Deposit</h3>
              <p className="text-gray-600">
                Explore upcoming auctions and secure your participation by making an advance deposit via eSewa/Khalti.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-blue-50 p-5 sm:p-8 rounded-xl shadow-md relative">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                3
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 mt-4">Join Live Auctions & Bid in Real-Time</h3>
              <p className="text-gray-600">
                Participate in live auctions with transparent pricing and fair competition. Bid instantly with real-time updates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 px-1 leading-tight">
              Featured Properties & Upcoming Auctions
            </h2>
            <p className="text-lg text-gray-600">
              Explore properties currently open for bidding.
            </p>
          </div>

          {featuredLoading ? (
            <div className="text-center py-16 text-gray-500">Loading featured auctions…</div>
          ) : featured.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-600 mb-4">No live or upcoming auctions right now.</p>
              <Link
                to="/auctions"
                className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Browse all listings
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {featured.map((property) => {
                const primaryPhoto =
                  property.photos?.find((p) => p.isPrimary) || property.photos?.[0];
                const statusUi = getFeaturedStatusUi(property);
                const timing = getAuctionTimingOverlay(property);
                const showCurrentBid =
                  property.currentBid != null &&
                  Number(property.currentBid) > Number(property.basePrice);

                return (
                  <div
                    key={property._id}
                    className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100"
                  >
                    <div className="relative">
                      {primaryPhoto?.url ? (
                        <img
                          src={primaryPhoto.url}
                          alt={property.title}
                          className="w-full h-64 object-cover"
                        />
                      ) : (
                        <div className="w-full h-64 bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
                          No image
                        </div>
                      )}
                      <span
                        className={`absolute top-4 right-4 ${statusUi.badgeClass} text-white px-3 py-1 rounded-lg text-sm font-semibold`}
                      >
                        {statusUi.label}
                      </span>
                      {timing && (
                        <span className="absolute bottom-4 left-4 bg-blue-900 text-white px-3 py-1 rounded-lg text-sm font-semibold max-w-[90%] truncate">
                          {timing}
                        </span>
                      )}
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                        {property.title}
                      </h3>
                      <p className="text-gray-600 mb-4 line-clamp-2">
                        {property.description || property.location?.city || '—'}
                      </p>
                      <div className="flex justify-between mb-4 gap-2">
                        <div>
                          <p className="text-sm text-gray-500">Base Price</p>
                          <p className="text-lg font-bold text-blue-600">
                            {formatNpr(property.basePrice)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {showCurrentBid ? 'Current Bid' : 'Deposit'}
                          </p>
                          <p className="text-lg font-bold text-blue-600">
                            {showCurrentBid
                              ? formatNpr(property.currentBid)
                              : formatNpr(property.depositAmount)}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={`/auctions/${property._id}`}
                        className="block w-full bg-blue-600 text-white text-center py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              to="/auctions"
              className="inline-block bg-gray-100 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              View All Auctions
            </Link>
          </div>
        </div>
      </section>

      {/* Trust & Security Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 px-1">Trust & Security</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Your security and trust are our top priorities. We ensure a safe, legitimate, and regulated platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Security Feature 1 */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">SSL-Secured Platform</h3>
              <p className="text-gray-600">All data transmission is encrypted with industry-standard SSL certificates.</p>
            </div>

            {/* Security Feature 2 */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Encrypted Data Storage</h3>
              <p className="text-gray-600">Your personal information and payment data are stored with bank-level encryption.</p>
            </div>

            {/* Security Feature 3 */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Fake Bidders</h3>
              <p className="text-gray-600">Strict KYC verification ensures only authentic users participate in auctions.</p>
            </div>

            {/* Security Feature 4 */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Transparent Real-Time Bidding</h3>
              <p className="text-gray-600">All bids are visible in real-time with complete transparency and fairness.</p>
            </div>

            {/* Security Feature 5 */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Automated Refund System</h3>
              <p className="text-gray-600">Instant refunds for non-winning bidders. No delays, no hassles.</p>
            </div>

            {/* Security Feature 6 */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Regulated Platform</h3>
              <p className="text-gray-600">Compliant with all regulations and standards for online property auctions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="bg-blue-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 px-2">Ready to Get Started?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join AuctionNepal today and experience the future of real estate trading in Nepal.
          </p>
          <Link
            to="/register"
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            Create Your Account
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
