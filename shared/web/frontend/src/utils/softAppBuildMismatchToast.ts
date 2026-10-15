/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Surface soft HTTP `app_build_mismatch` (response header) as a one-shot toast
 * so operators refresh after bake without waiting for Socket.IO hard gate.
 *
 * Invariants:
 * - At most one toast per browser tab session.
 * - Does not force reload (auto-reload path remains in staleBundleReload).
 *
 * Related:
 * - api/middleware/client_build_gate.py
 * - services/api/client.ts
 */
import { toast } from 'sonner';

const SESSION_KEY = 'eliteew_soft_app_build_mismatch_toast_v1';

export function notifySoftAppBuildMismatchFromHeaders(
	headers:
		| { get?(name: string): string | null | undefined }
		| Record<string, unknown>
		| null
		| undefined
): void {
	if (!headers) {
		return;
	}
	const readHeader = (name: string): string => {
		const withGet = headers as { get?: (n: string) => unknown };
		if (typeof withGet.get === 'function') {
			return String(withGet.get(name) ?? '').trim();
		}
		const rec = headers as Record<string, unknown>;
		const lower = name.toLowerCase();
		const raw = rec[name] ?? rec[lower];
		if (Array.isArray(raw)) {
			return String(raw[0] ?? '').trim();
		}
		return String(raw ?? '').trim();
	};
	const status = readHeader('x-eliteew-app-build-status').toLowerCase();
	if (status !== 'mismatch') {
		return;
	}
	try {
		if (sessionStorage.getItem(SESSION_KEY) === '1') {
			return;
		}
		sessionStorage.setItem(SESSION_KEY, '1');
	} catch {
		/* ignore storage failures */
	}
	toast.warning('Приложение обновлено на сервере — обновите страницу.', {
		duration: 12_000,
		action: {
			label: 'Обновить',
			onClick: () => {
				window.location.reload();
			},
		},
	});
}

/** Test-only reset. */
export function resetSoftAppBuildMismatchToastForTests(): void {
	try {
		sessionStorage.removeItem(SESSION_KEY);
	} catch {
		/* ignore */
	}
}
