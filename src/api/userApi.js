// src/api/userApi.js

// Adjust this to match your actual backend base URL (and consider moving
// it into a .env file as VITE_API_BASE_URL for dev/prod switching).
const API_BASE_URL = 'https://dummypossetup.runasp.net'

async function handleResponse(response) {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data?.message || data?.title || 'Something went wrong. Please try again.'
    throw new Error(message)
  }

  return data
}

export async function sendLoginOtp(phoneNumber) {
  const response = await fetch(`${API_BASE_URL}/api/UserPage/SendLoginOtp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber }),
  })
  return handleResponse(response)
}

export async function verifyLoginOtp(phoneNumber, otpVal) {
  const response = await fetch(`${API_BASE_URL}/api/UserPage/VerifyLoginOtp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, otpVal }),
  })
  return handleResponse(response)
}

export async function getUserDashboard(customerId) {
  const response = await fetch(`${API_BASE_URL}/api/UserPage/GetUserDashboard?customerId=${customerId}`)
  return handleResponse(response)
}