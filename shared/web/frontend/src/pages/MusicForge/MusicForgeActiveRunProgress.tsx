/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inline progress strip while a MusicForge run is active (create panel).
 *
 * Related:
 * - MusicForgeCreatePanel.tsx, MusicForgeApp.tsx
 */

import { useTranslation } from 'react-i18next';

export type MusicForgeActiveRunProgressProps = {
	progressCurrent: number;
	progressTotal: number;
	status: 'queued' | 'running';
};

export function MusicForgeActiveRunProgress({
	progressCurrent,
	progressTotal,
	status,
}: MusicForgeActiveRunProgressProps) {
	const { t } = useTranslation('desktopUi');
	const indeterminate = progressTotal <= 0;
	const pct = indeterminate
		? 0
		: Math.min(100, Math.round((progressCurrent / progressTotal) * 100));

	return (
		<div className="space-y-2" role="status" aria-live="polite">
			<div className="flex items-center justify-between gap-2 text-xs text-(--desktop-text-secondary)">
				<span>
					{status === 'queued'
						? t('musicForge.createPanel.queuedHint')
						: t('musicForge.createPanel.runningHint')}
				</span>
				<span>{indeterminate ? '…' : `${pct}%`}</span>
			</div>
			<div
				className="h-1.5 overflow-hidden rounded-full bg-white/10"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={indeterminate ? undefined : pct}
				aria-busy={indeterminate || undefined}
			>
				{indeterminate ? (
					<div className="h-full w-1/3 rounded-full bg-linear-to-r from-fuchsia-400 to-amber-300 motion-reduce:animate-none animate-pulse" />
				) : (
					<div
						className="h-full rounded-full bg-linear-to-r from-fuchsia-400 to-amber-300 transition-all"
						style={{ width: `${pct}%` }}
					/>
				)}
			</div>
		</div>
	);
}
