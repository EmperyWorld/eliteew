/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Free-placement widgets panel: per-slot absolute cards and strip drag toolbar.
 *
 * Invariants:
 * - Pointer-events-none overlay; slot cards are pointer-events-auto.
 *
 * Related:
 * - DesktopWidgetsPanel.tsx
 */

import { cn } from '@/utils/cn';
import type * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Bars2Icon } from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import { resolveDesktopWidgetPanelZIndex } from '../../utils/desktopWidgetSurfacePolicy';
import type { DesktopWidgetLayoutSlot } from '../../types/desktopExpansion.types';
import { WIDGET_WORK_MARGIN_PX } from '../../utils/desktopWidgetLayoutUtils';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import type { useDesktopWidgetsPanelDrag } from './useDesktopWidgetsPanelDrag';
import { WidgetSlotBody } from './WidgetSlotBody';
import { WidgetSlotHeaderActions } from './WidgetSlotHeaderActions';
import type { DesktopWidgetsPanelProps } from './types';
import type { resolveWidgetPanelChrome } from './widgetPanelChrome';

type FreeWidgetsPanelLayoutProps = Pick<
	DesktopWidgetsPanelProps,
	| 'onAllWidgetSlotsOffsetCommit'
	| 'onSlotPositionCommit'
	| 'onOpenEwDesk'
	| 'onOpenMusicPlayer'
> &
	Pick<
		ReturnType<typeof useDesktopWidgetsPanelDrag>,
		| 'freeStripDrag'
		| 'slotDragLive'
		| 'handleFreeStripPointerDown'
		| 'handleFreeStripPointerMove'
		| 'handleFreeStripPointerUp'
		| 'handleFreeStripPointerCancel'
		| 'handleSlotDragPointerDown'
		| 'handleSlotDragPointerMove'
		| 'handleSlotDragPointerUp'
		| 'handleSlotDragPointerCancel'
	> & {
		slots: DesktopWidgetLayoutSlot[];
		fallbackPos: Record<string, { x: number; y: number }>;
		layoutScale: number;
		chrome: ReturnType<typeof resolveWidgetPanelChrome>;
		slotBodyProps: Omit<WidgetSlotBodyProps, 'slot'>;
	};

type WidgetSlotBodyProps = React.ComponentProps<typeof WidgetSlotBody>;

