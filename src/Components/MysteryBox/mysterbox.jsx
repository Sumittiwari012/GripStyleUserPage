import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode"; // npm i qrcode

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const API_BASE = "https://gripstyleapi.runasp.net"; // or your env variable

async function post(path, body) {
  const res = await fetch(`${API_BASE}/api/MysteryBox/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.message || "Something went wrong. Try again.");
    e.code = data.code;
    throw e;
  }
  return data;
}

const mysteryApi = {
  sendOtp: (num) => post("SendOtp", { phoneNumber: num }),
  async verifyOtp(num, otp) {
    const d = await post("VerifyOtp", { phoneNumber: num, otpVal: Number(otp) });
    // The unique code comes from the backend only; the QR is drawn from that same code.
    const qr = await QRCode.toDataURL(d.couponUniqueCode, {
      margin: 0,
      width: 300,
      color: { dark: "#14112bff", light: "#00000000" },
    });
    const isFlat = d.discountAmount > 0;
    return {
      code: d.couponUniqueCode,
      amount: d.discountAmount, // picks the template image (flat coupons only)
      value: isFlat ? `₹${d.discountAmount} OFF` : `${d.discountPercentage}% OFF`,
      min: `Min. order ₹${d.minSpendAmount}`,
      name: d.couponName,
      assignmentId: d.couponAssignmentId,
      customerName: d.customerName,
      isNewCustomer: d.isNewCustomer,
      qr,
    };
  },
};

// Five template images in public/: coupon_Rs50.png, coupon_Rs100.png, coupon_Rs200.png,
// coupon_Rs300.png, coupon_Rs500.png
const couponImageUrl = (amount) => `/coupon_Rs${amount}.png`;
const isSorry = (ex) => ex.code === "ALREADY_CLAIMED" || ex.code === "SOLD_OUT";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */
const GUIDE = {
  idle: "Enter your mobile number to begin",
  sending: "Sending your OTP on WhatsApp…",
  otp: "Enter the OTP we sent on WhatsApp",
  checking: "Checking your OTP…",
  ready: "OTP verified. Tap the box to open it",
  opening: "Opening… hold tight",
  revealed: "Reward unlocked. Save your coupon",
  sorry: "Sorry, no box for this number",
};
const STEP_INDEX = { idle: 0, sending: 1, otp: 1, checking: 1, ready: 2, opening: 3, revealed: 3, sorry: 0 };
const STEP_LABELS = ["Number", "OTP", "Open", "Reward"];
const REWARD_LINK = "https://gripstyle.in/user";
const CONFETTI_COLORS = ["#ffc857", "#ff5c4d", "#f5eee3", "#5be3b0", "#8f86ff"];

const digitsOnly = (v) => v.replace(/\D/g, "").slice(0, 10);
const formatPhone = (d) => (d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function MysteryBox({ api = mysteryApi }) {
  const [phase, setPhase] = useState("idle");
  const [phone, setPhone] = useState(""); // raw digits
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(0);
  const [reward, setReward] = useState(null);
  const [sorryMsg, setSorryMsg] = useState("");
  const [imgFailed, setImgFailed] = useState(false);
  const [otpLength, setOtpLength] = useState(4); // from SendOtp
  const [maskedPhone, setMaskedPhone] = useState(""); // from SendOtp
  const [cooldown, setCooldown] = useState(0); // seconds until Resend is allowed
  const [guide, setGuide] = useState(GUIDE.idle);
  const [guideSwap, setGuideSwap] = useState(false);

  const boxRef = useRef(null);
  const canvasRef = useRef(null);
  const partsRef = useRef([]);
  const rafRef = useRef(0);
  const timers = useRef([]);
  const rewardRef = useRef(null);

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The stylesheet only knows idle / verifying / ready / opening / revealed.
  const cssPhase =
    phase === "sending" || phase === "checking"
      ? "verifying"
      : phase === "otp" || phase === "sorry"
      ? "idle"
      : phase;

  const later = useCallback((fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      cancelAnimationFrame(rafRef.current);
    },
    []
  );

  /* Guide text swaps with a short fade each time the phase changes */
  useEffect(() => {
    setGuideSwap(true);
    const id = setTimeout(() => {
      setGuide(GUIDE[phase]);
      setGuideSwap(false);
    }, reduce ? 0 : 180);
    return () => clearTimeout(id);
  }, [phase, reduce]);

  /* Resend countdown */
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  /* ---------- Confetti ---------- */
  const sizeCanvas = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const r = window.devicePixelRatio || 1;
    cv.width = window.innerWidth * r;
    cv.height = window.innerHeight * r;
    cv.getContext("2d").setTransform(r, 0, 0, r, 0, 0);
  }, []);

  useEffect(() => {
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    return () => window.removeEventListener("resize", sizeCanvas);
  }, [sizeCanvas]);

  const tick = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    partsRef.current = partsRef.current.filter((p) => p.life > 0 && p.y < window.innerHeight + 30);
    partsRef.current.forEach((p) => {
      p.vy += 0.28;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.life -= 0.006;
      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    rafRef.current = partsRef.current.length ? requestAnimationFrame(tick) : 0;
  }, []);

  const burst = useCallback(
    (big) => {
      if (reduce || !boxRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      const ox = big ? window.innerWidth / 2 : rect.left + rect.width / 2;
      const oy = big ? window.innerHeight * 0.35 : rect.top + 40;
      const n = big ? 140 : 70;
      for (let i = 0; i < n; i++) {
        const a = big ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const s = big ? 4 + Math.random() * 9 : 5 + Math.random() * 10;
        partsRef.current.push({
          x: ox,
          y: oy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - (big ? 3 : 2),
          w: 5 + Math.random() * 7,
          h: 3 + Math.random() * 5,
          r: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.4,
          c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          life: 1,
        });
      }
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
    },
    [reduce, tick]
  );

  /* ---------- Handlers ---------- */
  const fail = (msg) => {
    setError(msg);
    setShake((n) => n + 1);
  };

  const onPhoneChange = (e) => {
    setPhone(digitsOnly(e.target.value));
    setError("");
  };

  // Sends (or re-sends) the OTP. Used by the phone form and the Resend button.
  const startOtp = async (fromOtpScreen) => {
    setError("");
    setPhase("sending");
    try {
      const d = await api.sendOtp(phone);
      setOtpLength(d.otpLength || 4);
      setMaskedPhone(d.maskedPhoneNumber || "");
      setCooldown(d.resendAfterSeconds || 0);
      setOtp("");
      setPhase("otp");
    } catch (ex) {
      if (isSorry(ex)) {
        setSorryMsg(ex.message);
        setPhase("sorry");
        return;
      }
      setPhase(fromOtpScreen ? "otp" : "idle");
      fail(ex.message || "Something went wrong. Try again.");
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (phone.length !== 10) return fail("Enter a 10 digit mobile number.");
    if (!/^[6-9]/.test(phone)) return fail("Mobile numbers start with 6, 7, 8 or 9.");
    startOtp(false);
  };

  const onVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== otpLength) return fail(`Enter the ${otpLength} digit OTP.`);
    setPhase("checking");
    try {
      rewardRef.current = await api.verifyOtp(phone, otp);
      setPhase("ready");
      later(() => {
        if (boxRef.current) boxRef.current.focus({ preventScroll: true });
      }, 60);
    } catch (ex) {
      if (isSorry(ex)) {
        setSorryMsg(ex.message);
        setPhase("sorry");
        return;
      }
      setPhase("otp");
      fail(ex.message || "Something went wrong. Try again.");
    }
  };

  const onChangeNumber = () => {
    setOtp("");
    setError("");
    setPhase("idle");
  };

  // The coupon was already assigned when the OTP was verified. Opening the box only reveals it.
  const onOpen = async () => {
    if (phase !== "ready") return;
    setPhase("opening");
    later(() => burst(false), 1100);
    await sleep(1700);
    setImgFailed(false);
    setReward(rewardRef.current);
    setPhase("revealed");
    later(() => burst(true), reduce ? 0 : 500);
  };

  /* ---------- Derived ---------- */
  const idx = STEP_INDEX[phase];
  const fillPct = phase === "revealed" ? 75 : idx * 25;
  const masked = phone.length === 10 ? `${phone.slice(0, 2)}•••••${phone.slice(7)}` : "";

  return (
    <div className="mb-root" data-phase={cssPhase}>
      <style>{CSS}</style>

      <div className="wrap">
        <header>
          <img className="logo" src="/gripstyle-logo.png" alt="Gripstyle" />
          <h1>Open your mystery box</h1>
          <p className="sub">Every number gets one box. Enter yours and see what is inside.</p>
        </header>

        <ol className="track" aria-label="Progress">
          <li className="fill" aria-hidden="true" style={{ width: `${fillPct}%` }} />
          {STEP_LABELS.map((label, i) => {
            const done = i < idx || phase === "revealed";
            const active = i === idx && phase !== "revealed";
            return (
              <li key={label} className={`${done ? "done" : ""} ${active ? "active" : ""}`}>
                <span className="dot">
                  <span>{i + 1}</span>
                </span>
                {label}
              </li>
            );
          })}
        </ol>

        <div className="stage-wrap">
          <div className="stage">
            <div className="rays" />
            <div className="halo" />

            {phase === "revealed" && reward && (
              <div className="ticket-slot">
                {imgFailed || !reward.amount ? (
                  <div className="ticket-img ticket-fallback">
                    <b>{reward.value}</b>
                    <span>{reward.min}</span>
                    <code>{reward.code}</code>
                    <small>This coupon is also saved in your account.</small>
                  </div>
                ) : (
                  <div className="ticket-img">
                    <img
                      className="tk-bg"
                      src={couponImageUrl(reward.amount)}
                      alt={`${reward.value} coupon`}
                      onError={() => setImgFailed(true)}
                    />
                    <span className="tk-code">{reward.code}</span>
                    <img className="tk-qr" src={reward.qr} alt="QR code of your coupon" />
                  </div>
                )}
              </div>
            )}

            <div className="box-holder">
              <button
                ref={boxRef}
                className="box"
                type="button"
                aria-label="Mystery box"
                disabled={phase !== "ready"}
                onClick={onOpen}
              >
                <span className="shadow" />
                <span className="body">
                  <span className="ribbon" />
                  <span className="qmark">
                    <b>?</b>
                  </span>
                </span>
                <span className="inside-glow" />
                <span className="lid">
                  <span className="ribbon" />
                  <span className="bow" />
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="guide" role="status" aria-live="polite">
          <span className="arrow" aria-hidden="true" />
          <span className={`guide-text ${guideSwap ? "swap" : ""}`}>{guide}</span>
        </div>

        {phase === "sorry" ? (
          <div className="panel sorry" role="alert">
            <strong>Sorry!</strong>
            <p>{sorryMsg}</p>
            <a className="btn" href={REWARD_LINK}>
              Login To Your Account
            </a>
          </div>
        ) : phase === "otp" ? (
          <form className="panel" onSubmit={onVerifyOtp} noValidate>
            <label htmlFor="mb-otp">OTP sent on WhatsApp to +91 {maskedPhone || masked}</label>
            <div key={shake} className={`field ${error ? "invalid" : ""}`}>
              <input
                id="mb-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={"1234567890".slice(0, otpLength)}
                maxLength={otpLength}
                value={otp}
                autoFocus
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, otpLength));
                  setError("");
                }}
              />
            </div>
            <p className="err" role="alert">
              {error}
            </p>
            <button className="btn" type="submit" disabled={otp.length !== otpLength}>
              Verify OTP
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={cooldown > 0}
              onClick={() => startOtp(true)}
            >
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
            </button>
            <button className="btn ghost" type="button" onClick={onChangeNumber}>
              Change number
            </button>
          </form>
        ) : (
          <form className="panel" onSubmit={onSubmit} noValidate>
            <label htmlFor="mb-phone">Mobile number</label>
            <div key={shake} className={`field ${error ? "invalid" : ""}`}>
              <span className="cc">+91</span>
              <input
                id="mb-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                maxLength={11}
                value={formatPhone(phone)}
                onChange={onPhoneChange}
                autoFocus
              />
            </div>
            <p className="err" role="alert">
              {error}
            </p>
            <button className="btn" type="submit" disabled={phone.length !== 10}>
              Send OTP
            </button>
            <p className="fine">We only use your number to match one box to you.</p>
          </form>
        )}

        {phase === "revealed" && reward && (
          <section className="result" aria-live="polite">
            <div className="winline">
              You got {reward.value}
              <small>Matched to +91 {maskedPhone || masked}</small>
              {reward.isNewCustomer && (
                <small>We have created your account. Log in with this number to see your coupon.</small>
              )}
            </div>

            <a className="btn stagger s2" href={REWARD_LINK}>
              Login To Your Account
            </a>
          </section>
        )}
      </div>

      <canvas ref={canvasRef} className="mb-fx" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles (scoped under .mb-root)                                     */
/* ------------------------------------------------------------------ */
const CSS = String.raw`
@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=DM+Sans:wght@400;500;700&display=swap");

.mb-root {
  --ink: #14112b;
  --ink-2: #1e1a42;
  --line: rgba(255, 255, 255, 0.14);
  --cream: #f5eee3;
  --muted: #b7b1d0;
  --coral: #ff5c4d;
  --coral-deep: #d9382c;
  --gold: #ffc857;
  --mint: #5be3b0;
  --danger: #ff8d85;
  --font-display: "Bricolage Grotesque", "Trebuchet MS", system-ui, sans-serif;
  --font-body: "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  color-scheme: dark;

  min-height: 100vh;
  background-color: var(--ink);
  background-image:
    radial-gradient(70% 45% at 50% 0%, rgba(255, 92, 77, 0.18), transparent 70%),
    radial-gradient(60% 40% at 50% 100%, rgba(255, 200, 87, 0.08), transparent 70%);
  color: var(--cream);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.5;
  padding: 28px 16px 40px;
  overflow-x: hidden;
}
.mb-root, .mb-root *, .mb-root *::before, .mb-root *::after { box-sizing: border-box; }
.mb-root .wrap { max-width: 440px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }

.mb-root header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.mb-root .logo { display: block; height: 56px; width: auto; max-width: 70%; object-fit: contain; margin-bottom: 10px; }
.mb-root h1 {
  margin: 0; font-family: var(--font-display); font-weight: 800; font-size: clamp(30px, 8vw, 40px);
  line-height: 1.05; letter-spacing: -0.02em; text-wrap: balance;
}
.mb-root .sub { margin: 0; color: var(--muted); font-size: 15px; text-wrap: balance; }

/* Step tracker */
.mb-root .track { list-style: none; margin: 4px 0 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); position: relative; }
.mb-root .track::before, .mb-root .track .fill {
  content: ""; position: absolute; top: 13px; left: 12.5%; height: 3px; border-radius: 3px;
}
.mb-root .track::before { right: 12.5%; background: var(--line); }
.mb-root .track .fill {
  background: linear-gradient(90deg, var(--coral), var(--gold)); width: 0;
  transition: width 0.8s cubic-bezier(0.65, 0, 0.2, 1); z-index: 1;
}
.mb-root .track li { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); text-align: center; }
.mb-root .track .dot {
  width: 28px; height: 28px; border-radius: 50%; background: var(--ink); border: 2px solid var(--line);
  display: grid; place-items: center; font-size: 12px; font-weight: 700; position: relative; z-index: 2;
  transition: background 0.4s, border-color 0.4s, color 0.4s, transform 0.4s;
}
.mb-root .track li.active { color: var(--cream); }
.mb-root .track li.active .dot { border-color: var(--gold); color: var(--gold); transform: scale(1.12); animation: mb-ping 1.6s ease-out infinite; }
.mb-root .track li.done .dot { background: var(--gold); border-color: var(--gold); color: var(--ink); }
.mb-root .track li.done .dot span { display: none; }
.mb-root .track li.done .dot::after { content: "\2713"; font-size: 14px; font-weight: 800; }
@keyframes mb-ping { 0% { box-shadow: 0 0 0 0 rgba(255, 200, 87, 0.55); } 100% { box-shadow: 0 0 0 12px rgba(255, 200, 87, 0); } }

