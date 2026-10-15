/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey W6 — Ещё → Соединение: four signal levels + probe + sealed stop.
 *
 * Invariants:
 * - No peer IPs / SOCKS in primary copy.
 * - One primary check CTA (channel then license); stop-channel when sealed path provides it.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.4
 */

import { useId } from 'react';
import {
	connectionCopyLeaksInfra,
	connectionSignalFromPortalCode,
	connectionSignalHintRu,
	connectionSignalLabelRu,
	connectionSignalTone,
} from '../../../lib/launcher/journey';
import type { WgPortalStatus } from '../../../lib/tauri-bridge/commands';

export type ConnectionPanelProps = {
	wg: WgPortalStatus | null;
	onCheckChannel?: () => void;
	channelCheckBusy?: boolean;
	onStopChannel?: () => void;
	channelStopBusy?: boolean;
};

export function ConnectionPanel({
	wg,
	onCheckChannel,
	channelCheckBusy = false,
	onStopChannel,
	channelStopBusy = false,
}: ConnectionPanelProps) {
	const titleId = useId();
	const level = connectionSignalFromPortalCode(wg?.code);
	const label = connectionSignalLabelRu(level);
	const hint = connectionSignalHintRu(level);
	const tone = connectionSignalTone(level);
	const detail = (wg?.message ?? '').trim();
	const safeDetail =
		detail && !connectionCopyLeaksInfra(detail) ? detail : null;

	return (
		<section
			className="connection-panel more-section"
			aria-labelledby={titleId}
			data-journey="connection-panel"
			data-signal={level}
		>
			<p className="panel-kicker">Ещё · Соединение</p>
			<h2 id={titleId} className="more-section-title">
				Защищённый канал
			</h2>
			<p className="muted connection-panel-lead">
				Состояние канала на этом устройстве — без технических адресов.
			</p>

			<div
				className="connection-signal"
				data-tone={tone}
				role="status"
				aria-live="polite"
			>
				<span className="connection-signal-label">{label}</span>
				<p className="connection-signal-hint">{hint}</p>
				{safeDetail ? (
					<p className="muted connection-signal-detail">{safeDetail}</p>
				) : null}
			</div>

			<div className="connection-panel-actions">
				{onCheckChannel ? (
					<button
						type="button"
						className="primary"
						disabled={channelCheckBusy}
						onClick={onCheckChannel}
					>
						{channelCheckBusy
							? 'Проверка…'
							: 'Проверить соединение и лицензию'}
					</button>
				) : null}
				{onStopChannel ? (
					<button
						type="button"
						className="secondary"
						disabled={channelStopBusy || !wg?.unit_active}
						onClick={onStopChannel}
					>
						{channelStopBusy ? 'Отключение…' : 'Отключить защищённый канал'}
					</button>
				) : null}
			</div>
		</section>
	);
}
