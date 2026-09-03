import React, { useState, useEffect } from 'react'
import LoginPage from '../LoginPage/LoginPage'
import CouponsPage from './CouponPage'
import InvoicePage from './InvoicePage'
import ReturnsPage from './ReturnPage'
import { getUserDashboard } from '../../api/userApi'
import './UserPage.css'

const CUSTOMER_STORAGE_KEY = 'customer'

function loadStoredCustomer() {
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    // Corrupt/unreadable value — treat as logged out rather than crashing.
    return null
  }
}

function UserPage() {
  // Seed from localStorage synchronously so there's no flash of the
  // login page on refresh for an already-logged-in customer.
  const [customer, setCustomer] = useState(loadStoredCustomer)
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('invoice') // default to invoice so the last bill is front and center

  const handleLoginSuccess = (result) => {
    try {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(result))
    } catch (e) {
      // Storage full/unavailable (private browsing, etc.) — login still
      // works for this session, it just won't survive a refresh.
    }
    setCustomer(result)
  }

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
        if (cancelled) return
        setError(err.message)
        // If the stored session is no longer valid server-side (expired
        // token, deleted account, etc.), a 401/403 should kick the
        // person back to login rather than showing a permanent error.
        if (err.status === 401 || err.status === 403) {
          handleLogout()
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [customer])

  const handleLogout = () => {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY)
    setCustomer(null)
    setDashboard(null)
    setError('')
    setActiveTab('invoice')
  }

  if (!customer) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  // Purchases already come back most-recent-first from GetUserDashboard
  // (OrderByDescending(p => p.PurchaseDate)), so the first entry is the last bill.
  const latestInvoiceNumber = dashboard?.purchases?.[0]?.invoiceNumber ?? null

  return (
    <div className="user-page">
      <header className="user-page-header">
        <h1>Welcome, Customer</h1>
        <button className="logout-btn" onClick={handleLogout}>Log Out</button>
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