import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:3001'
const DEFAULT_LOCATION = {
  lat: -36.8485,
  lng: 174.7633,
}

function getImage(item) {
  return item.photo_url || item.product_image || item.store_photo || ''
}

function getTitle(item) {
  return item.name || item.product_title || item.nearby_store || 'Untitled result'
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
  const isProduct = Boolean(item.product_title)

  return (
    <article className="result-card">
      <div className="image-frame">
        {image ? (
          <img src={image} alt={title} />
        ) : (
          <div className="image-fallback">No image</div>
        )}
        <span className="rank">#{item.compare_rank ?? '-'}</span>
      </div>

      <div className="card-body">
        <div className="type-label">{isProduct ? 'Product' : 'Place'}</div>
        <h2>{title}</h2>

        {description && <p className="description">{description}</p>}

        {isProduct && item.product_price && (
          <div className="price">{item.product_price}</div>
        )}

        <div className="facts">
          {rating && <span>Rating {rating}</span>}
          {item.distance_text && <span>{item.distance_text}</span>}
          {item.duration_text && <span>{item.duration_text}</span>}
          {item.best_for && <span>{item.best_for}</span>}
        </div>

        {item.compare_reason && (
          <p className="reason">{item.compare_reason}</p>
        )}

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

function App() {
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

      const response = await fetch(
        `${API_BASE}/agent-search?q=${encodeURIComponent(query)}&lat=${
          location.lat
        }&lng=${location.lng}`,
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Agent search failed')
      }

      setResults(Array.isArray(data) ? data : [])
    } catch (err) {
      setResults([])
      setError(err.message || 'Agent search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
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

export default App
