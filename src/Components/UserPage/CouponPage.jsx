import React, { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { VoucherCanvas } from '../TemplateLibrary/components/VoucherCanvas'
import { fetchCouponUiDesign, applyCouponOverrides } from './CouponArtWork'

function CouponsPage({ availableCoupons, redeemedCoupons }) {
  const [designCache, setDesignCache] = useState({}) // { [couponId]: design }
  const [statusById, setStatusById] = useState({}) // { [couponId]: 'loading' | 'error' }

  // Which coupon's artwork is currently shown enlarged, e.g.
  // { design, coupon } — null when nothing is enlarged.
  const [enlarged, setEnlarged] = useState(null)

  // Load artwork for every coupon in both lists, once, as soon as we have
  // their couponId/couponTemplateId. Keyed by couponId so a coupon that
  // shows up in both "available" and "redeemed" only fetches once.
  useEffect(() => {
    const allCoupons = [...availableCoupons, ...redeemedCoupons]
    allCoupons.forEach((c) => {
      if (c.couponId == null || c.couponTemplateId == null) return
      if (designCache[c.couponId] || statusById[c.couponId] === 'loading') return

      setStatusById((cur) => ({ ...cur, [c.couponId]: 'loading' }))
      fetchCouponUiDesign(c.couponId, c.couponTemplateId)
        .then((design) => {
          setDesignCache((cur) => ({ ...cur, [c.couponId]: design }))
          setStatusById((cur) => {
            const next = { ...cur }
            delete next[c.couponId]
            return next
          })
        })
        .catch(() => {
          setStatusById((cur) => ({ ...cur, [c.couponId]: 'error' }))
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCoupons, redeemedCoupons])

  // Close the enlarged view on Escape too, not just the X button.
  useEffect(() => {
    if (!enlarged) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setEnlarged(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enlarged])

  const closeEnlarged = () => setEnlarged(null)

  // Shared row info (code, discount, artwork) plus an optional slot for
  // fields that only apply to one list — availableCoupons gets
  // minSpend/expiry, redeemedCoupons gets the redeem date.
  const renderCouponItem = (c, key, extraFields) => {
    const status = statusById[c.couponId]
    const design = designCache[c.couponId]
    const mergedDesign = design ? applyCouponOverrides(design, c) : null

    return (
      <li key={key} className="coupon-item">
        <div className="coupon-item-row">
          <strong>{c.couponUniqueCode}</strong>
          <span>
            {c.discountPercentage > 0 ? `${c.discountPercentage}% off` : `₹${c.discountAmount} off`}
          </span>
          {extraFields}
        </div>

        <div className="coupon-artwork-panel">
          {status === 'loading' && (
            <div className="coupon-artwork-loading">
              <Loader2 size={16} className="coupon-spin" />
              <span>Loading artwork…</span>
            </div>
          )}
          {status === 'error' && <p style={{ color: 'red' }}>Could not load coupon artwork.</p>}
          {mergedDesign && (
            <div
              className="coupon-artwork-thumb"
              style={{ width: 260, aspectRatio: '1.6' }}
              onClick={() => setEnlarged({ design: mergedDesign, coupon: c })}
              role="button"
              tabIndex={0}
              aria-label="Enlarge coupon artwork"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setEnlarged({ design: mergedDesign, coupon: c })
              }}
            >
              <VoucherCanvas design={mergedDesign} />
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="tab-page">
      <section>
        <h2>Available Coupons</h2>
        {availableCoupons.length === 0 ? (
          <p>No coupons available right now.</p>
        ) : (
          <ul className="coupon-list">
            {availableCoupons.map((c) =>
              renderCouponItem(
                c,
                c.couponAssignmentId,
                <>
                  {c.minSpendAmount != null && <span>Min spend ₹{c.minSpendAmount}</span>}
                  {c.expiryDate && <span>Expires {new Date(c.expiryDate).toLocaleDateString()}</span>}
                </>
              )
            )}
          </ul>
        )}
      </section>

      <section>
        <h2>Redeemed Coupons</h2>
        {redeemedCoupons.length === 0 ? (
          <p>No coupons redeemed yet.</p>
        ) : (
          <ul className="coupon-list">
            {redeemedCoupons.map((c) =>
              renderCouponItem(
                c,
                c.couponRedemptionId,
                c.reedemDate && (
                  <span>
                    Redeemed on{' '}
                    {new Date(c.reedemDate).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )
              )
            )}
          </ul>
        )}
      </section>

      {enlarged && (
        <div className="coupon-enlarge-overlay" onClick={closeEnlarged}>
          <div className="coupon-enlarge-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="coupon-enlarge-close"
              onClick={closeEnlarged}
              aria-label="Close enlarged artwork"
              title="Close"
            >
              <X size={20} />
            </button>
            <div className="coupon-enlarge-canvas">
              <VoucherCanvas design={enlarged.design} />
            </div>
            <p className="coupon-enlarge-code">{enlarged.coupon.couponUniqueCode}</p>
          </div>
        </div>
      )}

      <style>{`
        .coupon-item-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .coupon-artwork-panel {
          margin-top: 10px;
        }
        .coupon-artwork-thumb {
          cursor: pointer;
          border-radius: 8px;
          overflow: hidden;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .coupon-artwork-thumb:hover {
          transform: scale(1.02);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
        }
        .coupon-artwork-loading {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #6B667F;
        }
        .coupon-spin {
          animation: coupon-spin 1s linear infinite;
        }
        @keyframes coupon-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .coupon-enlarge-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }
        .coupon-enlarge-modal {
          position: relative;
          background: #FFFFFF;
          border-radius: 12px;
          padding: 24px;
          max-width: min(640px, 92vw);
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .coupon-enlarge-close {
          position: absolute;
          top: 12px;
          right: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid #E4E1EE;
          background: #FFFFFF;
          cursor: pointer;
        }
        .coupon-enlarge-close:hover {
          background: #F6F5FA;
        }
        .coupon-enlarge-canvas {
          width: 100%;
          aspect-ratio: 1.6;
        }
        .coupon-enlarge-code {
          font-weight: 700;
          font-size: 15px;
          margin: 0;
        }
      `}</style>
    </div>
  )
}

export default CouponsPage