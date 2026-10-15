/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Renders the Content Manager Pro modal stack while the parent owns orchestration state.
 *
 * Invariants:
 * - Modal ordering and embedded positioning match the original ContentManagerPro stack.
 * - Batch delete execution remains delegated to useContentManagerSelection.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - hooks/useContentManagerBulkModals.ts
 * - hooks/useContentManagerPreviewKeyboard.ts
 */
import type { TFunction } from 'i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import {
	ArrowUturnLeftIcon,
	FolderOpenIcon,
} from '@heroicons/react/24/outline';
import type { AutoSortScope } from '../sortToSystemFolders';
import type {
	TenancyCompany,
	TenancyProject,
} from '../hooks/useTenancyOptions';
import { ContentManagerBatchAssignModal } from './ContentManagerBatchAssignModal';
import { ContentManagerBulkMoveModal } from './ContentManagerBulkMoveModal';
import { ContentManagerCopyModal } from './ContentManagerCopyModal';
import {
	ContentManagerEditModal,
	type ContentManagerEditFolderOption,
	type ContentManagerEditFormState,
	type ContentManagerEditModalProps,
} from './ContentManagerEditModal';
import { ContentManagerOwnedArchiveModal } from './ContentManagerOwnedArchiveModal';

export type ContentManagerProModalsProps = {
	t: TFunction<'contentManager'>;
	embedded: boolean;
	editItem: ContentItem | null;
	editForm: ContentManagerEditFormState;
	setEditForm: React.Dispatch<
		React.SetStateAction<ContentManagerEditFormState>
	>;
	editNameError: string | null;
	setEditNameError: React.Dispatch<React.SetStateAction<string | null>>;
	setEditItem: React.Dispatch<React.SetStateAction<ContentItem | null>>;
	updateFile: () => void | Promise<void>;
	folders: ContentManagerEditFolderOption[];
	companies: TenancyCompany[];
	projects: TenancyProject[];
	loadingCompanies: boolean;
	loadingProjects: boolean;
	refreshProjects: (companyId: string | null) => void | Promise<void>;
	friendsForEditQuery: ContentManagerEditModalProps['friendsForEditQuery'];
	assignTenancyOpen: boolean;
	assignTenancyLoading: boolean;
	assignCompanyId: string;
	assignProjectId: string;
	setAssignCompanyId: React.Dispatch<React.SetStateAction<string>>;
	setAssignProjectId: React.Dispatch<React.SetStateAction<string>>;
	setAssignTenancyOpen: React.Dispatch<React.SetStateAction<boolean>>;
	batchAssignToProject: () => void | Promise<void>;
	ownedArchiveModalOpen: boolean;
	setOwnedArchiveModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	downloadingOwnedArchive: boolean;
	ownedFilesCount: number;
	downloadOwnedArchive: () => Promise<void>;
	autoSortConfirmScope: AutoSortScope | null;
	setAutoSortConfirmScope: React.Dispatch<
		React.SetStateAction<AutoSortScope | null>
	>;
	executeAutoSortToSystemFolders: (scope: AutoSortScope) => Promise<void>;
	versionRestorePending: {
		contentId: string;
		versionNumber: number;
	} | null;
	setVersionRestorePending: React.Dispatch<
		React.SetStateAction<{
			contentId: string;
			versionNumber: number;
		} | null>
	>;
	executeVersionRestore: () => Promise<void>;
	bulkMoveOpen: boolean;
	bulkMoveLoading: boolean;
	selectedIds: ReadonlySet<string>;
	closeBulkMove: () => void;
	executeBulkMove: (targetFolderItemId: string | null) => Promise<void>;
	copyModalOpen: boolean;
	copyTargetItem: ContentItem | null;
	copyLoading: boolean;
	closeCopyFile: () => void;
	confirmCopyFile: (name: string) => Promise<void>;
	pendingDeleteFileId: string | null;
	setPendingDeleteFileId: React.Dispatch<React.SetStateAction<string | null>>;
	pendingDeleteIsSharedOnly: boolean;
	executeDeleteFile: () => Promise<void>;
	batchDeleteModalOpen: boolean;
	setBatchDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
	executeBatchDelete: () => Promise<void>;
};

