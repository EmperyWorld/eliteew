import { Response, Router } from 'express'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import {
    getAllowedTypes,
    getConfigValue,
    getNamespace,
    invalidateConfig,
    setConfigValue,
} from '../services/config.js'

const router = Router()

// List by namespace (default: site)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const namespace = (req.query.namespace as string) || 'site'
  const data = await getNamespace(namespace)
  res.json({ namespace, items: data })
})

// Get single value
router.get('/:namespace/:key', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const namespace = Array.isArray(req.params.namespace) ? req.params.namespace[0] : req.params.namespace
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key
  const value = await getConfigValue(namespace, key, null)
  res.json({ namespace, key, value })
})

// Upsert value
router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { namespace, key, type, value, description } = req.body
    if (!namespace || !key || !type) {
      throw new AppError('namespace, key and type are required', 400)
    }
    if (!getAllowedTypes().includes(type)) {
      throw new AppError('Unsupported type', 400)
    }

    const updated = await setConfigValue({
      namespace,
      key,
      type,
      value,
      description,
      updatedBy: req.user?.email,
    })
    res.json({ success: true, item: updated })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(error instanceof Error ? error.message : 'Failed to update config', 400)
  } finally {
    if (req.body?.namespace && req.body?.key) {
      invalidateConfig(req.body.namespace, req.body.key)
    }
  }
})

export default router
