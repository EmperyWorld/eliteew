/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Global planned-maintenance UX provider: polls maintenance state, listens to Socket.IO broadcasts, and renders calm
 * restart banners/overlays above the shell.
 *
 * Invariants:
 * - Maintenance UI must never redirect to Keycloak or unmount the desktop React root.
 * - On `#desktop` gate/recovering phases, fullscreen overlay is delegated to desktop inline overlay (no duplicate banner).
 * - One stable notification id is used for a whole window to avoid toast storms.
 * - Auto-reload after `completed` only when `/api/health` and maintenance API confirm recovery.
 * - Long-lived recovery stays GPU-quiet: opaque backdrop (no blur), ambientStatic, no quote rotation.
 *
 * Related:
 * - `services/maintenance/maintenanceState.ts`
 * - `App.tsx`
 */

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { notify } from '@/notifications';
import { EliteRecoveryScreen } from '@/components/ui/EliteRecoveryScreen';
import { isDesktopShellRoute } from '@/utils/desktopShellRoute';
import {
	markMaintenanceCompletionReload,
	requestMaintenanceRecoveryReload,
	requestMaintenanceReturn,
} from '@/utils/staleBundleReload';
import {
	clearReloadCircuitWhenHealthy,
	isBackendReadyForRecovery,
	isReloadHoldActive,
	shouldBlockAutoReload,
} from '@/services/maintenance/reloadCircuitBreaker';
import { Services } from '../services';
import {
	fetchMaintenanceStatusIfStale,
	fetchStaticMaintenanceStatus,
	isMaintenanceGatePhase,
	subscribeMaintenanceStatus,
	type MaintenanceStatus,
	type MaintenanceWindow,
	publishMaintenanceStatus,
} from '../services/maintenance/maintenanceState';

/**
 * Idle poll when no window is active. Socket ``system.maintenance`` is the live path;
 * HTTP is a safety net (was 15s — too chatty on idle `#desktop`).
 */
const POLL_MS = 120_000;
const ACTIVE_POLL_MS = 5_000;
/** Soft recovery readiness check while hold/active — avoid sub-2s hammering. */
const RECOVERY_RELOAD_POLL_MS = 5_000;
/** Skip a new GET when bootstrap / recovery already fetched within this window. */
const MAINTENANCE_FRESH_MS = 30_000;

type MaintenanceProviderProps = {
	children: ReactNode;
};