export function ContentManagerProModals({
	t,
	embedded,
	editItem,
	editForm,
	setEditForm,
	editNameError,
	setEditNameError,
	setEditItem,
	updateFile,
	folders,
	companies,
	projects,
	loadingCompanies,
	loadingProjects,
	refreshProjects,
	friendsForEditQuery,
	assignTenancyOpen,
	assignTenancyLoading,
	assignCompanyId,
	assignProjectId,
	setAssignCompanyId,
	setAssignProjectId,
	setAssignTenancyOpen,
	batchAssignToProject,
	ownedArchiveModalOpen,
	setOwnedArchiveModalOpen,
	downloadingOwnedArchive,
	ownedFilesCount,
	downloadOwnedArchive,
	autoSortConfirmScope,
	setAutoSortConfirmScope,
	executeAutoSortToSystemFolders,
	versionRestorePending,
	setVersionRestorePending,
	executeVersionRestore,
	bulkMoveOpen,
	bulkMoveLoading,
	selectedIds,
	closeBulkMove,
	executeBulkMove,
	copyModalOpen,
	copyTargetItem,
	copyLoading,
	closeCopyFile,
	confirmCopyFile,
	pendingDeleteFileId,
	setPendingDeleteFileId,
	pendingDeleteIsSharedOnly,
	executeDeleteFile,
	batchDeleteModalOpen,
	setBatchDeleteModalOpen,
	executeBatchDelete,
}: ContentManagerProModalsProps): React.ReactElement {
	return (
		<>
			<ContentManagerEditModal
				item={editItem}
				embedded={embedded}
				editForm={editForm}
				setEditForm={setEditForm}
				editNameError={editNameError}
				setEditNameError={setEditNameError}
				onClose={() => setEditItem(null)}
				onSave={updateFile}
				folders={folders}
				companies={companies}
				projects={projects}
				loadingCompanies={loadingCompanies}
				loadingProjects={loadingProjects}
				refreshProjects={refreshProjects}
				friendsForEditQuery={friendsForEditQuery}
			/>
			<ContentManagerBatchAssignModal
				open={assignTenancyOpen}
				embedded={embedded}
				loading={assignTenancyLoading}
				assignCompanyId={assignCompanyId}
				assignProjectId={assignProjectId}
				onCompanyChange={(value) => {
					setAssignCompanyId(value);
					setAssignProjectId('');
					void refreshProjects(value || null);
				}}
				onProjectChange={setAssignProjectId}
				onClose={() => setAssignTenancyOpen(false)}
				onApply={batchAssignToProject}
				companies={companies}
				projects={projects}
				loadingCompanies={loadingCompanies}
				loadingProjects={loadingProjects}
			/>
			<ContentManagerOwnedArchiveModal
				open={ownedArchiveModalOpen}
				embedded={embedded}
				loading={downloadingOwnedArchive}
				ownedFilesCount={ownedFilesCount}
				onClose={() => setOwnedArchiveModalOpen(false)}
				onConfirm={async () => {
					setOwnedArchiveModalOpen(false);
					await downloadOwnedArchive();
				}}
			/>
			<ConfirmDeleteModal
				isOpen={autoSortConfirmScope !== null}
				onClose={() => setAutoSortConfirmScope(null)}
				onConfirm={async () => {
					const scope = autoSortConfirmScope;
					if (!scope) return;
					await executeAutoSortToSystemFolders(scope);
					setAutoSortConfirmScope(null);
				}}
				closeAfterConfirm={false}
				title={t('files.autoSort.modalTitleAutoSort')}
				warningMessage={
					autoSortConfirmScope === 'unfiled'
						? t('files.autoSort.confirmUnfiled')
						: autoSortConfirmScope === 'content_folder'
							? t('files.autoSort.confirmContent')
							: ''
				}
				cancelButtonLabel={t('pro.modalCancel')}
				confirmButtonLabel={t('pro.modalConfirm')}
				confirmButtonLoadingLabel={t('files.autoSort.running')}
				confirmIcon={<FolderOpenIcon width={18} height={18} />}
			/>
			<ConfirmDeleteModal
				isOpen={versionRestorePending !== null}
				onClose={() => setVersionRestorePending(null)}
				onConfirm={executeVersionRestore}
				closeAfterConfirm={false}
				title={t('pro.modalTitleRestoreVersion')}
				warningMessage={
					versionRestorePending
						? t('pro.confirm.restoreVersion', {
								n: versionRestorePending.versionNumber,
							})
						: ''
				}
				cancelButtonLabel={t('pro.modalCancel')}
				confirmButtonLabel={t('pro.modalConfirmRestore')}
				confirmButtonLoadingLabel={t('pro.modalRestoring')}
				confirmIcon={<ArrowUturnLeftIcon width={18} height={18} />}
			/>
			<ContentManagerBulkMoveModal
				open={bulkMoveOpen}
				embedded={embedded}
				folders={folders}
				selectedIds={Array.from(selectedIds)}
				loading={bulkMoveLoading}
				onClose={closeBulkMove}
				onMove={executeBulkMove}
			/>
			<ContentManagerCopyModal
				open={copyModalOpen}
				embedded={embedded}
				item={copyTargetItem}
				loading={copyLoading}
				onClose={closeCopyFile}
				onConfirm={confirmCopyFile}
			/>
			<ConfirmDeleteModal
				isOpen={pendingDeleteFileId !== null}
				onClose={() => setPendingDeleteFileId(null)}
				onConfirm={executeDeleteFile}
				closeAfterConfirm={false}
				title={t(
					pendingDeleteIsSharedOnly
						? 'pro.modalTitleRemoveSharedFile'
						: 'pro.modalTitleDeleteFile'
				)}
				warningMessage={t(
					pendingDeleteIsSharedOnly
						? 'pro.confirm.removeSharedFile'
						: 'pro.confirm.deleteFile'
				)}
				cancelButtonLabel={t('pro.modalCancel')}
				confirmButtonLabel={t(
					pendingDeleteIsSharedOnly
						? 'pro.modalConfirmRemove'
						: 'pro.modalConfirmDelete'
				)}
				confirmButtonLoadingLabel={t('pro.modalDeleting')}
			/>
			<ConfirmDeleteModal
				isOpen={batchDeleteModalOpen}
				onClose={() => setBatchDeleteModalOpen(false)}
				onConfirm={async () => {
					await executeBatchDelete();
					setBatchDeleteModalOpen(false);
				}}
				closeAfterConfirm={false}
				title={t('pro.modalTitleDeleteMany')}
				warningMessage={`${t('pro.confirm.deleteMany', { count: selectedIds.size })}\n\n${t('pro.confirm.deleteManyIrreversible')}`}
				cancelButtonLabel={t('pro.modalCancel')}
				confirmButtonLabel={t('pro.modalConfirmDelete')}
				confirmButtonLoadingLabel={t('pro.modalDeleting')}
			/>
		</>
	);
}
