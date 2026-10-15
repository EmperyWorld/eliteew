/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Slash-command suggestion chips above the companion composer (U8.3 slice 13).
 *
 * Invariants:
 * - Renders nothing when the suggestion list is empty.
 *
 * Related:
 * - src/features/ewa/companionUx/companionSlashCommands.ts
 */

import { useTranslation } from 'react-i18next';

import type { CompanionSlashCommand } from '@/features/ewa/companionUx/companionSlashCommands';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionSlashSuggestionsStripProps = {
	suggestions: readonly CompanionSlashCommand[];
	onSelectPrompt: (promptText: string) => void;
};

export function CompanionSlashSuggestionsStrip({
	suggestions,
	onSelectPrompt,
}: CompanionSlashSuggestionsStripProps) {
	const { t } = useTranslation('marketing');

	if (suggestions.length === 0) return null;

	return (
		<div className="flex flex-col gap-1">
			<p className="text-[10px] text-(--companion-text-soft)">
				{t('ewaCompanion.slashPowerUserLegend')}
			</p>
			<ul
				className="flex flex-wrap gap-1"
				data-testid="ewa-companion-slash-suggestions"
			>
				{suggestions.map((row) => (
					<li key={row.command}>
						<button
							type="button"
							className={cn(
								'rounded-full border border-(--companion-divider) px-2 py-0.5',
								'text-[10px] text-(--companion-aura) hover:bg-(--companion-aura)/10',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							onClick={() => onSelectPrompt(t(row.promptKey))}
						>
							{row.command} · {t(row.labelKey)}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
