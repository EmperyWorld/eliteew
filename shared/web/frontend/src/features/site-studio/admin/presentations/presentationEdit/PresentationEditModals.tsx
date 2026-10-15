/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Confirm modals for duplicate, delete slide, empty slides save, and remove image.
 *
 * Related:
 * - PresentationEditPage.tsx
 */

import { DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';

export type PresentationEditModalsProps = {
	showDuplicateModal: boolean;
	onCloseDuplicateModal: () => void;
	onConfirmDuplicate: () => void;
	pendingDeleteSlideIndex: number | null;
	onCancelDeleteSlide: () => void;
	onConfirmDeleteSlide: () => void;
	showEmptySlidesModal: boolean;
	onCloseEmptySlidesModal: () => void;
	onConfirmEmptySlidesSave: () => void;
	showRemoveImageModal: boolean;
	onCloseRemoveImageModal: () => void;
	onConfirmRemoveSlideImage: () => void;
};

export function PresentationEditModals({
	showDuplicateModal,
	onCloseDuplicateModal,
	onConfirmDuplicate,
	pendingDeleteSlideIndex,
	onCancelDeleteSlide,
	onConfirmDeleteSlide,
	showEmptySlidesModal,
	onCloseEmptySlidesModal,
	onConfirmEmptySlidesSave,
	showRemoveImageModal,
	onCloseRemoveImageModal,
	onConfirmRemoveSlideImage,
}: PresentationEditModalsProps) {
	const { t } = useTranslation('siteStudio');

	return (
		<>
			<ConfirmDeleteModal
				isOpen={showDuplicateModal}
				onClose={onCloseDuplicateModal}
				onConfirm={onConfirmDuplicate}
				title={t('adminCatalog.presentationEditor.duplicateModalTitle')}
				warningMessage={t(
					'adminCatalog.presentationEditor.duplicateModalWarning'
				)}
				confirmButtonLabel={t(
					'adminCatalog.presentationEditor.duplicateConfirm'
				)}
				confirmButtonLoadingLabel={t(
					'adminCatalog.presentationEditor.duplicateWorking'
				)}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
				confirmIcon={<DocumentDuplicateIcon width={18} height={18} />}
			/>

			<ConfirmDeleteModal
				isOpen={pendingDeleteSlideIndex !== null}
				onClose={onCancelDeleteSlide}
				onConfirm={onConfirmDeleteSlide}
				title={t('adminCatalog.presentationEditor.deleteSlideModalTitle')}
				itemName={
					pendingDeleteSlideIndex !== null
						? t('adminCatalog.presentationEditor.slideNumberLabel', {
								number: pendingDeleteSlideIndex + 1,
							})
						: undefined
				}
				warningMessage={t(
					'adminCatalog.presentationEditor.deleteSlideModalWarning'
				)}
				confirmButtonLabel={t('adminCatalog.common.delete')}
				confirmButtonLoadingLabel={t('adminCatalog.common.deleteModalDeleting')}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
			/>

			<ConfirmDeleteModal
				isOpen={showEmptySlidesModal}
				onClose={onCloseEmptySlidesModal}
				onConfirm={onConfirmEmptySlidesSave}
				title={t('adminCatalog.presentationEditor.emptySlidesModalTitle')}
				warningMessage={t(
					'adminCatalog.presentationEditor.emptySlidesModalWarning'
				)}
				confirmButtonLabel={t('adminCatalog.presentationEditor.saveAnyway')}
				confirmButtonLoadingLabel={t(
					'adminCatalog.presentationEditor.savingWorking'
				)}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
			/>

			<ConfirmDeleteModal
				isOpen={showRemoveImageModal}
				onClose={onCloseRemoveImageModal}
				onConfirm={onConfirmRemoveSlideImage}
				title={t('adminCatalog.presentationEditor.removeImageModalTitle')}
				warningMessage={t(
					'adminCatalog.presentationEditor.removeImageModalWarning'
				)}
				confirmButtonLabel={t('adminCatalog.common.delete')}
				confirmButtonLoadingLabel={t('adminCatalog.common.deleteModalDeleting')}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
			/>
		</>
	);
}
