/**
 * Widget Hotkeys Hook
 * Provides keyboard shortcuts for widget management
 */

import { useEffect } from 'react';
import { floatingWidgetsService } from '../services/api/floatingWidgetsService';

interface UseWidgetHotkeysOptions {
	onOpenCatalog?: () => void;
	onCollapseAll?: () => void;
	onToggleWidget?: (index: number) => void;
	widgets?: Array<{ id: string; is_collapsed: boolean }>;
	enabled?: boolean;
}

export function useWidgetHotkeys(options: UseWidgetHotkeysOptions): void {
	const {
		onOpenCatalog,
		onCollapseAll,
		onToggleWidget,
		widgets = [],
		enabled = true,
	} = options;

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			// Игнорировать если пользователь вводит текст
			if (
				(e.target as HTMLElement)?.tagName === 'INPUT' ||
				(e.target as HTMLElement)?.tagName === 'TEXTAREA' ||
				(e.target as HTMLElement)?.isContentEditable
			) {
				return;
			}

			// Ctrl/Cmd + W - открыть каталог
			if ((e.ctrlKey || e.metaKey) && e.key === 'w' && !e.shiftKey) {
				e.preventDefault();
				onOpenCatalog?.();
				return;
			}

			// Ctrl/Cmd + Shift + W - свернуть все виджеты
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'w') {
				e.preventDefault();
				if (onCollapseAll) {
					onCollapseAll();
				} else {
					// Fallback: свернуть все виджеты напрямую
					widgets.forEach((widget) => {
						if (!widget.is_collapsed) {
							floatingWidgetsService.updateWidget(widget.id, {
								is_collapsed: true,
							});
						}
					});
				}
				return;
			}

			// Ctrl/Cmd + [1-9] - переключить виджет по номеру
			if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
				e.preventDefault();
				const index = parseInt(e.key, 10) - 1;
				if (widgets[index]) {
					if (onToggleWidget) {
						onToggleWidget(index);
					} else {
						// Fallback: переключить виджет напрямую
						const widget = widgets[index];
						floatingWidgetsService.updateWidget(widget.id, {
							is_collapsed: !widget.is_collapsed,
						});
					}
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [enabled, onOpenCatalog, onCollapseAll, onToggleWidget, widgets]);
}
