import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(root, '..', 'dist')
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8')

const { render } = await import(path.join(root, '..', 'dist-ssr', 'entry-server.js'))

const routes = ['/', '/privacy', '/terms']

// dist/index.html is the SPA fallback vercel.json routes EVERY unmatched
// path to, on BOTH kappgen.com (marketing) and app.kappgen.com (the app) —
// so it must stay the plain, empty-#root shell. Baking the marketing
// homepage's HTML into it (as this used to do) made app.kappgen.com flash
// the landing page on every refresh before React replaced it. The
// prerendered homepage now goes to its own file (marketing-home.html) that
// vercel.json rewrites to explicitly, only for kappgen.com's "/".
for (const route of routes) {
  const result = render(route)
  if (!result) continue
  const { html, title, description } = result

  let page = template
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(/<meta name="description" content=".*?"\s*\/>/s, `<meta name="description" content="${description}" />`)
    .replace('<div id="root">', `<div id="root">${html}`)

  if (route === '/') {
    fs.writeFileSync(path.join(distDir, 'marketing-home.html'), page)
    console.log(`Prerendered ${route} -> marketing-home.html`)
    continue
  }
  const outDir = path.join(distDir, route)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'index.html'), page)
  console.log(`Prerendered ${route} -> ${path.relative(distDir, path.join(outDir, 'index.html'))}`)
}
