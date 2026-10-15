/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop left-rail «последнее на столе» section from ``companion_recent_server_actions`` (U8.3 slice 9).
 *
 * Invariants:
 * - Renders nothing when the filtered action list is empty.
 *
 * Related:
 * - src/features/ewa/companionRecentServerActionsUi.ts
 * - src/features/ewa/companionUx/useCompanionLeftRailController.ts
 */

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import {
	formatCompanionRecentServerActionUserLine,
	type CompanionRecentServerActionDisplay,
	type CompanionRecentServerActionDisplayLabels,
} from '@/features/ewa/companionRecentServerActionsUi';
import {
	CompanionLeftRailSection,
	type CompanionLeftRailSectionId,
} from '@/features/ewa/companionLeftRailSection';
import { cn } from '@/utils/cn';

export type CompanionLeftRailServerActionsSectionProps = {
	actions: readonly CompanionRecentServerActionDisplay[];
	labels: CompanionRecentServerActionDisplayLabels;
	leftRailExpanded: CompanionLeftRailSectionId | null;
	onToggleSection: (sectionId: CompanionLeftRailSectionId) => void;
	reducedMotion: boolean;
};

export function CompanionLeftRailServerActionsSection({
	actions,
	labels,
	leftRailExpanded,
	onToggleSection,
	reducedMotion,
}: CompanionLeftRailServerActionsSectionProps) {
	const { t } = useTranslation('marketing');

	if (actions.length === 0) return null;

	return (
		<motion.div
			data-testid="ewa-companion-server-actions-strip"
			initial={reducedMotion ? false : { opacity: 0, y: -4 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reducedMotion ? 0 : 0.22 }}
			className="shrink-0"
		>
			<CompanionLeftRailSection
				sectionId="serverActions"
				expandedSection={leftRailExpanded}
				onToggle={onToggleSection}
				icon="icon-processing"
				iconTone="muted"
				variant="muted"
				title={t('ewaCompanion.serverActionsStripTitle')}
				badge={actions.length}
			>
				<p className="px-1 pb-1.5 text-[10px] leading-snug text-(--desktop-text-muted)">
					{t('ewaCompanion.serverActionsStripHint')}
				</p>
				<ul
					className={cn(
						'max-h-[min(30vh,10rem)] space-y-0.5 overflow-y-auto overscroll-y-contain',
						'text-[11px] leading-snug text-(--desktop-text-secondary)'
					)}
					aria-label={t('ewaCompanion.serverActionsStripTitle')}
				>
					{actions.map((entry) => (
						<li
							key={`srv-${entry.tool}|${entry.ts}|${entry.status}|${entry.summary}`}
							className="wrap-break-word"
						>
							<span className="font-medium text-(--companion-text-soft)">
								{'\u2022 '}
							</span>
							{formatCompanionRecentServerActionUserLine(entry, labels)}
						</li>
					))}
				</ul>
			</CompanionLeftRailSection>
		</motion.div>
	);
}
