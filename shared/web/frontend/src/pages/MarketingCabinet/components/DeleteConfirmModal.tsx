import {
	ExclamationTriangleIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';

import { cn } from '@/utils/cn';
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '../../Desktop/components/DesktopAppChrome';
import { useEmbeddedPortaledModalZIndex } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { useMarketingDialogFocusTrap } from '../hooks/useMarketingDialogFocusTrap';

interface DeleteConfirmModalProps {
	isOpen: boolean;
	title: string;
	message: string;
	/** Optional body (e.g. radio group) rendered after the main message */
	extra?: React.ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	/** Подпись на кнопке подтверждения в состоянии загрузки */
	pendingLabel?: string;
	/** Текст подсказки про Escape (i18n с родительского компонента) */
	hint?: string;
	confirmVariant?: 'danger' | 'accent';
	/** `warning` — красная иконка удаления; `sparkles` — нейтральная акцентная (подтверждение действия, не удаление). */
	tone?: 'warning' | 'sparkles';
	onConfirm: () => void;
	onCancel: () => void;
	isLoading?: boolean;
}

export function DeleteConfirmModal({
	isOpen,
	title,
	message,
	extra,
	confirmLabel = 'Удалить',
	cancelLabel = 'Отмена',
	pendingLabel = 'Удаление…',
	hint,
	confirmVariant = 'danger',
	tone = 'warning',
	onConfirm,
	onCancel,
	isLoading = false,
}: DeleteConfirmModalProps) {
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const modalRef = useRef<HTMLDivElement>(null);
	useMarketingDialogFocusTrap(modalRef, isOpen);

	useEffect(() => {
		if (isOpen && modalRef.current) {
			const cancelBtn =
				modalRef.current.querySelector<HTMLButtonElement>('[data-cancel]');
			cancelBtn?.focus();
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const hasDescription = message.trim().length > 0;
	const describedBy = [
		hasDescription ? 'delete-modal-description' : null,
		'delete-modal-hint',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div
			className={cn(DESKTOP_APP_STYLE_CONTRACT.modalBackdrop, 'p-4')}
			style={{ zIndex: embeddedModalZ.backdrop }}
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="delete-modal-title"
			aria-describedby={describedBy}
			onClick={(e) => {
				if (e.target === e.currentTarget) onCancel();
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onCancel();
			}}
		>
			<div
				ref={modalRef}
				className="w-full max-w-md rounded-(--desktop-radius-lg) border border-(--desktop-border-strong) bg-(--desktop-surface-panel-strong) p-6 shadow-(--desktop-shadow-panel)"
				style={{ zIndex: embeddedModalZ.content }}
			>
				<div className="flex gap-4">
					<div
						className={cn(
							'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border',
							tone === 'sparkles'
								? 'border-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_38%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_12%,var(--desktop-surface-soft))]'
								: 'border-[color-mix(in_srgb,rgb(239_68_68)_42%,var(--desktop-border-subtle))] bg-[color-mix(in_srgb,rgb(239_68_68)_14%,var(--desktop-surface-soft))]'
						)}
						aria-hidden
					>
						{tone === 'sparkles' ? (
							<SparklesIcon
								className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb))]"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						) : (
							<ExclamationTriangleIcon
								className="h-5 w-5 text-[color-mix(in_srgb,rgb(248_113_113)_88%,var(--desktop-text-primary))]"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						)}
					</div>
					<div className="flex-1 space-y-2 pt-0.5">
						<h3
							id="delete-modal-title"
							className="text-base font-semibold leading-snug tracking-tight text-(--desktop-text-primary)"
						>
							{title}
						</h3>
						{hasDescription ? (
							<p
								id="delete-modal-description"
								className="text-sm leading-relaxed text-(--desktop-text-secondary)"
							>
								{message}
							</p>
						) : null}
						{extra ? (
							<div className="text-sm text-(--desktop-text-secondary)">
								{extra}
							</div>
						) : null}
						<p
							id="delete-modal-hint"
							className={cn(DESKTOP_APP_STYLE_CONTRACT.helperText, 'leading-4')}
						>
							{hint ??
								`Чтобы отменить без изменений, нажмите «${cancelLabel}» или Escape.`}
						</p>
					</div>
				</div>
				<div className="mt-6 flex justify-end gap-3 border-t border-(--desktop-border-subtle) pt-5">
					<DesktopAppButton
						data-cancel
						type="button"
						variant="neutral"
						onClick={onCancel}
						disabled={isLoading}
					>
						{cancelLabel}
					</DesktopAppButton>
					<DesktopAppButton
						data-confirm
						type="button"
						variant={confirmVariant}
						onClick={onConfirm}
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<span className="inline-block h-3.5 w-3.5 motion-safe:animate-spin motion-reduce:animate-none rounded-full border-2 border-current border-t-transparent" />
								<span className="ml-2">{pendingLabel}</span>
							</>
						) : (
							confirmLabel
						)}
					</DesktopAppButton>
				</div>
			</div>
		</div>
	);
}