export function FreeWidgetsPanelLayout({
	slots,
	fallbackPos,
	layoutScale,
	chrome,
	onAllWidgetSlotsOffsetCommit,
	onSlotPositionCommit,
	onOpenEwDesk,
	onOpenMusicPlayer,
	freeStripDrag,
	slotDragLive,
	handleFreeStripPointerDown,
	handleFreeStripPointerMove,
	handleFreeStripPointerUp,
	handleFreeStripPointerCancel,
	handleSlotDragPointerDown,
	handleSlotDragPointerMove,
	handleSlotDragPointerUp,
	handleSlotDragPointerCancel,
	slotBodyProps,
}: FreeWidgetsPanelLayoutProps) {
	const { t } = useTranslation('desktopUi');
	const { width, radius, preset } = chrome;
	const widgetsPanelAnchorId =
		slots.find((slot) => slot.type !== 'favorites')?.id ?? null;

	return (
		<div
			className="pointer-events-none absolute inset-0 max-h-full min-h-0"
			style={{ zIndex: resolveDesktopWidgetPanelZIndex() }}
		>
			{onAllWidgetSlotsOffsetCommit ? (
				<DesktopChromeTooltip
					content={t('settingsPanel.widgetsPanel.freeStripDragHint')}
					placement="bottom"
					offsetExtra={6}
				>
					<div
						role="toolbar"
						aria-label={t('settingsPanel.widgetsPanel.freeStripDragAria')}
						data-desktop-welcome-guide={
							widgetsPanelAnchorId ? undefined : 'widgets-panel'
						}
						className={cn(
							'pointer-events-auto absolute left-1/2 top-3 z-10 flex cursor-grab touch-none items-center gap-2 rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/95 px-3 py-1.5 shadow-(--desktop-shadow-panel) backdrop-blur-xl active:cursor-grabbing',
							'text-(--desktop-text-muted) select-none'
						)}
						style={{
							transform: `translate3d(calc(-50% + ${freeStripDrag.dx}px), ${freeStripDrag.dy}px, 0)`,
						}}
						onPointerDown={handleFreeStripPointerDown}
						onPointerMove={handleFreeStripPointerMove}
						onPointerUp={handleFreeStripPointerUp}
						onPointerCancel={handleFreeStripPointerCancel}
					>
						<Bars2Icon
							className="size-4 shrink-0"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						<span className={DESKTOP_TYPOGRAPHY.caption}>
							{t('settingsPanel.widgetsPanel.freeStripDragHint')}
						</span>
					</div>
				</DesktopChromeTooltip>
			) : null}
			{slots.map((slot) => {
				const base = slot.position ??
					fallbackPos[slot.id] ?? {
						x: WIDGET_WORK_MARGIN_PX,
						y: WIDGET_WORK_MARGIN_PX,
					};
				const live = slotDragLive?.id === slot.id ? slotDragLive : null;
				const dx = live ? live.dx / layoutScale : 0;
				const dy = live ? live.dy / layoutScale : 0;
				return (
					<section
						key={slot.id}
						data-widget-slot-card
						data-desktop-welcome-guide={
							slot.type === 'favorites'
								? 'favorites-widget'
								: slot.id === widgetsPanelAnchorId
									? 'widgets-panel'
									: undefined
						}
						aria-label={t(`settingsPanel.widgetSlot.${slot.type}`)}
						className={cn(
							'pointer-events-auto absolute max-h-[min(72vh,calc(100%-5rem))] overflow-hidden border border-(--desktop-border-subtle) shadow-(--desktop-shadow-panel)',
							width,
							radius,
							preset.frame,
							'bg-(--desktop-surface-panel)/90 backdrop-blur-xl'
						)}
						style={{
							left: base.x + dx,
							top: base.y + dy,
						}}
					>
						<div className="flex max-h-full flex-col overflow-hidden">
							<div className="flex max-h-full flex-col overflow-hidden px-2.5 py-2">
								<div className="mb-1.5 flex items-center justify-between gap-2">
									<div className="flex min-w-0 flex-1 items-center gap-1">
										{onSlotPositionCommit ? (
											<DesktopChromeTooltip
												content={t(
													'settingsPanel.widgetsPanel.slotDragHandleAria'
												)}
												placement="top"
												offsetExtra={4}
											>
												<div
													role="presentation"
													aria-label={t(
														'settingsPanel.widgetsPanel.slotDragHandleAria'
													)}
													className={cn(
														'flex shrink-0 cursor-grab touch-none rounded-md p-0.5 active:cursor-grabbing',
														'text-(--desktop-text-muted)'
													)}
													onPointerDown={handleSlotDragPointerDown(
														slot.id,
														base
													)}
													onPointerMove={handleSlotDragPointerMove}
													onPointerUp={handleSlotDragPointerUp}
													onPointerCancel={handleSlotDragPointerCancel}
												>
													<Bars2Icon
														className="size-4"
														strokeWidth={DESKTOP_LUCIDE.stroke}
														aria-hidden
													/>
												</div>
											</DesktopChromeTooltip>
										) : null}
										<h3
											className={cn(
												DESKTOP_TYPOGRAPHY.labelOverline,
												'min-w-0 truncate text-(--desktop-text-primary)'
											)}
										>
											{t(`settingsPanel.widgetSlot.${slot.type}`)}
										</h3>
									</div>
									<WidgetSlotHeaderActions
										slot={slot}
										onOpenEwDesk={onOpenEwDesk}
										onOpenMusicPlayer={onOpenMusicPlayer}
										onOpenWidgetSlotExpanded={
											slotBodyProps.onOpenWidgetSlotExpanded
										}
										shrink
									/>
								</div>
								<div className="min-h-0 flex-1 overflow-y-auto">
									<WidgetSlotBody slot={slot} {...slotBodyProps} />
								</div>
							</div>
						</div>
					</section>
				);
			})}
		</div>
	);
}
