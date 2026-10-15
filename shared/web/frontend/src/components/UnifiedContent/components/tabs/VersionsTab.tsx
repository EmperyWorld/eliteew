/**
 * Versions Tab Component
 *
 * Content version history and restoration
 */

import * as React from 'react';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Version, Content, Company, Project } from '../../types';
import { formatBytes, formatDate } from '../../utils/contentUtils';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../../../pages/Desktop/constants';
import { useDesktopShellFrame } from '../../../../pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellProgressTrackClassName,
} from '../../../../pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';
import {
	ArrowDownTrayIcon,
	ArrowUturnLeftIcon,
	BriefcaseIcon,
	BuildingOffice2Icon,
	ClockIcon,
	InformationCircleIcon,
	ServerIcon,
	UsersIcon,
} from '@heroicons/react/24/outline';

interface VersionsTabProps {
	versions: Version[];
	selectedContent: Content | null;
	companies: Company[];
	projects: Project[];
	loading: boolean;
	onVersionDownload: (
		versionId: string,
		versionNumber: number,
		name: string
	) => void;
	onVersionRestore: (contentId: string, versionNumber: number) => void;
	onClearSelection: () => void;
	/** Owned files with more than one row in content_versions */
	multiVersionItems: Content[];
	multiVersionLoading: boolean;
	onSelectMultiVersionFile: (contentId: string) => void;
}

function visibilityBadgeToneClass(visibility: string): string {
	if (visibility === 'public' || visibility === 'friends') {
		return 'border-[rgb(var(--desktop-accent-rgb))]/30 bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)';
	}
	if (visibility === 'shared') {
		return 'border-(--desktop-border-strong) bg-(--desktop-surface-accent) text-(--desktop-text-primary)';
	}
	return 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)';
}

