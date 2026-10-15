import { Response, Router } from 'express'
import { prisma } from '../index.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { asString } from '../utils/params.js'

const router = Router()

// Get user favorites
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user!.id },
      include: {
        product: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(favorites)
  } catch (error) {
    console.error('Get favorites error:', error)
    throw new AppError('Failed to fetch favorites', 500)
  }
})

// Add to favorites
router.post('/:productId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const productId = asString(req.params.productId)

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      throw new AppError('Product not found', 404)
    }

    // Check if already in favorites
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId: req.user!.id,
          productId
        }
      }
    })

    if (existing) {
      return res.json(existing)
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId: req.user!.id,
        productId
      },
      include: {
        product: true
      }
    })

    res.status(201).json(favorite)
  } catch (error) {
    if (error instanceof AppError) throw error
    console.error('Add favorite error:', error)
    throw new AppError('Failed to add to favorites', 500)
  }
})

// Remove from favorites
router.delete('/:productId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const productId = asString(req.params.productId)

    await prisma.favorite.delete({
      where: {
        userId_productId: {
          userId: req.user!.id,
          productId
        }
      }
    })

    res.json({ success: true })
  } catch (error) {
    // If not found, still return success
    if ((error as any).code === 'P2025') {
      return res.json({ success: true })
    }
    console.error('Remove favorite error:', error)
    throw new AppError('Failed to remove from favorites', 500)
  }
})

// Check if product is in favorites
router.get('/check/:productId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const productId = asString(req.params.productId)

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_productId: {
          userId: req.user!.id,
          productId
        }
      }
    })

    res.json({ isFavorite: !!favorite })
  } catch (error) {
    console.error('Check favorite error:', error)
    throw new AppError('Failed to check favorite', 500)
  }
})

export default router
