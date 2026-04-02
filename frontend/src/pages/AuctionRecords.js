import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import api from '../services/authService';
import { FaChevronLeft, FaGavel } from 'react-icons/fa';
import './AuctionRecords.css';

const AuctionRecords = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/auctions/property/${id}/bid-timeline`);
        if (!cancelled && res.data.success) {
          setData(res.data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || 'Could not load auction records');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const formatPrice = (price) => {
    if (price == null || Number.isNaN(Number(price))) return '—';
    return new Intl.NumberFormat('en-NP', {
      style: 'currency',
      currency: 'NPR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const formatWhen = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-NP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="auction-records-page">
      <Navigation />
      <div className="auction-records-inner">
        <button type="button" className="auction-records-back" onClick={() => navigate(`/auctions/${id}`)}>
          <FaChevronLeft aria-hidden />
          Back to listing
        </button>

        {loading && <p className="auction-records-muted">Loading records…</p>}
        {error && !loading && <p className="auction-records-error">{error}</p>}

        {!loading && !error && data && (
          <>
            <header className="auction-records-header">
              <h1 className="auction-records-title">
                <FaGavel className="auction-records-title-icon" aria-hidden />
                Auction records
              </h1>
              <p className="auction-records-subtitle">
                Public history of bids on this listing (amounts and times). Bidder identities are not shown.
              </p>
              {data.property?.title && (
                <p className="auction-records-property">
                  <Link to={`/auctions/${id}`}>{data.property.title}</Link>
                </p>
              )}
            </header>

            {!data.auction && (
              <p className="auction-records-muted">{data.message || 'No auction data.'}</p>
            )}

            {data.auction && (
              <section className="auction-records-summary" aria-labelledby="ar-summary">
                <h2 id="ar-summary" className="auction-records-section-title">
                  Live session summary
                </h2>
                <dl className="auction-records-dl">
                  <div>
                    <dt>Status</dt>
                    <dd>{data.auction.status}</dd>
                  </div>
                  <div>
                    <dt>Scheduled start</dt>
                    <dd>{formatWhen(data.auction.startTime)}</dd>
                  </div>
                  <div>
                    <dt>Scheduled end</dt>
                    <dd>{formatWhen(data.auction.endTime)}</dd>
                  </div>
                  {data.auction.actualEndTime && (
                    <div>
                      <dt>Ended at</dt>
                      <dd>{formatWhen(data.auction.actualEndTime)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Starting bid</dt>
                    <dd>{formatPrice(data.auction.startingBid)}</dd>
                  </div>
                  <div>
                    <dt>Latest / final bid on record</dt>
                    <dd>{formatPrice(data.auction.currentBid)}</dd>
                  </div>
                  <div>
                    <dt>Minimum increment</dt>
                    <dd>{formatPrice(data.auction.bidIncrement)}</dd>
                  </div>
                  <div>
                    <dt>Total bids stored</dt>
                    <dd>{data.timeline?.length ?? data.auction.totalBids ?? 0}</dd>
                  </div>
                  {data.auction.winner && (
                    <div className="auction-records-winner-row">
                      <dt>Winner</dt>
                      <dd>
                        {data.auction.winner.fullName}
                        {data.auction.winner.winningBid != null && (
                          <span className="auction-records-winner-bid">
                            {' '}
                            — {formatPrice(data.auction.winner.winningBid)}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {data.auction && (
              <section className="auction-records-timeline" aria-labelledby="ar-timeline">
                <h2 id="ar-timeline" className="auction-records-section-title">
                  Bid timeline
                </h2>
                {(!data.timeline || data.timeline.length === 0) && (
                  <p className="auction-records-muted">No bids have been recorded yet.</p>
                )}
                {data.timeline && data.timeline.length > 0 && (
                  <div className="auction-records-table-wrap">
                    <table className="auction-records-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Time</th>
                          <th>Bid amount</th>
                          <th>Previous high</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.timeline.map((row) => (
                          <tr key={row.sequence}>
                            <td>{row.sequence}</td>
                            <td>{formatWhen(row.timestamp)}</td>
                            <td className="auction-records-num">{formatPrice(row.bidAmount)}</td>
                            <td className="auction-records-num">
                              {row.previousBid != null ? formatPrice(row.previousBid) : '—'}
                            </td>
                            <td>
                              {row.isWinningBid && <span className="auction-records-badge">High bid</span>}
                              {row.status && row.status !== 'accepted' && (
                                <span className="auction-records-status">{row.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuctionRecords;
