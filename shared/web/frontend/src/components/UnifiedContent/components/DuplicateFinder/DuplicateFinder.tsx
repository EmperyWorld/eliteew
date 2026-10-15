/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Content Manager «Duplicates» tab — exact (hash) and potential (size) groups.
 *
 * Invariants:
 * - Exact groups: default-select copies for bulk delete; keep first as original.
 * - Potential groups: same size only — any file may be deleted after confirm;
 *   preview loads metadata via getContent then FilePreviewModal.
 * - Soft-delete via contentApi.deleteContent; list refresh after mutate.
 *
 * Related:
 * - documentation/product/CONTENT-MANAGER.md §Duplicates
 * - GET /api/v1/content/duplicates (unified_content_admin.find_duplicates)
 */

import { motion } from 'framer-motion';
import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppSkeleton,
	DesktopAppStatusBadge,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { FilePreviewModal } from '../../../../pages/Desktop/components/FilePreviewModal';
import { useDesktopShellFrame } from '../../../../pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellCheckboxControlClassName,
	getDesktopShellContentPanelClassName,
} from '../../../../pages/Desktop/utils/desktopVisualSystem';
import { contentApi, toContentError } from '../../../../services/contentApi';
import { log } from '../../../../utils/logger';
import { formatBytes, formatDateShort } from '../../utils/contentUtils';
import {
	ArrowPathIcon,
	CheckCircleIcon,
	EyeIcon,
	HashtagIcon,
	ServerIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';

function DuplicateProgressFill({
	pct,
	className,
}: {
	pct: number;
	className: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.width = `${pct}%`;
	}, [pct]);
	return <div ref={ref} className={className} />;
}

interface DuplicateFile {
	id: string;
	name: string;
	size?: number;
	hash?: string | null;
	created_at?: string | null;
}

interface DuplicateGroup {
	hash?: string;
	size?: number;
	count: number;
	files: DuplicateFile[];
	total_size?: number;
	wasted_space?: number;
}

interface DuplicatesData {
	exact_duplicates: DuplicateGroup[];
	potential_duplicates: DuplicateGroup[];
	summary: {
		exact_duplicate_groups: number;
		potential_duplicate_groups: number;
		total_wasted_space: number;
		total_wasted_space_formatted: string;
	};
}

interface DuplicateFinderProps {
	onChange?: () => void | Promise<void>;
}

function exactGroupKey(idx: number): string {
	return `exact-${idx}`;
}

function buildDefaultExactSelection(group: DuplicateGroup): Set<string> {
	return new Set(group.files.slice(1).map((f) => f.id));
}

