/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin orchestrator for product assistant admin: settings, preview, KB, FAQ.
 *
 * Invariants:
 * - KB index `product_assistant_kb` отделён от marketing/desktop chat RAG.
 *
 * Related:
 * - pages/Desktop/services/productDesktopApi.ts
 * - documentation/product/PRODUCT-ASSISTANT-HANDBOOK.md
 */
import { cn } from '@/utils/cn';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_SURFACE } from '../../Desktop/constants';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { AssistantAdminBulkActionModal } from './AssistantAdminBulkActionModal';
import { AssistantAdminDeleteModal } from './AssistantAdminDeleteModal';
import { AssistantFaqPanel } from './AssistantFaqPanel';
import { AssistantKbPanel } from './AssistantKbPanel';
import { AssistantPreviewPanel } from './AssistantPreviewPanel';
import { AssistantSettingsPanel } from './AssistantSettingsPanel';
import { useAssistantAdminModals } from './useAssistantAdminModals';
import { useAssistantAdminSettings } from './useAssistantAdminSettings';
import { useAssistantFaqAdmin } from './useAssistantFaqAdmin';
import { useAssistantKbAdmin } from './useAssistantKbAdmin';
import { useAssistantPreview } from './useAssistantPreview';

export function AssistantAdminSection(): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });

	const settings = useAssistantAdminSettings();
	const preview = useAssistantPreview();
	const faq = useAssistantFaqAdmin();
	const kb = useAssistantKbAdmin();
	const modals = useAssistantAdminModals();

	const deletePending =
		modals.deleteTarget?.kind === 'kb'
			? kb.isDeleteKbPending
			: modals.deleteTarget?.kind === 'faq'
				? faq.isDeletePending
				: false;

	const bulkModalPending =
		modals.bulkActionModal === 'purge'
			? kb.isPurgeKbPending
			: modals.bulkActionModal === 'reindex'
				? kb.isReindexAllKbPending
				: modals.bulkActionModal === 'sync-handbook'
					? kb.isSyncHandbookPending
					: false;

	const handleConfirmKbDelete = React.useCallback(
		(id: string) => {
			kb.deleteKb(id, {
				onSuccess: () => modals.setDeleteTarget(null),
			});
		},
		[kb, modals]
	);

	const handleConfirmFaqDelete = React.useCallback(
		(id: string) => {
			faq.deleteFaq(id, {
				onSuccess: () => modals.setDeleteTarget(null),
			});
		},
		[faq, modals]
	);

	const handleConfirmPurge = React.useCallback(() => {
		kb.purgeKb(undefined, {
			onSuccess: () => modals.setBulkActionModal(null),
		});
	}, [kb, modals]);

	const handleConfirmReindexAll = React.useCallback(() => {
		kb.reindexAllKb(undefined, {
			onSuccess: () => modals.setBulkActionModal(null),
		});
	}, [kb, modals]);

	const handleConfirmSyncHandbook = React.useCallback(() => {
		kb.syncHandbook(undefined, {
			onSuccess: (data) => {
				if (data.status === 'started') {
					modals.setBulkActionModal(null);
				}
			},
		});
	}, [kb, modals]);

	return (
		<>
			<AdminSectionFrame variant="full" className="flex flex-col gap-6">
				<div
					className={cn(
						'border border-violet-500/25 bg-violet-950/20 p-4 text-sm text-white/75 shadow-sm shadow-black/20',
						DESKTOP_SURFACE.radius
					)}
				>
					{t('qdrantInfo')}
				</div>

				{settings.settings ? (
					<AssistantSettingsPanel
						llamaModelDraft={settings.llamaModelDraft}
						setLlamaModelDraft={settings.setLlamaModelDraft}
						extraPromptDraft={settings.extraPromptDraft}
						setExtraPromptDraft={settings.setExtraPromptDraft}
						ragEnabledDraft={settings.ragEnabledDraft}
						setRagEnabledDraft={settings.setRagEnabledDraft}
						ragTopKDraft={settings.ragTopKDraft}
						setRagTopKDraft={settings.setRagTopKDraft}
						onSave={settings.saveSettings}
						isSaving={settings.isSaving}
					/>
				) : null}

				<AssistantPreviewPanel
					panelRef={preview.previewPanelRef}
					previewQuestion={preview.previewQuestion}
					setPreviewQuestion={preview.setPreviewQuestion}
					previewIncludeMyHistory={preview.previewIncludeMyHistory}
					setPreviewIncludeMyHistory={preview.setPreviewIncludeMyHistory}
					previewResult={preview.previewResult}
					onRunPreview={preview.runPreview}
					onCopyPrompt={preview.copyPreviewPrompt}
					isPending={preview.isPreviewPending}
				/>

				<AssistantKbPanel
					kbSummaryQuery={kb.kbSummaryQuery}
					kbUploadLimitsQuery={kb.kbUploadLimitsQuery}
					kbDetailQuery={kb.kbDetailQuery}
					kbDocuments={kb.kbDocuments}
					kbStatusOptions={kb.kbStatusOptions}
					filteredKbDocuments={kb.filteredKbDocuments}
					isKbListLoading={kb.kbQuery.isLoading}
					kbJobPolling={kb.kbJobPolling}
					handbookSyncLimit={kb.handbookSyncLimit}
					setHandbookSyncLimit={kb.setHandbookSyncLimit}
					handbookSyncLimitParam={kb.handbookSyncLimitParam}
					lastHandbookDryRun={kb.lastHandbookDryRun}
					kbTitle={kb.kbTitle}
					setKbTitle={kb.setKbTitle}
					kbBody={kb.kbBody}
					setKbBody={kb.setKbBody}
					kbUploadTitle={kb.kbUploadTitle}
					setKbUploadTitle={kb.setKbUploadTitle}
					kbUploadFiles={kb.kbUploadFiles}
					onKbUploadFilesChange={kb.handleKbUploadFilesChange}
					editKbId={kb.editKbId}
					setEditKbId={kb.setEditKbId}
					kbListSearch={kb.kbListSearch}
					setKbListSearch={kb.setKbListSearch}
					kbStatusFilter={kb.kbStatusFilter}
					setKbStatusFilter={kb.setKbStatusFilter}
					onCreateKb={kb.createKb}
					isCreateKbPending={kb.isCreateKbPending}
					onReindexKb={kb.reindexKb}
					isReindexKbPending={kb.isReindexKbPending}
					onPatchKb={kb.patchKb}
					isPatchKbPending={kb.isPatchKbPending}
					onUploadKb={kb.uploadKb}
					isUploadKbPending={kb.isUploadKbPending}
					onSyncHandbookDryRun={kb.syncHandbookDryRun}
					isSyncHandbookDryRunPending={kb.isSyncHandbookDryRunPending}
					onSyncHandbook={kb.syncHandbook}
					isSyncHandbookPending={kb.isSyncHandbookPending}
					onOpenBulkModal={modals.setBulkActionModal}
					isReindexAllKbPending={kb.isReindexAllKbPending}
					isPurgeKbPending={kb.isPurgeKbPending}
					onRequestDeleteKb={(id) => modals.setDeleteTarget({ kind: 'kb', id })}
				/>

				<AssistantFaqPanel
					items={faq.items}
					filteredFaqItems={faq.filteredFaqItems}
					faqListSearch={faq.faqListSearch}
					setFaqListSearch={faq.setFaqListSearch}
					q={faq.q}
					setQ={faq.setQ}
					a={faq.a}
					setA={faq.setA}
					sortOrder={faq.sortOrder}
					setSortOrder={faq.setSortOrder}
					editing={faq.editing}
					setEditing={faq.setEditing}
					isLoading={faq.isLoading}
					onCreateFaq={faq.createFaq}
					isCreatePending={faq.isCreatePending}
					onUpdateFaq={faq.updateFaq}
					isUpdatePending={faq.isUpdatePending}
					onFillPreviewFromFaq={preview.fillPreviewFromFaq}
					onRequestDelete={(id) => modals.setDeleteTarget({ kind: 'faq', id })}
				/>
			</AdminSectionFrame>

			<AssistantAdminDeleteModal
				deleteTarget={modals.deleteTarget}
				onDismiss={() => modals.setDeleteTarget(null)}
				onConfirmKbDelete={handleConfirmKbDelete}
				onConfirmFaqDelete={handleConfirmFaqDelete}
				deletePending={deletePending}
				portalRef={modals.deleteModalPortalRef}
				descId={modals.deleteModalDescId}
			/>

			<AssistantAdminBulkActionModal
				bulkActionModal={modals.bulkActionModal}
				onDismiss={() => modals.setBulkActionModal(null)}
				onConfirmPurge={handleConfirmPurge}
				onConfirmReindexAll={handleConfirmReindexAll}
				onConfirmSyncHandbook={handleConfirmSyncHandbook}
				bulkModalPending={bulkModalPending}
				lastHandbookDryRun={kb.lastHandbookDryRun}
				portalRef={modals.bulkModalPortalRef}
				descId={modals.bulkModalDescId}
			/>
		</>
	);
}
