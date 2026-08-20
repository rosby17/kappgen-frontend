import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'

const hostname = window.location.hostname.toLowerCase()
const isAppHostname = hostname === 'appnichecut.tools-cl.com' || hostname.startsWith('app.')
const isLocalAppPath = ['localhost', '127.0.0.1'].includes(hostname) && window.location.pathname.startsWith('/app')
const appSurface = isAppHostname || isLocalAppPath

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={isLocalAppPath ? '/app' : undefined}>
      {appSurface ? <App /> : <LandingPage />}
    </BrowserRouter>
  </StrictMode>,
)
