/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Custom in-launcher host network panel (wired + Wi‑Fi) — no NetworkManager GUI.
 *
 * Invariants:
 * - Available without entitlement (Activation / Hub).
 * - Distinct from «Соединение» (W-transport channel).
 * - Honest empty / permission / unsupported states.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.x host network
 * - lib/tauri-bridge/commands.ts hostNetwork*
 */

import { useCallback, useEffect, useId, useState } from 'react';
import {
	hostNetworkStatus,
	hostNetworkWifiConnect,
	hostNetworkWifiDisconnect,
	hostNetworkWifiScan,
	hostNetworkWiredApply,
	type HostNetworkStatusView,
	type HostWifiApView,
} from '../../lib/tauri-bridge/commands';
import './hostNetwork.css';

function invokeErrMessage(err: unknown, fallback: string): string {
	if (typeof err === 'string' && err.trim()) return err;
	if (err instanceof Error && err.message) return err.message;
	if (err && typeof err === 'object' && 'message' in err) {
		const m = (err as { message?: unknown }).message;
		if (typeof m === 'string' && m.trim()) return m;
	}
	return fallback;
}

export type HostNetworkPanelProps = {
	/** Compact overlay vs Hub section. */
	variant?: 'sheet' | 'section';
	onClose?: () => void;
};

