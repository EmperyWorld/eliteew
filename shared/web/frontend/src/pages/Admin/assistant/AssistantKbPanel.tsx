/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KB admin panel: summary, handbook sync, upload, text create, document list.
 *
 * Invariants:
 * - KB indexing poll state driven by parent hook; panel only displays progress.
 *
 * Related:
 * - pages/Admin/assistant/useAssistantKbAdmin.ts
 * - pages/Admin/assistant/EditKbDocument.tsx
 */
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	ClipboardDocumentIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import type { UseQueryResult } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import type {
	AssistantKbDocument,
	AssistantKbDocumentDetail,
	AssistantKbSummary,
	AssistantKbUploadLimits,
} from '../../Desktop/services/productDesktopApi';
import { FaqHighlightText } from '../../Desktop/utils/assistantFaqHighlight';
import { kbDocumentShowUpdatedAt } from '../../Desktop/utils/assistantKbSearch';
import { EditKbDocument } from './EditKbDocument';
import {
	ADMIN_FIELD,
	ADMIN_SOFT_BTN,
	KB_UPLOAD_ACCEPT,
} from './assistantAdminStyles';
import type { HandbookDryRunSnapshot } from './useAssistantKbAdmin';

type AssistantKbPanelProps = {
	kbSummaryQuery: UseQueryResult<AssistantKbSummary, Error>;
	kbUploadLimitsQuery: UseQueryResult<AssistantKbUploadLimits, Error>;
	kbDetailQuery: UseQueryResult<AssistantKbDocumentDetail, Error>;
	kbDocuments: AssistantKbDocument[];
	kbStatusOptions: string[];
	filteredKbDocuments: AssistantKbDocument[];
	isKbListLoading: boolean;
	kbJobPolling: boolean;
	handbookSyncLimit: string;
	setHandbookSyncLimit: (v: string) => void;
	handbookSyncLimitParam: number | undefined;
	lastHandbookDryRun: HandbookDryRunSnapshot | null;
	kbTitle: string;
	setKbTitle: (v: string) => void;
	kbBody: string;
	setKbBody: (v: string) => void;
	kbUploadTitle: string;
	setKbUploadTitle: (v: string) => void;
	kbUploadFiles: File[];
	onKbUploadFilesChange: (files: File[]) => void;
	editKbId: string | null;
	setEditKbId: (v: string | null) => void;
	kbListSearch: string;
	setKbListSearch: (v: string) => void;
	kbStatusFilter: string | null;
	setKbStatusFilter: React.Dispatch<React.SetStateAction<string | null>>;
	onCreateKb: (p: { title: string; body: string }) => void;
	isCreateKbPending: boolean;
	onReindexKb: (id: string) => void;
	isReindexKbPending: boolean;
	onPatchKb: (p: {
		id: string;
		patch: { title?: string; body?: string };
	}) => void;
	isPatchKbPending: boolean;
	onUploadKb: (p: { files: File[]; title?: string }) => void;
	isUploadKbPending: boolean;
	onSyncHandbookDryRun: () => void;
	isSyncHandbookDryRunPending: boolean;
	onSyncHandbook: () => void;
	isSyncHandbookPending: boolean;
	onOpenBulkModal: (kind: 'purge' | 'reindex' | 'sync-handbook') => void;
	isReindexAllKbPending: boolean;
	isPurgeKbPending: boolean;
	onRequestDeleteKb: (id: string) => void;
};

