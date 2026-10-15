/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Portal handoff state + handlers for TunnelScreen — retail userspace
 * W-transport only (system wg_* is ops-system-wg / fail-closed).
 *
 * Invariants:
 * - Gate on → never call wg_install / wg_bring_up (no dual bring-up).
 * - Gate off → legacy system path unchanged.
 * - Retail recover/start uses keyring only — WG private key never enters JS (F-04).
 * - No channel-conf paste or seat bring-up IPC from WebView.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §3.3
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-04
 */

import { useCallback, useEffect, useState } from 'react';
import {
	type WgPortalStatus,
	type WTransportStatus,
	wTransportL7Probe,
	wTransportRecoverFromKeyring,
	wTransportStatus,
	wTransportStop,
} from '../lib/tauri-bridge/commands';
import { wTransportToPortalStatus } from '../lib/tunnel/wTransportPortalMap';

export type TunnelTransportMode = 'system' | 'w_transport';

function wgError(
	code: string,
	err: unknown,
	confPresent: boolean
): WgPortalStatus {
	const raw = err instanceof Error ? err.message : String(err);
	if (raw.includes('channel_unstable')) {
		return {
			ok: false,
			code: 'channel_unstable',
			message: 'Соединение нестабильно. Нажмите «Проверить соединение».',
			unit_active: false,
			conf_present: confPresent,
		};
	}
	if (raw.includes('sealed_peer_missing')) {
		return {
			ok: false,
			code: 'idle',
			message: 'Защищённый канал не запущен',
			unit_active: false,
			conf_present: false,
		};
	}
	return {
		ok: false,
		code,
		message: raw,
		unit_active: false,
		conf_present: confPresent,
	};
}