export const DuplicateFinder: React.FC<DuplicateFinderProps> = ({
	onChange,
}) => {
	const { t, i18n } = useTranslation('contentManager');
	const shellFrame = useDesktopShellFrame();
	const shellContentPanelClass = useMemo(
		() => getDesktopShellContentPanelClassName(shellFrame),
		[shellFrame]
	);
	const checkboxControlClass = useMemo(
		() =>
			cn(
				'mt-1 h-4 w-4 shrink-0 cursor-pointer rounded',
				getDesktopShellCheckboxControlClassName(shellFrame),
				DESKTOP_CHROME_FOCUS_VISIBLE,
				'disabled:cursor-not-allowed disabled:opacity-50'
			),
		[shellFrame]
	);
	const [loading, setLoading] = useState(false);
	const [data, setData] = useState<DuplicatesData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [deletingKey, setDeletingKey] = useState<string | null>(null);
	const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
	const [deleteProgress, setDeleteProgress] = useState<{
		current: number;
		total: number;
	} | null>(null);
	const [selectedIdsByGroup, setSelectedIdsByGroup] = useState<
		Record<string, Set<string>>
	>({});
	const [pendingSingleDelete, setPendingSingleDelete] =
		useState<DuplicateFile | null>(null);
	const [pendingBulkDelete, setPendingBulkDelete] = useState<{
		group: DuplicateGroup;
		groupKey: string;
	} | null>(null);
	const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);
	const [previewTarget, setPreviewTarget] = useState<{
		contentId: string;
		name: string;
		content_type: string;
		mime_type?: string | null;
	} | null>(null);

	const findDuplicates = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError(null);
		try {
			const response = await contentApi.findDuplicates<DuplicatesData>();
			setData(response);
		} catch (err: unknown) {
			const errorObj = err instanceof Error ? err : new Error(String(err));
			log.error('DuplicateFinder', 'Find duplicates failed', errorObj);
			const errorMessage = toContentError(err, t('duplicates.unknownError'));
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	}, [t]);

	useEffect(() => {
		findDuplicates();
	}, [findDuplicates]);

	useEffect(() => {
		if (!data) {
			return;
		}
		const next: Record<string, Set<string>> = {};
		data.exact_duplicates.forEach((group, idx) => {
			next[exactGroupKey(idx)] = buildDefaultExactSelection(group);
		});
		setSelectedIdsByGroup(next);
	}, [data]);

	const toggleFileSelected = useCallback(
		(groupKey: string, fileId: string, group: DuplicateGroup) => {
			setSelectedIdsByGroup((prev) => {
				const base = prev[groupKey] ?? buildDefaultExactSelection(group);
				const set = new Set(base);
				if (set.has(fileId)) {
					set.delete(fileId);
				} else {
					set.add(fileId);
				}
				return { ...prev, [groupKey]: set };
			});
		},
		[]
	);

	const selectAllCopiesForRemoval = useCallback(
		(groupKey: string, group: DuplicateGroup) => {
			setSelectedIdsByGroup((prev) => ({
				...prev,
				[groupKey]: buildDefaultExactSelection(group),
			}));
		},
		[]
	);

	const clearGroupSelection = useCallback((groupKey: string) => {
		setSelectedIdsByGroup((prev) => ({
			...prev,
			[groupKey]: new Set(),
		}));
	}, []);

	const bulkDeletePreviewFiles = useMemo(() => {
		if (!pendingBulkDelete) {
			return [];
		}
		const { group, groupKey } = pendingBulkDelete;
		const selected =
			selectedIdsByGroup[groupKey] ?? buildDefaultExactSelection(group);
		return group.files.filter((f) => selected.has(f.id));
	}, [pendingBulkDelete, selectedIdsByGroup]);

	const openFilePreview = useCallback(
		async (file: DuplicateFile): Promise<void> => {
			setPreviewBusyId(file.id);
			setError(null);
			try {
				const content = await contentApi.getContent(file.id);
				setPreviewTarget({
					contentId: content.id,
					name: (content.name || file.name).trim() || file.name,
					content_type: content.content_type || 'other',
					mime_type: content.mime_type,
				});
			} catch (err: unknown) {
				const errorObj = err instanceof Error ? err : new Error(String(err));
				log.error('DuplicateFinder', 'Preview duplicate failed', errorObj);
				setError(toContentError(err, t('duplicates.previewError')));
			} finally {
				setPreviewBusyId(null);
			}
		},
		[t]
	);

	const executeDeleteSingle = useCallback(async (): Promise<void> => {
		const file = pendingSingleDelete;
		if (!file) {
			return;
		}

		setDeletingFileId(file.id);
		setError(null);
		try {
			await contentApi.deleteContent(file.id);
			await findDuplicates();
			await onChange?.();
		} catch (err: unknown) {
			const errorObj = err instanceof Error ? err : new Error(String(err));
			log.error('DuplicateFinder', 'Delete single duplicate failed', errorObj);
			setError(toContentError(err, t('duplicates.unknownError')));
			throw err instanceof Error ? err : new Error(String(err));
		} finally {
			setDeletingFileId(null);
		}
	}, [pendingSingleDelete, findDuplicates, onChange, t]);

	const requestBulkDelete = useCallback(
		(group: DuplicateGroup, groupKey: string) => {
			const selected =
				selectedIdsByGroup[groupKey] ?? buildDefaultExactSelection(group);
			const filesToDelete = group.files.filter((f) => selected.has(f.id));
			if (filesToDelete.length === 0) {
				return;
			}
			setPendingBulkDelete({ group, groupKey });
		},
		[selectedIdsByGroup]
	);

	const executeBulkDelete = useCallback(async (): Promise<void> => {
		if (!pendingBulkDelete) {
			return;
		}
		const { group, groupKey } = pendingBulkDelete;
		const selected =
			selectedIdsByGroup[groupKey] ?? buildDefaultExactSelection(group);
		const filesToDelete = group.files.filter((f) => selected.has(f.id));
		if (filesToDelete.length === 0) {
			return;
		}

		setDeletingKey(groupKey);
		setDeleteProgress({ current: 0, total: filesToDelete.length });
		setError(null);
		try {
			for (let i = 0; i < filesToDelete.length; i++) {
				const file = filesToDelete[i];
				await contentApi.deleteContent(file.id);
				setDeleteProgress({
					current: i + 1,
					total: filesToDelete.length,
				});
			}

			await findDuplicates();
			await onChange?.();
		} catch (err: unknown) {
			const errorObj = err instanceof Error ? err : new Error(String(err));
			log.error('DuplicateFinder', 'Delete duplicates failed', errorObj);
			setError(toContentError(err, t('duplicates.unknownError')));
			throw err instanceof Error ? err : new Error(String(err));
		} finally {
			setDeletingKey(null);
			setDeleteProgress(null);
		}
	}, [pendingBulkDelete, selectedIdsByGroup, findDuplicates, onChange, t]);

	const summaryBusy = loading && data !== null;

	if (loading && !data) {
		return (
			<div className="space-y-4">
				<DesktopAppSkeleton className="h-28" />
				<DesktopAppSkeleton className="h-40" />
				<DesktopAppSkeleton className="h-40" />
			</div>
		);
	}

	if (error && !data) {
		return <DesktopAppErrorState message={error} onAction={findDuplicates} />;
	}

	if (!data) {
		return null;
	}

	const hasDuplicates =
		data.summary.exact_duplicate_groups > 0 ||
		data.summary.potential_duplicate_groups > 0;

	const listActionsLocked = deletingFileId !== null || previewBusyId !== null;

	return (
		<div className="space-y-6">
			{error ? (
				<p
					className={cn(DESKTOP_TYPOGRAPHY.caption, 'text-red-600')}
					role="alert"
				>
					{error}
				</p>
			) : null}
			<div className={cn(shellContentPanelClass, 'min-h-0 p-4 sm:p-5')}>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mb-3 border-b border-(--desktop-border-subtle) pb-3 text-(--desktop-text-secondary)'
					)}
				>
					{t('duplicates.userGuide')}
				</p>
			</div>
			<div className={cn(shellContentPanelClass, 'min-h-0 p-5')}>
				<div className="mb-4 flex items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-semibold text-(--desktop-text-primary)">
							{t('duplicates.summaryTitle')}
						</h3>
						<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1')}>
							{t('duplicates.summaryIntro')}
						</p>
					</div>
					<DesktopAppButton
						type="button"
						variant="neutral"
						size="sm"
						onClick={findDuplicates}
						disabled={loading}
					>
						{loading ? (
							<ArrowPathIcon className="h-4 w-4 animate-spin" />
						) : (
							<ArrowPathIcon className="h-4 w-4" />
						)}
						{t('duplicates.refresh')}
					</DesktopAppButton>
				</div>

				{summaryBusy ? (
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'flex items-center gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2'
						)}
					>
						<ArrowPathIcon className="h-3.5 w-3.5 shrink-0 animate-spin" />
						{t('duplicates.refreshingList')}
					</div>
				) : null}

				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
						<div className="mb-1 text-sm text-(--desktop-text-muted) antialiased">
							{t('duplicates.exactLabel')}
						</div>
						<div className="text-2xl font-semibold text-(--desktop-text-primary)">
							{data.summary.exact_duplicate_groups}
						</div>
						<div className="mt-1 text-xs text-(--desktop-text-dim)">
							{t('duplicates.groupsUnit')}
						</div>
					</div>
					<div className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
						<div className="mb-1 text-sm text-(--desktop-text-muted) antialiased">
							{t('duplicates.potentialLabel')}
						</div>
						<div className="text-2xl font-semibold text-(--desktop-text-primary)">
							{data.summary.potential_duplicate_groups}
						</div>
						<div className="mt-1 text-xs text-(--desktop-text-dim)">
							{t('duplicates.groupsUnit')}
						</div>
					</div>
					<div className="rounded-(--desktop-radius) border border-[color-mix(in_srgb,var(--ew-warning-500)_22%,transparent)] bg-[color-mix(in_srgb,var(--ew-warning-500)_10%,transparent)] p-4">
						<div className="mb-1 text-sm text-(--desktop-text-muted)">
							{t('duplicates.wastedTitle')}
						</div>
						<div className="text-2xl font-semibold text-(--desktop-text-primary)">
							{data.summary.total_wasted_space_formatted}
						</div>
						<div className="mt-1 text-xs text-(--desktop-text-dim)">
							{t('duplicates.wastedHint')}
						</div>
					</div>
				</div>
			</div>

			{!hasDuplicates ? (
				<div className={cn(shellContentPanelClass, 'min-h-0 p-8')}>
					<DesktopAppEmptyState
						icon={
							<span className="flex h-16 w-16 items-center justify-center rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) shadow-(--desktop-shadow-soft)">
								<CheckCircleIcon
									className="h-9 w-9 text-(--ew-success-500)"
									strokeWidth={1.35}
									aria-hidden
								/>
							</span>
						}
						title={t('duplicates.emptyTitle')}
						description={t('duplicates.emptyDesc')}
						className="mx-auto max-w-md"
					/>
				</div>
			) : (
				<>
					{data.exact_duplicates.length > 0 && (
						<div>
							<div className="mb-4 flex items-center gap-2">
								<HashtagIcon className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.9)]" />
								<h3 className="text-sm font-semibold text-(--desktop-text-primary)">
									{t('duplicates.exactSection', {
										count: data.exact_duplicates.length,
									})}
								</h3>
							</div>

							<div className="space-y-4">
								{data.exact_duplicates.map((group, idx) => {
									const gKey = exactGroupKey(idx);
									const selectedSet =
										selectedIdsByGroup[gKey] ??
										buildDefaultExactSelection(group);
									const selectedCount = group.files.filter((f) =>
										selectedSet.has(f.id)
									).length;
									const isBusy = deletingKey === gKey;
									const exactListLocked = listActionsLocked;
									const pct =
										deleteProgress && deleteProgress.total > 0
											? Math.round(
													(100 * deleteProgress.current) / deleteProgress.total
												)
											: 0;

									return (
										<motion.div
											key={group.hash || gKey}
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											className="rounded-(--desktop-radius-lg) border border-[color-mix(in_srgb,var(--color-accent-red)_28%,transparent)] bg-[color-mix(in_srgb,var(--color-accent-red)_10%,transparent)] p-4"
										>
											<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
												<div className="min-w-0 flex-1">
													<div className="mb-1 text-sm font-medium text-(--desktop-text-primary)">
														{t('duplicates.sameFiles', { count: group.count })}
													</div>
													<div className={DESKTOP_TYPOGRAPHY.meta}>
														{t('duplicates.hashPrefix')}{' '}
														{group.hash?.substring(0, 16)}...
													</div>
													{group.wasted_space ? (
														<div className="mt-1 text-xs text-[color-mix(in_srgb,var(--ew-warning-500)_58%,var(--desktop-text-primary))]">
															{t('duplicates.wastedLine', {
																size: formatBytes(
																	group.wasted_space,
																	i18n.language
																),
															})}
														</div>
													) : null}
													<p className="mt-2 text-xs text-(--desktop-text-dim)">
														{t('duplicates.selectionHint')}
													</p>
													<p className="mt-1 text-xs font-medium text-(--desktop-text-muted)">
														{t('duplicates.selectedForRemoval', {
															selected: selectedCount,
															total: group.files.length,
														})}
													</p>
												</div>
												<div className="flex shrink-0 flex-col gap-2 sm:items-end">
													<div className="flex flex-wrap gap-2">
														<DesktopAppButton
															type="button"
															variant="neutral"
															size="sm"
															onClick={() =>
																selectAllCopiesForRemoval(gKey, group)
															}
															disabled={isBusy || exactListLocked}
														>
															{t('duplicates.selectAllCopies')}
														</DesktopAppButton>
														<DesktopAppButton
															type="button"
															variant="neutral"
															size="sm"
															onClick={() => clearGroupSelection(gKey)}
															disabled={isBusy || exactListLocked}
														>
															{t('duplicates.clearSelection')}
														</DesktopAppButton>
													</div>
													<DesktopAppButton
														type="button"
														variant="danger"
														size="sm"
														onClick={() => requestBulkDelete(group, gKey)}
														disabled={
															isBusy || exactListLocked || selectedCount === 0
														}
													>
														{isBusy ? (
															<ArrowPathIcon className="h-4 w-4 animate-spin" />
														) : (
															<TrashIcon className="h-4 w-4" />
														)}
														{t('duplicates.deleteSelectedCount', {
															count: selectedCount,
														})}
													</DesktopAppButton>
												</div>
											</div>

											{isBusy && deleteProgress ? (
												<div
													className="mb-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3"
													role="status"
													aria-live="polite"
												>
													<div
														className={cn(
															DESKTOP_TYPOGRAPHY.meta,
															'mb-2 flex items-center justify-between gap-2'
														)}
													>
														<span>
															{t('duplicates.deletingProgress', {
																current: deleteProgress.current,
																total: deleteProgress.total,
															})}
														</span>
														<span className="tabular-nums">{pct}%</span>
													</div>
													<div className="h-1.5 overflow-hidden rounded-full bg-(--desktop-border-subtle)">
														<DuplicateProgressFill
															pct={pct}
															className="h-full rounded-full bg-[color-mix(in_srgb,var(--color-accent-red)_78%,transparent)] transition-[width] duration-200 ease-out motion-reduce:transition-none"
														/>
													</div>
												</div>
											) : null}

											<ul
												className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/40 overflow-hidden"
												aria-label={t('duplicates.sameFiles', {
													count: group.count,
												})}
											>
												{group.files.map((file, fileIdx) => {
													const checked = selectedSet.has(file.id);
													const rowId = `dup-row-${gKey}-${file.id}`;
													const rowDisabled = isBusy || exactListLocked;
													const rowDeleting = deletingFileId === file.id;
													return (
														<li
															key={file.id}
															className={`not-last:border-b not-last:border-(--desktop-border-subtle)/70 p-3 transition-colors duration-150 motion-reduce:transition-none ${
																fileIdx === 0
																	? 'bg-[color-mix(in_srgb,var(--ew-success-500)_11%,transparent)]'
																	: 'bg-(--desktop-surface-soft)/80'
															} ${
																checked
																	? 'ring-inset ring-1 ring-[color-mix(in_srgb,var(--color-accent-red)_32%,transparent)]'
																	: ''
															}`}
														>
															<div className="flex items-start gap-3">
																<input
																	id={rowId}
																	type="checkbox"
																	className={checkboxControlClass}
																	checked={checked}
																	disabled={rowDisabled}
																	onChange={() =>
																		toggleFileSelected(gKey, file.id, group)
																	}
																	aria-describedby={`${rowId}-meta`}
																/>
																<div className="min-w-0 flex-1">
																	<label
																		htmlFor={rowId}
																		className="block cursor-pointer truncate text-sm font-medium leading-snug text-(--desktop-text-primary)"
																		title={file.name}
																	>
																		{file.name}
																	</label>
																	<div
																		id={`${rowId}-meta`}
																		className={cn(
																			DESKTOP_TYPOGRAPHY.meta,
																			'mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 tabular-nums'
																		)}
																	>
																		{file.size != null && file.size > 0 ? (
																			<span className="shrink-0">
																				{formatBytes(file.size, i18n.language)}
																			</span>
																		) : null}
																		{file.created_at ? (
																			<span className="shrink-0 text-(--desktop-text-dim)">
																				{formatDateShort(
																					file.created_at,
																					i18n.language
																				)}
																			</span>
																		) : null}
																	</div>
																</div>
																<div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
																	<DesktopAppButton
																		type="button"
																		variant="neutral"
																		size="sm"
																		disabled={rowDisabled}
																		onClick={() => void openFilePreview(file)}
																		className="whitespace-nowrap"
																		title={t('duplicates.preview')}
																		aria-label={t('duplicates.previewAria', {
																			name: file.name,
																		})}
																	>
																		{previewBusyId === file.id ? (
																			<ArrowPathIcon className="h-4 w-4 animate-spin" />
																		) : (
																			<EyeIcon className="h-4 w-4" />
																		)}
																		{t('duplicates.preview')}
																	</DesktopAppButton>
																	{fileIdx === 0 ? (
																		<DesktopAppStatusBadge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-100">
																			{t('duplicates.originalBadge')}
																		</DesktopAppStatusBadge>
																	) : (
																		<DesktopAppButton
																			type="button"
																			variant="danger"
																			size="sm"
																			disabled={rowDisabled}
																			onClick={() =>
																				setPendingSingleDelete(file)
																			}
																			className="whitespace-nowrap"
																			title={t('duplicates.deleteThisCopy')}
																			aria-label={t(
																				'duplicates.deleteThisCopyAria',
																				{
																					name: file.name,
																				}
																			)}
																		>
																			{rowDeleting ? (
																				<ArrowPathIcon className="h-4 w-4 animate-spin" />
																			) : (
																				<TrashIcon className="h-4 w-4" />
																			)}
																			{t('duplicates.deleteOne')}
																		</DesktopAppButton>
																	)}
																</div>
															</div>
														</li>
													);
												})}
											</ul>
										</motion.div>
									);
								})}
							</div>
						</div>
					)}

					{data.potential_duplicates.length > 0 && (
						<div>
							<div className="mb-4 flex flex-wrap items-center gap-2">
								<ServerIcon className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.88)]" />
								<h3 className="text-sm font-semibold text-(--desktop-text-primary)">
									{t('duplicates.potentialSection', {
										count: data.potential_duplicates.length,
									})}
								</h3>
								<span className="text-xs text-(--desktop-text-dim)">
									{t('duplicates.potentialHint')}
								</span>
							</div>

							<div className="space-y-4">
								{data.potential_duplicates.map((group, idx) => (
									<motion.div
										key={group.size || `potential-${idx}`}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										className="rounded-(--desktop-radius-lg) border border-[color-mix(in_srgb,var(--ew-warning-500)_28%,transparent)] bg-[color-mix(in_srgb,var(--ew-warning-500)_9%,transparent)] p-4"
									>
										<div className="mb-3">
											<div className="mb-1 text-sm font-medium text-(--desktop-text-primary)">
												{t('duplicates.sameSizeCount', {
													count: group.count,
												})}
											</div>
											<div className={DESKTOP_TYPOGRAPHY.meta}>
												{t('duplicates.sizeLine', {
													size: group.size
														? formatBytes(group.size, i18n.language)
														: '—',
												})}
											</div>
										</div>

										<ul className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/40 overflow-hidden">
											{group.files.map((file) => {
												const rowDeleting = deletingFileId === file.id;
												const rowDisabled = listActionsLocked;
												return (
													<li
														key={file.id}
														className="not-last:border-b not-last:border-(--desktop-border-subtle)/70 bg-(--desktop-surface-soft)/80 p-3 transition-colors duration-150 motion-reduce:transition-none hover:bg-(--desktop-surface-soft-hover)/60"
													>
														<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
															<div className="min-w-0 flex-1">
																<div
																	className="truncate text-sm font-medium leading-snug text-(--desktop-text-primary)"
																	title={file.name}
																>
																	{file.name}
																</div>
																<div
																	className={cn(
																		DESKTOP_TYPOGRAPHY.meta,
																		'mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 tabular-nums'
																	)}
																>
																	{(file.size != null && file.size > 0) ||
																	group.size ? (
																		<span className="shrink-0">
																			{formatBytes(
																				file.size ?? group.size ?? 0,
																				i18n.language
																			)}
																		</span>
																	) : null}
																	{file.created_at ? (
																		<span className="shrink-0 text-(--desktop-text-dim)">
																			{formatDateShort(
																				file.created_at,
																				i18n.language
																			)}
																		</span>
																	) : null}
																	{file.hash ? (
																		<span className="min-w-0 font-mono text-[11px] text-(--desktop-text-muted)">
																			{t('duplicates.hashInline')}{' '}
																			{file.hash.substring(0, 16)}…
																		</span>
																	) : null}
																</div>
															</div>
															<div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
																<DesktopAppButton
																	type="button"
																	variant="neutral"
																	size="sm"
																	disabled={rowDisabled}
																	className="w-full sm:w-auto"
																	onClick={() => void openFilePreview(file)}
																	title={t('duplicates.preview')}
																	aria-label={t('duplicates.previewAria', {
																		name: file.name,
																	})}
																>
																	{previewBusyId === file.id ? (
																		<ArrowPathIcon className="h-4 w-4 animate-spin" />
																	) : (
																		<EyeIcon className="h-4 w-4" />
																	)}
																	{t('duplicates.preview')}
																</DesktopAppButton>
																<DesktopAppButton
																	type="button"
																	variant="danger"
																	size="sm"
																	disabled={rowDisabled}
																	className="w-full sm:w-auto"
																	onClick={() => setPendingSingleDelete(file)}
																	title={t('duplicates.deletePotential')}
																	aria-label={t(
																		'duplicates.deletePotentialAria',
																		{ name: file.name }
																	)}
																>
																	{rowDeleting ? (
																		<ArrowPathIcon className="h-4 w-4 animate-spin" />
																	) : (
																		<TrashIcon className="h-4 w-4" />
																	)}
																	{t('duplicates.deletePotential')}
																</DesktopAppButton>
																<DesktopAppButton
																	type="button"
																	variant="neutral"
																	size="sm"
																	disabled={rowDisabled}
																	className="w-full sm:w-auto"
																	onClick={() => {
																		if (navigator.clipboard?.writeText) {
																			void navigator.clipboard.writeText(
																				file.name
																			);
																		}
																	}}
																	title={t('duplicates.copyFileName')}
																	aria-label={t('duplicates.copyFileNameAria', {
																		name: file.name,
																	})}
																>
																	{t('duplicates.copyName')}
																</DesktopAppButton>
															</div>
														</div>
													</li>
												);
											})}
										</ul>
									</motion.div>
								))}
							</div>
						</div>
					)}
				</>
			)}

			<ConfirmDeleteModal
				isOpen={pendingSingleDelete !== null}
				onClose={() => setPendingSingleDelete(null)}
				onConfirm={executeDeleteSingle}
				title={t('duplicates.modalSingleTitle')}
				warningMessage={
					pendingSingleDelete
						? t('duplicates.confirmSingleFile', {
								name: pendingSingleDelete.name,
							})
						: ''
				}
				cancelButtonLabel={t('duplicates.modalCancel')}
				confirmButtonLabel={t('duplicates.modalConfirm')}
				confirmButtonLoadingLabel={t('duplicates.modalDeleting')}
			/>
			<ConfirmDeleteModal
				isOpen={pendingBulkDelete !== null}
				onClose={() => setPendingBulkDelete(null)}
				onConfirm={executeBulkDelete}
				title={t('duplicates.modalBulkTitle')}
				warningMessage={
					bulkDeletePreviewFiles.length > 0
						? `${t('duplicates.confirmBulkHead', {
								count: bulkDeletePreviewFiles.length,
							})}\n\n${t('duplicates.confirmBulkIrreversible')}`
						: ''
				}
				itemPreview={
					bulkDeletePreviewFiles.length > 0 ? (
						<div className="text-left">
							<p className="mb-2 text-xs text-white/60">
								{t('duplicates.confirmBulkListIntro')}
							</p>
							<ul className="max-h-36 overflow-y-auto rounded-md border border-white/10 bg-black/25 p-2 font-mono text-xs text-white/90">
								{bulkDeletePreviewFiles.slice(0, 50).map((f) => (
									<li key={f.id} className="truncate py-0.5">
										• {f.name}
									</li>
								))}
								{bulkDeletePreviewFiles.length > 50 ? (
									<li className="py-0.5 text-white/50">
										{t('duplicates.confirmMoreFiles', {
											count: bulkDeletePreviewFiles.length - 50,
										})}
									</li>
								) : null}
							</ul>
						</div>
					) : undefined
				}
				cancelButtonLabel={t('duplicates.modalCancel')}
				confirmButtonLabel={t('duplicates.modalConfirm')}
				confirmButtonLoadingLabel={t('duplicates.modalDeleting')}
			/>
			{previewTarget ? (
				<FilePreviewModal
					contentId={previewTarget.contentId}
					name={previewTarget.name}
					content_type={previewTarget.content_type}
					mime_type={previewTarget.mime_type}
					onClose={() => setPreviewTarget(null)}
				/>
			) : null}
		</div>
	);
};

export default DuplicateFinder;
