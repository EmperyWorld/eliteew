/**
 * useDraggable - Hook для перемещения виджета по экрану
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface Position {
	x: number;
	y: number;
}

interface UseDraggableOptions {
	initialPosition?: Position;
	storageKey?: string;
	bounds?: {
		left?: number;
		right?: number;
		top?: number;
		bottom?: number;
	};
}

interface UseDraggableReturn {
	position: Position;
	isDragging: boolean;
	elementRef: React.RefObject<HTMLDivElement | null>;
	handleMouseDown: (e: React.MouseEvent) => void;
}

export const useDraggable = (
	options: UseDraggableOptions = {}
): UseDraggableReturn => {
	const { initialPosition, storageKey, bounds } = options;

	// Load position from localStorage
	const loadPosition = useCallback((): Position => {
		if (storageKey) {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				try {
					const parsed = JSON.parse(saved) as unknown;
					// Проверяем что parsed это объект с x и y
					if (
						typeof parsed === 'object' &&
						parsed !== null &&
						'x' in parsed &&
						'y' in parsed
					) {
						const pos = parsed as { x: unknown; y: unknown };
						if (typeof pos.x === 'number' && typeof pos.y === 'number') {
							return { x: pos.x, y: pos.y };
						}
					}
				} catch {
					// Ignore parse errors
				}
			}
		}
		return initialPosition || { x: 0, y: 0 };
	}, [storageKey, initialPosition]);

	const [position, setPosition] = useState<Position>(loadPosition);
	const [isDragging, setIsDragging] = useState(false);
	const dragStartPos = useRef<Position>({ x: 0, y: 0 });
	const elementRef = useRef<HTMLDivElement | null>(null);

	// Save position to localStorage
	const savePosition = useCallback(
		(pos: Position) => {
			if (storageKey) {
				localStorage.setItem(storageKey, JSON.stringify(pos));
			}
		},
		[storageKey]
	);

	// Constrain position within bounds
	const constrainPosition = useCallback(
		(pos: Position): Position => {
			if (!bounds || !elementRef.current) {
				return pos;
			}

			const rect = elementRef.current.getBoundingClientRect();
			const width = rect.width;
			const height = rect.height;
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			let { x, y } = pos;

			if (bounds.left !== undefined) {
				x = Math.max(x, bounds.left);
			}
			if (bounds.right !== undefined) {
				x = Math.min(x, viewportWidth - width - (bounds.right || 0));
			}
			if (bounds.top !== undefined) {
				y = Math.max(y, bounds.top);
			}
			if (bounds.bottom !== undefined) {
				y = Math.min(y, viewportHeight - height - (bounds.bottom || 0));
			}

			return { x, y };
		},
		[bounds]
	);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			const target = e.target as HTMLElement;

			// Don't start drag if clicking on interactive elements (buttons, inputs, etc.)
			if (
				target.closest('button') ||
				target.closest('input') ||
				target.closest('textarea') ||
				target.closest('select')
			) {
				return;
			}

			e.preventDefault();
			e.stopPropagation();

			setIsDragging(true);
			dragStartPos.current = {
				x: e.clientX - position.x,
				y: e.clientY - position.y,
			};
		},
		[position]
	);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging) {
				return;
			}

			const newPosition = constrainPosition({
				x: e.clientX - dragStartPos.current.x,
				y: e.clientY - dragStartPos.current.y,
			});

			setPosition(newPosition);
		},
		[isDragging, constrainPosition]
	);

	const handleMouseUp = useCallback(() => {
		if (isDragging) {
			setIsDragging(false);
			savePosition(position);
		}
	}, [isDragging, position, savePosition]);

	useEffect(() => {
		if (isDragging) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			document.body.style.userSelect = 'none';
			document.body.style.cursor = 'grabbing';

			return (): void => {
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
				document.body.style.userSelect = '';
				document.body.style.cursor = '';
			};
		}
		return undefined;
	}, [isDragging, handleMouseMove, handleMouseUp]);

	// Constrain position on window resize
	useEffect(() => {
		const handleResize = (): void => {
			if (elementRef.current) {
				const constrained = constrainPosition(position);
				if (constrained.x !== position.x || constrained.y !== position.y) {
					setPosition(constrained);
					savePosition(constrained);
				}
			}
		};

		window.addEventListener('resize', handleResize);
		return (): void => {
			window.removeEventListener('resize', handleResize);
		};
	}, [position, constrainPosition, savePosition]);

	return {
		position,
		isDragging,
		elementRef,
		handleMouseDown,
	};
};
