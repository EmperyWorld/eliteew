/**
 * Version ClockIcon Panel
 *
 * Enhanced version history panel integrated with Unified Content API.
 * Provides full versioning support with view history and restore capabilities.
 *
 * Features:
 * - Fetch version history from /api/v1/content/{id}/versions
 * - Restore specific versions via /api/v1/content/{id}/revert/{version}
 * - Timeline view with diff indicators
 * - Auto-refresh on document changes
 * - Type-safe integration with file-exchange system
 *
 * Created: 2025-10-24
 */

import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import { sanitizeUserHtml } from '@/utils/sanitizeUserHtml';
import { getDocEditorPanelProseClassName } from '../utils/tiptapProseThemeClass';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowPathIcon,
	ArrowTrendingDownIcon,
	ArrowTrendingUpIcon,
	ArrowUturnLeftIcon,
	CheckIcon,
	ClockIcon,
	DocumentTextIcon,
	ExclamationCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { FileId } from '../../../types/fileExchange';
import { API_PATHS } from '../../../services/api/config';
import { apiClient } from '../../../services/api';
import { log } from '../../../utils/logger';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppStatusBadge,
} from '../../../pages/Desktop/components/DesktopAppChrome';

// ============================================================================
// TYPES
// ============================================================================

interface DocumentVersion {
	version_number: number;
	created_at: string;
	file_size: number;
	change_summary?: string;
	created_by?: string;
	plain_text?: string;
	rendered_html?: string;
}

interface VersionsResponse {
	versions: DocumentVersion[];
	current_version: number | null;
	total?: number;
}