function formatTime(value: string | null | undefined): string | null {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return new Intl.DateTimeFormat('ru-RU', {
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
}

function getPhaseLabel(window: MaintenanceWindow): string {
	if (window.phase === 'scheduled' || window.phase === 'warning') {
		return 'Запланировано';
	}
	if (window.phase === 'draining') {
		return 'Подготавливаем переключение';
	}
	if (window.phase === 'recovering') {
		return 'Проверяем восстановление';
	}
	return 'Идёт обслуживание';
}

function getMaintenanceStatusLabel(
	window: MaintenanceWindow,
	endTime: string | null
): string {
	if (endTime) {
		return `Ориентир восстановления: ${endTime}`;
	}
	return `Следующая проверка связи через ${window.retry_after_seconds} с`;
}

function getMaintenanceNotificationCopy(window: MaintenanceWindow): {
	title: string;
	message: string;
} {
	const impact = window.user_impact?.trim();
	return {
		title: getPhaseLabel(window),
		message: impact
			? `${window.title}. ${impact}`
			: `${window.title}. Безраздельный мир восстановится автоматически, данные и раскладка сохранены.`,
	};
}

function MaintenanceOverlay({
	status,
}: {
	status: MaintenanceStatus;
}): ReactNode {
	const maintenanceWindow = status.window;
	if (!maintenanceWindow?.active) return null;

	const gatePhase = isMaintenanceGatePhase(status);
	const showOverlay = gatePhase || maintenanceWindow.phase === 'recovering';
	if (isDesktopShellRoute() && showOverlay) {
		return null;
	}

	const endTime = formatTime(maintenanceWindow.expected_ends_at);
	const statusLabel = getMaintenanceStatusLabel(maintenanceWindow, endTime);

	return (
		<>
			{!showOverlay ? (
				<div className="pointer-events-none fixed inset-x-0 top-0 z-100001 flex justify-center p-4">
					<div className="elite-maintenance-banner elite-maintenance-banner-enter pointer-events-auto w-full max-w-3xl">
						<div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
							<div>
								<div className="text-xs font-semibold tracking-[0.16em] text-lime-100">
									{getPhaseLabel(maintenanceWindow)}
								</div>
								<h2 className="mt-1 text-lg font-semibold">
									{maintenanceWindow.title}
								</h2>
								<p className="mt-1 text-sm text-slate-200">
									{maintenanceWindow.message}
								</p>
								{maintenanceWindow.user_impact ? (
									<p className="mt-2 text-xs text-slate-400">
										{maintenanceWindow.user_impact}
									</p>
								) : null}
							</div>
							<div className="elite-maintenance-banner-chip shrink-0">
								{statusLabel}
							</div>
						</div>
					</div>
				</div>
			) : null}

			{showOverlay ? (
				<div className="fixed inset-0 z-100000 pointer-events-auto">
					<div
						className="elite-recovery-backdrop absolute inset-0"
						aria-hidden
					/>
					<div className="relative flex min-h-full items-center justify-center p-5 pt-28 sm:pt-32">
						<EliteRecoveryScreen
							fullScreen={false}
							title={maintenanceWindow.title}
							statusLabel={statusLabel}
							footnote="Вкладку можно оставить открытой — восстановление автоматическое."
							panelVariant="recovery"
							ambientStatic
							actionLabel="Проверить связь"
							onAction={() => {
								void requestMaintenanceRecoveryReload(maintenanceWindow.id);
							}}
						/>
					</div>
				</div>
			) : null}
		</>
	);
}

export function MaintenanceProvider({
	children,
}: MaintenanceProviderProps): ReactNode {
	const [status, setStatus] = useState<MaintenanceStatus>({
		active: false,
		window: null,
	});
	const notifiedWindowRef = useRef<string | null>(null);
	const hadActiveWindowRef = useRef(false);
	const recoveryReloadDoneRef = useRef(false);

	useEffect(() => subscribeMaintenanceStatus(setStatus), []);

	useEffect(() => {
		const socket = Services.socket;
		return socket.addEventListener('system.maintenance', (payload: unknown) => {
			publishMaintenanceStatus(payload);
		});
	}, []);

	const activeRef = useRef(status.active);
	activeRef.current = status.active;

	useEffect(() => {
		let cancelled = false;
		// DOM timer id (number); avoid NodeJS.Timeout vs number clash under @types/node.
		let timer: number | null = null;

		const poll = async () => {
			try {
				const next = await fetchMaintenanceStatusIfStale(MAINTENANCE_FRESH_MS);
				if (!cancelled) {
					publishMaintenanceStatus(next);
				}
			} catch {
				// Static fallback is only queried when the API is unavailable, so the
				// normal healthy path does not create browser-console 404 noise.
				try {
					const fallback = await fetchStaticMaintenanceStatus();
					if (!cancelled) {
						publishMaintenanceStatus(fallback);
					}
				} catch {
					// HTTP interceptors still publish active windows from 503 payloads.
				}
			} finally {
				if (!cancelled) {
					timer = window.setTimeout(
						poll,
						activeRef.current ? ACTIVE_POLL_MS : POLL_MS
					);
				}
			}
		};

		void poll();
		return () => {
			cancelled = true;
			if (timer !== null) window.clearTimeout(timer);
		};
	}, []);

	useEffect(() => {
		if (status.active) {
			recoveryReloadDoneRef.current = false;
		}
	}, [status.active]);

	useEffect(() => {
		let cancelled = false;
		const tryRecoveryReload = async (): Promise<void> => {
			if (cancelled || recoveryReloadDoneRef.current) {
				return;
			}
			const hold = isReloadHoldActive();
			if (!hold && !status.active) {
				return;
			}
			if (!(await isBackendReadyForRecovery())) {
				return;
			}
			await clearReloadCircuitWhenHealthy();
			if (shouldBlockAutoReload('maintenance_completed')) {
				return;
			}
			recoveryReloadDoneRef.current = true;
			requestMaintenanceReturn('maintenance_completed');
		};

		const id = window.setInterval(
			() => void tryRecoveryReload(),
			RECOVERY_RELOAD_POLL_MS
		);
		void tryRecoveryReload();
		return () => {
			cancelled = true;
			window.clearInterval(id);
		};
	}, [status.active]);

	useEffect(() => {
		const windowState = status.window;
		if (
			hadActiveWindowRef.current &&
			!status.active &&
			windowState?.phase === 'completed'
		) {
			hadActiveWindowRef.current = false;
			void (async () => {
				const ready = await isBackendReadyForRecovery();
				if (!ready) {
					return;
				}
				if (shouldBlockAutoReload('maintenance_completed')) {
					return;
				}
				if (!markMaintenanceCompletionReload(windowState.id)) {
					return;
				}
				notify.info('Обслуживание завершено', 'Возвращаем Безраздельный мир.');
				window.setTimeout(
					() => requestMaintenanceReturn('maintenance_completed'),
					800
				);
			})();
			return;
		}
		if (!status.active || !windowState) {
			notifiedWindowRef.current = null;
			return;
		}
		hadActiveWindowRef.current = true;
		const notifId = windowState.id;
		if (notifiedWindowRef.current === notifId) return;
		notifiedWindowRef.current = notifId;
		const notificationCopy = getMaintenanceNotificationCopy(windowState);
		const suppressCenterToast =
			isDesktopShellRoute() &&
			(isMaintenanceGatePhase(status) || windowState.phase === 'recovering');
		if (suppressCenterToast) {
			return;
		}
		notify.warning(notificationCopy.title, notificationCopy.message, {
			duration: 7000,
			addToCenter: true,
			center: {
				id: `maintenance-${windowState.id}`,
				type: 'warning',
				title: notificationCopy.title,
				message: notificationCopy.message,
				source: 'system',
				persistent: true,
				metadata: {
					kind: 'maintenance',
					phase: windowState.phase,
					expected_ends_at: windowState.expected_ends_at,
				},
			},
		});
	}, [status]);

	const overlay = useMemo(
		() => <MaintenanceOverlay status={status} />,
		[status]
	);

	return (
		<>
			{children}
			{overlay}
		</>
	);
}
