/**
 * useResizable - Hook для изменения размера виджета
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface Size {
	width: number;
	height: number;
}

interface UseResizableOptions {
	initialSize?: Size;
	minSize?: Size;
	maxSize?: Size;
	storageKey?: string;
}

interface UseResizableReturn {
	size: Size;
	isResizing: boolean;
	elementRef: React.RefObject<HTMLDivElement | null>;
	handleResizeStart: (e: React.MouseEvent, direction: string) => void;
}

export const useResizable = (
	options: UseResizableOptions = {}
): UseResizableReturn => {
	const { initialSize, minSize, maxSize, storageKey } = options;

	// Load size from localStorage
	const loadSize = useCallback((): Size => {
		if (storageKey) {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				try {
					const parsed = JSON.parse(saved) as unknown;
					// Проверяем что parsed это объект с width и height
					if (
						typeof parsed === 'object' &&
						parsed !== null &&
						'width' in parsed &&
						'height' in parsed
					) {
						const size = parsed as { width: unknown; height: unknown };
						if (
							typeof size.width === 'number' &&
							typeof size.height === 'number'
						) {
							return { width: size.width, height: size.height };
						}
					}
				} catch {
					// Ignore parse errors
				}
			}
		}
		return initialSize || { width: 600, height: 500 };
	}, [storageKey, initialSize]);

	const [size, setSize] = useState<Size>(loadSize);
	const [isResizing, setIsResizing] = useState(false);
	const [resizeDirection, setResizeDirection] = useState<string | null>(null);
	const resizeStartPos = useRef<{
		x: number;
		y: number;
		width: number;
		height: number;
	}>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	});
	const elementRef = useRef<HTMLDivElement | null>(null);

	// Save size to localStorage
	const saveSize = useCallback(
		(newSize: Size): void => {
			if (storageKey) {
				localStorage.setItem(storageKey, JSON.stringify(newSize));
			}
		},
		[storageKey]
	);

	// Constrain size within min/max bounds
	const constrainSize = useCallback(
		(newSize: Size): Size => {
			let { width, height } = newSize;

			if (minSize) {
				width = Math.max(width, minSize.width);
				height = Math.max(height, minSize.height);
			}

			if (maxSize) {
				width = Math.min(width, maxSize.width);
				height = Math.min(height, maxSize.height);
			}

			// Also constrain to viewport
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			width = Math.min(width, viewportWidth - 20);
			height = Math.min(height, viewportHeight - 20);

			return { width, height };
		},
		[minSize, maxSize]
	);

	const handleResizeStart = useCallback(
		(e: React.MouseEvent, direction: string): void => {
			e.preventDefault();
			e.stopPropagation();

			if (!elementRef.current) {
				return;
			}

			setIsResizing(true);
			setResizeDirection(direction);

			const rect = elementRef.current.getBoundingClientRect();
			resizeStartPos.current = {
				x: e.clientX,
				y: e.clientY,
				width: rect.width,
				height: rect.height,
			};
		},
		[]
	);

	const handleMouseMove = useCallback(
		(e: MouseEvent): void => {
			if (!isResizing || !resizeDirection || !elementRef.current) {
				return;
			}

			const deltaX = e.clientX - resizeStartPos.current.x;
			const deltaY = e.clientY - resizeStartPos.current.y;

			let newWidth = resizeStartPos.current.width;
			let newHeight = resizeStartPos.current.height;

			// Handle different resize directions
			if (resizeDirection.includes('right')) {
				newWidth = resizeStartPos.current.width + deltaX;
			}
			if (resizeDirection.includes('left')) {
				newWidth = resizeStartPos.current.width - deltaX;
			}
			if (resizeDirection.includes('bottom')) {
				newHeight = resizeStartPos.current.height + deltaY;
			}
			if (resizeDirection.includes('top')) {
				newHeight = resizeStartPos.current.height - deltaY;
			}

			const constrainedSize = constrainSize({
				width: newWidth,
				height: newHeight,
			});
			setSize(constrainedSize);
		},
		[isResizing, resizeDirection, constrainSize]
	);

	const handleMouseUp = useCallback((): void => {
		if (isResizing) {
			setIsResizing(false);
			setResizeDirection(null);
			saveSize(size);
		}
	}, [isResizing, size, saveSize]);

	const getResizeCursor = useCallback((direction: string | null): string => {
		if (!direction) {
			return '';
		}
		if (direction === 'right' || direction === 'left') {
			return 'ew-resize';
		}
		if (direction === 'top' || direction === 'bottom') {
			return 'ns-resize';
		}
		if (direction.includes('top') && direction.includes('right')) {
			return 'nesw-resize';
		}
		if (direction.includes('top') && direction.includes('left')) {
			return 'nwse-resize';
		}
		if (direction.includes('bottom') && direction.includes('right')) {
			return 'nwse-resize';
		}
		if (direction.includes('bottom') && direction.includes('left')) {
			return 'nesw-resize';
		}
		return 'move';
	}, []);

	useEffect(() => {
		if (isResizing) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			document.body.style.userSelect = 'none';
			document.body.style.cursor = getResizeCursor(resizeDirection) || '';

			return (): void => {
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
				document.body.style.userSelect = '';
				document.body.style.cursor = '';
			};
		}
		return undefined;
	}, [
		isResizing,
		resizeDirection,
		handleMouseMove,
		handleMouseUp,
		getResizeCursor,
	]);

	// Constrain size on window resize
	useEffect(() => {
		const handleResize = (): void => {
			const constrained = constrainSize(size);
			if (
				constrained.width !== size.width ||
				constrained.height !== size.height
			) {
				setSize(constrained);
				saveSize(constrained);
			}
		};

		window.addEventListener('resize', handleResize);
		return (): void => {
			window.removeEventListener('resize', handleResize);
		};
	}, [size, constrainSize, saveSize]);

	return {
		size,
		isResizing,
		elementRef,
		handleResizeStart,
	};
};
