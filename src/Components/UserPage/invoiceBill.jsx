import React from 'react';
import Barcode from 'react-barcode';

function InvoiceBill({ invoice, onClose }) {
  const { invoiceNumber, customer, cart, totalAmount, discount, taxAmount, payableAmount, payments, completedAt } = invoice;

  const [logoFailed, setLogoFailed] = React.useState(false);
const maskPhoneNumber = (phone) => {
    if (!phone) return '-';
    const digitsOnly = String(phone).replace(/\D/g, '');
    if (digitsOnly.length <= 4) return digitsOnly;
    const lastFour = digitsOnly.slice(-4);
    const maskedPart = '*'.repeat(digitsOnly.length - 4);
    return `${maskedPart}${lastFour}`;
  };
  // ── Group items by their CGST rate ──
  const rateGroups = {};
  cart.forEach((item) => {
    const rate = Number(item.cgst) || 0;
    if (!rateGroups[rate]) rateGroups[rate] = [];
    rateGroups[rate].push(item);
  });
  const sortedRates = Object.keys(rateGroups).map(Number).sort((a, b) => a - b);
  const groupLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

  const withItemMath = (item) => {
    const cgst = Number(item.cgst) || 0;
    const itemTotal = item.price * item.quantity;
    const itemTaxable = itemTotal / (100 + 2 * cgst) * 100;
    const itemTax = itemTaxable * (cgst / 100) * 2;
    const hsn = item.hsn ?? item.hsnCode ?? item.HSNCode ?? '-';
    const mrp = Number(item.mrp ?? item.MRP ?? item.Mrp ?? item.price) || 0;
    const itemDiscount = Math.max(mrp - item.price, 0) * item.quantity;
    return { ...item, cgst, itemTotal, itemTaxable, itemTax, hsn, mrp, itemDiscount };
  };

  const taxDetailRows = sortedRates.map((rate, idx) => {
    const items = rateGroups[rate].map(withItemMath);
    const taxableValue = items.reduce((sum, i) => sum + i.itemTaxable, 0);
    const cgstAmt = taxableValue * (rate / 100);
    const sgstAmt = taxableValue * (rate / 100);
    return {
      label: groupLabels[idx] ?? `${idx + 1}`,
      rate,
      taxableValue,
      cgstAmt,
      sgstAmt,
      cessAmt: 0,
      totalAmt: taxableValue + cgstAmt + sgstAmt
    };
  });

  const taxDetailTotals = taxDetailRows.reduce(
    (acc, row) => ({
      taxableValue: acc.taxableValue + row.taxableValue,
      cgstAmt: acc.cgstAmt + row.cgstAmt,
      sgstAmt: acc.sgstAmt + row.sgstAmt,
      cessAmt: acc.cessAmt + row.cessAmt,
      totalAmt: acc.totalAmt + row.totalAmt
    }),
    { taxableValue: 0, cgstAmt: 0, sgstAmt: 0, cessAmt: 0, totalAmt: 0 }
  );

  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalReceived = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const changeDue = Math.max(totalReceived - payableAmount, 0);

  const computedDiscount = cart.reduce(
    (sum, item) => sum + withItemMath(item).itemDiscount,
    0
  );
  const discountValue = Math.max(computedDiscount, Number(discount) || 0);
  const hasDiscount = discountValue > 0;

  

  return (
    <div style={styles.overlay}>
      <div style={styles.modalWindow}>
        <button style={styles.closeButton} onClick={onClose} aria-label="Close">
          ×
        </button>

        <div id="invoice-print-area" style={styles.printArea}>

          {/* Header Section */}
          <div style={styles.header}>
            <img
              src="/gripstyle-logo.png"
              alt="Grip Style Logo"
              style={styles.logo}
              onError={(e) => {
                console.error(
                  `Invoice logo failed to load from resolved URL: ${e.currentTarget.src}. ` +
                  'Check that the asset file still exists at public/gripstyle-logo.png, ' +
                  'that it was committed/deployed, and that its filename casing matches ' +
                  'exactly (case-sensitive on Linux hosts).'
                );
                setLogoFailed(true);
              }}
            />
            {logoFailed && (
              <p style={{ ...styles.address, color: '#dc3545', fontSize: '0.75rem', margin: '4px 0 0 0' }}>
                (Logo image failed to load — check console for details)
              </p>
            )}
            <h1 style={styles.companyName}>Mohua's Fashion Industries Pvt. Ltd</h1>
            <p style={styles.address}>
              Registered Office: 55/6 S.B.N.G LANE, BARANAGAR, KOLKATA - 700036
            </p>
          </div>

          <div style={styles.legalBlock}>
            <p style={styles.legalRow}>Place Of Supply: Baranagar, Kolkata, West Bengal - 700036</p>
            <p style={styles.legalRow}>GSTIN NO: 19AAUCM4631Q1ZH</p>
            <p style={styles.legalRow}>CIN: U47711WB2026PTC286757</p>
          </div>

          <h2 style={styles.taxInvoiceTitle}>TAX INVOICE</h2>

          <div style={styles.metaRow}>
            <span>INVOICE NO.: {invoiceNumber}</span>
          </div>

                    <div style={styles.customerBlock}>
            <p style={styles.customerRow}>CUSTOMER ID: {customer?.id ?? 'WALK-IN'}</p>
            <p style={styles.customerRow}>CUSTOMER NAME: {customer?.customerName ?? customer?.name ?? 'WALK-IN'}</p>
            <p style={styles.customerRow}>MOBILE NO: {maskPhoneNumber(customer?.mobileNumber ?? customer?.phoneNumber)}</p>
          </div>

          {/* Main Items Table */}
          <table style={styles.table}>
            <colgroup>
              <col style={{ width: '35%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={styles.th}>Item</th>
                <th style={styles.th}>QTY/Unit</th>
                <th style={{...styles.th, textAlign: 'right'}}>Price</th>
                <th style={{...styles.th, textAlign: 'right'}}>Disc.Amt</th>
                <th style={{...styles.th, textAlign: 'right'}}>Net.Amt</th>
              </tr>
              <tr>
                <th style={styles.thSub}>Description</th>
                <th style={styles.thSub}>HSN-SAC</th>
                <th style={styles.thSub}></th>
                <th style={{...styles.thSub, textAlign: 'right'}} colSpan={2}>Taxable Amount</th>
              </tr>
            </thead>
            <tbody>
              {sortedRates.map((rate, groupIdx) => (
                <React.Fragment key={rate}>
                  <tr>
                    <td colSpan={5} style={styles.groupHeaderCell}>
                      {groupLabels[groupIdx] ?? groupIdx + 1}) CGST@{rate}% SGST@{rate}%
                    </td>
                  </tr>
                  {rateGroups[rate].map(withItemMath).map((item) => (
                    <React.Fragment key={item.id}>
                      <tr>
                        <td style={styles.td}>{item.barcode ?? item.id}</td>
                        <td style={styles.td}>{item.quantity} PC</td>
                        <td style={{...styles.td, textAlign: 'right'}}>₹{item.mrp.toFixed(2)}</td>
                        <td style={{...styles.td, textAlign: 'right'}}>₹{item.itemDiscount.toFixed(2)}</td>
                        <td style={{...styles.td, textAlign: 'right'}}>₹{item.itemTotal.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td style={styles.tdSub}>{item.name}</td>
                        <td style={styles.tdSub}>{item.hsn}</td>
                        <td style={styles.tdSub}></td>
                        <td style={{...styles.tdSub, textAlign: 'right'}} colSpan={2}>₹{item.itemTaxable.toFixed(2)}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          <div style={styles.totalsBlock}>
            <div style={styles.summaryRow}><span>Gross Total:</span><span>₹{totalAmount.toFixed(2)}</span></div>
            <div style={styles.summaryTotal}><span>Total Invoice Amount:</span><span>₹{payableAmount.toFixed(2)}</span></div>
          </div>

          <h3 style={styles.subTitle}>Tax Details</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>GST IND</th>
                <th style={{...styles.th, textAlign: 'right'}}>Taxable Value</th>
                <th style={{...styles.th, textAlign: 'right'}}>CGST</th>
                <th style={{...styles.th, textAlign: 'right'}}>SGST</th>
                <th style={{...styles.th, textAlign: 'right'}}>CESS</th>
                <th style={{...styles.th, textAlign: 'right'}}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {taxDetailRows.map((row) => (
                <tr key={row.label}>
                  <td style={styles.td}>{row.label})</td>
                  <td style={{...styles.td, textAlign: 'right'}}>₹{row.taxableValue.toFixed(2)}</td>
                  <td style={{...styles.td, textAlign: 'right'}}>₹{row.cgstAmt.toFixed(2)}</td>
                  <td style={{...styles.td, textAlign: 'right'}}>₹{row.sgstAmt.toFixed(2)}</td>
                  <td style={{...styles.td, textAlign: 'right'}}>₹{row.cessAmt.toFixed(2)}</td>
                  <td style={{...styles.td, textAlign: 'right'}}>₹{row.totalAmt.toFixed(2)}</td>
                </tr>
              ))}
              <tr>
                <td style={styles.tdTotal}>Total</td>
                <td style={{...styles.tdTotal, textAlign: 'right'}}>₹{taxDetailTotals.taxableValue.toFixed(2)}</td>
                <td style={{...styles.tdTotal, textAlign: 'right'}}>₹{taxDetailTotals.cgstAmt.toFixed(2)}</td>
                <td style={{...styles.tdTotal, textAlign: 'right'}}>₹{taxDetailTotals.sgstAmt.toFixed(2)}</td>
                <td style={{...styles.tdTotal, textAlign: 'right'}}>₹{taxDetailTotals.cessAmt.toFixed(2)}</td>
                <td style={{...styles.tdTotal, textAlign: 'right'}}>₹{taxDetailTotals.totalAmt.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div>
            <h3 style={styles.subTitle}>Tender Detail</h3>
            <div style={styles.paymentsWrap}>
              {hasDiscount && (
                <div style={styles.savingsStampOverlay}>
                  <div style={styles.savingsStamp}>
                    <div style={styles.savingsStampStars}>★ ★ ★</div>
                    <div style={styles.savingsStampLabel}>YOU SAVED</div>
                    <div style={styles.savingsStampAmount}>₹{discountValue.toFixed(2)}</div>
                    <div style={styles.savingsStampStars}>★ ★ ★</div>
                  </div>
                </div>
              )}
              <div style={styles.paymentsBlock}>
                {(payments ?? []).map((p, i) => (
                  <div key={i} style={styles.tenderRow}>
                    <span>{p.method}</span>
                    <span></span>
                    <span style={styles.tenderRowAmount}>₹{p.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div style={styles.tenderRow}>
                  <span>TOTAL RECEIVED AMOUNT</span>
                  <span></span>
                  <span style={styles.tenderRowAmount}>₹{totalReceived.toFixed(2)}</span>
                </div>
                <div style={styles.tenderRow}>
                  <span>CHANGE DUE</span>
                  <span></span>
                  <span style={styles.tenderRowAmount}>₹{changeDue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.countsRow}>
            <span>NO OF ITEMS: {cart.length}</span>
            <span>TOTAL QTY: {totalQty}</span>
          </div>

          <ul style={styles.termsList}>
            <li>All offers are subject to applicable T&C.</li>
            <li>Please retain the product label and invoice to be eligible to return/exchange the product within 7 days from the date of invoice.</li>
            <li>All products which need to be exchanged should be in their original condition.</li>
            <li>If you do not have a product label and an invoice, return/exchange will not be accepted.</li>
          </ul>

          <div style={styles.barcodeContainer}>
            <Barcode
              value={invoiceNumber}
              width={1.2}
              height={40}
              fontSize={11}
              displayValue={true}
              margin={0}
            />
          </div>
        </div>

        
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'center',
    alignItems: 'center', zIndex: 9999
  },
  modalWindow: {
    backgroundColor: '#fff', width: '100%', maxWidth: '600px',
    maxHeight: '90vh', overflowY: 'auto', padding: '30px',
    borderRadius: '8px', boxShadow: '0 8px 35px rgba(0,0,0,0.2)',
    position: 'relative'
  },
  closeButton: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    fontSize: '20px',
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  header: {display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center", marginBottom: '15px' },
  logo: { width: '250px', objectFit: 'contain', marginBottom: '5px' },
  companyName: { margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 'bold' },
  address: { margin: 0, fontSize: '0.85rem', color: '#333' },
  legalBlock: { textAlign: 'center', padding: '10px 0', marginBottom: '10px' },
  legalRow: { margin: '2px 0', fontSize: '0.8rem', color: '#333' },
  taxInvoiceTitle: { textAlign: 'center', margin: '0 0 15px 0', fontSize: '1.1rem', fontWeight: 'bold' },
  metaRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '10px' },
  customerBlock: { borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' },
  customerRow: { margin: '2px 0', fontSize: '0.85rem' },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '0.85rem' },
  th: { borderBottom: '1px solid #000', padding: '6px 2px', textAlign: 'left', fontWeight: 'bold' },
  thSub: { borderBottom: '1px solid #000', padding: '2px 2px 6px 2px', color: '#555', textAlign: 'left', fontWeight: 'normal', fontSize: '0.75rem' },
  td: { padding: '6px 2px 2px 2px', textAlign: 'left' },
  tdSub: { padding: '0 2px 8px 2px', borderBottom: '1px dashed #ccc', color: '#333', textAlign: 'left', fontSize: '0.8rem' },
  tdTotal: { padding: '8px 2px', borderTop: '1px solid #000', borderBottom: '1px solid #000', fontWeight: 'bold' },
  groupHeaderCell: { padding: '10px 2px 4px 2px', fontWeight: 'bold' },
  totalsBlock: { marginBottom: '15px' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' },
  summaryTotal: { display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem', borderTop: '1px dashed #000', paddingTop: '8px', marginTop: '8px', marginBottom: '8px' },
  subTitle: { fontSize: '0.95rem', margin: '0 0 8px 0', fontWeight: 'bold' },
  paymentsBlock: { marginTop: '10px', marginBottom: '15px', position: 'relative', zIndex: 1 },
  tenderRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 104px 1fr',
    fontSize: '0.9rem',
    marginBottom: '4px'
  },
  tenderRowAmount: { textAlign: 'right' },
  paymentsWrap: { position: 'relative' },
  savingsStampOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
    pointerEvents: 'none'
  },
  countsRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 'bold', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '8px 0', marginBottom: '15px' },
  termsList: { fontSize: '0.75rem', color: '#333', paddingLeft: '15px', marginBottom: '15px', lineHeight: '1.4' },
  barcodeContainer: { display: 'flex', justifyContent: 'center', marginTop: '10px' },
  printArea: { padding: '8px 28px 24px 28px' },
  savingsStamp: {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    border: '2px double #d9232d',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transform: 'rotate(-15deg)',
    color: '#d9232d',
    textAlign: 'center',
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    opacity: 0.85
  },
  savingsStampStars: {
    fontSize: '0.45rem',
    letterSpacing: '1.5px',
    lineHeight: 1
  },
  savingsStampLabel: {
    fontSize: '0.58rem',
    fontWeight: 'bold',
    letterSpacing: '0.8px',
    margin: '3px 0'
  },
  savingsStampAmount: {
    fontSize: '0.82rem',
    fontWeight: 900,
    letterSpacing: '0.3px'
  },
  actions: { display: 'flex', gap: '12px', marginTop: '20px' },
  printButton: { flex: 1, padding: '10px', border: '1px solid #000', backgroundColor: '#fff', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px' }
};

export default InvoiceBill;