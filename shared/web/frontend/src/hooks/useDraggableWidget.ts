/**
 * useDraggableWidget - Общий хук для drag & drop виджетов
 *
 * Предоставляет единую логику перетаскивания для всех виджетов:
 * - Drag & drop с сохранением позиции
 * - Snap zones (привязка к краям экрана)
 * - Предотвращение выхода за границы
 * - Оптимизация производительности
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { log } from '../utils/logger';

interface UseDraggableWidgetOptions {
	/** Уникальный ID виджета для сохранения позиции */
	widgetId: string;
	/** Размер виджета (для расчета границ) */
	widgetSize?: number;
	/** Расстояние для snap zones (по умолчанию 20px) */
	snapDistance?: number;
	/** Включить snap zones (по умолчанию true) */
	enableSnap?: boolean;
	/** Минимальное расстояние от краев (по умолчанию 0) */
	padding?: number;
	/** Callback при начале drag */
	onDragStart?: () => void;
	/** Callback при окончании drag */
	onDragEnd?: (position: { x: number; y: number }) => void;
}

interface UseDraggableWidgetReturn {
	/** Позиция виджета */
	position: { x: number; y: number } | null;
	/** Состояние перетаскивания */
	isDragging: boolean;
	/** Ref для элемента виджета */
	widgetRef: React.RefObject<HTMLDivElement | null>;
	/** Обработчик начала drag */
	handleMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
	/** Стили для позиционирования */
	getPositionStyles: () => React.CSSProperties;
	/** Сброс позиции на значения по умолчанию */
	resetPosition: () => void;
}

const SNAP_DISTANCE = 20;
const DEFAULT_PADDING = 0;

export const useDraggableWidget = (
	options: UseDraggableWidgetOptions
): UseDraggableWidgetReturn => {
	const {
		widgetId,
		widgetSize = 64,
		snapDistance = SNAP_DISTANCE,
		enableSnap = true,
		padding = DEFAULT_PADDING,
		onDragStart,
		onDragEnd,
	} = options;

	const [position, setPosition] = useState<{ x: number; y: number } | null>(
		null
	);
	const [isDragging, setIsDragging] = useState(false);
	const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
		x: 0,
		y: 0,
	});
	const [isPositionLoaded, setIsPositionLoaded] = useState(false);
	const widgetRef = useRef<HTMLDivElement>(null);

	// Load saved position from localStorage
	useEffect(() => {
		const savedPosition = localStorage.getItem(`${widgetId}-position`);
		if (savedPosition) {
			try {
				const { x, y } = JSON.parse(savedPosition);
				setPosition({ x, y });
			} catch (e) {
				log.error(
					'useDraggableWidget',
					`Failed to load position for ${widgetId}`,
					e instanceof Error ? e : undefined,
					e
				);
			}
		}
		setIsPositionLoaded(true);
	}, [widgetId]);

	// Save position to localStorage
	const savePosition = useCallback(
		(x: number, y: number) => {
			try {
				localStorage.setItem(`${widgetId}-position`, JSON.stringify({ x, y }));
			} catch (e) {
				log.error(
					'useDraggableWidget',
					`Failed to save position for ${widgetId}`,
					e instanceof Error ? e : undefined,
					e
				);
			}
		},
		[widgetId]
	);

	// Snap to edges function
	const snapToEdge = useCallback(
		(x: number, y: number, viewportWidth: number, viewportHeight: number) => {
			if (!enableSnap) {
				return { x, y };
			}

			let snappedX = x;
			let snappedY = y;

			// Snap to left edge
			if (x <= snapDistance + padding) {
				snappedX = padding;
			}
			// Snap to right edge
			else if (x >= viewportWidth - widgetSize - snapDistance - padding) {
				snappedX = viewportWidth - widgetSize - padding;
			}

			// Snap to top edge
			if (y <= snapDistance + padding) {
				snappedY = padding;
			}
			// Snap to bottom edge
			else if (y >= viewportHeight - widgetSize - snapDistance - padding) {
				snappedY = viewportHeight - widgetSize - padding;
			}

			return { x: snappedX, y: snappedY };
		},
		[enableSnap, snapDistance, padding, widgetSize]
	);

	// Handle mouse down - start dragging
	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!widgetRef.current) {
				return;
			}

			const rect = widgetRef.current.getBoundingClientRect();
			const offsetX = e.clientX - rect.left;
			const offsetY = e.clientY - rect.top;

			// If position is null (default), initialize it from current rect position
			if (position === null) {
				setPosition({ x: rect.left, y: rect.top });
			}

			setDragOffset({ x: offsetX, y: offsetY });
			setIsDragging(true);
			onDragStart?.();
			e.preventDefault();
			e.stopPropagation();
		},
		[position, onDragStart]
	);

	// Handle mouse move - update position while dragging
	useEffect(() => {
		if (!isDragging) {
			return;
		}

		const handleMouseMove = (e: MouseEvent) => {
			if (!widgetRef.current) {
				return;
			}

			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			const maxX = viewportWidth - widgetSize - padding;
			const maxY = viewportHeight - widgetSize - padding;

			let newX = e.clientX - dragOffset.x;
			let newY = e.clientY - dragOffset.y;

			// Constrain to viewport bounds
			newX = Math.max(padding, Math.min(newX, maxX));
			newY = Math.max(padding, Math.min(newY, maxY));

			// Apply snap zones
			const snapped = snapToEdge(newX, newY, viewportWidth, viewportHeight);

			setPosition({ x: snapped.x, y: snapped.y });
		};

		const handleMouseUp = () => {
			setIsDragging(false);
			if (widgetRef.current && position) {
				savePosition(position.x, position.y);
				onDragEnd?.(position);
			}
		};

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);

		return () => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
	}, [
		isDragging,
		dragOffset,
		position,
		widgetSize,
		padding,
		snapToEdge,
		savePosition,
		onDragEnd,
	]);

	// Calculate position styles
	const getPositionStyles = useCallback((): React.CSSProperties => {
		if (!isPositionLoaded || position === null) {
			// Default position: bottom right
			return {
				right: `${24 + padding}px`,
				bottom: `${24 + padding}px`,
				left: 'auto',
				top: 'auto',
			};
		}

		return {
			left: `${position.x}px`,
			top: `${position.y}px`,
			right: 'auto',
			bottom: 'auto',
		};
	}, [isPositionLoaded, position, padding]);

	// Reset position to default
	const resetPosition = useCallback(() => {
		setPosition(null);
		try {
			localStorage.removeItem(`${widgetId}-position`);
		} catch (e) {
			log.error(
				'useDraggableWidget',
				`Failed to remove position for ${widgetId}`,
				e instanceof Error ? e : undefined,
				e
			);
		}
	}, [widgetId]);

	return {
		position,
		isDragging,
		widgetRef,
		handleMouseDown,
		getPositionStyles,
		resetPosition,
	};
};
