import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';

// Routes
import { initNotificationWorker } from './queue/notificationQueue.js';
import adminSiteSettingsRoutes from './routes/admin-site-settings.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import bookingsRoutes from './routes/bookings.js';
import configRoutes from './routes/config.js';
import consultationsRoutes from './routes/consultations.js';
import contentRoutes from './routes/content.js';
import favoritesRoutes from './routes/favorites.js';
import featureFlagsRoutes from './routes/feature-flags.js';
import galleryRoutes from './routes/gallery.js';
import masterclassesRoutes from './routes/masterclasses.js';
import ordersRoutes from './routes/orders.js';
import presentationsRoutes from './routes/presentations.js';
import productsRoutes from './routes/products.js';
import scheduleRoutes from './routes/schedule.js';
import settingsRoutes from './routes/settings.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiterMiddleware } from './middleware/rateLimiter.js';

// Config
import { getAllowedCorsOrigins, validateEnv } from './config/env.js';

// Swagger
import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger.js';

dotenv.config();

// Validate required environment variables before starting
validateEnv();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

// Security Middleware
app.use(helmet());
const uploadsDir = path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'uploads');

// Prisma client (Prisma 7: adapter in src/db.ts)
import { prisma } from './db.js';
export { prisma };

let notificationWorker: any;

// Middleware
app.set('trust proxy', 1); // Trust first proxy (Nginx)
const allowedCorsOrigins = getAllowedCorsOrigins();
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiter
app.use('/api', rateLimiterMiddleware);

// Ensure uploads directory exists and serve static files
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs));

// Serve frontend static assets (for development proxy and prod)
const distFrontendDir = path.resolve(process.cwd(), 'dist-frontend');
if (fs.existsSync(distFrontendDir)) {
  app.use('/assets', express.static(path.join(distFrontendDir, 'assets')));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/consultations', consultationsRoutes);
app.use('/api/masterclasses', masterclassesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/site-settings', adminSiteSettingsRoutes);
app.use('/api/admin/config', configRoutes);
app.use('/api/admin/flags', featureFlagsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/presentations', presentationsRoutes);

// Error handler
app.use(errorHandler);

// Start server
async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    // Initialize Worker
    notificationWorker = initNotificationWorker();
    console.log('✅ Notification worker started');

    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on http://${HOST}:${PORT}`);
      console.log(`📡 API available at http://${HOST}:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  if (notificationWorker) await notificationWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (notificationWorker) await notificationWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});