export function HostNetworkPanel({
	variant = 'section',
	onClose,
}: HostNetworkPanelProps) {
	const titleId = useId();
	const [status, setStatus] = useState<HostNetworkStatusView | null>(null);
	const [aps, setAps] = useState<HostWifiApView[]>([]);
	const [busy, setBusy] = useState(false);
	const [hint, setHint] = useState<string | null>(null);
	const [wiredIf, setWiredIf] = useState('');
	const [mode, setMode] = useState<'dhcp' | 'static'>('dhcp');
	const [address, setAddress] = useState('192.168.8.10/30');
	const [gateway, setGateway] = useState('192.168.8.9');
	const [dns, setDns] = useState('192.168.1.1');
	const [ssid, setSsid] = useState('');
	const [password, setPassword] = useState('');

	const refresh = useCallback(async () => {
		setBusy(true);
		setHint(null);
		try {
			const next = await hostNetworkStatus();
			setStatus(next);
			setWiredIf((prev) => {
				if (prev) return prev;
				const wired = next.devices.find((d) => d.kind === 'ethernet');
				return wired?.name ?? '';
			});
		} catch (err) {
			setHint(invokeErrMessage(err, 'Не удалось прочитать состояние сети'));
		} finally {
			setBusy(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const ethernet = status?.devices.filter((d) => d.kind === 'ethernet') ?? [];
	const wifiDevs = status?.devices.filter((d) => d.kind === 'wifi') ?? [];

	async function applyWired() {
		if (!wiredIf) {
			setHint('Выберите сетевой адаптер');
			return;
		}
		setBusy(true);
		setHint(null);
		try {
			const res = await hostNetworkWiredApply({
				ifname: wiredIf,
				mode,
				address: mode === 'static' ? address : null,
				gateway: mode === 'static' ? gateway : null,
				dns: mode === 'static' ? dns : null,
			});
			setHint(res.message);
			if (res.ok) await refresh();
		} catch (err) {
			setHint(invokeErrMessage(err, 'Не удалось применить настройки'));
		} finally {
			setBusy(false);
		}
	}

	async function scanWifi() {
		setBusy(true);
		setHint(null);
		try {
			const list = await hostNetworkWifiScan();
			setAps(list);
			if (list.length === 0) setHint('Сети Wi‑Fi не найдены');
		} catch {
			setHint('Сканирование Wi‑Fi недоступно на этой системе');
		} finally {
			setBusy(false);
		}
	}

	async function connectWifi() {
		if (!ssid.trim()) {
			setHint('Укажите имя сети');
			return;
		}
		setBusy(true);
		setHint(null);
		try {
			const res = await hostNetworkWifiConnect({
				ssid: ssid.trim(),
				password: password || null,
				ifname: wifiDevs[0]?.name ?? null,
			});
			setHint(res.message);
			if (res.ok) {
				setPassword('');
				await refresh();
			}
		} catch (err) {
			setHint(invokeErrMessage(err, 'Не удалось подключиться к Wi‑Fi'));
		} finally {
			setBusy(false);
		}
	}

	async function disconnectWifi() {
		setBusy(true);
		setHint(null);
		try {
			const res = await hostNetworkWifiDisconnect(wifiDevs[0]?.name ?? null);
			setHint(res.message);
			if (res.ok) await refresh();
		} catch (err) {
			setHint(invokeErrMessage(err, 'Не удалось отключить Wi‑Fi'));
		} finally {
			setBusy(false);
		}
	}

	const rootClass =
		variant === 'sheet' ? 'host-network host-network--sheet' : 'host-network more-section';

	return (
		<section
			className={rootClass}
			aria-labelledby={titleId}
			data-journey="host-network-panel"
		>
			<header className="host-network-header">
				<div>
					<p className="panel-kicker">
						{variant === 'sheet' ? 'Устройство' : 'Ещё · Сеть'}
					</p>
					<h2 id={titleId} className="more-section-title">
						Сеть устройства
					</h2>
					<p className="muted host-network-lead">
						Кабель и Wi‑Fi на этом компьютере. Настройка доступна до активации
						лицензии — без окон системных менеджеров сети.
					</p>
				</div>
				{onClose ? (
					<button type="button" className="btn ghost" onClick={onClose}>
						Закрыть
					</button>
				) : null}
			</header>

			{status ? (
				<p className="host-network-backend muted" role="status">
					{status.ok
						? `Служба: ${status.message}`
						: status.message}
				</p>
			) : null}

			<div className="host-network-devices" aria-live="polite">
				{(status?.devices ?? []).length === 0 ? (
					<p className="muted">Адаптеры не обнаружены.</p>
				) : (
					<ul>
						{status?.devices.map((d) => (
							<li key={d.name}>
								<strong>{d.name}</strong>
								<span className="muted">
									{' '}
									· {d.kind} · {d.state}
									{d.ipv4.length > 0 ? ` · ${d.ipv4.join(', ')}` : ''}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="host-network-block">
				<h3>Кабель</h3>
				<label className="host-network-field">
					<span>Адаптер</span>
					<select
						value={wiredIf}
						onChange={(e) => setWiredIf(e.target.value)}
						disabled={busy || ethernet.length === 0}
					>
						<option value="">—</option>
						{ethernet.map((d) => (
							<option key={d.name} value={d.name}>
								{d.name}
							</option>
						))}
					</select>
				</label>
				<div className="host-network-modes" role="group" aria-label="Режим IP">
					<label>
						<input
							type="radio"
							name="wired-mode"
							checked={mode === 'dhcp'}
							onChange={() => setMode('dhcp')}
							disabled={busy}
						/>
						Автоматически (DHCP)
					</label>
					<label>
						<input
							type="radio"
							name="wired-mode"
							checked={mode === 'static'}
							onChange={() => setMode('static')}
							disabled={busy}
						/>
						Вручную
					</label>
				</div>
				{mode === 'static' ? (
					<div className="host-network-static">
						<label className="host-network-field">
							<span>Адрес</span>
							<input
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								disabled={busy}
								autoComplete="off"
								spellCheck={false}
							/>
						</label>
						<label className="host-network-field">
							<span>Шлюз</span>
							<input
								value={gateway}
								onChange={(e) => setGateway(e.target.value)}
								disabled={busy}
								autoComplete="off"
								spellCheck={false}
							/>
						</label>
						<label className="host-network-field">
							<span>DNS</span>
							<input
								value={dns}
								onChange={(e) => setDns(e.target.value)}
								disabled={busy}
								autoComplete="off"
								spellCheck={false}
							/>
						</label>
					</div>
				) : null}
				<button
					type="button"
					className="btn primary"
					disabled={busy || !wiredIf}
					onClick={() => void applyWired()}
				>
					Применить кабель
				</button>
			</div>

			{status?.wifiSupported ? (
				<div className="host-network-block">
					<h3>Wi‑Fi</h3>
					<div className="host-network-wifi-actions">
						<button
							type="button"
							className="btn"
							disabled={busy}
							onClick={() => void scanWifi()}
						>
							Найти сети
						</button>
						<button
							type="button"
							className="btn ghost"
							disabled={busy}
							onClick={() => void disconnectWifi()}
						>
							Отключить
						</button>
					</div>
					{aps.length > 0 ? (
						<ul className="host-network-aps">
							{aps.map((ap) => (
								<li key={`${ap.ssid}-${ap.signal}`}>
									<button
										type="button"
										className="host-network-ap"
										disabled={busy}
										onClick={() => setSsid(ap.ssid)}
									>
										<span>{ap.ssid || '(скрытая)'}</span>
										<span className="muted">
											{ap.signal}% · {ap.security || 'open'}
											{ap.inUse ? ' · сейчас' : ''}
										</span>
									</button>
								</li>
							))}
						</ul>
					) : null}
					<label className="host-network-field">
						<span>Сеть</span>
						<input
							value={ssid}
							onChange={(e) => setSsid(e.target.value)}
							disabled={busy}
							autoComplete="off"
						/>
					</label>
					<label className="host-network-field">
						<span>Пароль</span>
						<input
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={busy}
							autoComplete="new-password"
						/>
					</label>
					<button
						type="button"
						className="btn primary"
						disabled={busy || !ssid.trim()}
						onClick={() => void connectWifi()}
					>
						Подключить Wi‑Fi
					</button>
				</div>
			) : null}

			<div className="host-network-footer">
				<button
					type="button"
					className="btn ghost"
					disabled={busy}
					onClick={() => void refresh()}
				>
					Обновить
				</button>
				{hint ? (
					<p className="host-network-hint" role="status">
						{hint}
					</p>
				) : null}
			</div>
		</section>
	);
}
