import { Response, Router } from 'express'
import { prisma } from '../index.js'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { asString } from '../utils/params.js'

const router = Router()

// List all feature flags
router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  const flags = await prisma.featureFlag.findMany({
    orderBy: [{ key: 'asc' }],
  })
  res.json(flags)
})

// Upsert flags (bulk)
router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const items: Array<{
      key: string
      isEnabled?: boolean
      scope?: string
      rollout?: number | null
      description?: string
    }> = req.body?.items || []

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('items array required', 400)
    }

    const results = []
    for (const item of items) {
      const { key, isEnabled = false, scope, rollout, description } = item
      if (!key) throw new AppError('key is required for each flag', 400)

      const saved = await prisma.featureFlag.upsert({
        where: { key },
        update: {
          isEnabled,
          scope,
          rollout: rollout ?? null,
          description,
          updatedBy: req.user?.email,
        },
        create: {
          key,
          isEnabled,
          scope,
          rollout: rollout ?? null,
          description,
          updatedBy: req.user?.email,
        },
      })
      results.push(saved)
    }

    res.json({ success: true, items: results })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Failed to upsert feature flags', 400)
  }
})

// Patch single flag
router.patch('/:key', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const key = asString(req.params.key)
  const { isEnabled, scope, rollout, description } = req.body

  if (!key) throw new AppError('key is required', 400)

  const updated = await prisma.featureFlag.upsert({
    where: { key },
    update: {
      isEnabled: typeof isEnabled === 'boolean' ? isEnabled : undefined,
      scope,
      rollout: rollout ?? undefined,
      description,
      updatedBy: req.user?.email,
    },
    create: {
      key,
      isEnabled: typeof isEnabled === 'boolean' ? isEnabled : false,
      scope,
      rollout: rollout ?? null,
      description,
      updatedBy: req.user?.email,
    },
  })

  res.json(updated)
})

export default router
