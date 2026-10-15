import { Request, Response, Router } from 'express'
import { getSiteSettings } from '../services/siteSettings.js'

const router = Router()

// Get site settings (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await getSiteSettings()
    res.json(settings)
  } catch (error) {
    console.error('Settings error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch settings' })
  }
})

export default router
