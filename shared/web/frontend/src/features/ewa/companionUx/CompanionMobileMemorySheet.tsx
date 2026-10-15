/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile «Помнит о вас» bottom sheet — memory left rail is hidden in embedded WebView (U6.3 forget + mood).
 *
 * Invariants:
 * - Forget only for rows with ``content_hash`` from ``companion_memory_v1``.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - documentation/product/ewa/EWA-COMPANION-USER-UX-MAP.md
 */

import { useTranslation } from 'react-i18next';

import type { CompanionMemoryStripRow } from '@/features/ewa/companionLearnedUi';
import { CompanionMemoryStripList } from '@/features/ewa/companionUx/CompanionMemoryStripList';
import { CompanionMemoryMoodBanner } from '@/features/ewa/companionUx/CompanionMemoryMoodBanner';
import { CompanionMobileBottomSheet } from '@/features/ewa/companionUx/CompanionMobileBottomSheet';
import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import { cn } from '@/utils/cn';

export type CompanionMobileMemorySheetProps = {
	open: boolean;
	onClose: () => void;
	rows: readonly CompanionMemoryStripRow[];
	/** Profile revision — stable list keys when memory lines repeat. */
	memoryRevision?: number;
	moodChipLabel?: string | null;
	forgettingHash?: string | null;
	onForgetRequest?: (row: CompanionMemoryStripRow) => void;
};

export function CompanionMobileMemorySheet({
	open,
	onClose,
	rows,
	memoryRevision = 0,
	moodChipLabel = null,
	forgettingHash = null,
	onForgetRequest,
}: CompanionMobileMemorySheetProps) {
	const { t } = useTranslation('marketing');

	return (
		<CompanionMobileBottomSheet
			open={open}
			title={t('ewaCompanion.memoryStripTitle')}
			onClose={onClose}
			testId="ewa-companion-mobile-memory-sheet"
		>
			{moodChipLabel ? (
				<CompanionMemoryMoodBanner
					moodChipLabel={moodChipLabel}
					className="mb-3"
				/>
			) : null}
			{rows.length > 0 ? (
				<CompanionMemoryStripList
					rows={rows}
					memoryRevision={memoryRevision}
					forgettingHash={forgettingHash}
					onForgetRequest={onForgetRequest}
					className="max-h-[min(50vh,18rem)] space-y-2 pb-2"
				/>
			) : (
				<CompanionGlassCard
					className={cn(
						'px-3 py-4 text-center text-[12px] leading-snug text-(--companion-text-soft)'
					)}
				>
					<EwaIcon
						name="icon-ewa-brain"
						size="sm"
						tone="muted"
						className="mx-auto mb-2 opacity-70"
					/>
					{t('ewaCompanion.memoryStripPlaceholder')}
				</CompanionGlassCard>
			)}
		</CompanionMobileBottomSheet>
	);
}
