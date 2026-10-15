/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single react-grid-layout tile shell for the Marketing Cabinet interactive overview dashboard.
 *
 * Invariants:
 * - Forwards ref and RGL positioning props (`style`, drag handlers) to the root DOM node.
 * - RGL item root stays `overflow-visible` so `.react-resizable-handle` keeps hit-test; clip lives in TileChrome.
 * - Widget bodies render inside TileChrome; grid drag uses draggableCancel for in-tile controls.
 *
 * Related:
 * - MarketingDashboardInteractiveGrid.tsx, TileChrome.tsx
 */
import { cn } from '@/utils/cn';
import type { UseMutationResult } from '@tanstack/react-query';
import {
	ChevronDownIcon,
	ChevronUpIcon,
	DocumentDuplicateIcon,
	EyeSlashIcon,
	EllipsisHorizontalIcon,
	MinusIcon,
	PencilSquareIcon,
	PlusIcon,
	BookmarkSlashIcon,
	BookmarkSquareIcon,
	QuestionMarkCircleIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { DashboardWidgetTypeIcon } from '../dashboard-widgets/dashboardWidgetTileIcon';
import { parseWidgetConfig } from '../dashboard-widgets/parseWidgetConfig';
import {
	TileChrome,
	mcDashboardTileChromeActionBtnClassName,
	mcDashboardTileChromeDangerBtnClassName,
	mcDashboardTileChromeHintBtnClassName,
} from '../dashboard-widgets/TileChrome';
import type {
	MarketingDashboardWidget,
	MarketingDashboardWidgetUpdatePayload,
	MarketingWidgetConfig,
} from '../marketingCabinetApi';
import { ListTileDashboardControls } from './listTileDashboardControls';
import type { DashboardGridContextMenu } from './MarketingDashboardGridContextMenu';

export type MarketingDashboardTileProps = {
	widget: MarketingDashboardWidget;
	tileIndex: number;
	mcShellPanel: string;
	allowMarketingWrite: boolean;
	isProjectDashboardFetching: boolean;
	toolbarBusy: boolean;
	t: (key: string, options?: Record<string, unknown>) => string;
	setGridContextMenu: React.Dispatch<
		React.SetStateAction<DashboardGridContextMenu | null>
	>;
	handleNudgeTileGrid: (widgetId: string, dx: number, dy: number) => void;
	openRenameTileModal: (w: MarketingDashboardWidget) => void;
	patchWidgetMutation: UseMutationResult<
		MarketingDashboardWidget,
		Error,
		{ widgetId: string; body: MarketingDashboardWidgetUpdatePayload }
	>;
	deleteWidgetMutation: UseMutationResult<unknown, Error, string>;
	handleDuplicateWidget: (w: MarketingDashboardWidget) => void;
	patchTileFullConfig: (widgetId: string, cfg: MarketingWidgetConfig) => void;
	buildTileTitleHint: (
		t: (key: string, options?: Record<string, unknown>) => string,
		widget: MarketingDashboardWidget,
		parsed: ReturnType<typeof parseWidgetConfig>
	) => string;
	renderWidgetBody: (widget: MarketingDashboardWidget) => React.ReactNode;
} & Pick<
	React.HTMLAttributes<HTMLDivElement>,
	'className' | 'style' | 'onMouseDown' | 'onMouseUp' | 'onTouchEnd'
>;

export const MarketingDashboardTile = React.forwardRef<
	HTMLDivElement,
	MarketingDashboardTileProps
>(function MarketingDashboardTile(props, ref) {
	const {
		widget: w,
		tileIndex,
		mcShellPanel,
		allowMarketingWrite,
		isProjectDashboardFetching,
		toolbarBusy,
		t,
		setGridContextMenu,
		handleNudgeTileGrid,
		openRenameTileModal,
		patchWidgetMutation,
		deleteWidgetMutation,
		handleDuplicateWidget,
		patchTileFullConfig,
		buildTileTitleHint,
		renderWidgetBody,
		className,
		style,
		onMouseDown,
		onMouseUp,
		onTouchEnd,
	} = props;

	const parsedHint = parseWidgetConfig(w.widget_key, w.widget_config);
	const needsChartMinBodyHeight =
		w.widget_key === 'chart_metric' ||
		w.widget_key === 'chart_metrics_bar' ||
		w.widget_key === 'marketing_canvas';

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: ПКМ по плитке виджета — стандартное контекстное меню
		<div
			ref={ref}
			data-mc-dashboard-tile={w.id}
			id={tileIndex === 0 ? 'mc-dashboard-first-tile' : undefined}
			tabIndex={tileIndex === 0 ? -1 : undefined}
			aria-busy={isProjectDashboardFetching}
			style={style}
			onMouseDown={onMouseDown}
			onMouseUp={onMouseUp}
			onTouchEnd={onTouchEnd}
			className={cn(
				mcShellPanel,
				// overflow-visible: RGL resize handle is a sibling of TileChrome; overflow-hidden
				// on this react-grid-item root clips/steals the SE handle hit-test.
				'mc-overview-dashboard-tile flex h-full min-h-0 flex-col overflow-visible text-(--desktop-text-primary) outline-none focus-within:ring-2 focus-within:ring-(--mc-accent)/35',
				tileIndex === 0 && 'scroll-mt-32 sm:scroll-mt-36',
				!allowMarketingWrite && 'opacity-95',
				className
			)}
			onContextMenu={
				allowMarketingWrite
					? (ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							setGridContextMenu({
								kind: 'tile',
								widget: w,
								x: ev.clientX,
								y: ev.clientY,
							});
						}
					: undefined
			}
		>
			<TileChrome
				className="h-full min-h-0 flex-1 bg-transparent"
				dataMcGuide={tileIndex === 0 ? 'widget-chrome' : undefined}
				tileAriaLabel={w.widget_title}
				title={
					<span className="flex min-w-0 w-full items-center gap-2">
						<DashboardWidgetTypeIcon
							widgetKey={w.widget_key}
							className={cn(DESKTOP_LUCIDE.md, 'shrink-0 self-center')}
						/>
						<span className="min-w-0 flex-1 truncate">{w.widget_title}</span>
						<button
							type="button"
							className={mcDashboardTileChromeHintBtnClassName}
							aria-label={t('overview.dashboard.toolbar.tileTitleHintAria')}
							title={buildTileTitleHint(t, w, parsedHint)}
						>
							<QuestionMarkCircleIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						</button>
					</span>
				}
				headerActions={
					allowMarketingWrite ? (
						<div className="flex shrink-0 items-center gap-0.5">
							{!w.is_locked ? (
								<>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={mcDashboardTileChromeActionBtnClassName}
										aria-label={t(
											'overview.dashboard.toolbar.tileResizeShrinkW'
										)}
										title={t('overview.dashboard.toolbar.tileResizeShrinkW')}
										disabled={toolbarBusy}
										onClick={() => handleNudgeTileGrid(w.id, -1, 0)}
									>
										<MinusIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={mcDashboardTileChromeActionBtnClassName}
										aria-label={t('overview.dashboard.toolbar.tileResizeGrowW')}
										title={t('overview.dashboard.toolbar.tileResizeGrowW')}
										disabled={toolbarBusy}
										onClick={() => handleNudgeTileGrid(w.id, 1, 0)}
									>
										<PlusIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={mcDashboardTileChromeActionBtnClassName}
										aria-label={t(
											'overview.dashboard.toolbar.tileResizeShrinkH'
										)}
										title={t('overview.dashboard.toolbar.tileResizeShrinkH')}
										disabled={toolbarBusy}
										onClick={() => handleNudgeTileGrid(w.id, 0, -1)}
									>
										<ChevronDownIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className={mcDashboardTileChromeActionBtnClassName}
										aria-label={t('overview.dashboard.toolbar.tileResizeGrowH')}
										title={t('overview.dashboard.toolbar.tileResizeGrowH')}
										disabled={toolbarBusy}
										onClick={() => handleNudgeTileGrid(w.id, 0, 1)}
									>
										<ChevronUpIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</DesktopAppButton>
								</>
							) : null}
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={mcDashboardTileChromeActionBtnClassName}
								aria-label={t('overview.dashboard.toolbar.tileMenuOpenAria')}
								title={t('overview.dashboard.toolbar.tileMenuOpen')}
								disabled={toolbarBusy}
								onClick={(ev) => {
									const r = ev.currentTarget.getBoundingClientRect();
									setGridContextMenu({
										kind: 'tile',
										widget: w,
										x: Math.min(r.left, window.innerWidth - 200),
										y: Math.min(r.bottom + 4, window.innerHeight - 8),
									});
								}}
							>
								<EllipsisHorizontalIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={mcDashboardTileChromeActionBtnClassName}
								aria-label={t('overview.dashboard.toolbar.renameTile')}
								title={t('overview.dashboard.toolbar.renameTile')}
								disabled={toolbarBusy}
								onClick={() => openRenameTileModal(w)}
							>
								<PencilSquareIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={mcDashboardTileChromeActionBtnClassName}
								aria-label={t('overview.dashboard.toolbar.hideWidget')}
								title={t('overview.dashboard.toolbar.hideWidget')}
								disabled={toolbarBusy}
								onClick={() =>
									patchWidgetMutation.mutate({
										widgetId: w.id,
										body: { is_visible: false },
									})
								}
							>
								<EyeSlashIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={mcDashboardTileChromeActionBtnClassName}
								aria-label={
									w.is_locked
										? t('overview.dashboard.toolbar.unlockWidget')
										: t('overview.dashboard.toolbar.lockWidget')
								}
								title={
									w.is_locked
										? t('overview.dashboard.toolbar.unlockWidget')
										: t('overview.dashboard.toolbar.lockWidget')
								}
								disabled={toolbarBusy}
								onClick={() =>
									patchWidgetMutation.mutate({
										widgetId: w.id,
										body: { is_locked: !w.is_locked },
									})
								}
							>
								{w.is_locked ? (
									<BookmarkSlashIcon
										className="h-3.5 w-3.5"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								) : (
									<BookmarkSquareIcon
										className="h-3.5 w-3.5"
										strokeWidth={DESKTOP_LUCIDE.stroke}
										aria-hidden
									/>
								)}
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={mcDashboardTileChromeActionBtnClassName}
								aria-label={t('overview.dashboard.toolbar.duplicateWidget')}
								title={t('overview.dashboard.toolbar.duplicateWidget')}
								disabled={toolbarBusy}
								onClick={() => handleDuplicateWidget(w)}
							>
								<DocumentDuplicateIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className={mcDashboardTileChromeDangerBtnClassName}
								aria-label={t('overview.dashboard.toolbar.removeWidget')}
								title={t('overview.dashboard.toolbar.removeWidget')}
								disabled={toolbarBusy}
								onClick={() => {
									if (
										!window.confirm(
											t('overview.dashboard.toolbar.removeConfirm', {
												title: w.widget_title,
											})
										)
									) {
										return;
									}
									deleteWidgetMutation.mutate(w.id);
								}}
							>
								<TrashIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
						</div>
					) : null
				}
				belowHeader={
					allowMarketingWrite ? (
						<ListTileDashboardControls
							widget={w}
							disabled={toolbarBusy}
							onPatchFullConfig={patchTileFullConfig}
							t={t}
						/>
					) : null
				}
				bodyClassName={cn(
					'relative',
					needsChartMinBodyHeight && 'min-h-56',
					isProjectDashboardFetching &&
						'motion-safe:after:pointer-events-none motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:z-1 motion-safe:after:animate-pulse motion-safe:after:bg-(--desktop-surface-panel)/10'
				)}
			>
				{renderWidgetBody(w)}
			</TileChrome>
		</div>
	);
});

MarketingDashboardTile.displayName = 'MarketingDashboardTile';
