import { Response, Router } from 'express'
import { prisma } from '../index.js'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createOrderSchema } from '../schemas/order.schema.js'
import { asString } from '../utils/params.js'

interface OrderProduct {
  id: string
  name: string
  price: number
  inStock: boolean
  stockQuantity?: number
  volume?: string | null
}

interface OrderVariant {
  id: string
  productId: string
  volume: string
  price: number
  stock: number
  product?: OrderProduct
}

const router = Router()

// Generate order number
function generateOrderNumber(): string {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `OL${year}${month}${day}-${random}`
}

// Get all orders (admin)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: { name: true, email: true, phone: true }
        },
        items: {
          include: {
            product: true,
            variant: true  // Include variant to show selected volume/price
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(orders)
  } catch (error) {
    console.error('Fetch all orders error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch orders' })
  }
})

type OrderItemBody = { productId: string; variantId?: string; volume?: string; quantity: number };

// Create order — только для авторизованных пользователей кабинета
router.post('/', authenticate, validate(createOrderSchema), async (req: AuthRequest, res: Response) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      deliveryMethod,
      deliveryAddress,
      deliveryCity,
      paymentMethod,
      items: rawItems,
      notes
    } = req.body

    const items = rawItems as OrderItemBody[]
    if (!customerName || !items?.length) {
      return res.status(400).json({ success: false, message: 'Customer name and items are required' })
    }

    // Calculate prices
    const productIds = items.map((item) => item.productId)
    const variantIds = items
      .map((item) => item.variantId)
      .filter(Boolean) as string[]

    console.log('Processing order with product IDs:', productIds, 'variant IDs:', variantIds)

    const [products, variants] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: productIds } } }),
      variantIds.length
        ? prisma.productVariant.findMany({ where: { id: { in: variantIds } }, include: { product: true } })
        : Promise.resolve([] as OrderVariant[]),
    ])

    const productMap = new Map<string, OrderProduct>(products.map((p) => [p.id, p]))
    const variantMap = new Map<string, OrderVariant>(variants.map((v) => [v.id, v]))

    let subtotal = 0
    const orderItems: { productId: string; variantId?: string; volume?: string; quantity: number; price: number }[] = []

    for (const item of items) {
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined
      const productId = variant ? variant.productId : item.productId
      const product = productMap.get(productId) ?? variant?.product

      if (!product) {
        console.warn(`Product not found: ${item.productId}`)
        return res.status(404).json({ success: false, message: `Товар не найден` })
      }

      // Check stock availability
      if (!product.inStock) {
        return res.status(400).json({
          success: false,
          message: `Товар "${product.name}" недоступен для заказа`
        })
      }

      // Check variant stock if variant is selected
      if (variant && variant.stock !== undefined && variant.stock <= 0) {
        return res.status(400).json({
          success: false,
          message: `Товар "${product.name}" (${variant.volume}) нет в наличии`
        })
      }

      // Check product stock quantity
      if (product.stockQuantity !== undefined && product.stockQuantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Недостаточно товара "${product.name}" на складе. Доступно: ${product.stockQuantity}`
        })
      }

      const price = variant ? variant.price : product.price
      const volume = item.volume ?? variant?.volume ?? product.volume ?? null
      const itemTotal = price * item.quantity
      subtotal += itemTotal

      orderItems.push({
        productId,
        variantId: variant?.id,
        volume: volume ?? undefined,
        quantity: item.quantity,
        price,
      })
    }

    const deliveryPrice = deliveryMethod === 'delivery' ? 500 : 0
    const totalPrice = subtotal + deliveryPrice

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: req.user?.id,
        customerName,
        customerEmail: customerEmail || null,
        // Телефон может быть пустым: основной идентификатор — аккаунт пользователя.
        // В БД поле сейчас NOT NULL, поэтому храним пустую строку, если номер не указан.
        customerPhone: (customerPhone || '').trim(),
        deliveryMethod,
        deliveryAddress,
        deliveryCity,
        paymentMethod,
        subtotal,
        deliveryPrice,
        totalPrice,
        notes,
        items: {
          create: orderItems
        }
      },
      include: {
        items: {
          include: { product: true }
        }
      }
    })

    res.status(201).json(order)
  } catch (error) {
    console.error('Order error:', error)
    return res.status(500).json({ success: false, message: 'Failed to create order' })
  }
})

// Get user orders
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(orders)
  } catch (error) {
    console.error('Fetch orders error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch orders' })
  }
})

// Get single order
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id },
          { orderNumber: id }
        ],
        userId: req.user!.id
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    })

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    res.json(order)
  } catch (error) {
    console.error('Fetch order error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch order' })
  }
})

export default router
