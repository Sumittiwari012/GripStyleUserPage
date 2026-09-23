import { useState, useRef, useEffect } from "react";
import {
  Phone,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const SESSION_STORAGE_KEY = "gripstyle_supplier_session";

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // Storage unavailable or corrupted - treat as "not logged in".
    return null;
  }
}

function saveStoredSession(session) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore - worst case the supplier just has to log in again next time.
  }
}

/**
 * Clears the persisted supplier session. Call this from your logout action
 * (e.g. a "Log out" button on the supplier's own page).
 */
export function clearSupplierSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Supplier login page - two steps:
 *   1) Enter mobile number -> checked against suppliers, OTP sent via WhatsApp.
 *   2) Enter the OTP -> verified, then onLoginSuccess hands off to your app
 *      (e.g. navigate to the supplier dashboard route).
 *
 * Wire these up to your real API:
 *
 *   onRequestOtp(mobileNumber) -> Promise
 *     Look up the supplier by mobile number and trigger the WhatsApp OTP send.
 *     Reject with an Error (e.g. "No supplier found for this number.") if
 *     there's no match - the message is shown on the phone-number step.
 *
 *   onVerifyOtp(mobileNumber, otp) -> Promise<supplierSession>
 *     Validate the code. Reject with an Error for a wrong/expired code.
 *     Resolve with whatever session/supplier data your app needs.
 *
 *   onLoginSuccess(supplierSession)
 *     Called once OTP verification succeeds. Typically navigates to the
 *     supplier's own page (e.g. navigate("/supplier/dashboard")).
 */
