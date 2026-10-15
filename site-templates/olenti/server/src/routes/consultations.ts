import { Request, Response, Router } from 'express'
import { prisma } from '../index.js'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.js'
import { asString } from '../utils/params.js'
import { validateCatalogPublishActivation } from '../utils/catalogPublishGuard.js'

const router = Router()

// Get all consultations
router.get('/', async (req: Request, res: Response) => {
  try {
    const consultations = await prisma.consultation.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    })

    res.json(consultations)
  } catch (error) {
    console.error('Fetch consultations error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch consultations' })
  }
})

// Get single consultation
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const slug = asString(req.params.slug)

    const consultation = await prisma.consultation.findFirst({
      where: {
        OR: [
          { id: slug },
          { slug }
        ]
      }
    })

    if (!consultation) {
      return res.status(404).json({ success: false, message: 'Consultation not found' })
    }

    res.json(consultation)
  } catch (error) {
    console.error('Fetch consultation error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch consultation' })
  }
})

// Create consultation (admin)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      slug: bodySlug,
      shortDescription,
      description,
      fullDescription,
      price,
      duration,
      image,
      isPopular,
      isActive,
      order,
    } = req.body

    const slug = bodySlug || title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-|-$/g, '')

    const publishError = validateCatalogPublishActivation(
      {},
      {
        title,
        price,
        duration,
        shortDescription,
        fullDescription: fullDescription ?? description,
        isActive: isActive ?? true,
      }
    )
    if (publishError) {
      return res.status(422).json({ success: false, message: publishError })
    }

    const consultation = await prisma.consultation.create({
      data: {
        title,
        slug,
        shortDescription,
        fullDescription: fullDescription ?? description,
        price,
        duration,
        image,
        isPopular: Boolean(isPopular),
        isActive: isActive ?? true,
        order: order ?? 0,
      }
    })

    res.status(201).json(consultation)
  } catch (error) {
    console.error('Create consultation error:', error)
    return res.status(500).json({ success: false, message: 'Failed to create consultation' })
  }
})

// Update consultation (admin)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)
    const {
      title,
      slug: bodySlug,
      shortDescription,
      description,
      fullDescription,
      price,
      duration,
      image,
      isPopular,
      isActive,
      order,
    } = req.body

    const existing = await prisma.consultation.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Consultation not found' })
    }

    const publishError = validateCatalogPublishActivation(existing, {
      title,
      price,
      duration,
      shortDescription,
      fullDescription: fullDescription ?? description,
      isActive,
    })
    if (publishError) {
      return res.status(422).json({ success: false, message: publishError })
    }

    const data: Record<string, unknown> = {}

    if (title !== undefined) data.title = title
    if (bodySlug !== undefined) data.slug = bodySlug
    if (shortDescription !== undefined) data.shortDescription = shortDescription
    if (description !== undefined || fullDescription !== undefined) {
      data.fullDescription = fullDescription ?? description
    }
    if (price !== undefined) data.price = price
    if (duration !== undefined) data.duration = duration
    if (image !== undefined) data.image = image
    if (isPopular !== undefined) data.isPopular = isPopular
    if (isActive !== undefined) data.isActive = isActive
    if (order !== undefined) data.order = order

    const consultation = await prisma.consultation.update({
      where: { id },
      data,
    })

    res.json(consultation)
  } catch (error) {
    console.error('Update consultation error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update consultation' })
  }
})

// Delete consultation (admin)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)

    await prisma.consultation.delete({ where: { id } })

    res.json({ message: 'Consultation deleted' })
  } catch (error) {
    console.error('Delete consultation error:', error)
    return res.status(500).json({ success: false, message: 'Failed to delete consultation' })
  }
})

export default router
