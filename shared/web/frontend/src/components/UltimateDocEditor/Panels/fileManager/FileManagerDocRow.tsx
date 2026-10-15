/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Memoized document row for File Manager (compact and comfortable layouts).
 *
 * Invariants:
 * - Preview falls back to stripHtmlPreview when API preview_text is absent.
 *
 * Related:
 * - fileManagerConstants.ts, fileManagerTypes.ts
 * - documentation/product/ULTIMATE-DOC-EDITOR-FILE-MANAGER.md
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	CalendarIcon,
	CheckIcon,
	DocumentTextIcon,
	SparklesIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppStatusBadge,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { stripHtmlPreview } from './fileManagerConstants';
import type { FileManagerDocRowProps } from './fileManagerTypes';

export const FileManagerDocRow = React.memo(function FileManagerDocRow({
	doc,
	currentDocument,
	isSelected,
	compact,
	onToggleSelectId,
	onOpenDocument,
	onAskAi,
	onDeleteClick,
	formatRelativeDate,
	displayWordCount,
	title,
	onContextMenuRow,
}: FileManagerDocRowProps) {
	const { t } = useTranslation('ultimateDocEditor');
	const isCurrent = currentDocument?.id === doc.id;
	const preview = useMemo(() => {
		const fromApi = doc.preview_text?.trim();
		if (fromApi) {
			return fromApi;
		}
		return doc.content ? stripHtmlPreview(doc.content, compact ? 80 : 120) : '';
	}, [doc.preview_text, doc.content, compact]);

	const handleToggleSelect = useCallback(() => {
		onToggleSelectId(doc.id);
	}, [onToggleSelectId, doc.id]);

	const handleOpen = useCallback(() => {
		onOpenDocument(doc);
	}, [onOpenDocument, doc]);

	const handleAskAi = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onAskAi?.(doc);
		},
		[onAskAi, doc]
	);

	const handleDeletePress = useCallback(() => {
		onDeleteClick(doc.id);
	}, [onDeleteClick, doc.id]);

	const rowClass = cn(
		`rounded-lg border transition-colors ${
			isCurrent
				? 'border-emerald-400/40 bg-emerald-500/15'
				: isSelected
					? 'border-emerald-400/35 bg-emerald-500/10 ring-1 ring-emerald-400/25'
					: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover)'
		}`
	);

	if (compact) {
		return (
			// biome-ignore lint/a11y/noStaticElementInteractions: context menu target for file row
			<div className={rowClass} onContextMenu={onContextMenuRow}>
				<div className="flex min-w-0 items-center gap-0.5 p-1">
					<label
						htmlFor={`file-manager-doc-${doc.id}`}
						className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-muted) transition-colors hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover) has-focus-visible:ring-2 has-focus-visible:ring-emerald-500/40 has-disabled:cursor-not-allowed has-disabled:opacity-50"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						<input
							id={`file-manager-doc-${doc.id}`}
							type="checkbox"
							checked={isSelected}
							onChange={handleToggleSelect}
							aria-label={t('fileManager.selectDocAria', {
								title: title || t('header.untitled'),
							})}
							className="peer sr-only"
						/>
						<span className="flex items-center justify-center peer-disabled:opacity-50">
							{isSelected ? (
								<CheckIcon
									width={14}
									height={14}
									className="text-emerald-300"
									aria-hidden
								/>
							) : (
								<span className="size-3 rounded-sm border border-(--desktop-border-strong)" />
							)}
						</span>
					</label>
					<button
						type="button"
						onClick={handleOpen}
						className="min-w-0 flex-1 cursor-pointer rounded-md py-0.5 pl-0.5 pr-1 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/30"
					>
						<div className="flex min-w-0 items-center gap-1.5">
							<DocumentTextIcon
								width={14}
								height={14}
								className={`shrink-0 ${isCurrent ? 'text-emerald-400' : 'text-white/50'}`}
							/>
							<span
								className="min-w-0 flex-1 truncate text-xs font-medium text-(--desktop-text-primary)"
								title={title}
							>
								{title}
							</span>
							{isCurrent ? (
								<DesktopAppStatusBadge className="shrink-0 border-emerald-400/30 bg-emerald-500/25 px-1.5 py-0 text-[10px] text-emerald-200">
									{t('fileManager.openBadge')}
								</DesktopAppStatusBadge>
							) : null}
						</div>
						<div className="mt-0.5 pl-5 text-[10px] text-(--desktop-text-dim)">
							<span>{formatRelativeDate(doc.updated_at)}</span>
							<span className="mx-1 text-(--desktop-border-strong)">·</span>
							<span>
								{t('fileManager.wordsCount', { count: displayWordCount })}
							</span>
						</div>
					</button>
					{onAskAi ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0 text-purple-300/90 hover:bg-purple-500/15 hover:text-purple-200"
							title={t('fileManager.askAiTitle')}
							aria-label={t('fileManager.askAiTitle')}
							onClick={handleAskAi}
						>
							<SparklesIcon width={15} height={15} aria-hidden />
						</DesktopAppButton>
					) : null}
					{!isCurrent ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0 text-(--desktop-text-muted) hover:bg-red-500/10 hover:text-red-200"
							title={t('fileManager.delete')}
							aria-label={t('fileManager.delete')}
							onClick={(e) => {
								e.stopPropagation();
								handleDeletePress();
							}}
						>
							<TrashIcon width={14} height={14} aria-hidden />
						</DesktopAppButton>
					) : null}
				</div>
			</div>
		);
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: context menu target for file row
		<div className={rowClass} onContextMenu={onContextMenuRow}>
			<div className="flex min-w-0 items-stretch gap-1.5 p-1.5 pr-2">
				<label
					htmlFor={`file-manager-doc-${doc.id}`}
					className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) text-(--desktop-text-muted) transition-colors hover:border-(--desktop-border-strong) hover:bg-(--desktop-surface-soft-hover) has-focus-visible:ring-2 has-focus-visible:ring-emerald-500/40 has-disabled:cursor-not-allowed has-disabled:opacity-50"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
				>
					<input
						id={`file-manager-doc-${doc.id}`}
						type="checkbox"
						checked={isSelected}
						onChange={handleToggleSelect}
						aria-label={t('fileManager.selectDocAria', {
							title: title || t('header.untitled'),
						})}
						className="peer sr-only"
					/>
					<span className="flex items-center justify-center peer-disabled:opacity-50">
						{isSelected ? (
							<CheckIcon
								width={16}
								height={16}
								className="text-emerald-300"
								aria-hidden
							/>
						) : (
							<span className="size-3.5 rounded-sm border border-(--desktop-border-strong)" />
						)}
					</span>
				</label>
				<button
					type="button"
					onClick={handleOpen}
					className="min-w-0 flex-1 cursor-pointer rounded-md py-1.5 pl-1 pr-2 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500/30"
				>
					<div className="flex min-w-0 items-start justify-between gap-2">
						<div className="flex min-w-0 flex-1 items-center gap-2">
							<DocumentTextIcon
								width={16}
								height={16}
								className={`shrink-0 ${isCurrent ? 'text-emerald-400' : 'text-white/50'}`}
							/>
							<h4
								className="min-w-0 flex-1 truncate text-sm font-medium text-(--desktop-text-primary)"
								title={title}
							>
								{title}
							</h4>
						</div>
						{isCurrent && (
							<DesktopAppStatusBadge className="shrink-0 border-emerald-400/30 bg-emerald-500/25 text-emerald-200">
								{t('fileManager.openBadge')}
							</DesktopAppStatusBadge>
						)}
					</div>

					{onAskAi ? (
						<div className="mt-1 flex justify-end">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 gap-1 px-2 text-[11px] text-purple-300/90 hover:bg-purple-500/15 hover:text-purple-200"
								title={t('fileManager.askAiTitle')}
								aria-label={t('fileManager.askAiTitle')}
								onClick={handleAskAi}
							>
								<SparklesIcon width={14} height={14} aria-hidden />
								{t('fileManager.askAi')}
							</DesktopAppButton>
						</div>
					) : null}

					{preview ? (
						<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'mb-1.5 line-clamp-2')}>
							{preview}
						</div>
					) : null}

					<div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-(--desktop-text-dim)">
						<div className="flex items-center gap-1">
							<CalendarIcon width={12} height={12} />
							<span>{formatRelativeDate(doc.updated_at)}</span>
						</div>
						<div className="flex items-center gap-1">
							<span>
								{t('fileManager.wordsCount', { count: displayWordCount })}
							</span>
						</div>
						{doc.tags && doc.tags.length > 0 && (
							<div className="flex items-center gap-1">
								<span className="rounded border border-(--desktop-border-subtle) bg-(--desktop-surface-soft-hover) px-1.5 py-0.5 text-xs text-(--desktop-text-secondary)">
									{doc.tags[0]}
								</span>
								{doc.tags.length > 1 && (
									<span className="text-white/40">+{doc.tags.length - 1}</span>
								)}
							</div>
						)}
					</div>
				</button>
			</div>

			{!isCurrent && (
				<div className="min-w-0 px-2 pb-2 pt-0">
					<DesktopAppButton
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							handleDeletePress();
						}}
						variant="ghost"
						size="sm"
						className="w-full text-(--desktop-text-muted) hover:bg-red-500/10 hover:text-red-200"
					>
						<TrashIcon width={12} height={12} />
						{t('fileManager.delete')}
					</DesktopAppButton>
				</div>
			)}
		</div>
	);
});

FileManagerDocRow.displayName = 'FileManagerDocRow';