export default function SupplierLoginPage({ onRequestOtp, onVerifyOtp, onLoginSuccess }) {
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [mobileNumber, setMobileNumber] = useState("");
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);

  const otpRefs = useRef([]);

  // Runs once on mount: if a session was saved from a previous visit, skip
  // the login form entirely and hand straight off to onLoginSuccess so the
  // supplier stays signed in even after closing the tab / browser.
  useEffect(() => {
    const stored = loadStoredSession();
    if (stored) {
      onLoginSuccess?.(stored);
    }
    setCheckingSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const requestOtp = async (mode) => {
    setError("");

    const digitsOnly = mobileNumber.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onRequestOtp) {
        await onRequestOtp(digitsOnly);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      if (mode === "initial") {
        setOtpDigits(Array(OTP_LENGTH).fill(""));
        setStep("otp");
        setTimeout(() => otpRefs.current[0]?.focus(), 0);
      }
    } catch (err) {
      setError(
        err?.message ||
          "We couldn't find a supplier with that number. Check it and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    requestOtp("initial");
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    otpRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const code = otpDigits.join("");
    if (code.length < OTP_LENGTH) {
      setError("Enter the full 6-digit code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const digitsOnly = mobileNumber.replace(/\D/g, "");
      const session = onVerifyOtp
        ? await onVerifyOtp(digitsOnly, code)
        : await new Promise((resolve) => setTimeout(() => resolve({ mobileNumber: digitsOnly }), 900));
      saveStoredSession(session);
      onLoginSuccess?.(session);
    } catch (err) {
      setError(err?.message || "That code didn't match. Check it and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const editNumber = () => {
    setStep("phone");
    setError("");
    setCooldown(0);
  };

  if (checkingSession) {
    // Synchronous localStorage read, so this resolves almost instantly -
    // this just avoids a one-frame flash of the login form for a supplier
    // who's already signed in.
    return <div className="min-h-screen w-full bg-[#F3EFE6]" />;
  }

  return (
    <div className="min-h-screen w-full bg-[#F3EFE6] flex items-stretch">
      {/* Left panel - brand / context */}
      <div className="hidden lg:flex lg:w-[42%] bg-[#1B2430] text-[#F3EFE6] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none [background-image:repeating-linear-gradient(135deg,#F3EFE6_0px,#F3EFE6_1px,transparent_1px,transparent_18px)]" />

        <div className="relative flex items-center">
          <img
            src="/gripstyle-logo.png"
            alt="GripStyle Supply"
            className="h-32 w-auto brightness-0 invert"
          />
        </div>

        <div className="relative max-w-sm">
          <p className="font-serif text-[2.1rem] leading-[1.25] text-[#F3EFE6]">
            Every consignment,
            <br />
            traced back to its supplier.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-[#B9C0C9]">
            Sign in to see how your products are selling, what's running low, and when you'll be reordered.
          </p>
        </div>

        <div className="relative flex items-center gap-6 text-xs text-[#8D97A3] font-mono">
          <span>ACCOUNT&nbsp;ACCESS</span>
          <span className="w-8 h-px bg-[#3A4553]" />
          <span>PORTAL&nbsp;v2</span>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center mb-10">
            <img src="/gripstyle-logo.png" alt="GripStyle Supply" className="h-10 w-auto" />
          </div>

          {step === "phone" ? (
            <>
              <h1 className="text-2xl font-medium text-[#1B2430] tracking-tight">
                Supplier sign-in
              </h1>
              <p className="mt-2 text-sm text-[#5B6472]">
                Enter your registered mobile number. We'll send a one-time
                code to it on WhatsApp.
              </p>

              <form onSubmit={handlePhoneSubmit} className="mt-8 space-y-5" noValidate>
                <div>
                  <label
                    htmlFor="mobileNumber"
                    className="block text-xs font-medium text-[#5B6472] mb-1.5"
                  >
                    Mobile number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#A9A196] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="mobileNumber"
                      name="mobileNumber"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      placeholder="98765 43210"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full rounded-md border border-[#D8D2C2] bg-white pl-10 pr-3.5 py-2.5 text-[#1B2430] placeholder-[#A9A196] focus:outline-none focus:ring-2 focus:ring-[#D98E2B] focus:border-[#D98E2B] transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-md border border-[#E3B7A0] bg-[#FBEEE6] px-3.5 py-2.5 text-sm text-[#8A3B1E]"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1B2430] px-4 py-2.5 text-sm font-medium text-[#F3EFE6] hover:bg-[#262F3D] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking number...
                    </>
                  ) : (
                    <>
                      Send code on WhatsApp
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={editNumber}
                className="inline-flex items-center gap-1.5 text-xs text-[#5B6472] hover:text-[#1B2430] transition-colors mb-6"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Change number
              </button>

              <div className="w-9 h-9 rounded-sm bg-[#25D366]/15 flex items-center justify-center mb-4">
                <MessageCircle className="w-5 h-5 text-[#1B8A4C]" strokeWidth={2.25} />
              </div>

              <h1 className="text-2xl font-medium text-[#1B2430] tracking-tight">
                Enter the code
              </h1>
              <p className="mt-2 text-sm text-[#5B6472]">
                We've sent a 6-digit code via WhatsApp to{" "}
                <span className="font-medium text-[#1B2430]">
                  {mobileNumber}
                </span>
                .
              </p>

              <form onSubmit={handleOtpSubmit} className="mt-8 space-y-5" noValidate>
                <div>
                  <label className="block text-xs font-medium text-[#5B6472] mb-1.5">
                    One-time code
                  </label>
                  <div className="flex gap-2" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-full aspect-square rounded-md border border-[#D8D2C2] bg-white text-center text-lg font-medium text-[#1B2430] focus:outline-none focus:ring-2 focus:ring-[#D98E2B] focus:border-[#D98E2B] transition-colors"
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-md border border-[#E3B7A0] bg-[#FBEEE6] px-3.5 py-2.5 text-sm text-[#8A3B1E]"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1B2430] px-4 py-2.5 text-sm font-medium text-[#F3EFE6] hover:bg-[#262F3D] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify and sign in
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-[#8D8577]">
                  {cooldown > 0 ? (
                    <>Resend code in {cooldown}s</>
                  ) : (
                    <>
                      Didn't get it?{" "}
                      <button
                        type="button"
                        onClick={() => requestOtp("resend")}
                        className="text-[#8A5A1E] hover:text-[#1B2430] font-medium transition-colors"
                      >
                        Resend code
                      </button>
                    </>
                  )}
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}