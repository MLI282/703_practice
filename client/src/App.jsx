import { useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import './App.css'

const API_BASE = 'http://localhost:3001'
const AUTH_STORAGE_KEY = 'agent_search_auth'
const DEFAULT_LOCATION = {
  lat: -36.8485,
  lng: 174.7633,
}

function readStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || null
  } catch {
    return null
  }
}

function saveStoredAuth(auth) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

async function fetchWithAuth(path, auth, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${auth.token}`,
    },
  })
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json()
    : { error: await response.text() }

  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }

  return data
}

function getImage(item) {
  return (
    item.photo_url ||
    item.product_image ||
    item.store_photo ||
    item.imageUrl ||
    item.photoUrl ||
    item.productImage ||
    item.storePhoto ||
    ''
  )
}

function getTitle(item) {
  return item.name || item.product_title || item.nearby_store || item.title || 'Untitled result'
}

function getDescription(item) {
  return item.address || item.store_address || item.source || ''
}

function getRating(item) {
  return item.rating ?? item.store_rating ?? null
}

function ResultCard({ item }) {
  const image = getImage(item)
  const title = getTitle(item)
  const description = getDescription(item)
  const rating = getRating(item)
  const isProduct = Boolean(item.product_title || item.type === 'product')
  const rank = item.compare_rank ?? item.rank ?? '-'
  const bestFor = item.best_for || item.bestFor
  const reason = item.compare_reason || item.reason
  const price = item.product_price || item.price
  const distanceText = item.distance_text || item.distanceText
  const durationText = item.duration_text || item.durationText

  return (
    <article className="result-card">
      <div className="image-frame">
        {image ? (
          <img src={image} alt={title} />
        ) : (
          <div className="image-fallback">No image</div>
        )}
        <span className="rank">#{rank}</span>
      </div>

      <div className="card-body">
        <div className="type-label">{isProduct ? 'Product' : 'Place'}</div>
        <h2>{title}</h2>

        {description && <p className="description">{description}</p>}

        {isProduct && price && (
          <div className="price">{price}</div>
        )}

        <div className="facts">
          {rating && <span>Rating {rating}</span>}
          {distanceText && <span>{distanceText}</span>}
          {durationText && <span>{durationText}</span>}
          {bestFor && <span>{bestFor}</span>}
        </div>

        {reason && <p className="reason">{reason}</p>}

        <div className="actions">
          {item.product_link && (
            <a href={item.product_link} target="_blank" rel="noreferrer">
              View product
            </a>
          )}

          {!item.product_link && item.location && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Maps
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

function AuthPage({ auth, mode, onAuthenticated }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isRegister = mode === 'register'
  const redirectTo = location.state?.from?.pathname || '/'

  const submitAuth = async (event) => {
    event.preventDefault()
    setError('')

    try {
      setLoading(true)

      const response = await fetch(
        `${API_BASE}/auth/${isRegister ? 'register' : 'login'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            email,
            password,
          }),
        },
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      saveStoredAuth(data)
      onAuthenticated(data)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  if (auth?.token) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-copy">
          <p className="eyebrow">Agent Search Account</p>
          <h1>{isRegister ? 'Create your search account.' : 'Welcome back.'}</h1>
          <p className="intro">
            Sign in to keep your profile ready for search history, preferences,
            and future saved recommendations.
          </p>
        </div>

        <form className="auth-form" onSubmit={submitAuth}>
          {isRegister && (
            <label>
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={2}
                maxLength={50}
                autoComplete="username"
                required
              />
            </label>
          )}

          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <Link className="text-button" to={isRegister ? '/login' : '/register'}>
          {isRegister ? 'Already have an account? Sign in' : 'Need an account? Create one'}
        </Link>
      </section>
    </main>
  )
}

