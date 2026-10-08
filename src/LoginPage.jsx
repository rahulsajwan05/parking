import { useState } from 'react'

function LoginPage({ onLogin }) {
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = formData.get('email').trim()
    setError('')
    setIsSubmitting(true)

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'
      const response = await fetch(`${apiBaseUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      if (!response.ok) {
        const detail = Array.isArray(result.detail) ? result.detail[0]?.msg : result.detail
        throw new Error(detail || result.error || 'Unable to save your email.')
      }
      onLogin(result.email)
    } catch (submitError) {
      setError(submitError.message || 'Unable to reach the login service. Make sure the Python API is running.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="welcome-card" aria-labelledby="welcome-title">
      <div className="eyebrow"><span className="live-dot" /> PARKING, MADE SIMPLE</div>
      <h1 id="welcome-title">A better place<br />to <span>park.</span></h1>
      <p className="intro">Enter your email to view today’s parking availability.</p>
      <form onSubmit={handleSubmit} className="email-form">
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
        {error && <p className="error-message" role="alert">{error}</p>}
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : <>Continue <span aria-hidden="true">→</span></>}</button>
      </form>
      <p className="privacy-note">Your parking dashboard is one step away.</p>
    </section>
  )
}

export default LoginPage
