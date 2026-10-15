/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Confirm copy of a Content Manager file with editable name (default auto-prefix).
 *
 * Invariants:
 * - Empty trimmed name blocks submit; modal stays open while copy request is in flight.
 *
 * Related:
 * - src/pages/ContentManager/ContentManagerPro.tsx
 * - src/pages/ContentManager/utils/contentManagerCopyName.ts
 */
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { cn } from '../../../utils/cn';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppModalFrame,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { contentManagerDisplayLabel } from '../utils/contentManagerTextLike';
import { buildPrefixedCopyName } from '../utils/contentManagerCopyName';
import {
	ArrowPathIcon,
	DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';

export type ContentManagerCopyModalProps = {
	open: boolean;
	embedded: boolean;
	item: ContentItem | null;
	loading: boolean;
	onClose: () => void;
	onConfirm: (name: string) => void | Promise<void>;
};

export function ContentManagerCopyModal({
	open,
	embedded,
	item,
	loading,
	onClose,
	onConfirm,
}: ContentManagerCopyModalProps): React.ReactElement {
	const { t } = useTranslation('contentManager');
	const [nameDraft, setNameDraft] = React.useState('');
	const [nameError, setNameError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (!open || !item) {
			return;
		}
		const defaultName = buildPrefixedCopyName(
			contentManagerDisplayLabel(item),
			t('pro.copy.prefix')
		);
		setNameDraft(defaultName);
		setNameError(null);
	}, [item, open, t]);

	const requestClose = React.useCallback(() => {
		if (!loading) {
			onClose();
		}
	}, [loading, onClose]);

	const resetToAutoPrefix = React.useCallback(() => {
		if (!item) {
			return;
		}
		setNameDraft(
			buildPrefixedCopyName(
				contentManagerDisplayLabel(item),
				t('pro.copy.prefix')
			)
		);
		setNameError(null);
	}, [item, t]);

	const handleSubmit = React.useCallback(() => {
		const trimmed = nameDraft.trim();
		if (!trimmed) {
			setNameError(t('pro.copy.nameRequired'));
			return;
		}
		setNameError(null);
		void onConfirm(trimmed);
	}, [nameDraft, onConfirm, t]);

	return (
		<AnimatePresence>
			{open && item ? (
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
									<DocumentDuplicateIcon className="h-4 w-4 text-(--desktop-text-muted)" />
									{t('pro.copy.modalTitle')}
								</span>
							}
							onClose={requestClose}
							className="flex flex-col"
						>
							<div className="space-y-4 p-4">
								<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
									{t('pro.copy.modalBody', {
										name: contentManagerDisplayLabel(item),
									})}
								</p>
								<div className="space-y-2">
									<label
										htmlFor="cm-copy-name"
										className={cn(DESKTOP_TYPOGRAPHY.meta, 'block')}
									>
										{t('pro.copy.nameLabel')}
									</label>
									<DesktopAppInput
										id="cm-copy-name"
										value={nameDraft}
										onChange={(e) => {
											setNameDraft(e.target.value);
											if (nameError) {
												setNameError(null);
											}
										}}
										disabled={loading}
										autoFocus
									/>
									{nameError ? (
										<p className="text-xs text-red-300/90">{nameError}</p>
									) : (
										<p className="text-[11px] leading-snug text-(--desktop-text-dim)">
											{t('pro.copy.nameHint')}
										</p>
									)}
								</div>
							</div>
							<div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-4 py-4">
								<DesktopAppButton
									type="button"
									onClick={resetToAutoPrefix}
									variant="ghost"
									size="sm"
									disabled={loading}
								>
									{t('pro.copy.useAutoPrefix')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									onClick={requestClose}
									variant="neutral"
									disabled={loading}
								>
									{t('pro.copy.cancel')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									onClick={handleSubmit}
									variant="accent"
									disabled={loading}
								>
									{loading ? (
										<ArrowPathIcon className="h-4 w-4 animate-spin" />
									) : (
										<DocumentDuplicateIcon className="h-4 w-4" />
									)}
									{t('pro.copy.confirm')}
								</DesktopAppButton>
							</div>
						</DesktopAppModalFrame>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
