import { cn } from '@/utils/cn';
import {
	ArrowDownTrayIcon,
	ArrowLeftIcon,
	ArrowPathIcon,
	ArrowUturnLeftIcon,
	ArrowUturnRightIcon,
	BookmarkIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	ClipboardDocumentIcon,
	ArrowUpTrayIcon,
	QuestionMarkCircleIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { MarketingCabinetSelect } from '../components/MarketingCabinetSelect';
import {
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DESKTOP_APP_STYLE_CONTRACT,
} from '../../Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_LUCIDE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { lastDashboardPresetFromHistory } from '../dashboard-widgets/dashboardPresetHistory';
import { MC_DASHBOARD_NO_DRAG_CLASS } from '../dashboard-widgets/TileChrome';
import type { MarketingDashboardToolbarPanelProps } from './marketingDashboardToolbarPanel.types';

export type {
	MarketingDashboardToolbarLayoutTemplateRow,
	MarketingDashboardToolbarPanelProps,
} from './marketingDashboardToolbarPanel.types';

export function MarketingDashboardToolbarPanel(
	p: MarketingDashboardToolbarPanelProps
) {
	const {
		toolbarRegionRef,
		importLayoutInputRef,
		dashboardToolbarMountNode,
		dashboardToolbarExpanded,
		setDashboardToolbarExpanded,
		dashboardToolbarInHeader,
		layoutSaveStatusPillRow,
		onExitToOverviewCards,
		toolbarBusy,
		toolbarAwaitingPresets,
		allowMarketingWrite,
		dashboardToolbarLayoutGroupLabelId,
		dashboardToolbarWidgetsGroupLabelId,
		dashboardToolbarServiceGroupLabelId,
		presetCategorySelectId,
		presetSearchInputId,
		presetSelectId,
		presetHintId,
		layoutTemplateSelectId,
		layoutTemplatesCaveatId,
		presetCategoryFilter,
		setPresetCategoryFilter,
		presetCategories,
		presetSearchQuery,
		setPresetSearchQuery,
		presetSelectValue,
		setPresetSelectValue,
		presetsFromApi,
		presetSelectOptions,
		presets,
		filteredPresets,
		recentPresetQuickList,
		projectId,
		setPresetApplyDialog,
		rebuildPresetFromTemplateMutation,
		applyPresetMutation,
		layoutTemplatesQuery,
		selectedLayoutTemplateId,
		setSelectedLayoutTemplateId,
		layoutTemplateSelectOptions,
		layoutTemplateRows,
		applyLayoutTemplateMutation,
		deleteLayoutTemplateMutation,
		activeLayoutQuery,
		setSaveTemplateOpen,
		setSaveTemplateName,
		setSaveTemplateDescription,
		handleCreateBlankLayout,
		presetsQuery,
		addWidgetSelectId,
		addWidgetSelectValue,
		setAddWidgetSelectValue,
		addWidgetSelectOptions,
		handleAddWidget,
		atWidgetCap,
		widgetLayoutCap,
		usageStatsQuery,
		canUndoGridLayout,
		canRedoGridLayout,
		undoGridLayout,
		redoGridLayout,
		setShortcutsOpen,
		handleExportLayoutJson,
		handleImportLayoutFileList,
		handlePasteWidgetFromClipboard,
		cleanupDuplicatesMutation,
		t,
		mcShellPanel,
	} = p;
	return (
		<div
			ref={toolbarRegionRef}
			className={cn(
				'min-w-0 w-full',
				dashboardToolbarMountNode &&
					(dashboardToolbarExpanded
						? 'px-3 pb-2 pt-1.5 sm:px-4 sm:pb-2.5 sm:pt-2'
						: 'px-2 pb-1 pt-0.5 sm:px-3 sm:pb-1 sm:pt-1')
			)}
		>
			{!dashboardToolbarExpanded ? (
				<div
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.softCard,
						'flex flex-row items-center justify-between gap-2 px-2 py-1 sm:gap-2.5 sm:px-2.5 sm:py-1'
					)}
				>
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'min-w-0 flex-1 truncate text-[11px] leading-tight'
						)}
					>
						{t('overview.dashboard.toolbar.toolbarCollapsedHint')}
					</p>
					<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
						{layoutSaveStatusPillRow}
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="h-7 w-fit shrink-0 px-2 py-0 text-[11px]"
							aria-expanded={false}
							aria-label={t('overview.dashboard.toolbar.expandToolbarAria')}
							onClick={() => setDashboardToolbarExpanded(true)}
						>
							<ChevronDownIcon
								className="mr-0.5 h-3.5 w-3.5 shrink-0"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('overview.dashboard.toolbar.expandToolbar')}
						</DesktopAppButton>
					</div>
				</div>
			) : (
				<section
					data-mc-dashboard-toolbar
					data-mc-guide="dashboard-toolbar"
					aria-label={t('overview.dashboard.toolbar.toolbarRegionAria')}
					aria-busy={toolbarBusy || toolbarAwaitingPresets}
					className={cn(
						DESKTOP_APP_STYLE_CONTRACT.softCard,
						!dashboardToolbarInHeader && 'sticky top-0 z-10',
						'flex max-w-full flex-col gap-3 overflow-x-hidden p-3',
						'bg-(--desktop-surface-soft)/95 shadow-[0_10px_32px_rgba(0,0,0,0.09)] backdrop-blur-md supports-backdrop-filter:bg-(--desktop-surface-soft)/88'
					)}
				>
					{onExitToOverviewCards ? (
						<div className="flex flex-wrap items-center gap-2 border-b border-(--desktop-border-subtle)/50 pb-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={cn(
									MC_DASHBOARD_NO_DRAG_CLASS,
									'-ml-1 w-fit min-h-10 justify-center sm:min-h-9'
								)}
								disabled={toolbarBusy}
								aria-label={t(
									'overview.dashboard.toolbar.backToOverviewCardsAria'
								)}
								title={t('overview.dashboard.toolbar.backToOverviewCardsAria')}
								onClick={onExitToOverviewCards}
							>
								<ArrowLeftIcon
									className="mr-1 h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								{t('overview.dashboard.toolbar.backToOverviewCards')}
							</DesktopAppButton>
						</div>
					) : null}
					<div className="-mb-1 flex justify-end">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="w-fit shrink-0"
							aria-expanded={true}
							aria-label={t('overview.dashboard.toolbar.collapseToolbarAria')}
							onClick={() => setDashboardToolbarExpanded(false)}
						>
							<ChevronUpIcon
								className="mr-1 h-4 w-4 shrink-0"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							{t('overview.dashboard.toolbar.collapseToolbar')}
						</DesktopAppButton>
					</div>
					{allowMarketingWrite ? (
						<>
							<div className="flex w-full min-w-0 max-w-full flex-col gap-3 lg:flex-row lg:items-stretch">
								<fieldset
									aria-labelledby={dashboardToolbarLayoutGroupLabelId}
									className={cn(
										'm-0 min-w-0 border-0 flex flex-1 flex-col gap-2 p-3 lg:border-r lg:border-(--desktop-border-subtle)/55 lg:pr-4',
										mcShellPanel
									)}
								>
									<DesktopAppSectionLabel
										id={dashboardToolbarLayoutGroupLabelId}
										className="font-medium text-(--desktop-text-secondary)"
									>
										{t('overview.dashboard.toolbar.layoutGroup')}
									</DesktopAppSectionLabel>
									{layoutSaveStatusPillRow}
									{toolbarAwaitingPresets ? (
										<div className="max-w-md space-y-2">
											<div
												className="h-10 w-full animate-pulse rounded-(--desktop-radius) bg-(--desktop-surface-panel)/35"
												aria-hidden
											/>
											<p
												className={cn(DESKTOP_TYPOGRAPHY.meta)}
												aria-live="polite"
											>
												{t('overview.dashboard.toolbar.presetsLoading')}
											</p>
										</div>
									) : null}
									{!toolbarAwaitingPresets && presets.length > 0 ? (
										<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
											<div className="flex min-w-0 flex-1 basis-[min(100%,12rem)] flex-col gap-1">
												<label
													htmlFor={presetCategorySelectId}
													className={cn(
														DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
														'text-xs font-medium'
													)}
												>
													{t('overview.dashboard.toolbar.presetCategoryLabel')}
												</label>
												<MarketingCabinetSelect
													id={presetCategorySelectId}
													className="w-full min-w-0"
													value={presetCategoryFilter}
													onChange={(v) => setPresetCategoryFilter(v)}
													options={[
														{
															value: '',
															label: t(
																'overview.dashboard.toolbar.presetCategoryAll'
															),
														},
														...presetCategories.map((c) => ({
															value: c,
															label: c,
														})),
													]}
													disabled={toolbarBusy}
												/>
											</div>
											<div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-48">
												<label
													htmlFor={presetSearchInputId}
													className={cn(
														DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
														'text-xs font-medium'
													)}
												>
													{t('overview.dashboard.toolbar.presetSearchLabel')}
												</label>
												<DesktopAppInput
													id={presetSearchInputId}
													type="search"
													autoComplete="off"
													value={presetSearchQuery}
													onChange={(e) => setPresetSearchQuery(e.target.value)}
													placeholder={t(
														'overview.dashboard.toolbar.presetSearchPlaceholder'
													)}
													disabled={toolbarBusy}
													className="w-full min-w-0 text-sm"
												/>
											</div>
										</div>
									) : null}
									{!toolbarAwaitingPresets ? (
										<>
											<label
												htmlFor={presetSelectId}
												className={cn(
													DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
													'font-medium'
												)}
											>
												{t('overview.dashboard.toolbar.presetLabel')}
											</label>
											<MarketingCabinetSelect
												id={presetSelectId}
												value={presetSelectValue}
												onChange={(v) => {
													setPresetSelectValue(v);
													if (!v) {
														return;
													}
													const preset = presetsFromApi.find(
														(p) => p.name === v
													);
													if (!preset) {
														return;
													}
													setPresetApplyDialog({
														name: preset.name,
														label: preset.display_name ?? preset.name,
													});
												}}
												options={presetSelectOptions}
												disabled={toolbarBusy || presets.length === 0}
												aria-describedby={presetHintId}
											/>
											{allowMarketingWrite && presetSelectValue ? (
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="sm"
													className={cn(
														'mt-1 w-fit',
														MC_DASHBOARD_NO_DRAG_CLASS
													)}
													disabled={toolbarBusy}
													title={t(
														'overview.dashboard.toolbar.rebuildPresetFromTemplateHint'
													)}
													onClick={() => {
														const preset = presetsFromApi.find(
															(p) => p.name === presetSelectValue
														);
														const label =
															preset?.display_name ?? presetSelectValue;
														if (
															!window.confirm(
																t(
																	'overview.dashboard.toolbar.rebuildPresetFromTemplateConfirm',
																	{ name: label }
																)
															)
														) {
															return;
														}
														rebuildPresetFromTemplateMutation.mutate(
															presetSelectValue
														);
													}}
												>
													<ArrowPathIcon
														className={cn('mr-1 inline', DESKTOP_LUCIDE.sm)}
														strokeWidth={DESKTOP_LUCIDE.stroke}
														aria-hidden
													/>
													{t(
														'overview.dashboard.toolbar.rebuildPresetFromTemplate'
													)}
												</DesktopAppButton>
											) : null}
											{recentPresetQuickList.length > 0 ? (
												<div
													className={cn(
														'mt-1 flex flex-wrap items-center gap-1',
														MC_DASHBOARD_NO_DRAG_CLASS
													)}
												>
													<span
														className={cn(DESKTOP_TYPOGRAPHY.meta, 'shrink-0')}
													>
														{t('overview.dashboard.toolbar.recentPresetsLabel')}
													</span>
													{recentPresetQuickList.map((p) => (
														<DesktopAppButton
															key={p.name}
															type="button"
															variant="ghost"
															size="sm"
															className="max-w-36 truncate px-2"
															disabled={toolbarBusy}
															title={p.display_name ?? p.name}
															onClick={() =>
																setPresetApplyDialog({
																	name: p.name,
																	label: p.display_name ?? p.name,
																})
															}
														>
															{p.display_name ?? p.name}
														</DesktopAppButton>
													))}
												</div>
											) : null}
											{lastDashboardPresetFromHistory(projectId) ? (
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="sm"
													className={cn(
														'mt-1 w-fit',
														MC_DASHBOARD_NO_DRAG_CLASS
													)}
													disabled={toolbarBusy}
													onClick={() => {
														const n = lastDashboardPresetFromHistory(projectId);
														if (
															!n ||
															!window.confirm(
																t(
																	'overview.dashboard.toolbar.resetLastPresetConfirm',
																	{ name: n }
																)
															)
														) {
															return;
														}
														applyPresetMutation.mutate(n);
													}}
												>
													{t('overview.dashboard.toolbar.resetLastPreset')}
												</DesktopAppButton>
											) : null}
											{presets.length > 0 && filteredPresets.length === 0 ? (
												<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
													{t('overview.dashboard.toolbar.presetsFilterEmpty')}
												</p>
											) : null}
										</>
									) : null}
									{!toolbarAwaitingPresets ? (
										<details
											className={cn(
												DESKTOP_APP_STYLE_CONTRACT.helperText,
												'rounded-(--desktop-radius) border border-transparent'
											)}
										>
											<summary className="cursor-pointer select-none text-(--desktop-text-dim) hover:text-(--desktop-text-secondary)">
												{t('overview.dashboard.toolbar.presetHintSummary')}
											</summary>
											<p id={presetHintId} className="mt-1.5 leading-snug">
												{t('overview.dashboard.toolbar.presetApplyHint')}
											</p>
										</details>
									) : null}
									<div
										className={cn(
											'mt-3 flex min-w-0 flex-col gap-2 border-t border-(--desktop-border-subtle)/40 pt-3',
											MC_DASHBOARD_NO_DRAG_CLASS
										)}
									>
										<label
											htmlFor={layoutTemplateSelectId}
											className={cn(
												DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
												'font-medium'
											)}
										>
											{t('overview.dashboard.toolbar.layoutTemplatesLabel')}
										</label>
										{layoutTemplatesQuery.isLoading ? (
											<p
												className={cn(DESKTOP_TYPOGRAPHY.meta)}
												aria-live="polite"
											>
												{t('overview.dashboard.toolbar.layoutTemplatesLoading')}
											</p>
										) : null}
										{layoutTemplatesQuery.isError ? (
											<p
												className={cn(
													DESKTOP_TYPOGRAPHY.meta,
													'text-[color-mix(in_srgb,rgb(239_68_68)_75%,var(--desktop-text-primary))]'
												)}
											>
												{t(
													'overview.dashboard.toolbar.layoutTemplatesLoadFailed'
												)}
											</p>
										) : null}
										<div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
											<div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-48">
												<MarketingCabinetSelect
													id={layoutTemplateSelectId}
													className="w-full min-w-0"
													value={selectedLayoutTemplateId}
													onChange={(v) => setSelectedLayoutTemplateId(v)}
													options={layoutTemplateSelectOptions}
													disabled={
														toolbarBusy ||
														layoutTemplatesQuery.isLoading ||
														layoutTemplatesQuery.isError
													}
												/>
											</div>
											<div className="flex flex-wrap items-center gap-1">
												<DesktopAppButton
													type="button"
													variant="neutral"
													size="sm"
													className="w-fit shrink-0"
													disabled={
														toolbarBusy ||
														!selectedLayoutTemplateId ||
														layoutTemplatesQuery.isLoading
													}
													aria-label={t(
														'overview.dashboard.toolbar.applySavedLayoutAria'
													)}
													title={t(
														'overview.dashboard.toolbar.applySavedLayoutAria'
													)}
													onClick={() => {
														if (!selectedLayoutTemplateId) return;
														if (
															!window.confirm(
																t(
																	'overview.dashboard.toolbar.applySavedLayoutConfirm'
																)
															)
														) {
															return;
														}
														applyLayoutTemplateMutation.mutate(
															selectedLayoutTemplateId
														);
													}}
												>
													{t('overview.dashboard.toolbar.applySavedLayout')}
												</DesktopAppButton>
												<DesktopAppButton
													type="button"
													variant="ghost"
													size="sm"
													className={cn(
														'w-fit shrink-0',
														DESKTOP_INTERACTIVE.btnDanger
													)}
													disabled={
														toolbarBusy ||
														!selectedLayoutTemplateId ||
														layoutTemplatesQuery.isLoading
													}
													aria-label={t(
														'overview.dashboard.toolbar.deleteSavedLayoutAria'
													)}
													title={t(
														'overview.dashboard.toolbar.deleteSavedLayoutAria'
													)}
													onClick={() => {
														if (!selectedLayoutTemplateId) return;
														const row = layoutTemplateRows.find(
															(r) => r.id === selectedLayoutTemplateId
														);
														const nm = row?.name ?? '';
														if (
															!window.confirm(
																t(
																	'overview.dashboard.toolbar.deleteSavedLayoutConfirm',
																	{ name: nm }
																)
															)
														) {
															return;
														}
														deleteLayoutTemplateMutation.mutate(
															selectedLayoutTemplateId
														);
													}}
												>
													{t('overview.dashboard.toolbar.deleteSavedLayout')}
												</DesktopAppButton>
											</div>
										</div>
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											className="w-fit shrink-0"
											disabled={
												toolbarBusy ||
												!(activeLayoutQuery.data?.widgets?.length ?? 0) ||
												layoutTemplatesQuery.isLoading
											}
											aria-label={t(
												'overview.dashboard.toolbar.saveLayoutTemplateAria'
											)}
											title={t(
												'overview.dashboard.toolbar.saveLayoutTemplateAria'
											)}
											onClick={() => {
												setSaveTemplateOpen(true);
												setSaveTemplateName('');
												setSaveTemplateDescription('');
											}}
										>
											<BookmarkIcon
												className={cn('mr-1 inline', DESKTOP_LUCIDE.sm)}
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
											{t('overview.dashboard.toolbar.saveLayoutTemplateButton')}
										</DesktopAppButton>
										<p
											id={layoutTemplatesCaveatId}
											className={cn(DESKTOP_TYPOGRAPHY.meta, 'leading-snug')}
										>
											{t('overview.dashboard.toolbar.layoutTemplatesCaveat')}
										</p>
										{layoutTemplatesQuery.isSuccess &&
										layoutTemplateRows.length === 0 ? (
											<p
												className={cn(DESKTOP_TYPOGRAPHY.meta)}
												aria-live="polite"
											>
												{t('overview.dashboard.toolbar.layoutTemplatesEmpty')}
											</p>
										) : null}
									</div>
									{presetsQuery.isSuccess && presets.length === 0 ? (
										<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
											<p
												className={cn(
													DESKTOP_TYPOGRAPHY.meta,
													'min-w-0 flex-1'
												)}
											>
												{t('overview.dashboard.toolbar.noPresets')}
											</p>
											<DesktopAppButton
												type="button"
												variant="neutral"
												size="sm"
												className={cn(
													'w-fit shrink-0',
													MC_DASHBOARD_NO_DRAG_CLASS
												)}
												disabled={toolbarBusy}
												aria-label={t(
													'overview.dashboard.toolbar.createBlankLayoutAria'
												)}
												onClick={handleCreateBlankLayout}
											>
												{t('overview.dashboard.toolbar.createBlankLayout')}
											</DesktopAppButton>
										</div>
									) : null}
								</fieldset>
								<fieldset
									aria-labelledby={dashboardToolbarWidgetsGroupLabelId}
									className={cn(
										'm-0 min-w-0 border-0 flex flex-1 flex-col gap-2 p-3 lg:pl-4',
										mcShellPanel
									)}
								>
									<DesktopAppSectionLabel
										id={dashboardToolbarWidgetsGroupLabelId}
										className="font-medium text-(--desktop-text-secondary)"
									>
										{t('overview.dashboard.toolbar.widgetsGroup')}
									</DesktopAppSectionLabel>
									<label
										htmlFor={addWidgetSelectId}
										className={cn(
											DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
											'font-medium'
										)}
									>
										{t('overview.dashboard.toolbar.addWidgetLabel')}
									</label>
									<MarketingCabinetSelect
										id={addWidgetSelectId}
										className="min-w-[200px] max-w-full flex-1"
										value={addWidgetSelectValue}
										onChange={(v) => {
											setAddWidgetSelectValue(v);
											if (v) handleAddWidget(v);
										}}
										options={addWidgetSelectOptions}
										disabled={toolbarBusy || atWidgetCap}
									/>
									{atWidgetCap ? (
										<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1')}>
											{t('overview.dashboard.toolbar.widgetLimitHint', {
												cap: widgetLayoutCap,
											})}
										</p>
									) : null}
								</fieldset>
							</div>
							<fieldset
								aria-labelledby={dashboardToolbarServiceGroupLabelId}
								className="m-0 flex w-full min-w-0 flex-1 basis-full flex-col gap-2 border-0 border-t border-(--desktop-border-subtle)/55 p-0 pt-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
							>
								<div className="min-w-0 flex-1">
									<DesktopAppSectionLabel
										id={dashboardToolbarServiceGroupLabelId}
										className="mb-1.5 block font-medium text-(--desktop-text-secondary)"
									>
										{t('overview.dashboard.toolbar.serviceGroup')}
									</DesktopAppSectionLabel>
									<div
										className={cn(
											'flex min-w-0 flex-col gap-1',
											DESKTOP_TYPOGRAPHY.meta
										)}
									>
										{usageStatsQuery.isSuccess ? (
											<span>
												{t('overview.dashboard.toolbar.usageStatsLine', {
													visible: usageStatsQuery.data.visible_widgets,
													total: usageStatsQuery.data.total_widgets,
													layouts: usageStatsQuery.data.total_layouts,
													cap:
														usageStatsQuery.data.max_widgets_per_layout ?? 60,
												})}
											</span>
										) : null}
									</div>
								</div>
								<div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain sm:flex-wrap">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											MC_DASHBOARD_NO_DRAG_CLASS,
											'min-h-11 shrink-0 justify-center sm:min-h-10'
										)}
										disabled={toolbarBusy || !canUndoGridLayout}
										aria-label={t('overview.dashboard.toolbar.layoutUndoAria')}
										title={t('overview.dashboard.toolbar.layoutUndoAria')}
										onClick={undoGridLayout}
									>
										<ArrowUturnLeftIcon
											className="mr-1 h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('overview.dashboard.toolbar.layoutUndo')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											MC_DASHBOARD_NO_DRAG_CLASS,
											'min-h-11 shrink-0 justify-center sm:min-h-10'
										)}
										disabled={toolbarBusy || !canRedoGridLayout}
										aria-label={t('overview.dashboard.toolbar.layoutRedoAria')}
										title={t('overview.dashboard.toolbar.layoutRedoAria')}
										onClick={redoGridLayout}
									>
										<ArrowUturnRightIcon
											className="mr-1 h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('overview.dashboard.toolbar.layoutRedo')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											MC_DASHBOARD_NO_DRAG_CLASS,
											'min-h-11 shrink-0 justify-center sm:min-h-10'
										)}
										aria-label={t(
											'overview.dashboard.toolbar.shortcutsButtonAria'
										)}
										title={`${t('overview.dashboard.toolbar.shortcutsButton')} (?)`}
										onClick={() => setShortcutsOpen(true)}
									>
										<QuestionMarkCircleIcon
											className="mr-1 h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('overview.dashboard.toolbar.shortcutsButton')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											MC_DASHBOARD_NO_DRAG_CLASS,
											'min-h-11 shrink-0 justify-center sm:min-h-10'
										)}
										aria-label={t(
											'overview.dashboard.toolbar.exportLayoutAria'
										)}
										title={t('overview.dashboard.toolbar.exportLayout')}
										onClick={handleExportLayoutJson}
									>
										<ArrowDownTrayIcon
											className="mr-1 h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('overview.dashboard.toolbar.exportLayout')}
									</DesktopAppButton>
									<input
										ref={importLayoutInputRef}
										type="file"
										accept="application/json,.json"
										className="sr-only"
										aria-hidden
										tabIndex={-1}
										onChange={(e) =>
											void handleImportLayoutFileList(e.target.files)
										}
									/>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											MC_DASHBOARD_NO_DRAG_CLASS,
											'min-h-11 shrink-0 justify-center sm:min-h-10'
										)}
										disabled={toolbarBusy || atWidgetCap}
										aria-label={t(
											'overview.dashboard.toolbar.importLayoutAria'
										)}
										onClick={() => importLayoutInputRef.current?.click()}
									>
										<ArrowUpTrayIcon
											className="mr-1 h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('overview.dashboard.toolbar.importLayout')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											MC_DASHBOARD_NO_DRAG_CLASS,
											'min-h-11 shrink-0 justify-center sm:min-h-10'
										)}
										disabled={toolbarBusy}
										aria-label={t('overview.dashboard.toolbar.pasteWidgetAria')}
										onClick={() => void handlePasteWidgetFromClipboard()}
									>
										<ClipboardDocumentIcon
											className="mr-1 h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('overview.dashboard.toolbar.pasteWidget')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={cn(
											MC_DASHBOARD_NO_DRAG_CLASS,
											'min-h-11 shrink-0 justify-center sm:min-h-10'
										)}
										disabled={toolbarBusy}
										aria-label={t(
											'overview.dashboard.toolbar.cleanupDuplicatesAria'
										)}
										title={t('overview.dashboard.toolbar.cleanupDuplicates')}
										onClick={() => {
											if (
												!window.confirm(
													t(
														'overview.dashboard.toolbar.cleanupDuplicatesConfirm'
													)
												)
											) {
												return;
											}
											cleanupDuplicatesMutation.mutate();
										}}
									>
										<SparklesIcon
											className="mr-1 h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('overview.dashboard.toolbar.cleanupDuplicates')}
									</DesktopAppButton>
								</div>
							</fieldset>
						</>
					) : (
						<div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
							<div className="min-w-0 flex-1 space-y-2">
								<p className={DESKTOP_TYPOGRAPHY.body}>
									{t('overview.dashboard.toolbar.readOnly')}
								</p>
								{usageStatsQuery.isSuccess ? (
									<p className={DESKTOP_TYPOGRAPHY.meta}>
										{t('overview.dashboard.toolbar.usageStatsLine', {
											visible: usageStatsQuery.data.visible_widgets,
											total: usageStatsQuery.data.total_widgets,
											layouts: usageStatsQuery.data.total_layouts,
											cap: usageStatsQuery.data.max_widgets_per_layout ?? 60,
										})}
									</p>
								) : null}
							</div>
							<div className="flex flex-wrap items-center gap-1">
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className={cn(
										MC_DASHBOARD_NO_DRAG_CLASS,
										'min-h-11 shrink-0 justify-center sm:min-h-10'
									)}
									aria-label={t(
										'overview.dashboard.toolbar.shortcutsButtonAria'
									)}
									title={`${t('overview.dashboard.toolbar.shortcutsButton')} (?)`}
									onClick={() => setShortcutsOpen(true)}
								>
									<QuestionMarkCircleIcon
										className="mr-1 h-3.5 w-3.5"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									{t('overview.dashboard.toolbar.shortcutsButton')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className="min-h-11 w-fit justify-center sm:min-h-10"
									aria-label={t('overview.dashboard.toolbar.exportLayoutAria')}
									title={t('overview.dashboard.toolbar.exportLayout')}
									onClick={handleExportLayoutJson}
								>
									<ArrowDownTrayIcon
										className="mr-1 h-3.5 w-3.5"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
									{t('overview.dashboard.toolbar.exportLayout')}
								</DesktopAppButton>
							</div>
						</div>
					)}
				</section>
			)}
		</div>
	);
}
