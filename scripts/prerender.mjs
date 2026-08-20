import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(root, '..', 'dist')
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8')

const { render } = await import(path.join(root, '..', 'dist-ssr', 'entry-server.js'))

const routes = ['/', '/privacy', '/terms']

for (const route of routes) {
  const result = render(route)
  if (!result) continue
  const { html, title, description } = result

  let page = template
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(/<meta name="description" content=".*?"\s*\/>/s, `<meta name="description" content="${description}" />`)
    .replace('<div id="root">', `<div id="root">${html}`)

  const outDir = route === '/' ? distDir : path.join(distDir, route)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'index.html'), page)
  console.log(`Prerendered ${route} -> ${path.relative(distDir, path.join(outDir, 'index.html'))}`)
}
