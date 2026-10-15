/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * File Manager side panel UI for Ultimate Doc Editor; composes hook and row subpanels.
 *
 * Invariants:
 * - VirtualVariableList threshold VIRTUAL_LIST_MIN unchanged.
 * - Lazy FileLibraryPanel + PaperlessPicker prefetch via useFileManagerPanel.
 * - Section / sort meta stays sentence-case (DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS).
 *
 * Related:
 * - useFileManagerPanel.ts, fileManagerChrome.ts, Panels/FileManagerPanel.tsx (facade)
 * - documentation/product/ULTIMATE-DOC-EDITOR-FILE-MANAGER.md
 */

import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import {
	DESKTOP_OVERLAY,
	DESKTOP_PORTAL_STACK_BUMP,
} from '@/pages/Desktop/constants';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	Bars3BottomLeftIcon,
	Bars3Icon,
	BarsArrowDownIcon,
	BarsArrowUpIcon,
	BuildingLibraryIcon,
	ClockIcon,
	DocumentTextIcon,
	ExclamationCircleIcon,
	FolderOpenIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import * as React from 'react';
import { useCallback } from 'react';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopAppPanel,
} from '../../../../pages/Desktop/components/DesktopAppChrome';
import { VirtualVariableList } from '../../../shared/VirtualList';
import { RuntimeTextPromptDialog } from '../../components/dialogs/RuntimeTextPromptDialog';
import { FileManagerDocContextMenu } from '../FileManagerDocContextMenu';
import { FileManagerDocRow } from './FileManagerDocRow';
import { FileManagerRecentDocRow } from './FileManagerRecentDocRow';
import {
	DOC_EDITOR_FILE_MANAGER_ACTIONS_CLASS,
	DOC_EDITOR_FILE_MANAGER_FOOTER_CLASS,
	DOC_EDITOR_FILE_MANAGER_HEADER_CLASS,
	DOC_EDITOR_FILE_MANAGER_HEADER_ICON_CLASS,
	DOC_EDITOR_FILE_MANAGER_HINT_CLASS,
	DOC_EDITOR_FILE_MANAGER_LIST_CLASS,
	DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS,
	DOC_EDITOR_FILE_MANAGER_RECENT_CARD_CLASS,
	DOC_EDITOR_FILE_MANAGER_SHELL_CLASS,
	DOC_EDITOR_FILE_MANAGER_SORT_CLASS,
	DOC_EDITOR_FILE_MANAGER_TITLE_CLASS,
} from './fileManagerChrome';
import {
	FILE_MANAGER_SORT_FIELDS,
	loadFileLibraryPanel,
	loadPaperlessPickerPanel,
	VIRTUAL_LIST_MIN,
} from './fileManagerConstants';
import type { FileManagerPanelProps } from './fileManagerTypes';
import { useFileManagerPanel } from './useFileManagerPanel';
import type { UltimateDocument } from '../../types/editor.types';

const FileLibraryPanelLazy = React.lazy(() =>
	loadFileLibraryPanel().then((m) => ({ default: m.FileLibraryPanel }))
);
const PaperlessPickerPanelLazy = React.lazy(() =>
	loadPaperlessPickerPanel().then((m) => ({ default: m.PaperlessPickerPanel }))
);

