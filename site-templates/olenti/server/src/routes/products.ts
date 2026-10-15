import { Request, Response, Router } from 'express'
import { prisma } from '../index.js'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { asString } from '../utils/params.js'

const router = Router()

const PRODUCT_MIN_PRICE = 0

type BulkPriceBody = {
  ids?: unknown
  percentage?: unknown
}

/** Catalog KPI — server-side inventory valuation (not client reduce). */
router.get('/summary', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      select: { price: true, stockQuantity: true, inStock: true },
    })
    const totalProducts = products.length
    const inStockCount = products.filter((p) => p.inStock).length
    const totalValue = products.reduce(
      (sum, p) => sum + p.price * (p.stockQuantity || 1),
      0
    )
    res.json({
      totalProducts,
      inStockCount,
      outOfStockCount: totalProducts - inStockCount,
      totalValue,
    })
  } catch (error) {
    console.error('Products summary error:', error)
    throw new AppError('Failed to fetch products summary', 500)
  }
})

/**
 * Bulk percentage price update — server computes round(price * (1 + pct/100)).
 * Must be registered before `/:id` routes.
 */
router.post('/bulk-price', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as BulkPriceBody
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : []
    const percentage = typeof body.percentage === 'number' ? body.percentage : Number(body.percentage)

    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids required' })
    }
    if (!Number.isFinite(percentage) || percentage === 0) {
      return res.status(400).json({ success: false, message: 'percentage must be a non-zero number' })
    }

    const multiplier = 1 + percentage / 100
    const existing = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, price: true },
    })
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching products' })
    }

    const updated = await prisma.$transaction(
      existing.map((product) => {
        const nextPrice = Math.max(
          PRODUCT_MIN_PRICE,
          Math.round(product.price * multiplier)
        )
        return prisma.product.update({
          where: { id: product.id },
          data: { price: nextPrice },
          select: { id: true, price: true },
        })
      })
    )

    res.json({
      updatedCount: updated.length,
      products: updated,
    })
  } catch (error) {
    console.error('Bulk price update error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update prices' })
  }
})

// Get all products
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      collection,
      search,
      q,
      minPrice,
      maxPrice,
      volume,
      inStock,
      isNew,
      isFeatured,
      limit = '50',
      offset = '0',
      sort = 'createdAt',
      order = 'desc'
    } = req.query

    const where: any = {}

    if (category) where.category = category
    if (collection) {
      const collections = Array.isArray(collection) ? collection : [collection]
      where.collection = { in: collections }
    }
    if (volume) {
      const volumes = Array.isArray(volume) ? volume : [volume]
      where.volume = { in: volumes }
    }
    if (inStock === 'true') where.inStock = true
    if (isNew === 'true') where.isNew = true
    if (isFeatured === 'true') where.isFeatured = true

    const searchTerm = (q || search)?.toString().trim()
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    if (minPrice) where.price = { ...where.price, gte: parseInt(minPrice as string) }
    if (maxPrice) where.price = { ...where.price, lte: parseInt(maxPrice as string) }

    const [productsRaw, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { variants: true },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { [sort as string]: order },
      }),
      prisma.product.count({ where })
    ])

    // Transform products to include rating object only if reviewCount > 0
    const products = productsRaw.map((p: any) => ({
      ...p,
      originalPrice: p.oldPrice,
      rating: p.reviewCount > 0 ? { average: p.rating, count: p.reviewCount } : undefined,
    }))

    res.json({
      data: products,
      total,
      page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
      limit: parseInt(limit as string),
    })
  } catch (error) {
    console.error('Products error:', error)
    throw new AppError('Failed to fetch products', 500)
  }
})

// Get single product
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = asString(req.params.id)

    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { id },
          { slug: id }
        ]
      },
      include: { variants: true }
    })

    if (!product) {
      throw new AppError('Product not found', 404)
    }

    res.json(product)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Failed to fetch product', 500)
  }
})

// Create product (admin)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { variants = [], order, ...data } = req.body

    // Generate slug from name
    const slug = data.slug || data.name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-|-$/g, '')

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          ...data,
          slug,
          price: variants[0]?.price ?? data.price,
          volume: variants[0]?.volume ?? data.volume,
          images: data.images || [],
          image: data.image || data.images?.[0] || null,
        }
      })

      if (variants.length > 0) {
        await tx.productVariant.createMany({
          data: variants.map((v: any) => ({
            productId: created.id,
            volume: v.volume,
            price: v.price,
            oldPrice: v.originalPrice ?? v.oldPrice ?? null,
            sku: v.sku || null,
            stock: v.stock ?? 10,
          }))
        })
      }

      return tx.product.findUnique({
        where: { id: created.id },
        include: { variants: true },
      })
    })

    res.status(201).json(product)
  } catch (error) {
    console.error('Create product error:', error)
    return res.status(500).json({ success: false, message: 'Failed to create product' })
  }
})

// Update product (admin)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)
    const { variants = [], order, ...data } = req.body

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...data,
          price: variants[0]?.price ?? data.price,
          volume: variants[0]?.volume ?? data.volume,
          images: data.images || [],
          image: data.image || data.images?.[0] || null,
        },
      })

      // Replace variants if provided
      if (variants.length > 0) {
        await tx.productVariant.deleteMany({ where: { productId: id } })
        await tx.productVariant.createMany({
          data: variants.map((v: any) => ({
            productId: id,
            volume: v.volume,
            price: v.price,
            oldPrice: v.originalPrice ?? v.oldPrice ?? null,
            sku: v.sku || null,
            stock: v.stock ?? 10,
          }))
        })
      }

      return tx.product.findUnique({
        where: { id: updated.id },
        include: { variants: true },
      })
    })

    res.json(product)
  } catch (error) {
    console.error('Update product error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update product' })
  }
})

// Delete product (admin)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)

    await prisma.product.delete({ where: { id } })

    res.json({ message: 'Product deleted' })
  } catch (error) {
    console.error('Delete product error:', error)
    return res.status(500).json({ success: false, message: 'Failed to delete product' })
  }
})

export default router
