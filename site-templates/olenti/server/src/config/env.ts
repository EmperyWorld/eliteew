/**
 * Валидация обязательных переменных окружения при старте приложения
 */

interface RequiredEnvVars {
  JWT_SECRET: string;
  DATABASE_URL: string;
}

interface OptionalEnvVars {
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  PORT?: string;
  FRONTEND_URL?: string;
  PUBLIC_SITE_URL?: string;
  ADMIN_APP_URL?: string;
  CORS_ALLOWED_ORIGINS?: string;
  UPLOADS_DIR?: string;
}

export function validateEnv(): void {
  const required: (keyof RequiredEnvVars)[] = ['JWT_SECRET', 'DATABASE_URL'];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((key) => {
      console.error(`   - ${key}`);
    });
    console.error('\n💡 Please set these variables in your .env file or environment');
    process.exit(1);
  }

  // Проверка минимальной длины JWT_SECRET
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters long for security');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
}

/**
 * Получить JWT секрет (без fallback)
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. This should have been caught during startup validation.'
    );
  }
  return secret;
}

/**
 * Получить админские креды (без fallback)
 * Возвращает null если не установлены (для использования только БД авторизации)
 */
export function getAdminCredentials(): { email: string; password: string } | null {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

export function getPublicSiteUrl(): string {
  return process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
}

export function getAdminAppUrl(): string | null {
  return process.env.ADMIN_APP_URL || null;
}

export function getAllowedCorsOrigins(): string[] {
  const explicitOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(
    new Set(
      [
        getPublicSiteUrl(),
        getAdminAppUrl(),
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:3000',
      ].filter(Boolean).concat(explicitOrigins)
    )
  ) as string[];
}
