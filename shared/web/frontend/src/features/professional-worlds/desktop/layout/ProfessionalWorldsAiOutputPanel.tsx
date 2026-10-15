/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * AI generation output panel for Professional Worlds brand/learning/listing lanes.
 *
 * Invariants:
 * - Sticky footer styling when used inside workspace rail.
 *
 * Related:
 * - ProfessionalWorldsAiOutputRail.tsx
 */

import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import { PW_AI_OUTPUT_PANEL_CLASS } from './professionalWorldsLayoutTokens';
import { ProfessionalWorldsWorkspacePanel } from './ProfessionalWorldsWorkspacePanel';

export function ProfessionalWorldsAiOutputPanel({
	generationText,
	streamStatus,
	waitingLabel,
	outputLabel,
	copyLabel,
	onCopy,
	className,
}: {
	generationText: string;
	streamStatus: string;
	waitingLabel: string;
	outputLabel: string;
	copyLabel: string;
	onCopy: () => void | Promise<void>;
	className?: string;
}) {
	const canCopy = Boolean(generationText.trim());
	return (
		<ProfessionalWorldsWorkspacePanel
			title={outputLabel}
			actions={
				<DesktopAppButton
					size="sm"
					disabled={!canCopy}
					onClick={() => void onCopy()}
				>
					{copyLabel}
				</DesktopAppButton>
			}
			className={cn(PW_AI_OUTPUT_PANEL_CLASS, className)}
		>
			{streamStatus.trim() ? (
				<p className="text-xs text-(--desktop-text-secondary)">
					{streamStatus}
				</p>
			) : null}
			<pre
				className={cn(
					'min-h-40 w-full max-w-full overflow-x-auto overflow-y-visible whitespace-pre-wrap wrap-break-word rounded-(--desktop-radius)',
					'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 text-xs leading-5 text-(--desktop-text-primary)'
				)}
			>
				{generationText || waitingLabel}
			</pre>
		</ProfessionalWorldsWorkspacePanel>
	);
}
