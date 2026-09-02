import React from 'react'

function CouponsPage({ availableCoupons, redeemedCoupons }) {
  return (
    <div className="tab-page">
      <section>
        <h2>Available Coupons</h2>
        {availableCoupons.length === 0 ? (
          <p>No coupons available right now.</p>
        ) : (
          <ul className="coupon-list">
            {availableCoupons.map((c) => (
              <li key={c.couponAssignmentId} className="coupon-item">
                <strong>{c.couponUniqueCode}</strong>
                <span>
                  {c.discountPercentage > 0
                    ? `${c.discountPercentage}% off`
                    : `₹${c.discountAmount} off`}
                </span>
                <span>Min spend ₹{c.minSpendAmount}</span>
                <span>Expires {new Date(c.expiryDate).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Redeemed Coupons</h2>
        {redeemedCoupons.length === 0 ? (
          <p>No coupons redeemed yet.</p>
        ) : (
          <ul className="coupon-list">
            {redeemedCoupons.map((c) => (
              <li key={c.couponRedemptionId} className="coupon-item">
                <strong>{c.couponUniqueCode}</strong>
                <span>
                  {c.discountPercentage > 0
                    ? `${c.discountPercentage}% off`
                    : `₹${c.discountAmount} off`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default CouponsPage