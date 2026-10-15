/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Confirm-delete modal for assistant KB documents and FAQ entries.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - pages/Admin/assistant/useAssistantAdminModals.ts
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 */
import { cn } from '@/utils/cn';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_OVERLAY, DESKTOP_Z_INDEX } from '../../Desktop/constants';
import {
	DesktopAppButton,
	DesktopAppModalFrame,
} from '../../Desktop/components/DesktopAppChrome';
import { ShellPortalMount } from '../../Desktop/shell/shellPortal';
import type { AssistantDeleteTarget } from './useAssistantAdminModals';

type AssistantAdminDeleteModalProps = {
	deleteTarget: AssistantDeleteTarget;
	onDismiss: () => void;
	onConfirmKbDelete: (id: string) => void;
	onConfirmFaqDelete: (id: string) => void;
	deletePending: boolean;
	portalRef: React.RefObject<HTMLDivElement | null>;
	descId: string;
};

export function AssistantAdminDeleteModal({
	deleteTarget,
	onDismiss,
	onConfirmKbDelete,
	onConfirmFaqDelete,
	deletePending,
	portalRef,
	descId,
}: AssistantAdminDeleteModalProps): React.ReactElement | null {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });

	if (!deleteTarget || typeof document === 'undefined') {
		return null;
	}

	return (
		<ShellPortalMount layer="embedded_modal_backdrop">
			<div
				ref={portalRef}
				className="fixed inset-0 flex items-center justify-center p-4"
				style={{ zIndex: DESKTOP_Z_INDEX.MODAL }}
			>
				<button
					type="button"
					className={cn('absolute inset-0', DESKTOP_OVERLAY.backdrop)}
					aria-label={t('deleteModalDismissAria')}
					onClick={onDismiss}
				/>
				<div
					className="relative w-full max-w-md"
					style={{ zIndex: DESKTOP_Z_INDEX.MODAL_CONTENT }}
				>
					<DesktopAppModalFrame
						title={
							deleteTarget.kind === 'kb'
								? t('deleteKbModalTitle')
								: t('deleteFaqModalTitle')
						}
						onClose={onDismiss}
						closeLabel={t('cancel')}
						className="max-w-md shadow-lg shadow-black/20"
						role="alertdialog"
						aria-describedby={descId}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex flex-col gap-4 p-4">
							<p
								id={descId}
								className="text-sm leading-relaxed text-(--desktop-text-secondary)"
							>
								{deleteTarget.kind === 'kb'
									? t('confirmDeleteDoc')
									: t('confirmDeleteFaq')}
							</p>
							<div className="flex flex-wrap justify-end gap-2">
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									disabled={deletePending}
									onClick={onDismiss}
								>
									{t('cancel')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant="danger"
									size="sm"
									disabled={deletePending}
									onClick={() => {
										if (deleteTarget.kind === 'kb') {
											onConfirmKbDelete(deleteTarget.id);
										} else {
											onConfirmFaqDelete(deleteTarget.id);
										}
									}}
								>
									{deletePending ? (
										<ArrowPathIcon
											className="h-4 w-4 animate-spin"
											aria-hidden
										/>
									) : null}
									{t('deleteDoc')}
								</DesktopAppButton>
							</div>
						</div>
					</DesktopAppModalFrame>
				</div>
			</div>
		</ShellPortalMount>
	);
}
