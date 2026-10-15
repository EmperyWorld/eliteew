/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Router for companion output surface modes (chat, builder, edit, file list, document editor, roadmap, script).
 *
 * Invariants:
 * - Unknown or future modes fall back to an inert placeholder; side effects stay in nested mode components or server actions.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { consumeCompanionSurfaceRestoreNotice } from '@/features/ewa/companionOutputSurface/companionOutputSurfaceRestoreNotice';
import { useNotifications } from '@/notifications';

import { CompanionDocumentEditorMode } from '@/features/ewa/companionOutputSurface/CompanionDocumentEditorMode';
import { CompanionFileListMode } from '@/features/ewa/companionOutputSurface/CompanionFileListMode';
import { CompanionMusicXlBaseWizardMode } from '@/features/ewa/companionOutputSurface/CompanionMusicXlBaseWizardMode';
import { CompanionMyPhrasesMode } from '@/features/ewa/companionOutputSurface/CompanionMyPhrasesMode';
import { CompanionOutputRoadmapMode } from '@/features/ewa/companionOutputSurface/CompanionOutputRoadmapMode';
import { CompanionScriptMode } from '@/features/ewa/companionOutputSurface/CompanionScriptMode';
import {
	CompanionWorkflowEditMode,
	workflowDagBuilderSurface,
} from '@/features/ewa/companionOutputSurface/CompanionWorkflowEditMode';
import { CompanionWorkflowDagBuilderMode } from '@/features/ewa/companionWorkflowDagBuilder/CompanionWorkflowDagBuilderMode';
import type { CompanionOutputSurfaceState } from '@/features/ewa/companionOutputSurface/types';
import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import type { CompanionQuickPresetChip } from '@/features/ewa/ewaCompanionQuickPresetsUi';
import type { CompanionUserWorkflow } from '@/services/ewa/companionUserWorkflowsApi';
import type { MyPhraseIconOverride } from '@/features/ewa/companionOutputSurface/companionMyPhraseIconsStorage';
import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';

export type CompanionOutputSurfaceProps = {
	surface: CompanionOutputSurfaceState;
	onSurfaceChange: (next: CompanionOutputSurfaceState) => void;
	chatContent: ReactNode;
	planContent: ReactNode;
	onDraftPrompt: (text: string) => void;
	onSubmitPrompt?: (text: string) => void | Promise<void>;
	submittingPrompt?: boolean;
	documentSurfaceActionsHost?: HTMLElement | null;
	companionProfile?: Pick<
		EwaCompanionProfileOut,
		'seed_persona_id' | 'baseline' | 'style_parameters' | 'character_state'
	>;
	myPhrasesPresets?: CompanionQuickPresetChip[];
	phraseIconOverrides?: ReadonlyMap<string, MyPhraseIconOverride>;
	myPhrasesBusy?: boolean;
	onApplyMyPhrase?: (preset: CompanionQuickPresetChip) => void;
	onRenameMyPhrase?: (preset: CompanionQuickPresetChip) => void;
	onDeleteMyPhrase?: (preset: CompanionQuickPresetChip) => void;
	onDuplicateMyPhrase?: (preset: CompanionQuickPresetChip) => void;
	onReorderMyPhrases?: (ordered: CompanionQuickPresetChip[]) => void;
	onMyPhraseIconChange?: (
		presetId: string,
		visual: MyPhraseIconOverride
	) => void;
	onMyPhrasesExportSuccess?: () => void;
	onMyPhrasesExportFailed?: () => void;
	onImportMyPhrasesFile?: (file: File) => void | Promise<void>;
	onSaveScriptAsWorkflowStep?: (text: string) => void;
	companionPrincipalId?: string;
};

