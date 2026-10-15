/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact mood chip readout above companion memory lists (U6.3 desktop + mobile parity).
 *
 * Invariants:
 * - Read-only; mood comes from merged character state in the chat panel.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionMobileMemorySheet.tsx
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

export type CompanionMemoryMoodBannerProps = {
	moodChipLabel: string;
	className?: string;
};

export function CompanionMemoryMoodBanner({
	moodChipLabel,
	className,
}: CompanionMemoryMoodBannerProps) {
	const { t } = useTranslation('marketing');
	const label = moodChipLabel.trim();
	if (!label) return null;

	return (
		<div
			className={cn(
				'rounded-(--desktop-radius-control)',
				'border border-(--desktop-border-subtle) bg-white/4 px-2.5 py-2',
				className
			)}
			data-testid="ewa-companion-memory-mood-banner"
		>
			<p className="text-[10px] font-medium uppercase tracking-wide text-(--companion-text-soft)">
				{t('ewaCompanion.memoryMoodTitle')}
			</p>
			<p className="mt-0.5 text-[12px] leading-snug text-(--desktop-text-secondary)">
				{label}
			</p>
		</div>
	);
}