/* Stage */
.mb-root .stage-wrap { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 0.7s cubic-bezier(0.65, 0, 0.2, 1), opacity 0.5s; }
.mb-root .stage-wrap > .stage { min-height: 0; }
.mb-root .stage {
  --box-top: 40px;
  --rev-h: 420px;
  position: relative; height: 270px; overflow: visible;
  transition: height 0.9s cubic-bezier(0.6, 0, 0.2, 1) 0.15s;
}
.mb-root[data-phase="revealed"] .stage { height: var(--rev-h); }

.mb-root .box-holder {
  position: absolute; left: 50%; top: var(--box-top); width: 170px; height: 190px; margin-left: -85px; z-index: 6;
  transform-origin: 50% 100%;
  transition: top 0.9s cubic-bezier(0.6, 0, 0.2, 1) 0.15s, transform 0.9s cubic-bezier(0.6, 0, 0.2, 1) 0.15s;
}
.mb-root[data-phase="revealed"] .box-holder { top: calc(var(--rev-h) - 204px); transform: scale(0.72); }

.mb-root .ticket-slot { position: absolute; left: 0; right: 0; top: 0; height: var(--rev-h); z-index: 4; pointer-events: none; }
.mb-root .ticket-slot .ticket-img {
  position: absolute; left: 0; right: 0; bottom: 93px; margin: 0 auto;
  width: min(340px, 100%); border-radius: 14px; overflow: hidden; pointer-events: auto;
  box-shadow: 0 24px 50px rgba(0, 0, 0, 0.4); animation: mb-fly 1.6s both;
}
.mb-root .ticket-fallback {
  background: linear-gradient(150deg, #ffe08a, var(--gold) 55%, #f4ab2f); color: var(--ink);
  padding: 22px; display: flex; flex-direction: column; gap: 6px; text-align: center; overflow: hidden;
}
.mb-root .ticket-fallback b { font-family: var(--font-display); font-size: 40px; line-height: 1; }
.mb-root .ticket-fallback code { font-size: 22px; letter-spacing: 0.1em; font-weight: 700; user-select: all; }
.mb-root .ticket-fallback small { opacity: 0.75; }
.mb-root .tk-bg { display: block; width: 100%; height: auto; }
/* Overlay positions, as a percentage of the template image. Nudge these to match your template. */
.mb-root .tk-code {
  position: absolute; left: 10%; top: 67%; transform: translateY(-50%);
  font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-weight: 700;
  font-size: clamp(11px, 3.8vw, 15px); letter-spacing: 0.08em; color: #14112b; user-select: all;
}
.mb-root .tk-qr { position: absolute; left: 72.8%; top: 58%; width: 19%; height: auto; }
/* Rises out of the box, then drops into place. */
@keyframes mb-fly {
  0% { opacity: 0; transform: translateY(90px) scale(0.16) rotate(-8deg); animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1); }
  14% { opacity: 1; }
  42% { opacity: 1; transform: translateY(-25px) scale(0.6) rotate(5deg); animation-timing-function: cubic-bezier(0.45, 0, 0.25, 1); }
  78% { transform: translateY(10px) scale(1.04) rotate(-1.5deg); animation-timing-function: ease-out; }
  100% { opacity: 1; transform: none; }
}