function readPayloadString(
	payload: Record<string, unknown> | undefined,
	key: string
): string | undefined {
	const value = payload?.[key];
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readPayloadWorkflow(
	payload: Record<string, unknown> | undefined
): CompanionUserWorkflow | undefined {
	const value = payload?.savedWorkflow;
	if (!value || typeof value !== 'object' || Array.isArray(value))
		return undefined;
	const row = value as Partial<CompanionUserWorkflow>;
	return typeof row.id === 'string' && typeof row.name === 'string'
		? (row as CompanionUserWorkflow)
		: undefined;
}

export function CompanionOutputSurface({
	surface,
	onSurfaceChange,
	chatContent,
	planContent,
	onDraftPrompt,
	onSubmitPrompt,
	submittingPrompt = false,
	documentSurfaceActionsHost,
	companionProfile,
	myPhrasesPresets = [],
	phraseIconOverrides,
	myPhrasesBusy = false,
	onApplyMyPhrase,
	onRenameMyPhrase,
	onDeleteMyPhrase,
	onDuplicateMyPhrase,
	onReorderMyPhrases,
	onMyPhraseIconChange,
	onMyPhrasesExportSuccess,
	onMyPhrasesExportFailed,
	onImportMyPhrasesFile,
	onSaveScriptAsWorkflowStep,
	companionPrincipalId = '',
}: CompanionOutputSurfaceProps) {
	const { t } = useTranslation('marketing');
	const { info: notifyInfo } = useNotifications();
	const restoreToastShownRef = useRef(false);
	const backToChat = () => onSurfaceChange({ mode: 'chat' });

	useEffect(() => {
		if (restoreToastShownRef.current || !companionPrincipalId.trim()) return;
		const notice = consumeCompanionSurfaceRestoreNotice({
			principalId: companionPrincipalId,
			state: surface,
		});
		if (!notice) return;
		restoreToastShownRef.current = true;
		const message = notice.title
			? t('ewaCompanion.documentSurfaceSessionRestore', {
					title: notice.title,
				})
			: t('ewaCompanion.documentSurfaceSessionRestoreMode');
		notifyInfo(message);
	}, [companionPrincipalId, notifyInfo, surface, t]);

	if (surface.mode === 'chat') {
		return <>{chatContent}</>;
	}

	if (surface.mode === 'workflow_dag_builder') {
		return (
			<CompanionWorkflowDagBuilderMode
				workflowId={readPayloadString(surface.payload, 'workflowId')}
				duplicateFromId={readPayloadString(surface.payload, 'duplicateFromId')}
				onBackToChat={backToChat}
				onExitToWorkflows={() => onSurfaceChange({ mode: 'workflow_edit' })}
				onSaved={(workflow) =>
					onSurfaceChange({
						mode: 'workflow_edit',
						payload: {
							savedWorkflow: workflow,
							savedWorkflowId: workflow.id,
						},
					})
				}
			/>
		);
	}

	if (surface.mode === 'workflow_edit') {
		return (
			<CompanionWorkflowEditMode
				initialWorkflow={readPayloadWorkflow(surface.payload)}
				highlightWorkflowId={readPayloadString(
					surface.payload,
					'savedWorkflowId'
				)}
				principalId={companionPrincipalId}
				onBackToChat={backToChat}
				onOpenDagBuilder={() => onSurfaceChange(workflowDagBuilderSurface())}
				onEditDagWorkflow={(workflowId) =>
					onSurfaceChange(workflowDagBuilderSurface(workflowId))
				}
				onDuplicateWorkflow={(workflowId, opts) =>
					opts?.dagV2
						? onSurfaceChange(
								workflowDagBuilderSurface(undefined, {
									duplicateFromId: workflowId,
								})
							)
						: undefined
				}
			/>
		);
	}

	if (surface.mode === 'file_list') {
		return (
			<CompanionFileListMode
				payload={surface.payload}
				onBackToChat={backToChat}
				onOpenFile={onSurfaceChange}
			/>
		);
	}

	if (surface.mode === 'document_editor') {
		return (
			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<CompanionDocumentEditorMode
					payload={surface.payload}
					companionProfile={companionProfile}
					companionPrincipalId={companionPrincipalId}
					externalActionsHost={documentSurfaceActionsHost}
					onBackToChat={backToChat}
					onDraftPrompt={onDraftPrompt}
				/>
			</div>
		);
	}

	if (surface.mode === 'music_xl_base_wizard') {
		return (
			<CompanionMusicXlBaseWizardMode
				payload={surface.payload}
				onBackToChat={backToChat}
				onDraftPrompt={onDraftPrompt}
				onSubmitPrompt={onSubmitPrompt ?? onDraftPrompt}
				submitting={submittingPrompt}
			/>
		);
	}

	if (surface.mode === 'roadmap') {
		return (
			<CompanionOutputRoadmapMode
				onBackToChat={backToChat}
				planContent={planContent}
			/>
		);
	}

	if (surface.mode === 'my_phrases') {
		return (
			<CompanionMyPhrasesMode
				presets={myPhrasesPresets}
				phraseIconOverrides={phraseIconOverrides ?? new Map()}
				busy={myPhrasesBusy}
				onBackToChat={backToChat}
				onApply={(preset) => {
					onApplyMyPhrase?.(preset);
					backToChat();
				}}
				onRename={(preset) => onRenameMyPhrase?.(preset)}
				onDelete={(preset) => onDeleteMyPhrase?.(preset)}
				onDuplicate={(preset) => onDuplicateMyPhrase?.(preset)}
				onReorder={(ordered) => onReorderMyPhrases?.(ordered)}
				onIconChange={(presetId, visual) =>
					onMyPhraseIconChange?.(presetId, visual)
				}
				onExportSuccess={onMyPhrasesExportSuccess}
				onExportFailed={onMyPhrasesExportFailed}
				onImportFile={onImportMyPhrasesFile}
			/>
		);
	}

	if (surface.mode === 'script') {
		return (
			<CompanionScriptMode
				onBackToChat={backToChat}
				onSubmitPrompt={async (text) => {
					if (onSubmitPrompt) await onSubmitPrompt(text);
					else onDraftPrompt(text);
					backToChat();
				}}
				onSaveAsWorkflowStep={onSaveScriptAsWorkflowStep}
				initialTemplate={readPayloadString(surface.payload, 'template')}
			/>
		);
	}

	return (
		<CompanionGlassCard
			className="flex flex-col items-center gap-3 px-4 py-8 text-center"
			data-testid="ewa-companion-output-script-placeholder"
		>
			<p className="text-[13px] text-(--companion-text-soft)">
				{t('ewaCompanion.outputSurfaceScriptSoon')}
			</p>
			<DesktopAppButton
				type="button"
				variant="neutral"
				size="sm"
				onClick={backToChat}
			>
				{t('ewaCompanion.outputSurfaceBackToChat')}
			</DesktopAppButton>
		</CompanionGlassCard>
	);
}
