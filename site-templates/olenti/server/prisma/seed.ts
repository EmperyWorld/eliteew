console.warn('seed.ts is deprecated. Running canonical seed.template.ts instead.')

import('./seed.template.ts').catch((error) => {
  console.error('❌ Failed to run seed.template.ts via seed.ts wrapper:', error)
  process.exit(1)
})
