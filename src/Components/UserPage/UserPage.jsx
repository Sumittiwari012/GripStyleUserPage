import React, { useState, useEffect } from 'react'
import LoginPage from '../LoginPage/LoginPage'
import CouponsPage from './CouponPage'
import InvoicePage from './InvoicePage'
import ReturnsPage from './ReturnPage'
import { getUserDashboard } from '../../api/userApi'
import './UserPage.css'

function UserPage() {
  const [customer, setCustomer] = useState(null) // result from VerifyLoginOtp
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('invoice') // default to invoice so the last bill is front and center

  useEffect(() => {
    if (!customer) return

    let cancelled = false
    setLoading(true)
    setError('')

    getUserDashboard(customer.customerId)
      .then((data) => {
        if (!cancelled) setDashboard(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [customer])

  const handleLogout = () => {
    setCustomer(null)
    setDashboard(null)
    setError('')
    setActiveTab('invoice')
  }

  if (!customer) {
    return <LoginPage onLoginSuccess={(result) => setCustomer(result)} />
  }

  // Purchases already come back most-recent-first from GetUserDashboard
  // (OrderByDescending(p => p.PurchaseDate)), so the first entry is the last bill.
  const latestInvoiceNumber = dashboard?.purchases?.[0]?.invoiceNumber ?? null

  return (
    <div className="user-page">
      <header className="user-page-header">
        <h1>Welcome, Customer</h1>
        <button onClick={handleLogout}>Log Out</button>
      </header>

      {loading && <p>Loading your account...</p>}
      {error && <p className="error-message">{error}</p>}

      {dashboard && (
        <>
          <section className="wallet-card">
            <span className="wallet-label">Wallet Balance</span>
            <span className="wallet-value">₹{dashboard.walletValue}</span>
          </section>

          <nav className="tab-bar">
            <button
              className={`tab-btn ${activeTab === 'coupons' ? 'active' : ''}`}
              onClick={() => setActiveTab('coupons')}
            >
              Coupons
            </button>
            <button
              className={`tab-btn ${activeTab === 'invoice' ? 'active' : ''}`}
              onClick={() => setActiveTab('invoice')}
            >
              Invoice
            </button>
            <button
              className={`tab-btn ${activeTab === 'returns' ? 'active' : ''}`}
              onClick={() => setActiveTab('returns')}
            >
              Returns
            </button>
          </nav>

          {activeTab === 'coupons' && (
            <CouponsPage
              availableCoupons={dashboard.availableCoupons}
              redeemedCoupons={dashboard.redeemedCoupons}
            />
          )}

          {activeTab === 'invoice' && (
            <InvoicePage
              purchases={dashboard.purchases}
              autoOpenInvoiceNumber={latestInvoiceNumber}
            />
          )}

          {activeTab === 'returns' && (
            <ReturnsPage returns={dashboard.returns} />
          )}
        </>
      )}
    </div>
  )
}

export default UserPage