export function useWgPortal() {
	const [wg, setWg] = useState<WgPortalStatus | null>(null);
	const [wgBusy, setWgBusy] = useState(false);
	const [allowSgSkip, setAllowSgSkip] = useState(false);
	const [transportMode, setTransportMode] =
		useState<TunnelTransportMode>('w_transport');

	const withWgBusy = useCallback(async (fn: () => Promise<void>) => {
		setWgBusy(true);
		try {
			await fn();
		} finally {
			setWgBusy(false);
		}
	}, []);

	const probeTransportMode =
		useCallback(async (): Promise<TunnelTransportMode> => {
			try {
				await wTransportStatus();
				const mode: TunnelTransportMode = 'w_transport';
				setTransportMode(mode);
				return mode;
			} catch {
				setTransportMode('w_transport');
				return 'w_transport';
			}
		}, []);

	useEffect(() => {
		void probeTransportMode();
	}, [probeTransportMode]);

	const applyWTransport = useCallback(
		async (
			st: WTransportStatus,
			confPresent: boolean,
			opts?: { probeL7?: boolean }
		) => {
			setTransportMode('w_transport');
			let l7Ok: boolean | undefined;
			if (opts?.probeL7 && st.ok && st.socks_listening) {
				try {
					const probe = await wTransportL7Probe();
					l7Ok = probe.ok;
				} catch {
					l7Ok = false;
				}
			}
			setWg(wTransportToPortalStatus(st, confPresent, { l7Ok }));
		},
		[]
	);

	const handleValidate = useCallback(async () => {
		await withWgBusy(async () => {
			setWg({
				ok: true,
				code: 'w_transport_keyring_only',
				message:
					'Конфиг канала хранится только в приложении. Импортируйте Capsule (.ecap), затем нажмите «Подключить».',
				unit_active: false,
				conf_present: Boolean(wg?.conf_present),
			});
		});
	}, [wg?.conf_present, withWgBusy]);

	const handleInstall = useCallback(async () => {
		await withWgBusy(async () => {
			const mode = await probeTransportMode();
			try {
				if (mode === 'w_transport') {
					setWg({
						ok: false,
						code: 'reconnecting',
						message: 'Подключение…',
						unit_active: false,
						conf_present: Boolean(wg?.conf_present),
					});
					const st = await wTransportRecoverFromKeyring();
					await applyWTransport(st, true, { probeL7: true });
					return;
				}
				setWg({
					ok: false,
					code: 'ops_system_wg_required',
					message:
						'Системный канал доступен только в служебной сборке. Используйте защищённый канал приложения.',
					unit_active: false,
					conf_present: false,
				});
			} catch (err) {
				setWg(wgError('install_error', err, Boolean(wg?.conf_present)));
			}
		});
	}, [applyWTransport, probeTransportMode, wg?.conf_present, withWgBusy]);

	const handleBringUp = useCallback(async () => {
		await withWgBusy(async () => {
			const mode = await probeTransportMode();
			try {
				if (mode === 'w_transport') {
					setWg({
						ok: false,
						code: 'reconnecting',
						message: 'Подключение…',
						unit_active: false,
						conf_present: Boolean(wg?.conf_present),
					});
					const st = await wTransportRecoverFromKeyring();
					await applyWTransport(st, true, { probeL7: true });
					return;
				}
				setWg({
					ok: false,
					code: 'ops_system_wg_required',
					message: 'Системный канал доступен только в служебной сборке.',
					unit_active: false,
					conf_present: Boolean(wg?.conf_present),
				});
			} catch (err) {
				setWg(wgError('bring_up_error', err, Boolean(wg?.conf_present)));
			}
		});
	}, [applyWTransport, probeTransportMode, wg?.conf_present, withWgBusy]);

	const handleRefreshWg = useCallback(async () => {
		await withWgBusy(async () => {
			const mode = await probeTransportMode();
			try {
				if (mode === 'w_transport') {
					let st = await wTransportStatus();
					if (!(st.ok && st.socks_listening)) {
						setWg({
							ok: false,
							code: 'reconnecting',
							message: 'Восстанавливаем защищённый канал…',
							unit_active: false,
							conf_present: Boolean(wg?.conf_present),
						});
						try {
							st = await wTransportRecoverFromKeyring();
						} catch (err) {
							setWg(
								wgError('channel_unstable', err, Boolean(wg?.conf_present))
							);
							return;
						}
					}
					await applyWTransport(
						st,
						st.socks_listening || Boolean(wg?.conf_present),
						{ probeL7: true }
					);
					return;
				}
				setWg({
					ok: false,
					code: 'ops_system_wg_required',
					message: 'Системный канал доступен только в служебной сборке.',
					unit_active: false,
					conf_present: false,
				});
			} catch (err) {
				setWg(wgError('status_error', err, false));
			}
		});
	}, [applyWTransport, probeTransportMode, wg?.conf_present, withWgBusy]);

	const handleBringDown = useCallback(async () => {
		await withWgBusy(async () => {
			const mode = await probeTransportMode();
			try {
				if (mode === 'w_transport') {
					await applyWTransport(await wTransportStop(), Boolean(wg?.conf_present), {
						probeL7: false,
					});
					return;
				}
				setWg({
					ok: false,
					code: 'ops_system_wg_required',
					message: 'Системный канал доступен только в служебной сборке.',
					unit_active: false,
					conf_present: Boolean(wg?.conf_present),
				});
			} catch (err) {
				setWg(wgError('bring_down_error', err, true));
			}
		});
	}, [applyWTransport, probeTransportMode, wg?.conf_present, withWgBusy]);

	const handleRevealStaged = useCallback(async () => {
		await withWgBusy(async () => {
			const mode = await probeTransportMode();
			if (mode === 'w_transport') {
				setWg({
					ok: true,
					code: 'w_transport_no_system_stage',
					message:
						'Канал работает в приложении — системный WireGuard не используется',
					unit_active: Boolean(wg?.unit_active),
					conf_present: Boolean(wg?.conf_present),
				});
				return;
			}
			setWg({
				ok: false,
				code: 'ops_system_wg_required',
				message: 'Системный канал доступен только в служебной сборке.',
				unit_active: false,
				conf_present: false,
			});
		});
	}, [probeTransportMode, wg?.conf_present, wg?.unit_active, withWgBusy]);

	return {
		wg,
		setWg,
		wgBusy,
		setWgBusy,
		allowSgSkip,
		setAllowSgSkip,
		transportMode,
		handleValidate,
		handleInstall,
		handleBringUp,
		handleRefreshWg,
		handleBringDown,
		handleRevealStaged,
	};
}
