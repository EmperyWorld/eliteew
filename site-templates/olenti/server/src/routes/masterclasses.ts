import { Request, Response, Router } from 'express'
import { prisma } from '../index.js'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.js'
import { asString } from '../utils/params.js'
import { validateCatalogPublishActivation } from '../utils/catalogPublishGuard.js'

const router = Router()

// Get all masterclasses
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = asString(req.query.category)

    const where: any = { isActive: true }
    if (category && category !== 'all') {
      where.category = category
    }

    const masterclasses = await prisma.masterclass.findMany({
      where,
      orderBy: { order: 'asc' }
    })

    res.json(masterclasses)
  } catch (error) {
    console.error('Fetch masterclasses error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch masterclasses' })
  }
})

// Get single masterclass
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const slug = asString(req.params.slug)

    const masterclass = await prisma.masterclass.findFirst({
      where: {
        OR: [
          { id: slug },
          { slug }
        ]
      }
    })

    if (!masterclass) {
      return res.status(404).json({ success: false, message: 'Masterclass not found' })
    }

    res.json(masterclass)
  } catch (error) {
    console.error('Fetch masterclass error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch masterclass' })
  }
})

// Create masterclass (admin)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      slug: bodySlug,
      shortDescription,
      description,
      fullDescription,
      price,
      priceNote,
      duration,
      maxParticipants,
      minParticipants,
      image,
      category,
      isActive,
      order,
      level,
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

    const masterclass = await prisma.masterclass.create({
      data: {
        title,
        slug,
        shortDescription,
        fullDescription: fullDescription ?? description,
        price,
        priceNote,
        duration,
        maxParticipants,
        minParticipants: minParticipants ?? 1,
        level: level ?? 'all',
        image,
        category,
        isActive: isActive ?? true,
        order: order ?? 0,
      }
    })

    res.status(201).json(masterclass)
  } catch (error) {
    console.error('Create masterclass error:', error)
    return res.status(500).json({ success: false, message: 'Failed to create masterclass' })
  }
})

// Update masterclass (admin)
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
      priceNote,
      duration,
      maxParticipants,
      minParticipants,
      image,
      category,
      isActive,
      order,
      level,
    } = req.body

    const existing = await prisma.masterclass.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Masterclass not found' })
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
    if (priceNote !== undefined) data.priceNote = priceNote
    if (duration !== undefined) data.duration = duration
    if (maxParticipants !== undefined) data.maxParticipants = maxParticipants
    if (minParticipants !== undefined) data.minParticipants = minParticipants
    if (level !== undefined) data.level = level
    if (image !== undefined) data.image = image
    if (category !== undefined) data.category = category
    if (isActive !== undefined) data.isActive = isActive
    if (order !== undefined) data.order = order

    const masterclass = await prisma.masterclass.update({
      where: { id },
      data,
    })

    res.json(masterclass)
  } catch (error) {
    console.error('Update masterclass error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update masterclass' })
  }
})

// Delete masterclass (admin)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)

    await prisma.masterclass.delete({ where: { id } })

    res.json({ message: 'Masterclass deleted' })
  } catch (error) {
    console.error('Delete masterclass error:', error)
    return res.status(500).json({ success: false, message: 'Failed to delete masterclass' })
  }
})

export default router
