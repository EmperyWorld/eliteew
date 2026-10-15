import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const app = '/app'
const uploads = path.join(app, 'uploads')
const bootstrap = path.join(app, 'bootstrap-uploads')
const node = process.execPath

const require = createRequire(import.meta.url)

function resolveCli(pkgName, subpath) {
  const pkgJson = require.resolve(`${pkgName}/package.json`)
  return path.join(path.dirname(pkgJson), subpath)
}

function mergeBootstrapUploads() {
  if (!fs.existsSync(bootstrap)) return
  fs.mkdirSync(uploads, { recursive: true })

  function walk(rel = '') {
    const abs = path.join(bootstrap, rel)
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = path.join(rel, ent.name)
      const from = path.join(bootstrap, r)
      const to = path.join(uploads, r)
      if (ent.isDirectory()) {
        fs.mkdirSync(to, { recursive: true })
        walk(r)
      } else if (!fs.existsSync(to)) {
        fs.mkdirSync(path.dirname(to), { recursive: true })
        fs.copyFileSync(from, to)
      }
    }
  }

  walk()
}

function runSync(args) {
  const r = spawn(node, args, { cwd: app, stdio: 'inherit' })
  return new Promise((resolve, reject) => {
    r.on('error', reject)
    r.on('close', (code, signal) => {
      if (signal) reject(new Error(`signal ${signal}`))
      else if (code !== 0) reject(new Error(`exit ${code}`))
      else resolve()
    })
  })
}

mergeBootstrapUploads()

const prismaCli = resolveCli('prisma', 'build/index.js')
const dbSchemaStrategy = (process.env.SITE_STUDIO_DB_SCHEMA_STRATEGY || 'db-push')
  .trim()
  .toLowerCase()

if (dbSchemaStrategy === 'migrate-deploy') {
  await runSync([prismaCli, 'migrate', 'deploy'])
} else if (dbSchemaStrategy === 'db-push') {
  await runSync([prismaCli, 'db', 'push'])
} else {
  throw new Error(
    `Unsupported SITE_STUDIO_DB_SCHEMA_STRATEGY="${dbSchemaStrategy}". Use db-push or migrate-deploy.`
  )
}

const seeded = path.join(uploads, '.seeded')
if (!fs.existsSync(seeded)) {
  const tsxCli = resolveCli('tsx', 'dist/cli.mjs')
  await runSync([tsxCli, 'prisma/seed.template.ts'])
  fs.writeFileSync(seeded, `${new Date().toISOString()}\n`)
}

const child = spawn(node, [path.join(app, 'dist/index.js')], {
  cwd: app,
  stdio: 'inherit',
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
