/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stacked (docked) widgets panel with anchor position and drag handle.
 *
 * Invariants:
 * - Panel offset persisted via onPanelOffsetCommit on drag end.
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
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { PANEL_POSITION_CLASS } from './constants';
import type { useDesktopWidgetsPanelDrag } from './useDesktopWidgetsPanelDrag';
import { WidgetSlotBody } from './WidgetSlotBody';
import { WidgetSlotHeaderActions } from './WidgetSlotHeaderActions';
import type { DesktopWidgetsPanelProps } from './types';
import type { resolveWidgetPanelChrome } from './widgetPanelChrome';

type StackedWidgetsPanelLayoutProps = Pick<
	DesktopWidgetsPanelProps,
	'panelPosition' | 'onPanelOffsetCommit' | 'onOpenEwDesk' | 'onOpenMusicPlayer'
> &
	Pick<
		ReturnType<typeof useDesktopWidgetsPanelDrag>,
		| 'rootRef'
		| 'panelTranslate'
		| 'handlePanelDragPointerDown'
		| 'handlePanelDragPointerMove'
		| 'handlePanelDragPointerUp'
		| 'handlePanelDragPointerCancel'
	> & {
		slots: DesktopWidgetLayoutSlot[];
		chrome: ReturnType<typeof resolveWidgetPanelChrome>;
		slotBodyProps: Omit<React.ComponentProps<typeof WidgetSlotBody>, 'slot'>;
	};

export function StackedWidgetsPanelLayout({
	slots,
	panelPosition,
	onPanelOffsetCommit,
	onOpenEwDesk,
	onOpenMusicPlayer,
	rootRef,
	panelTranslate,
	handlePanelDragPointerDown,
	handlePanelDragPointerMove,
	handlePanelDragPointerUp,
	handlePanelDragPointerCancel,
	chrome,
	slotBodyProps,
}: StackedWidgetsPanelLayoutProps) {
	const { t } = useTranslation('desktopUi');
	const { width, radius, preset } = chrome;

	return (
		<aside
			ref={rootRef}
			data-desktop-welcome-guide="widgets-panel"
			aria-label={t('settingsPanel.widgetsPanel.ariaLabel')}
			className={cn(
				'pointer-events-auto absolute flex max-h-[min(72vh,calc(100%-5rem))] min-h-0 flex-col overflow-hidden',
				width,
				PANEL_POSITION_CLASS[panelPosition]
			)}
			style={{
				zIndex: resolveDesktopWidgetPanelZIndex(),
				transform: panelTranslate,
			}}
		>
			<div
				className={cn(
					'flex min-h-0 flex-1 flex-col overflow-hidden border border-(--desktop-border-subtle) shadow-(--desktop-shadow-panel)',
					radius,
					preset.frame,
					'backdrop-blur-xl'
				)}
			>
				{onPanelOffsetCommit ? (
					<DesktopChromeTooltip
						content={t('settingsPanel.widgetsPanel.dragHandleAria')}
						placement="top"
						offsetExtra={4}
					>
						<div
							role="toolbar"
							aria-label={t('settingsPanel.widgetsPanel.dragHandleAria')}
							className={cn(
								'flex shrink-0 cursor-grab touch-none items-center gap-2 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/90 px-2 py-1.5 active:cursor-grabbing',
								'text-(--desktop-text-muted) select-none'
							)}
							onPointerDown={handlePanelDragPointerDown}
							onPointerMove={handlePanelDragPointerMove}
							onPointerUp={handlePanelDragPointerUp}
							onPointerCancel={handlePanelDragPointerCancel}
						>
							<Bars2Icon
								className="size-4 shrink-0"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							<span className={DESKTOP_TYPOGRAPHY.caption}>
								{t('settingsPanel.widgetsPanel.dragHint')}
							</span>
						</div>
					</DesktopChromeTooltip>
				) : null}
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
					<div className="flex flex-col gap-3">
						{slots.map((slot) => (
							<section
								key={slot.id}
								data-desktop-welcome-guide={
									slot.type === 'favorites' ? 'favorites-widget' : undefined
								}
								aria-label={t(`settingsPanel.widgetSlot.${slot.type}`)}
								className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80 px-2.5 py-2"
							>
								<div className="mb-1.5 flex items-center justify-between gap-2">
									<h3
										className={cn(
											DESKTOP_TYPOGRAPHY.labelOverline,
											'text-(--desktop-text-primary)'
										)}
									>
										{t(`settingsPanel.widgetSlot.${slot.type}`)}
									</h3>
									<WidgetSlotHeaderActions
										slot={slot}
										onOpenEwDesk={onOpenEwDesk}
										onOpenMusicPlayer={onOpenMusicPlayer}
										onOpenWidgetSlotExpanded={
											slotBodyProps.onOpenWidgetSlotExpanded
										}
									/>
								</div>
								<WidgetSlotBody slot={slot} {...slotBodyProps} />
							</section>
						))}
					</div>
				</div>
			</div>
		</aside>
	);
}
