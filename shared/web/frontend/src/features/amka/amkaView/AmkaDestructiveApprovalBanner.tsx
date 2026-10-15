/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Destructive-operation approval banner shown before AMKA run approval.
 *
 * Related:
 * - AmkaView.tsx, AmkaRunStatusHeader.tsx
 */

import { useTranslation } from 'react-i18next';

type AmkaDestructiveApprovalBannerProps = {
	plannedDestructiveCount: number;
};

export function AmkaDestructiveApprovalBanner({
	plannedDestructiveCount,
}: AmkaDestructiveApprovalBannerProps) {
	const { t } = useTranslation('marketing');

	if (plannedDestructiveCount <= 0) {
		return null;
	}

	return (
		<div
			className="rounded-(--desktop-radius) border border-red-500/40 bg-red-500/10 px-3 py-2.5"
			role="status"
		>
			<div className="text-xs font-semibold text-red-100">
				{t('amkaView.destructiveApprovalBannerTitle')}
			</div>
			<p className="mt-1 text-xs leading-relaxed text-red-100/90 wrap-pretty">
				{t('amkaView.destructiveApprovalBannerBody', {
					count: plannedDestructiveCount,
				})}
			</p>
		</div>
	);
}
