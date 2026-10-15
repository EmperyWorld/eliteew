import { Request, Response, Router } from 'express'
import { prisma } from '../index.js'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.js'
import { asString } from '../utils/params.js'

const router = Router()

// Get gallery images
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = asString(req.query.category)

    const where: any = { isActive: true }
    if (category) where.category = category

    const images = await prisma.galleryImage.findMany({
      where,
      orderBy: { order: 'asc' }
    })

    res.json(images)
  } catch (error) {
    console.error('Fetch gallery error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch gallery' })
  }
})

// Add image (admin)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { url, alt, title, category, order } = req.body

    const image = await prisma.galleryImage.create({
      data: { url, alt, title, category, order }
    })

    res.status(201).json(image)
  } catch (error) {
    console.error('Add image error:', error)
    return res.status(500).json({ success: false, message: 'Failed to add image' })
  }
})

// Update image (admin)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)

    const image = await prisma.galleryImage.update({
      where: { id },
      data: req.body
    })

    res.json(image)
  } catch (error) {
    console.error('Update image error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update image' })
  }
})

// Delete image (admin)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)

    await prisma.galleryImage.delete({ where: { id } })

    res.json({ message: 'Image deleted' })
  } catch (error) {
    console.error('Delete image error:', error)
    return res.status(500).json({ success: false, message: 'Failed to delete image' })
  }
})

export default router
