/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared confirm-delete modal for Professional Worlds workspace entities (clients, deals, drafts, listings).
 *
 * Invariants:
 * - Snapshot updates only after successful DELETE (204); callers handle patchSnapshot in onConfirm.
 * - Typed DELETE confirm is reserved for high-risk operator flows; workspace deletes use explicit copy only.
 *
 * Related:
 * - @/components/ui/modals/ConfirmDeleteModal
 * - runtimePanels/ClientsWorkspacePanel.tsx
 */

import { useTranslation } from 'react-i18next';

import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

export type ProfessionalWorldsDeleteActionProps = {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => Promise<void>;
	title: string;
	itemName?: string;
	warningMessage: string;
	confirmButtonLabel: string;
	confirmButtonLoadingLabel?: string;
	requireTyping?: boolean;
};

export function ProfessionalWorldsDeleteAction({
	isOpen,
	onClose,
	onConfirm,
	title,
	itemName,
	warningMessage,
	confirmButtonLabel,
	confirmButtonLoadingLabel,
	requireTyping = false,
}: ProfessionalWorldsDeleteActionProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);

	return (
		<ConfirmDeleteModal
			isOpen={isOpen}
			onClose={onClose}
			onConfirm={onConfirm}
			title={title}
			itemName={itemName}
			warningMessage={warningMessage}
			requireTyping={requireTyping}
			cancelButtonLabel={t('deleteModal.cancel')}
			confirmButtonLabel={confirmButtonLabel}
			confirmButtonLoadingLabel={
				confirmButtonLoadingLabel ?? t('deleteModal.removing')
			}
		/>
	);
}
