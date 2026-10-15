/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Own-account avatar upload, delete, history, and crop flow.
 *
 * Invariants:
 * - Does not edit name/bio (ProfileIdentityPanel) or privacy.
 *
 * Related:
 * - ProfileIdentityPanel.tsx
 * - AvatarCropModal.tsx
 */

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
	AvatarHistoryItem,
	UserProfileResponse,
} from '../../types/profile';
import { formatDate, formatFileSize } from '../../types/profile';
import profileService from '../../services/profileService';
import AvatarCropModal from './AvatarCropModal';
import { SecureAvatar } from './SecureAvatar';
import { profileApiErrorMessage } from './profileApiErrorMessage';
import { Portal } from '../ui/Portal';
import { DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { log } from '../../utils/logger';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppModalFrame,
	DesktopAppPanel,
} from '../../pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../pages/Desktop/context/DesktopShellFrameContext';
import { getDesktopShellContentPanelClassName } from '../../pages/Desktop/utils/desktopVisualSystem';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import {
	ArrowPathIcon,
	ArrowUpTrayIcon,
	ClockIcon,
	ExclamationCircleIcon,
	PhotoIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export default function ProfileAvatarPanel({
	profile,
	onProfileUpdate,
	embedded = false,
}: {
	profile: UserProfileResponse;
	onProfileUpdate: (profile: UserProfileResponse) => void;
	embedded?: boolean;
}): JSX.Element {
	const shellFrame = useDesktopShellFrame();
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();
	const shellPanel = embedded
		? getDesktopShellContentPanelClassName(shellFrame)
		: '';

	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
	const [showAvatarHistory, setShowAvatarHistory] = useState(false);
	const [avatarHistory, setAvatarHistory] = useState<AvatarHistoryItem[]>([]);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	const [showCropModal, setShowCropModal] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dropZoneRef = useRef<HTMLDivElement>(null);

	const handleAvatarFileSelect = (file: File): void => {
		const validationError = profileService.validateAvatarFile(file);
		if (validationError) {
			setError(validationError);
			return;
		}
		setAvatarFile(file);
		setShowCropModal(true);
		setError(null);
	};

	const handleCropComplete = (blob: Blob): void => {
		setCroppedBlob(blob);
		setAvatarPreview(URL.createObjectURL(blob));
		setShowCropModal(false);
	};

	const handleCropCancel = (): void => {
		setShowCropModal(false);
		setAvatarFile(null);
		setError(null);
	};

	const handleFileInputChange = (
		e: React.ChangeEvent<HTMLInputElement>
	): void => {
		const file = e.target.files?.[0];
		if (file) {
			handleAvatarFileSelect(file);
		}
	};

	const handleDragEnter = (e: React.DragEvent): void => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent): void => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDragOver = (e: React.DragEvent): void => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDrop = (e: React.DragEvent): void => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
		const file = e.dataTransfer.files?.[0];
		if (file) {
			handleAvatarFileSelect(file);
		}
	};

	const handleUploadAvatar = async (): Promise<void> => {
		if (!croppedBlob) {
			return;
		}
		setIsUploadingAvatar(true);
		setError(null);
		try {
			const croppedFile = new File(
				[croppedBlob],
				avatarFile?.name || 'avatar.jpg',
				{ type: 'image/jpeg' }
			);
			await profileService.uploadAvatar(croppedFile);
			const updatedProfile = await profileService.getProfile();
			onProfileUpdate(updatedProfile);
			setAvatarFile(null);
			setCroppedBlob(null);
			if (avatarPreview) {
				URL.revokeObjectURL(avatarPreview);
				setAvatarPreview(null);
			}
		} catch (err: unknown) {
			log.error(
				'ProfileAvatarPanel',
				'Failed to upload avatar',
				err instanceof Error ? err : undefined,
				err
			);
			setError(profileApiErrorMessage(err, 'Не удалось загрузить аватар'));
		} finally {
			setIsUploadingAvatar(false);
		}
	};

	const handleCancelAvatarUpload = (): void => {
		if (avatarPreview) {
			URL.revokeObjectURL(avatarPreview);
			setAvatarPreview(null);
		}
		setAvatarFile(null);
		setCroppedBlob(null);
		setError(null);
	};

	const handleDeleteAvatar = async (): Promise<void> => {
		setIsDeletingAvatar(true);
		setError(null);
		try {
			await profileService.deleteAvatar();
			const updatedProfile = await profileService.getProfile();
			onProfileUpdate(updatedProfile);
		} catch (err: unknown) {
			log.error(
				'ProfileAvatarPanel',
				'Failed to delete avatar',
				err instanceof Error ? err : undefined,
				err
			);
			setError(profileApiErrorMessage(err, 'Не удалось удалить аватар'));
		} finally {
			setIsDeletingAvatar(false);
		}
	};

	const handleLoadAvatarHistory = async (): Promise<void> => {
		setShowAvatarHistory(true);
		setIsLoadingHistory(true);
		try {
			setAvatarHistory(await profileService.getAvatarHistory());
		} catch (err: unknown) {
			log.error(
				'ProfileAvatarPanel',
				'Failed to load avatar history',
				err instanceof Error ? err : undefined,
				err
			);
			setError('Не удалось загрузить историю аватаров');
		} finally {
			setIsLoadingHistory(false);
		}
	};

	useEffect(() => {
		return () => {
			if (avatarPreview) {
				URL.revokeObjectURL(avatarPreview);
			}
		};
	}, [avatarPreview]);

	return (
		<div className="space-y-4">
			<AnimatePresence>
				{error ? (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="flex items-center gap-3 rounded-xl border border-rose-500/35 bg-rose-500/[0.07] p-4"
					>
						<ExclamationCircleIcon
							className="h-5 w-5 shrink-0 text-rose-400/90"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						<p className="flex-1 text-sm text-rose-200/90">{error}</p>
						<DesktopAppButton
							type="button"
							onClick={() => setError(null)}
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-rose-400/90 hover:bg-rose-500/10 hover:text-rose-200"
						>
							<XMarkIcon
								className={DESKTOP_LUCIDE.lg}
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					</motion.div>
				) : null}
			</AnimatePresence>

			<DesktopAppPanel className={cn(shellPanel, 'p-6')}>
				<div className="mb-6 flex items-center gap-3">
					<span className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
						<PhotoIcon
							className={DESKTOP_LUCIDE.lg}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</span>
					<h2 className="text-lg font-semibold tracking-tight text-(--desktop-text-primary)">
						Аватар
					</h2>
				</div>

				<div className="flex flex-col gap-6 lg:flex-row">
					<div className="flex flex-col items-center gap-4">
						<SecureAvatar
							avatarUrl={profile.avatar_url}
							className="h-32 w-32 rounded-full border border-(--desktop-border-strong) object-cover shadow-[0_12px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/6"
							alt="Current avatar"
						/>
						<div className="flex gap-2">
							{profile.avatar_url ? (
								<DesktopAppButton
									type="button"
									onClick={() => void handleDeleteAvatar()}
									disabled={isDeletingAvatar}
									variant="danger"
									size="sm"
									className="px-4 py-2"
								>
									{isDeletingAvatar ? (
										<ArrowPathIcon
											className={cn(DESKTOP_LUCIDE.md, 'animate-spin')}
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									) : (
										<TrashIcon
											className={DESKTOP_LUCIDE.md}
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									)}
									Удалить
								</DesktopAppButton>
							) : null}
							<DesktopAppButton
								type="button"
								onClick={() => void handleLoadAvatarHistory()}
								variant="neutral"
								size="sm"
								className="px-4 py-2"
							>
								<ClockIcon
									className={DESKTOP_LUCIDE.md}
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								История
							</DesktopAppButton>
						</div>
					</div>

					<div className="flex-1">
						{avatarPreview && croppedBlob ? (
							<div className="space-y-4">
								<div className="flex items-center gap-4">
									<img
										src={avatarPreview}
										alt="Preview"
										className="h-24 w-24 rounded-full border border-(--desktop-border-strong) object-cover ring-1 ring-white/6"
									/>
									<div className="flex-1">
										<p className="font-medium text-(--desktop-text-primary)">
											{avatarFile?.name || 'Обрезанное изображение'}
										</p>
										<p className="text-sm text-(--desktop-text-muted) antialiased">
											{formatFileSize(croppedBlob.size)}
										</p>
									</div>
								</div>
								<div className="flex gap-2">
									<DesktopAppButton
										type="button"
										onClick={() => void handleUploadAvatar()}
										disabled={isUploadingAvatar}
										variant="accent"
										className="flex-1"
									>
										{isUploadingAvatar ? (
											<>
												<ArrowPathIcon
													className={cn(DESKTOP_LUCIDE.md, 'animate-spin')}
													strokeWidth={DESKTOP_LUCIDE.stroke}
													aria-hidden
												/>
												Загрузка...
											</>
										) : (
											<>
												<ArrowUpTrayIcon
													className={DESKTOP_LUCIDE.md}
													strokeWidth={DESKTOP_LUCIDE.stroke}
													aria-hidden
												/>
												Загрузить
											</>
										)}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										onClick={handleCancelAvatarUpload}
										disabled={isUploadingAvatar}
										variant="neutral"
									>
										Отмена
									</DesktopAppButton>
								</div>
							</div>
						) : (
							// biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop zone; file input is the accessible control
							<div
								ref={dropZoneRef}
								onDragEnter={handleDragEnter}
								onDragLeave={handleDragLeave}
								onDragOver={handleDragOver}
								onDrop={handleDrop}
								className={cn(
									'rounded-xl border border-dashed p-8 text-center transition-colors',
									isDragging
										? 'border-[rgb(var(--desktop-accent-rgb))]/45 bg-(--desktop-surface-soft)'
										: 'border-(--desktop-border-strong) hover:border-[rgb(var(--desktop-accent-rgb))]/35 hover:bg-(--desktop-surface-soft)/80'
								)}
							>
								<label
									htmlFor="profile-avatar-file"
									className="block cursor-pointer"
								>
									<ArrowUpTrayIcon
										className="mx-auto mb-4 h-11 w-11 shrink-0 text-slate-500"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									<p className="mb-2 text-(--desktop-text-primary)">
										Перетащите изображение или{' '}
										<span className="font-medium text-[rgb(var(--desktop-accent-rgb)/0.92)] underline decoration-white/10 underline-offset-4">
											выберите файл
										</span>
									</p>
									<p className="text-sm text-(--desktop-text-dim)">
										JPEG, PNG, WEBP • Максимум 5 МБ
									</p>
								</label>
								<input
									ref={fileInputRef}
									id="profile-avatar-file"
									type="file"
									accept="image/jpeg,image/png,image/webp"
									onChange={handleFileInputChange}
									className="hidden"
								/>
							</div>
						)}
					</div>
				</div>
			</DesktopAppPanel>

			<AnimatePresence>
				{showAvatarHistory ? (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className={cn(
							'fixed inset-0 flex items-center justify-center p-6',
							DESKTOP_OVERLAY.backdrop
						)}
						style={{ zIndex: embeddedModalZ.backdrop }}
						onClick={() => setShowAvatarHistory(false)}
					>
						<motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							style={{ zIndex: embeddedModalZ.content }}
							onClick={(e) => e.stopPropagation()}
						>
							<DesktopAppModalFrame
								title="История аватаров"
								onClose={() => setShowAvatarHistory(false)}
								className="max-w-2xl"
							>
								<div className="flex-1 overflow-y-auto p-6">
									{isLoadingHistory ? (
										<div className="flex items-center justify-center py-12">
											<ArrowPathIcon
												className="h-8 w-8 shrink-0 animate-spin text-slate-400"
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
										</div>
									) : avatarHistory.length === 0 ? (
										<DesktopAppEmptyState
											icon={
												<PhotoIcon
													className="h-12 w-12 text-slate-500"
													strokeWidth={DESKTOP_LUCIDE.stroke}
													aria-hidden
												/>
											}
											title="История пуста"
										/>
									) : (
										<div className="grid grid-cols-3 gap-4">
											{avatarHistory.map((item) => (
												<DesktopAppPanel
													key={item.id}
													className={cn(
														shellPanel,
														'p-4 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none hover:border-(--desktop-border-strong)'
													)}
												>
													<SecureAvatar
														avatarUrl={item.avatar_url}
														className="mb-2 aspect-square w-full rounded-lg object-cover"
													/>
													<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mb-1')}>
														{formatDate(item.created_at)}
													</p>
													<p className="text-xs text-(--desktop-text-dim)">
														{item.file_size
															? formatFileSize(item.file_size)
															: 'N/A'}
													</p>
												</DesktopAppPanel>
											))}
										</div>
									)}
								</div>
							</DesktopAppModalFrame>
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>

			{avatarFile ? (
				<Portal>
					<AvatarCropModal
						imageFile={avatarFile}
						isOpen={showCropModal}
						onClose={handleCropCancel}
						onCropComplete={handleCropComplete}
					/>
				</Portal>
			) : null}
		</div>
	);
}
