/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Notification Hub virtual list primitives for panel flyout and full-window modes.
 *
 * Invariants:
 * - Variable notification card heights are measured via `measureElement` to avoid scroll jumps.
 * - Virtual item keys are stable by notification id for consistent reuse while list updates.
 *
 * Related:
 * - NotificationHubBody.tsx, NotificationHubItem.tsx
 * - notificationHubLayoutTokens.ts
 */

import type { Notification } from '@/notifications';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence } from 'framer-motion';
import { useRef, type FC } from 'react';
import {
	NH_PANEL_ANIMATED_LIST_CLASS,
	NH_PANEL_VIRTUAL_ESTIMATE_PX,
	NH_PANEL_VIRTUAL_SCROLL_CLASS,
	NH_VIRTUAL_ITEM_GAP_PANEL_CLASS,
	NH_VIRTUAL_ITEM_GAP_WINDOW_CLASS,
	NH_VIRTUAL_ROW_ABS_CLASS,
	NH_WINDOW_VIRTUAL_ESTIMATE_PX,
	NH_WINDOW_VIRTUAL_SCROLL_CLASS,
} from './notificationHubLayoutTokens';
import { NotificationHubItem } from './NotificationHubItem';

export const PANEL_VIRTUAL_THRESHOLD = 26;
export const WINDOW_VIRTUAL_THRESHOLD = 40;

export const NotificationVirtualPanelList: FC<{
	items: Notification[];
	onMarkAsRead: (id: string) => void;
	onDismiss: (id: string) => void;
	timeRefreshKey: number;
}> = ({ items, onMarkAsRead, onDismiss, timeRefreshKey }) => {
	const parentRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => NH_PANEL_VIRTUAL_ESTIMATE_PX,
		getItemKey: (index) => items[index]?.id ?? index,
		overscan: 6,
	});

	return (
		<div ref={parentRef} className={NH_PANEL_VIRTUAL_SCROLL_CLASS}>
			<div
				className="relative w-full min-h-0"
				style={{
					height: `${virtualizer.getTotalSize()}px`,
				}}
			>
				{virtualizer.getVirtualItems().map((vi) => {
					const n = items[vi.index];
					return (
						<div
							key={n.id}
							data-index={vi.index}
							ref={virtualizer.measureElement}
							className={NH_VIRTUAL_ROW_ABS_CLASS}
							style={{
								transform: `translateY(${vi.start}px)`,
							}}
						>
							<div className={NH_VIRTUAL_ITEM_GAP_PANEL_CLASS}>
								<NotificationHubItem
									notification={n}
									onMarkAsRead={onMarkAsRead}
									onDismiss={onDismiss}
									compact
									timeRefreshKey={timeRefreshKey}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export const NotificationVirtualWindowList: FC<{
	items: Notification[];
	onMarkAsRead: (id: string) => void;
	onDismiss: (id: string) => void;
	timeRefreshKey: number;
}> = ({ items, onMarkAsRead, onDismiss, timeRefreshKey }) => {
	const parentRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => NH_WINDOW_VIRTUAL_ESTIMATE_PX,
		getItemKey: (index) => items[index]?.id ?? index,
		overscan: 8,
	});

	return (
		<div ref={parentRef} className={NH_WINDOW_VIRTUAL_SCROLL_CLASS}>
			<div
				className="relative w-full min-h-0"
				style={{
					height: `${virtualizer.getTotalSize()}px`,
				}}
			>
				{virtualizer.getVirtualItems().map((vi) => {
					const n = items[vi.index];
					return (
						<div
							key={n.id}
							data-index={vi.index}
							ref={virtualizer.measureElement}
							className={NH_VIRTUAL_ROW_ABS_CLASS}
							style={{
								transform: `translateY(${vi.start}px)`,
							}}
						>
							<div className={NH_VIRTUAL_ITEM_GAP_WINDOW_CLASS}>
								<NotificationHubItem
									notification={n}
									onMarkAsRead={onMarkAsRead}
									onDismiss={onDismiss}
									timeRefreshKey={timeRefreshKey}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

/** Non-virtual panel list with enter/exit animations */
export const NotificationPanelAnimatedList: FC<{
	items: Notification[];
	onMarkAsRead: (id: string) => void;
	onDismiss: (id: string) => void;
	timeRefreshKey: number;
}> = ({ items, onMarkAsRead, onDismiss, timeRefreshKey }) => (
	<div className={NH_PANEL_ANIMATED_LIST_CLASS}>
		<AnimatePresence mode="popLayout">
			{items.map((notification) => (
				<NotificationHubItem
					key={notification.id}
					notification={notification}
					onMarkAsRead={onMarkAsRead}
					onDismiss={onDismiss}
					compact
					timeRefreshKey={timeRefreshKey}
				/>
			))}
		</AnimatePresence>
	</div>
);
