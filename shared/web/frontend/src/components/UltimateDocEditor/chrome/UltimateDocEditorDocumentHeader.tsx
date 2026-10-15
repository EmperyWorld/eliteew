/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky document header: tabs, status/metrics meta strip, file/collab action clusters.
 *
 * Invariants:
 * - Meta and cluster section labels stay sentence-case (no chrome uppercase shout).
 *
 * Related:
 * - HeaderMetricBadge.tsx
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ULTIMATE_DOC_EDITOR_NS } from '@/i18n/namespaces';
import type { DesktopWindowStyle } from '@/types/profile';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import {
	DESKTOP_WINDOW_FRAME_STYLES,
	getDesktopShellHeaderStripClassName,
	getDesktopShellPanelClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';
import { TooltipV2 } from '@/components/ui/TooltipV2';
import {
	EXPORT_FORMAT_ENTRIES,
	type UltimateDocEditorExportFormat,
} from '../data/ultimateDocEditorExportFormats';
import type { OverlayKey } from '../hooks/docEditorPanelKeys';
import type { DocEditorTabSession } from '../types/editor.types';
import type { LocalDraftConflict } from '../utils/docEditorDraftLocal';
import {
	DOC_EDITOR_HEADER_META_LABEL_CLASS,
	HeaderMetricBadge,
} from './HeaderMetricBadge';
import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	ChatBubbleLeftRightIcon,
	ClockIcon,
	CodeBracketIcon,
	EyeIcon,
	EyeSlashIcon,
	FolderOpenIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	SparklesIcon,
	UsersIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

export type UltimateDocEditorDocumentHeaderDoc = {
	id?: string;
	title?: string;
	version?: number | null;
	version_number?: number | null;
	user_id?: string;
} | null;

export interface UltimateDocEditorDocumentHeaderProps {
	shellFrame: DesktopWindowStyle;
	stickyZIndex: number;
	embedded: boolean;
	documentSource: string | null;
	docTabOrder: string[];
	docTabTitles: Record<string, string>;
	docTabSessions: Record<string, DocEditorTabSession>;
	currentDocument: UltimateDocEditorDocumentHeaderDoc;
	isDirty: boolean;
	onDocTabSwitch: (id: string) => void | Promise<void>;
	onRemoveDocTab: (id: string) => void | Promise<void>;
	onOpenFileManagerForNewTab: () => void;
	docHeaderMetaStripClass: string;
	docHeaderToolbarVSepClass: string;
	docToolbarClusterClass: string;
	localDraftTooltip: string | null;
	hasLocalDraftIndicator: boolean;
	onOpenLocalDraftRecovery: () => void;
	documentStatusAriaLabel: string | null;
	isSaving: boolean;
	draftConflict: LocalDraftConflict | null;
	persistedOnServer: boolean;
	lastSaved?: string | Date | null;
	metricBadgeDefaultSurface: string;
	reduceMotion: boolean | null;
	headerViewModeLine: string;
	liveStats: { words: number; characters: number };
	renderHeaderPanelButton: (
		panel: OverlayKey,
		label: string,
		Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>,
		options?: {
			disabled?: boolean;
			disabledHint?: string;
			iconSize?: number;
			emphasis?: boolean;
		}
	) => React.ReactNode;
	onSaveClick: () => void;
	/** Override default save tooltip (collab «Зафиксировать»). */
	saveTooltip?: string;
	isSaveDisabled: boolean;
	exportMenuOpen: boolean;
	exportMenuPosition: { x: number; y: number } | null;
	exportButtonRef: React.RefObject<HTMLButtonElement | null>;
	exportMenuRef: React.RefObject<HTMLDivElement | null>;
	exportMenuPortalZ: number;
	onExportMenuToggle: () => void;
	onRequestCloseExportMenu: () => void;
	onExportFormatPicked: (format: UltimateDocEditorExportFormat) => void;
	onCollabDisconnect: () => void;
	onCollabConnect: () => void;
	activeCollaboratorsLength: number;
	collabConnected: boolean;
	onShowGuide: () => void;
	collaborationEnabledByUser: boolean;
	markdownMode: boolean;
	onToggleMarkdownMode: () => void | Promise<void>;
	previewMode: boolean;
	onTogglePreviewMode: () => void;
	onRequestCloseEditor: () => void;
	hasCloseButton: boolean;
}

export function UltimateDocEditorDocumentHeader(
	props: UltimateDocEditorDocumentHeaderProps
): React.JSX.Element {
	const { t } = useTranslation(ULTIMATE_DOC_EDITOR_NS);
	const {
		shellFrame,
		stickyZIndex,
		embedded,
		documentSource,
		docTabOrder,
		docTabTitles,
		docTabSessions,
		currentDocument,
		isDirty,
		onDocTabSwitch,
		onRemoveDocTab,
		onOpenFileManagerForNewTab,
		docHeaderMetaStripClass,
		docHeaderToolbarVSepClass,
		docToolbarClusterClass,
		localDraftTooltip,
		hasLocalDraftIndicator,
		onOpenLocalDraftRecovery,
		documentStatusAriaLabel,
		isSaving,
		draftConflict,
		persistedOnServer,
		lastSaved,
		metricBadgeDefaultSurface,
		reduceMotion,
		headerViewModeLine,
		liveStats,
		renderHeaderPanelButton,
		onSaveClick,
		saveTooltip,
		isSaveDisabled,
		exportMenuOpen,
		exportMenuPosition,
		exportButtonRef,
		exportMenuRef,
		exportMenuPortalZ,
		onExportMenuToggle,
		onRequestCloseExportMenu,
		onExportFormatPicked,
		onCollabDisconnect,
		onCollabConnect,
		activeCollaboratorsLength,
		collabConnected,
		onShowGuide,
		collaborationEnabledByUser,
		markdownMode,
		onToggleMarkdownMode,
		previewMode,
		onTogglePreviewMode,
		onRequestCloseEditor,
		hasCloseButton,
	} = props;

	const shellFramePreset =
		DESKTOP_WINDOW_FRAME_STYLES[shellFrame] ??
		DESKTOP_WINDOW_FRAME_STYLES.glass;

	return (
		<div
			className={cn(
				'sticky top-0',
				getDesktopShellHeaderStripClassName(shellFrame)
			)}
			style={{
				zIndex: stickyZIndex,
			}}
			data-doc-guide="header-strip"
		>
			<div className="w-full px-3 sm:px-4 py-1.5">
				{embedded &&
				documentSource === 'doc_editor' &&
				docTabOrder.length > 0 ? (
					<div className="mb-1.5 flex min-h-8 items-center gap-1 overflow-x-auto border-b border-[color-mix(in_srgb,var(--desktop-border-strong)_38%,transparent)] pb-1.5 [-webkit-overflow-scrolling:touch]">
						{docTabOrder.map((tid) => {
							const label =
								docTabTitles[tid] ||
								(currentDocument?.id === tid
									? currentDocument?.title
									: undefined) ||
								tid.slice(0, 10);
							const active = currentDocument?.id === tid;
							const tabDirty = active
								? isDirty
								: Boolean(docTabSessions[tid]?.isDirty);
							return (
								<div
									key={tid}
									className={cn(
										'flex max-w-[min(100%,14rem)] shrink-0 items-center gap-0.5 rounded-lg border px-1.5 py-0.5 text-xs',
										active
											? 'border-[rgb(var(--desktop-accent-rgb))]/45 bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_14%,transparent)] text-(--desktop-text-primary)'
											: 'border-transparent bg-[color-mix(in_srgb,var(--desktop-surface-panel)_70%,transparent)] text-(--desktop-text-secondary) hover:bg-[color-mix(in_srgb,var(--desktop-surface-panel)_88%,transparent)]'
									)}
								>
									<button
										type="button"
										className="min-w-0 flex-1 truncate text-left font-medium"
										onClick={() => {
											void onDocTabSwitch(tid);
										}}
									>
										{tabDirty
											? `${label}${t('header.tabs.dirtySuffix')}`
											: label}
									</button>
									{docTabOrder.length > 1 ? (
										<button
											type="button"
											className="shrink-0 rounded p-0.5 text-(--desktop-text-muted) hover:bg-[color-mix(in_srgb,var(--desktop-surface-panel)_80%,transparent)] hover:text-(--desktop-text-primary)"
											aria-label={t('header.tabs.closeAria')}
											onClick={(e) => {
												e.stopPropagation();
												void onRemoveDocTab(tid);
											}}
										>
											<XMarkIcon width={14} height={14} />
										</button>
									) : null}
								</div>
							);
						})}
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							className="h-7 w-7 shrink-0"
							aria-label={t('header.tabs.addAria')}
							title={t('header.tabs.openOtherTitle')}
							onClick={() => onOpenFileManagerForNewTab()}
						>
							<PlusIcon width={16} height={16} />
						</DesktopAppButton>
					</div>
				) : null}
				{/* Полоса метаданных → прокручиваемые действия */}
				<div className="flex flex-col gap-1.5">
					<div className={docHeaderMetaStripClass} data-doc-guide="header-meta">
						<div className="shrink-0">
							<TooltipV2
								content={localDraftTooltip}
								disabled={!localDraftTooltip}
								placement="bottom"
							>
								{hasLocalDraftIndicator ? (
									<button
										type="button"
										onClick={onOpenLocalDraftRecovery}
										className="cursor-pointer rounded-xl border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb))]/40"
										title={t('header.localDraftRecoveryTitle')}
									>
										<HeaderMetricBadge
											label={t('header.statusLabel')}
											ariaLabel={documentStatusAriaLabel ?? undefined}
											value={
												isSaving
													? t('header.statusSaving')
													: draftConflict
														? t('header.statusDraftConflict')
														: t('header.statusLocalDraft')
											}
											tone={
												isSaving ||
												isDirty ||
												hasLocalDraftIndicator ||
												draftConflict
													? 'accent'
													: 'default'
											}
											defaultSurfaceClassName={metricBadgeDefaultSurface}
										/>
									</button>
								) : (
									<div>
										<HeaderMetricBadge
											label={t('header.statusLabel')}
											ariaLabel={documentStatusAriaLabel ?? undefined}
											value={
												isSaving ? (
													t('header.statusSaving')
												) : draftConflict ? (
													t('header.statusDraftConflict')
												) : isDirty ? (
													<motion.span
														className="inline-flex font-extrabold tracking-tight text-red-100"
														animate={
															reduceMotion
																? undefined
																: { opacity: [1, 0.32, 1] }
														}
														transition={
															reduceMotion
																? undefined
																: {
																		duration: 1.1,
																		repeat: Infinity,
																		ease: 'easeInOut',
																	}
														}
													>
														{t('header.statusUnsaved')}
													</motion.span>
												) : !persistedOnServer ? (
													t('header.statusNoServerRecord')
												) : lastSaved ? (
													t('header.statusSaved')
												) : (
													t('header.statusDraft')
												)
											}
											tone={
												isSaving || draftConflict
													? 'accent'
													: isDirty
														? 'danger'
														: !persistedOnServer
															? 'warning'
															: 'default'
											}
											defaultSurfaceClassName={metricBadgeDefaultSurface}
										/>
									</div>
								)}
							</TooltipV2>
						</div>

						<div
							className="hidden h-5 w-px shrink-0 self-center bg-[color-mix(in_srgb,var(--desktop-border-strong)_55%,transparent)] sm:block"
							aria-hidden
						/>

						<div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
							<span
								className={cn(
									DOC_EDITOR_HEADER_META_LABEL_CLASS,
									'shrink-0 text-(--desktop-text-secondary)'
								)}
							>
								{t('header.viewSection')}
							</span>
							<span
								className="min-w-0 max-w-[min(100%,28rem)] truncate text-[10px] font-medium leading-snug text-(--desktop-text-muted)"
								title={headerViewModeLine}
							>
								{headerViewModeLine}
							</span>
						</div>

						<div
							className="hidden h-5 w-px shrink-0 self-center bg-[color-mix(in_srgb,var(--desktop-border-strong)_55%,transparent)] md:block"
							aria-hidden
						/>

						<div className="flex flex-wrap items-center gap-1.5">
							<HeaderMetricBadge
								compact
								label={t('header.metrics.version')}
								value={currentDocument?.version ?? '—'}
								defaultSurfaceClassName={metricBadgeDefaultSurface}
							/>
							<HeaderMetricBadge
								compact
								label={t('header.metrics.words')}
								value={liveStats.words}
								defaultSurfaceClassName={metricBadgeDefaultSurface}
							/>
							<HeaderMetricBadge
								compact
								label={t('header.metrics.chars')}
								value={liveStats.characters}
								defaultSurfaceClassName={metricBadgeDefaultSurface}
							/>
						</div>
					</div>

					<div
						className="min-h-0 min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch]"
						data-doc-guide="header-actions"
					>
						<div className="flex w-max max-w-none flex-nowrap items-center gap-2 md:gap-2.5">
							<div
								className={cn(
									docToolbarClusterClass,
									'flex flex-nowrap items-center gap-x-1.5'
								)}
							>
								<span
									className={cn(
										DOC_EDITOR_HEADER_META_LABEL_CLASS,
										'hidden px-1 text-(--desktop-text-secondary) md:block'
									)}
								>
									{t('header.cluster.file')}
								</span>
								<div className="flex flex-nowrap items-center gap-1.5">
									{renderHeaderPanelButton(
										'fileManager',
										t('header.panel.fileManager'),
										FolderOpenIcon,
										{ emphasis: true, iconSize: 18 }
									)}
									{renderHeaderPanelButton(
										'search',
										t('header.panel.search'),
										MagnifyingGlassIcon,
										{ iconSize: 15 }
									)}
									{renderHeaderPanelButton(
										'versions',
										t('header.panel.versions'),
										ClockIcon,
										{
											disabled: !currentDocument?.id,
											disabledHint: t('versionsDisabledTooltip'),
											iconSize: 15,
										}
									)}
								</div>
								<div className={docHeaderToolbarVSepClass} aria-hidden />
								<div className="flex flex-nowrap items-center gap-1.5">
									{renderHeaderPanelButton(
										'import',
										t('header.panel.import'),
										ArrowUpTrayIcon,
										{ emphasis: true, iconSize: 18 }
									)}
								</div>
								<div className={docHeaderToolbarVSepClass} aria-hidden />
								<div className="flex flex-nowrap items-center gap-1.5">
									<TooltipV2
										content={saveTooltip ?? t('header.save.tooltip')}
										placement="bottom"
									>
										<DesktopAppButton
											onClick={onSaveClick}
											disabled={isSaveDisabled}
											variant="accent"
											size="icon"
											className={cn(
												'relative h-9 w-9 shadow-(--desktop-shadow-soft)',
												isDirty &&
													!isSaving &&
													'ring-2 ring-[rgb(var(--desktop-accent-rgb))]/45 ring-offset-2 ring-offset-[color-mix(in_srgb,var(--desktop-surface-panel)_92%,transparent)]'
											)}
											aria-label={t('header.save.ariaLabel')}
										>
											{isSaving ? (
												<motion.div
													animate={{ rotate: 360 }}
													transition={{
														duration: 1,
														repeat: Infinity,
														ease: 'linear',
													}}
												>
													<ArrowDownTrayIcon
														width={18}
														height={18}
														strokeWidth={2.25}
													/>
												</motion.div>
											) : (
												<ArrowDownTrayIcon
													width={18}
													height={18}
													strokeWidth={2.25}
												/>
											)}
										</DesktopAppButton>
									</TooltipV2>

									<div className="relative">
										<TooltipV2
											content={t('header.export.tooltip')}
											placement="bottom"
										>
											<motion.button
												type="button"
												className={cn(
													'flex h-9 w-9 items-center justify-center rounded-(--desktop-radius) border shadow-[0_1px_4px_rgba(2,6,23,0.18)] transition-colors',
													exportMenuOpen
														? 'border-[rgb(var(--desktop-accent-rgb))]/40 bg-(--desktop-surface-accent) text-white'
														: 'border-[rgb(var(--desktop-accent-rgb))]/28 bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_10%,var(--desktop-surface-soft))] text-(--desktop-text-primary) hover:bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_16%,var(--desktop-surface-soft-hover))]'
												)}
												onClick={onExportMenuToggle}
												ref={exportButtonRef}
												aria-haspopup="menu"
												aria-expanded={exportMenuOpen}
												whileHover={{ scale: 1.05 }}
												whileTap={{ scale: 0.95 }}
												aria-label={t('header.export.ariaLabel')}
											>
												<ArrowDownTrayIcon
													width={18}
													height={18}
													strokeWidth={2.25}
												/>
											</motion.button>
										</TooltipV2>
										{typeof document !== 'undefined' ? (
											<ShellPortalMount>
												<AnimatePresence>
													{exportMenuOpen && exportMenuPosition && (
														<motion.div
															ref={exportMenuRef}
															initial={{ opacity: 0, y: -8, scale: 0.96 }}
															animate={{ opacity: 1, y: 0, scale: 1 }}
															exit={{ opacity: 0, y: -8, scale: 0.96 }}
															transition={{
																duration: 0.18,
																ease: 'easeOut',
															}}
															className={cn(
																'fixed w-80 overflow-hidden p-0 text-(--desktop-text-primary)',
																getDesktopShellPanelClassName(
																	shellFrame,
																	'standard'
																)
															)}
															style={{
																left: `${exportMenuPosition.x}px`,
																top: `${exportMenuPosition.y}px`,
																zIndex: exportMenuPortalZ,
															}}
														>
															<div
																className={cn(
																	'flex items-start justify-between gap-3 px-4 py-3',
																	getDesktopShellHeaderStripClassName(
																		shellFrame
																	)
																)}
															>
																<div className="flex items-center gap-3">
																	<div className="rounded-xl border border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) p-2">
																		<ArrowDownTrayIcon
																			width={20}
																			height={20}
																			className="text-white"
																		/>
																	</div>
																	<div className="space-y-1">
																		<p className="text-sm font-semibold text-(--desktop-text-primary)">
																			{t('header.export.menuTitle')}
																		</p>
																		<p className="text-xs text-(--desktop-text-muted)">
																			{t('header.export.menuSubtitle')}
																		</p>
																	</div>
																</div>
																<DesktopAppButton
																	type="button"
																	onClick={onRequestCloseExportMenu}
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7"
																	aria-label={t('header.export.closeMenuAria')}
																>
																	<XMarkIcon width={18} height={18} />
																</DesktopAppButton>
															</div>
															<div
																className={cn(
																	'space-y-2 px-4 pb-4 pt-2',
																	shellFramePreset.content
																)}
															>
																{EXPORT_FORMAT_ENTRIES.map(
																	({ format, icon }) => (
																		<button
																			key={format}
																			type="button"
																			onClick={() => {
																				onExportFormatPicked(format);
																			}}
																			className={cn(
																				'w-full rounded-xl px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb))]/35',
																				getDesktopShellToolbarClusterInsetControlClassName(
																					shellFrame
																				),
																				'hover:border-[rgb(var(--desktop-accent-rgb))]/40 hover:bg-[color-mix(in_srgb,var(--desktop-surface-accent)_22%,var(--desktop-surface-soft))]'
																			)}
																		>
																			<div className="flex items-start gap-3">
																				<span className="mt-0.5 shrink-0">
																					{icon}
																				</span>
																				<div>
																					<div className="text-sm font-semibold tracking-wide text-(--desktop-text-primary)">
																						{t(
																							`header.export.formats.${format}.label`
																						)}
																					</div>
																					<div className="mt-1 text-xs leading-snug text-(--desktop-text-muted)">
																						{t(
																							`header.export.formats.${format}.description`
																						)}
																					</div>
																				</div>
																			</div>
																		</button>
																	)
																)}
															</div>
														</motion.div>
													)}
												</AnimatePresence>
											</ShellPortalMount>
										) : null}
									</div>
								</div>
							</div>

							{currentDocument?.id ? (
								<>
									<div className={docHeaderToolbarVSepClass} aria-hidden />
									<div
										className={cn(
											docToolbarClusterClass,
											'flex flex-nowrap items-center gap-x-1.5'
										)}
									>
										<div
											className={cn(
												'flex flex-nowrap items-center gap-x-1.5',
												collabConnected &&
													'animate-doc-collab-session-live motion-reduce:animate-none'
											)}
										>
											<span
												className={cn(
													DOC_EDITOR_HEADER_META_LABEL_CLASS,
													'hidden px-1 text-(--desktop-text-secondary) md:block'
												)}
											>
												{t('header.cluster.collab')}
											</span>
											<section
												className={cn(
													'flex min-h-9 items-center gap-2 rounded-xl px-2.5 py-1.5',
													collabConnected
														? 'border border-[rgb(var(--desktop-accent-rgb))]/35 bg-(--desktop-surface-accent) text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
														: metricBadgeDefaultSurface
												)}
												aria-label={
													collabConnected
														? t('shell.collab.connected')
														: t('shell.collab.disconnected')
												}
											>
												<span className="sr-only">
													{collabConnected
														? t('shell.collab.connected')
														: t('shell.collab.disconnected')}
												</span>
												<div
													className={`h-2 w-2 shrink-0 rounded-full ${collabConnected ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.45)]' : 'bg-(--desktop-text-dim) animate-pulse'}`}
													aria-hidden
													title={
														collabConnected
															? t('shell.collab.connected')
															: t('shell.collab.disconnected')
													}
												/>
												<div className="flex flex-col leading-none">
													<span
														className={cn(
															DOC_EDITOR_HEADER_META_LABEL_CLASS,
															collabConnected
																? 'text-white/78'
																: 'text-(--desktop-text-secondary)'
														)}
													>
														{t('shell.collab.sessionLabel')}
													</span>
													<span
														className={`text-[11px] font-medium tabular-nums ${collabConnected ? 'text-white' : 'text-(--desktop-text-secondary)'}`}
													>
														{collabConnected
															? `${activeCollaboratorsLength} ${activeCollaboratorsLength === 1 ? t('shell.collab.participant_one') : t('shell.collab.participant_other')}`
															: t('collabStatus.offline')}
													</span>
												</div>
											</section>
										</div>
										{collabConnected ? (
											<TooltipV2
												content={t('header.collabActions.disconnectTooltip')}
												placement="bottom"
											>
												<DesktopAppButton
													type="button"
													onClick={onCollabDisconnect}
													variant="ghost"
													size="sm"
													className="h-9 px-3 hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-300"
													aria-label={t('header.collabActions.disconnectAria')}
												>
													{t('header.collabActions.disconnect')}
												</DesktopAppButton>
											</TooltipV2>
										) : (
											<TooltipV2
												content={t('header.collabActions.connectTooltip')}
												placement="bottom"
											>
												<DesktopAppButton
													type="button"
													onClick={onCollabConnect}
													variant="accent"
													size="sm"
													className="h-9 px-3 text-green-50 shadow-(--desktop-shadow-soft)"
													aria-label={t('header.collabActions.connectAria')}
												>
													{t('header.collabActions.connect')}
												</DesktopAppButton>
											</TooltipV2>
										)}
										{renderHeaderPanelButton(
											'comments',
											t('header.panel.comments'),
											ChatBubbleLeftRightIcon
										)}
										{renderHeaderPanelButton(
											'collab',
											t('header.panel.collabInvites'),
											UsersIcon
										)}
									</div>
								</>
							) : null}

							<div className={docHeaderToolbarVSepClass} aria-hidden />
							<div
								className={cn(
									docToolbarClusterClass,
									'flex flex-nowrap items-center gap-x-1.5'
								)}
							>
								<TooltipV2
									content={t('header.guide.tooltip')}
									placement="bottom"
								>
									<DesktopAppButton
										variant="accent"
										size="icon"
										className="h-9 w-9 shadow-(--desktop-shadow-soft)"
										onClick={onShowGuide}
										aria-label={t('header.guide.ariaLabel')}
									>
										<SparklesIcon width={14} height={14} />
									</DesktopAppButton>
								</TooltipV2>
								<TooltipV2
									content={
										collaborationEnabledByUser && !markdownMode
											? t('header.markdownTooltipCollabBlocked')
											: markdownMode
												? t('header.markdownTooltipToHtml')
												: t('header.markdownTooltipToMd')
									}
									placement="bottom"
								>
									<DesktopAppButton
										variant={markdownMode ? 'accent' : 'ghost'}
										active={markdownMode}
										size="icon"
										className="h-9 w-9"
										disabled={collaborationEnabledByUser && !markdownMode}
										onClick={() => {
											void onToggleMarkdownMode();
										}}
										aria-label={
											collaborationEnabledByUser && !markdownMode
												? t('header.markdownTooltipCollabBlocked')
												: markdownMode
													? t('header.markdownTooltipToHtml')
													: t('header.markdownTooltipToMd')
										}
									>
										<CodeBracketIcon width={14} height={14} />
									</DesktopAppButton>
								</TooltipV2>
								<TooltipV2
									content={
										previewMode
											? t('header.previewTooltipHide')
											: t('header.previewTooltipShow')
									}
									placement="bottom"
								>
									<DesktopAppButton
										variant={previewMode ? 'accent' : 'ghost'}
										active={previewMode}
										size="icon"
										className="h-9 w-9"
										onClick={() => onTogglePreviewMode()}
										aria-label={
											previewMode
												? t('header.previewTooltipHide')
												: t('header.previewTooltipShow')
										}
									>
										{previewMode ? (
											<EyeSlashIcon width={14} height={14} />
										) : (
											<EyeIcon width={14} height={14} />
										)}
									</DesktopAppButton>
								</TooltipV2>
								{hasCloseButton ? (
									<TooltipV2
										content={t('header.closeEditor.tooltip')}
										placement="bottom"
									>
										<DesktopAppButton
											variant="danger"
											size="icon"
											className="h-9 w-9"
											onClick={onRequestCloseEditor}
											aria-label={t('header.closeEditor.ariaLabel')}
										>
											<XMarkIcon width={14} height={14} />
										</DesktopAppButton>
									</TooltipV2>
								) : null}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
