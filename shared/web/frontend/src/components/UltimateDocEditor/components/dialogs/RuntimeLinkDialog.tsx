import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppModalFrame,
	DesktopAppPanel,
	DesktopAppSectionLabel,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_OVERLAY } from '../../../../pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../../../../pages/Desktop/context/DesktopWindowPortalStackContext';
import { useRuntimeDialogFocusTrap } from '../../hooks/useRuntimeDialogFocusTrap';
import { cn } from '@/utils/cn';
import {
	ArrowTopRightOnSquareIcon,
	LinkIcon,
} from '@heroicons/react/24/outline';

interface RuntimeLinkDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (url: string, text: string) => void;
	initialUrl?: string;
	initialText?: string;
	selectedText?: string;
}

export const RuntimeLinkDialog: React.FC<RuntimeLinkDialogProps> = ({
	isOpen,
	onClose,
	onSubmit,
	initialUrl = '',
	initialText = '',
	selectedText = '',
}) => {
	const { t } = useTranslation('ultimateDocEditor');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const dialogTitleId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const [url, setUrl] = useState(initialUrl);
	const [text, setText] = useState(initialText || selectedText);
	const [error, setError] = useState<string | null>(null);

	useRuntimeDialogFocusTrap(isOpen, panelRef);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setUrl(initialUrl);
		setText(initialText || selectedText);
		setError(null);
	}, [initialText, initialUrl, isOpen, selectedText]);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleEscape = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('keydown', handleEscape, true);
		return (): void => {
			document.removeEventListener('keydown', handleEscape, true);
		};
	}, [isOpen, onClose]);

	const normalizeUrl = (value: string): string | null => {
		const trimmedValue = value.trim();
		if (!trimmedValue) {
			setError(t('linkDialog.errors.urlEmpty'));
			return null;
		}

		const withProtocol =
			trimmedValue.startsWith('http://') ||
			trimmedValue.startsWith('https://') ||
			trimmedValue.startsWith('mailto:') ||
			trimmedValue.startsWith('tel:')
				? trimmedValue
				: `https://${trimmedValue}`;

		try {
			const parsed = new URL(withProtocol);
			if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
				setError(t('linkDialog.errors.urlProtocols'));
				return null;
			}
			return withProtocol;
		} catch {
			setError(t('linkDialog.errors.urlInvalid'));
			return null;
		}
	};

	const handleSubmit = (event: React.FormEvent): void => {
		event.preventDefault();
		setError(null);

		const normalizedUrl = normalizeUrl(url);
		if (!normalizedUrl) {
			return;
		}

		onSubmit(normalizedUrl, text.trim() || selectedText || normalizedUrl);
	};

	const previewHref = (() => {
		const trimmedValue = url.trim();
		if (!trimmedValue) {
			return null;
		}

		const withProtocol =
			trimmedValue.startsWith('http://') ||
			trimmedValue.startsWith('https://') ||
			trimmedValue.startsWith('mailto:') ||
			trimmedValue.startsWith('tel:')
				? trimmedValue
				: `https://${trimmedValue}`;

		try {
			const parsed = new URL(withProtocol);
			return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)
				? withProtocol
				: null;
		} catch {
			return null;
		}
	})();

	return (
		<AnimatePresence>
			{isOpen ? (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={cn(
						'fixed inset-0 flex items-center justify-center p-4',
						DESKTOP_OVERLAY.backdrop
					)}
					style={{ zIndex: embeddedModalZ.backdrop }}
					onClick={onClose}
				>
					<motion.div
						ref={panelRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby={dialogTitleId}
						initial={{ opacity: 0, scale: 0.96, y: 16 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 16 }}
						transition={{ duration: 0.18 }}
						className="w-full max-w-md"
						style={{ zIndex: embeddedModalZ.content }}
						onClick={(event) => event.stopPropagation()}
					>
						<DesktopAppModalFrame
							onClose={onClose}
							title={
								<div
									id={dialogTitleId}
									className="flex min-w-0 items-center gap-3"
								>
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/30 bg-(--desktop-surface-accent) text-white shadow-(--desktop-shadow-panel)">
										<LinkIcon width={18} height={18} />
									</span>
									<span className="truncate">{t('linkDialog.title')}</span>
								</div>
							}
							className="max-w-none border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) text-(--desktop-text-primary) shadow-(--desktop-shadow-panel)"
						>
							<form className="space-y-4 p-4" onSubmit={handleSubmit}>
								<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
									{t('linkDialog.description')}
								</p>
								<div className="space-y-2">
									<DesktopAppSectionLabel>
										{t('linkDialog.urlLabel')}
									</DesktopAppSectionLabel>
									<DesktopAppInput
										type="url"
										value={url}
										onChange={(event) => {
											setUrl(event.target.value);
											setError(null);
										}}
										placeholder={t('linkDialog.urlPlaceholder')}
										autoFocus
									/>
								</div>
								<div className="space-y-2">
									<DesktopAppSectionLabel>
										{t('linkDialog.textLabel')}
									</DesktopAppSectionLabel>
									<DesktopAppInput
										type="text"
										value={text}
										onChange={(event) => setText(event.target.value)}
										placeholder={
											selectedText || t('linkDialog.textPlaceholder')
										}
									/>
								</div>
								{error ? (
									<DesktopAppPanel
										role="alert"
										className="border-[color-mix(in_oklab,var(--desktop-border-subtle),#f87171_35%)] bg-[color-mix(in_oklab,var(--desktop-surface-soft),#7f1d1d_22%)] px-3 py-2 text-sm text-(--desktop-text-primary)"
									>
										{error}
									</DesktopAppPanel>
								) : null}
								{previewHref && !error ? (
									<DesktopAppPanel className="space-y-2 border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-3">
										<div className="flex items-center gap-2 text-sm text-(--desktop-text-muted)">
											<ArrowTopRightOnSquareIcon width={14} height={14} />
											<span>{t('linkDialog.previewLabel')}</span>
										</div>
										<a
											href={previewHref}
											target="_blank"
											rel="noopener noreferrer"
											className="break-all text-sm text-[rgb(var(--desktop-accent-rgb))] underline underline-offset-2"
										>
											{text.trim() || selectedText || url.trim()}
										</a>
									</DesktopAppPanel>
								) : null}
								<div className="flex items-center justify-end gap-2 pt-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={onClose}
									>
										{t('linkDialog.cancel')}
									</DesktopAppButton>
									<DesktopAppButton
										type="submit"
										variant="accent"
										size="sm"
										className="px-5"
									>
										{t('linkDialog.submit')}
									</DesktopAppButton>
								</div>
							</form>
						</DesktopAppModalFrame>
					</motion.div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
};
