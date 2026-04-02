import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import KYCVerification from './pages/KYCVerification';
import AdminKYC from './pages/AdminKYC';
import AdminRoute from './components/AdminRoute';
import UserRoute from './components/UserRoute';
import AdminDashboard from './pages/AdminDashboard';
import AdminDeposits from './pages/AdminDeposits';
import AdminProperties from './pages/AdminProperties';
import AdminUsers from './pages/AdminUsers';
import AdminAuctions from './pages/AdminAuctions';
import AdminSettings from './pages/AdminSettings';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminLogs from './pages/AdminLogs';
import Rules from './pages/Rules';
import About from './pages/About';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import Auctions from './pages/Auctions';
import PropertyDetail from './pages/PropertyDetail';
import AuctionRecords from './pages/AuctionRecords';
import DepositPayment from './pages/DepositPayment';
import DepositHistory from './pages/DepositHistory';
import Wallet from './pages/Wallet';
import MyBids from './pages/MyBids';
import AuctionHistory from './pages/AuctionHistory';
import Notifications from './pages/Notifications';
import LiveAuction from './pages/LiveAuction';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Help from './pages/Help';
import FAQ from './pages/FAQ';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

function App() {
  return (
    <AuthProvider>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/kyc-verification" element={<KYCVerification />} />
        
        {/* Admin Routes - Protected */}
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/kyc" element={<AdminRoute><AdminKYC /></AdminRoute>} />
        <Route path="/admin/deposits" element={<AdminRoute><AdminDeposits /></AdminRoute>} />
        <Route path="/admin/properties" element={<AdminRoute><AdminProperties /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/auctions" element={<AdminRoute><AdminAuctions /></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="/admin/logs" element={<AdminRoute><AdminLogs /></AdminRoute>} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        {/* User Routes - Protected (redirect admins away) */}
        <Route path="/dashboard" element={<UserRoute><Dashboard /></UserRoute>} />
        <Route path="/wallet" element={<UserRoute><Wallet /></UserRoute>} />
        <Route path="/deposit/:propertyId" element={<UserRoute><DepositPayment /></UserRoute>} />
        <Route path="/deposits" element={<UserRoute><DepositHistory /></UserRoute>} />
        <Route path="/my-bids" element={<UserRoute><MyBids /></UserRoute>} />
        <Route path="/auction-history" element={<UserRoute><AuctionHistory /></UserRoute>} />
        <Route path="/notifications" element={<UserRoute><Notifications /></UserRoute>} />
        <Route path="/auction/:id/live" element={<UserRoute allowAdmin><LiveAuction /></UserRoute>} />
        <Route path="/chat" element={<UserRoute><Chat /></UserRoute>} />
        <Route path="/profile" element={<UserRoute><Profile /></UserRoute>} />
        
        {/* Public routes - accessible to all */}
        <Route path="/auctions" element={<Auctions />} />
        <Route path="/auctions/:id/records" element={<AuctionRecords />} />
        <Route path="/auctions/:id" element={<PropertyDetail />} />
        <Route path="/help" element={<Help />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

