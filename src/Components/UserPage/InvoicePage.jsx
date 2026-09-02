import React, { useState, useEffect } from 'react'
import InvoiceBill from './invoiceBill' // adjust path to your actual InvoiceBill location

const API_BASE_URL = 'https://dummypossetup.runasp.net'

function InvoicePage({ purchases, autoOpenInvoiceNumber }) {
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [loadingInvoice, setLoadingInvoice] = useState(null) // invoiceNumber currently loading
  const [error, setError] = useState('')

  const fetchInvoice = async (invoiceNumber) => {
    setLoadingInvoice(invoiceNumber)
    setError('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/getTransactionDetails?invoiceNumber=${encodeURIComponent(invoiceNumber)}`
      )

      if (!response.ok) {
        throw new Error('Unable to load invoice')
      }

      const data = await response.json()

      const invoiceData = {
        invoiceNumber: data.invoiceNumber,
        customer: {
          customerName: data.customerName,
          mobileNumber: data.customerMobile
        },
        cart: data.items.map((item) => ({
          id: item.productId,
          name: item.productName,
          quantity: item.quantity,
          price: item.salePrice,
          mrp: item.mrp ?? item.MRP ?? 0,
          discount: item.discount ?? 0,
          cgst: item.cgst ?? 0,
          hsnCode: item.hsnCode ?? item.hsn ?? item.HSNCode ?? '-'
        })),
        totalAmount: data.totalAmount,
        discount: data.discount,
        taxAmount: data.taxAmount ?? 0,
        payableAmount: data.totalAmount - data.discount,
        payments: data.payments.map((p) => ({
          method: p.paymentMethod,
          amount: p.amountPaid
        })),
        completedAt: data.purchaseDate
      }

      setSelectedInvoice(invoiceData)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to load invoice.')
    } finally {
      setLoadingInvoice(null)
    }
  }

  // Auto-open the most recent bill as soon as we know its invoice number.
  useEffect(() => {
    if (autoOpenInvoiceNumber) {
      fetchInvoice(autoOpenInvoiceNumber)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenInvoiceNumber])

  return (
    <div className="tab-page">
      <section>
        <h2>Purchase History</h2>

        {error && <p className="error-message">{error}</p>}

        {purchases.length === 0 ? (
          <p>No purchases yet.</p>
        ) : (
          purchases.map((p) => (
            <div
              key={p.purchaseMasterId}
              className="purchase-card purchase-card--clickable"
              onClick={() => fetchInvoice(p.invoiceNumber)}
            >
              <div className="purchase-header">
                <strong>{p.invoiceNumber}</strong>
                <span>{new Date(p.purchaseDate).toLocaleDateString()}</span>
                <span>₹{p.totalAmount}</span>
              </div>
              <ul className="item-list">
                {p.items.map((item, idx) => (
                  <li key={idx}>
                    {item.productName} × {item.quantity} — ₹{item.salePrice}
                  </li>
                ))}
              </ul>
              {loadingInvoice === p.invoiceNumber && (
                <p className="invoice-loading-text">Loading invoice...</p>
              )}
            </div>
          ))
        )}
      </section>

      {selectedInvoice && (
        <InvoiceBill
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          showActions={false}
        />
      )}
    </div>
  )
}

export default InvoicePage