/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shows operator/user examples for Desktop AI Chat blueprint document scenarios.
 *
 * Invariants:
 * - Examples are guidance for choosing an artifact type, not hidden prompt instructions.
 *
 * Related:
 * - api/routers/desktop_ai_chat.py
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';

import type { EnsembleBlueprintCommandItem } from './api/desktopChatClient';
import { DesktopAiChatIconTooltip } from './components/desktopAiChatIconTooltip';
import { useDesktopAiDialogFocusTrap } from './useDesktopAiDialogFocusTrap';
import {
	DocumentDuplicateIcon,
	QueueListIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export type DesktopEnsembleBlueprintCommandsModalProps = {
	open: boolean;
	onClose: () => void;
	items: EnsembleBlueprintCommandItem[];
	loading: boolean;
	error: string | null;
};

export function DesktopEnsembleBlueprintCommandsModal({
	open,
	onClose,
	items,
	loading,
	error,
}: DesktopEnsembleBlueprintCommandsModalProps) {
	const { t } = useTranslation('desktopAiChat');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const dialogRef = React.useRef<HTMLDivElement>(null);
	useDesktopAiDialogFocusTrap(dialogRef, open);

	React.useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	if (!open) return null;

	const copyLine = (text: string) => {
		const v = text.trim();
		if (!v) return;
		void navigator.clipboard.writeText(v).then(
			() => toast.success(t('ensemblePlanCommandsCopied')),
			() => toast.error(t('ensemblePlanCommandsCopyErr'))
		);
	};

	const contextLabel = (items: string[] | undefined) => {
		if (!Array.isArray(items) || items.length === 0) return '';
		return items
			.map((x) => x.trim())
			.filter(Boolean)
			.join(' · ');
	};

	return (
		<div
			className="fixed inset-0 flex items-center justify-center p-3 sm:p-5"
			style={{ zIndex: embeddedModalZ.backdrop }}
			role="presentation"
		>
			<button
				type="button"
				className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
				aria-label={t('ensemblePlanCommandsClose')}
				onClick={onClose}
			/>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="ensemble-plan-commands-title"
				tabIndex={-1}
				className="relative flex max-h-[min(88dvh,720px)] w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.14)_100%,transparent)] bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_92%,rgb(6,7,12)_8%)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] outline-none"
				style={{ zIndex: embeddedModalZ.content }}
			>
				<header className="flex shrink-0 items-start justify-between gap-3 border-b border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] px-4 py-3 sm:px-5">
					<div className="flex min-w-0 items-start gap-2.5">
						<span
							className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.12)_100%,transparent)] text-[rgb(var(--desktop-accent-rgb)/0.95)]"
							aria-hidden
						>
							<QueueListIcon className="size-[18px]" />
						</span>
						<div className="min-w-0">
							<h2
								id="ensemble-plan-commands-title"
								className="text-sm font-semibold text-(--desktop-text-primary) antialiased"
							>
								{t('ensemblePlanCommandsTitle')}
							</h2>
							<p
								className={cn(
									'mt-1 leading-snug text-(--desktop-text-dim)',
									DESKTOP_TYPOGRAPHY.captionInherit
								)}
							>
								{t('ensemblePlanCommandsIntro')}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className={cn(
							'shrink-0 rounded-lg border border-(--desktop-border-subtle) p-2 text-(--desktop-text-secondary) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)',
							DESKTOP_INTERACTIVE.btnRounded,
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-label={t('ensemblePlanCommandsClose')}
					>
						<XMarkIcon className="size-4" />
					</button>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
					{loading ? (
						<p className="text-sm text-(--desktop-text-dim) antialiased">
							{t('ensemblePlanCommandsLoading')}
						</p>
					) : error ? (
						<p className="text-sm text-amber-200/90 antialiased" role="alert">
							{error}
						</p>
					) : items.length === 0 ? (
						<p className="text-sm text-(--desktop-text-dim) antialiased">
							{t('ensemblePlanCommandsEmpty')}
						</p>
					) : (
						<ul className="space-y-3">
							{items.map((row) => (
								<li
									key={row.id}
									className="rounded-xl border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.2)_100%,transparent)] p-3"
								>
									<div className="flex items-start justify-between gap-2">
										<p className="text-xs font-semibold text-(--desktop-text-primary) antialiased">
											{row.title}
										</p>
										{row.example_command.trim() ? (
											<DesktopAiChatIconTooltip
												content={t('ensemblePlanCommandsCopyTitle')}
											>
												<button
													type="button"
													onClick={() => copyLine(row.example_command)}
													className={cn(
														'shrink-0 inline-flex items-center gap-1 rounded-md border border-[rgb(var(--desktop-accent-rgb)/0.35)] px-2 py-0.5 font-medium text-[rgb(var(--desktop-accent-rgb)/0.95)] hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.12)_100%,transparent)]',
														DESKTOP_TYPOGRAPHY.shellMeta10,
														DESKTOP_INTERACTIVE.btnRounded
													)}
												>
													<DocumentDuplicateIcon
														className="size-3"
														aria-hidden
													/>
													{t('ensemblePlanCommandsCopyShort')}
												</button>
											</DesktopAiChatIconTooltip>
										) : null}
									</div>
									{row.example_command.trim() ? (
										<p className="mt-2 text-xs leading-relaxed text-(--desktop-text-secondary) antialiased">
											{row.example_command.trim()}
										</p>
									) : (
										<p
											className={cn(
												'mt-2 text-(--desktop-text-dim)',
												DESKTOP_TYPOGRAPHY.captionInherit
											)}
										>
											{t('ensemblePlanCommandsNoExample')}
										</p>
									)}
									{row.description?.trim() ? (
										<p className="mt-2 text-xs leading-relaxed text-(--desktop-text-muted) antialiased">
											{row.description.trim()}
										</p>
									) : null}
									{contextLabel(row.required_context) ? (
										<p
											className={cn(
												'mt-2 rounded-md border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] px-2 py-1 text-(--desktop-text-dim)',
												DESKTOP_TYPOGRAPHY.micro
											)}
										>
											{t('ensemblePlanCommandsContextNeeded')}:{' '}
											{contextLabel(row.required_context)}
										</p>
									) : null}
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
