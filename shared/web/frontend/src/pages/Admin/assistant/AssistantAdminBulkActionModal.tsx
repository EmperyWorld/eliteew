/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bulk KB action confirm modal: purge, reindex-all, handbook sync.
 *
 * Invariants:
 * - Handbook sync confirm shows last dry-run path when available.
 *
 * Related:
 * - pages/Admin/assistant/useAssistantAdminModals.ts
 * - pages/Admin/assistant/useAssistantKbAdmin.ts
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
import type { HandbookDryRunSnapshot } from './useAssistantKbAdmin';
import type { AssistantBulkActionModal } from './useAssistantAdminModals';

type AssistantAdminBulkActionModalProps = {
	bulkActionModal: AssistantBulkActionModal;
	onDismiss: () => void;
	onConfirmPurge: () => void;
	onConfirmReindexAll: () => void;
	onConfirmSyncHandbook: () => void;
	bulkModalPending: boolean;
	lastHandbookDryRun: HandbookDryRunSnapshot | null;
	portalRef: React.RefObject<HTMLDivElement | null>;
	descId: string;
};

export function AssistantAdminBulkActionModal({
	bulkActionModal,
	onDismiss,
	onConfirmPurge,
	onConfirmReindexAll,
	onConfirmSyncHandbook,
	bulkModalPending,
	lastHandbookDryRun,
	portalRef,
	descId,
}: AssistantAdminBulkActionModalProps): React.ReactElement | null {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });

	if (!bulkActionModal || typeof document === 'undefined') {
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
					aria-label={t('bulkModalDismissAria')}
					onClick={onDismiss}
				/>
				<div
					className="relative w-full max-w-md"
					style={{ zIndex: DESKTOP_Z_INDEX.MODAL_CONTENT }}
				>
					<DesktopAppModalFrame
						title={
							bulkActionModal === 'purge'
								? t('purgeKbTitle')
								: bulkActionModal === 'reindex'
									? t('reindexAllTitle')
									: t('syncHandbookConfirmTitle')
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
								{bulkActionModal === 'purge'
									? t('purgeKbBody')
									: bulkActionModal === 'reindex'
										? t('reindexAllBody')
										: t('syncHandbookConfirmBody')}
							</p>
							{bulkActionModal === 'sync-handbook' && lastHandbookDryRun ? (
								<p className="break-all font-mono text-[11px] leading-snug text-white/45">
									{t('syncHandbookConfirmLastDryRun', {
										files: lastHandbookDryRun.files,
										dir: lastHandbookDryRun.dir,
									})}
								</p>
							) : null}
							<div className="flex flex-wrap justify-end gap-2">
								<DesktopAppButton
									type="button"
									variant="neutral"
									size="sm"
									disabled={bulkModalPending}
									onClick={onDismiss}
								>
									{t('cancel')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant={bulkActionModal === 'purge' ? 'danger' : 'accent'}
									size="sm"
									disabled={bulkModalPending}
									onClick={() => {
										if (bulkActionModal === 'purge') {
											onConfirmPurge();
										} else if (bulkActionModal === 'reindex') {
											onConfirmReindexAll();
										} else {
											onConfirmSyncHandbook();
										}
									}}
								>
									{bulkModalPending ? (
										<ArrowPathIcon
											className="h-4 w-4 animate-spin"
											aria-hidden
										/>
									) : null}
									{bulkActionModal === 'purge'
										? t('purgeKbConfirm')
										: bulkActionModal === 'reindex'
											? t('reindexAllConfirm')
											: t('syncHandbookConfirmButton')}
								</DesktopAppButton>
							</div>
						</div>
					</DesktopAppModalFrame>
				</div>
			</div>
		</ShellPortalMount>
	);
}