export function AssistantKbPanel({
	kbSummaryQuery,
	kbUploadLimitsQuery,
	kbDetailQuery,
	kbDocuments,
	kbStatusOptions,
	filteredKbDocuments,
	isKbListLoading,
	kbJobPolling,
	handbookSyncLimit,
	setHandbookSyncLimit,
	handbookSyncLimitParam,
	lastHandbookDryRun,
	kbTitle,
	setKbTitle,
	kbBody,
	setKbBody,
	kbUploadTitle,
	setKbUploadTitle,
	kbUploadFiles,
	onKbUploadFilesChange,
	editKbId,
	setEditKbId,
	kbListSearch,
	setKbListSearch,
	kbStatusFilter,
	setKbStatusFilter,
	onCreateKb,
	isCreateKbPending,
	onReindexKb,
	isReindexKbPending,
	onPatchKb,
	isPatchKbPending,
	onUploadKb,
	isUploadKbPending,
	onSyncHandbookDryRun,
	isSyncHandbookDryRunPending,
	onSyncHandbook,
	isSyncHandbookPending,
	onOpenBulkModal,
	isReindexAllKbPending,
	isPurgeKbPending,
	onRequestDeleteKb,
}: AssistantKbPanelProps): React.ReactElement {
	const { t, i18n } = useTranslation('desktopUi', {
		keyPrefix: 'assistantAdmin',
	});

	return (
		<div
			className={cn(
				'border border-white/10 bg-white/3 p-4 space-y-2 shadow-sm shadow-black/25',
				DESKTOP_SURFACE.radius
			)}
		>
			<div className={DESKTOP_TYPOGRAPHY.caption}>{t('ragDocsCaption')}</div>
			<p className="text-[11px] text-white/40 font-mono leading-relaxed">
				{t('kbIndexingDocHint')}
			</p>
			{kbSummaryQuery.data ? (
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-xs text-white/60 min-w-0 flex-1">
						{t('kbSummaryLine', {
							total: kbSummaryQuery.data.total,
							indexed: kbSummaryQuery.data.indexed,
							indexing: kbSummaryQuery.data.indexing,
							error: kbSummaryQuery.data.error,
							chunks: kbSummaryQuery.data.total_chunks,
						})}
						{kbSummaryQuery.data.error > 0 ? (
							<>
								{' · '}
								<button
									type="button"
									className="text-rose-300/90 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 rounded"
									onClick={() => setKbStatusFilter('error')}
								>
									{t('kbFilterErrors', {
										count: kbSummaryQuery.data.error,
									})}
								</button>
							</>
						) : null}
					</p>
					<button
						type="button"
						className={cn(
							ADMIN_SOFT_BTN,
							'shrink-0 text-white/55 hover:text-white/85 hover:bg-white/10'
						)}
						disabled={kbSummaryQuery.isFetching}
						onClick={() => void kbSummaryQuery.refetch()}
						aria-label={t('kbSummaryRefresh')}
						title={t('kbSummaryRefresh')}
					>
						<ArrowPathIcon
							className={cn(
								'h-4 w-4',
								kbSummaryQuery.isFetching && 'animate-spin'
							)}
							aria-hidden
						/>
					</button>
				</div>
			) : kbSummaryQuery.isLoading ? (
				<p className="text-xs text-white/45">{t('listLoading')}</p>
			) : kbSummaryQuery.isError ? (
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-xs text-rose-300/85 min-w-0 flex-1">
						{t('kbSummaryError')}
					</p>
					<button
						type="button"
						className={cn(
							ADMIN_SOFT_BTN,
							'shrink-0 text-white/55 hover:text-white/85 hover:bg-white/10'
						)}
						disabled={kbSummaryQuery.isFetching}
						onClick={() => void kbSummaryQuery.refetch()}
						aria-label={t('kbSummaryRefresh')}
						title={t('kbSummaryRefresh')}
					>
						<ArrowPathIcon
							className={cn(
								'h-4 w-4',
								kbSummaryQuery.isFetching && 'animate-spin'
							)}
							aria-hidden
						/>
					</button>
				</div>
			) : null}
			{(kbJobPolling || (kbSummaryQuery.data?.indexing ?? 0) > 0) && (
				<p className="flex items-center gap-2 text-xs text-sky-200/80">
					<span className="relative flex h-2 w-2 shrink-0">
						<span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400/50 opacity-75 motion-reduce:animate-none" />
						<span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400/90" />
					</span>
					{t('kbIndexingProgress', {
						count: kbSummaryQuery.data?.indexing ?? 0,
					})}
				</p>
			)}
			{kbUploadLimitsQuery.data ? (
				<p className="text-xs text-white/50">
					{t('kbBulkMaxHint', {
						max: kbUploadLimitsQuery.data.max_files,
						mb: Math.round(
							kbUploadLimitsQuery.data.max_bytes_per_file / (1024 * 1024)
						),
					})}
				</p>
			) : null}
			<label className="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
				<span>{t('syncHandbookLimitLabel')}</span>
				<input
					type="number"
					min={1}
					max={500}
					value={handbookSyncLimit}
					onChange={(e) => setHandbookSyncLimit(e.target.value)}
					placeholder={t('syncHandbookLimitPlaceholder')}
					className={cn(
						'w-20 rounded-md border border-white/15 bg-black/30 px-2 py-1',
						'text-white/90 placeholder:text-white/35',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40'
					)}
					aria-label={t('syncHandbookLimitLabel')}
				/>
				{handbookSyncLimit.trim() ? (
					<button
						type="button"
						className={cn(
							'inline-flex items-center rounded-md border border-white/15 px-1.5 py-0.5',
							'text-white/55 hover:bg-white/10',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40'
						)}
						onClick={() => setHandbookSyncLimit('')}
						aria-label={t('syncHandbookLimitReset')}
						title={t('syncHandbookLimitReset')}
					>
						<XMarkIcon className="h-3.5 w-3.5" aria-hidden />
					</button>
				) : null}
			</label>
			<p className="mb-2 text-[11px] leading-snug text-white/40">
				{t('syncHandbookLimitHint')}
				{lastHandbookDryRun
					? ` ${t('syncHandbookLastDryRunFilesHint', {
							files: lastHandbookDryRun.files,
						})}`
					: ''}
			</p>
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					disabled={
						isSyncHandbookDryRunPending || isSyncHandbookPending || kbJobPolling
					}
					onClick={onSyncHandbookDryRun}
					title={
						lastHandbookDryRun
							? t('syncHandbookDryRunButtonLast', {
									files: lastHandbookDryRun.files,
								})
							: t('syncHandbookDryRunButton')
					}
					className={cn(
						'px-3 py-1.5 text-xs text-white',
						DESKTOP_SURFACE.radius,
						DESKTOP_INTERACTIVE.btnRounded,
						'border border-white/15 bg-white/6 hover:bg-white/12',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
						'disabled:opacity-50'
					)}
				>
					{isSyncHandbookDryRunPending ? (
						<ArrowPathIcon className="w-4 h-4 animate-spin inline" />
					) : (
						t('syncHandbookDryRunButton')
					)}
				</button>
				<button
					type="button"
					disabled={isSyncHandbookPending || kbJobPolling}
					onClick={() => {
						if (handbookSyncLimitParam != null) {
							onSyncHandbook();
							return;
						}
						onOpenBulkModal('sync-handbook');
					}}
					className={cn(
						'px-3 py-1.5 text-xs text-white',
						DESKTOP_SURFACE.radius,
						DESKTOP_INTERACTIVE.btnRounded,
						'border border-white/15 bg-emerald-900/40 hover:bg-emerald-800/50',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40',
						'disabled:opacity-50'
					)}
				>
					{isSyncHandbookPending ? (
						<ArrowPathIcon className="w-4 h-4 animate-spin inline" />
					) : (
						t('syncHandbookButton')
					)}
				</button>
				<button
					type="button"
					disabled={isReindexAllKbPending || isKbListLoading}
					onClick={() => onOpenBulkModal('reindex')}
					className={cn(
						'px-3 py-1.5 text-xs text-white',
						DESKTOP_SURFACE.radius,
						DESKTOP_INTERACTIVE.btnRounded,
						'border border-white/15 bg-white/8 hover:bg-white/14',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
						'disabled:opacity-50'
					)}
				>
					{t('reindexAllButton')}
				</button>
				<button
					type="button"
					disabled={isPurgeKbPending}
					onClick={() => onOpenBulkModal('purge')}
					className={cn(
						'px-3 py-1.5 text-xs text-rose-100',
						DESKTOP_SURFACE.radius,
						DESKTOP_INTERACTIVE.btnRounded,
						'border border-rose-500/35 bg-rose-950/40 hover:bg-rose-900/45',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/35',
						'disabled:opacity-50'
					)}
				>
					{t('purgeKbButton')}
				</button>
			</div>
			{lastHandbookDryRun ? (
				<div className="mb-2 flex flex-wrap items-center gap-2">
					<p
						className="min-w-0 flex-1 break-all font-mono text-[11px] leading-snug text-white/45"
						title={lastHandbookDryRun.dir}
					>
						{t('syncHandbookLastDryRun', {
							files: lastHandbookDryRun.files,
							dir: lastHandbookDryRun.dir,
							limitPart:
								lastHandbookDryRun.limit != null
									? t('syncHandbookLastDryRunLimitPart', {
											limit: lastHandbookDryRun.limit,
										})
									: '',
						})}
					</p>
					<button
						type="button"
						className={cn(
							'shrink-0 px-2 py-0.5 text-[11px] text-white/60',
							DESKTOP_SURFACE.radius,
							'border border-white/15 hover:bg-white/10',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40'
						)}
						onClick={() => {
							void navigator.clipboard
								.writeText(lastHandbookDryRun.dir)
								.then(() => toast.success(t('syncHandbookCopyDirDone')))
								.catch(() => toast.error(t('toastError')));
						}}
					>
						{t('syncHandbookCopyDir')}
					</button>
				</div>
			) : null}
			<div className="space-y-2 rounded border border-white/10 p-3">
				<div className="text-xs text-white/55">{t('kbUploadCaption')}</div>
				<input
					type="text"
					value={kbUploadTitle}
					onChange={(e) => setKbUploadTitle(e.target.value)}
					placeholder={t('kbUploadTitlePlaceholder')}
					disabled={kbUploadFiles.length > 1}
					title={
						kbUploadFiles.length > 1
							? t('kbUploadTitleDisabledHint')
							: undefined
					}
					className={cn('w-full', ADMIN_FIELD)}
				/>
				<input
					type="file"
					multiple
					accept={KB_UPLOAD_ACCEPT}
					aria-label={t('kbUploadFileAria')}
					onChange={(e) => {
						const list = e.target.files;
						const arr = list ? Array.from(list) : [];
						onKbUploadFilesChange(arr);
						e.target.value = '';
					}}
					className={cn(
						'block w-full text-sm text-white/80 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white'
					)}
				/>
				{kbUploadFiles.length > 0 ? (
					<div className="text-xs text-white/50 space-y-1">
						<p>{t('kbSelectedFilesCount', { count: kbUploadFiles.length })}</p>
						<ul className="max-h-24 overflow-y-auto rounded border border-white/10 bg-black/20 px-2 py-1 space-y-0.5">
							{kbUploadFiles.map((f) => (
								<li key={`${f.name}-${f.size}`} className="truncate">
									{f.name}
								</li>
							))}
						</ul>
					</div>
				) : null}
				<button
					type="button"
					disabled={kbUploadFiles.length === 0 || isUploadKbPending}
					onClick={() => {
						if (kbUploadFiles.length === 0) return;
						onUploadKb({
							files: kbUploadFiles,
							title: kbUploadTitle.trim() || undefined,
						});
					}}
					className={cn(
						'px-4 py-2 text-sm text-white',
						DESKTOP_SURFACE.radius,
						DESKTOP_INTERACTIVE.btnRounded,
						'bg-sky-700/80 hover:bg-sky-600 disabled:opacity-50',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/45'
					)}
				>
					{isUploadKbPending ? (
						<ArrowPathIcon className="w-4 h-4 animate-spin inline" />
					) : (
						t('uploadKb')
					)}
				</button>
			</div>
			<div className="text-xs text-white/45 pt-2">
				{t('kbTextBlockCaption')}
			</div>
			<input
				type="text"
				value={kbTitle}
				onChange={(e) => setKbTitle(e.target.value)}
				placeholder={t('kbTitlePlaceholder')}
				className={cn('w-full', ADMIN_FIELD)}
			/>
			<textarea
				value={kbBody}
				onChange={(e) => setKbBody(e.target.value)}
				placeholder={t('kbBodyPlaceholder')}
				rows={5}
				className={cn('w-full', ADMIN_FIELD)}
			/>
			<button
				type="button"
				disabled={!kbTitle.trim() || !kbBody.trim() || isCreateKbPending}
				onClick={() =>
					onCreateKb({ title: kbTitle.trim(), body: kbBody.trim() })
				}
				className={cn(
					'px-4 py-2 text-sm text-white',
					DESKTOP_SURFACE.radius,
					DESKTOP_INTERACTIVE.btnRounded,
					'bg-indigo-700/80 hover:bg-indigo-600 disabled:opacity-50',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/45'
				)}
			>
				{isCreateKbPending ? (
					<ArrowPathIcon className="w-4 h-4 animate-spin inline" />
				) : (
					t('addKb')
				)}
			</button>
			{kbDocuments.length > 0 ? (
				<div className="mt-3 space-y-2">
					<div className="relative max-w-md">
						<input
							type="search"
							value={kbListSearch}
							onChange={(e) => setKbListSearch(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Escape') {
									e.preventDefault();
									setKbListSearch('');
								}
							}}
							placeholder={t('kbListSearchPlaceholder')}
							aria-label={t('kbListSearchPlaceholder')}
							className={cn('w-full', ADMIN_FIELD, kbListSearch ? 'pr-9' : '')}
						/>
						{kbListSearch ? (
							<button
								type="button"
								className={cn(
									'absolute right-2 top-1/2 -translate-y-1/2 rounded p-1',
									'text-white/50 hover:text-white/85 hover:bg-white/10',
									'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45'
								)}
								onClick={() => setKbListSearch('')}
								aria-label={t('kbListSearchClear')}
								title={t('kbListSearchClear')}
							>
								<XMarkIcon className="h-4 w-4" aria-hidden />
							</button>
						) : null}
					</div>
					{kbStatusOptions.length > 1 ? (
						<div className="flex flex-wrap gap-1.5">
							<button
								type="button"
								className={cn(
									'rounded px-2 py-0.5 text-xs border',
									kbStatusFilter === null
										? 'border-violet-400/50 bg-violet-500/15 text-white/90'
										: 'border-white/15 text-white/55 hover:bg-white/10'
								)}
								onClick={() => setKbStatusFilter(null)}
							>
								{t('kbStatusFilterAll')}
							</button>
							{kbStatusOptions.map((st) => (
								<button
									key={st}
									type="button"
									className={cn(
										'rounded px-2 py-0.5 text-xs border',
										kbStatusFilter === st
											? 'border-violet-400/50 bg-violet-500/15 text-white/90'
											: 'border-white/15 text-white/55 hover:bg-white/10'
									)}
									onClick={() =>
										setKbStatusFilter((prev) => (prev === st ? null : st))
									}
								>
									{st}
								</button>
							))}
						</div>
					) : null}
					{kbListSearch.trim() || kbStatusFilter ? (
						<p className="text-xs text-white/50">
							{t('kbListSearchCount', {
								count: filteredKbDocuments.length,
								total: kbDocuments.length,
							})}
						</p>
					) : null}
				</div>
			) : null}
			{isKbListLoading && (
				<div
					className="flex items-center gap-2 text-sm text-white/55"
					aria-busy="true"
					aria-live="polite"
				>
					<ArrowPathIcon
						className="w-5 h-5 shrink-0 animate-spin text-white/50"
						aria-hidden
					/>
					<span>{t('listLoading')}</span>
				</div>
			)}
			<ul className="space-y-2 mt-2">
				{filteredKbDocuments.map((doc) => (
					<li
						key={doc.id}
						className={cn(
							'flex flex-col gap-2 rounded border border-white/10 px-3 py-2 text-sm',
							'shadow-sm shadow-black/15 transition-[border-color,box-shadow] duration-200',
							'hover:border-white/18 hover:shadow-md hover:shadow-black/20'
						)}
					>
						{editKbId === doc.id ? (
							kbDetailQuery.isLoading ? (
								<div className="flex items-center gap-2 text-white/60">
									<ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden />
									<span>{t('kbEditLoading')}</span>
								</div>
							) : kbDetailQuery.data ? (
								<EditKbDocument
									entry={kbDetailQuery.data}
									onCancel={() => setEditKbId(null)}
									onSave={(patch) =>
										onPatchKb({
											id: doc.id,
											patch: {
												title: patch.title,
												body: patch.body,
											},
										})
									}
									saving={isPatchKbPending}
								/>
							) : (
								<div className="flex flex-wrap items-center gap-2">
									<p className="text-rose-300/90 text-xs">
										{t('kbEditLoadError')}
									</p>
									<button
										type="button"
										className="text-xs text-white/70 rounded-md px-2 py-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
										onClick={() => setEditKbId(null)}
									>
										{t('cancel')}
									</button>
								</div>
							)
						) : (
							<>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span className="text-white/90 truncate min-w-0">
										{kbListSearch.trim() ? (
											<FaqHighlightText text={doc.title} query={kbListSearch} />
										) : (
											doc.title
										)}
									</span>
									<span className="text-white/45 text-xs shrink-0">
										{doc.status} · {doc.chunk_count} {t('chunks')}
									</span>
								</div>
								<p className="text-[11px] text-white/35 w-full tabular-nums">
									{t('kbUploadedAt')}:{' '}
									{new Date(doc.created_at).toLocaleString(i18n.language, {
										dateStyle: 'short',
										timeStyle: 'short',
									})}
								</p>
								{kbDocumentShowUpdatedAt(doc) ? (
									<p className="text-[11px] text-white/35 w-full tabular-nums">
										{t('kbUpdatedAt')}:{' '}
										{new Date(doc.updated_at).toLocaleString(i18n.language, {
											dateStyle: 'short',
											timeStyle: 'short',
										})}
									</p>
								) : null}
								{doc.source_filename ? (
									<p className="text-xs text-white/40 w-full">
										{t('kbSourceFile')}:{' '}
										{kbListSearch.trim() ? (
											<FaqHighlightText
												text={doc.source_filename}
												query={kbListSearch}
											/>
										) : (
											doc.source_filename
										)}
										{doc.source_mime ? ` (${doc.source_mime})` : ''}
									</p>
								) : null}
								{doc.status === 'error' && doc.last_error ? (
									<div className="flex flex-wrap items-start gap-2 w-full">
										<p className="text-xs text-rose-300/85 min-w-0 flex-1 whitespace-pre-wrap break-words">
											<span className="font-medium text-rose-200/90">
												{t('kbLastError')}:{' '}
											</span>
											{kbListSearch.trim() ? (
												<FaqHighlightText
													text={doc.last_error}
													query={kbListSearch}
												/>
											) : (
												doc.last_error
											)}
										</p>
										<button
											type="button"
											className={cn(
												ADMIN_SOFT_BTN,
												'shrink-0 text-white/60 hover:text-white/90 hover:bg-white/10'
											)}
											onClick={() => {
												void navigator.clipboard
													.writeText(doc.last_error ?? '')
													.then(() => toast.success(t('kbCopyErrorDone')))
													.catch(() => toast.error(t('toastError')));
											}}
											title={t('kbCopyError')}
											aria-label={t('kbCopyError')}
										>
											<ClipboardDocumentIcon
												className="h-3.5 w-3.5"
												aria-hidden
											/>
										</button>
									</div>
								) : null}
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										className={cn(
											ADMIN_SOFT_BTN,
											'text-cyan-300 hover:bg-white/10'
										)}
										disabled={isReindexKbPending}
										onClick={() => setEditKbId(doc.id)}
									>
										{t('editKb')}
									</button>
									<button
										type="button"
										className={cn(
											ADMIN_SOFT_BTN,
											'text-violet-300 hover:bg-white/10'
										)}
										disabled={isReindexKbPending}
										onClick={() => onReindexKb(doc.id)}
									>
										{t('reindex')}
									</button>
									<button
										type="button"
										className={cn(
											ADMIN_SOFT_BTN,
											'text-rose-400 hover:bg-rose-500/10 focus-visible:ring-rose-400/35'
										)}
										onClick={() => onRequestDeleteKb(doc.id)}
									>
										{t('deleteDoc')}
									</button>
								</div>
							</>
						)}
						{doc.last_error ? (
							<p className="w-full text-xs text-rose-300/90">
								{doc.last_error}
							</p>
						) : null}
					</li>
				))}
			</ul>
			{!isKbListLoading &&
			kbDocuments.length > 0 &&
			filteredKbDocuments.length === 0 ? (
				<p className="text-sm text-white/50 py-2 mt-2">
					{t('kbListSearchEmpty')}
				</p>
			) : null}
		</div>
	);
}