.mb-root .rays {
  position: absolute; width: 520px; height: 520px; left: 50%; top: calc(var(--box-top) + 95px); margin: -260px 0 0 -260px; border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(255, 200, 87, 0.34) 0 7deg, transparent 7deg 20deg);
  -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 68%);
  mask-image: radial-gradient(circle, #000 0%, transparent 68%);
  opacity: 0; transform: scale(0.4); pointer-events: none;
}
.mb-root[data-phase="opening"] .rays, .mb-root[data-phase="ready"] .rays { opacity: 0.55; transform: scale(1); transition: opacity 0.8s, transform 0.9s; animation: mb-spin 14s linear infinite; }
.mb-root[data-phase="opening"] .rays { opacity: 1; }
.mb-root[data-phase="revealed"] .rays { opacity: 0.3; transform: scale(1); top: calc(var(--rev-h) - 60px); transition: opacity 1.2s, top 0.9s cubic-bezier(0.6, 0, 0.2, 1) 0.15s; animation: mb-spin 20s linear infinite; }
.mb-root[data-phase="revealed"] .halo { top: calc(var(--rev-h) - 60px); }
@keyframes mb-spin { to { transform: rotate(360deg) scale(1); } }

.mb-root .halo {
  position: absolute; width: 260px; height: 260px; left: 50%; top: calc(var(--box-top) + 95px); margin: -130px 0 0 -130px; border-radius: 50%;
  transition: top 0.9s cubic-bezier(0.6, 0, 0.2, 1) 0.15s;
  background: radial-gradient(circle, rgba(255, 92, 77, 0.4), transparent 65%); filter: blur(6px);
  animation: mb-breathe 3.4s ease-in-out infinite;
}
@keyframes mb-breathe { 50% { transform: scale(1.12); opacity: 0.8; } }

