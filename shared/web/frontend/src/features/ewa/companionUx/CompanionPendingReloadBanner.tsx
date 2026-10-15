/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Honest pending state when profile reload is slow after submit (plan 15 R03).
 *
 * Invariants:
 * - Parent owns visibility via ``useCompanionPendingReloadDelay``.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionTranscriptMessageList.tsx
 */

import { useTranslation } from 'react-i18next';

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type CompanionPendingReloadBannerProps = {
	visible: boolean;
};

export function CompanionPendingReloadBanner({
	visible,
}: CompanionPendingReloadBannerProps) {
	const { t } = useTranslation('marketing');

	if (!visible) return null;

	return (
		<li
			className={cn(
				'list-none rounded-xl border border-amber-400/25 bg-amber-500/10',
				'px-3 py-2 text-[12px] text-amber-100/95'
			)}
			data-testid="ewa-companion-pending-reload-delay"
			role="status"
			aria-live="polite"
		>
			<p className={cn(DESKTOP_TYPOGRAPHY.caption, 'not-italic')}>
				{t('ewaCompanion.pendingReloadDelayed')}
			</p>
		</li>
	);
}
