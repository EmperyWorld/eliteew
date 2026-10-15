/**
 * Confirm before downloading ZIP of all owned files (heavy download).
 */
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import {
	DesktopAppButton,
	DesktopAppModalFrame,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { ArrowPathIcon, CubeIcon } from '@heroicons/react/24/outline';

export type ContentManagerOwnedArchiveModalProps = {
	open: boolean;
	embedded: boolean;
	loading: boolean;
	ownedFilesCount: number;
	onClose: () => void;
	onConfirm: () => void | Promise<void>;
};

export function ContentManagerOwnedArchiveModal({
	open,
	embedded,
	loading,
	ownedFilesCount,
	onClose,
	onConfirm,
}: ContentManagerOwnedArchiveModalProps): React.ReactElement {
	const { t } = useTranslation('contentManager');

	const requestClose = React.useCallback(() => {
		if (!loading) onClose();
	}, [loading, onClose]);

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={
						embedded
							? 'absolute inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm'
							: 'fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm'
					}
					onClick={requestClose}
				>
					<motion.div
						initial={{ scale: 0.95 }}
						animate={{ scale: 1 }}
						exit={{ scale: 0.95 }}
						className="w-full max-w-md"
						onClick={(e) => e.stopPropagation()}
					>
						<DesktopAppModalFrame
							title={
								<span className="flex items-center gap-2">
									<CubeIcon className="h-4 w-4 text-(--desktop-text-muted)" />
									{t('files.archiveModal.title')}
								</span>
							}
							onClose={requestClose}
							className="flex flex-col"
						>
							<div className="space-y-4 p-4">
								<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
									{t('files.archiveModal.body', { count: ownedFilesCount })}
								</p>
							</div>
							<div className="flex shrink-0 justify-end gap-2 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-4 py-4">
								<DesktopAppButton
									type="button"
									onClick={requestClose}
									variant="neutral"
									disabled={loading}
								>
									{t('files.archiveModal.cancel')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									onClick={() => void onConfirm()}
									variant="accent"
									disabled={loading || ownedFilesCount === 0}
								>
									{loading ? (
										<ArrowPathIcon className="h-4 w-4 animate-spin" />
									) : (
										<CubeIcon className="h-4 w-4" />
									)}
									{t('files.archiveModal.confirm')}
								</DesktopAppButton>
							</div>
						</DesktopAppModalFrame>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
