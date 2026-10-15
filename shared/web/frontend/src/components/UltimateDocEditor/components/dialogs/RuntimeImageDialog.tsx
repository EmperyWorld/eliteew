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
import { ArrowUpTrayIcon, PhotoIcon } from '@heroicons/react/24/outline';

interface RuntimeImageDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (url: string, alt: string) => void;
	initialUrl?: string;
	initialAlt?: string;
	onUpload?: (file: File) => Promise<string>;
}

export const RuntimeImageDialog: React.FC<RuntimeImageDialogProps> = ({
	isOpen,
	onClose,
	onSubmit,
	initialUrl = '',
	initialAlt = '',
	onUpload,
}) => {
	const { t } = useTranslation('ultimateDocEditor');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const dialogTitleId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const [url, setUrl] = useState(initialUrl);
	const [alt, setAlt] = useState(initialAlt);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useRuntimeDialogFocusTrap(isOpen, panelRef);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setUrl(initialUrl);
		setAlt(initialAlt);
		setPreviewUrl(initialUrl || null);
		setError(null);
		setIsUploading(false);
	}, [initialAlt, initialUrl, isOpen]);

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

	useEffect(() => {
		if (!url.trim()) {
			setPreviewUrl(null);
			return;
		}

		const image = new Image();
		image.onload = () => {
			setPreviewUrl(url.trim());
			setError(null);
		};
		image.onerror = () => {
			setPreviewUrl(null);
		};
		image.src = url.trim();
	}, [url]);

	const normalizeUrl = (value: string): string | null => {
		const trimmedValue = value.trim();
		if (!trimmedValue) {
			setError(t('imageDialog.errors.urlEmpty'));
			return null;
		}

		const withProtocol =
			trimmedValue.startsWith('http://') ||
			trimmedValue.startsWith('https://') ||
			trimmedValue.startsWith('data:')
				? trimmedValue
				: `https://${trimmedValue}`;

		try {
			const parsed = new URL(withProtocol);
			if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
				setError(t('imageDialog.errors.protocols'));
				return null;
			}
			return withProtocol;
		} catch {
			setError(t('imageDialog.errors.urlInvalid'));
			return null;
		}
	};

	const handleFileSelect = async (
		event: React.ChangeEvent<HTMLInputElement>
	): Promise<void> => {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		if (!file.type.startsWith('image/')) {
			setError(t('imageDialog.errors.fileType'));
			return;
		}

		if (file.size > 10 * 1024 * 1024) {
			setError(t('imageDialog.errors.fileSize'));
			return;
		}

		if (onUpload) {
			setIsUploading(true);
			setError(null);
			try {
				const uploadedUrl = await onUpload(file);
				setUrl(uploadedUrl);
				setAlt((currentAlt) => currentAlt || file.name);
			} catch (uploadError) {
				setError(
					uploadError instanceof Error
						? uploadError.message
						: t('imageDialog.errors.uploadFailed')
				);
			} finally {
				setIsUploading(false);
			}
			return;
		}

		const reader = new FileReader();
		reader.onload = (loadEvent) => {
			const result = loadEvent.target?.result;
			if (typeof result === 'string') {
				setUrl(result);
				setAlt((currentAlt) => currentAlt || file.name);
				setPreviewUrl(result);
				setError(null);
			}
		};
		reader.onerror = () => {
			setError(t('imageDialog.errors.readFailed'));
		};
		reader.readAsDataURL(file);
	};

	const handleSubmit = (event: React.FormEvent): void => {
		event.preventDefault();
		setError(null);

		const normalizedUrl = normalizeUrl(url);
		if (!normalizedUrl) {
			return;
		}

		onSubmit(normalizedUrl, alt.trim() || t('imageDialog.defaultAlt'));
	};

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
						className="w-full max-w-xl"
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
										<PhotoIcon width={18} height={18} />
									</span>
									<span className="truncate">{t('imageDialog.title')}</span>
								</div>
							}
							className="max-w-none border-(--desktop-border-subtle) bg-(--desktop-surface-elevated) text-(--desktop-text-primary) shadow-(--desktop-shadow-panel)"
						>
							<form className="space-y-4 p-4" onSubmit={handleSubmit}>
								<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
									{t('imageDialog.description')}
								</p>
								<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
									<div className="space-y-4">
										<div className="space-y-2">
											<DesktopAppSectionLabel>
												{t('imageDialog.urlLabel')}
											</DesktopAppSectionLabel>
											<DesktopAppInput
												type="url"
												value={url}
												onChange={(event) => {
													setUrl(event.target.value);
													setError(null);
												}}
												placeholder={t('imageDialog.urlPlaceholder')}
												autoFocus
												disabled={isUploading}
											/>
										</div>
										<div className="space-y-2">
											<DesktopAppSectionLabel>
												{t('imageDialog.altLabel')}
											</DesktopAppSectionLabel>
											<DesktopAppInput
												type="text"
												value={alt}
												onChange={(event) => setAlt(event.target.value)}
												placeholder={t('imageDialog.altPlaceholder')}
												disabled={isUploading}
											/>
										</div>
										<div className="space-y-2">
											<DesktopAppSectionLabel>
												{t('imageDialog.uploadLabel')}
											</DesktopAppSectionLabel>
											<input
												ref={fileInputRef}
												type="file"
												accept="image/*"
												className="hidden"
												onChange={(event) => {
													void handleFileSelect(event);
												}}
											/>
											<DesktopAppButton
												type="button"
												variant="neutral"
												size="sm"
												onClick={() => fileInputRef.current?.click()}
												disabled={isUploading}
												className="w-full justify-center"
											>
												<ArrowUpTrayIcon width={16} height={16} />
												{isUploading
													? t('imageDialog.uploading')
													: t('imageDialog.uploadPick')}
											</DesktopAppButton>
										</div>
										{error ? (
											<DesktopAppPanel
												role="alert"
												className="border-[color-mix(in_oklab,var(--desktop-border-subtle),#f87171_35%)] bg-[color-mix(in_oklab,var(--desktop-surface-soft),#7f1d1d_22%)] px-3 py-2 text-sm text-(--desktop-text-primary)"
											>
												{error}
											</DesktopAppPanel>
										) : null}
									</div>
									<DesktopAppPanel className="flex min-h-[220px] items-center justify-center overflow-hidden border-(--desktop-border-subtle) bg-(--desktop-surface-app) p-3">
										{previewUrl ? (
											<img
												src={previewUrl}
												alt={alt || t('imageDialog.previewAlt')}
												className="max-h-[200px] max-w-full rounded-lg object-contain"
											/>
										) : (
											<div className="text-center text-sm text-(--desktop-text-muted)">
												{t('imageDialog.previewHint')}
											</div>
										)}
									</DesktopAppPanel>
								</div>
								<div className="flex items-center justify-end gap-2 pt-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={onClose}
									>
										{t('imageDialog.cancel')}
									</DesktopAppButton>
									<DesktopAppButton
										type="submit"
										variant="accent"
										size="sm"
										className="px-5"
										disabled={isUploading}
									>
										{t('imageDialog.submit')}
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