interface VersionHistoryPanelProps {
	isOpen: boolean;
	onClose: () => void;
	fileId: FileId | null;
	documentId?: string | null;
	onVersionRestored?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
	isOpen,
	onClose,
	fileId,
	documentId,
	onVersionRestored,
}) => {
	const { t, i18n } = useTranslation('docEditorPanels');
	// State
	const [versions, setVersions] = useState<DocumentVersion[]>([]);
	const [currentVersion, setCurrentVersion] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedVersion, setSelectedVersion] =
		useState<DocumentVersion | null>(null);
	const [restoring, setRestoring] = useState(false);
	const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
	const [versionHtmlPreview, setVersionHtmlPreview] = useState<string | null>(
		null
	);
	const parentRef = useRef<HTMLDivElement>(null);

	const shellTheme = useDesktopShellTheme();
	const versionPreviewProseClass = useMemo(
		() => getDocEditorPanelProseClassName(shellTheme),
		[shellTheme]
	);
	const docSidePanelZ = useDocEditorSidePanelZIndex();

	const documentUuid = documentId ?? fileId ?? null;

	/**
	 * Fetches version history from Unified Content API
	 */
	const fetchVersions = useCallback(async () => {
		if (!documentUuid) {
			setVersions([]);
			setCurrentVersion(null);
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const response = await apiClient.get<VersionsResponse>(
				`${API_PATHS.DOC_EDITOR}/documents/${documentUuid}/versions`
			);

			const versionsResponse = response.data.versions || [];
			setVersions(versionsResponse);
			setCurrentVersion(response.data.current_version ?? null);
			if (versionsResponse.length > 0 && versionsResponse[0]) {
				const firstVersion = versionsResponse[0];
				const initialHtml =
					firstVersion.rendered_html ?? firstVersion.plain_text ?? null;
				setVersionHtmlPreview(initialHtml);
				setSelectedVersion(firstVersion);
			} else {
				setVersionHtmlPreview(null);
				setSelectedVersion(null);
			}

			log.info('VersionHistoryV2', 'Loaded versions', {
				count: response.data.total ?? versionsResponse.length,
			});
		} catch (err) {
			// ✅ FIX: Graceful degradation для 404 - endpoint может не существовать
			const axiosError =
				err && typeof err === 'object' && 'response' in err
					? (err as { response?: { status?: number } })
					: null;

			if (axiosError?.response?.status === 404) {
				log.warn('VersionHistoryV2', 'Versions endpoint not available (404)');
				setVersions([]);
				setCurrentVersion(null);
				setError(null); // Не показываем ошибку для 404
			} else {
				log.error(
					'VersionHistoryV2',
					'Failed to fetch versions',
					err instanceof Error ? err : undefined,
					err
				);
				const errObj = err instanceof Error ? err : undefined;
				const raw = errObj?.message ?? '';
				setError(
					raw.length < 120 &&
						!/Traceback|File "|500|Internal Server Error/i.test(raw)
						? raw || t('versions.loadFailed')
						: t('versions.loadFailed')
				);
			}
		} finally {
			setLoading(false);
		}
	}, [documentUuid, t]);

	/**
	 * Restores a specific version
	 */
	const handleRestore = async (versionNumber: number): Promise<void> => {
		if (!documentUuid || !showRestoreConfirm) {
			setShowRestoreConfirm(true);
			return;
		}

		setRestoring(true);
		setError(null);

		try {
			await apiClient.post(
				`${API_PATHS.DOC_EDITOR}/documents/${documentUuid}/restore/${versionNumber}`
			);

			log.info('VersionHistoryV2', `Restored version ${versionNumber}`);

			// Refresh versions list
			await fetchVersions();

			// Notify parent
			onVersionRestored?.();

			// Reset UI
			setShowRestoreConfirm(false);
			setSelectedVersion(null);
		} catch (err) {
			log.error(
				'VersionHistoryV2',
				'Failed to restore version',
				err instanceof Error ? err : undefined,
				err
			);
			setError(t('versions.restoreFailed'));
		} finally {
			setRestoring(false);
		}
	};

	const handleCancel = useCallback((): void => {
		setShowRestoreConfirm(false);
		setSelectedVersion(null);
	}, []);

	// Load versions when panel opens or fileId changes
	useEffect(() => {
		if (isOpen && documentUuid) {
			void fetchVersions();
		}
	}, [isOpen, documentUuid, fetchVersions]);

	useEffect(() => {
		if (selectedVersion) {
			const html =
				selectedVersion.rendered_html ?? selectedVersion.plain_text ?? null;
			setVersionHtmlPreview(html);
		}
	}, [selectedVersion]);

	// ============================================================================
	// UTILITY FUNCTIONS
	// ============================================================================

	const formatDate = (dateString: string): string => {
		if (!dateString) {
			return t('versions.dash');
		}
		const date = new Date(dateString);
		if (Number.isNaN(date.getTime())) {
			return t('versions.dash');
		}
		const locale = i18n.language?.startsWith('ru') ? 'ru-RU' : 'en-US';
		return new Intl.DateTimeFormat(locale, {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(date);
	};

	const getTimeAgo = (dateString: string): string => {
		if (!dateString) {
			return t('versions.timeUnknown');
		}
		const date = new Date(dateString);
		if (Number.isNaN(date.getTime())) {
			return t('versions.timeUnknown');
		}
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return t('versions.relativeDaysAgo', { count: days });
		}
		if (hours > 0) {
			return t('versions.relativeHoursAgo', { count: hours });
		}
		if (minutes > 0) {
			return t('versions.relativeMinutesAgo', { count: minutes });
		}
		return t('versions.relativeJustNow');
	};

	const getSizeChange = (
		version: DocumentVersion,
		prevVersion?: DocumentVersion
	): number => {
		if (!prevVersion) {
			return 0;
		}
		if (
			typeof version.file_size !== 'number' ||
			typeof prevVersion.file_size !== 'number'
		) {
			return 0;
		}
		return version.file_size - prevVersion.file_size;
	};

	const formatFileSize = (bytes: number): string => {
		if (!Number.isFinite(bytes) || bytes <= 0) {
			return t('versions.dash');
		}
		const k = 1024;
		const sizes = ['bytes', 'kb', 'mb', 'gb'] as const;
		const i = Math.min(
			Math.floor(Math.log(bytes) / Math.log(k)),
			sizes.length - 1
		);
		return `${(bytes / k ** i).toFixed(2)} ${t(`panels.import.size.${sizes[i]}`)}`;
	};

	// ============================================================================
	// RENDER
	// ============================================================================

	useEffect(() => {
		if (!isOpen) {
			return;
		}
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				if (showRestoreConfirm) {
					handleCancel();
				} else {
					onClose();
				}
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [isOpen, showRestoreConfirm, onClose, handleCancel]);

	if (!isOpen) {
		return null;
	}

	return (
		<AnimatePresence>
			<motion.div
				role="dialog"
				aria-modal="true"
				aria-labelledby="version-history-panel-title"
				initial={{ opacity: 0, x: 100 }}
				animate={{ opacity: 1, x: 0 }}
				exit={{ opacity: 0, x: 100 }}
				transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
				className="fixed bottom-0 right-0 top-0 flex w-96 min-h-0 flex-col overflow-hidden border-l border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-2xl"
				style={{ zIndex: docSidePanelZ }}
			>
				{/* Header */}
				<div className="flex shrink-0 items-center justify-between border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-5">
					<div className="flex items-center gap-3">
						<div className="rounded-xl border border-orange-400/30 bg-linear-to-br from-orange-500/30 to-yellow-500/30 p-2.5">
							<ClockIcon className="text-orange-300" width={20} height={20} />
						</div>
						<div>
							<h3
								id="version-history-panel-title"
								className="font-bold text-(--desktop-text-primary)"
							>
								{t('versions.title')}
							</h3>
							<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
								{t('versions.subtitle')}
							</p>
						</div>
					</div>
					<DesktopAppButton
						onClick={onClose}
						variant="ghost"
						size="icon"
						aria-label={t('versions.close')}
						className="min-h-11 min-w-11"
					>
						<XMarkIcon
							width={20}
							height={20}
							className="text-(--desktop-text-muted)"
						/>
					</DesktopAppButton>
				</div>

				{/* Current Version Info */}
				{currentVersion !== null && (
					<div className="shrink-0 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-accent)_55%,transparent)] p-4">
						<div className="flex items-center gap-2 mb-2">
							<CheckIcon
								className="text-[rgb(var(--desktop-accent-rgb))]"
								width={16}
								height={16}
							/>
							<span className="text-sm font-semibold uppercase tracking-wide text-(--desktop-text-secondary)">
								{t('versions.currentVersionHeading')}
							</span>
						</div>
						<div className="text-sm text-(--desktop-text-secondary)">
							<div className="font-medium text-(--desktop-text-primary)">
								{t('versions.versionNumberLine', { n: currentVersion })}
							</div>
							<div className="mt-1 flex items-center gap-2 text-xs text-(--desktop-text-dim)">
								<span>
									{t('versions.totalVersionsCount', { count: versions.length })}
								</span>
							</div>
						</div>
					</div>
				)}

				{/* Error Display */}
				{error && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						className="mx-4 mt-3 flex shrink-0 items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/20 p-3 text-sm text-red-200"
					>
						<ExclamationCircleIcon width={16} height={16} />
						<span>{error}</span>
					</motion.div>
				)}

				{/* Scroll column: list only (preview + footer outside → no double scroll) */}
				<div
					className="flex min-h-0 flex-1 flex-col overflow-hidden"
					ref={parentRef}
				>
					<div className="min-h-0 flex-1 overflow-y-auto p-4">
						{loading ? (
							<DesktopAppEmptyState
								icon={
									<ArrowPathIcon
										width={44}
										height={44}
										className="mx-auto mb-2 animate-spin text-orange-300"
									/>
								}
								title={t('versions.loadingTitle')}
								description={t('versions.loadingDesc')}
								className="py-10 text-(--desktop-text-muted)"
							/>
						) : !fileId ? (
							<DesktopAppEmptyState
								icon={
									<ClockIcon
										width={44}
										height={44}
										className="mx-auto mb-3 text-orange-300"
									/>
								}
								title={t('versions.noFileTitle')}
								description={t('versions.noFileDesc')}
								className="py-10 text-(--desktop-text-muted)"
							/>
						) : versions.length > 0 ? (
							<div className="relative pl-2">
								<div
									className="absolute bottom-2 left-[19px] top-2 w-px bg-(--desktop-border-subtle)"
									aria-hidden
								/>
								<ul className="relative space-y-3">
									{versions.map((version, versionIndex) => {
										const prevVersion = versions[versionIndex + 1];
										const sizeChange = getSizeChange(version, prevVersion);
										const isSelected =
											selectedVersion?.version_number ===
											version.version_number;
										const isCurrent = version.version_number === currentVersion;
										return (
											<li key={version.version_number} className="relative">
												<div
													className="absolute left-[15px] top-5 z-1 size-2.5 rounded-full border-2 border-(--desktop-border-strong) bg-(--desktop-surface-panel) shadow-sm"
													aria-hidden
												/>
												<motion.div
													initial={{ opacity: 0, y: 6 }}
													animate={{ opacity: 1, y: 0 }}
													transition={{ duration: 0.15 }}
													onClick={() => setSelectedVersion(version)}
													className={`
                          ml-7 cursor-pointer rounded-xl p-3.5 pl-2 transition-all
                          ${
														isSelected
															? 'bg-orange-500/18 ring-2 ring-orange-400/35 ring-offset-2 ring-offset-(--desktop-surface-app)'
															: isCurrent
																? 'border border-[rgb(var(--desktop-accent-rgb))]/35 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_45%,transparent)]'
																: 'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover)'
													}
                        `}
												>
													{/* Version Header */}
													<div className="mb-1 flex items-start justify-between gap-2">
														<div className="flex min-w-0 flex-wrap items-center gap-2">
															<div
																className={`
                            flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums
                            ${isCurrent ? 'bg-(--desktop-surface-accent) text-(--desktop-text-primary) ring-1 ring-[rgb(var(--desktop-accent-rgb))]/40' : 'bg-(--desktop-surface-soft-hover) text-(--desktop-text-primary)'}
                          `}
															>
																v{version.version_number}
															</div>
															{isCurrent ? (
																<DesktopAppStatusBadge className="border border-[rgb(var(--desktop-accent-rgb))]/35 bg-[color-mix(in_srgb,var(--desktop-surface-accent)_70%,transparent)] text-(--desktop-text-primary)">
																	{t('versions.badgeCurrent')}
																</DesktopAppStatusBadge>
															) : null}
														</div>
														<div className="shrink-0 whitespace-nowrap text-[11px] text-(--desktop-text-muted)">
															{getTimeAgo(version.created_at)}
														</div>
													</div>

													<div className="mb-1.5 text-[11px] text-(--desktop-text-dim)">
														{formatDate(version.created_at)}
													</div>

													{/* Change Summary */}
													{version.change_summary && (
														<div className="mb-2 line-clamp-2 text-xs text-(--desktop-text-secondary)">
															{version.change_summary}
														</div>
													)}

													{/* Metadata + diff badges */}
													{((typeof version.file_size === 'number' &&
														version.file_size > 0) ||
														sizeChange !== 0) && (
														<div className="mt-1 flex flex-wrap items-center gap-2">
															{typeof version.file_size === 'number' &&
																version.file_size > 0 && (
																	<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-[11px] font-medium text-(--desktop-text-secondary)">
																		<span className="inline-flex items-center gap-1">
																			<DocumentTextIcon
																				width={12}
																				height={12}
																				className="opacity-80"
																			/>
																			{formatFileSize(version.file_size)}
																		</span>
																	</DesktopAppStatusBadge>
																)}
															{sizeChange !== 0 && (
																<DesktopAppStatusBadge
																	className={
																		sizeChange > 0
																			? 'border border-emerald-400/35 bg-emerald-500/15 text-[11px] font-semibold text-emerald-100'
																			: 'border border-rose-400/35 bg-rose-500/15 text-[11px] font-semibold text-rose-100'
																	}
																>
																	<span className="inline-flex items-center gap-1">
																		{sizeChange > 0 ? (
																			<ArrowTrendingUpIcon
																				width={12}
																				height={12}
																			/>
																		) : (
																			<ArrowTrendingDownIcon
																				width={12}
																				height={12}
																			/>
																		)}
																		{sizeChange > 0 ? '+' : '−'}
																		{formatFileSize(Math.abs(sizeChange))}
																	</span>
																</DesktopAppStatusBadge>
															)}
														</div>
													)}

													{/* Author */}
													{version.created_by && (
														<div className="mt-1 text-xs text-(--desktop-text-dim)">
															by {version.created_by}
														</div>
													)}

													{/* Restore Button */}
													{isSelected && !isCurrent && (
														<div className="mt-3 space-y-2 border-t border-(--desktop-border-subtle) pt-3">
															{!showRestoreConfirm ? (
																<DesktopAppButton
																	onClick={(e) => {
																		e.stopPropagation();
																		setShowRestoreConfirm(true);
																	}}
																	variant="neutral"
																	size="sm"
																	className="w-full border border-rose-400/25 bg-rose-500/8 text-rose-100 hover:border-rose-400/40 hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/35"
																>
																	<ArrowUturnLeftIcon
																		width={16}
																		height={16}
																		className="mr-2"
																	/>
																	{t('versions.restoreLabel')}
																</DesktopAppButton>
															) : (
																<div className="space-y-2">
																	<div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/15 p-2 text-xs text-amber-100">
																		<ExclamationCircleIcon
																			width={14}
																			height={14}
																			className="mt-0.5 shrink-0 text-amber-200"
																		/>
																		<span>
																			{t('versions.restoreConfirmTitle', {
																				n: version.version_number,
																			})}
																		</span>
																	</div>
																	<div className="flex gap-2">
																		<DesktopAppButton
																			onClick={(e) => {
																				e.stopPropagation();
																				void handleRestore(
																					version.version_number
																				);
																			}}
																			variant="neutral"
																			size="sm"
																			className="flex-1 border border-rose-400/30 bg-rose-500/12 text-rose-100 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/35"
																			disabled={restoring}
																		>
																			{restoring
																				? t('versions.restoring')
																				: t('versions.restoreConfirm')}
																		</DesktopAppButton>
																		<DesktopAppButton
																			onClick={(e) => {
																				e.stopPropagation();
																				handleCancel();
																			}}
																			variant="neutral"
																			size="sm"
																			className="flex-1"
																			disabled={restoring}
																		>
																			{t('versions.cancel')}
																		</DesktopAppButton>
																	</div>
																</div>
															)}
														</div>
													)}
												</motion.div>
											</li>
										);
									})}
								</ul>
							</div>
						) : (
							<DesktopAppEmptyState
								icon={
									<ClockIcon
										width={44}
										height={44}
										className="mx-auto mb-3 text-orange-300"
									/>
								}
								title={t('versions.emptyHistoryTitle')}
								description={t('versions.emptyHistoryDesc')}
								className="py-10 text-(--desktop-text-muted)"
							/>
						)}
					</div>

					{/* Preview Panel — scrollable snapshot; restore is explicit in list */}
					<div className="max-h-72 shrink-0 overflow-y-auto border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)">
						<div
							className={cn(
								DESKTOP_TYPOGRAPHY.meta,
								'border-b border-(--desktop-border-subtle) px-4 py-2 text-(--desktop-text-dim)'
							)}
						>
							<p>{t('versions.previewHint')}</p>
							<p className="mt-1">{t('versions.compareHint')}</p>
						</div>
						{versionHtmlPreview ? (
							<div className={versionPreviewProseClass}>
								<div
									className="min-h-40"
									// biome-ignore lint/security/noDangerouslySetInnerHtml: version snapshot HTML sanitized before render
									dangerouslySetInnerHTML={{
										__html: sanitizeUserHtml(versionHtmlPreview),
									}}
								/>
							</div>
						) : (
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'flex items-start gap-2 p-4'
								)}
							>
								<DocumentTextIcon
									width={16}
									height={16}
									className="mt-0.5 shrink-0 text-(--desktop-text-dim)"
									aria-hidden
								/>
								<span>{t('versions.previewPickHint')}</span>
							</div>
						)}
					</div>

					{/* Footer Info */}
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'shrink-0 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3'
						)}
					>
						<div className="flex items-center justify-between gap-2">
							<span>{t('versions.footerAutoVersioning')}</span>
							<span className="font-medium tabular-nums text-orange-300">
								{t('versions.footerTotal', { count: versions.length })}
							</span>
						</div>
					</div>
				</div>
			</motion.div>
		</AnimatePresence>
	);
};

export const VersionHistoryPanelV2 = VersionHistoryPanel;
