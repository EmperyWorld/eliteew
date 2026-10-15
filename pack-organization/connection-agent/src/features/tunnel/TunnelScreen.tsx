/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Portal handoff UI: keyring recover / status for retail W-transport (F-04).
 *
 * Invariants:
 * - Retail never pastes or stores channel conf in the WebView (F-04).
 * - Does not claim tunnel up without native status; SG skip is explicit.
 * - W-transport mode: no Polkit / system WireGuard GUI copy as primary path.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §F-04
 */

import type { TunnelTransportMode } from '../../hooks/useWgPortal';
import type { WgPortalStatus } from '../../lib/tauri-bridge/commands';
import { humanizeWg, tunnelTone } from '../../lib/ui/statusCopy';
import './tunnel.css';

type TunnelScreenProps = {
	status: WgPortalStatus | null;
	busy: boolean;
	transportMode?: TunnelTransportMode;
	allowSgSkip: boolean;
	onAllowSgSkipChange: (value: boolean) => void;
	onValidate: () => void;
	onInstall: () => void;
	onBringUp: () => void;
	onBringDown: () => void;
	onRevealStaged: () => void;
	onRefresh: () => void;
	onContinue: () => void;
};

function statusClass(status: WgPortalStatus | null): string {
	if (!status) return 'status status-banner';
	const tone = tunnelTone(status.ok, status.code);
	if (tone === 'ok') return 'status status-banner status-ok';
	if (tone === 'danger') return 'status status-banner status-danger';
	if (tone === 'warn') return 'status status-banner status-warn';
	return 'status status-banner';
}

export function TunnelScreen({
	status,
	busy,
	transportMode = 'system',
	allowSgSkip,
	onAllowSgSkipChange,
	onValidate,
	onInstall,
	onBringUp,
	onBringDown,
	onRevealStaged,
	onRefresh,
	onContinue,
}: TunnelScreenProps) {
	const userspace = transportMode === 'w_transport';
	const canContinue = Boolean(status?.ok) || (!userspace && allowSgSkip);
	const statusText = status
		? humanizeWg(status.code, status.message)
		: 'Статус ещё не запрошен — нажмите «Проверить» или «Обновить статус».';
	const unitActive = Boolean(status?.unit_active);
	const isWindowsHint =
		!userspace &&
		(Boolean(status?.code?.startsWith('windows_')) ||
			Boolean(status?.staged_path));

	return (
		<section className="panel tunnel-panel" aria-labelledby="tunnel-heading">
			<div className="tunnel-main">
				<p className="panel-kicker">Шаг 2 из 3 · канал</p>
				<h2 id="tunnel-heading">Защищённый канал</h2>
				<p className="lead">
					{userspace
						? 'Конфиг канала хранится только внутри приложения. Импортируйте Capsule (.ecap) на шаге лицензии, затем подключите канал — без вставки конфига и без системного VPN.'
						: 'Системный WireGuard доступен только в служебной сборке.'}
				</p>
				{userspace ? (
					<div className="drop-zone" role="note">
						<p>
							Открытый конфиг канала (<code>.conf</code>) в клиенте не
							принимается. Используйте файл Capsule.
						</p>
					</div>
				) : null}
			</div>
			<aside className="tunnel-aside" aria-label="Действия туннеля">
				<div className="tunnel-aside-actions">
					<p className="panel-kicker">Действия</p>
					<div className="actions tunnel-actions">
						<button type="button" onClick={onValidate} disabled={busy}>
							Проверить
						</button>
						<button
							type="button"
							className="primary"
							onClick={onInstall}
							disabled={busy}
						>
							{userspace ? 'Подключить канал' : 'Установить'}
						</button>
						<button type="button" onClick={onBringUp} disabled={busy}>
							{userspace ? 'Подключить снова' : 'Поднять'}
						</button>
						{unitActive ? (
							<button
								type="button"
								className="secondary"
								onClick={onBringDown}
								disabled={busy}
							>
								Отключить
							</button>
						) : null}
						<button
							type="button"
							className="secondary"
							onClick={onRefresh}
							disabled={busy}
						>
							Обновить статус
						</button>
					</div>
					{!userspace ? (
						<button
							type="button"
							className="secondary"
							onClick={onRevealStaged}
							disabled={busy}
						>
							Показать staged
						</button>
					) : null}
					{!userspace ? (
						<label className="check">
							<input
								type="checkbox"
								checked={allowSgSkip}
								onChange={(e) => onAllowSgSkipChange(e.target.checked)}
							/>
							Продолжить без канала (временно)
						</label>
					) : null}
					{isWindowsHint ? (
						<p className="muted">
							На Windows служебный путь может отличаться — используйте Capsule.
						</p>
					) : null}
					<button
						type="button"
						className="primary"
						onClick={onContinue}
						disabled={busy || !canContinue}
					>
						Далее
					</button>
				</div>
				<p className={statusClass(status)} role="status">
					{statusText}
				</p>
			</aside>
		</section>
	);
}
