/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read-only `/api/version` metadata sync for display and diagnostics.
 * Deploy detection and auto-reload are owned by `staleBundleReload.startDeployVersionWatcher`.
 *
 * Invariants:
 * - Never triggers hard navigation or `reloadAllAppTabs` — stale bundle recovery is single-owner.
 * - `clearCache()` remains for explicit user-initiated refresh only (via hook notification confirm).
 *
 * Related:
 * - `utils/staleBundleReload.ts`, `hooks/useVersionCheck.ts`
 * - `documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md` §2.7
 */

import { log } from '@utils/logger';
import {
	BUNDLE_MISMATCH_RELOAD_KEY,
	CHUNK_RELOAD_KEY,
	MAINTENANCE_RELOAD_SESSION_KEY,
} from '../utils/staleBundleReload';
import { apiClient, APIError } from './api';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 минут
const VERSION_STORAGE_KEY = 'app_version';
const BUILD_HASH_STORAGE_KEY = 'app_build_hash';
const LAST_CHECK_KEY = 'last_version_check';

const RECOVERY_SESSION_KEYS = [
	CHUNK_RELOAD_KEY,
	BUNDLE_MISMATCH_RELOAD_KEY,
	MAINTENANCE_RELOAD_SESSION_KEY,
] as const;

interface VersionInfo {
	version: string;
	buildHash: string;
	buildTime?: string;
	environment?: string;
}

class VersionCheckService {
	private checkInterval: number = VERSION_CHECK_INTERVAL;
	private intervalId: NodeJS.Timeout | null = null;
	private isChecking = false;
	private onUpdateCallback: ((version: string) => void) | null = null;

	/**
	 * Получить текущую версию из localStorage
	 */
	getCurrentVersion(): VersionInfo | null {
		const version = localStorage.getItem(VERSION_STORAGE_KEY);
		const buildHash = localStorage.getItem(BUILD_HASH_STORAGE_KEY);

		if (!version || !buildHash) {
			return null;
		}

		return {
			version,
			buildHash,
		};
	}

	/**
	 * Проверить версию на сервере
	 */
	async checkVersion(): Promise<VersionInfo | null> {
		if (this.isChecking) {
			return null;
		}

		this.isChecking = true;

		try {
			const { data } = await apiClient.get<VersionInfo>(`/api/version`, {
				params: { t: Date.now() },
				headers: { 'Cache-Control': 'no-cache' },
			});
			return data ?? null;
		} catch (error) {
			if (!(error instanceof APIError) || error.statusCode !== 404) {
				log.warn('VersionCheck', 'Version check failed', error);
			}
			return null;
		} finally {
			this.isChecking = false;
		}
	}

	/**
	 * Проверить, нужна ли перезагрузка
	 */
	async needsUpdate(): Promise<boolean> {
		const currentVersion = this.getCurrentVersion();
		const serverVersion = await this.checkVersion();

		if (!serverVersion) {
			return false;
		}

		// Если версия не сохранена, сохраняем и не обновляем
		if (!currentVersion) {
			this.saveVersion(serverVersion);
			return false;
		}

		// Проверяем buildHash (более надежно чем version)
		if (serverVersion.buildHash !== currentVersion.buildHash) {
			return true;
		}

		// Также проверяем version на всякий случай
		if (serverVersion.version !== currentVersion.version) {
			return true;
		}

		// Обновляем время последней проверки
		localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

		return false;
	}

	/**
	 * Сохранить версию в localStorage
	 */
	private saveVersion(versionInfo: VersionInfo): void {
		localStorage.setItem(VERSION_STORAGE_KEY, versionInfo.version);
		localStorage.setItem(BUILD_HASH_STORAGE_KEY, versionInfo.buildHash);
		localStorage.setItem(LAST_CHECK_KEY, Date.now().toString());
	}

	/**
	 * Очистить кэш браузера
	 */
	async clearCache(): Promise<void> {
		// Очистить Service Worker кэш
		if ('caches' in window) {
			try {
				const cacheNames = await caches.keys();
				await Promise.all(cacheNames.map((name) => caches.delete(name)));
				log.info('VersionCheck', `Cleared ${String(cacheNames.length)} caches`);
			} catch (error) {
				log.warn('VersionCheck', 'Failed to clear caches', error);
			}
		}

		try {
			const preserved = new Map<string, string>();
			for (const key of RECOVERY_SESSION_KEYS) {
				const value = sessionStorage.getItem(key);
				if (value != null) {
					preserved.set(key, value);
				}
			}
			sessionStorage.clear();
			for (const [key, value] of preserved) {
				sessionStorage.setItem(key, value);
			}
		} catch {
			/* ignore */
		}
	}

	/**
	 * Notify listeners that server version metadata changed (read-only).
	 * Deploy reload is owned by `staleBundleReload` — no navigation here.
	 */
	async handleUpdate(versionInfo: VersionInfo): Promise<void> {
		log.info(
			'VersionCheck',
			'Server version metadata changed (read-only track)',
			{
				version: versionInfo.version,
				buildHash: versionInfo.buildHash,
			}
		);

		if (this.onUpdateCallback) {
			this.onUpdateCallback(versionInfo.version);
		}

		this.saveVersion(versionInfo);
	}

	/**
	 * Показать уведомление пользователю (опционально)
	 */
	showUpdateNotification(
		version: string,
		onConfirm: () => void,
		onCancel?: () => void
	): void {
		// Можно использовать toast, modal, или browser notification
		const message = `Доступна новая версия приложения (${version}). Обновить сейчас?`;

		if (window.confirm(message)) {
			onConfirm();
		} else if (onCancel) {
			onCancel();
		}
	}

	/**
	 * Начать автоматическую проверку версии
	 */
	startAutoCheck(onUpdate?: (version: string) => void): void {
		if (this.intervalId) {
			this.stopAutoCheck();
		}

		if (onUpdate) {
			this.onUpdateCallback = onUpdate;
		}

		// Проверить сразу при старте
		this.checkAndUpdate();

		// Затем проверять каждые N минут
		this.intervalId = setInterval(() => {
			this.checkAndUpdate();
		}, this.checkInterval);

		log.info(
			'VersionCheck',
			`Auto-check started, interval: ${String(this.checkInterval / 1000)} seconds`
		);
	}

	/**
	 * Остановить автоматическую проверку
	 */
	stopAutoCheck(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
			log.info('VersionCheck', 'Auto-check stopped');
		}
	}

	/** Poll server version and sync local metadata — never reloads the page. */
	private async checkAndUpdate(): Promise<void> {
		const needsUpdate = await this.needsUpdate();
		if (!needsUpdate) {
			return;
		}
		const serverVersion = await this.checkVersion();
		if (serverVersion) {
			await this.handleUpdate(serverVersion);
		}
	}

	/**
	 * Установить интервал проверки
	 */
	setCheckInterval(intervalMs: number): void {
		this.checkInterval = intervalMs;

		// Перезапустить если уже запущено
		if (this.intervalId) {
			this.stopAutoCheck();
			this.startAutoCheck(this.onUpdateCallback || undefined);
		}
	}
}

// Singleton instance
export const versionCheckService = new VersionCheckService();

// Export для использования в компонентах
export default versionCheckService;
