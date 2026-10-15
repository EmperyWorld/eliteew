/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose: New World Admin status / degrade banner.
 * Invariants: Tone maps from adminTokens; no Old World chrome imports.
 * Related: documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

import { type AdminUiBannerTone, adminUiBannerTone } from '../adminTokens';

export type AdminStatusBannerProps = {
	tone?: AdminUiBannerTone;
	title?: string;
	children?: ReactNode;
	className?: string;
};

export function AdminStatusBanner({
	tone = 'info',
	title,
	children,
	className,
}: AdminStatusBannerProps) {
	const t = adminUiBannerTone[tone];
	return (
		<div
			role="status"
			className={cn(
				'rounded-[var(--admin-ui-radius-sm)] border px-3 py-2',
				t.border,
				t.bg,
				className
			)}
		>
			{title ? (
				<p className={cn('text-sm font-medium', t.fg)}>{title}</p>
			) : null}
			{children ? (
				<div className="mt-1 text-[length:var(--admin-ui-text-sm)] text-[var(--admin-ui-fg)]">
					{children}
				</div>
			) : null}
		</div>
	);
}
