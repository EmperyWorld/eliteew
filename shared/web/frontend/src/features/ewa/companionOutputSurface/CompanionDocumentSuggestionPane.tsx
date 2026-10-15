/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Right-column suggestion pane for embedded companion document editor (apply controls + companion output).
 *
 * Invariants:
 * - Companion suggestion text is never auto-applied; apply buttons stay above the scrollable result area.
 *
 * Related:
 * - CompanionDocumentEditorMode.tsx
 */

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
	COMPANION_SURFACE_LABEL_CLASS,
	COMPANION_SURFACE_SECTION_CLASS,
} from '@/features/ewa/companionOutputSurface/companionSurfaceUi';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import type { TextSelectionRange } from '@/features/ewa/companionOutputSurface/companionDocumentSurfaceUi';
import { cn } from '@/utils/cn';

type Props = {
	companionDisplayName: string;
	aiResult: string;
	aiBusy: boolean;
	policyBusy: boolean;
	selection: TextSelectionRange | null;
	inlineActionControls: ReactNode | null;
	onAppend: () => void;
	onReplace: () => void;
};

export function CompanionDocumentSuggestionPane({
	companionDisplayName,
	aiResult,
	aiBusy,
	policyBusy,
	selection,
	inlineActionControls,
	onAppend,
	onReplace,
}: Props) {
	const { t } = useTranslation('marketing');

	return (
		<aside
			className={cn(
				COMPANION_SURFACE_SECTION_CLASS,
				'order-2 flex min-h-0 min-w-0 flex-col lg:order-0 lg:min-h-full'
			)}
		>
			{inlineActionControls}
			<div className="mb-2 flex flex-wrap justify-end gap-1.5">
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					disabled={!aiResult.trim() || policyBusy || aiBusy}
					onClick={onAppend}
				>
					{policyBusy ? (
						<ArrowPathIcon className="mr-1 size-3.5 animate-spin" />
					) : null}
					{t('ewaCompanion.documentSurfaceAppend')}
				</DesktopAppButton>
				<DesktopAppButton
					type="button"
					variant="accent"
					size="sm"
					disabled={!aiResult.trim() || policyBusy || aiBusy}
					onClick={onReplace}
				>
					{policyBusy ? (
						<ArrowPathIcon className="mr-1 size-3.5 animate-spin" />
					) : null}
					{selection
						? t('ewaCompanion.documentSurfaceReplaceSelection')
						: t('ewaCompanion.documentSurfaceReplaceDocument')}
				</DesktopAppButton>
			</div>
			<div className="flex min-h-48 flex-1 flex-col rounded-md border border-(--companion-divider)/70 bg-(--desktop-surface-soft)/20 p-2 lg:min-h-0">
				<p className={COMPANION_SURFACE_LABEL_CLASS}>
					{t('ewaCompanion.documentSurfaceAiResultWithName', {
						name: companionDisplayName,
					})}
				</p>
				<div className="mt-1 min-h-32 flex-1 overflow-y-auto overscroll-y-contain whitespace-pre-wrap text-[12px] leading-relaxed text-(--desktop-text-primary) lg:min-h-0">
					{aiResult ||
						t('ewaCompanion.documentSurfaceAiEmptyWithName', {
							name: companionDisplayName,
						})}
				</div>
			</div>
		</aside>
	);
}