.mb-root .box {
  all: unset; position: relative; width: 170px; height: 190px; cursor: default; display: block;
  animation: mb-floaty 3.6s ease-in-out infinite; -webkit-tap-highlight-color: transparent;
}
.mb-root .box:focus-visible { outline: 3px solid var(--gold); outline-offset: 10px; border-radius: 12px; }
@keyframes mb-floaty { 50% { transform: translateY(-10px) rotate(-1.5deg); } }
.mb-root .shadow {
  position: absolute; left: 8%; right: 8%; bottom: -26px; height: 16px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.45); filter: blur(7px); animation: mb-shadow 3.6s ease-in-out infinite;
}
@keyframes mb-shadow { 50% { transform: scaleX(0.82); opacity: 0.6; } }
.mb-root .body {
  position: absolute; left: 0; right: 0; top: 58px; bottom: 0; border-radius: 6px 6px 12px 12px;
  background: linear-gradient(160deg, #ff7a5c 0%, var(--coral) 45%, var(--coral-deep) 100%);
  box-shadow: inset 0 -14px 24px rgba(0, 0, 0, 0.22), inset 0 2px 0 rgba(255, 255, 255, 0.3);
  overflow: hidden;
}
.mb-root .body::after {
  content: ""; position: absolute; inset: 0;
  background: repeating-linear-gradient(115deg, transparent 0 18px, rgba(255, 255, 255, 0.05) 18px 20px);
}
.mb-root .ribbon { position: absolute; top: 0; bottom: 0; left: 50%; width: 30px; margin-left: -15px; background: linear-gradient(90deg, #f2ad2f, var(--gold) 50%, #f2ad2f); }
.mb-root .qmark {
  position: absolute; inset: 0; display: grid; place-items: center; z-index: 2;
  font-family: var(--font-display); font-weight: 800; font-size: 64px; color: var(--ink);
}
.mb-root .qmark b { background: var(--gold); width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.18); font-size: 40px; line-height: 1; }
.mb-root .lid {
  position: absolute; left: -10px; right: -10px; top: 6px; height: 56px; z-index: 3; transform-origin: 0% 100%;
  border-radius: 8px;
  background: linear-gradient(160deg, #ff8a6a, var(--coral) 60%, #e9473a);
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.2), inset 0 2px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.25s;
}
.mb-root .lid .ribbon { width: 34px; margin-left: -17px; }
.mb-root .bow { position: absolute; left: 50%; top: -24px; width: 0; height: 0; z-index: 2; }
.mb-root .bow::before, .mb-root .bow::after {
  content: ""; position: absolute; top: 0; width: 46px; height: 32px; background: var(--gold);
  border-radius: 50% 50% 50% 8%; box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.12);
}
.mb-root .bow::before { right: -3px; transform: rotate(-8deg); }
.mb-root .bow::after { left: -3px; transform: scaleX(-1) rotate(-8deg); }
.mb-root .inside-glow {
  position: absolute; left: 6px; right: 6px; top: 52px; height: 30px; border-radius: 50%;
  background: radial-gradient(ellipse, #fff7d6, var(--gold) 55%, transparent 75%); opacity: 0; filter: blur(3px); z-index: 1;
}

/* Box per phase */
.mb-root[data-phase="verifying"] .box { animation: mb-shake 0.55s ease-in-out infinite; }
@keyframes mb-shake {
  0%, 100% { transform: rotate(0) translateX(0); }
  20% { transform: rotate(-4deg) translateX(-4px); }
  40% { transform: rotate(4deg) translateX(4px); }
  60% { transform: rotate(-3deg) translateX(-3px); }
  80% { transform: rotate(3deg) translateX(3px); }
}
.mb-root[data-phase="ready"] .box { cursor: pointer; animation: mb-hop 1.3s cubic-bezier(0.3, 0, 0.3, 1) infinite; }
@keyframes mb-hop { 0%, 55%, 100% { transform: translateY(0) scale(1, 1); } 20% { transform: translateY(-26px) scale(0.97, 1.04); } 38% { transform: translateY(0) scale(1.05, 0.95); } }
.mb-root[data-phase="ready"] .lid { animation: mb-tease 1.3s ease-in-out infinite; }
@keyframes mb-tease { 0%, 55%, 100% { transform: translateY(0); } 25% { transform: translateY(-8px) rotate(-3deg); } }
.mb-root[data-phase="opening"] .box { animation: mb-pre 0.6s ease-in; }
@keyframes mb-pre { 0% { transform: scale(1); } 60% { transform: scale(1.12, 0.92); } 100% { transform: scale(1); } }
.mb-root[data-phase="opening"] .lid { animation: mb-lidoff 1.1s 0.5s cubic-bezier(0.3, 0.7, 0.3, 1) forwards; }
.mb-root[data-phase="revealed"] .lid { animation: none; transform: translate(-98px, 128px) rotate(-10deg) scale(0.55); transition: none; }
@keyframes mb-lidoff {
  0% { transform: none; }
  35% { transform: translate(-30px, -80px) rotate(-14deg) scale(0.9); }
  100% { transform: translate(-98px, 128px) rotate(-10deg) scale(0.55); }
}
.mb-root[data-phase="opening"] .inside-glow { animation: mb-glow 1.2s 0.5s ease-out forwards; }
@keyframes mb-glow { to { opacity: 0.9; transform: translateY(-30px) scaleX(1.5); } }
.mb-root[data-phase="revealed"] .inside-glow { opacity: 0.9; transform: translateY(-30px) scaleX(1.5); animation: mb-glowpulse 2.4s ease-in-out infinite; }
@keyframes mb-glowpulse {
  0%, 100% { opacity: 0.55; transform: translateY(-30px) scaleX(1.5); }
  50% { opacity: 0.95; transform: translateY(-34px) scaleX(1.7); }
}
.mb-root[data-phase="opening"] .qmark { animation: mb-qout 0.4s 0.4s forwards; }
.mb-root[data-phase="revealed"] .qmark { opacity: 0; }
@keyframes mb-qout { to { opacity: 0; transform: scale(0.4); } }

/* Guide */
.mb-root .guide {
  align-self: center; display: inline-flex; align-items: center; gap: 10px; padding: 9px 16px 9px 12px;
  border-radius: 999px; background: var(--ink-2); border: 1px solid var(--line); font-size: 14px; font-weight: 500;
  min-height: 40px; max-width: 100%;
}
.mb-root .guide .arrow { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--gold); color: var(--ink); font-weight: 800; flex: none; animation: mb-bob 1s ease-in-out infinite; }
.mb-root .guide .arrow::before { content: "\2193"; font-size: 14px; }
.mb-root[data-phase="ready"] .guide .arrow { animation-name: mb-bobup; }
.mb-root[data-phase="ready"] .guide .arrow::before { content: "\2191"; }
.mb-root[data-phase="verifying"] .guide .arrow, .mb-root[data-phase="opening"] .guide .arrow { animation: none; }
.mb-root[data-phase="verifying"] .guide .arrow::before, .mb-root[data-phase="opening"] .guide .arrow::before {
  content: ""; width: 12px; height: 12px; border: 2px solid var(--ink); border-top-color: transparent; border-radius: 50%; animation: mb-rot 0.7s linear infinite;
}
.mb-root[data-phase="revealed"] .guide .arrow { animation: none; background: var(--mint); }
.mb-root[data-phase="revealed"] .guide .arrow::before { content: "\2713"; }
@keyframes mb-bob { 50% { transform: translateY(4px); } }
@keyframes mb-bobup { 50% { transform: translateY(-4px); } }
@keyframes mb-rot { to { transform: rotate(360deg); } }
.mb-root .guide-text { transition: opacity 0.25s, transform 0.25s; }
.mb-root .guide-text.swap { opacity: 0; transform: translateY(4px); }

/* Panel */
.mb-root .panel { background: var(--ink-2); border: 1px solid var(--line); border-radius: 20px; padding: 22px; display: flex; flex-direction: column; gap: 14px; }
.mb-root[data-phase="ready"] .panel, .mb-root[data-phase="verifying"] .panel,
.mb-root[data-phase="opening"] .panel, .mb-root[data-phase="revealed"] .panel { display: none; }
.mb-root .panel.sorry { text-align: center; }
.mb-root .panel.sorry strong { font-family: var(--font-display); font-size: 22px; }
.mb-root .panel.sorry p { margin: 0; color: var(--muted); }
.mb-root label { font-size: 13px; font-weight: 700; letter-spacing: 0.04em; color: var(--muted); }
.mb-root .field { display: flex; align-items: stretch; border: 2px solid var(--line); border-radius: 14px; background: var(--ink); overflow: hidden; transition: border-color 0.25s, box-shadow 0.25s; }
.mb-root .field:focus-within { border-color: var(--gold); box-shadow: 0 0 0 4px rgba(255, 200, 87, 0.18); }
.mb-root .field.invalid { border-color: var(--danger); animation: mb-nope 0.4s; }
@keyframes mb-nope { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.mb-root .cc { display: grid; place-items: center; padding: 0 14px; border-right: 1px solid var(--line); font-weight: 700; color: var(--gold); }
.mb-root .field input {
  all: unset; flex: 1; min-width: 0; padding: 15px 14px; font-size: 20px; letter-spacing: 0.06em; font-weight: 500; font-variant-numeric: tabular-nums; color: var(--cream);
}
.mb-root .field input::placeholder { color: rgba(183, 177, 208, 0.5); }
.mb-root .err { min-height: 20px; margin: -6px 0 0; font-size: 13px; color: var(--danger); }
.mb-root .btn {
  all: unset; box-sizing: border-box; cursor: pointer; text-align: center; padding: 15px 20px; border-radius: 14px; font-weight: 700; font-size: 16px;
  background: var(--gold); color: var(--ink); box-shadow: 0 5px 0 #c99a2c; transition: transform 0.12s, box-shadow 0.12s, opacity 0.2s;
}
.mb-root a.btn { display: block; text-decoration: none; }
.mb-root .btn:hover { transform: translateY(-1px); }
.mb-root .btn:active { transform: translateY(4px); box-shadow: 0 1px 0 #c99a2c; }
.mb-root .btn:focus-visible { outline: 3px solid var(--cream); outline-offset: 3px; }
.mb-root .btn[disabled] { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: 0 5px 0 #c99a2c; }
.mb-root .btn.ghost { background: transparent; color: var(--cream); box-shadow: none; border: 1px solid var(--line); padding: 12px 18px; font-size: 14px; }
.mb-root .fine { margin: 0; font-size: 12px; color: var(--muted); text-align: center; }

/* Result */
.mb-root .result { position: relative; display: flex; flex-direction: column; gap: 16px; align-items: stretch; }
.mb-root .stagger { animation: mb-rise 0.6s both; }
.mb-root .s2 { animation-delay: 1.5s; }
@keyframes mb-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.mb-root .winline { text-align: center; font-family: var(--font-display); font-weight: 800; font-size: 22px; animation: mb-rise 0.6s 1.1s both; }
.mb-root .winline small { display: block; font-family: var(--font-body); font-weight: 400; font-size: 14px; color: var(--muted); margin-top: 2px; }

.mb-root .mb-fx { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20; }

@media (prefers-reduced-motion: reduce) {
  .mb-root *, .mb-root *::before, .mb-root *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; animation-delay: 0s !important; }
  .mb-root .rays { display: none; }
}
@media (max-width: 380px) { .mb-root .stage { --box-top: 30px; height: 250px; }
  .mb-root[data-phase="revealed"] .stage { height: var(--rev-h); } .mb-root .panel { padding: 18px; } }
`;