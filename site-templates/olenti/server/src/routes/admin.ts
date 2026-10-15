import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { getAdminCredentials, getJwtSecret } from '../config/env.js';
import { prisma } from '../index.js';
import { adminLoginRateLimiter, adminUploadRateLimiter } from '../middleware/adminRateLimiter.js';
import { AuthRequest, authenticate, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { asString } from '../utils/params.js';

const router = Router();

// Uploads configuration (shared with index.ts)
const uploadsDir = path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Use memory storage for processing before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB (before compression)
  },
  fileFilter: (_req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

// Helper to convert image to WebP
async function convertToWebP(
  buffer: Buffer,
  filename: string
): Promise<{ path: string; filename: string; size: number }> {
  const baseName = path.basename(filename, path.extname(filename));
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const webpFilename = `${baseName}-${uniqueSuffix}.webp`;
  const outputPath = path.join(uploadsDir, webpFilename);

  const result = await sharp(buffer)
    .webp({ quality: 85 }) // Good balance of quality and size
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true }) // Max dimensions
    .toFile(outputPath);

  return {
    path: outputPath,
    filename: webpFilename,
    size: result.size,
  };
}

// Upload media (admin) - converts images to WebP for better performance
router.post(
  '/upload',
  authenticate,
  requireAdmin,
  adminUploadRateLimiter,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      // Convert to WebP for better compression and performance
      const result = await convertToWebP(req.file.buffer, req.file.originalname);

      const publicUrl = `/uploads/${result.filename}`;

      res.status(201).json({
        url: publicUrl,
        filename: result.filename,
        size: result.size,
        mimeType: 'image/webp',
        originalSize: req.file.size,
        compressionRatio: ((1 - result.size / req.file.size) * 100).toFixed(1) + '%',
      });
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to upload file', 500);
    }
  }
);

// Admin login (with rate limiting)
router.post('/login', adminLoginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Check for admin credentials from env (optional, only if configured)
    const adminCreds = getAdminCredentials();

    // Normalize email: accept both 'admin' and 'admin@example.com'
    const normalizedEmail = email === 'admin' && adminCreds ? adminCreds.email : email;

    // If env credentials are configured, check them first
    if (adminCreds && normalizedEmail === adminCreds.email && password === adminCreds.password) {
      // Find or create admin user
      let admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });

      if (!admin) {
        const passwordHash = await bcrypt.hash(adminCreds.password, 10);
        admin = await prisma.user.create({
          data: {
            email: adminCreds.email,
            passwordHash,
            name: 'Администратор',
            role: 'ADMIN',
          },
        });
      }

      const secret = getJwtSecret();
      const token = jwt.sign({ userId: admin.id }, secret, { expiresIn: '24h' });

      res.cookie('admin_auth_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      return res.json({
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
        token,
      });
    }

    // Otherwise check database
    // Try normalized email first, then original email
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });
    }
    if (!user || user.role !== 'ADMIN') {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    const secret = getJwtSecret();
    const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '24h' });

    res.cookie('admin_auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ success: false, message: 'Admin login failed' });
  }
});

// Get dashboard stats
router.get('/stats', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalProducts,
      totalOrders,
      totalBookings,
      totalUsers,
      totalConsultations,
      totalMasterclasses,
      recentOrders,
      recentBookings,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.booking.count(),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.consultation.count(),
      prisma.masterclass.count(),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          consultation: true,
          masterclass: true,
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
      }),
    ]);

    // Calculate revenue
    const orders = await prisma.order.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: { totalPrice: true },
    });
    const totalRevenue = orders.reduce(
      (sum: number, o: { totalPrice: number }) => sum + o.totalPrice,
      0
    );

    res.json({
      totalProducts,
      totalOrders,
      totalBookings,
      totalUsers,
      totalRevenue,
      totalConsultations,
      totalMasterclasses,
      recentOrders,
      recentBookings,
    });
  } catch (error) {
    throw new AppError('Failed to fetch stats', 500);
  }
});

// Get all consultations (admin)
router.get(
  '/consultations',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const consultations = await prisma.consultation.findMany({
        orderBy: { order: 'asc' },
      });

      res.json(consultations);
    } catch (error) {
      throw new AppError('Failed to fetch consultations', 500);
    }
  }
);

// Get all masterclasses (admin)
router.get(
  '/masterclasses',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const masterclasses = await prisma.masterclass.findMany({
        orderBy: { order: 'asc' },
      });

      res.json(masterclasses);
    } catch (error) {
      throw new AppError('Failed to fetch masterclasses', 500);
    }
  }
);

// Get all bookings (admin)
router.get('/bookings', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { status, date } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (date) where.date = new Date(date as string);

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        consultation: true,
        masterclass: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(bookings);
  } catch (error) {
    throw new AppError('Failed to fetch bookings', 500);
  }
});

