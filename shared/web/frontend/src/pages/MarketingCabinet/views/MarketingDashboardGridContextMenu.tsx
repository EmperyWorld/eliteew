import { cn } from '@/utils/cn';
import * as React from 'react';
import { createPortal } from 'react-dom';
import {
	DesktopAppButton,
	DESKTOP_APP_STYLE_CONTRACT,
} from '../../Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import type { MarketingDashboardWidget } from '../marketingCabinetApi';

/** ПКМ: меню плитки или пустой области сетки (добавление виджета и т.д.). */
export type DashboardGridContextMenu =
	| { kind: 'tile'; widget: MarketingDashboardWidget; x: number; y: number }
	| { kind: 'canvas'; x: number; y: number };

export type AddWidgetSelectOption = {
	value: string;
	label: string;
	description?: string;
};

export function useDashboardGridContextMenuEffects(
	gridContextMenu: DashboardGridContextMenu | null,
	setGridContextMenu: React.Dispatch<
		React.SetStateAction<DashboardGridContextMenu | null>
	>,
	contextMenuRef: React.RefObject<HTMLDivElement | null>
): void {
	React.useEffect(() => {
		if (!gridContextMenu) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				setGridContextMenu(null);
			}
		};
		const onPointer = (e: MouseEvent) => {
			const el = contextMenuRef.current;
			if (el && e.target instanceof Node && el.contains(e.target)) return;
			setGridContextMenu(null);
		};
		window.addEventListener('keydown', onKey);
		window.addEventListener('mousedown', onPointer);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('mousedown', onPointer);
		};
	}, [gridContextMenu, setGridContextMenu, contextMenuRef]);

	React.useLayoutEffect(() => {
		if (!gridContextMenu) return;
		const id = window.requestAnimationFrame(() => {
			contextMenuRef.current
				?.querySelector<HTMLButtonElement>(
					'button[role="menuitem"]:not([disabled])'
				)
				?.focus();
		});
		return () => window.cancelAnimationFrame(id);
	}, [gridContextMenu, contextMenuRef]);
}

export type MarketingDashboardGridContextMenuPortalProps = {
	gridContextMenu: DashboardGridContextMenu | null;
	contextMenuRef: React.RefObject<HTMLDivElement | null>;
	setGridContextMenu: React.Dispatch<
		React.SetStateAction<DashboardGridContextMenu | null>
	>;
	t: (key: string, options?: Record<string, unknown>) => string;
	allowMarketingWrite: boolean;
	toolbarBusy: boolean;
	openRenameTileModal: (w: MarketingDashboardWidget) => void;
	handleCopyWidgetClipboard: (
		w: MarketingDashboardWidget
	) => void | Promise<void>;
	handleDuplicateWidget: (w: MarketingDashboardWidget) => void;
	patchWidgetMutation: {
		mutate: (args: { widgetId: string; body: Record<string, unknown> }) => void;
	};
	deleteWidgetMutation: { mutate: (widgetId: string) => void };
	addWidgetSelectOptions: AddWidgetSelectOption[];
	atWidgetCap: boolean;
	handleAddWidget: (widgetKey: string) => void;
	handlePasteWidgetFromClipboard: () => void | Promise<void>;
};

/**
 * D.39: ПКМ и кнопка «⋯» открывают одно меню (rename, copy JSON, duplicate, hide, lock, remove).
 * ПКМ по пустой области сетки — меню холста: каталог виджетов и вставка из буфера.
 */
