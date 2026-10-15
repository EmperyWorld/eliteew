/**
 * Narrow selftest for catalog publish activation guard (run: npx tsx src/utils/catalogPublishGuard.selftest.ts).
 */
import { validateCatalogPublishActivation } from './catalogPublishGuard.js'

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg)
}

assert(
  validateCatalogPublishActivation({}, { isActive: false }) === null,
  'inactive ok'
)
assert(
  validateCatalogPublishActivation(
    { title: 'A', price: 100, duration: '60 мин' },
    { isActive: true }
  ) === null,
  'complete activate ok'
)
const err = validateCatalogPublishActivation(
  { title: '', price: 0, duration: '' },
  { isActive: true }
)
assert(typeof err === 'string' && err.includes('title'), 'missing fields reject')
assert(
  validateCatalogPublishActivation(
    { title: 'A', price: 10, duration: '1h', isActive: true },
    { title: '  ' }
  )?.includes('title'),
  'patch clearing title while active rejects'
)

console.log('catalogPublishGuard.selftest: ok')
