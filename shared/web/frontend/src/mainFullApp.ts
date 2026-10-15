/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full SPA bootstrap: start bounded OIDC immediately, then load cold i18n and
 * the React application graph in parallel. Static preloader stays until React commit.
 *
 * Invariants:
 * - Loaded only when tabBootstrap resolves leader/skip (not follower minimal entry).
 * - Auth errors/timeouts do not block mounting AuthProvider + App.
 * - Native OIDC profile modules are imported only for matching runtimes.
 *
 * Related:
 * - `main.tsx`, `reactAppEntry.ts`, `services/boot/authBootstrap.ts`
 * - `documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md`
 */

import { bypassPreloaderMinBudget } from './utils/appPreloader';
import { log } from './utils/logger';
import { isReloadHoldActive } from './services/maintenance/reloadCircuitBreaker';
import { runAuthBootstrap } from './services/boot/authBootstrap';
import {
	markBootPerformance,
	measureBootPerformance,
} from './services/boot/bootPerformance';
import {
	clearChunkReloadFlag,
	handleChunkLoadFailure,
	showRecoveryHoldOverlay,
	startDeployVersionWatcher,
} from './utils/staleBundleReload';

let fullAppStarted = false;

async function prefetchMaintenanceStatusEarly(): Promise<void> {
	try {
		const { fetchMaintenanceStatus, publishMaintenanceStatus } = await import(
			'./services/maintenance/maintenanceState'
		);
		publishMaintenanceStatus(await fetchMaintenanceStatus());
	} catch {
		try {
			const { fetchStaticMaintenanceStatus, publishMaintenanceStatus } =
				await import('./services/maintenance/maintenanceState');
			publishMaintenanceStatus(await fetchStaticMaintenanceStatus());
		} catch {
			/* HTTP interceptors may publish maintenance from 503 later */
		}
	}
}

function prepareRecoveryHoldBoot(): void {
	if (!isReloadHoldActive()) {
		return;
	}
	showRecoveryHoldOverlay();
}

if (typeof window !== 'undefined') {
	window.addEventListener(
		'error',
		(ev) => {
			const t = ev.target;
			if (
				t &&
				typeof t === 'object' &&
				(t as HTMLScriptElement).tagName === 'SCRIPT' &&
				(t as HTMLScriptElement).src
			) {
				const src = (t as HTMLScriptElement).src;
				if (
					src.includes('/assets/') &&
					src.startsWith(window.location.origin)
				) {
					ev.preventDefault();
					handleChunkLoadFailure();
				}
			}
		},
		true
	);

	window.addEventListener('unhandledrejection', (event) => {
		const reason = event?.reason;
		if (reason instanceof Error && reason.name === 'AbortError') {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		const msg = reason instanceof Error ? reason.message : String(reason ?? '');
		const isChunk404 =
			/loading chunk|chunk load failed|dynamically imported module|importing a module script failed|import.*script.*failed|failed to fetch.*\/assets\/|error loading dynamically imported module/i.test(
				msg
			);
		if (isChunk404) {
			event.preventDefault();
			handleChunkLoadFailure();
			return;
		}
		const isNetworkOrApi =
			/failed to fetch|network error|load failed|axios error/i.test(msg) ||
			(reason && typeof reason === 'object' && 'isAxiosError' in reason);
		if (isNetworkOrApi) {
			import('./services/maintenance/recoveryNotificationGuard')
				.then(({ shouldSuppressApiErrorToast }) => {
					if (shouldSuppressApiErrorToast(reason)) {
						return;
					}
					return import('./services/api/error-handler').then(
						({ handleAPIError }) => {
							handleAPIError(reason);
						}
					);
				})
				.catch(() => {});
		}
	});
}

function showError(error: unknown): void {
	const root = document.getElementById('root');
	if (!root) return;

	const message = error instanceof Error ? error.message : String(error);
	root.textContent = '';

	const wrapper = document.createElement('div');
	wrapper.style.cssText =
		'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1a1a1a;color:#fff;padding:40px;text-align:center';

	const heading = document.createElement('h1');
	heading.textContent = 'Не удалось открыть EliteEW';
	heading.style.cssText = 'color:#ef4444;margin-bottom:20px';

	const body = document.createElement('p');
	body.textContent =
		'Проверьте соединение и попробуйте ещё раз. Технические детали скрыты.';
	body.style.cssText = 'color:#f59e0b;margin-bottom:30px';
	body.title = message;

	const button = document.createElement('button');
	button.type = 'button';
	button.textContent = 'Повторить';
	button.style.cssText =
		'padding:12px 24px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer';
	button.addEventListener('click', () => window.location.reload());

	wrapper.append(heading, body, button);
	root.append(wrapper);
}

async function loadApp(): Promise<void> {
	if (fullAppStarted) {
		return;
	}
	fullAppStarted = true;
	markBootPerformance('full-entry-start');
	try {
		const authTask = runAuthBootstrap();
		const i18nTask = import('./i18n/config').then(async (mod) => {
			await mod.i18nReady;
			markBootPerformance('i18n-cold-ready');
		});
		const appTask = import('./reactAppEntry').then((mod) => {
			markBootPerformance('app-module-ready');
			return mod;
		});

		const [authOutcome, , appModule] = await Promise.all([
			authTask,
			i18nTask,
			appTask,
		]);
		if (authOutcome.status === 'authenticated') {
			bypassPreloaderMinBudget();
		}
		measureBootPerformance('auth-parallel', 'auth-start', 'auth-settled');
		markBootPerformance('react-render-requested');
		appModule.mountReactApplication();
		clearChunkReloadFlag();
		log.info('Main', 'App loaded');
	} catch (error) {
		fullAppStarted = false;
		log.error(
			'Main',
			'Failed to load app',
			error instanceof Error ? error : undefined,
			error instanceof Error ? undefined : error
		);
		showError(error);
	}
}

startDeployVersionWatcher();
void prefetchMaintenanceStatusEarly();
prepareRecoveryHoldBoot();
void loadApp();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
	window.addEventListener('load', async () => {
		try {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(
				registrations.map((registration) => registration.unregister())
			);
		} catch {
			// Ignore SW cleanup failures.
		}
	});
}

log.info('Main', '🚀 EliteEW Empery World');