export const VersionsTab: React.FC<VersionsTabProps> = ({
	versions,
	selectedContent,
	companies,
	projects,
	loading,
	onVersionDownload,
	onVersionRestore,
	onClearSelection,
	multiVersionItems,
	multiVersionLoading,
	onSelectMultiVersionFile,
}) => {
	const { t, i18n } = useTranslation('contentManager');
	const dateLocale = i18n.language;
	const shellFrame = useDesktopShellFrame();
	const shellContentPanelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const shellInsetNoteClass = useMemo(
		() => getDesktopShellProgressTrackClassName(shellFrame),
		[shellFrame]
	);

	const visibilityLabel = (v: string) => {
		if (v === 'friends') return t('versions.visibilityFriends');
		if (v === 'public') return t('versions.visibilityPublic');
		if (v === 'shared') return t('versions.visibilityShared');
		if (v === 'from_friends') return t('versions.visibilityFromFriends');
		return t('versions.visibilityPrivate');
	};

	return (
		<div className="space-y-8">
			<section aria-labelledby="cm-versions-multi-heading">
				<div className="mb-3">
					<h3
						id="cm-versions-multi-heading"
						className="text-sm font-semibold text-(--desktop-text-primary)"
					>
						{t('versions.multiVersionTitle')}
					</h3>
					<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1')}>
						{t('versions.multiVersionIntro')}
					</p>
				</div>
				{multiVersionLoading ? (
					<div
						className={cn(shellContentPanelClass, 'min-h-0 p-4')}
						role="status"
						aria-busy="true"
						aria-live="polite"
					>
						<span className="sr-only">{t('files.list.loadingAria')}</span>
						<div className="space-y-3">
							<DesktopAppSkeleton className="h-16" />
							<DesktopAppSkeleton className="h-16" />
						</div>
					</div>
				) : multiVersionItems.length === 0 ? (
					<div className={cn(shellContentPanelClass, 'min-h-0 p-4')}>
						<p className="text-sm leading-relaxed text-(--desktop-text-muted)">
							{t('versions.multiVersionEmpty')}
						</p>
					</div>
				) : (
					<ul className="m-0 list-none space-y-2 p-0">
						{multiVersionItems.map((c) => {
							const isActive = selectedContent?.id === c.id;
							const snaps = c.version_snapshot_count;
							return (
								<li key={c.id}>
									<button
										type="button"
										onClick={() => onSelectMultiVersionFile(c.id)}
										className={cn(
											'w-full rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)] bg-(--desktop-surface-panel) p-3 text-left shadow-(--desktop-shadow-soft) transition-colors',
											'hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel-strong)',
											isActive &&
												'ring-2 ring-[rgb(var(--desktop-accent-rgb)/0.45)] ring-offset-2 ring-offset-(--desktop-surface-page)'
										)}
									>
										<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
											{c.name}
										</div>
										<div className="mt-1 text-xs text-(--desktop-text-dim)">
											{snaps != null
												? t('versions.snapshotCount', { count: snaps })
												: null}
										</div>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</section>

			{!selectedContent ? (
				multiVersionLoading ? null : multiVersionItems.length > 0 ? (
					<div className={cn(shellContentPanelClass, 'min-h-0 p-6')}>
						<DesktopAppEmptyState
							icon={
								<ClockIcon
									className="h-8 w-8 text-(--desktop-text-dim)"
									aria-hidden
								/>
							}
							title={t('versions.pickFileTitle')}
							description={t('versions.pickFromListHint')}
							role="status"
						/>
					</div>
				) : (
					<div className={cn(shellContentPanelClass, 'min-h-0 p-6')}>
						<DesktopAppEmptyState
							icon={
								<ClockIcon
									className="h-8 w-8 text-(--desktop-text-dim)"
									aria-hidden
								/>
							}
							title={t('versions.pickFileTitle')}
							description={t('versions.pickFileDesc')}
							role="status"
						/>
					</div>
				)
			) : (
				<section
					className="space-y-6"
					aria-labelledby="unified-content-versions-heading"
				>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div className="min-w-0 flex-1">
							<h3
								id="unified-content-versions-heading"
								className="truncate text-sm font-semibold text-(--desktop-text-primary)"
							>
								{t('versions.heading', { name: selectedContent.name })}
							</h3>
							<p className="mt-1 text-xs leading-relaxed text-(--desktop-text-muted)">
								{t('versions.intro')}
							</p>
						</div>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="shrink-0 self-start"
							onClick={onClearSelection}
						>
							<ClockIcon className="h-4 w-4 shrink-0" aria-hidden />
							{t('versions.clearSelection')}
						</DesktopAppButton>
					</div>

					{loading ? (
						<div
							className={cn(shellContentPanelClass, 'min-h-0 p-4')}
							role="status"
							aria-busy="true"
							aria-live="polite"
						>
							<span className="sr-only">{t('list.loadingAria')}</span>
							<div className="space-y-3">
								<DesktopAppSkeleton className="h-24" />
								<DesktopAppSkeleton className="h-24" />
								<DesktopAppSkeleton className="h-24" />
							</div>
						</div>
					) : versions.length === 0 ? (
						<div
							className={cn(shellContentPanelClass, 'min-h-0 p-6')}
							role="status"
							aria-live="polite"
						>
							<DesktopAppEmptyState
								icon={
									<ClockIcon
										className="h-8 w-8 text-(--desktop-text-dim)"
										aria-hidden
									/>
								}
								title={t('versions.emptyTitle')}
								description={t('versions.emptyDesc')}
							/>
						</div>
					) : (
						<div className="space-y-2">
							<div className="flex flex-wrap items-baseline justify-between gap-2 px-0.5">
								<DesktopAppSectionLabel>
									{t('tabs.versions')}
								</DesktopAppSectionLabel>
								<span
									className="text-[11px] tabular-nums text-(--desktop-text-dim)"
									aria-hidden
								>
									{versions.length}
								</span>
							</div>
							<ul
								className="m-0 list-none space-y-3 p-0"
								aria-label={t('versions.heading', {
									name: selectedContent.name,
								})}
							>
								{versions.map((version) => {
									const versionTitle = t('versions.versionNumber', {
										n: version.version_number,
									});
									const restoreLabel = `${t('versions.restore')}: ${versionTitle}`;
									const downloadLabel = `${t('versions.download')}: ${versionTitle} — ${selectedContent.name}`;
									const canRestore = Boolean(selectedContent.id);

									return (
										<motion.li
											key={version.version_id}
											className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)] bg-(--desktop-surface-panel) p-4 shadow-(--desktop-shadow-soft) transition-colors hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-panel-strong)"
											transition={{ duration: 0.2 }}
										>
											<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
												<div className="min-w-0 flex-1 space-y-2">
													<div className="flex flex-wrap items-center gap-2">
														<p className="text-base font-semibold tracking-tight text-(--desktop-text-primary)">
															{versionTitle}
														</p>
														{version.version_number === 1 && (
															<DesktopAppStatusBadge className="border-[rgb(var(--desktop-accent-rgb))]/40 bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)">
																{t('versions.badgeOriginal')}
															</DesktopAppStatusBadge>
														)}
													</div>
													<div className="flex flex-col gap-1.5 text-sm text-(--desktop-text-muted) antialiased sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-1">
														<p className="flex items-center gap-1.5 tabular-nums">
															<ClockIcon
																className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-dim)"
																aria-hidden
															/>
															<time dateTime={version.created_at}>
																{formatDate(version.created_at, dateLocale)}
															</time>
														</p>
														<p className="flex items-center gap-1.5">
															<ServerIcon
																className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-dim)"
																aria-hidden
															/>
															<span>
																{t('versions.sizeLabel', {
																	size: formatBytes(
																		version.file_size,
																		dateLocale
																	),
																})}
															</span>
														</p>
														{(version.created_by_username ||
															version.updated_by_username) && (
															<p className="flex items-center gap-1.5 sm:col-span-2">
																<UsersIcon
																	className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-dim)"
																	aria-hidden
																/>
																<span>
																	{version.updated_by_username ||
																		version.created_by_username ||
																		t('versions.unknownUser')}
																</span>
															</p>
														)}
													</div>
													{version.change_description && (
														<div
															className={cn(
																'rounded-(--desktop-radius) p-2.5 text-xs leading-relaxed text-(--desktop-text-secondary)',
																shellInsetNoteClass
															)}
														>
															<InformationCircleIcon
																className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-(--desktop-text-dim)"
																aria-hidden
															/>
															{version.change_description}
														</div>
													)}
													<div className="flex flex-wrap gap-2 pt-0.5 text-xs">
														{selectedContent.company_id &&
															Array.isArray(companies) && (
																<span className="flex items-center gap-1 text-(--desktop-text-muted)">
																	<BuildingOffice2Icon
																		className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-dim)"
																		aria-hidden
																	/>
																	{companies.find(
																		(c) => c.id === selectedContent.company_id
																	)?.name || t('versions.fallbackCompany')}
																</span>
															)}
														{selectedContent.project_id &&
															Array.isArray(projects) && (
																<span className="flex items-center gap-1 text-(--desktop-text-muted)">
																	<BriefcaseIcon
																		className="h-3.5 w-3.5 shrink-0 text-(--desktop-text-dim)"
																		aria-hidden
																	/>
																	{projects.find(
																		(p) => p.id === selectedContent.project_id
																	)?.name || t('versions.fallbackProject')}
																</span>
															)}
														<DesktopAppStatusBadge
															className={visibilityBadgeToneClass(
																selectedContent.visibility
															)}
														>
															{visibilityLabel(selectedContent.visibility)}
														</DesktopAppStatusBadge>
														{selectedContent.friend_visibility &&
															selectedContent.visibility !== 'friends' && (
																<DesktopAppStatusBadge className="border-[rgb(var(--desktop-accent-rgb))]/25 bg-[rgb(var(--desktop-accent-rgb)/0.08)] text-(--desktop-text-secondary)">
																	{t('versions.friendVisibilityBadge')}
																</DesktopAppStatusBadge>
															)}
													</div>
												</div>
												<div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:justify-end lg:w-auto lg:flex-col xl:flex-row">
													<DesktopAppButton
														type="button"
														variant="neutral"
														size="sm"
														className="w-full sm:w-auto"
														disabled={!canRestore}
														aria-label={restoreLabel}
														onClick={() => {
															if (!selectedContent.id) return;
															onVersionRestore(
																selectedContent.id,
																version.version_number
															);
														}}
													>
														<ArrowUturnLeftIcon
															className="h-4 w-4 shrink-0"
															aria-hidden
														/>
														{t('versions.restore')}
													</DesktopAppButton>
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="sm"
														className="w-full sm:w-auto"
														aria-label={downloadLabel}
														onClick={() =>
															onVersionDownload(
																version.version_id,
																version.version_number,
																selectedContent?.name ||
																	t('versions.downloadNameFallback')
															)
														}
													>
														<ArrowDownTrayIcon
															className="h-4 w-4 shrink-0"
															aria-hidden
														/>
														{t('versions.download')}
													</DesktopAppButton>
												</div>
											</div>
										</motion.li>
									);
								})}
							</ul>
						</div>
					)}
				</section>
			)}
		</div>
	);
};
