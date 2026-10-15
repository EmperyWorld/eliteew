/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: Probe CTA panel with last result for Admin New World ops.
 * Invariants: Presentational; caller owns API; no Old World imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { ReactNode } from 'react';

import { AdminButton } from './AdminButton';
import { AdminStatusBanner } from './AdminStatusBanner';

export type OpsProbePanelProps = {
	title: string;
	description?: string;
	runLabel?: string;
	busy?: boolean;
	disabled?: boolean;
	onRun: () => void;
	/** Last probe outcome; omit when never run. */
	lastResult?: {
		ok: boolean;
		message: string;
		detail?: ReactNode;
	} | null;
};

export function OpsProbePanel({
	title,
	description,
	runLabel = 'Run probe',
	busy = false,
	disabled = false,
	onRun,
	lastResult = null,
}: OpsProbePanelProps) {
	return (
		<section className="space-y-3 rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-[length:var(--admin-ui-text-md)] font-medium text-[var(--admin-ui-fg)]">
						{title}
					</h3>
					{description ? (
						<p className="mt-1 text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg-muted)]">
							{description}
						</p>
					) : null}
				</div>
				<AdminButton
					variant="primary"
					disabled={disabled || busy}
					onClick={onRun}
				>
					{busy ? 'Running…' : runLabel}
				</AdminButton>
			</div>
			{lastResult ? (
				<AdminStatusBanner
					tone={lastResult.ok ? 'success' : 'danger'}
					title={lastResult.message}
				>
					{lastResult.detail}
				</AdminStatusBanner>
			) : null}
		</section>
	);
}
