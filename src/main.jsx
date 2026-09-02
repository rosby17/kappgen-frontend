import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'
import LegalPage from './LegalPage.jsx'
import ContactPage from './ContactPage.jsx'

// Self-hosted GlitchTip (Sentry-protocol-compatible) — no-ops entirely if
// unset, so this is safe in any environment (local dev included).
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    // Left at the SDK's default integrations — that's what installs the
    // window.onerror/unhandledrejection listeners that make uncaught errors
    // report automatically. Only tracing (an APM concern, not error
    // tracking) is turned off below; passing integrations: [] here instead
    // would silently disable automatic capture entirely, leaving only
    // explicit Sentry.captureException() calls working (confirmed live —
    // that's exactly what shipped in the very first version of this).
    tracesSampleRate: 0,
  })
}

const hostname = window.location.hostname.toLowerCase()
const isAppHostname = hostname === 'app.kappgen.com' || hostname.startsWith('app.')
const isLocalAppPath = ['localhost', '127.0.0.1'].includes(hostname) && window.location.pathname.startsWith('/app')
const appSurface = isAppHostname || isLocalAppPath

// /privacy and /terms are marketing-site pages (real KappGen branding), not
// part of the app surface — checked before appSurface so they render on the
// marketing domain even though the app also has its own routing elsewhere.
const path = window.location.pathname.replace(/\/+$/, '') || '/'
const legalType = !appSurface && path === '/privacy' ? 'privacy' : !appSurface && path === '/terms' ? 'terms' : null
const isContactPage = !appSurface && path === '/contact'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="min-h-screen bg-[#131313] text-white flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
          <span className="material-symbols-outlined text-4xl text-amber-400">error</span>
          <h1 className="mt-3 text-xl font-bold">Cette page a rencontré un problème</h1>
          <p className="mt-2 text-sm text-slate-400">Recharge la page pour reprendre là où tu en étais.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-[#00c2ff] px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-[#59d8ff]"
          >
            Recharger la page
          </button>
        </section>
      </main>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter basename={isLocalAppPath ? '/app' : undefined}>
        {legalType ? <LegalPage type={legalType} /> : isContactPage ? <ContactPage /> : appSurface ? <App /> : <LandingPage />}
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
)
