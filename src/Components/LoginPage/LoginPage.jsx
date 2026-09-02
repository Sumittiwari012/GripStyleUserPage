import React, { useState } from 'react'
import { sendLoginOtp, verifyLoginOtp } from '../../api/userApi'
import './LoginPage.css'

function LoginPage({ onLoginSuccess }) {
  const [step, setStep] = useState('phone') // 'phone' | 'otp'
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(value)
    if (error) setError('')
  }

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4)
    setOtp(value)
    if (error) setError('')
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()

    if (!phone) {
      setError('Please enter your phone number.')
      return
    }
    if (phone.length !== 10) {
      setError('Enter a valid 10-digit phone number.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await sendLoginOtp(phone)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()

    if (!otp) {
      setError('Please enter the OTP.')
      return
    }
    if (otp.length !== 4) {
      setError('Enter the 4-digit OTP.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await verifyLoginOtp(phone, Number(otp))
      onLoginSuccess(result) // { customerId, customerName, mobileNumber, ... }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setError('')
    setLoading(true)
    try {
      await sendLoginOtp(phone)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChangeNumber = () => {
    setStep('phone')
    setOtp('')
    setError('')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/gripstyle-logo.png" alt="Logo" className="login-logo" />

        <h1>Welcome back</h1>
        <p className="subtitle">
          {step === 'phone'
            ? 'Enter your phone number to continue'
            : `Enter the OTP sent to +91 ${phone}`}
        </p>

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="login-form">
            <div className="phone-input-group">
              <span className="country-code">+91</span>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="98765 43210"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Sending OTP...' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="login-form">
            <div className="phone-input-group">
              <input
                id="otp"
                type="tel"
                inputMode="numeric"
                value={otp}
                onChange={handleOtpChange}
                placeholder="Enter 4-digit OTP"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>

            <div className="otp-actions">
              <button type="button" className="link-btn" onClick={handleChangeNumber} disabled={loading}>
                Change number
              </button>
              <button type="button" className="link-btn" onClick={handleResendOtp} disabled={loading}>
                Resend OTP
              </button>
            </div>
          </form>
        )}

        <p className="terms-text">
          By continuing, you agree to our <a href="#">Terms</a> & <a href="#">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}

export default LoginPage