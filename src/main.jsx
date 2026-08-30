import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'
import LegalPage from './LegalPage.jsx'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={isLocalAppPath ? '/app' : undefined}>
      {legalType ? <LegalPage type={legalType} /> : appSurface ? <App /> : <LandingPage />}
    </BrowserRouter>
  </StrictMode>,
)