// Update booking status (admin)
router.patch(
  '/bookings/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = asString(req.params.id);
      const { status } = req.body;

      // Получаем текущее бронирование для проверки изменений
      const currentBooking = await prisma.booking.findUnique({
        where: { id },
        include: {
          consultation: true,
          masterclass: true,
        },
      });

      if (!currentBooking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      const booking = await prisma.booking.update({
        where: { id },
        data: { status },
        include: {
          consultation: true,
          masterclass: true,
        },
      });

      // Синхронизируем слот расписания с фактическими бронированиями
      try {
        const slotType = booking.consultationId
          ? 'consultation'
          : booking.masterclassId
            ? 'masterclass'
            : null;

        if (slotType) {
          // Считаем количество активных (не отменённых) бронирований для этой даты/времени/типа
          const activeBookings = await prisma.booking.count({
            where: {
              date: booking.date,
              time: booking.time,
              status: { not: 'CANCELLED' },
              consultationId: slotType === 'consultation' ? { not: null } : undefined,
              masterclassId: slotType === 'masterclass' ? { not: null } : undefined,
            },
          });

          let slot = await prisma.scheduleSlot.findFirst({
            where: {
              date: booking.date,
              time: booking.time,
              type: slotType,
            },
          });

          // Если слота ещё нет — создаём его автоматически
          if (!slot) {
            const title =
              booking.consultation?.title ||
              booking.masterclass?.title ||
              (slotType === 'consultation' ? 'Консультация' : 'Мастер‑класс');

            const maxBookings =
              slotType === 'masterclass' && booking.masterclass?.maxParticipants
                ? booking.masterclass.maxParticipants
                : 1;

            slot = await prisma.scheduleSlot.create({
              data: {
                date: booking.date,
                time: booking.time,
                type: slotType,
                title,
                maxBookings,
                bookings: activeBookings,
                isAvailable: maxBookings > activeBookings,
              },
            });
          } else {
            // Обновляем счётчик и доступность слота согласно фактическим бронированиям
            await prisma.scheduleSlot.update({
              where: { id: slot.id },
              data: {
                bookings: activeBookings,
                isAvailable: slot.maxBookings > activeBookings,
              },
            });
          }
        }
      } catch (error) {
        console.error('Failed to update schedule slot on booking status change:', error);
      }

      res.json(booking);
    } catch (error) {
      throw new AppError('Failed to update booking', 500);
    }
  }
);

// Get all orders (admin)
router.get('/orders', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const status = asString(req.query.status);

    const where: any = {};
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    throw new AppError('Failed to fetch orders', 500);
  }
});

/** Order KPI aggregates — full dataset (not client reduce over loaded list). */
router.get('/orders/summary', authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const grouped = await prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { totalPrice: true },
    });

    const countByStatus: Record<string, number> = {};
    let total = 0;
    let totalRevenue = 0;
    for (const row of grouped) {
      const count = row._count._all;
      countByStatus[row.status] = count;
      total += count;
      if (row.status !== 'CANCELLED') {
        totalRevenue += row._sum.totalPrice ?? 0;
      }
    }

    res.json({
      total,
      pending: countByStatus.PENDING ?? 0,
      inProgress: (countByStatus.PROCESSING ?? 0) + (countByStatus.SHIPPED ?? 0),
      delivered: countByStatus.DELIVERED ?? 0,
      cancelled: countByStatus.CANCELLED ?? 0,
      totalRevenue,
      countByStatus,
    });
  } catch (error) {
    throw new AppError('Failed to fetch orders summary', 500);
  }
});

// Update order status (admin)
router.patch('/orders/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const id = asString(req.params.id);
    const { status, paymentStatus } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: { status, paymentStatus },
    });

    res.json(order);
  } catch (error) {
    throw new AppError('Failed to update order', 500);
  }
});

// Delete order (admin)
router.delete(
  '/orders/:id',
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = asString(req.params.id);

      await prisma.order.delete({ where: { id } });

      res.json({ success: true });
    } catch (error) {
      throw new AppError('Failed to delete order', 500);
    }
  }
);

// Get all users (admin)
router.get('/users', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { orders: true, bookings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    throw new AppError('Failed to fetch users', 500);
  }
});

// Global Search (admin)
router.get('/search', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = asString(req.query.q);
    if (!q || typeof q !== 'string') {
      return res.json({ products: [], orders: [], users: [], bookings: [] });
    }

    const query = q.toLowerCase();

    const [products, orders, users, bookings] = await Promise.all([
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, name: true, image: true, price: true, category: true },
      }),
      prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: query, mode: 'insensitive' } },
            { customerName: { contains: query, mode: 'insensitive' } },
            { customerEmail: { contains: query, mode: 'insensitive' } },
            { customerPhone: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          totalPrice: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, name: true, email: true, avatar: true },
      }),
      prisma.booking.findMany({
        where: {
          OR: [
            { guestName: { contains: query, mode: 'insensitive' } },
            { guestEmail: { contains: query, mode: 'insensitive' } },
            { guestPhone: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        include: {
          consultation: { select: { title: true } },
          masterclass: { select: { title: true } },
        },
      }),
    ]);

    res.json({ products, orders, users, bookings });
  } catch (error) {
    console.error('Search error:', error);
    throw new AppError('Failed to search', 500);
  }
});

export default router;
