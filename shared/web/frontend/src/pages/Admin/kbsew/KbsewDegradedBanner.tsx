/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified degraded / error / info banner for KBSEW admin tabs.
 *
 * Invariants:
 * - Null/empty message → render nothing.
 *
 * Related:
 * - `pages/Admin/kbsew/KbsewOverviewTab.tsx`
 */

import * as React from 'react';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';

export type KbsewBannerTone = 'error' | 'degraded' | 'info' | 'success';

type Props = {
	tone: KbsewBannerTone;
	message: string | null | undefined;
	title?: string | null;
};

const TONE_CLASS: Record<KbsewBannerTone, string> = {
	error: 'border-red-500/40 bg-red-500/10 text-red-200',
	degraded: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
	info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
	success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
};

export function KbsewDegradedBanner({
	tone,
	message,
	title,
}: Props): React.ReactElement | null {
	const text = typeof message === 'string' ? message.trim() : '';
	if (!text) return null;
	const role = tone === 'success' || tone === 'info' ? 'status' : 'alert';
	return (
		<div
			role={role}
			aria-live={role === 'status' ? 'polite' : 'assertive'}
			className={`rounded-md border px-3 py-2 text-sm ${TONE_CLASS[tone]}`}
		>
			{title ? (
				<p className={`${DESKTOP_TYPOGRAPHY.subtitle} mb-0.5`}>{title}</p>
			) : null}
			<p className={DESKTOP_TYPOGRAPHY.body}>{text}</p>
		</div>
	);
}
