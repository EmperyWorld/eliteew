import { useTranslation } from 'react-i18next';

import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { EditCompetitorModal } from '../components/EditCompetitorModal';
import { EditJobStoryModal } from '../components/EditJobStoryModal';
import { EditSwotModal } from '../components/EditSwotModal';
import type {
	MarketingCompetitor,
	MarketingJobStory,
	MarketingSwot,
	UpdateCompetitorPayload,
	UpdateJobStoryPayload,
	UpdateSwotPayload,
} from '../marketingCabinetApi';

export type MarketingCabinetDeleteModalState = {
	type:
		| 'company'
		| 'project'
		| 'job'
		| 'valueProp'
		| 'competitor'
		| 'research'
		| 'swot';
	id: string;
	name: string;
} | null;

export interface MarketingCabinetGlobalModalsProps {
	editingJobStory: MarketingJobStory | null;
	onSaveJobStory: (payload: UpdateJobStoryPayload) => void;
	onCancelJobStory: () => void;
	isJobStorySavePending: boolean;

	editingSwot: MarketingSwot | null;
	onSaveSwot: (payload: UpdateSwotPayload) => void;
	onCancelSwot: () => void;
	isSwotSavePending: boolean;

	editingCompetitor: MarketingCompetitor | null;
	onSaveCompetitor: (payload: UpdateCompetitorPayload) => void;
	onCancelCompetitor: () => void;
	isCompetitorSavePending: boolean;

	deleteModal: MarketingCabinetDeleteModalState;
	onConfirmDelete: () => void;
	onCancelDelete: () => void;
	isDeletePending: boolean;

	teamRemoveConfirm: { memberId: string; displayName: string } | null;
	onConfirmTeamRemove: () => void;
	onCancelTeamRemove: () => void;
	isTeamRemovePending: boolean;

	teamTransferConfirm: {
		newLeadUserId: string;
		displayName: string;
	} | null;
	onConfirmTeamTransfer: () => void;
	onCancelTeamTransfer: () => void;
	isTeamTransferPending: boolean;
}

export function MarketingCabinetGlobalModals({
	editingJobStory,
	onSaveJobStory,
	onCancelJobStory,
	isJobStorySavePending,
	editingSwot,
	onSaveSwot,
	onCancelSwot,
	isSwotSavePending,
	editingCompetitor,
	onSaveCompetitor,
	onCancelCompetitor,
	isCompetitorSavePending,
	deleteModal,
	onConfirmDelete,
	onCancelDelete,
	isDeletePending,
	teamRemoveConfirm,
	onConfirmTeamRemove,
	onCancelTeamRemove,
	isTeamRemovePending,
	teamTransferConfirm,
	onConfirmTeamTransfer,
	onCancelTeamTransfer,
	isTeamTransferPending,
}: MarketingCabinetGlobalModalsProps) {
	const { t } = useTranslation('marketing');

	return (
		<>
			<EditJobStoryModal
				isOpen={editingJobStory !== null}
				job={editingJobStory}
				onSave={onSaveJobStory}
				onCancel={onCancelJobStory}
				isLoading={isJobStorySavePending}
			/>
			<EditSwotModal
				isOpen={editingSwot !== null}
				swot={editingSwot}
				onSave={onSaveSwot}
				onCancel={onCancelSwot}
				isLoading={isSwotSavePending}
			/>
			<EditCompetitorModal
				isOpen={editingCompetitor !== null}
				competitor={editingCompetitor}
				onSave={onSaveCompetitor}
				onCancel={onCancelCompetitor}
				isLoading={isCompetitorSavePending}
			/>
			<DeleteConfirmModal
				isOpen={deleteModal !== null}
				title={
					deleteModal?.type === 'company'
						? t('cabinetPage.deleteModal.archiveCompanyTitle')
						: deleteModal?.type === 'project'
							? t('cabinetPage.deleteModal.archiveProjectTitle')
							: t('cabinetPage.deleteModal.deleteDefaultTitle')
				}
				message={
					deleteModal
						? deleteModal.type === 'project'
							? t('cabinetPage.deleteModal.archiveProjectMessage', {
									name: deleteModal.name,
								})
							: deleteModal.type === 'company'
								? t('cabinetPage.deleteModal.archiveMessage', {
										name: deleteModal.name,
									})
								: t('cabinetPage.deleteModal.deleteMessage', {
										name: deleteModal.name,
									})
						: ''
				}
				confirmLabel={
					deleteModal?.type === 'company' || deleteModal?.type === 'project'
						? t('cabinetPage.deleteModal.confirmArchive')
						: t('cabinetPage.deleteModal.confirmDelete')
				}
				onConfirm={onConfirmDelete}
				onCancel={onCancelDelete}
				isLoading={isDeletePending}
				hint={t('cabinetPage.deleteModal.escapeHint')}
				cancelLabel={t('common.cancel')}
			/>
			<DeleteConfirmModal
				isOpen={teamRemoveConfirm !== null}
				title={t('cabinetPage.setup.teamRemoveConfirmTitle')}
				message={t('cabinetPage.setup.teamRemoveConfirmMessage', {
					name: teamRemoveConfirm?.displayName ?? '',
				})}
				confirmLabel={t('cabinetPage.setup.teamRemoveConfirmAction')}
				cancelLabel={t('common.cancel')}
				pendingLabel={t('cabinetPage.setup.teamRemovePending')}
				hint={t('cabinetPage.deleteModal.escapeHint')}
				onConfirm={onConfirmTeamRemove}
				onCancel={onCancelTeamRemove}
				isLoading={isTeamRemovePending}
			/>
			<DeleteConfirmModal
				isOpen={teamTransferConfirm !== null}
				title={t('cabinetPage.setup.teamTransferConfirmTitle')}
				message={t('cabinetPage.setup.teamTransferConfirmMessage', {
					name: teamTransferConfirm?.displayName ?? '',
				})}
				confirmLabel={t('cabinetPage.setup.teamTransferConfirmAction')}
				cancelLabel={t('common.cancel')}
				pendingLabel={t('cabinetPage.setup.teamTransferPending')}
				confirmVariant="accent"
				hint={t('cabinetPage.deleteModal.escapeHint')}
				onConfirm={onConfirmTeamTransfer}
				onCancel={onCancelTeamTransfer}
				isLoading={isTeamTransferPending}
			/>
		</>
	);
}
