/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact progress bar for active MusicForge admin run rows.
 */

import type { ReactElement } from 'react';

import { cn } from '@/utils/cn';

export type MusicForgeAdminRunProgressBarProps = {
	current: number;
	total: number;
	className?: string;
};

export function MusicForgeAdminRunProgressBar({
	current,
	total,
	className,
}: MusicForgeAdminRunProgressBarProps): ReactElement | null {
	if (!Number.isFinite(total) || total <= 0) return null;
	const pct = Math.min(100, Math.max(0, Math.round((current / total) * 100)));
	return (
		<div className={cn('space-y-1', className)}>
			<div
				className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-ui-border)]/50"
				role="progressbar"
				aria-valuenow={pct}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div
					className="h-full rounded-full bg-[var(--admin-ui-accent)] transition-[width] motion-reduce:transition-none"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<p className="text-xs text-[var(--admin-ui-fg-muted)]">
				{current}/{total}
			</p>
		</div>
	);
}
