/**
 * Shared Tab Component
 *
 * Content shared with the user
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { safeCopyToClipboard } from '@utils/clipboard';
import { motion } from 'framer-motion';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { useDesktopShellFrame } from '../../../../pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../../../pages/Desktop/utils/desktopVisualSystem';
import { buildContentManagerUrl } from '../../../../pages/Desktop/utils/desktopDeepLink';
import type { ShareResponse } from '../../types';
import { formatDate } from '../../utils/contentUtils';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	CheckIcon,
	EyeIcon,
	LinkIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

interface SharedTabProps {
	sharedContents: ShareResponse[];
	loading: boolean;
	onRefresh: () => void;
	onDownload: (contentId: string, name: string) => void;
	/** Open preview in Content Manager (same as library preview). */
	onPreview?: (contentId: string) => void;
}

function normalizePermission(raw: string | undefined): string {
	return String(raw || 'view').toLowerCase();
}

export const SharedTab: React.FC<SharedTabProps> = ({
	sharedContents,
	loading,
	onRefresh,
	onDownload,
	onPreview,
}) => {
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellContentPanelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const shellInsetControlClass = useMemo(
		() => getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
		[shellFrame]
	);
	const [copiedContentId, setCopiedContentId] = useState<string | null>(null);
	const [copyFailedContentId, setCopyFailedContentId] = useState<string | null>(
		null
	);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const copyFailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
			if (copyFailTimerRef.current) clearTimeout(copyFailTimerRef.current);
		};
	}, []);

	const permissionLabel = useCallback(
		(key: string) => {
			const k = normalizePermission(key);
			return t(`sharedTab.permission.${k}`, { defaultValue: k });
		},
		[t]
	);

	const handleCopyLink = useCallback(async (contentId: string) => {
		const url = buildContentManagerUrl(contentId);
		if (!url) return;
		if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		if (copyFailTimerRef.current) clearTimeout(copyFailTimerRef.current);
		setCopyFailedContentId(null);

		const ok = await safeCopyToClipboard(url);
		if (ok) {
			setCopiedContentId(contentId);
			copyTimerRef.current = setTimeout(() => {
				setCopiedContentId(null);
				copyTimerRef.current = null;
			}, 2000);
		} else {
			setCopiedContentId(null);
			setCopyFailedContentId(contentId);
			copyFailTimerRef.current = setTimeout(() => {
				setCopyFailedContentId(null);
				copyFailTimerRef.current = null;
			}, 3200);
		}
	}, []);

	return (
		<div className="space-y-4">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div>
					<h3 className="text-sm font-semibold text-(--desktop-text-primary)">
						{t('sharedTab.title')}
					</h3>
					<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1')}>
						{t('sharedTab.intro')}
					</p>
				</div>
				<DesktopAppButton
					type="button"
					variant="neutral"
					size="sm"
					onClick={onRefresh}
					disabled={loading}
				>
					<ArrowPathIcon
						className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
					/>
					{t('sharedTab.refresh')}
				</DesktopAppButton>
			</div>

			{loading ? (
				<div
					className={cn(shellContentPanelClass, 'min-h-0 p-4')}
					role="status"
					aria-busy="true"
					aria-live="polite"
				>
					<span className="sr-only">{t('files.list.loadingAria')}</span>
					<div className="space-y-3">
						<DesktopAppSkeleton className="h-24" />
						<DesktopAppSkeleton className="h-24" />
						<DesktopAppSkeleton className="h-24" />
					</div>
				</div>
			) : !Array.isArray(sharedContents) || sharedContents.length === 0 ? (
				<div className={cn(shellContentPanelClass, 'min-h-0 p-6')}>
					<DesktopAppEmptyState
						icon={<UsersIcon className="h-8 w-8 text-(--desktop-text-dim)" />}
						title={t('sharedTab.emptyTitle')}
						description={t('sharedTab.emptyDesc')}
					>
						<div className="flex max-w-sm flex-col items-center gap-2">
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								onClick={onRefresh}
								disabled={loading}
							>
								<ArrowPathIcon
									className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
								/>
								{t('sharedTab.refresh')}
							</DesktopAppButton>
							<p className="whitespace-pre-line text-center text-xs leading-relaxed text-(--desktop-text-dim)">
								{t('sharedTab.emptyHint')}
							</p>
						</div>
					</DesktopAppEmptyState>
				</div>
			) : (
				<div className="space-y-3">
					{sharedContents.map((share) => {
						const permission = normalizePermission(
							share.permission_level || share.permission
						);
						const shareUrl = buildContentManagerUrl(share.content_id);
						const isCopied = copiedContentId === share.content_id;
						const copyFailed = copyFailedContentId === share.content_id;
						return (
							<motion.div
								key={share.id}
								className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)] bg-(--desktop-surface-panel) p-4 shadow-(--desktop-shadow-soft) transition-colors hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel-strong)"
								transition={{ duration: 0.2 }}
							>
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
											{share.content_name || t('sharedTab.noName')}
										</div>
										<div className="mt-2 flex flex-wrap items-center gap-2">
											<DesktopAppStatusBadge className="border-[rgb(var(--desktop-accent-rgb))]/30 bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)">
												{share.content_type
													? t(`contentTypes.${share.content_type}`, {
															defaultValue: t('sharedTab.unknownType'),
														})
													: t('sharedTab.unknownType')}
											</DesktopAppStatusBadge>
											<DesktopAppStatusBadge
												className={`${
													permission === 'admin' || permission === 'owner'
														? 'bg-red-500/20 text-red-100'
														: permission === 'edit' || permission === 'write'
															? 'bg-orange-500/20 text-orange-100'
															: 'bg-emerald-500/20 text-emerald-100'
												}`}
											>
												{permissionLabel(permission)}
											</DesktopAppStatusBadge>
										</div>
										<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-2')}>
											{t('sharedTab.from', {
												name:
													share.shared_by ||
													share.shared_by_user_id ||
													t('sharedTab.unknownSharer'),
											})}
										</div>
										<div className="mt-1 text-xs text-(--desktop-text-dim)">
											{t('sharedTab.granted', {
												date: formatDate(share.created_at, i18n.language),
											})}
										</div>

										{shareUrl ? (
											<div className="mt-3 space-y-1.5">
												<div className="text-[11px] font-medium uppercase tracking-wide text-(--desktop-text-muted)">
													{t('sharedTab.linkLabel')}
												</div>
												<div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
													<div
														className={cn(
															shellInsetControlClass,
															'min-h-9 min-w-0 flex-1 truncate rounded-(--desktop-radius) px-2.5 py-2 font-mono text-[11px] leading-snug text-(--desktop-text-secondary)'
														)}
														title={shareUrl}
													>
														{shareUrl}
													</div>
													<DesktopAppButton
														type="button"
														variant={isCopied ? 'neutral' : 'ghost'}
														size="sm"
														className="shrink-0 sm:self-stretch"
														onClick={() => handleCopyLink(share.content_id)}
														aria-label={t('pro.menu.copyLink')}
													>
														{isCopied ? (
															<CheckIcon
																className="h-4 w-4 text-[rgb(52_211_153/0.95)]"
																aria-hidden
															/>
														) : (
															<LinkIcon className="h-4 w-4" aria-hidden />
														)}
														<span aria-live="polite">
															{isCopied
																? t('pro.toast.linkCopied')
																: t('pro.menu.copyLink')}
														</span>
													</DesktopAppButton>
												</div>
												{copyFailed ? (
													<p
														className="text-xs text-[rgb(var(--desktop-danger-rgb,220_38_38)/0.95)]"
														role="status"
														aria-live="polite"
													>
														{t('pro.toast.copyLinkFailed')}
													</p>
												) : null}
											</div>
										) : null}
									</div>
									<div className="flex shrink-0 items-start gap-1">
										{onPreview ? (
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => onPreview(share.content_id)}
												aria-label={t('sharedTab.previewAria')}
												title={t('sharedTab.previewAria')}
											>
												<EyeIcon className="h-4 w-4" />
											</DesktopAppButton>
										) : null}
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="icon"
											onClick={() =>
												onDownload(
													share.content_id,
													share.content_name || t('sharedTab.fallbackFile')
												)
											}
											aria-label={t('sharedTab.downloadAria')}
										>
											<ArrowDownTrayIcon className="h-4 w-4" />
										</DesktopAppButton>
									</div>
								</div>
							</motion.div>
						);
					})}
				</div>
			)}
		</div>
	);
};
