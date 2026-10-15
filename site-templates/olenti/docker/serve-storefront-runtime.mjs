/**
 * Публичная витрина без зависимостей: только Node (без express/npm в рантайм-образе).
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')
const indexFile = path.join(distDir, 'index.html')
const host = process.env.HOST || '0.0.0.0'
const port = Number(process.env.PORT || 4173)
const sharedUploads = path.resolve(process.env.SHARED_UPLOADS_DIR || '/app/shared-uploads')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
}

if (!fs.existsSync(indexFile)) {
  console.error(`Public build is missing: ${indexFile}`)
  process.exit(1)
}

function safeUploadPath(urlPath) {
  const rel = path.normalize(decodeURIComponent(urlPath.replace(/^\/uploads\/?/, ''))).replace(/^(\.\.(\/|\\|$))+/, '')
  const resolved = path.resolve(path.join(sharedUploads, rel))
  if (!resolved.startsWith(sharedUploads + path.sep) && resolved !== sharedUploads) return null
  return resolved
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
  const stream = fs.createReadStream(filePath)
  stream.on('error', () => {
    res.statusCode = 404
    res.end()
  })
  stream.pipe(res)
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400
    res.end()
    return
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Not Found')
    return
  }

  if (url.pathname.startsWith('/uploads/')) {
    if (!fs.existsSync(sharedUploads)) {
      res.statusCode = 404
      res.end()
      return
    }
    const filePath = safeUploadPath(url.pathname)
    if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath)
    } else {
      res.statusCode = 404
      res.end()
    }
    return
  }

  let rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
  rel = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '')
  const staticPath = path.join(distDir, rel)

  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    sendFile(res, staticPath)
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  fs.createReadStream(indexFile).pipe(res)
})

server.listen(port, host, () => {
  console.log(`Public storefront (node http) listening on http://${host}:${port}`)
})
