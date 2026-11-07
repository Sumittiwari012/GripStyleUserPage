import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// ── Config (same values as UpiQrPayment) ──────────────────────────────
const UPI_API_BASE_URL = 'https://gripstyleapi.runasp.net';
const UPI_GATEWAY_ID = 2;
const UPI_PAYEE_VPA = 'paytm.d93793426@pty';
const UPI_PAYEE_NAME = "MOHUA'S FASHION";
const UPI_AID = '';     // must stay empty: the old aid belongs to st386700@okaxis
const UPI_MCC = '5651'; // also adds a unique tr= (REQ<requestId>) per payment

const PAY_API = `${UPI_API_BASE_URL}/api/Payments`;
const OFFER_API = `${UPI_API_BASE_URL}/api/MOffer`;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Invoice number with every special character removed (the same tn the POS QR uses,
// so the payment is matched exactly as before).
const cleanNote = (note) => String(note ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 50);

const buildUpiLink = ({ amount, note, ref }) => {
  const parts = [
    `pa=${encodeURIComponent(UPI_PAYEE_VPA)}`,
    `pn=${encodeURIComponent(UPI_PAYEE_NAME)}`,
    `am=${Number(amount).toFixed(2)}`,
    'cu=INR',
  ];
  const safeNote = cleanNote(note);
  if (safeNote) parts.push(`tn=${encodeURIComponent(safeNote)}`);
  if (UPI_MCC) {
    parts.push(`mc=${encodeURIComponent(UPI_MCC)}`);
    parts.push(`tr=${encodeURIComponent(ref || '')}`);
  }
  if (UPI_AID) parts.push(`aid=${encodeURIComponent(UPI_AID)}`);
  return `upi://pay?${parts.join('&')}`;
};

const readBody = async (res) => {
  const text = await res.text();
  if (!text) return '';
  try { return JSON.parse(text); } catch { return text; }
};
const errorText = (body, fallback) =>
  !body ? fallback : typeof body === 'string' ? body : body.message || body.title || fallback;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const formatClock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ── Offer text helpers ────────────────────────────────────────────────
function rewardText(o) {
  if (o.offerTypeId === 1) return `₹${o.flatAmount} off`;
  if (o.offerTypeId === 2) return `${o.discountPercentage}% off`;
  if (o.offerTypeId === 4) return `Bundle at ₹${o.comboPrice}`;
  if (o.discountPercentage > 0) return `Get items ${o.discountPercentage}% off`;
  if (o.flatAmount > 0) return `Get items ₹${o.flatAmount} off`;
  return 'Get items free';
}
const slotLabel = (s) => {
  const base = s.isGroup ? s.groupName ?? s.subCategoryName : s.subCategoryName;
  return `${base ?? 'Selected items'} × ${s.qty}`;
};

/**
 * Opens a UPI payment and nothing else.
 *
 * Reads the payment from the page address, or from props:
 *   /pay?amount=499&invoice=GSC1-06112026/0004&name=Asha
 *
 * Flow: create request -> "Pay with UPI app" button (and QR for another device)
 *       -> wait -> smiley -> screen with current offers.
 */
function UpiPayLinkPage({ amount: amountProp, invoiceNumber: invoiceProp, customerName: nameProp }) {
  const query = new URLSearchParams(window.location.search);
  const amount = Number(amountProp ?? query.get('amount'));
  const invoiceNumber = invoiceProp ?? query.get('invoice') ?? '';
  const customerName = nameProp ?? query.get('name') ?? '';

  // creating | waiting | paid | offers | expired | error
  const [phase, setPhase] = useState('creating');
  const [qrAmount, setQrAmount] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [windowSeconds, setWindowSeconds] = useState(0);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [offers, setOffers] = useState(null); // null = loading

  const requestIdRef = useRef(null);
  const endAtRef = useRef(0);
  const settledRef = useRef(false);
  const autoOpenedRef = useRef(false);

  const [requestRef, setRequestRef] = useState('');

  const shownAmount = Number(qrAmount ?? amount);
  const upiLink = buildUpiLink({ amount: shownAmount, note: invoiceNumber, ref: requestRef });

  const cancelRequest = (requestId, keepalive = false) =>
    fetch(`${PAY_API}/CancelPaymentRequest`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ customerId: UPI_GATEWAY_ID, requestId }),
      keepalive,
    });

  // ── Create the request, then wait (same API calls as UpiQrPayment) ──
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const { signal } = controller;

    settledRef.current = false;
    requestIdRef.current = null;
    setPhase('creating');
    setError('');

    const run = async () => {
      if (!(amount > 0)) {
        setError('No amount to pay. Open this page with ?amount=… in the address.');
        setPhase('error');
        return;
      }

      let created;
      try {
        const res = await fetch(`${PAY_API}/CreatePaymentRequest`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({
            customerId: UPI_GATEWAY_ID,
            name: customerName,
            invoiceNumber,
            amount: Math.round(amount * 100) / 100,
          }),
          signal,
        });
        const body = await readBody(res);
        if (!res.ok) throw new Error(errorText(body, `Could not start the payment (${res.status}).`));
        created = body;
      } catch (err) {
        if (disposed) return;
        setError(err.message || 'Could not reach the server.');
        setPhase('error');
        return;
      }

      if (disposed) {
        cancelRequest(created.requestId, true).catch(() => {});
        return;
      }

      requestIdRef.current = created.requestId;
      setRequestRef(`REQ${created.requestId}`);
      endAtRef.current = Date.now() + created.windowSeconds * 1000;
      setQrAmount(created.amount);
      setWindowSeconds(created.windowSeconds);
      setSecondsLeft(created.windowSeconds);
      setPhase('waiting');

      let failures = 0;
      while (!disposed) {
        try {
          const res = await fetch(`${PAY_API}/WaitForPayment/${created.requestId}`, { signal });
          const body = await readBody(res);
          if (!res.ok || typeof body !== 'object' || !body.status) {
            throw new Error(errorText(body, `Waiting failed (${res.status}).`));
          }
          failures = 0;

          if (body.status === 'pending') {
            if (typeof body.secondsLeft === 'number') {
              endAtRef.current = Date.now() + body.secondsLeft * 1000;
            }
            setPhase((p) => (p === 'expired' ? 'waiting' : p));
            continue;
          }
          if (body.status === 'paid') {
            settledRef.current = true;
            setPhase('paid');
          } else if (body.status === 'expired') {
            setPhase('expired');
          } else {
            settledRef.current = true;
            setError('This payment was cancelled.');
            setPhase('error');
          }
          return;
        } catch (err) {
          if (disposed) return;
          failures += 1;
          if (failures >= 5) {
            setError('Lost connection to the server. Check the internet and try again.');
            setPhase('error');
            return;
          }
          await sleep(3000);
        }
      }
    };

    run();

    return () => {
      disposed = true;
      controller.abort();
      if (!settledRef.current && requestIdRef.current) {
        cancelRequest(requestIdRef.current, true).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ── Try to open the UPI app once as soon as the link is ready ──
  // Browsers often need a tap, so the big button below is the reliable way.
  useEffect(() => {
    if (phase === 'waiting' && !autoOpenedRef.current && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      autoOpenedRef.current = true;
      window.location.href = upiLink;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Countdown ──
  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setPhase((p) => (p === 'waiting' ? 'expired' : p));
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [phase]);

  // ── Smiley, then the offers screen ──
  useEffect(() => {
    if (phase !== 'paid') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${OFFER_API}?onlyLive=true`);
        const list = res.ok ? await res.json() : [];
        if (!cancelled) setOffers(list);
      } catch {
        if (!cancelled) setOffers([]);
      }
    })();
    const timer = setTimeout(() => setPhase('offers'), 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase]);

  const progress = windowSeconds > 0 ? (secondsLeft / windowSeconds) * 100 : 0;

  return (
    <div className="upl-page">
      <div className="upl-card">
        {phase === 'creating' && (
          <>
            <Amount value={shownAmount} invoice={invoiceNumber} />
            <p className="upl-status">Getting your payment ready…</p>
          </>
        )}

        {phase === 'waiting' && (
          <>
            <Amount value={shownAmount} invoice={invoiceNumber} />
            <a className="upl-pay" href={upiLink}>Pay with UPI app</a>
            <p className="upl-or">or scan from another phone</p>
            <div className="upl-qr">
              <QRCodeSVG value={upiLink} size={200} level="M" includeMargin />
            </div>
            <div className={`upl-timer${secondsLeft <= 30 ? ' upl-timer--low' : ''}`}>
              {formatClock(secondsLeft)}
            </div>
            <div className="upl-bar"><div className="upl-bar-fill" style={{ width: `${progress}%` }} /></div>
            <p className="upl-status">Waiting for your payment…</p>
          </>
        )}

        {phase === 'paid' && (
          <div className="upl-paid">
            <div className="upl-smiley" role="img" aria-label="Payment received">😊</div>
            <p className="upl-status">Payment received. Thank you!</p>
          </div>
        )}

        {phase === 'expired' && (
          <>
            <Amount value={shownAmount} invoice={invoiceNumber} />
            <p className="upl-status">The time ran out and no payment was received.</p>
            <button className="upl-pay" onClick={() => setAttempt((a) => a + 1)}>Get a new payment link</button>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="upl-error">{error}</p>
            <button className="upl-pay" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
          </>
        )}

        {phase === 'offers' && (
          <div className="upl-offers">
            <h1 className="upl-offers-title">Current offers</h1>
            <p className="upl-status">Thank you for shopping with us. Here is what is on right now.</p>
            {offers === null && <p className="upl-status">Loading offers…</p>}
            {offers && offers.length === 0 && <p className="upl-status">No offers running right now. See you next time!</p>}
            {(offers || []).map((o) => (
              <article className="upl-offer" key={o.id}>
                <strong>{o.name}</strong>
                <span className="upl-offer-reward">{rewardText(o)}</span>
                <span className="upl-offer-line">
                  Buy: {o.buySlots.map(slotLabel).join(', ')}
                  {o.getSlots?.length > 0 && <> · Get: {o.getSlots.map(slotLabel).join(', ')}</>}
                </span>
                {o.validTill && (
                  <span className="upl-offer-line">Valid till {new Date(o.validTill).toLocaleDateString()}</span>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .upl-page {
          min-height: 100vh; box-sizing: border-box; padding: 20px 16px 40px;
          background: #F1F0F5; color: #1C1A24; font-family: 'Inter', system-ui, sans-serif;
          display: flex; justify-content: center; align-items: flex-start;
        }
        .upl-card {
          width: 100%; max-width: 420px; background: #fff; border-radius: 18px;
          padding: 24px 18px; text-align: center;
          box-shadow: 0 8px 20px -12px rgba(28, 26, 36, 0.45);
        }
        .upl-amount { font-size: 34px; font-weight: 700; margin: 0; }
        .upl-invoice { font-size: 13px; color: #6B667F; margin: 2px 0 14px; }
        .upl-status { font-size: 14px; color: #4A4560; margin: 10px 0 0; line-height: 1.4; }
        .upl-error { font-size: 14px; background: #FDECEA; color: #8C1D18; border-radius: 10px; padding: 10px 12px; }
        .upl-pay {
          display: block; width: 100%; box-sizing: border-box; margin-top: 12px; padding: 14px;
          border: none; border-radius: 14px; background: #2E6DA4; color: #fff;
          font: inherit; font-size: 16px; font-weight: 700; text-decoration: none; cursor: pointer;
        }
        .upl-pay:focus-visible { outline: 3px solid #1C1A24; outline-offset: 3px; }
        .upl-or { font-size: 12.5px; color: #6B667F; margin: 14px 0 4px; }
        .upl-qr { display: flex; justify-content: center; }
        .upl-timer { font-size: 22px; font-weight: 700; margin-top: 6px; font-variant-numeric: tabular-nums; }
        .upl-timer--low { color: #B3261E; }
        .upl-bar { height: 6px; background: #E2DFEC; border-radius: 999px; overflow: hidden; margin-top: 6px; }
        .upl-bar-fill { height: 100%; background: #2E6DA4; transition: width 0.25s linear; }
        .upl-smiley { font-size: 96px; line-height: 1.1; }
        .upl-paid { padding: 24px 0; }
        .upl-offers { text-align: left; }
        .upl-offers-title { font-size: 22px; margin: 0 0 4px; }
        .upl-offer {
          display: flex; flex-direction: column; gap: 3px; margin-top: 12px; padding: 12px 14px;
          border: 1.5px solid #D9D6E4; border-radius: 12px; background: #FAFAFD;
        }
        .upl-offer-reward { font-weight: 700; color: #2F7E72; }
        .upl-offer-line { font-size: 12.5px; color: #5C5772; line-height: 1.4; }
      `}</style>
    </div>
  );
}

function Amount({ value, invoice }) {
  return (
    <>
      <p className="upl-amount">₹{Number(value || 0).toFixed(2)}</p>
      {invoice && <p className="upl-invoice">Invoice {invoice}</p>}
    </>
  );
}

export default UpiPayLinkPage;