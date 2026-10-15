import axios, {
	type AxiosRequestConfig,
	type InternalAxiosRequestConfig,
} from 'axios';
import { log } from '@utils/logger';

// Global patches only: XMLHttpRequest.open, getUri, adapter (HTTP→HTTPS).
// Do NOT use this axios instance for API calls. Use apiClient or createAPIClient from services/api/client.

// 🔥 КРИТИЧНО: Перехватываем XMLHttpRequest.open САМЫМ ПЕРВЫМ
// Это должно быть ДО любых других операций с axios
if (typeof window !== 'undefined') {
	const originalXHROpen = XMLHttpRequest.prototype.open;
	type XHROpenFn = (
		this: XMLHttpRequest,
		method: string,
		url: string | URL,
		async?: boolean,
		username?: string | null,
		password?: string | null
	) => void;
	const xhrProto = XMLHttpRequest.prototype as unknown as { open: XHROpenFn };
	xhrProto.open = function (
		this: XMLHttpRequest,
		method: string,
		url: string | URL,
		async?: boolean,
		username?: string | null,
		password?: string | null
	): void {
		// ✅ FIX: Удалена телеметрия
		const urlString = typeof url === 'string' ? url : url.toString();
		if (urlString?.includes('http://app.eliteew.ru')) {
			log.error(
				'axiosSetup',
				'🔴 [XHR] HTTP URL detected BEFORE fix!',
				undefined,
				{
					originalUrl: urlString,
					method,
					stackTrace: new Error().stack,
				}
			);
		}

		// Исправляем HTTP URL на HTTPS
		if (url && typeof url === 'string') {
			if (url.includes('http://app.eliteew.ru')) {
				const fixedUrl = url.replace(
					/http:\/\/app\.empery\.world/g,
					'https://app.eliteew.ru'
				);
				log.error(
					'axiosSetup',
					`❌ [XHR] CRITICAL: Fixed HTTP URL in XMLHttpRequest.open: ${url} → ${fixedUrl}`
				);
				url = fixedUrl;
			} else if (url.startsWith('http://') && url.includes('app.eliteew.ru')) {
				const fixedUrl = url.replace(/^http:\/\//, 'https://');
				log.error(
					'axiosSetup',
					`❌ [XHR] CRITICAL: Fixed HTTP protocol in XMLHttpRequest.open: ${url} → ${fixedUrl}`
				);
				url = fixedUrl;
			}
		}
		originalXHROpen.call(this, method, url, async ?? true, username, password);
	};

	// Также перехватываем axios.getUri для исправления HTTP URL
	const originalGetUri = axios.getUri;
	axios.getUri = function (config: AxiosRequestConfig): string {
		// Исправляем HTTP в конфиге ПЕРЕД построением URI
		if (
			config.baseURL &&
			typeof config.baseURL === 'string' &&
			config.baseURL.includes('http://app.eliteew.ru')
		) {
			config.baseURL = config.baseURL.replace(
				/http:\/\/app\.empery\.world/g,
				'https://app.eliteew.ru'
			);
			log.error(
				'axiosSetup',
				`❌ [axios.getUri] Fixed HTTP baseURL: ${config.baseURL}`
			);
		}
		if (
			axios.defaults.baseURL &&
			typeof axios.defaults.baseURL === 'string' &&
			axios.defaults.baseURL.includes('http://app.eliteew.ru')
		) {
			axios.defaults.baseURL = axios.defaults.baseURL.replace(
				/http:\/\/app\.empery\.world/g,
				'https://app.eliteew.ru'
			);
			log.error(
				'axiosSetup',
				`❌ [axios.getUri] Fixed HTTP axios.defaults.baseURL: ${axios.defaults.baseURL}`
			);
		}

		const uri = originalGetUri.call(this, config);

		// Исправляем HTTP в результирующем URI
		if (uri?.includes('http://app.eliteew.ru')) {
			const fixedUri = uri.replace(
				/http:\/\/app\.empery\.world/g,
				'https://app.eliteew.ru'
			);
			log.error(
				'axiosSetup',
				`❌ [axios.getUri] CRITICAL: HTTP URL detected and fixed! ${uri} → ${fixedUri}`
			);
			log.error('axiosSetup', '❌ [axios.getUri] Config', undefined, {
				url: config.url,
				baseURL: config.baseURL,
				axiosDefaultsBaseURL: axios.defaults.baseURL,
				windowLocationOrigin: window.location.origin,
			});
			return fixedUri;
		}
		return uri;
	};

	// 🔥 КРИТИЧНО: Перехватываем адаптер axios для исправления URL на самом низком уровне
	// Axios использует адаптер для выполнения запросов, нужно перехватить его
	try {
		// Получаем дефолтный адаптер для браузера
		const defaultAdapter = axios.getAdapter(['xhr', 'http']);

		// Переопределяем axios.defaults.adapter
		axios.defaults.adapter = (config: InternalAxiosRequestConfig) => {
			// 🔥 ТЕЛЕМЕТРИЯ: Записываем событие в адаптере ДО исправлений
			// Используем оригинальный getUri чтобы получить реальный URL
			try {
				const fullUrlBeforeFix = originalGetUri(config);
				if (fullUrlBeforeFix?.includes('http://app.eliteew.ru')) {
					log.error(
						'axiosSetup',
						`🔴 [TELEMETRY] HTTP URL detected in adapter! ${fullUrlBeforeFix}`
					);
					log.error('axiosSetup', '🔴 [TELEMETRY] Config snapshot', undefined, {
						url: config.url,
						baseURL: config.baseURL,
						axiosDefaultsBaseURL: axios.defaults.baseURL,
						windowLocationOrigin: window.location.origin,
						windowLocationProtocol: window.location.protocol,
					});

					// ✅ FIX: Удалена телеметрия
				}
			} catch (_e) {
				// Игнорируем ошибки
			}

			// Исправляем HTTP URL в конфиге ПЕРЕД выполнением запроса
			if (
				config.url &&
				typeof config.url === 'string' &&
				config.url.includes('http://app.eliteew.ru')
			) {
				config.url = config.url.replace(
					/http:\/\/app\.empery\.world/g,
					'https://app.eliteew.ru'
				);
				log.error(
					'axiosSetup',
					`❌ [axios adapter] Fixed HTTP in config.url: ${config.url}`
				);
			}
			if (
				config.baseURL &&
				typeof config.baseURL === 'string' &&
				config.baseURL.includes('http://app.eliteew.ru')
			) {
				config.baseURL = config.baseURL.replace(
					/http:\/\/app\.empery\.world/g,
					'https://app.eliteew.ru'
				);
				log.error(
					'axiosSetup',
					`❌ [axios adapter] Fixed HTTP in config.baseURL: ${config.baseURL}`
				);
			}
			if (
				axios.defaults.baseURL &&
				typeof axios.defaults.baseURL === 'string' &&
				axios.defaults.baseURL.includes('http://app.eliteew.ru')
			) {
				axios.defaults.baseURL = axios.defaults.baseURL.replace(
					/http:\/\/app\.empery\.world/g,
					'https://app.eliteew.ru'
				);
				log.error(
					'axiosSetup',
					`❌ [axios adapter] Fixed HTTP in axios.defaults.baseURL: ${axios.defaults.baseURL}`
				);
			}

			// Получаем полный URL для проверки
			try {
				const fullUrl = axios.getUri(config);
				if (fullUrl?.includes('http://app.eliteew.ru')) {
					log.error(
						'axiosSetup',
						`❌ [axios adapter] CRITICAL: HTTP URL detected! Full URL: ${fullUrl}`
					);
					log.error('axiosSetup', '❌ [axios adapter] Config', undefined, {
						url: config.url,
						baseURL: config.baseURL,
						axiosDefaultsBaseURL: axios.defaults.baseURL,
						windowLocationOrigin: window.location.origin,
					});

					// Пытаемся исправить - удаляем HTTP baseURL
					if (config.baseURL?.includes('http://app.eliteew.ru')) {
						config.baseURL = undefined;
					}
					if (axios.defaults.baseURL?.includes('http://app.eliteew.ru')) {
						axios.defaults.baseURL = undefined;
					}

					// Пересчитываем URL после исправления
					const fixedUrl = axios.getUri(config);
					if (fixedUrl?.includes('http://app.eliteew.ru')) {
						// Если все еще HTTP, заменяем напрямую
						config.url = fixedUrl.replace(
							/http:\/\/app\.empery\.world/g,
							'https://app.eliteew.ru'
						);
						log.error(
							'axiosSetup',
							`❌ [axios adapter] CRITICAL: Direct URL fix applied: ${config.url}`
						);
					}
				}
			} catch (_e) {
				// Игнорируем ошибки
			}

			// Используем оригинальный адаптер
			return defaultAdapter(config);
		};

		log.info('axiosSetup', '✅ Axios adapter перехвачен');
	} catch (e) {
		log.warn('axiosSetup', '⚠️ Не удалось перехватить адаптер', e);
	}

	// Также перехватываем axios.getUri для исправления HTTP URL
	axios.getUri = function (config: AxiosRequestConfig): string {
		// Исправляем HTTP в конфиге ПЕРЕД построением URI
		if (
			config.baseURL &&
			typeof config.baseURL === 'string' &&
			config.baseURL.includes('http://app.eliteew.ru')
		) {
			config.baseURL = config.baseURL.replace(
				/http:\/\/app\.empery\.world/g,
				'https://app.eliteew.ru'
			);
			log.error(
				'axiosSetup',
				`❌ [axios.getUri] Fixed HTTP baseURL: ${config.baseURL}`
			);
		}
		if (
			axios.defaults.baseURL &&
			typeof axios.defaults.baseURL === 'string' &&
			axios.defaults.baseURL.includes('http://app.eliteew.ru')
		) {
			axios.defaults.baseURL = axios.defaults.baseURL.replace(
				/http:\/\/app\.empery\.world/g,
				'https://app.eliteew.ru'
			);
			log.error(
				'axiosSetup',
				`❌ [axios.getUri] Fixed HTTP axios.defaults.baseURL: ${axios.defaults.baseURL}`
			);
		}

		const uri = originalGetUri.call(this, config);

		// Исправляем HTTP в результирующем URI
		if (uri?.includes('http://app.eliteew.ru')) {
			const fixedUri = uri.replace(
				/http:\/\/app\.empery\.world/g,
				'https://app.eliteew.ru'
			);
			log.error(
				'axiosSetup',
				`❌ [axios.getUri] CRITICAL: HTTP URL detected and fixed! ${uri} → ${fixedUri}`
			);
			log.error('axiosSetup', '❌ [axios.getUri] Config', undefined, {
				url: config.url,
				baseURL: config.baseURL,
				axiosDefaultsBaseURL: axios.defaults.baseURL,
				windowLocationOrigin: window.location.origin,
			});
			return fixedUri;
		}
		return uri;
	};

	log.info(
		'axiosSetup',
		'✅ XMLHttpRequest.open и axios.getUri перехвачены ПЕРВЫМИ'
	);
}

// CRITICAL: Intercept and fix any attempts to set HTTP baseURL (used by patches)
if (typeof window !== 'undefined') {
	const originalDefaults = axios.defaults;
	let _baseURL = originalDefaults.baseURL;

	Object.defineProperty(originalDefaults, 'baseURL', {
		get: () => {
			if (_baseURL && typeof _baseURL === 'string') {
				if (
					_baseURL.includes('http://app.eliteew.ru') ||
					_baseURL.startsWith('http://')
				) {
					const fixed = _baseURL
						.replace(/http:\/\/app\.empery\.world/g, 'https://app.eliteew.ru')
						.replace(/^http:\/\//, 'https://');
					if (fixed !== _baseURL) {
						log.warn(
							'axiosSetup',
							`⚠️ [axios] Fixed HTTP baseURL on read: ${_baseURL} → ${fixed}`
						);
						_baseURL = fixed;
					}
				}
			}
			return _baseURL;
		},
		set: (value) => {
			if (value && typeof value === 'string') {
				if (
					value.includes('http://app.eliteew.ru') ||
					value.startsWith('http://')
				) {
					const fixed = value
						.replace(/http:\/\/app\.empery\.world/g, 'https://app.eliteew.ru')
						.replace(/^http:\/\//, 'https://');
					log.warn(
						'axiosSetup',
						`⚠️ [axios] Intercepted HTTP baseURL assignment, fixing: ${value} → ${fixed}`
					);
					_baseURL = fixed;
					return;
				}
			}
			_baseURL = value;
		},
		configurable: true,
		enumerable: true,
	});
}

export default axios;
