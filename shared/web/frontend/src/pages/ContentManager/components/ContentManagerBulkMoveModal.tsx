/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bulk move modal: pick target folder for selected Content Manager files.
 *
 * Invariants:
 * - Move payload is built via buildContentMoveScopePatch (caller supplies projects in onMove).
 * - Apply stays disabled until a folder target is chosen and loading is false.
 *
 * Related:
 * - `utils/contentManagerFolderScopePatch.ts`
 * - `ContentManagerPro.tsx`
 */

import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, FolderIcon } from '@heroicons/react/24/outline';
import { cn } from '../../../utils/cn';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppModalFrame,
	DesktopNativeSelect,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { resolveDesktopFolderDisplayName } from '../../Desktop/utils/desktopSystemFolderLabels';
import type { ContentManagerEditFolderOption } from './ContentManagerEditModal';

export type ContentManagerBulkMoveModalProps = {
	open: boolean;
	embedded?: boolean;
	folders: ContentManagerEditFolderOption[];
	selectedIds: readonly string[];
	onMove: (targetFolderItemId: string | null) => void | Promise<void>;
	onClose: () => void;
	loading: boolean;
};

export function ContentManagerBulkMoveModal({
	open,
	embedded = false,
	folders,
	selectedIds,
	onMove,
	onClose,
	loading,
}: ContentManagerBulkMoveModalProps): React.ReactElement {
	const { t } = useTranslation('contentManager');
	const { t: tDesktopUi } = useTranslation('desktopUi');
	const [targetFolderId, setTargetFolderId] = React.useState<string>('');

	React.useEffect(() => {
		if (open) {
			setTargetFolderId('');
		}
	}, [open]);

	const requestClose = React.useCallback(() => {
		if (!loading) onClose();
	}, [loading, onClose]);

	const handleApply = React.useCallback(() => {
		const target =
			targetFolderId === '__unfiled__' ? null : targetFolderId || null;
		void onMove(target);
	}, [onMove, targetFolderId]);

	const canApply =
		Boolean(targetFolderId) && !loading && selectedIds.length > 0;

	return (
		<AnimatePresence>
			{open ? (
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
									<FolderIcon className="h-4 w-4 text-(--desktop-text-muted)" />
									{t('pro.bulkMove.title')}
								</span>
							}
							onClose={requestClose}
						>
							<div className="space-y-4 p-4">
								<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
									{t('pro.bulkMove.description', {
										count: selectedIds.length,
									})}
								</p>
								<label htmlFor="cm-bulk-move-folder" className="block">
									<span className={DESKTOP_TYPOGRAPHY.caption}>
										{t('pro.bulkMove.targetFolder')}
									</span>
									<DesktopNativeSelect
										id="cm-bulk-move-folder"
										value={targetFolderId}
										onChange={(e) => setTargetFolderId(e.target.value)}
										disabled={loading}
										className="mt-1 w-full"
									>
										<option
											value=""
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('pro.bulkMove.pickFolder')}
										</option>
										<option
											value="__unfiled__"
											className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
										>
											{t('pro.bulkMove.unfiled')}
										</option>
										{folders.map((folder) => (
											<option
												key={folder.item_id}
												value={folder.item_id}
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{resolveDesktopFolderDisplayName(folder, tDesktopUi)}
											</option>
										))}
									</DesktopNativeSelect>
								</label>
								<div className="flex justify-end gap-2">
									<DesktopAppButton
										variant="ghost"
										onClick={requestClose}
										disabled={loading}
									>
										{t('pro.bulkMove.cancel')}
									</DesktopAppButton>
									<DesktopAppButton
										variant="accent"
										onClick={handleApply}
										disabled={!canApply}
									>
										{loading ? (
											<span className="inline-flex items-center gap-1">
												<ArrowPathIcon className="h-4 w-4 animate-spin" />
												{t('pro.bulkMove.moving')}
											</span>
										) : (
											t('pro.bulkMove.apply')
										)}
									</DesktopAppButton>
								</div>
							</div>
						</DesktopAppModalFrame>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
