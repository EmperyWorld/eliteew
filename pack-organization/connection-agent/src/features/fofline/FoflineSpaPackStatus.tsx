/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quiet strip for FoFline SPA pack sync / ready / update / A2 media groups.
 *
 * Invariants:
 * - Hidden when entitlement does not include FoFline (denied/empty).
 * - Update CTA does not replace the ready pack until sync succeeds.
 * - Group sync does not block Start-ready messaging honesty.
 *
 * Related:
 * - hooks/useFoflineSpaPack.ts
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md L2 / L4 / §17.4
 */

import type { FoflineSpaPackUi } from '../../hooks/useFoflineSpaPack';

type FoflineSpaPackStatusProps = {
	pack: FoflineSpaPackUi;
	onRetry?: () => void;
	onUpdate?: () => void;
};

export function FoflineSpaPackStatus({
	pack,
	onRetry,
	onUpdate,
}: FoflineSpaPackStatusProps) {
	if (!pack.message || pack.state === 'denied') {
		return null;
	}

	const showRetry = pack.canRetry && Boolean(onRetry);
	const showUpdate = pack.canUpdate && Boolean(onUpdate);
	const pct =
		pack.progressTotal && pack.progressTotal > 0 && pack.progressBytes != null
			? Math.min(
					100,
					Math.round((pack.progressBytes / pack.progressTotal) * 100)
				)
			: null;

	const dataState =
		pack.state === 'ready' && pack.updateAvailable
			? 'update'
			: pack.state === 'ready' && pack.groupsSyncing
				? 'downloading'
				: pack.state === 'ready'
					? 'ready'
					: pack.state === 'downloading' || pack.busy
						? 'downloading'
						: pack.state === 'error'
							? 'error'
							: 'idle';

	return (
		<section
			className="updater-strip"
			data-state={dataState}
			data-fofline-spa-pack={pack.state}
			data-fofline-spa-update={pack.updateAvailable ? '1' : '0'}
			data-fofline-groups-syncing={pack.groupsSyncing ? '1' : '0'}
			data-fofline-groups={`${pack.groupsReady}/${pack.groupsTotal}`}
			aria-label="Рабочая среда FoFline"
		>
			<p role="status">
				{pack.message}
				{pct != null ? ` · ${pct}%` : ''}
			</p>
			{showUpdate ? (
				<div className="row gap">
					<button
						type="button"
						className="secondary"
						onClick={onUpdate}
						disabled={pack.busy}
					>
						Обновить рабочую среду
					</button>
				</div>
			) : null}
			{showRetry ? (
				<div className="row gap">
					<button
						type="button"
						className="secondary"
						onClick={onRetry}
						disabled={pack.busy}
					>
						Повторить загрузку среды
					</button>
				</div>
			) : null}
		</section>
	);
}
