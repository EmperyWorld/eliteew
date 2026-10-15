import { Response, Router } from 'express'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.js'
import { getSiteSettings, saveSiteSettings } from '../services/siteSettings.js'

const router = Router()

router.get('/', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getSiteSettings()
    res.json(settings)
  } catch (error) {
    console.error('Admin site settings fetch error:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch site settings' })
  }
})

router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await saveSiteSettings(req.body ?? {}, req.user?.email)
    res.json(settings)
  } catch (error) {
    console.error('Admin site settings update error:', error)
    res.status(500).json({ success: false, message: 'Failed to update site settings' })
  }
})

router.patch('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const settings = await saveSiteSettings(req.body ?? {}, req.user?.email)
    res.json(settings)
  } catch (error) {
    console.error('Admin site settings patch error:', error)
    res.status(500).json({ success: false, message: 'Failed to update site settings' })
  }
})

export default router