export function MarketingDashboardGridContextMenuPortal({
	gridContextMenu,
	contextMenuRef,
	setGridContextMenu,
	t,
	allowMarketingWrite,
	toolbarBusy,
	openRenameTileModal,
	handleCopyWidgetClipboard,
	handleDuplicateWidget,
	patchWidgetMutation,
	deleteWidgetMutation,
	addWidgetSelectOptions,
	atWidgetCap,
	handleAddWidget,
	handlePasteWidgetFromClipboard,
}: MarketingDashboardGridContextMenuPortalProps) {
	const portalStackBase = useDesktopWindowPortalStackBase();
	if (!gridContextMenu || typeof document === 'undefined') {
		return null;
	}

	return createPortal(
		<div
			ref={contextMenuRef}
			role="menu"
			aria-label={
				gridContextMenu.kind === 'tile'
					? t('overview.dashboard.toolbar.tileMenuOpenAria')
					: t('overview.dashboard.toolbar.gridCanvasMenuAria')
			}
			className={cn(
				DESKTOP_APP_STYLE_CONTRACT.panelStrong,
				'fixed flex min-w-48 flex-col gap-0.5 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-1 shadow-(--desktop-shadow-panel)',
				gridContextMenu.kind === 'canvas' &&
					'max-h-[min(24rem,calc(100dvh-2rem))]'
			)}
			style={{
				zIndex: portalStackBase,
				left: Math.max(8, Math.min(gridContextMenu.x, window.innerWidth - 208)),
				top: Math.max(
					8,
					Math.min(
						gridContextMenu.y,
						window.innerHeight - (gridContextMenu.kind === 'canvas' ? 400 : 280)
					)
				),
			}}
		>
			{gridContextMenu.kind === 'tile' && allowMarketingWrite ? (
				<>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="w-full justify-start"
						role="menuitem"
						disabled={toolbarBusy}
						onClick={() => {
							const tw = gridContextMenu.widget;
							setGridContextMenu(null);
							openRenameTileModal(tw);
						}}
					>
						{t('overview.dashboard.toolbar.renameTile')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="w-full justify-start"
						role="menuitem"
						disabled={toolbarBusy}
						onClick={() =>
							void handleCopyWidgetClipboard(gridContextMenu.widget)
						}
					>
						{t('overview.dashboard.toolbar.tileMenuCopyJson')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="w-full justify-start"
						role="menuitem"
						disabled={toolbarBusy}
						onClick={() => {
							const tw = gridContextMenu.widget;
							setGridContextMenu(null);
							handleDuplicateWidget(tw);
						}}
					>
						{t('overview.dashboard.toolbar.duplicateWidget')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="w-full justify-start"
						role="menuitem"
						disabled={toolbarBusy}
						onClick={() => {
							const tw = gridContextMenu.widget;
							setGridContextMenu(null);
							patchWidgetMutation.mutate({
								widgetId: tw.id,
								body: { is_visible: false },
							});
						}}
					>
						{t('overview.dashboard.toolbar.hideWidget')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="w-full justify-start"
						role="menuitem"
						disabled={toolbarBusy}
						onClick={() => {
							const tw = gridContextMenu.widget;
							setGridContextMenu(null);
							patchWidgetMutation.mutate({
								widgetId: tw.id,
								body: { is_locked: !tw.is_locked },
							});
						}}
					>
						{gridContextMenu.widget.is_locked
							? t('overview.dashboard.toolbar.unlockWidget')
							: t('overview.dashboard.toolbar.lockWidget')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							'w-full justify-start text-(--desktop-text-muted)',
							DESKTOP_INTERACTIVE.btnDanger
						)}
						role="menuitem"
						disabled={toolbarBusy}
						onClick={() => {
							const tw = gridContextMenu.widget;
							setGridContextMenu(null);
							if (
								!window.confirm(
									t('overview.dashboard.toolbar.removeConfirm', {
										title: tw.widget_title,
									})
								)
							) {
								return;
							}
							deleteWidgetMutation.mutate(tw.id);
						}}
					>
						{t('overview.dashboard.toolbar.removeWidget')}
					</DesktopAppButton>
				</>
			) : null}
			{gridContextMenu.kind === 'canvas' && allowMarketingWrite ? (
				<>
					<div
						className={cn(
							DESKTOP_TYPOGRAPHY.meta,
							'px-2 py-1 text-(--desktop-text-muted)'
						)}
					>
						{t('overview.dashboard.toolbar.addWidgetLabel')}
					</div>
					<div className="max-h-52 min-h-0 flex flex-col gap-0.5 overflow-y-auto overscroll-y-contain">
						{addWidgetSelectOptions
							.filter((o) => o.value !== '')
							.map((opt) => (
								<DesktopAppButton
									key={opt.value}
									type="button"
									variant="ghost"
									size="sm"
									className="w-full shrink-0 justify-start"
									role="menuitem"
									disabled={toolbarBusy || atWidgetCap}
									title={opt.description}
									onClick={() => {
										setGridContextMenu(null);
										handleAddWidget(opt.value);
									}}
								>
									{opt.label}
								</DesktopAppButton>
							))}
					</div>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="w-full justify-start"
						role="menuitem"
						disabled={toolbarBusy}
						aria-label={t('overview.dashboard.toolbar.pasteWidgetAria')}
						onClick={() => {
							setGridContextMenu(null);
							void handlePasteWidgetFromClipboard();
						}}
					>
						{t('overview.dashboard.toolbar.pasteWidget')}
					</DesktopAppButton>
				</>
			) : null}
		</div>,
		document.body
	);
}
