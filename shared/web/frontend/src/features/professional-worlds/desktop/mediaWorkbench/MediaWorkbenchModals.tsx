/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Album delete confirm modal and full-size content preview overlay for the
 * media workbench.
 *
 * Invariants:
 * - Album delete requires typed confirmation via ConfirmDeleteModal.
 * - Preview closes without mutating listing media.
 *
 * Related:
 * - ConfirmDeleteModal
 * - professionalWorldsLayoutTokens.ts (`PW_MEDIA_MODAL_BACKDROP_CLASS`)
 */

import { ContentThumbnail } from '@/components/UnifiedContent/components/ContentThumbnail/ContentThumbnail';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { DesktopAppModalFrame } from '@/pages/Desktop/components/DesktopAppChrome';
import type { ReactElement } from 'react';
import { PW_MEDIA_MODAL_BACKDROP_CLASS } from '../layout/professionalWorldsLayoutTokens';
import type { ProfessionalMediaWorkbenchModel } from './useProfessionalMediaWorkbench';

type ModalsProps = {
	readonly model: Pick<
		ProfessionalMediaWorkbenchModel,
		| 't'
		| 'albumDeleteId'
		| 'albumDeleteTitle'
		| 'previewContentId'
		| 'previewLabel'
		| 'closeAlbumDelete'
		| 'confirmDeleteAlbum'
		| 'closePreview'
	>;
};

export function MediaWorkbenchModals({ model }: ModalsProps): ReactElement {
	const {
		t,
		albumDeleteId,
		albumDeleteTitle,
		previewContentId,
		previewLabel,
		closeAlbumDelete,
		confirmDeleteAlbum,
		closePreview,
	} = model;

	return (
		<>
			<ConfirmDeleteModal
				isOpen={albumDeleteId !== null}
				onClose={closeAlbumDelete}
				onConfirm={confirmDeleteAlbum}
				title={t('mediaWorkbench.albumDeleteTitle')}
				itemName={albumDeleteTitle || undefined}
				requireTyping={true}
				confirmText={t('mediaWorkbench.albumDeleteType')}
				cancelButtonLabel={t('mediaWorkbench.modalCancel')}
				confirmButtonLabel={t('mediaWorkbench.albumDelete')}
				confirmButtonLoadingLabel={t('mediaWorkbench.albumDeleting')}
			/>
			{previewContentId ? (
				<div className={PW_MEDIA_MODAL_BACKDROP_CLASS}>
					<div className="w-full max-w-4xl">
						<DesktopAppModalFrame
							title={previewLabel || t('mediaWorkbench.previewTitle')}
							onClose={closePreview}
							className="max-h-[90vh] max-w-4xl"
						>
							<div className="max-h-[75vh] overflow-auto p-3">
								<ContentThumbnail
									className="h-auto max-h-[70vh] w-full rounded-(--desktop-radius-xs) object-contain"
									contentId={previewContentId}
									loadingClassName="h-[40vh] w-full"
									alt={previewLabel || t('mediaWorkbench.previewTitle')}
								/>
							</div>
						</DesktopAppModalFrame>
					</div>
				</div>
			) : null}
		</>
	);
}