function ProtectedRoute({ auth, children }) {
  const location = useLocation()

  if (!auth?.token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

function SearchPage({ auth, onLogout }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [locationStatus, setLocationStatus] = useState('Using Auckland fallback')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationStatus('Using your current location')
      },
      () => {
        setLocationStatus('Using Auckland fallback')
      },
    )
  }, [])

  const recommendation = useMemo(() => {
    return results.find((item) => item.agent_recommendation)
      ?.agent_recommendation
  }, [results])

  const searchAgent = async (event) => {
    event.preventDefault()

    if (!query.trim()) {
      setResults([])
      setError('')
      return
    }

    try {
      setLoading(true)
      setError('')

      const data = await fetchWithAuth(
        `/agent-search?q=${encodeURIComponent(query)}&lat=${
          location.lat
        }&lng=${location.lng}`,
        auth,
      )

      setResults(Array.isArray(data) ? data : [])
    } catch (err) {
      setResults([])
      setError(err.message || 'Agent search failed')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    clearStoredAuth()
    onLogout()
    setResults([])
    setError('')
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <span className="session-label">Signed in as</span>
          <strong>{auth.user?.username || auth.user?.email}</strong>
        </div>
        <nav className="top-actions">
          <Link to="/history">History</Link>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </nav>
      </header>

      <section className="search-panel">
        <div className="copy">
          <p className="eyebrow">LangGraph Agent Interface</p>
          <h1>Compare places and products from one agent search.</h1>
          <p className="intro">
            This client only calls the current workflow endpoint and displays
            the returned images, key details, ranking, and recommendation.
          </p>
        </div>

        <form className="search-form" onSubmit={searchAgent}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: compare nearby cheap cafes, or buy a laptop under 1500 NZD"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Comparing' : 'Search'}
          </button>
        </form>

        <div className="meta-row">
          <span>{locationStatus}</span>
          <span>
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      {recommendation && (
        <section className="recommendation">
          <p className="eyebrow">Workflow recommendation</p>
          <p>{recommendation}</p>
        </section>
      )}

      <section className="results-grid" aria-live="polite">
        {!loading &&
          results.map((item, index) => (
            <ResultCard key={`${getTitle(item)}-${index}`} item={item} />
          ))}

        {!loading && results.length === 0 && !error && (
          <div className="empty-state">
            <h2>Ready when you are.</h2>
            <p>Run an agent search to see compared results with images.</p>
          </div>
        )}

        {loading && (
          <div className="empty-state">
            <h2>Working through the workflow.</h2>
            <p>Analyzing your input, fetching live results, then comparing.</p>
          </div>
        )}
      </section>
    </main>
  )
}

function formatDateTime(value) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function HistoryListPage({ auth }) {
  const [histories, setHistories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    fetchWithAuth('/history?limit=50', auth)
      .then((data) => {
        if (isMounted) {
          setHistories(Array.isArray(data) ? data : [])
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load history')
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [auth])

  return (
    <main className="app-shell">
      <section className="history-header">
        <div>
          <p className="eyebrow">Search history</p>
          <h1>Your saved agent searches.</h1>
        </div>
        <Link className="secondary-link" to="/">
          Back to search
        </Link>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="history-list" aria-live="polite">
        {loading && (
          <div className="empty-state">
            <h2>Loading history.</h2>
            <p>Fetching your saved agent search snapshots.</p>
          </div>
        )}

        {!loading && histories.length === 0 && !error && (
          <div className="empty-state">
            <h2>No history yet.</h2>
            <p>Run an agent search and it will appear here.</p>
          </div>
        )}

        {!loading &&
          histories.map((history) => (
            <Link
              className="history-item"
              key={history._id}
              to={`/history/${history._id}`}
            >
              <div>
                <span className="history-date">
                  {formatDateTime(history.createdAt)}
                </span>
                <h2>{history.query}</h2>
                {history.resultSummary && <p>{history.resultSummary}</p>}
              </div>
              <span className="history-count">
                {history.requestMeta?.resultCount ?? history.results?.length ?? 0} results
              </span>
            </Link>
          ))}
      </section>
    </main>
  )
}

function HistoryDetailPage({ auth }) {
  const { id } = useParams()
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    fetchWithAuth(`/history/${id}`, auth)
      .then((data) => {
        if (isMounted) {
          setHistory(data)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load history')
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [auth, id])

  return (
    <main className="app-shell">
      <section className="history-header">
        <div>
          <p className="eyebrow">History snapshot</p>
          <h1>{history?.query || 'Search result'}</h1>
          {history?.createdAt && (
            <p className="intro">{formatDateTime(history.createdAt)}</p>
          )}
        </div>
        <Link className="secondary-link" to="/history">
          Back to history
        </Link>
      </section>

      {error && <div className="error-box">{error}</div>}

      {loading && (
        <div className="empty-state">
          <h2>Loading snapshot.</h2>
          <p>Opening the saved result from your history.</p>
        </div>
      )}

      {!loading && history?.resultSummary && (
        <section className="recommendation">
          <p className="eyebrow">Saved recommendation</p>
          <p>{history.resultSummary}</p>
        </section>
      )}

      {!loading && history && (
        <section className="results-grid" aria-live="polite">
          {history.results?.map((item, index) => (
            <ResultCard key={`${getTitle(item)}-${index}`} item={item} />
          ))}
        </section>
      )}
    </main>
  )
}

function AppRoutes() {
  const [auth, setAuth] = useState(() => readStoredAuth())

  const logout = () => {
    clearStoredAuth()
    setAuth(null)
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AuthPage auth={auth} mode="login" onAuthenticated={setAuth} />
        }
      />
      <Route
        path="/register"
        element={
          <AuthPage auth={auth} mode="register" onAuthenticated={setAuth} />
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute auth={auth}>
            <SearchPage auth={auth} onLogout={logout} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute auth={auth}>
            <HistoryListPage auth={auth} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history/:id"
        element={
          <ProtectedRoute auth={auth}>
            <HistoryDetailPage auth={auth} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
