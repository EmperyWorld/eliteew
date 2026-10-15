/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Destructive confirmation dialog shared by Content Manager, desktop folders,
 * and other product surfaces. Uses ModalAdvanced desktop chrome by default so
 * the panel stays readable over the shell (not ultra-transparent glass).
 *
 * Invariants:
 * - Default ModalAdvanced variant is `desktop` (shell panel tokens), not `glass`.
 * - Title is owned by ModalAdvanced header (no empty header strip).
 *
 * Related:
 * - ../ModalAdvanced.tsx
 * - pages/ContentManager/components/ContentManagerProModals.tsx
 * - documentation/product/UI-COMPONENTS.md
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
	ExclamationTriangleIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { ModalAdvanced } from '../ModalAdvanced';
import { ButtonV2 } from '../ButtonV2';
import { InputAdvanced } from '../InputAdvanced';

export interface ConfirmDeleteModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => Promise<void> | void;
	title: string;
	itemName?: string;
	itemPreview?: React.ReactNode;
	requireTyping?: boolean;
	confirmText?: string;
	warningMessage?: string;
	isDangerous?: boolean;
	/** Подпись основной кнопки (по умолчанию Delete) */
	confirmButtonLabel?: string;
	/** Текст кнопки в состоянии загрузки */
	confirmButtonLoadingLabel?: string;
	cancelButtonLabel?: string;
	/** Иконка слева на кнопке подтверждения (по умолчанию TrashIcon) */
	confirmIcon?: React.ReactNode;
	/**
	 * Если false — после успешного `onConfirm` не вызывается `onClose` (родитель сам закрывает `isOpen`).
	 * Нужно, когда `onConfirm` размонтирует оболочку или закрывает несколько слоёв.
	 */
	closeAfterConfirm?: boolean;
	/**
	 * ModalAdvanced surface. Default `desktop` — opaque shell panel over `#desktop-main`.
	 * Use `solid` / `default` only for non-desktop hosts without shell tokens.
	 */
	variant?: 'desktop' | 'solid' | 'default' | 'glass' | 'gradient';
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	title,
	itemName,
	itemPreview,
	requireTyping = false,
	confirmText = 'DELETE',
	warningMessage = 'This action cannot be undone.',
	isDangerous: _isDangerous = true,
	confirmButtonLabel = 'Delete',
	confirmButtonLoadingLabel = 'Deleting...',
	cancelButtonLabel = 'Cancel',
	confirmIcon,
	closeAfterConfirm = true,
	variant = 'desktop',
}) => {
	const confirmIconNode = confirmIcon ?? <TrashIcon width={18} height={18} />;
	const [typedText, setTypedText] = useState('');
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const useDesktopChrome = variant === 'desktop';

	useEffect(() => {
		if (!isOpen) {
			setTypedText('');
			setError(null);
			setIsDeleting(false);
		}
	}, [isOpen]);

	const canConfirm = requireTyping ? typedText === confirmText : true;

	const handleConfirm = async (): Promise<void> => {
		if (!canConfirm) {
			return;
		}

		setIsDeleting(true);
		setError(null);

		try {
			await onConfirm();
			if (closeAfterConfirm) {
				onClose();
			}
		} catch (err: unknown) {
			const errorMessage =
				err instanceof Error
					? err.message
					: 'Failed to delete. Please try again.';
			setError(errorMessage);
			setIsDeleting(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent): void => {
		if (e.key === 'Enter' && canConfirm && !isDeleting) {
			void handleConfirm();
		}
	};

	return (
		<ModalAdvanced
			isOpen={isOpen}
			onClose={onClose}
			title={title}
			animation={useDesktopChrome ? 'fade' : 'zoom'}
			size="md"
			variant={variant}
			closeOnOverlay={!isDeleting}
			closeOnEscape={!isDeleting}
		>
			<div className="py-2 sm:py-4">
				<motion.div
					className="mb-6 flex justify-center"
					animate={{
						x: [0, -10, 10, -10, 10, 0],
					}}
					transition={{
						duration: 0.5,
						ease: 'easeInOut' as const,
					}}
				>
					<div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500 bg-red-500/20">
						<ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
					</div>
				</motion.div>

				{itemName ? (
					<div className="mb-4 text-center">
						<span
							className={
								useDesktopChrome
									? 'text-(--desktop-text-secondary)'
									: 'text-white/60'
							}
						>
							You are about to delete:{' '}
						</span>
						<span
							className={
								useDesktopChrome
									? 'font-semibold text-(--desktop-text-primary)'
									: 'font-semibold text-white'
							}
						>
							{itemName}
						</span>
					</div>
				) : null}

				<motion.div
					className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
				>
					<p className="whitespace-pre-line text-center text-sm text-red-300">
						{warningMessage}
					</p>
				</motion.div>

				{itemPreview ? (
					<motion.div
						className={
							useDesktopChrome
								? 'mb-6 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4'
								: 'mb-6 rounded-lg border border-white/10 bg-black/40 p-4'
						}
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ delay: 0.3 }}
					>
						{itemPreview}
					</motion.div>
				) : null}

				{requireTyping ? (
					<motion.div
						className="mb-6"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4 }}
					>
						<p
							className={
								useDesktopChrome
									? 'mb-3 text-center text-sm text-(--desktop-text-secondary)'
									: 'mb-3 text-center text-sm text-white/60'
							}
						>
							Type{' '}
							<span className="font-mono font-bold text-red-400">
								{confirmText}
							</span>{' '}
							to confirm
						</p>
						<InputAdvanced
							value={typedText}
							onChange={(e) => setTypedText(e.target.value.toUpperCase())}
							onKeyDown={handleKeyDown}
							placeholder={confirmText}
							error={
								typedText && typedText !== confirmText
									? `Must type "${confirmText}" exactly`
									: undefined
							}
							fullWidth={true}
							size="lg"
							className="text-center font-mono"
							autoFocus
						/>
					</motion.div>
				) : null}

				<AnimatePresence>
					{error ? (
						<motion.div
							className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
						>
							<p className="text-center text-sm text-red-300">{error}</p>
						</motion.div>
					) : null}
				</AnimatePresence>

				<div className="flex items-center justify-center gap-3">
					<ButtonV2
						variant="ghost"
						size="lg"
						onClick={onClose}
						disabled={isDeleting}
						className="min-w-[120px]"
					>
						{cancelButtonLabel}
					</ButtonV2>

					<ButtonV2
						variant="danger"
						size="lg"
						onClick={() => {
							void handleConfirm();
						}}
						loading={isDeleting}
						disabled={!canConfirm || isDeleting}
						iconLeft={confirmIconNode}
						className="min-w-[120px]"
					>
						{isDeleting ? confirmButtonLoadingLabel : confirmButtonLabel}
					</ButtonV2>
				</div>

				<p
					className={
						useDesktopChrome
							? 'mt-4 text-center text-xs text-(--desktop-text-dim)'
							: 'mt-4 text-center text-xs text-white/40'
					}
				>
					Press Esc to cancel {canConfirm ? '• Enter to confirm' : ''}
				</p>
			</div>
		</ModalAdvanced>
	);
};

export default ConfirmDeleteModal;
