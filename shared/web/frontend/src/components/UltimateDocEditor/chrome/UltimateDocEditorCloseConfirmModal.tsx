import { AnimatePresence, motion } from 'framer-motion';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import {
	DesktopAppButton,
	DesktopAppModalFrame,
	DesktopAppPanel,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export interface UltimateDocEditorCloseConfirmModalProps {
	open: boolean;
	isCloseConfirmSaving: boolean;
	documentTitle?: string | null;
	embeddedBackdropZ: number;
	embeddedContentZ: number;
	onBackdropDismiss: () => void;
	onFrameDismiss: () => void;
	onStay: () => void;
	onSaveAndClose: () => void;
	onCloseWithoutSaving: () => void;
}

export const UltimateDocEditorCloseConfirmModal: FC<
	UltimateDocEditorCloseConfirmModalProps
> = ({
	open,
	isCloseConfirmSaving,
	documentTitle,
	embeddedBackdropZ,
	embeddedContentZ,
	onBackdropDismiss,
	onFrameDismiss,
	onStay,
	onSaveAndClose,
	onCloseWithoutSaving,
}) => {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	return (
		<AnimatePresence>
			{open ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={cn(
						'fixed inset-0 flex items-center justify-center p-4',
						DESKTOP_OVERLAY.backdrop
					)}
					style={{ zIndex: embeddedBackdropZ }}
					onClick={() => {
						if (!isCloseConfirmSaving) {
							onBackdropDismiss();
						}
					}}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 16 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 16 }}
						transition={{ duration: 0.18 }}
						className="w-full max-w-md"
						style={{ zIndex: embeddedContentZ }}
						onClick={(event) => event.stopPropagation()}
					>
						<DesktopAppModalFrame
							onClose={() => {
								if (!isCloseConfirmSaving) {
									onFrameDismiss();
								}
							}}
							title={
								<div className="flex min-w-0 items-center gap-3">
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/12 text-red-100 shadow-(--desktop-shadow-panel)">
										<ExclamationCircleIcon width={18} height={18} />
									</span>
									<span className="truncate">
										{t('editorCloseConfirm.title')}
									</span>
								</div>
							}
							className="max-w-none"
						>
							<div className="space-y-4 p-4">
								<p className="text-sm text-(--desktop-text-secondary)">
									{t('editorCloseConfirm.body')}
								</p>
								{documentTitle ? (
									<DesktopAppPanel className="px-3 py-2 text-sm">
										<span className="text-(--desktop-text-muted)">
											{t('editorCloseConfirm.documentLabel')}
										</span>{' '}
										<strong className="text-(--desktop-text-primary)">
											{documentTitle}
										</strong>
									</DesktopAppPanel>
								) : null}
								<div className="flex items-center justify-end gap-2 pt-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										disabled={isCloseConfirmSaving}
										onClick={onStay}
									>
										{t('editorCloseConfirm.stay')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="accent"
										size="sm"
										disabled={isCloseConfirmSaving}
										onClick={onSaveAndClose}
									>
										{isCloseConfirmSaving ? (
											<>
												<ArrowPathIcon className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
												{t('editorCloseConfirm.saving')}
											</>
										) : (
											t('editorCloseConfirm.saveAndClose')
										)}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="danger"
										size="sm"
										disabled={isCloseConfirmSaving}
										onClick={onCloseWithoutSaving}
									>
										{t('editorCloseConfirm.closeWithoutSaving')}
									</DesktopAppButton>
								</div>
							</div>
						</DesktopAppModalFrame>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
};