export const FileManagerPanel: React.FC<FileManagerPanelProps> = (props) => {
	const { isOpen, onClose, onOpenImport } = props;
	const docSidePanelZ = useDocEditorSidePanelZIndex();
	const vm = useFileManagerPanel(props);
	const {
		t,
		documents,
		documentsTotal,
		currentDocument,
		isLoading,
		isLoadingMoreDocuments,
		error,
		searchInput,
		setSearchInput,
		sortField,
		sortOrder,
		showDeleteConfirm,
		showCreateDialog,
		setShowCreateDialog,
		showLibraryPanel,
		showPaperlessPanel,
		selectedDocumentIds,
		docContextMenu,
		setDocContextMenu,
		listScrollRef,
		listHeight,
		fileManagerListCompact,
		setFileManagerListCompact,
		openAIPanelWithFileFromList,
		estimateMainListRowHeight,
		sortedDocuments,
		recentDocs,
		hasSearch,
		mainListDocuments,
		toggleSort,
		openLibraryPanel,
		openPaperlessPanel,
		closePaperlessPanel,
		closeLibraryPanel,
		handleCreateNew,
		handleCreateDocumentSubmit,
		handleLibraryFileSelect,
		handlePaperlessImport,
		handleSelectDocument,
		handleDeleteDocumentById,
		toggleDocumentSelection,
		handleDeleteClickId,
		handleDocumentContextMenu,
		cancelDeleteConfirm,
		handleLoadMore,
		pendingDeleteTitle,
		handleAskAiFromRow,
		formatRelativeDate,
		showLoadMore,
	} = vm;

	const renderDocRow = useCallback(
		(doc: UltimateDocument): React.ReactNode => {
			const isSelected = selectedDocumentIds.includes(doc.id);
			const title = doc.title || t('header.untitled');
			const displayWordCount =
				currentDocument?.id === doc.id
					? currentDocument.word_count
					: doc.word_count;

			return (
				<FileManagerDocRow
					doc={doc}
					currentDocument={currentDocument}
					isSelected={isSelected}
					compact={fileManagerListCompact}
					onToggleSelectId={toggleDocumentSelection}
					onOpenDocument={handleSelectDocument}
					onAskAi={handleAskAiFromRow}
					onDeleteClick={handleDeleteClickId}
					formatRelativeDate={formatRelativeDate}
					displayWordCount={displayWordCount ?? 0}
					title={title}
					onContextMenuRow={(e) => handleDocumentContextMenu(e, doc)}
				/>
			);
		},
		[
			selectedDocumentIds,
			currentDocument,
			fileManagerListCompact,
			t,
			formatRelativeDate,
			toggleDocumentSelection,
			handleSelectDocument,
			handleAskAiFromRow,
			handleDeleteClickId,
			handleDocumentContextMenu,
		]
	);

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			role="dialog"
			aria-modal="true"
			aria-labelledby="file-manager-panel-title"
			initial={{ opacity: 0, x: 100 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 100 }}
			transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] as const }}
			className={DOC_EDITOR_FILE_MANAGER_SHELL_CLASS}
			style={{ zIndex: docSidePanelZ }}
		>
			<div className={DOC_EDITOR_FILE_MANAGER_HEADER_CLASS}>
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<div className={DOC_EDITOR_FILE_MANAGER_HEADER_ICON_CLASS}>
							<FolderOpenIcon width={16} height={16} aria-hidden />
						</div>
						<h3
							id="file-manager-panel-title"
							className={DOC_EDITOR_FILE_MANAGER_TITLE_CLASS}
						>
							{t('fileManager.title')}
						</h3>
					</div>
					<div className="flex shrink-0 items-center gap-0.5">
						<DesktopAppButton
							type="button"
							variant={fileManagerListCompact ? 'accent' : 'ghost'}
							size="icon"
							className="h-8 w-8"
							title={
								fileManagerListCompact
									? t('fileManager.comfortableMode')
									: t('fileManager.compactMode')
							}
							aria-label={
								fileManagerListCompact
									? t('fileManager.comfortableModeAria')
									: t('fileManager.compactModeAria')
							}
							aria-pressed={fileManagerListCompact}
							onClick={() => setFileManagerListCompact(!fileManagerListCompact)}
						>
							{fileManagerListCompact ? (
								<Bars3BottomLeftIcon width={16} height={16} aria-hidden />
							) : (
								<Bars3Icon width={16} height={16} aria-hidden />
							)}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							onClick={onClose}
							variant="ghost"
							size="icon"
							className="h-8 w-8 shrink-0"
							title={t('fileManager.close')}
							aria-label={t('fileManager.closeAria')}
						>
							<XMarkIcon width={17} height={17} />
						</DesktopAppButton>
					</div>
				</div>
			</div>

			<div className={DOC_EDITOR_FILE_MANAGER_ACTIONS_CLASS}>
				<DesktopAppButton
					type="button"
					onClick={handleCreateNew}
					variant="accent"
					className="w-full min-w-0 py-2 text-sm"
				>
					<PlusIcon width={17} height={17} />
					{t('fileManager.createDoc')}
				</DesktopAppButton>
				<div className="grid min-w-0 grid-cols-2 gap-2">
					<DesktopAppButton
						type="button"
						onClick={openLibraryPanel}
						onMouseEnter={() => void loadFileLibraryPanel()}
						variant="neutral"
						className="min-w-0 text-sm"
						title={t('fileManager.fromLibraryTitle')}
					>
						<BuildingLibraryIcon width={15} height={15} />
						{t('fileManager.fromLibrary')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						onClick={openPaperlessPanel}
						onMouseEnter={() => void loadPaperlessPickerPanel()}
						variant="neutral"
						className="min-w-0 text-sm"
						title={t(
							'fileManager.fromPaperlessTitle',
							'Import from Paperless archive'
						)}
					>
						<DocumentTextIcon width={15} height={15} />
						{t('fileManager.fromPaperless', 'Paperless')}
					</DesktopAppButton>
				</div>
				<DesktopAppButton
					type="button"
					onClick={onOpenImport}
					variant="neutral"
					className="w-full min-w-0 text-sm"
					title={t('fileManager.importTitle')}
				>
					<PlusIcon width={15} height={15} />
					{t('fileManager.importFile', 'Import file')}
				</DesktopAppButton>
				<p className={DOC_EDITOR_FILE_MANAGER_HINT_CLASS}>
					{t('fileManager.hintLibraryVsImport')}
				</p>
			</div>

			<div className={DOC_EDITOR_FILE_MANAGER_SORT_CLASS}>
				<div className="relative min-w-0">
					<MagnifyingGlassIcon
						className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-(--desktop-text-dim)"
						width={15}
						height={15}
					/>
					<DesktopAppInput
						type="text"
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder={t('fileManager.searchPlaceholder')}
						className="min-w-0 w-full py-1.5 pl-8 pr-2 text-sm"
					/>
				</div>
				<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
					<span
						className={cn('shrink-0', DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS)}
					>
						{t('fileManager.sortLabel')}
					</span>
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
						{FILE_MANAGER_SORT_FIELDS.map(({ field, labelKey, icon: Icon }) => (
							<DesktopAppButton
								key={field}
								type="button"
								onClick={() => toggleSort(field)}
								size="sm"
								variant={sortField === field ? 'accent' : 'neutral'}
								active={sortField === field}
								className="h-7 gap-1 px-2 text-[11px]"
							>
								<Icon width={11} height={11} />
								{t(labelKey)}
								{sortField === field &&
									(sortOrder === 'asc' ? (
										<BarsArrowUpIcon width={10} height={10} />
									) : (
										<BarsArrowDownIcon width={10} height={10} />
									))}
							</DesktopAppButton>
						))}
					</div>
				</div>
			</div>

			{error && (
				<motion.div
					role="alert"
					aria-live="polite"
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="mx-3 mt-2 flex shrink-0 items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/15 p-2.5 text-sm leading-relaxed text-red-200"
				>
					<ExclamationCircleIcon
						width={16}
						height={16}
						className="mt-0.5 shrink-0"
						aria-hidden
					/>
					<span className="min-w-0 flex-1">{error}</span>
				</motion.div>
			)}

			<div ref={listScrollRef} className={DOC_EDITOR_FILE_MANAGER_LIST_CLASS}>
				{isLoading ? (
					<DesktopAppEmptyState
						icon={
							<ArrowPathIcon
								width={40}
								height={40}
								className="mb-3 animate-spin text-emerald-400/80 motion-reduce:animate-none motion-reduce:opacity-80"
							/>
						}
						title={t('fileManager.loadingTitle')}
						description={t('fileManager.loadingDesc')}
						className="py-16"
					/>
				) : sortedDocuments.length > 0 ? (
					<div className="space-y-2">
						{recentDocs.length > 0 && !hasSearch && (
							<div className={DOC_EDITOR_FILE_MANAGER_RECENT_CARD_CLASS}>
								<div className="mb-1.5 flex items-center gap-1.5">
									<ClockIcon
										width={12}
										height={12}
										className="text-(--desktop-text-dim)"
									/>
									<span className={DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS}>
										{t('fileManager.recentSection')}
									</span>
								</div>
								<ul className="space-y-0.5">
									{recentDocs.map((doc) => (
										<FileManagerRecentDocRow
											key={doc.id}
											doc={doc}
											onOpenDocument={handleSelectDocument}
											onContextMenu={(e) => handleDocumentContextMenu(e, doc)}
										/>
									))}
								</ul>
							</div>
						)}
						{recentDocs.length > 0 &&
							!hasSearch &&
							mainListDocuments.length > 0 && (
								<div className="flex items-center gap-2 py-0.5">
									<span className={DOC_EDITOR_FILE_MANAGER_META_LABEL_CLASS}>
										{t('fileManager.allDocuments')}
									</span>
									<div className="h-px min-w-0 flex-1 bg-(--desktop-border-subtle)" />
								</div>
							)}
						{mainListDocuments.length >= VIRTUAL_LIST_MIN ? (
							<VirtualVariableList
								key={fileManagerListCompact ? 'compact' : 'comfortable'}
								items={mainListDocuments}
								estimateSize={estimateMainListRowHeight}
								height={listHeight}
								overscanCount={6}
								className="rounded-lg"
								renderItem={renderDocRow}
							/>
						) : (
							<div className="space-y-1.5">
								{mainListDocuments.map((doc) => (
									<motion.div
										key={doc.id}
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										transition={{ duration: 0.15 }}
									>
										{renderDocRow(doc)}
									</motion.div>
								))}
							</div>
						)}
						{showLoadMore && (
							<div className="pt-2">
								<DesktopAppButton
									type="button"
									variant="neutral"
									className="w-full"
									disabled={isLoadingMoreDocuments}
									onClick={handleLoadMore}
								>
									{isLoadingMoreDocuments ? (
										<>
											<ArrowPathIcon className="size-4 animate-spin" />
											{t('fileManager.loadMoreLoading')}
										</>
									) : (
										t('fileManager.loadMore')
									)}
								</DesktopAppButton>
							</div>
						)}
					</div>
				) : (
					<DesktopAppPanel className="border-dashed bg-transparent">
						<DesktopAppEmptyState
							icon={
								<DocumentTextIcon
									width={40}
									height={40}
									className="text-white/30"
								/>
							}
							title={
								hasSearch
									? t('fileManager.emptyNoMatch')
									: t('fileManager.emptyNoDocs')
							}
							description={
								hasSearch
									? t('fileManager.emptyNoMatchDesc')
									: t('fileManager.emptyNoDocsDesc')
							}
							className="py-12"
						>
							{hasSearch ? (
								<DesktopAppButton
									type="button"
									onClick={() => setSearchInput('')}
									variant="ghost"
									size="sm"
								>
									{t('fileManager.clearSearch')}
								</DesktopAppButton>
							) : null}
						</DesktopAppEmptyState>
					</DesktopAppPanel>
				)}
			</div>

			<div className={DOC_EDITOR_FILE_MANAGER_FOOTER_CLASS}>
				<span className="min-w-0 truncate">
					{t('fileManager.footerLoaded', {
						loaded: documents.length,
						total: documentsTotal > 0 ? documentsTotal : documents.length,
					})}
				</span>
				{searchInput.trim() ? (
					<DesktopAppButton
						type="button"
						onClick={() => setSearchInput('')}
						variant="ghost"
						size="sm"
					>
						{t('fileManager.resetFilter')}
					</DesktopAppButton>
				) : null}
			</div>

			{showLibraryPanel && (
				<React.Suspense
					fallback={
						<div
							className={cn(
								'fixed inset-0 flex items-center justify-center',
								DESKTOP_OVERLAY.backdrop
							)}
							style={{
								zIndex:
									docSidePanelZ + DESKTOP_PORTAL_STACK_BUMP.GUIDE_TOUR_CARD,
							}}
							role="presentation"
						>
							<ArrowPathIcon
								className="size-10 animate-spin text-emerald-400/80 motion-reduce:animate-none"
								aria-hidden
							/>
						</div>
					}
				>
					<FileLibraryPanelLazy
						isOpen={showLibraryPanel}
						onClose={closeLibraryPanel}
						onSelectFile={handleLibraryFileSelect}
					/>
				</React.Suspense>
			)}
			{showPaperlessPanel && (
				<React.Suspense fallback={null}>
					<PaperlessPickerPanelLazy
						isOpen={showPaperlessPanel}
						onClose={closePaperlessPanel}
						onImport={handlePaperlessImport}
					/>
				</React.Suspense>
			)}
			<RuntimeTextPromptDialog
				isOpen={showCreateDialog}
				onClose={() => setShowCreateDialog(false)}
				onSubmit={(value) => {
					void handleCreateDocumentSubmit(value);
				}}
				title={t('fileManager.newDocTitle')}
				description={t('fileManager.newDocDescription')}
				label={t('fileManager.newDocLabel')}
				placeholder={t('fileManager.newDocPlaceholder')}
				submitLabel={t('fileManager.newDocSubmit')}
				initialValue=""
				icon={DocumentTextIcon}
			/>
			<ConfirmDeleteModal
				isOpen={showDeleteConfirm !== null}
				onClose={cancelDeleteConfirm}
				onConfirm={async () => {
					if (!showDeleteConfirm) return;
					await handleDeleteDocumentById(showDeleteConfirm);
				}}
				title={t('fileManager.deleteModalTitle')}
				warningMessage={t('fileManager.deleteModalBody', {
					title: pendingDeleteTitle || '—',
				})}
				confirmButtonLabel={t('fileManager.delete')}
				confirmButtonLoadingLabel={t('fileManager.deleteDeleting')}
				cancelButtonLabel={t('fileManager.cancel')}
			/>
			<FileManagerDocContextMenu
				open={docContextMenu != null}
				anchor={
					docContextMenu
						? { clientX: docContextMenu.x, clientY: docContextMenu.y }
						: null
				}
				documentTitle={
					docContextMenu
						? docContextMenu.doc.title?.trim() || t('header.untitled')
						: null
				}
				onClose={() => setDocContextMenu(null)}
				onOpen={() => {
					const d = docContextMenu?.doc;
					if (!d) return;
					setDocContextMenu(null);
					handleSelectDocument(d);
				}}
				onAskAi={() => {
					const d = docContextMenu?.doc;
					if (!d) return;
					setDocContextMenu(null);
					openAIPanelWithFileFromList(d);
					onClose();
				}}
				onToggleSelect={() => {
					const d = docContextMenu?.doc;
					if (!d) return;
					setDocContextMenu(null);
					toggleDocumentSelection(d.id);
				}}
				onDelete={() => {
					const d = docContextMenu?.doc;
					if (!d) return;
					setDocContextMenu(null);
					handleDeleteClickId(d.id);
				}}
				isCurrent={currentDocument?.id === docContextMenu?.doc.id}
				isSelected={
					docContextMenu
						? selectedDocumentIds.includes(docContextMenu.doc.id)
						: false
				}
			/>
		</motion.div>
	);
};
