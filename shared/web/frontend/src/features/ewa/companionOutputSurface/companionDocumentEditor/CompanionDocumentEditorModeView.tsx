/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentational JSX for companion embedded document editor mode; consumes view-model from useCompanionDocumentEditorMode.
 *
 * Invariants:
 * - No local document state; all behavior comes from the view-model hook.
 * - Rail action controls portal only when effectiveActionsHost is set.
 *
 * Related:
 * - useCompanionDocumentEditorMode.ts
 * - documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md
 */

import {
	ArrowPathIcon,
	CheckIcon,
	ComputerDesktopIcon,
	DocumentTextIcon,
	EyeIcon,
	EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';

import { CompanionDocumentDraftRecoveryBanner } from '@/features/ewa/companionOutputSurface/CompanionDocumentDraftRecoveryBanner';
import { CompanionDocumentStructurePanel } from '@/features/ewa/companionOutputSurface/CompanionDocumentStructurePanel';
import { CompanionDocumentSuggestionPane } from '@/features/ewa/companionOutputSurface/CompanionDocumentSuggestionPane';
import { CompanionSurfacePanel } from '@/features/ewa/companionOutputSurface/CompanionSurfacePanel';
import {
	COMPANION_SURFACE_LABEL_CLASS,
	COMPANION_SURFACE_SECTION_CLASS,
} from '@/features/ewa/companionOutputSurface/companionSurfaceUi';
import {
	DesktopAppButton,
	DESKTOP_CHROME_FOCUS_VISIBLE,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { requestOpenDocEditorV2WithUnifiedContent } from '@/pages/Desktop/utils/desktopDeepLink';
import { cn } from '@/utils/cn';

import {
	CompanionDocumentEditorInlineActionControls,
	CompanionDocumentEditorRailActionControls,
	type CompanionDocumentEditorActionControlsProps,
} from './CompanionDocumentEditorActionControls';
import type { CompanionDocumentEditorModeViewModel } from './useCompanionDocumentEditorMode';

export function CompanionDocumentEditorModeView({
	vm,
}: {
	vm: CompanionDocumentEditorModeViewModel;
}) {
	const {
		t,
		ru: _ru,
		effectiveActionsHost,
		surfacePayload,
		companionDisplayName,
		companionPrincipalId,
		onDraftPrompt,
		textareaRef,
		documentRow,
		title,
		setTitle: _setTitle,
		markdown,
		setMarkdown,
		baseSnapshot,
		selection,
		prompt,
		setPrompt,
		aiResult,
		loading,
		aiBusy,
		policyBusy,
		policyWarnings,
		documentStructure,
		documentStructureLoading,
		documentStructureError,
		saving,
		error,
		setError,
		saved,
		setSaved,
		recoverableDraft,
		recoverableDraftSource,
		alternateRecoverableDraft,
		alternateRecoverableSource,
		draftCompareOpen,
		setDraftCompareOpen,
		footerDetailsOpen,
		setFooterDetailsOpen,
		previewOpen,
		setPreviewOpen,
		structurePanelOpen,
		setStructurePanelOpen,
		showDiscussHint,
		setShowDiscussHint,
		policyBlocked,
		setPolicyBlocked,
		saveConflict,
		clearSaveConflict,
		hasUnsavedChanges,
		serverDraft,
		serverDraftSyncError,
		serverDraftSyncHint,
		serverDraftSyncActionVisible,
		serverDraftSyncActionDisabled,
		serverDraftSyncActionLabel,
		runServerDraftSyncNow,
		offlineDraftOnly,
		recoverableDraftTime,
		handleBackToChat,
		restoreRecoverableDraft,
		discardRecoverableDraft,
		syncSelection,
		loadDocumentStructure,
		selectDocumentStructureSection,
		stopAiTransform,
		runAi,
		applyAiResult,
		saveDocument,
		restoreServerVersionFromConflict,
		parseWarnings,
		saveDisabled,
		transformActionDisabled,
		markDocumentDiscussHintSeen,
	} = vm;

	const actionControlProps: CompanionDocumentEditorActionControlsProps = {
		t,
		companionDisplayName,
		companionPrincipalId,
		title,
		selection,
		markdown,
		prompt,
		setPrompt,
		aiBusy,
		transformActionDisabled,
		onDraftPrompt,
		onDiscussHintSeen: () => {
			markDocumentDiscussHintSeen(companionPrincipalId);
			setShowDiscussHint(false);
		},
		runAi,
		stopAiTransform,
	};

	const inlineActionControls = (
		<CompanionDocumentEditorInlineActionControls {...actionControlProps} />
	);
	const railActionControls = (
		<CompanionDocumentEditorRailActionControls {...actionControlProps} />
	);

	return (
		<>
			{effectiveActionsHost
				? createPortal(railActionControls, effectiveActionsHost)
				: null}
			<CompanionSurfacePanel
				title={title}
				onBack={handleBackToChat}
				backLabel={t('ewaCompanion.outputSurfaceBackToChat')}
				hideHeader
				fillBody
				testId="ewa-companion-document-surface"
				footer={
					<div className="sticky bottom-0 z-10 -mx-1 border-t border-(--companion-divider)/60 bg-(--companion-bg)/95 px-1 py-2 backdrop-blur-sm lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="min-w-0 flex-1">
								<p className="text-[11px] text-(--companion-text-soft)">
									{selection
										? t('ewaCompanion.documentSurfaceSelection', {
												count: selection.text.length,
											})
										: t('ewaCompanion.documentSurfaceNoSelection')}
									{hasUnsavedChanges
										? ` · ${t('ewaCompanion.documentSurfaceUnsavedChanges')}`
										: ''}
									{serverDraftSyncHint ? ` · ${serverDraftSyncHint}` : ''}
								</p>
								{(baseSnapshot.version != null ||
									serverDraft ||
									parseWarnings.length > 0) && (
									<button
										type="button"
										className="mt-0.5 text-[10px] text-(--companion-aura) underline-offset-2 hover:underline"
										onClick={() => setFooterDetailsOpen((prev) => !prev)}
									>
										{footerDetailsOpen
											? t('ewaCompanion.documentSurfaceFooterDetailsHide')
											: t('ewaCompanion.documentSurfaceFooterDetails')}
									</button>
								)}
								{footerDetailsOpen ? (
									<div className="mt-1 space-y-0.5 text-[10px] text-(--companion-text-soft)">
										{baseSnapshot.version != null ? (
											<p>
												{t('ewaCompanion.documentSurfaceVersionLabel', {
													version: baseSnapshot.version,
												})}
											</p>
										) : null}
										{serverDraft ? (
											<p>
												{t(
													'ewaCompanion.documentSurfaceServerDraftVersionLabel',
													{ version: serverDraft.draftVersion }
												)}
											</p>
										) : null}
										{parseWarnings.length > 0 ? (
											<p className="text-amber-200">
												{t('ewaCompanion.documentSurfaceParseWarnings', {
													warnings: parseWarnings.join(', '),
												})}
											</p>
										) : null}
									</div>
								) : null}
							</div>
							<div className="flex flex-wrap justify-end gap-1.5">
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									className="lg:hidden"
									onClick={handleBackToChat}
								>
									{t('ewaCompanion.outputSurfaceBackToChat')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									className="hidden lg:inline-flex"
									onClick={handleBackToChat}
								>
									{t('ewaCompanion.outputSurfaceBackToChat')}
								</DesktopAppButton>
								{serverDraftSyncActionVisible ? (
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										disabled={serverDraftSyncActionDisabled}
										onClick={runServerDraftSyncNow}
									>
										{serverDraftSyncActionLabel}
									</DesktopAppButton>
								) : null}
								<DesktopAppButton
									type="button"
									variant="accent"
									size="sm"
									disabled={saveDisabled}
									onClick={() => void saveDocument()}
								>
									{saving ? (
										<ArrowPathIcon className="mr-1 size-3.5 animate-spin" />
									) : saved ? (
										<CheckIcon className="mr-1 size-3.5" />
									) : null}
									{saved
										? t('ewaCompanion.documentSurfaceSaved')
										: t('ewaCompanion.documentSurfaceSave')}
								</DesktopAppButton>
							</div>
						</div>
					</div>
				}
			>
				<div className="flex h-full min-h-0 flex-1 flex-col gap-3 pb-2 lg:grid lg:grid-cols-2 lg:grid-rows-1 lg:items-stretch">
					<section
						className={cn(
							COMPANION_SURFACE_SECTION_CLASS,
							'order-1 flex min-h-0 min-w-0 flex-col lg:min-h-full'
						)}
					>
						<div className="mb-2 flex flex-wrap items-center gap-1.5">
							<DocumentTextIcon className="size-4 text-(--companion-aura)" />
							<label
								htmlFor="ewa-companion-document-surface-markdown"
								className={cn(COMPANION_SURFACE_LABEL_CLASS, 'min-w-0 flex-1')}
							>
								{t('ewaCompanion.documentSurfaceMarkdownLabel')}
							</label>
							<span className="max-w-[40%] truncate text-[11px] text-(--desktop-text-secondary)">
								{title}
							</span>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								disabled={
									!surfacePayload.documentId || documentStructureLoading
								}
								onClick={() => {
									setStructurePanelOpen(true);
									void loadDocumentStructure();
								}}
							>
								{documentStructureLoading ? (
									<ArrowPathIcon className="mr-1 size-3.5 animate-spin" />
								) : null}
								{t('ewaCompanion.documentStructureButton')}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={() => setPreviewOpen((prev) => !prev)}
								aria-pressed={previewOpen}
							>
								{previewOpen ? (
									<EyeSlashIcon className="mr-1 size-3.5" />
								) : (
									<EyeIcon className="mr-1 size-3.5" />
								)}
								{previewOpen
									? t('ewaCompanion.documentSurfacePreviewOff')
									: t('ewaCompanion.documentSurfacePreviewOn')}
							</DesktopAppButton>
							{surfacePayload.documentId ? (
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									onClick={() =>
										requestOpenDocEditorV2WithUnifiedContent(
											surfacePayload.documentId as string,
											{ title }
										)
									}
								>
									<ComputerDesktopIcon className="mr-1 size-3.5" />
									{t('ewaCompanion.documentSurfaceOpenOnDesktop')}
								</DesktopAppButton>
							) : null}
						</div>
						{showDiscussHint ? (
							<div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-(--companion-aura)/30 bg-(--companion-aura)/10 px-2.5 py-2 text-[11px] text-(--desktop-text-primary)">
								<p>
									{t('ewaCompanion.documentSurfaceDiscussHint', {
										name: companionDisplayName,
									})}
								</p>
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									onClick={() => {
										markDocumentDiscussHintSeen(companionPrincipalId);
										setShowDiscussHint(false);
									}}
								>
									{t('ewaCompanion.documentSurfaceDiscussHintDismiss')}
								</DesktopAppButton>
							</div>
						) : null}
						{offlineDraftOnly ? (
							<div
								className="mb-2 rounded-md border border-amber-300/35 bg-amber-400/10 px-2.5 py-2 text-[11px] text-amber-100"
								role="status"
							>
								{t('ewaCompanion.documentSurfaceOfflineOnly')}
							</div>
						) : null}
						{(structurePanelOpen ||
							documentStructureLoading ||
							documentStructureError) &&
						(documentStructure ||
							documentStructureLoading ||
							documentStructureError) ? (
							<CompanionDocumentStructurePanel
								structure={documentStructure}
								loading={documentStructureLoading}
								error={documentStructureError}
								onRefresh={loadDocumentStructure}
								onSectionSelect={selectDocumentStructureSection}
							/>
						) : documentStructure && !structurePanelOpen ? (
							<button
								type="button"
								className="mb-2 w-full rounded-md border border-(--companion-divider)/70 bg-(--desktop-surface-soft)/15 px-2 py-1.5 text-left text-[11px] text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft)/30"
								onClick={() => setStructurePanelOpen(true)}
							>
								{t('ewaCompanion.documentStructureSummary', {
									count: documentStructure.sections.length,
									lines: documentStructure.totalLines,
								})}
							</button>
						) : null}
						{recoverableDraft && recoverableDraftSource ? (
							<CompanionDocumentDraftRecoveryBanner
								primaryDraft={recoverableDraft}
								primarySource={recoverableDraftSource}
								alternateDraft={alternateRecoverableDraft}
								alternateSource={alternateRecoverableSource}
								updatedAtLabel={recoverableDraftTime}
								compareOpen={draftCompareOpen}
								onToggleCompare={() => setDraftCompareOpen((prev) => !prev)}
								onRestore={restoreRecoverableDraft}
								onDiscard={discardRecoverableDraft}
							/>
						) : null}
						{loading ? (
							<div
								className="min-h-48 flex-1 animate-pulse rounded-md border border-(--companion-divider) bg-(--desktop-surface-soft)/25 lg:min-h-0"
								role="status"
								aria-live="polite"
								aria-busy="true"
							>
								<p className="px-3 py-2 text-[11px] text-(--companion-text-soft)">
									{t('ewaCompanion.documentSurfaceLoading')}
								</p>
							</div>
						) : previewOpen ? (
							<div
								className={cn(
									'min-h-48 flex-1 overflow-y-auto rounded-md border border-(--companion-divider)',
									'bg-(--companion-bg) px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap',
									'text-(--desktop-text-primary) lg:min-h-0'
								)}
							>
								{markdown || t('ewaCompanion.documentSurfacePlaceholder')}
							</div>
						) : (
							<textarea
								id="ewa-companion-document-surface-markdown"
								ref={textareaRef}
								value={markdown}
								onChange={(event) => {
									setMarkdown(event.target.value);
									setSaved(false);
									clearSaveConflict();
									setError(null);
									setPolicyBlocked(false);
								}}
								onKeyDown={(event) => {
									if (
										(event.metaKey || event.ctrlKey) &&
										event.key.toLowerCase() === 's'
									) {
										event.preventDefault();
										if (!saveDisabled) {
											void saveDocument();
										}
									}
								}}
								onSelect={syncSelection}
								onKeyUp={syncSelection}
								onMouseUp={syncSelection}
								spellCheck
								className={cn(
									'min-h-48 w-full flex-1 resize-none rounded-md border border-(--companion-divider) lg:min-h-0',
									'bg-(--companion-bg) px-3 py-2 font-mono text-[12px] leading-relaxed',
									'text-(--desktop-text-primary) placeholder:text-(--companion-text-soft)',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								placeholder={t('ewaCompanion.documentSurfacePlaceholder')}
							/>
						)}
						{documentRow && !documentRow.canSave ? (
							<p className="mt-2 text-[11px] text-amber-200">
								{t('ewaCompanion.documentSurfaceReadOnly')}
							</p>
						) : null}
						{serverDraftSyncError ? (
							<p className="mt-2 text-[11px] text-amber-200">
								{serverDraftSyncError}
							</p>
						) : null}
						{error ? (
							<div
								className="mt-2 rounded-md border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[11px] text-rose-100"
								role="alert"
								aria-live="assertive"
							>
								<p>{error}</p>
								{policyBlocked ? (
									<div className="mt-1.5 flex justify-end">
										<DesktopAppButton
											type="button"
											variant="neutral"
											size="sm"
											onClick={() => {
												setPolicyBlocked(false);
												setError(null);
												textareaRef.current?.focus();
											}}
										>
											{t('ewaCompanion.documentSurfacePolicyEdit')}
										</DesktopAppButton>
									</div>
								) : null}
							</div>
						) : null}
						{saveConflict ? (
							<div className="mt-2 rounded-md border border-rose-300/40 bg-rose-400/10 px-2.5 py-2 text-[11px] text-rose-100">
								<p>{t('ewaCompanion.documentSurfaceVersionConflictHint')}</p>
								<div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
									{saveConflict.serverDocument ? (
										<DesktopAppButton
											type="button"
											variant="neutral"
											size="sm"
											onClick={restoreServerVersionFromConflict}
										>
											{t('ewaCompanion.documentSurfaceVersionConflictReload')}
										</DesktopAppButton>
									) : null}
									<DesktopAppButton
										type="button"
										variant="accent"
										size="sm"
										disabled={saving}
										onClick={() => void saveDocument(true)}
									>
										{t('ewaCompanion.documentSurfaceVersionConflictForceSave')}
									</DesktopAppButton>
								</div>
							</div>
						) : null}
						{policyWarnings.length > 0 ? (
							<p className="mt-2 text-[11px] text-amber-200">
								{t('ewaCompanion.documentSurfacePolicyWarnings', {
									warnings: policyWarnings.join(', '),
								})}
							</p>
						) : null}
					</section>
					<CompanionDocumentSuggestionPane
						companionDisplayName={companionDisplayName}
						aiResult={aiResult}
						aiBusy={aiBusy}
						policyBusy={policyBusy}
						selection={selection}
						inlineActionControls={
							effectiveActionsHost ? null : inlineActionControls
						}
						onAppend={() => void applyAiResult('append')}
						onReplace={() => void applyAiResult('replace')}
					/>
				</div>
			</CompanionSurfacePanel>
		</>
	);
}
