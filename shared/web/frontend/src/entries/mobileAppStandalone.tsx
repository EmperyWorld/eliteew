/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Isolated APK download page (/mobile-app/) — no desktop SPA, no tab leadership, no SSO registry replace.
 *
 * Invariants:
 * - Login uses sessionStorage only (persistSession: false) so desktop localStorage tokens stay untouched.
 * - redirect_uri is /mobile-app/ (path, not hash — works in Telegram in-app browser).
 *
 * Related:
 * - mobile-app/index.html, api/routers/mobile_app.py, tg_bot_ip_verif MOBILE_APP_DOWNLOAD_PAGE_URL
 */

import '@/entries/setupApkOidcProfile';
import '@/utils/axiosSetup';
import { createRoot } from 'react-dom/client';
import { useCallback, useEffect, useState } from 'react';
import {
	downloadMobileApkBlob,
	fetchMobileAppOverview,
	formatMobileBuildLabel,
	requestMobileApkDownloadTicket,
	triggerApkDownload,
	triggerApkDownloadByUrl,
	type MobileAppOverview,
} from '@/services/mobileAppApi';
import { initKeycloak, isAuthenticated, keycloak } from '@/services/keycloak';
import { normalizeRedirectUri } from '@/utils/redirectUriNormalize';
import '../styles/index.css';

function formatMib(bytes: number | null | undefined): string {
	if (bytes == null || bytes <= 0) return '—';
	return `${(bytes / (1024 * 1024)).toFixed(1)} МиБ`;
}

function MobileAppStandaloneApp(): React.ReactElement {
	const [phase, setPhase] = useState<'boot' | 'login' | 'ready'>('boot');
	const [overview, setOverview] = useState<MobileAppOverview | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);

	const loadOverview = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchMobileAppOverview();
			setOverview(data);
		} catch {
			setError(
				'Не удалось проверить доступность APK. Попробуйте обновить страницу.'
			);
			setOverview(null);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const ok = await initKeycloak();
				if (cancelled) return;
				if (ok && isAuthenticated()) {
					setPhase('ready');
					await loadOverview();
					return;
				}
				setPhase('login');
			} catch {
				if (!cancelled) {
					setPhase('login');
					setError('Ошибка инициализации входа. Обновите страницу.');
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [loadOverview]);

	const onLogin = () => {
		setError(null);
		void keycloak.login({
			persistSession: false,
			redirectUri: normalizeRedirectUri(
				`${window.location.origin}/mobile-app/`
			),
		});
	};

	const onDownload = async () => {
		if (!overview?.apk_available) {
			setError('APK на сервере пока не опубликован. Попробуйте позже.');
			return;
		}
		setDownloading(true);
		setError(null);
		try {
			const ticket = await requestMobileApkDownloadTicket();
			triggerApkDownloadByUrl(ticket.download_url);
		} catch {
			try {
				// Fallback path if ticket storage is unavailable.
				const blob = await downloadMobileApkBlob();
				triggerApkDownload(blob);
			} catch {
				setError('Не удалось скачать файл. Проверьте сеть и повторите.');
			}
		} finally {
			setDownloading(false);
		}
	};

	if (phase === 'boot') {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-200">
				<p>Загрузка…</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
			<div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl">
				<p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/90">
					Empery Mobile
				</p>
				<h1 className="mt-2 text-2xl font-semibold text-white">
					Скачать приложение Android
				</h1>
				<p className="mt-2 text-sm leading-relaxed text-slate-300">
					Отдельная страница для установки APK. Не открывает рабочий стол и не
					заменяет активную сессию в браузере на компьютере.
				</p>

				{error ? (
					<p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
						{error}
					</p>
				) : null}

				{phase === 'login' ? (
					<button
						type="button"
						onClick={onLogin}
						className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
					>
						Войти и скачать
					</button>
				) : (
					<div className="mt-6 space-y-3">
						<p className="text-sm text-slate-300">
							{overview?.apk_available
								? `Файл готов · ${formatMib(overview.apk_size_bytes)}`
								: 'APK на сервере пока недоступен — сообщите оператору.'}
						</p>
						{overview?.apk_available &&
						formatMobileBuildLabel(
							overview.version_name,
							overview.version_code
						) ? (
							<p className="text-sm text-emerald-200/90">
								Сборка на сервере:{' '}
								<span className="font-medium text-white">
									{formatMobileBuildLabel(
										overview.version_name,
										overview.version_code
									)}
								</span>
							</p>
						) : null}
						<button
							type="button"
							disabled={downloading || !overview?.apk_available}
							onClick={() => void onDownload()}
							className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{downloading ? 'Скачивание…' : 'Скачать APK'}
						</button>
						<button
							type="button"
							onClick={() => void loadOverview()}
							className="w-full rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
						>
							Обновить статус
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

const rootEl = document.getElementById('root');
if (rootEl) {
	createRoot(rootEl).render(<MobileAppStandaloneApp />);
}
