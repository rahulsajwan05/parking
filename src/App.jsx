import { useEffect, useState } from 'react'
import LoginPage from './LoginPage.jsx'
import ParkingDashboard from './ParkingDashboard.jsx'

const USER_EMAIL_KEY = 'parkside-user-email'

function App() {
  const [email, setEmail] = useState(() => localStorage.getItem(USER_EMAIL_KEY) || '')
  const isLoggedIn = Boolean(email)

  useEffect(() => {
    function syncLoginAcrossTabs(event) {
      if (event.key === USER_EMAIL_KEY || event.key === null) {
        setEmail(localStorage.getItem(USER_EMAIL_KEY) || '')
      }
    }

    window.addEventListener('storage', syncLoginAcrossTabs)
    return () => window.removeEventListener('storage', syncLoginAcrossTabs)
  }, [])

  function handleLogin(enteredEmail) {
    localStorage.setItem(USER_EMAIL_KEY, enteredEmail)
    setEmail(enteredEmail)
  }

  function handleLogout() {
    localStorage.removeItem(USER_EMAIL_KEY)
    setEmail('')
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Parkside home">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>Parkside</span>
        </a>
        {isLoggedIn && <span className="user-email">{email}</span>}
      </header>

      {isLoggedIn ? (
        <ParkingDashboard email={email} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}

      <footer>© 2026 Parkside <span>·</span> Find your space.</footer>
    </main>
  )
}

export default App
