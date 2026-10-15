/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ask/custom/quick-action controls for companion embedded document editor (inline or rail).
 *
 * Invariants:
 * - Controls never mutate document text; they only draft prompts / start transforms.
 *
 * Related:
 * - CompanionDocumentEditorModeView.tsx
 * - documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md
 */

import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';

import type { TextSelectionRange } from '@/features/ewa/companionOutputSurface/companionDocumentSurfaceUi';
import {
	COMPANION_SURFACE_LABEL_CLASS,
	COMPANION_SURFACE_SECTION_CLASS,
} from '@/features/ewa/companionOutputSurface/companionSurfaceUi';
import {
	DesktopAppButton,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import type { QuickAction } from './types';

export type CompanionDocumentEditorActionControlsProps = {
	t: TFunction;
	companionDisplayName: string;
	companionPrincipalId: string;
	title: string;
	selection: TextSelectionRange | null;
	markdown: string;
	prompt: string;
	setPrompt: (value: string) => void;
	aiBusy: boolean;
	transformActionDisabled: boolean;
	onDraftPrompt: (text: string) => void;
	onDiscussHintSeen: () => void;
	runAi: (action: QuickAction) => void;
	stopAiTransform: () => void;
};

function ActionControlsContent(
	props: CompanionDocumentEditorActionControlsProps
) {
	const {
		t,
		companionDisplayName,
		title,
		selection,
		markdown,
		prompt,
		setPrompt,
		aiBusy,
		transformActionDisabled,
		onDraftPrompt,
		onDiscussHintSeen,
		runAi,
		stopAiTransform,
	} = props;
	return (
		<>
			<div className="flex items-center gap-2">
				<SparklesIcon className="size-4 text-(--companion-aura)" />
				<p className={COMPANION_SURFACE_LABEL_CLASS}>
					{t('ewaCompanion.documentSurfaceAiTitleWithName', {
						name: companionDisplayName,
					})}
				</p>
			</div>
			<div className="mt-2 flex flex-wrap gap-1.5">
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					onClick={() => {
						onDiscussHintSeen();
						onDraftPrompt(
							t('ewaCompanion.documentSurfaceDiscussPrompt', {
								title,
								selection: selection?.text || markdown.slice(0, 1200),
							})
						);
					}}
				>
					{t('ewaCompanion.documentSurfaceDiscussWithName', {
						name: companionDisplayName,
					})}
				</DesktopAppButton>
			</div>
			<textarea
				value={prompt}
				onChange={(event) => setPrompt(event.target.value)}
				className={cn(
					'mt-2 min-h-20 w-full resize-y rounded-md border border-(--companion-divider)',
					'bg-(--companion-bg) px-2 py-1.5 text-[12px]',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				placeholder={t('ewaCompanion.documentSurfaceCustomPrompt', {
					name: companionDisplayName,
				})}
			/>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				className="mt-2 w-full justify-center"
				disabled={transformActionDisabled}
				onClick={() => void runAi('custom')}
			>
				{aiBusy ? (
					<ArrowPathIcon className="mr-1 size-3.5 animate-spin" />
				) : (
					<SparklesIcon className="mr-1 size-3.5" />
				)}
				{t('ewaCompanion.documentSurfaceRunCustomWithName', {
					name: companionDisplayName,
				})}
			</DesktopAppButton>
			{aiBusy ? (
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					className="mt-1 w-full justify-center"
					onClick={stopAiTransform}
				>
					{t('ewaCompanion.documentSurfaceStopAi')}
				</DesktopAppButton>
			) : null}
			<div className="mt-3 border-t border-(--companion-divider)/70 pt-3">
				<p className={COMPANION_SURFACE_LABEL_CLASS}>
					{t('ewaCompanion.documentSurfaceAiTitle')}
				</p>
				<div className="mt-2 grid grid-cols-3 gap-1">
					{(['improve', 'fix', 'shorten'] as const).map((action) => (
						<button
							key={action}
							type="button"
							className={cn(
								'rounded-md border border-(--companion-divider) px-2 py-1 text-[11px]',
								'text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft)/40',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
							disabled={transformActionDisabled}
							onClick={() => void runAi(action)}
						>
							{t(`ewaCompanion.documentSurfaceAction_${action}`)}
						</button>
					))}
				</div>
			</div>
		</>
	);
}

export function CompanionDocumentEditorInlineActionControls(
	props: CompanionDocumentEditorActionControlsProps
): ReactNode {
	return (
		<section
			className={cn(COMPANION_SURFACE_SECTION_CLASS, 'mb-3 flex flex-col')}
		>
			<ActionControlsContent {...props} />
		</section>
	);
}

export function CompanionDocumentEditorRailActionControls(
	props: CompanionDocumentEditorActionControlsProps
): ReactNode {
	return (
		<section className={cn(COMPANION_SURFACE_SECTION_CLASS, 'flex flex-col')}>
			<ActionControlsContent {...props} />
		</section>
	);
}
