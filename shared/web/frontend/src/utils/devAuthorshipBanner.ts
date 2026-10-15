/**
 * ------------------------------------------------------------------------------
 *  EliteEW · Empery World · https://eliteew.ru
 *  Author: po&T <keysray70@gmail.com>
 * ------------------------------------------------------------------------------
 *
 * Purpose:
 * Вывод в DevTools Console строки и стилизованного блока авторства (production и development).
 *
 * Invariants:
 * - Не выполнять вне браузера (`window`); вывод отложен на `setTimeout(0)` после системных логов навигации.
 *
 * Related:
 * - `boot-dev-banner.ts`
 */

function scheduleAfterNavigationLogs(run: () => void): void {
	globalThis.setTimeout(run, 0);
}

/** Баннер авторства в консоли браузера (dev и production). */
export function printAuthorshipConsoleBanner(): void {
	if (typeof globalThis.window === 'undefined') {
		return;
	}

	scheduleAfterNavigationLogs(() => {
		if (typeof globalThis.console === 'undefined') {
			return;
		}

		const mode = import.meta.env.PROD ? 'production' : 'development';

		globalThis.console.info(
			`[EliteEW · Empery World — ${mode}] Author: po&T <keysray70@gmail.com> · https://eliteew.ru`
		);

		const rule =
			'color:#6366f1;font-family:ui-monospace,Consolas,monospace;font-size:11px';
		const title =
			'color:#a5b4fc;font-weight:700;font-size:13px;font-family:system-ui,sans-serif';
		const muted =
			'color:#94a3b8;font-size:12px;font-family:system-ui,sans-serif';
		const label =
			'color:#c4b5fd;font-weight:600;font-family:system-ui,sans-serif';

		globalThis.console.log(
			'%c──────────────────────────────────────────────────────────────',
			rule
		);
		globalThis.console.log('%c  EliteEW · Empery World', title);
		globalThis.console.log('%c  https://eliteew.ru', muted);
		globalThis.console.log(
			'%c  Author: %cpo&T%c <keysray70@gmail.com>',
			muted,
			label,
			muted
		);
		globalThis.console.log(
			'%c──────────────────────────────────────────────────────────────',
			rule
		);
	});
}
