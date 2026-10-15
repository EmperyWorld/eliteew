/**
 * 🔐 Token Expiration Cache
 *
 * Кэширует проверку exp токена, чтобы не проверять на каждом запросе.
 * Токен живет ~4 часа (14400 секунд), нет смысла проверять exp на каждом запросе.
 */

let lastExpCheck = 0;
let cachedExp: number | null = null;
let cachedTimeUntilExpiry: number | null = null;
const EXP_CHECK_INTERVAL = 60000; // Проверяем exp раз в минуту

/**
 * Получить время до истечения токена (с кэшированием)
 *
 * @param tokenExp - exp из токена (unix timestamp)
 * @returns Время до истечения в секундах, или 0 если токен истек
 */
export function getCachedTimeUntilExpiry(tokenExp: number | undefined): number {
	if (!tokenExp) {
		return 0;
	}

	const now = Date.now();

	// Если прошло меньше минуты с последней проверки - используем кэш
	if (
		now - lastExpCheck < EXP_CHECK_INTERVAL &&
		cachedExp === tokenExp &&
		cachedTimeUntilExpiry !== null
	) {
		return cachedTimeUntilExpiry;
	}

	// Обновляем кэш
	lastExpCheck = now;
	cachedExp = tokenExp;
	const nowSeconds = Math.floor(now / 1000);
	cachedTimeUntilExpiry = tokenExp - nowSeconds;

	return cachedTimeUntilExpiry;
}

/**
 * Сбросить кэш (например, после обновления токена)
 */
export function clearTokenCache(): void {
	lastExpCheck = 0;
	cachedExp = null;
	cachedTimeUntilExpiry = null;
}
