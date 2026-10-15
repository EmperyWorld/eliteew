/**
 * Универсальное подтверждение (закрытие вкладки с потерями, выход из коллаба при смене документа и т.д.).
 */

import { AnimatePresence, motion } from 'framer-motion';
import type { FC } from 'react';
import { useEffect } from 'react';

import {
	DesktopAppButton,
	DesktopAppModalFrame,
} from '../../../pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import type { DocEditorDestructiveConfirmPayload } from '../hooks/useDocEditorDestructiveConfirm';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export interface UltimateDocEditorDestructiveConfirmModalProps {
	open: boolean;
	payload: DocEditorDestructiveConfirmPayload | null;
	embeddedBackdropZ: number;
	embeddedContentZ: number;
	onCancel: () => void;
	onConfirm: () => void;
}

export const UltimateDocEditorDestructiveConfirmModal: FC<
	UltimateDocEditorDestructiveConfirmModalProps
> = ({
	open,
	payload,
	embeddedBackdropZ,
	embeddedContentZ,
	onCancel,
	onConfirm,
}) => {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				onCancel();
			}
		};
		document.addEventListener('keydown', onKey, true);
		return (): void => document.removeEventListener('keydown', onKey, true);
	}, [open, onCancel]);

	if (!payload) {
		return null;
	}

	const variant = payload.variant ?? 'warning';
	const iconSurface =
		variant === 'danger'
			? 'border-red-400/30 bg-red-500/12 text-red-100'
			: 'border-amber-400/35 bg-amber-500/14 text-amber-100';

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
					onClick={onCancel}
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
							onClose={onCancel}
							title={
								<div className="flex min-w-0 items-center gap-3">
									<span
										className={cn(
											'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-(--desktop-shadow-panel)',
											iconSurface
										)}
									>
										<ExclamationTriangleIcon width={18} height={18} />
									</span>
									<span className="truncate">{payload.title}</span>
								</div>
							}
							className="max-w-none"
						>
							<div className="space-y-4 p-4">
								<p className="text-sm text-(--desktop-text-secondary)">
									{payload.message}
								</p>
								<div className="flex items-center justify-end gap-2 pt-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={onCancel}
									>
										{payload.cancelLabel}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant={variant === 'danger' ? 'danger' : 'accent'}
										size="sm"
										onClick={onConfirm}
									>
										{payload.confirmLabel}
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
