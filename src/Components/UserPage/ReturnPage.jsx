import React, { useState, useEffect } from 'react'
import ReturnBill from './returnbill' // adjust path to your actual ReturnBill location

const API_BASE_URL = 'https://dummypossetup.runasp.net'

function ReturnsPage({ returns, autoOpenReturnInvoiceNumber }) {
  const [selectedReturn, setSelectedReturn] = useState(null)
  const [loadingReturn, setLoadingReturn] = useState(null) // returnInvoiceNumber currently loading
  const [error, setError] = useState('')

  const fetchReturn = async (returnInvoiceNumber) => {
    setLoadingReturn(returnInvoiceNumber)
    setError('')

    try {
      // NOTE: confirm the exact path/casing with the backend — mirrored here
      // off InvoicePage's lowercase "getTransactionDetails" convention.
      // ReturnSection.jsx (the counter-side return flow) hits this as
      // "getReturnDetail?returnInvoiceNumber=..." on a different API base,
      // so this endpoint may need to be pointed at that same host instead.
      const response = await fetch(
        `${API_BASE_URL}/getReturnDetail?returnInvoiceNumber=${encodeURIComponent(returnInvoiceNumber)}`
      )

      if (!response.ok) {
        throw new Error('Unable to load return')
      }

      const data = await response.json()

      // previousCustomerBalance may not always be sent directly — derive it
      // the same way ReturnSection.handleViewReturn does: wallet credits
      // only add, so previous = updated - refunded.
      const previousCustomerBalance =
        data.previousCustomerBalance ??
        (data.updatedCustomerBalance != null
          ? Number(data.updatedCustomerBalance) - Number(data.totalAmount)
          : null)

      const returnData = {
        returnInvoiceNumber: data.returnInvoiceNumber,
        originalInvoiceNumber: data.originalInvoiceNumber ?? data.invoiceNumber,
        customerName: data.customerName,
        customerMobile: data.customerMobile,
        items: (data.items ?? []).map((ri) => ({
          productId: ri.productId,
          productName: ri.productName,
          barcode: ri.barcode,
          quantity: ri.quantity,
          salePrice: ri.salePrice,
          cgst: ri.cgst,
          sgst: ri.sgst,
          lineTotal: ri.lineTotal ?? ri.afterTaxation ?? (ri.salePrice ?? 0) * (ri.quantity ?? 0)
        })),
        totalAmount: data.totalAmount,
        previousCustomerBalance,
        updatedCustomerBalance: data.updatedCustomerBalance,
        completedAt: data.createdDate ?? data.completedAt
      }

      setSelectedReturn(returnData)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unable to load return.')
    } finally {
      setLoadingReturn(null)
    }
  }

  // Auto-open the most recent return as soon as we know its invoice number
  // (mirrors InvoicePage's autoOpenInvoiceNumber behavior).
  useEffect(() => {
    if (autoOpenReturnInvoiceNumber) {
      fetchReturn(autoOpenReturnInvoiceNumber)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenReturnInvoiceNumber])

  return (
    <div className="tab-page">
      <section>
        <h2>Returns</h2>

        {error && <p className="error-message">{error}</p>}

        {returns.length === 0 ? (
          <p>No returns yet.</p>
        ) : (
          returns.map((r) => (
            <div
              key={r.returnMasterId}
              className="purchase-card purchase-card--clickable"
              onClick={() => fetchReturn(r.returnInvoiceNumber)}
            >
              <div className="purchase-header">
                <strong>{r.returnInvoiceNumber}</strong>
                <span>₹{r.totalAmount}</span>
              </div>
              <ul className="item-list">
                {r.items.map((item, idx) => (
                  <li key={idx}>
                    {item.productName} × {item.quantity} — ₹{item.salePrice}
                  </li>
                ))}
              </ul>
              {loadingReturn === r.returnInvoiceNumber && (
                <p className="invoice-loading-text">Loading return...</p>
              )}
            </div>
          ))
        )}
      </section>

      {selectedReturn && (
        <ReturnBill returnData={selectedReturn} onClose={() => setSelectedReturn(null)} />
      )}
    </div>
  )
}

export default ReturnsPage