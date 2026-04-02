import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import api from '../services/authService';
import socketService from '../services/socketService';
import { FaClock, FaGavel, FaUsers, FaTrophy, FaExclamationTriangle, FaComments } from 'react-icons/fa';
import PropertyLocationSection from '../components/PropertyLocationSection';
import './LiveAuction.css';

/** Safe string id for Mongo / socket (avoids "[object Object]"). */
function toMongoIdString(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'string') {
    const t = val.trim();
    return t || null;
  }
  if (typeof val === 'object') {
    if (typeof val.toHexString === 'function') return val.toHexString();
    if (val._id != null) return toMongoIdString(val._id);
    if (val.$oid) return String(val.$oid);
  }
  const s = String(val);
  if (s === '[object Object]') return null;
  return s || null;
}

const LiveAuction = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [inAuctionRoom, setInAuctionRoom] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [error, setError] = useState('');
  const [bidError, setBidError] = useState('');
  const [participantCount, setParticipantCount] = useState(0);
  /** null = not loaded / error; true = API says approved deposit; false = none */
  const [depositEligibility, setDepositEligibility] = useState(null);
  const socketRef = useRef(null);
  const auctionMongoIdRef = useRef(null);
  /** Real property Mongo id for socket (URL :id may be property id OR auction id). */
  const propertyIdRef = useRef(null);
  const wasInRoomRef = useRef(false);
  const secretCodeRef = useRef(null);
  /** Prevents duplicate auto-join emits; reset on error or route change */
  const autoJoinGateRef = useRef(false);
  const [auctionChatMessages, setAuctionChatMessages] = useState([]);
  const [auctionChatInput, setAuctionChatInput] = useState('');
  const [auctionChatError, setAuctionChatError] = useState('');
  const auctionChatListRef = useRef(null);

  useEffect(() => {
    autoJoinGateRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!inAuctionRoom) {
      setAuctionChatMessages([]);
      setAuctionChatError('');
      setAuctionChatInput('');
    }
  }, [inAuctionRoom]);

  useEffect(() => {
    const el = auctionChatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [auctionChatMessages]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return undefined;
    }
    fetchAuctionDetails();

    const socket = socketService.connect();
    socketRef.current = socket;

    if (!socket) {
      setError('Failed to connect to auction server. Please refresh the page.');
      return undefined;
    }

    const tryRejoinRoom = () => {
      const aid = auctionMongoIdRef.current;
      const pid = propertyIdRef.current || toMongoIdString(id);
      if (wasInRoomRef.current && aid && pid) {
        socket.emit('join_auction', {
          auctionId: aid,
          propertyId: pid,
          secretCode: secretCodeRef.current || undefined
        });
      }
    };

    const onConnect = () => {
      setSocketConnected(true);
      setError('');
      tryRejoinRoom();
    };

    const onDisconnect = () => {
      setSocketConnected(false);
      setInAuctionRoom(false);
      setError('Disconnected from server. Reconnecting…');
    };

    const onConnectError = (err) => {
      console.error('Socket connection error:', err);
      setError('Connection error. Please check your internet connection.');
      setSocketConnected(false);
      setInAuctionRoom(false);
    };

    const onAuctionJoined = (data) => {
      if (data.auction) {
        const a = data.auction;
        const propRef = a.propertyId;
        const propIdStr =
          propRef && typeof propRef === 'object' && propRef._id != null
            ? String(propRef._id)
            : propRef != null
              ? String(propRef)
              : null;
        setAuction((prev) => ({
          ...prev,
          ...a,
          _id: a._id != null ? a._id : prev?._id,
          propertyId: propIdStr ?? prev?.propertyId ?? id,
          currentBid: a.currentBid ?? prev?.currentBid ?? prev?.basePrice
        }));
      }
      if (data.bids) {
        setBids(data.bids);
      }
      setParticipantCount(data.auction?.participantCount || 0);
      setSocketConnected(true);
      setInAuctionRoom(true);
      wasInRoomRef.current = true;
      setError('');
    };

    const onAuctionError = (data) => {
      const msg = data.message || 'An error occurred';
      setError(msg);
      setInAuctionRoom(false);
      if (/key|deposit|approval|Enter the auction/i.test(msg)) {
        autoJoinGateRef.current = false;
      }
      if (/not found/i.test(msg) || /ended/i.test(msg) || /not active/i.test(msg)) {
        wasInRoomRef.current = false;
      }
      if (process.env.NODE_ENV === 'development') {
        console.warn('Auction:', msg);
      }
    };

    const onNewBid = (data) => {
      setBidError('');
      if (data.bid) {
        setBids((prev) => {
          const next = [data.bid, ...prev.filter((b) => b._id !== data.bid._id)];
          return next.slice(0, 50);
        });
      }
      if (data.auction) {
        setAuction((prev) => ({
          ...prev,
          currentBid: data.auction.currentBid,
          highestBidder: data.auction.highestBidder,
          totalBids: data.auction.totalBids
        }));
      }
    };

    const onBidError = (data) => {
      setBidError(data.message || 'Could not place bid');
      console.error('Bid error:', data);
    };

    const onParticipantJoined = (data) => {
      setParticipantCount(data.participantCount || 0);
    };

    const onParticipantLeft = (data) => {
      setParticipantCount(data.participantCount || 0);
    };

    const onAuctionStatus = (data) => {
      if (data.auction) {
        setAuction((prev) => ({
          ...prev,
          ...data.auction
        }));
        setParticipantCount(data.auction.participantCount || 0);
      }
    };

    const onAuctionEnded = (data) => {
      if (data.auction) {
        setAuction((prev) => ({
          ...prev,
          ...data.auction,
          status: 'completed'
        }));
      }
      if (data.winner) {
        alert(data.message || 'Auction ended. Winner announced.');
      } else {
        alert(data.message || 'Auction ended with no winner');
      }
      setInAuctionRoom(false);
      wasInRoomRef.current = false;
    };

    const onAuctionEndSuccess = () => {
      alert('Auction ended successfully');
    };

    const onAuctionChatHistory = (data) => {
      const list = Array.isArray(data?.messages) ? data.messages : [];
      setAuctionChatMessages(list);
      setAuctionChatError('');
    };

    const onAuctionChatMessage = (payload) => {
      if (!payload?._id) return;
      setAuctionChatMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(payload._id))) return prev;
        return [...prev, payload];
      });
    };

    const onAuctionChatError = (data) => {
      setAuctionChatError(data?.message || 'Could not send message');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('auction_joined', onAuctionJoined);
    socket.on('auction_error', onAuctionError);
    socket.on('new_bid', onNewBid);
    socket.on('bid_error', onBidError);
    socket.on('participant_joined', onParticipantJoined);
    socket.on('participant_left', onParticipantLeft);
    socket.on('auction_status', onAuctionStatus);
    socket.on('auction_ended', onAuctionEnded);
    socket.on('auction_end_success', onAuctionEndSuccess);
    socket.on('auction_chat_history', onAuctionChatHistory);
    socket.on('auction_chat_message', onAuctionChatMessage);
    socket.on('auction_chat_error', onAuctionChatError);

    if (socket.connected) {
      setSocketConnected(true);
      setError('');
      tryRejoinRoom();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('auction_joined', onAuctionJoined);
      socket.off('auction_error', onAuctionError);
      socket.off('new_bid', onNewBid);
      socket.off('bid_error', onBidError);
      socket.off('participant_joined', onParticipantJoined);
      socket.off('participant_left', onParticipantLeft);
      socket.off('auction_status', onAuctionStatus);
      socket.off('auction_ended', onAuctionEnded);
      socket.off('auction_end_success', onAuctionEndSuccess);
      socket.off('auction_chat_history', onAuctionChatHistory);
      socket.off('auction_chat_message', onAuctionChatMessage);
      socket.off('auction_chat_error', onAuctionChatError);

      const leaveId = auctionMongoIdRef.current;
      if (leaveId) {
        socketService.leaveAuction(leaveId);
      }
      wasInRoomRef.current = false;
    };
  }, [id, isAuthenticated, navigate]);

  useEffect(() => {
    if (!auction) return;

    const endMs = (() => {
      if (auction.endTime) {
        const t = new Date(auction.endTime).getTime();
        return Number.isFinite(t) ? t : null;
      }
      const startRaw = auction.startTime || auction.auctionTime;
      if (!startRaw) return null;
      const start = new Date(startRaw).getTime();
      if (!Number.isFinite(start)) return null;
      const mins = auction.auctionDuration != null ? Number(auction.auctionDuration) : 60;
      return start + mins * 60 * 1000;
    })();

    if (endMs == null) {
      setTimeLeft(null);
      return undefined;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  useEffect(() => {
    const pid = toMongoIdString(auction?.propertyId) || toMongoIdString(id);
    propertyIdRef.current = pid;

    const s = toMongoIdString(auction?._id);
    if (s && auction?.hasAuctionListing !== false) {
      auctionMongoIdRef.current = s;
    } else {
      auctionMongoIdRef.current = null;
    }
  }, [auction, id]);

  useEffect(() => {
    if (!inAuctionRoom || !auctionMongoIdRef.current) return undefined;
    const aid = auctionMongoIdRef.current;
    const tick = () => {
      socketService.getAuctionStatus(aid, propertyIdRef.current || toMongoIdString(id));
    };
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, [inAuctionRoom, id]);

  useEffect(() => {
    if (user?.role === 'admin') {
      setDepositEligibility(true);
      return undefined;
    }
    const aid = toMongoIdString(auction?._id);
    if (!aid || auction?.hasAuctionListing === false) {
      setDepositEligibility(null);
      return undefined;
    }
    let ignore = false;
    const pid = toMongoIdString(auction?.propertyId) || toMongoIdString(id);
    const eligibilityPath = pid
      ? `/auctions/property/${pid}/eligibility`
      : `/auctions/${aid}/eligibility`;

    const applyEligibility = (res) => {
      if (ignore || !res.data?.success) return;
      setDepositEligibility(!!res.data.hasDeposit);
    };

    api.get(eligibilityPath).then(applyEligibility).catch(() => {
      if (!ignore) setDepositEligibility(null);
    });
    return () => {
      ignore = true;
    };
  }, [auction, user?.role]);

  useEffect(() => {
    if (!socketConnected || !auction || auction.hasAuctionListing === false) return;
    if (['completed', 'cancelled'].includes(auction.status)) return;
    if (inAuctionRoom) return;

    const pid = toMongoIdString(auction.propertyId) || toMongoIdString(id);
    const aid = toMongoIdString(auction._id);
    if (!pid || !aid) return;

    if (user?.role === 'admin') {
      if (autoJoinGateRef.current) return;
      autoJoinGateRef.current = true;
      secretCodeRef.current = null;
      socketService.joinAuction(aid, null, pid);
      return;
    }

    if (depositEligibility === null) return;

    const keyFromUrl = (searchParams.get('key') || '').trim();

    if (depositEligibility === true) {
      if (autoJoinGateRef.current) return;
      autoJoinGateRef.current = true;
      secretCodeRef.current = null;
      socketService.joinAuction(aid, null, pid);
      return;
    }

    if (keyFromUrl) {
      if (autoJoinGateRef.current) return;
      autoJoinGateRef.current = true;
      setSecretCode(keyFromUrl);
      secretCodeRef.current = keyFromUrl;
      socketService.joinAuction(aid, keyFromUrl, pid);
    }
  }, [
    socketConnected,
    auction,
    id,
    inAuctionRoom,
    depositEligibility,
    user?.role,
    searchParams
  ]);

  const fetchAuctionDetails = async () => {
    try {
      setLoading(true);
      setAuction(null);
      setError('');

      let auctionResponse;
      try {
        // :id in URL is usually the property id (from /auctions/:id page)
        auctionResponse = await api.get(`/auctions/property/${id}`);
      } catch (err) {
        // Same path may use auction document id — try GET /auctions/:auctionId
        try {
          auctionResponse = await api.get(`/auctions/${id}`);
        } catch (err2) {
          const propertyResponse = await api.get(`/properties/${id}`);
          if (propertyResponse.data.success) {
            const property = propertyResponse.data.property;
            const { _id: propMongoId, ...propertyFields } = property;
            setAuction({
              ...propertyFields,
              propertyId: propMongoId,
              hasAuctionListing: false,
              currentBid: property.basePrice || 0,
              status: 'upcoming'
            });
            setLoading(false);
            return;
          }
          throw err;
        }
      }

      if (auctionResponse.data.success) {
        const auctionData = auctionResponse.data.auction;
        const prop = auctionData.propertyId;
        const propertyPlainId =
          prop && typeof prop === 'object' ? prop._id : prop;

        setAuction({
          ...auctionData,
          propertyId: propertyPlainId != null ? String(propertyPlainId) : String(id),
          hasAuctionListing: true,
          ...(typeof prop === 'object' && prop
            ? {
                title: prop.title ?? auctionData.title,
                location: prop.location,
                photos: prop.photos,
                specifications: prop.specifications,
                basePrice: prop.basePrice ?? auctionData.basePrice,
                depositAmount: prop.depositAmount
              }
            : {}),
          currentBid:
            auctionData.currentBid ??
            auctionData.startingBid ??
            (typeof prop === 'object' ? prop.basePrice : null) ??
            0,
          status: auctionData.status || 'live'
        });
      }
    } catch (error) {
      console.error('Error fetching auction:', error);
      setAuction(null);
      setError(
        'No property or auction matches this link. Use a listing from Browse auctions, or ask an admin to create an auction for this property.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWithKey = () => {
    const code = String(secretCode || '').trim();
    if (!code) {
      setError('Enter the auction key.');
      return;
    }
    if (!socketRef.current?.connected || !auction || auction.hasAuctionListing === false) {
      setError('Not connected. Wait a moment and try again.');
      return;
    }
    const propertyIdStr =
      toMongoIdString(auction.propertyId) ||
      propertyIdRef.current ||
      toMongoIdString(id);
    const auctionIdStr = toMongoIdString(auctionMongoIdRef.current || auction._id);
    if (!propertyIdStr || !auctionIdStr) {
      setError('Missing listing id. Reload the page.');
      return;
    }
    autoJoinGateRef.current = true;
    secretCodeRef.current = code;
    setError('');
    socketService.joinAuction(auctionIdStr, code, propertyIdStr);
  };

  const handleBid = async (e) => {
    e.preventDefault();
    setBidError('');

    if (!socketRef.current?.connected || !inAuctionRoom) {
      setBidError('Join the auction room first, then place a bid.');
      return;
    }

    if (!bidAmount || Number.isNaN(Number(bidAmount))) {
      setBidError('Enter a valid bid amount.');
      return;
    }

    const minBidUi =
      (auction?.currentBid || auction?.startingBid || auction?.basePrice || 0) +
      (auction?.bidIncrement || 1000);

    if (Number(bidAmount) < minBidUi) {
      setBidError(`Minimum bid is ${minBidUi.toLocaleString('en-NP')} NPR`);
      return;
    }

    const propertyIdStr =
      toMongoIdString(auction?.propertyId) ||
      propertyIdRef.current ||
      toMongoIdString(id);
    const auctionIdStr = toMongoIdString(auctionMongoIdRef.current || auction?._id);

    if (!propertyIdStr) {
      setBidError('Missing property id. Reload the page.');
      return;
    }

    socketService.placeBid(auctionIdStr, propertyIdStr, Number(bidAmount));
    setBidAmount('');
  };

  const handleAuctionChatSubmit = (e) => {
    e.preventDefault();
    setAuctionChatError('');
    const text = String(auctionChatInput || '').trim();
    if (!text) return;
    if (!socketRef.current?.connected || !inAuctionRoom) {
      setAuctionChatError('Join the room to send messages.');
      return;
    }
    const auctionIdStr = toMongoIdString(auctionMongoIdRef.current || auction?._id);
    if (!auctionIdStr) {
      setAuctionChatError('Missing auction id.');
      return;
    }
    socketService.sendAuctionChatMessage(auctionIdStr, text);
    setAuctionChatInput('');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="live-auction-page">
          <div className="live-auction-container">
            <div className="live-auction-loading">Loading auction...</div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!auction) {
    return (
      <div>
        <Navigation />
        <div className="live-auction-page">
          <div className="live-auction-container">
            <div className="live-auction-error">
              {error ||
                'Nothing matches this link. The id may be wrong, or no auction exists in the database for this listing.'}
            </div>
            <p className="live-auction-join-hint" style={{ textAlign: 'center', marginTop: '1rem' }}>
              Open a property from <button type="button" className="live-auction-join-btn" onClick={() => navigate('/auctions')}>Browse auctions</button> and use &quot;Join live&quot; from there, or create an auction in Admin.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const minBid =
    (auction.currentBid || auction.startingBid || auction.basePrice || 0) +
    (auction.bidIncrement || 1000);

  const startMsRaw = auction.startTime || auction.auctionTime;
  const startMs = startMsRaw ? new Date(startMsRaw).getTime() : NaN;
  const isWaitingForStart =
    Boolean(
      socketConnected &&
        inAuctionRoom &&
        auction.status === 'scheduled' &&
        Number.isFinite(startMs) &&
        Date.now() < startMs
    );

  return (
    <div>
      <Navigation />
      <div className="live-auction-page">
        <div className="live-auction-container">
          {/* Header */}
          <div className="live-auction-header">
            <h1 className="live-auction-title">{auction.title || 'Live Auction'}</h1>
            <div className="live-auction-status">
              <span
                className={`live-auction-status-badge ${
                  auction.status === 'live' ? 'live-auction-status-live' : ''
                }`}
              >
                {auction.status === 'live'
                  ? 'Live'
                  : auction.status === 'completed'
                    ? 'Completed'
                    : 'Upcoming'}
              </span>
              <span className="live-auction-status-badge">
                <span
                  className={`live-auction-conn-dot ${socketConnected ? 'live-auction-conn-dot--on' : 'live-auction-conn-dot--off'}`}
                  aria-hidden
                />
                {socketConnected
                  ? inAuctionRoom
                    ? 'In room'
                    : 'Connected'
                  : 'Offline'}
              </span>
            </div>
          </div>

          {auction.status === 'completed' && auction.winner?.userId && (
            <div className="live-auction-winner-banner" role="status">
              <FaTrophy aria-hidden className="live-auction-winner-icon" />
              <div>
                <span className="live-auction-winner-label">Auction winner</span>
                <p className="live-auction-winner-text">
                  <strong>
                    {typeof auction.winner.userId === 'object'
                      ? auction.winner.userId.fullName || 'Winner'
                      : 'Winner'}
                  </strong>
                  {auction.winner.winningBid != null && (
                    <> — winning bid {formatPrice(auction.winner.winningBid)}</>
                  )}
                </p>
              </div>
            </div>
          )}

          <div className="live-auction-meta-bar">
            {(auction.startTime || auction.auctionTime) && (
              <div className="live-auction-meta-item">
                <span>Starts</span>
                <strong>
                  {new Date(auction.startTime || auction.auctionTime).toLocaleString('en-NP', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </strong>
              </div>
            )}
            {auction.endTime && (
              <div className="live-auction-meta-item">
                <span>Ends</span>
                <strong>
                  {new Date(auction.endTime).toLocaleString('en-NP', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </strong>
              </div>
            )}
            <div className="live-auction-meta-item">
              <span>Bid step</span>
              <strong>{formatPrice(auction.bidIncrement || 1000)}</strong>
            </div>
            {typeof auction.totalBids === 'number' && (
              <div className="live-auction-meta-item">
                <span>Total bids</span>
                <strong>{auction.totalBids}</strong>
              </div>
            )}
          </div>

          {error && (
            <div className="live-auction-error-banner">
              <FaExclamationTriangle /> {error}
            </div>
          )}

          {isWaitingForStart && (
            <div className="live-auction-waiting-banner" role="status">
              <FaClock aria-hidden className="live-auction-waiting-icon" />
              <div>
                <strong>Waiting room</strong> — you&apos;re connected. Bidding opens when the auction goes live at{' '}
                {new Date(startMsRaw).toLocaleString('en-NP', { dateStyle: 'medium', timeStyle: 'short' })}.
              </div>
            </div>
          )}

          <PropertyLocationSection property={auction} heading="Property location" mapHeight={220} />

          {auction.hasAuctionListing === false && (
            <div className="live-auction-error-banner" role="status">
              <FaExclamationTriangle /> This property does not have an auction record yet. An admin must create an auction (Admin → Auctions) before anyone can join the live room. The API returned no auction for this id.
            </div>
          )}

          {socketConnected &&
            !inAuctionRoom &&
            depositEligibility === null &&
            user?.role !== 'admin' &&
            !loading &&
            auction.hasAuctionListing !== false &&
            !['completed', 'cancelled'].includes(auction.status) && (
              <p className="live-auction-status-line">Checking your access…</p>
            )}

          {socketConnected &&
            !inAuctionRoom &&
            !loading &&
            auction.hasAuctionListing !== false &&
            !['completed', 'cancelled'].includes(auction.status) &&
            user?.role !== 'admin' &&
            depositEligibility === false &&
            !(searchParams.get('key') || '').trim() && (
              <div className="live-auction-key-entry">
                <p className="live-auction-key-entry-label">Enter the auction key from the listing page to watch live (bidding still requires an approved deposit).</p>
                <div className="live-auction-key-entry-row">
                  <input
                    type="text"
                    value={secretCode}
                    onChange={(e) => setSecretCode(e.target.value)}
                    placeholder="Auction key"
                    className="live-auction-key-input"
                    autoComplete="off"
                  />
                  <button type="button" onClick={handleConnectWithKey} className="live-auction-key-btn">
                    Connect
                  </button>
                </div>
              </div>
            )}

          {!socketConnected && !loading && (
            <div className="live-auction-join">
              <p className="live-auction-join-hint">Connecting to live server…</p>
            </div>
          )}

          {/* Countdown Timer */}
          <div className={`live-auction-timer${timeLeft === null ? ' live-auction-timer--na' : ''}`}>
            <FaClock className="live-auction-timer-icon" />
            <div className="live-auction-timer-content">
              <span className="live-auction-timer-label">Time remaining</span>
              <span className="live-auction-timer-value">
                {timeLeft === null ? 'Set when auction is scheduled' : formatTime(timeLeft)}
              </span>
            </div>
          </div>

          <div className="live-auction-grid">
            {/* Main Auction Area */}
            <div className="live-auction-main">
              {/* Current Bid Display */}
              <div className="live-auction-current-bid">
                <h2>Current Highest Bid</h2>
                <div className="live-auction-current-bid-amount">{formatPrice(auction.currentBid || auction.basePrice || 0)}</div>
                {auction.highestBidder && (
                  <div className="live-auction-current-bidder">
                    <FaTrophy /> Highest Bidder: {auction.highestBidder.fullName || 'You'}
                  </div>
                )}
              </div>

              {/* Bid Form */}
              {socketConnected &&
                inAuctionRoom &&
                depositEligibility === true &&
                user?.role !== 'admin' &&
                auction.status === 'live' && (
                <div className="live-auction-bid-form">
                  <h3>Place your bid</h3>
                  <p className="live-auction-min-bid">Minimum bid: {formatPrice(minBid)}</p>
                  {bidError && (
                    <p className="live-auction-bid-error" role="alert">
                      {bidError}
                    </p>
                  )}
                  <form onSubmit={handleBid}>
                    <div className="live-auction-bid-input-group">
                      <input
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`Min: ${minBid}`}
                        min={minBid}
                        step={auction.bidIncrement || 1000}
                        className="live-auction-bid-input"
                        required
                      />
                      <button type="submit" className="live-auction-bid-btn">
                        <FaGavel /> Place Bid
                      </button>
                    </div>
                  </form>
                </div>
              )}
              {socketConnected &&
                inAuctionRoom &&
                depositEligibility !== true &&
                user?.role !== 'admin' &&
                auction.status === 'live' && (
                <p className="live-auction-watch-only">You are watching as a guest. Pay deposit and get approval to place bids.</p>
              )}
              {socketConnected &&
                inAuctionRoom &&
                depositEligibility !== true &&
                user?.role !== 'admin' &&
                auction.status === 'scheduled' &&
                isWaitingForStart && (
                <p className="live-auction-watch-only">
                  You&apos;re in the waiting room as a guest. Pay deposit and get approval to bid when the auction goes live.
                </p>
              )}
            </div>

            {/* Sidebar */}
            <div className="live-auction-sidebar">
              {/* Bid History */}
              <div className="live-auction-section">
                <h3 className="live-auction-section-title">
                  <FaGavel /> Recent Bids
                </h3>
                <div className="live-auction-bids-list">
                  {bids.length === 0 ? (
                    <div className="live-auction-bids-empty">No bids yet</div>
                  ) : (
                    bids.slice(0, 10).map((bid) => (
                      <div key={bid._id} className="live-auction-bid-item">
                        <div className="live-auction-bid-item-user">{bid.userId?.fullName || 'Anonymous'}</div>
                        <div className="live-auction-bid-item-amount">{formatPrice(bid.bidAmount)}</div>
                        <div className="live-auction-bid-item-time">
                          {new Date(bid.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Participants */}
              <div className="live-auction-section">
                <h3 className="live-auction-section-title">
                  <FaUsers /> Participants
                </h3>
                <div className="live-auction-participants">
                  <div className="live-auction-participant-count">
                    {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
                  </div>
                </div>
              </div>

              {/* Room chat (Socket.IO) */}
              <div className="live-auction-section live-auction-chat-section">
                <h3 className="live-auction-section-title">
                  <FaComments /> Room chat
                </h3>
                {!inAuctionRoom ? (
                  <p className="live-auction-chat-hint">Join the auction room to see and send messages.</p>
                ) : (
                  <>
                    <div
                      ref={auctionChatListRef}
                      className="live-auction-chat-messages"
                      role="log"
                      aria-live="polite"
                      aria-relevant="additions"
                    >
                      {auctionChatMessages.length === 0 ? (
                        <div className="live-auction-chat-empty">No messages yet. Say hello.</div>
                      ) : (
                        auctionChatMessages.map((m) => {
                          const mine =
                            user &&
                            m.senderId != null &&
                            String(m.senderId) === String(user._id || user.id);
                          return (
                            <div
                              key={String(m._id)}
                              className={`live-auction-chat-row${mine ? ' live-auction-chat-row--own' : ''}`}
                            >
                              <span className="live-auction-chat-author">
                                {mine ? 'You' : m.senderName || 'Participant'}
                              </span>
                              <span className="live-auction-chat-text">{m.message}</span>
                              <span className="live-auction-chat-time">
                                {m.createdAt
                                  ? new Date(m.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : ''}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {auctionChatError && (
                      <p className="live-auction-chat-error" role="alert">
                        {auctionChatError}
                      </p>
                    )}
                    <form onSubmit={handleAuctionChatSubmit} className="live-auction-chat-form">
                      <input
                        type="text"
                        value={auctionChatInput}
                        onChange={(e) => setAuctionChatInput(e.target.value)}
                        placeholder="Message the room…"
                        maxLength={500}
                        className="live-auction-chat-input"
                        autoComplete="off"
                        aria-label="Auction room message"
                      />
                      <button type="submit" className="live-auction-chat-send" disabled={!auctionChatInput.trim()}>
                        Send
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LiveAuction;

