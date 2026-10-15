/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FoFline SPA pack sync after allow_fofline — progress, retry, L4 skew, A2 groups.
 *
 * Invariants:
 * - No sync when allowFofline !== true.
 * - Ready local pack stays Start-eligible while update_available (no silent mix).
 * - Auto-sync only for missing/error — never auto-replace a ready pack (L4 CTA).
 * - After core ready, schedule optional asset groups (Start not blocked).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md L2 / L4 / §17.4
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	foflineSpaAssetsSync,
	foflineSpaPackCheckUpdate,
	foflineSpaPackStatus,
	foflineSpaPackSync,
	type FoflineSpaPackStatusView,
} from '../lib/tauri-bridge/commands';
import { humanizeFoflineSpaPack } from '../lib/ui/statusCopy';

export type FoflineSpaPackUi = {
	state: string;
	code: string;
	message: string;
	appBuildId: string | null;
	remoteAppBuildId: string | null;
	updateAvailable: boolean;
	progressBytes: number | null;
	progressTotal: number | null;
	groupsReady: number;
	groupsTotal: number;
	groupsSyncing: boolean;
	activeGroupId: string | null;
	busy: boolean;
	canRetry: boolean;
	/** L4: offer SPA pack update without implying shell updater. */
	canUpdate: boolean;
};

function toUi(view: FoflineSpaPackStatusView, busy: boolean): FoflineSpaPackUi {
	const state = view.state || 'pack_missing';
	const updateAvailable = Boolean(view.update_available);
	const remoteAppBuildId = view.remote_app_build_id ?? null;
	const appBuildId = view.app_build_id ?? null;
	const code = view.code;
	const groupsReady = view.groups_ready ?? 0;
	const groupsTotal = view.groups_total ?? 0;
	const groupsSyncing = Boolean(view.groups_syncing);
	const activeGroupId = view.active_group_id ?? null;
	return {
		state,
		code,
		message: humanizeFoflineSpaPack(code, view.message, {
			state,
			progressBytes: view.progress_bytes ?? null,
			progressTotal: view.progress_total ?? null,
			appBuildId,
			remoteAppBuildId,
			updateAvailable,
			groupsReady,
			groupsTotal,
			groupsSyncing,
			activeGroupId,
		}),
		appBuildId,
		remoteAppBuildId,
		updateAvailable,
		progressBytes: view.progress_bytes ?? null,
		progressTotal: view.progress_total ?? null,
		groupsReady,
		groupsTotal,
		groupsSyncing,
		activeGroupId,
		busy: busy || groupsSyncing,
		canRetry:
			!busy &&
			!groupsSyncing &&
			!updateAvailable &&
			(state === 'error' ||
				state === 'pack_missing' ||
				view.code === 'offline_skip' ||
				view.code.startsWith('offline_skip')),
		canUpdate: !busy && !groupsSyncing && updateAvailable && state === 'ready',
	};
}

