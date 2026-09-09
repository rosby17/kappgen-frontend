import { renderToString } from 'react-dom/server'
import LandingPage from './LandingPage.jsx'
import LegalPage from './LegalPage.jsx'
import ContactPage from './ContactPage.jsx'

const PAGES = {
  '/': {
    Component: LandingPage,
    title: 'KappGen — Tu vis. KappGen travaille.',
    description: 'Sors des écrans. KappGen trouve les idées, crée les vidéos et les publie sur YouTube pendant que tu vis, voyages ou dors.',
  },
  '/privacy': {
    Component: () => <LegalPage type="privacy" />,
    title: 'KappGen — Politique de confidentialité',
    description: "Comment KappGen collecte, utilise et protège vos données, y compris l'accès à votre compte YouTube.",
  },
  '/terms': {
    Component: () => <LegalPage type="terms" />,
    title: "KappGen — Conditions d'utilisation",
    description: "Les conditions d'utilisation du service KappGen.",
  },
  '/contact': {
    Component: ContactPage,
    title: 'Contacter KappGen — Support et partenariats',
    description: 'Contactez KappGen pour le support, les partenariats et les questions commerciales liées à la création vidéo YouTube avec IA.',
  },
}

export function render(path) {
  const page = PAGES[path]
  if (!page) return null
  const { Component, title, description } = page
  const html = renderToString(<Component />)
  return { html, title, description }
}
