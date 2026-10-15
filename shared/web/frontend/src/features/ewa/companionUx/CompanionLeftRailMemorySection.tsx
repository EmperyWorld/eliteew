/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop left-rail «Помнит о вас» section (mood banner + forgettable strip, U8.3 slice 8).
 *
 * Invariants:
 * - Hidden entirely when ``hideMemoryStrip`` (e.g. Arlika v1 persona).
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionLeftRailController.ts
 * - src/features/ewa/companionUx/CompanionMemoryStripList.tsx
 */

import { useTranslation } from 'react-i18next';

import type { CompanionMemoryStripRow } from '@/features/ewa/companionLearnedUi';
import {
	CompanionLeftRailSection,
	type CompanionLeftRailSectionId,
} from '@/features/ewa/companionLeftRailSection';
import { CompanionMemoryMoodBanner } from '@/features/ewa/companionUx/CompanionMemoryMoodBanner';
import { CompanionMemoryStripList } from '@/features/ewa/companionUx/CompanionMemoryStripList';
import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { EwaIcon } from '@/features/ewa/ewaIcons/EwaIcon';
import { cn } from '@/utils/cn';

export type CompanionLeftRailMemorySectionProps = {
	hideMemoryStrip: boolean;
	memoryStripCount: number;
	memoryStripRows: readonly CompanionMemoryStripRow[];
	memoryRevision: number;
	moodChipLabel?: string | null;
	forgettingHash?: string | null;
	onForgetRequest?: (row: CompanionMemoryStripRow) => void;
	leftRailExpanded: CompanionLeftRailSectionId | null;
	onToggleSection: (sectionId: CompanionLeftRailSectionId) => void;
};

export function CompanionLeftRailMemorySection({
	hideMemoryStrip,
	memoryStripCount,
	memoryStripRows,
	memoryRevision,
	moodChipLabel = null,
	forgettingHash = null,
	onForgetRequest,
	leftRailExpanded,
	onToggleSection,
}: CompanionLeftRailMemorySectionProps) {
	const { t } = useTranslation('marketing');

	if (hideMemoryStrip) return null;

	return (
		<div className="flex min-h-0 min-w-0 shrink-0 flex-col">
			{memoryStripCount > 0 ? (
				<CompanionLeftRailSection
					sectionId="memory"
					expandedSection={leftRailExpanded}
					onToggle={onToggleSection}
					icon="icon-ewa-brain"
					iconTone="brand"
					title={t('ewaCompanion.memoryStripTitle')}
					badge={memoryStripCount}
				>
					{moodChipLabel ? (
						<CompanionMemoryMoodBanner
							moodChipLabel={moodChipLabel}
							className="mb-2"
						/>
					) : null}
					<p className="mb-1 px-1 text-[10px] italic text-(--companion-text-soft)">
						{t('ewaCompanion.memoryForgetHint')}
					</p>
					<CompanionMemoryStripList
						rows={memoryStripRows}
						memoryRevision={memoryRevision}
						forgettingHash={forgettingHash}
						onForgetRequest={onForgetRequest}
						className="max-h-[min(32vh,11rem)]"
					/>
				</CompanionLeftRailSection>
			) : (
				<CompanionGlassCard
					className={cn(
						'px-2.5 py-2',
						'text-[12px] font-medium leading-snug text-(--companion-text-soft)'
					)}
				>
					<EwaIcon
						name="icon-ewa-brain"
						size="sm"
						tone="muted"
						className="mb-1 opacity-70"
					/>
					{t('ewaCompanion.memoryStripPlaceholder')}
				</CompanionGlassCard>
			)}
		</div>
	);
}
