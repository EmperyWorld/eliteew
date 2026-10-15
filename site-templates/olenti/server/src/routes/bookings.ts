import { Response, Router } from 'express'
import { prisma } from '../index.js'
import { authenticate, AuthRequest, optionalAuth, requireAdmin } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'
import { asString } from '../utils/params.js'

const router = Router()

// Get all bookings (admin)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        consultation: true,
        masterclass: true,
        user: {
          select: { id: true, name: true, email: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    res.json(bookings)
  } catch (error) {
    console.error('Get bookings error:', error)
    throw new AppError('Failed to fetch bookings', 500)
  }
})

// Create booking (public or authenticated)
router.post('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      consultationId,
      masterclassId,
      guestName,
      guestEmail,
      guestPhone,
      date,
      time,
      participants = 1,
      notes
    } = req.body

    // Validate required fields
    if (!date || !time) {
      return res.status(400).json({ success: false, message: 'Date and time are required' })
    }

    if (!consultationId && !masterclassId) {
      return res.status(400).json({ success: false, message: 'Consultation or masterclass ID is required' })
    }

    // If not authenticated, require guest info
    if (!req.user && (!guestName || !guestPhone)) {
      return res.status(400).json({ success: false, message: 'Guest name and phone are required' })
    }

    // Calculate total price
    let totalPrice = 0
    if (consultationId) {
      const consultation = await prisma.consultation.findUnique({ where: { id: consultationId } })
      if (!consultation) {
        return res.status(404).json({ success: false, message: 'Consultation not found' })
      }
      totalPrice = consultation.price
    } else if (masterclassId) {
      const masterclass = await prisma.masterclass.findUnique({ where: { id: masterclassId } })
      if (!masterclass) {
        return res.status(404).json({ success: false, message: 'Masterclass not found' })
      }
      totalPrice = masterclass.price * participants
    }

    const booking = await prisma.booking.create({
      data: {
        userId: req.user?.id,
        consultationId,
        masterclassId,
        guestName: req.user ? undefined : guestName,
        guestEmail: req.user ? undefined : guestEmail,
        guestPhone: req.user ? undefined : guestPhone,
        date: new Date(date),
        time,
        participants,
        notes,
        totalPrice,
      },
      include: {
        consultation: true,
        masterclass: true,
      }
    })

    // Обновляем счетчик бронирований в соответствующем слоте расписания
    try {
      const bookingDate = new Date(date)
      const slotType = consultationId ? 'consultation' : masterclassId ? 'masterclass' : null

      if (slotType) {
        const slot = await prisma.scheduleSlot.findFirst({
          where: {
            date: bookingDate,
            time: time,
            type: slotType,
          },
        })

        if (slot) {
          await prisma.scheduleSlot.update({
            where: { id: slot.id },
            data: {
              bookings: {
                increment: 1,
              },
              isAvailable: slot.maxBookings > slot.bookings,
            },
          })
        }
      }
    } catch (error) {
      // Логируем ошибку, но не прерываем создание бронирования
      console.error('Failed to update schedule slot bookings count:', error)
    }

    res.status(201).json(booking)
  } catch (error) {
    console.error('Booking error:', error)
    return res.status(500).json({ success: false, message: 'Failed to create booking' })
  }
})

// Get user bookings
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user!.id },
      include: {
        consultation: true,
        masterclass: true,
      },
      orderBy: { date: 'desc' }
    })

    res.json(bookings)
  } catch (error) {
    console.error('Fetch bookings error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings' })
  }
})

// Cancel booking
router.patch('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)

    const booking = await prisma.booking.findUnique({ where: { id } })
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    if (booking.userId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' }
    })

    // Обновляем счетчик бронирований в слоте при отмене
    try {
      const slotType = booking.consultationId ? 'consultation' : booking.masterclassId ? 'masterclass' : null

      if (slotType) {
        const slot = await prisma.scheduleSlot.findFirst({
          where: {
            date: booking.date,
            time: booking.time,
            type: slotType,
          },
        })

        if (slot && slot.bookings > 0) {
          await prisma.scheduleSlot.update({
            where: { id: slot.id },
            data: {
              bookings: {
                decrement: 1,
              },
              isAvailable: true,
            },
          })
        }
      }
    } catch (error) {
      console.error('Failed to update schedule slot on booking cancellation:', error)
    }

    res.json(updated)
  } catch (error) {
    console.error('Cancel booking error:', error)
    return res.status(500).json({ success: false, message: 'Failed to cancel booking' })
  }
})

export default router
