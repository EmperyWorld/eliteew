import { Request, Response, Router } from 'express'
import { prisma } from '../index.js'
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.js'
import { addNotificationJob } from '../queue/notificationQueue.js'
import { asString } from '../utils/params.js'

const router = Router()

// Get available slots
router.get('/', async (req: Request, res: Response) => {
  try {
    const { date, type } = req.query

    const where: any = {}

    if (date) {
      where.date = new Date(date as string)
    }
    if (type) {
      where.type = type
    }

    const slots = await prisma.scheduleSlot.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }]
    })

    // Вычисляем реальное количество активных бронирований для каждого слота
    const slotsWithBookings = await Promise.all(
      slots.map(async (slot) => {
        // Формируем условие для поиска бронирований в зависимости от типа слота
        const bookingWhere: any = {
          date: slot.date,
          time: slot.time,
          status: {
            not: 'CANCELLED',
          },
        }

        if (slot.type === 'consultation') {
          bookingWhere.consultationId = { not: null }
        } else if (slot.type === 'masterclass') {
          bookingWhere.masterclassId = { not: null }
        } else {
          // Для задач и других типов не считаем бронирования
          return {
            ...slot,
            bookings: slot.bookings,
            isAvailable: slot.isAvailable,
          }
        }

        const activeBookings = await prisma.booking.count({
          where: bookingWhere,
        })

        // Обновляем счетчик в слоте, если он не совпадает с реальным
        if (slot.bookings !== activeBookings) {
          await prisma.scheduleSlot.update({
            where: { id: slot.id },
            data: {
              bookings: activeBookings,
              isAvailable: slot.maxBookings > activeBookings,
            },
          })
        }

        return {
          ...slot,
          bookings: activeBookings,
          isAvailable: slot.maxBookings > activeBookings,
        }
      })
    )

    res.json(slotsWithBookings)
  } catch (error) {
    console.error('Fetch schedule error:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch schedule' })
  }
})

// Create slot (admin)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { date, time, type, title, description, priority, status, maxBookings, notify, notificationMessage, remindBeforeMinutes } = req.body

    const slot = await prisma.scheduleSlot.create({
      data: {
        date: new Date(date),
        time,
        type,
        title,
        description,
        priority,
        status: status || 'pending',
        maxBookings: maxBookings || 1,
      }
    })

    if (notify) {
      const baseMessage = notificationMessage || `📅 <b>Новое событие в расписании</b>\n\n` +
        `📝 ${title || type}\n` +
        `📅 ${new Date(date).toLocaleDateString('ru-RU')}\n` +
        `⏰ ${time}`

      await addNotificationJob('admin-notification', { message: baseMessage })

      const remindMinutes = typeof remindBeforeMinutes === 'number' ? remindBeforeMinutes : 0
      if (remindMinutes > 0 && date && time) {
        const slotDateTime = new Date(`${date}T${time}`)
        const now = new Date()
        let delay = slotDateTime.getTime() - now.getTime() - remindMinutes * 60 * 1000

        if (delay < 0) {
          delay = 0
        }

        const reminderMessage = `⏰ <b>Напоминание о событии</b>\n\n` +
          `📝 ${title || type}\n` +
          `📅 ${new Date(date).toLocaleDateString('ru-RU')}\n` +
          `⏰ ${time}`

        await addNotificationJob('schedule-reminder', { message: reminderMessage, slotId: slot.id }, { delay })
      }
    }

    res.status(201).json(slot)
  } catch (error: any) {
    console.error('Create slot error:', error)
    if (error?.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Слот на эту дату и время уже существует' })
    }
    return res.status(500).json({ success: false, message: 'Failed to create slot' })
  }
})

// Update slot (admin)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)

    const slot = await prisma.scheduleSlot.update({
      where: { id },
      data: req.body
    })

    res.json(slot)
  } catch (error) {
    console.error('Update slot error:', error)
    return res.status(500).json({ success: false, message: 'Failed to update slot' })
  }
})

// Delete slot (admin)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id)

    await prisma.scheduleSlot.delete({ where: { id } })

    res.json({ message: 'Slot deleted' })
  } catch (error) {
    console.error('Delete slot error:', error)
    return res.status(500).json({ success: false, message: 'Failed to delete slot' })
  }
})

// Bulk create slots (admin)
router.post('/bulk', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { slots } = req.body

    const created = await prisma.scheduleSlot.createMany({
      data: slots.map((slot: any) => ({
        date: new Date(slot.date),
        time: slot.time,
        type: slot.type,
        title: slot.title,
        maxBookings: slot.maxBookings || 1,
      })),
      skipDuplicates: true,
    })

    res.status(201).json({ count: created.count })
  } catch (error) {
    console.error('Bulk create slots error:', error)
    return res.status(500).json({ success: false, message: 'Failed to create slots' })
  }
})

export default router