export function useFoflineSpaPack(opts: {
	allowFofline: boolean | null;
	setLauncherDetail: (detail: string) => void;
}) {
	const { allowFofline, setLauncherDetail } = opts;
	const [pack, setPack] = useState<FoflineSpaPackUi>({
		state: 'pack_missing',
		code: 'idle',
		message: '',
		appBuildId: null,
		remoteAppBuildId: null,
		updateAvailable: false,
		progressBytes: null,
		progressTotal: null,
		groupsReady: 0,
		groupsTotal: 0,
		groupsSyncing: false,
		activeGroupId: null,
		busy: false,
		canRetry: false,
		canUpdate: false,
	});
	const syncInFlight = useRef(false);
	const autoStarted = useRef(false);
	const assetsStarted = useRef(false);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const ensureAssetsSync = useCallback(async () => {
		if (allowFofline !== true || assetsStarted.current) return;
		assetsStarted.current = true;
		try {
			const view = await foflineSpaAssetsSync(true);
			setPack(toUi(view, syncInFlight.current));
		} catch {
			assetsStarted.current = false;
		}
	}, [allowFofline]);

	const refreshStatus = useCallback(async () => {
		if (allowFofline !== true) {
			setPack({
				state: 'denied',
				code: 'allow_fofline_required',
				message: humanizeFoflineSpaPack('allow_fofline_required'),
				appBuildId: null,
				remoteAppBuildId: null,
				updateAvailable: false,
				progressBytes: null,
				progressTotal: null,
				groupsReady: 0,
				groupsTotal: 0,
				groupsSyncing: false,
				activeGroupId: null,
				busy: false,
				canRetry: false,
				canUpdate: false,
			});
			return;
		}
		try {
			const view = await foflineSpaPackStatus(true);
			setPack(toUi(view, syncInFlight.current));
		} catch (err) {
			setPack({
				state: 'error',
				code: 'status_failed',
				message:
					err instanceof Error
						? err.message
						: 'Не удалось проверить рабочую среду FoFline',
				appBuildId: null,
				remoteAppBuildId: null,
				updateAvailable: false,
				progressBytes: null,
				progressTotal: null,
				groupsReady: 0,
				groupsTotal: 0,
				groupsSyncing: false,
				activeGroupId: null,
				busy: false,
				canRetry: true,
				canUpdate: false,
			});
		}
	}, [allowFofline]);

	const checkRemoteUpdate = useCallback(async () => {
		if (allowFofline !== true || syncInFlight.current) return;
		try {
			const view = await foflineSpaPackCheckUpdate(true);
			setPack(toUi(view, false));
		} catch {
			// Keep last local status; do not invent update success/failure UX.
		}
	}, [allowFofline]);

	const handleSync = useCallback(async () => {
		if (allowFofline !== true) {
			setLauncherDetail(
				'Эта лицензия не включает FoFline — загрузка среды недоступна'
			);
			return;
		}
		if (syncInFlight.current) return;
		syncInFlight.current = true;
		setPack((prev) => ({
			...prev,
			busy: true,
			state: 'downloading',
			code: 'downloading',
			updateAvailable: false,
			canUpdate: false,
			message: humanizeFoflineSpaPack('downloading', undefined, {
				state: 'downloading',
				progressBytes: prev.progressBytes,
				progressTotal: prev.progressTotal,
				appBuildId: prev.appBuildId,
			}),
			canRetry: false,
		}));
		setLauncherDetail('Загрузка рабочей среды FoFline…');

		if (pollRef.current) clearInterval(pollRef.current);
		pollRef.current = setInterval(() => {
			void refreshStatus();
		}, 500);

		try {
			const view = await foflineSpaPackSync(true);
			const ui = toUi(view, false);
			setPack(ui);
			setLauncherDetail(ui.message);
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: 'Не удалось загрузить рабочую среду FoFline';
			setPack({
				state: 'error',
				code: 'sync_failed',
				message: humanizeFoflineSpaPack('sync_failed', msg),
				appBuildId: null,
				remoteAppBuildId: null,
				updateAvailable: false,
				progressBytes: null,
				progressTotal: null,
				groupsReady: 0,
				groupsTotal: 0,
				groupsSyncing: false,
				activeGroupId: null,
				busy: false,
				canRetry: true,
				canUpdate: false,
			});
			setLauncherDetail(humanizeFoflineSpaPack('sync_failed', msg));
		} finally {
			syncInFlight.current = false;
			if (pollRef.current) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}
			await refreshStatus();
			await checkRemoteUpdate();
			await ensureAssetsSync();
		}
	}, [
		allowFofline,
		checkRemoteUpdate,
		ensureAssetsSync,
		refreshStatus,
		setLauncherDetail,
	]);

	useEffect(() => {
		if (allowFofline !== true) {
			autoStarted.current = false;
			assetsStarted.current = false;
			setPack({
				state: 'denied',
				code: 'allow_fofline_required',
				message: '',
				appBuildId: null,
				remoteAppBuildId: null,
				updateAvailable: false,
				progressBytes: null,
				progressTotal: null,
				groupsReady: 0,
				groupsTotal: 0,
				groupsSyncing: false,
				activeGroupId: null,
				busy: false,
				canRetry: false,
				canUpdate: false,
			});
			return;
		}
		void (async () => {
			await refreshStatus();
			if (autoStarted.current || syncInFlight.current) return;
			const view = await foflineSpaPackStatus(true).catch(() => null);
			if (
				view &&
				(view.state === 'pack_missing' ||
					view.state === 'error' ||
					view.code === 'pack_missing')
			) {
				autoStarted.current = true;
				void handleSync();
				return;
			}
			if (view?.state === 'ready') {
				void checkRemoteUpdate();
				void ensureAssetsSync();
			}
		})();
		// Auto-start once per allow_fofline=true session; update is CTA-only.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [allowFofline]);

	useEffect(() => {
		let unlistenPack: UnlistenFn | undefined;
		let unlistenAssets: UnlistenFn | undefined;
		void listen<{ bytes?: number; total?: number | null }>(
			'fofline-spa-pack-progress',
			(event) => {
				const bytes = event.payload?.bytes ?? 0;
				const total = event.payload?.total ?? null;
				setPack((prev) => ({
					...prev,
					busy: true,
					state: 'downloading',
					code: 'downloading',
					updateAvailable: false,
					canUpdate: false,
					progressBytes: bytes,
					progressTotal: total,
					message: humanizeFoflineSpaPack('downloading', undefined, {
						state: 'downloading',
						progressBytes: bytes,
						progressTotal: total,
						appBuildId: prev.appBuildId,
					}),
				}));
			}
		).then((fn) => {
			unlistenPack = fn;
		});
		void listen<{
			phase?: string;
			group_id?: string;
			groups_ready?: number;
			groups_total?: number;
			bytes?: number;
			total?: number | null;
		}>('fofline-spa-assets-progress', (event) => {
			const p = event.payload;
			setPack((prev) => {
				const groupsReady = p?.groups_ready ?? prev.groupsReady;
				const groupsTotal = p?.groups_total ?? prev.groupsTotal;
				const groupsSyncing = p?.phase !== 'done' && p?.phase !== 'error';
				const activeGroupId = p?.group_id ?? prev.activeGroupId;
				return {
					...prev,
					groupsReady,
					groupsTotal,
					groupsSyncing,
					activeGroupId: groupsSyncing ? activeGroupId : null,
					busy: syncInFlight.current || groupsSyncing,
					progressBytes: p?.bytes ?? prev.progressBytes,
					progressTotal: p?.total ?? prev.progressTotal,
					message: humanizeFoflineSpaPack(
						groupsSyncing ? 'groups_syncing' : prev.code,
						prev.message,
						{
							state: prev.state,
							appBuildId: prev.appBuildId,
							groupsReady,
							groupsTotal,
							groupsSyncing,
							activeGroupId,
							progressBytes: p?.bytes ?? prev.progressBytes,
							progressTotal: p?.total ?? prev.progressTotal,
						}
					),
				};
			});
			if (p?.phase === 'done' || p?.phase === 'error') {
				void refreshStatus();
			}
		}).then((fn) => {
			unlistenAssets = fn;
		});
		return () => {
			unlistenPack?.();
			unlistenAssets?.();
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [refreshStatus]);

	return {
		pack,
		handleSpaPackSync: handleSync,
		refreshSpaPackStatus: refreshStatus,
		checkSpaPackUpdate: checkRemoteUpdate,
	};
}
