import React, { useRef, useState } from 'react';
import Barcode from 'react-barcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

function ReturnBill({ returnData, onClose }) {
  const {
    returnInvoiceNumber,
    originalInvoiceNumber,
    customerName,
    customerMobile,
    items = [],
    totalAmount,
    previousCustomerBalance,
    updatedCustomerBalance,
    completedAt,
  } = returnData;

  const [logoFailed, setLogoFailed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const billRef = useRef(null);
 

  // ---------------------------------------------------------
  // TOTAL QUANTITY
  // ---------------------------------------------------------

  const totalQty = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  // ---------------------------------------------------------
  // WALLET BALANCE
  // ---------------------------------------------------------

  const resolvedPreviousBalance =
    previousCustomerBalance != null
      ? Number(previousCustomerBalance)
      : Number(updatedCustomerBalance ?? 0) -
        Number(totalAmount ?? 0);

  const resolvedUpdatedBalance =
    updatedCustomerBalance != null
      ? Number(updatedCustomerBalance)
      : resolvedPreviousBalance + Number(totalAmount ?? 0);

  // ---------------------------------------------------------
  // TAX GROUPING
  // Same logic as InvoiceBill
  // ---------------------------------------------------------

  const rateGroups = {};

  items.forEach((item) => {
    const rate = Number(item.cgst) || 0;

    if (!rateGroups[rate]) {
      rateGroups[rate] = [];
    }

    rateGroups[rate].push(item);
  });

  const sortedRates = Object.keys(rateGroups)
    .map(Number)
    .sort((a, b) => a - b);

  const groupLabels = ['A', 'B', 'C', 'D', 'E', 'F'];

  // ---------------------------------------------------------
  // ITEM TAX CALCULATION
  // ---------------------------------------------------------

  const withItemMath = (item) => {
    const cgst = Number(item.cgst) || 0;

    const quantity =
      Number(item.quantity) || 0;

    const salePrice =
      Number(item.salePrice) || 0;

    const lineTotal =
      Number(item.lineTotal) ||
      salePrice * quantity;

    const itemTaxable =
      lineTotal /
      (100 + 2 * cgst) *
      100;

    const itemTax =
      itemTaxable *
      (cgst / 100) *
      2;

    const hsn =
      item.hsn ??
      item.hsnCode ??
      item.HSNCode ??
      '-';

    return {
      ...item,
      cgst,
      quantity,
      salePrice,
      lineTotal,
      itemTaxable,
      itemTax,
      hsn,
    };
  };

  // ---------------------------------------------------------
  // TAX DETAIL ROWS
  // ---------------------------------------------------------

  const taxDetailRows = sortedRates.map(
    (rate, idx) => {
      const grouped =
        rateGroups[rate].map(withItemMath);

      const taxableValue =
        grouped.reduce(
          (sum, item) =>
            sum + item.itemTaxable,
          0
        );

      const cgstAmt =
        taxableValue *
        (rate / 100);

      const sgstAmt =
        taxableValue *
        (rate / 100);

      return {
        label:
          groupLabels[idx] ??
          `${idx + 1}`,
        rate,
        taxableValue,
        cgstAmt,
        sgstAmt,
        cessAmt: 0,
        totalAmt:
          taxableValue +
          cgstAmt +
          sgstAmt,
      };
    }
  );

  // ---------------------------------------------------------
  // TAX TOTALS
  // ---------------------------------------------------------

  const taxDetailTotals =
    taxDetailRows.reduce(
      (acc, row) => ({
        taxableValue:
          acc.taxableValue +
          row.taxableValue,

        cgstAmt:
          acc.cgstAmt +
          row.cgstAmt,

        sgstAmt:
          acc.sgstAmt +
          row.sgstAmt,

        cessAmt:
          acc.cessAmt +
          row.cessAmt,

        totalAmt:
          acc.totalAmt +
          row.totalAmt,
      }),
      {
        taxableValue: 0,
        cgstAmt: 0,
        sgstAmt: 0,
        cessAmt: 0,
        totalAmt: 0,
      }
    );

  // ---------------------------------------------------------
  // DOWNLOAD RETURN BILL AS PDF
  // The PDF uses the same width/height ratio as the visible
  // return bill, so it is not stretched onto an A4 page.
  // ---------------------------------------------------------

  const downloadBillPDF = async () => {
    if (!billRef.current || isDownloading) return;

    try {
      setIsDownloading(true);

      // Allow the button/loading state to render before capture.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const element = billRef.current;

      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: -window.scrollY,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');

      // Convert the rendered CSS pixel dimensions to millimetres.
      // 96 CSS px = 1 inch = 25.4 mm.
      const pxToMm = 25.4 / 96;
      const pdfWidth = element.scrollWidth * pxToMm;
      const pdfHeight = element.scrollHeight * pxToMm;

      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
        compress: true,
      });

      pdf.addImage(
        imgData,
        'PNG',
        0,
        0,
        pdfWidth,
        pdfHeight,
        undefined,
        'FAST'
      );

      const safeInvoiceNumber = String(
        returnInvoiceNumber || 'Return-Bill'
      ).replace(/[^a-zA-Z0-9_-]/g, '_');

      pdf.save(`Return-Invoice-${safeInvoiceNumber}.pdf`);
    } catch (error) {
      console.error('Failed to generate return bill PDF:', error);
      window.alert('Could not generate the PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Mask customer phone number, showing only the last 4 digits.
  const maskPhoneNumber = (phone) => {
    if (phone === null || phone === undefined) return '';

    const value = String(phone).trim();
    const digits = value.replace(/\\D/g, '');

    if (digits.length <= 4) return value;

    return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div style={styles.overlay}>

      <div style={styles.modalWindow}>

        <button
          style={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>



        <div
          id="return-print-area"
          ref={billRef}
          style={styles.printArea}
        >

          {/* =================================================
              HEADER
          ================================================= */}

          <div style={styles.header}>

            <img
              src="/gripstyle-logo.png"
              alt="Grip Style Logo"
              style={styles.logo}
              onError={(e) => {
                console.error(
                  `Return bill logo failed to load from ${e.currentTarget.src}.`
                );

                setLogoFailed(true);
              }}
            />

            {logoFailed && (
              <p
                style={{
                  ...styles.address,
                  color: '#dc3545',
                  fontSize: '0.7rem',
                  margin: '4px 0 0 0',
                }}
              >
                Logo image failed to load.
              </p>
            )}

            <h1 style={styles.companyName}>
              Mohua's Fashion Industries Pvt. Ltd
            </h1>

            <p style={styles.address}>
              Registered Office: 55/6 S.B.N.G LANE,
              BARANAGAR, KOLKATA - 700036
            </p>

          </div>


          {/* =================================================
              LEGAL DETAILS
          ================================================= */}

          <div style={styles.legalBlock}>

            <p style={styles.legalRow}>
              Place Of Supply: Baranagar, Kolkata,
              West Bengal - 700036
            </p>

            <p style={styles.legalRow}>
              GSTIN NO: 19AAUCM4631Q1ZH
            </p>

            <p style={styles.legalRow}>
              CIN: U47711WB2026PTC286757
            </p>

          </div>


          {/* =================================================
              RETURN TITLE
          ================================================= */}

          <h2 style={styles.returnInvoiceTitle}>
            RETURN INVOICE
          </h2>


          {/* =================================================
              RETURN META
          ================================================= */}

          <div style={styles.metaRow}>
            <span>
              RETURN INVOICE NO.:{' '}
              {returnInvoiceNumber}
            </span>
          </div>

          {originalInvoiceNumber && (
            <div style={styles.metaAgainstRow}>
              <span>
                AGAINST INVOICE:{' '}
                {originalInvoiceNumber}
              </span>
            </div>
          )}

          {completedAt && (
            <div style={styles.metaSubRow}>
              <span>
                {new Date(
                  completedAt
                ).toLocaleString(
                  'en-GB',
                  {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )}
              </span>
            </div>
          )}


          {/* =================================================
              CUSTOMER
          ================================================= */}

          <div style={styles.customerBlock}>

            <p style={styles.customerRow}>
              CUSTOMER NAME:{' '}
              {customerName ?? 'WALK-IN'}
            </p>

            <p style={styles.customerRow}>
  MOBILE NO:{' '}
  {maskPhoneNumber(customerMobile)}
</p>

          </div>


          {/* =================================================
              RETURNED ITEMS
              Same scale/structure as InvoiceBill
          ================================================= */}

          <table style={styles.table}>

            <colgroup>
              <col style={{ width: '34%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>

            <thead>

              <tr>
                <th style={styles.th}>
                  Item
                </th>

                <th style={styles.th}>
                  QTY
                </th>

                <th
                  style={{
                    ...styles.th,
                    textAlign: 'right',
                  }}
                >
                  Price
                </th>

                <th
                  style={{
                    ...styles.th,
                    textAlign: 'right',
                  }}
                >
                  Taxable
                </th>

                <th
                  style={{
                    ...styles.th,
                    textAlign: 'right',
                  }}
                >
                  Net
                </th>
              </tr>

              <tr>

                <th style={styles.thSub}>
                  Description
                </th>

                <th style={styles.thSub}>
                  HSN
                </th>

                <th style={styles.thSub}>
                </th>

                <th style={styles.thSub}>
                </th>

                <th style={styles.thSub}>
                </th>

              </tr>

            </thead>

            <tbody>

              {sortedRates.map(
                (rate, groupIdx) => (

                  <React.Fragment
                    key={rate}
                  >

                    {/* GST GROUP */}

                    <tr>

                      <td
                        colSpan={5}
                        style={
                          styles.groupHeaderCell
                        }
                      >
                        {groupLabels[
                          groupIdx
                        ] ??
                          groupIdx + 1}
                        ) CGST@
                        {rate}% SGST@
                        {rate}%
                      </td>

                    </tr>


                    {/* ITEMS */}

                    {rateGroups[rate]
                      .map(withItemMath)
                      .map((item) => (

                        <React.Fragment
                          key={
                            item.id ??
                            item.productId
                          }
                        >

                          <tr>

                            <td
                              style={
                                styles.td
                              }
                            >
                              {item.barcode ??
                                item.productId ??
                                item.id}
                            </td>

                            <td
                              style={
                                styles.td
                              }
                            >
                              {item.quantity}
                            </td>

                            <td
                              style={{
                                ...styles.td,
                                textAlign:
                                  'right',
                              }}
                            >
                              ₹
                              {item.salePrice.toFixed(
                                2
                              )}
                            </td>

                            <td
                              style={{
                                ...styles.td,
                                textAlign:
                                  'right',
                              }}
                            >
                              ₹
                              {item.itemTaxable.toFixed(
                                2
                              )}
                            </td>

                            <td
                              style={{
                                ...styles.td,
                                textAlign:
                                  'right',
                              }}
                            >
                              ₹
                              {item.lineTotal.toFixed(
                                2
                              )}
                            </td>

                          </tr>


                          {/* DESCRIPTION */}

                          <tr>

                            <td
                              style={
                                styles.tdSub
                              }
                            >
                              {item.productName ??
                                item.name ??
                                '-'}
                            </td>

                            <td
                              style={
                                styles.tdSub
                              }
                            >
                              {item.hsn}
                            </td>

                            <td
                              style={
                                styles.tdSub
                              }
                            >
                            </td>

                            <td
                              style={{
                                ...styles.tdSub,
                                textAlign:
                                  'right',
                              }}
                            >
                            </td>

                            <td
                              style={
                                styles.tdSub
                              }
                            >
                            </td>

                          </tr>

                        </React.Fragment>

                      ))}

                  </React.Fragment>
                )
              )}

            </tbody>

          </table>


          {/* =================================================
              TOTALS
          ================================================= */}

          <div style={styles.totalsBlock}>

            <div
              style={
                styles.summaryRow
              }
            >
              <span>
                Gross Return:
              </span>

              <span>
                ₹
                {Number(
                  totalAmount ?? 0
                ).toFixed(2)}
              </span>
            </div>

            <div
              style={
                styles.summaryTotal
              }
            >
              <span>
                Total Return Amount:
              </span>

              <span>
                ₹
                {Number(
                  totalAmount ?? 0
                ).toFixed(2)}
              </span>
            </div>

          </div>


          {/* =================================================
              TAX DETAILS

              IMPORTANT:
              Same scroll container and
              minWidth as InvoiceBill.
          ================================================= */}

          <h3 style={styles.subTitle}>Tax Details</h3>

<table
  style={{
    ...styles.table,
    width: '100%',
    tableLayout: 'fixed',
    marginBottom: '12px'
  }}
>
  <colgroup>
    <col style={{ width: '13%' }} />
    <col style={{ width: '21%' }} />
    <col style={{ width: '16%' }} />
    <col style={{ width: '16%' }} />
    <col style={{ width: '14%' }} />
    <col style={{ width: '20%' }} />
  </colgroup>

  <thead>
    <tr>
      <th style={styles.taxTh}>GST IND</th>
      <th style={styles.taxThRight}>Taxable Value</th>
      <th style={styles.taxThRight}>CGST</th>
      <th style={styles.taxThRight}>SGST</th>
      <th style={styles.taxThRight}>CESS</th>
      <th style={styles.taxThRight}>Total Amount</th>
    </tr>
  </thead>

  <tbody>
    {taxDetailRows.map((row) => (
      <tr key={row.label}>
        <td style={styles.taxTd}>{row.label})</td>

        <td style={styles.taxTdRight}>
          ₹{row.taxableValue.toFixed(2)}
        </td>

        <td style={styles.taxTdRight}>
          ₹{row.cgstAmt.toFixed(2)}
        </td>

        <td style={styles.taxTdRight}>
          ₹{row.sgstAmt.toFixed(2)}
        </td>

        <td style={styles.taxTdRight}>
          ₹{row.cessAmt.toFixed(2)}
        </td>

        <td style={styles.taxTdRight}>
          ₹{row.totalAmt.toFixed(2)}
        </td>
      </tr>
    ))}

    <tr>
      <td style={styles.taxTdTotal}>Total</td>

      <td style={styles.taxTdTotalRight}>
        ₹{taxDetailTotals.taxableValue.toFixed(2)}
      </td>

      <td style={styles.taxTdTotalRight}>
        ₹{taxDetailTotals.cgstAmt.toFixed(2)}
      </td>

      <td style={styles.taxTdTotalRight}>
        ₹{taxDetailTotals.sgstAmt.toFixed(2)}
      </td>

      <td style={styles.taxTdTotalRight}>
        ₹{taxDetailTotals.cessAmt.toFixed(2)}
      </td>

      <td style={styles.taxTdTotalRight}>
        ₹{taxDetailTotals.totalAmt.toFixed(2)}
      </td>
    </tr>
  </tbody>
</table>


          {/* =================================================
              WALLET UPDATE
          ================================================= */}

          <h3 style={styles.subTitle}>
            Wallet Update
          </h3>

          <div
            style={
              styles.walletWrap
            }
          >

            <div
              style={
                styles.walletCreditedStampOverlay
              }
            >

              <div
                style={
                  styles.walletCreditedStamp
                }
              >

                <div
                  style={
                    styles.walletStampStars
                  }
                >
                  ★ ★ ★
                </div>

                <div
                  style={
                    styles.walletStampLabel
                  }
                >
                  RETURNED
                </div>

                <div
                  style={
                    styles.walletStampStars
                  }
                >
                  ★ ★ ★
                </div>

              </div>

            </div>


            <div
              style={
                styles.walletBlock
              }
            >

              <div
                style={
                  styles.walletRow
                }
              >

                <span>
                  PREVIOUS WALLET
                  BALANCE
                </span>

                <span></span>

                <span
                  style={
                    styles.walletRowAmount
                  }
                >
                  ₹
                  {resolvedPreviousBalance.toFixed(
                    2
                  )}
                </span>

              </div>


              <div
                style={
                  styles.walletRow
                }
              >

                <span>
                  AMOUNT CREDITED
                  (THIS RETURN)
                </span>

                <span></span>

                <span
                  style={
                    styles.walletRowAmount
                  }
                >
                  ₹
                  {Number(
                    totalAmount ?? 0
                  ).toFixed(2)}
                </span>

              </div>


              <div
                style={
                  styles.walletRowTotal
                }
              >

                <span>
                  UPDATED WALLET
                  BALANCE
                </span>

                <span></span>

                <span
                  style={
                    styles.walletRowAmount
                  }
                >
                  ₹
                  {resolvedUpdatedBalance.toFixed(
                    2
                  )}
                </span>

              </div>

            </div>

          </div>


          {/* =================================================
              ITEM COUNTS
          ================================================= */}

          <div
            style={
              styles.countsRow
            }
          >

            <span>
              NO OF ITEMS:{' '}
              {items.length}
            </span>

            <span>
              TOTAL QTY:{' '}
              {totalQty}
            </span>

          </div>


          {/* =================================================
              TERMS
          ================================================= */}

          <ul
            style={
              styles.termsList
            }
          >

            <li>
              The refunded amount has
              been credited to the
              customer's wallet balance
              and can be redeemed
              against a future purchase.
            </li>

            <li>
              Please retain this return
              receipt for your records.
            </li>

          </ul>


          {/* =================================================
              BARCODE
          ================================================= */}

          <div
            style={
              styles.barcodeContainer
            }
          >

            <Barcode
              value={
                returnInvoiceNumber
              }
              width={1.2}
              height={40}
              fontSize={11}
              displayValue={true}
              margin={0}
            />

          </div>

        </div>

        <button
          type="button"
          style={styles.downloadButton}
          onClick={downloadBillPDF}
          disabled={isDownloading}
        >
          {isDownloading ? 'Generating PDF...' : 'Download PDF'}
        </button>

      </div>

    </div>
  );
}


// ============================================================
// STYLES
// These now intentionally follow InvoiceBill's dimensions
// and typography.
// ============================================================

const styles = {
taxTh: {
  borderBottom: '1px solid #000',
  padding: '5px 1px',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: '0.72rem',
  whiteSpace: 'normal',
  lineHeight: '1.1',
},

taxThRight: {
  borderBottom: '1px solid #000',
  padding: '5px 1px',
  textAlign: 'right',
  fontWeight: 'bold',
  fontSize: '0.72rem',
  whiteSpace: 'normal',
  lineHeight: '1.1',
},

taxTd: {
  padding: '5px 1px',
  textAlign: 'left',
  fontSize: '0.72rem',
  whiteSpace: 'nowrap',
},

taxTdRight: {
  padding: '5px 1px',
  textAlign: 'right',
  fontSize: '0.72rem',
  whiteSpace: 'nowrap',
},

taxTdTotal: {
  borderTop: '1px solid #000',
  borderBottom: '1px solid #000',
  padding: '5px 1px',
  textAlign: 'left',
  fontSize: '0.72rem',
  fontWeight: 'bold',
},

taxTdTotalRight: {
  borderTop: '1px solid #000',
  borderBottom: '1px solid #000',
  padding: '5px 1px',
  textAlign: 'right',
  fontSize: '0.72rem',
  fontWeight: 'bold',
},
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor:
      'rgba(0,0,0,0.65)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: '12px',
    boxSizing: 'border-box',
  },

  modalWindow: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '90vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '20px',
    borderRadius: '8px',
    boxShadow:
      '0 8px 35px rgba(0,0,0,0.2)',
    boxSizing: 'border-box',
    position: 'relative',
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
    zIndex: 10,
  },

  downloadButton: {
    display: 'block',
    width: '100%',
    marginTop: '12px',
    padding: '9px 14px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#2563eb',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },

  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '15px',
  },

  logo: {
    width: '100%',
    maxWidth: '220px',
    objectFit: 'contain',
    marginBottom: '5px',
  },

  companyName: {
    margin: '0 0 4px 0',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },

  address: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#333',
  },

  legalBlock: {
    textAlign: 'center',
    padding: '10px 0',
    marginBottom: '10px',
  },

  legalRow: {
    margin: '2px 0',
    fontSize: '0.75rem',
    color: '#333',
    wordBreak: 'break-word',
  },

  returnInvoiceTitle: {
    textAlign: 'center',
    margin: '0 0 15px 0',
    fontSize: '1.05rem',
    fontWeight: 'bold',
    color: '#dc3545',
  },

  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    marginBottom: '4px',
    wordBreak: 'break-word',
  },

  metaAgainstRow: {
    fontSize: '0.8rem',
    marginBottom: '4px',
    wordBreak: 'break-word',
  },

  metaSubRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    fontSize: '0.75rem',
    color: '#666',
    marginBottom: '10px',
  },

  customerBlock: {
    borderBottom:
      '1px dashed #000',
    paddingBottom: '10px',
    marginBottom: '10px',
  },

  customerRow: {
    margin: '2px 0',
    fontSize: '0.8rem',
    wordBreak: 'break-word',
  },

  // Same table scale as InvoiceBill
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '15px',
    fontSize: '0.75rem',
    tableLayout: 'fixed',
  },

  th: {
    borderBottom:
      '1px solid #000',
    padding: '6px 2px',
    textAlign: 'left',
    fontWeight: 'bold',
    wordWrap: 'break-word',
  },

  thSub: {
    borderBottom:
      '1px solid #000',
    padding: '2px 2px 6px 2px',
    color: '#555',
    textAlign: 'left',
    fontWeight: 'normal',
    fontSize: '0.68rem',
  },

  td: {
    padding: '6px 2px 2px 2px',
    textAlign: 'left',
    wordWrap: 'break-word',
  },

  tdSub: {
    padding: '0 2px 8px 2px',
    borderBottom:
      '1px dashed #ccc',
    color: '#333',
    textAlign: 'left',
    fontSize: '0.72rem',
    wordWrap: 'break-word',
  },

  tdTotal: {
    padding: '8px 2px',
    borderTop:
      '1px solid #000',
    borderBottom:
      '1px solid #000',
    fontWeight: 'bold',
  },

  groupHeaderCell: {
    padding: '10px 2px 4px 2px',
    fontWeight: 'bold',
    fontSize: '0.78rem',
  },

  totalsBlock: {
    marginBottom: '15px',
  },

  summaryRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    fontSize: '0.85rem',
    marginBottom: '4px',
  },

  summaryTotal: {
    display: 'flex',
    justifyContent:
      'space-between',
    fontWeight: 'bold',
    fontSize: '0.95rem',
    borderTop:
      '1px dashed #000',
    paddingTop: '8px',
    marginTop: '8px',
    marginBottom: '8px',
  },

  subTitle: {
    fontSize: '0.9rem',
    margin: '0 0 8px 0',
    fontWeight: 'bold',
  },

  // IMPORTANT:
  // Exactly the same behavior as InvoiceBill.
  // Prevents the 6-column tax table from
  // squeezing and overlapping.
  taxTableScroll: {
    overflowX: 'auto',
    marginBottom: '15px',
    WebkitOverflowScrolling:
      'touch',
  },

  walletWrap: {
    position: 'relative',
  },

  walletBlock: {
    marginTop: '10px',
    marginBottom: '15px',
    position: 'relative',
    zIndex: 1,
  },

  walletRow: {
    display: 'grid',
    gridTemplateColumns:
      '1fr 80px 1fr',
    fontSize: '0.85rem',
    marginBottom: '4px',
    color: '#333',
  },

  walletRowTotal: {
    display: 'grid',
    gridTemplateColumns:
      '1fr 80px 1fr',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    borderTop:
      '1px dashed #000',
    paddingTop: '8px',
    marginTop: '4px',
  },

  walletRowAmount: {
    textAlign: 'right',
  },

  walletCreditedStampOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform:
      'translate(-50%, -50%)',
    zIndex: 2,
    pointerEvents: 'none',
  },

  walletCreditedStamp: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border:
      '2px double #2C6B4B',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transform: 'rotate(-15deg)',
    color: '#2C6B4B',
    textAlign: 'center',
    fontFamily:
      "'Helvetica Neue', Helvetica, Arial, sans-serif",
    opacity: 0.85,
  },

  walletStampStars: {
    fontSize: '0.4rem',
    letterSpacing: '1.5px',
    lineHeight: 1,
  },

  walletStampLabel: {
    fontSize: '0.5rem',
    fontWeight: 'bold',
    letterSpacing: '0.6px',
    margin: '3px 0',
  },

  countsRow: {
    display: 'flex',
    justifyContent:
      'space-between',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    borderTop:
      '1px dashed #000',
    borderBottom:
      '1px dashed #000',
    padding: '8px 0',
    marginBottom: '15px',
  },

  termsList: {
    fontSize: '0.7rem',
    color: '#333',
    paddingLeft: '15px',
    marginBottom: '15px',
    lineHeight: '1.4',
  },

  barcodeContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '10px',
    maxWidth: '100%',
    overflow: 'hidden',
  },

  // Same print-area behavior as InvoiceBill
  printArea: {
    padding: '0 4px',
    boxSizing: 'border-box',
  },
  
};

export default ReturnBill;