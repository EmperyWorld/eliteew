/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Production tooltip with smart positioning, coordinator-backed singleton visibility,
 * and pointer-integrity recovery when `pointerleave` is lost.
 *
 * Related:
 * - tooltipCoordinator.ts
 * - pages/Desktop/components/DesktopChromeTooltip.tsx
 */

import * as React from 'react';
import {
	useId,
	useLayoutEffect,
	useState,
	useRef,
	useEffect,
	useCallback,
	type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DESKTOP_Z_INDEX } from '@/pages/Desktop/constants';
import { cn } from '../../utils/cn';
import {
	dismissAllCoordinatorTooltips,
	notifyTooltipCoordinatorHidden,
	notifyTooltipCoordinatorShown,
	registerTooltipCoordinatorHandle,
} from './tooltipCoordinator';

// ============================================================================
// TYPES
// ============================================================================

export type TooltipPlacement =
	| 'top'
	| 'right'
	| 'bottom'
	| 'left'
	| 'bottom-start'
	| 'top-start';

export interface TooltipV2Props {
	content: React.ReactNode;
	children: ReactElement;
	placement?: TooltipPlacement;
	offsetExtra?: number;
	delayShow?: number;
	delayHide?: number;
	disabled?: boolean;
	showArrow?: boolean;
	className?: string;
	fullWidth?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const TooltipV2: React.FC<TooltipV2Props> = ({
	content,
	children,
	placement = 'top',
	offsetExtra = 0,
	delayShow = 400,
	delayHide = 80,
	disabled = false,
	showArrow = true,
	className,
	fullWidth = false,
}) => {
	const styledTooltipsGloballyDisabled =
		typeof document !== 'undefined' &&
		document.getElementById('desktop-main')?.dataset.desktopStyledTooltips ===
			'false';
	const effectiveDisabled = disabled || styledTooltipsGloballyDisabled;
	const [isVisible, setIsVisible] = useState(false);
	const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
	const tooltipId = useId();
	const triggerRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const hoverSessionRef = useRef(0);

	const calculatePosition = useCallback(() => {
		if (!triggerRef.current || !tooltipRef.current) {
			return;
		}

		const triggerRect = triggerRef.current.getBoundingClientRect();
		const tooltipRect = tooltipRef.current.getBoundingClientRect();
		const offset = 8 + offsetExtra;
		const arrowSize = showArrow ? 6 : 0;

		let top = 0;
		let left = 0;

		switch (placement) {
			case 'top':
			case 'top-start':
				top = triggerRect.top - tooltipRect.height - offset - arrowSize;
				left =
					placement === 'top-start'
						? triggerRect.left
						: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
				break;
			case 'bottom':
			case 'bottom-start':
				top = triggerRect.bottom + offset + arrowSize;
				left =
					placement === 'bottom-start'
						? triggerRect.left
						: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
				break;
			case 'left':
				top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				left = triggerRect.left - tooltipRect.width - offset - arrowSize;
				break;
			case 'right':
				top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
				left = triggerRect.right + offset + arrowSize;
				break;
		}

		const padding = 8;
		if (left < padding) {
			left = padding;
		}
		if (left + tooltipRect.width > window.innerWidth - padding) {
			left = window.innerWidth - tooltipRect.width - padding;
		}
		if (top < padding) {
			top = padding;
		}
		if (top + tooltipRect.height > window.innerHeight - padding) {
			top = window.innerHeight - tooltipRect.height - padding;
		}

		setTooltipPosition({ top, left });
	}, [placement, showArrow, offsetExtra]);

	const handleShow = useCallback(() => {
		if (effectiveDisabled) {
			return;
		}
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
			hideTimeoutRef.current = null;
		}
		showTimeoutRef.current = setTimeout(() => {
			setIsVisible(true);
		}, delayShow);
	}, [delayShow, effectiveDisabled]);

	const handleHide = useCallback(() => {
		if (showTimeoutRef.current) {
			clearTimeout(showTimeoutRef.current);
			showTimeoutRef.current = null;
		}
		hideTimeoutRef.current = setTimeout(() => {
			setIsVisible(false);
		}, delayHide);
	}, [delayHide]);

	const handleForceHide = useCallback(() => {
		if (showTimeoutRef.current) {
			clearTimeout(showTimeoutRef.current);
			showTimeoutRef.current = null;
		}
		if (hideTimeoutRef.current) {
			clearTimeout(hideTimeoutRef.current);
			hideTimeoutRef.current = null;
		}
		hoverSessionRef.current = 0;
		setIsVisible(false);
	}, []);

	const beginHoverSession = useCallback(() => {
		if (effectiveDisabled) {
			return;
		}
		hoverSessionRef.current += 1;
		if (hoverSessionRef.current === 1) {
			handleShow();
		}
	}, [effectiveDisabled, handleShow]);

	const endHoverSession = useCallback(() => {
		if (hoverSessionRef.current <= 0) {
			return;
		}
		hoverSessionRef.current -= 1;
		if (hoverSessionRef.current === 0) {
			handleHide();
		}
	}, [handleHide]);

	useEffect(() => {
		return registerTooltipCoordinatorHandle({
			id: tooltipId,
			getTrigger: () => triggerRef.current,
			forceHide: handleForceHide,
		});
	}, [tooltipId, handleForceHide]);

	useEffect(() => {
		if (!isVisible) {
			notifyTooltipCoordinatorHidden(tooltipId);
			return;
		}
		const trigger = triggerRef.current;
		if (!trigger) {
			return;
		}
		notifyTooltipCoordinatorShown(tooltipId, trigger, handleForceHide);
		return () => {
			notifyTooltipCoordinatorHidden(tooltipId);
		};
	}, [isVisible, tooltipId, handleForceHide]);

	useLayoutEffect(() => {
		if (isVisible) {
			calculatePosition();
			const handleRecalculate = () => calculatePosition();
			window.addEventListener('scroll', handleRecalculate, true);
			window.addEventListener('resize', handleRecalculate);
			return () => {
				window.removeEventListener('scroll', handleRecalculate, true);
				window.removeEventListener('resize', handleRecalculate);
			};
		}
	}, [isVisible, calculatePosition]);

	useEffect(() => {
		return () => {
			if (showTimeoutRef.current) {
				clearTimeout(showTimeoutRef.current);
			}
			if (hideTimeoutRef.current) {
				clearTimeout(hideTimeoutRef.current);
			}
			notifyTooltipCoordinatorHidden(tooltipId);
		};
	}, [tooltipId]);

	const arrowStyles: Record<TooltipPlacement, string> = {
		top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
		'top-start':
			'bottom-[-6px] left-4 border-l-transparent border-r-transparent border-b-transparent',
		bottom:
			'top-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
		'bottom-start':
			'top-[-6px] left-4 border-l-transparent border-r-transparent border-t-transparent',
		left: 'right-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
		right:
			'left-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent',
	};

	return (
		<>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: hover/focus bridge for arbitrary focusable children */}
			<div
				ref={triggerRef}
				onPointerEnter={beginHoverSession}
				onPointerLeave={endHoverSession}
				onMouseEnter={beginHoverSession}
				onMouseLeave={endHoverSession}
				onFocus={handleShow}
				onBlur={handleForceHide}
				className={cn(
					fullWidth
						? 'block w-full min-w-0'
						: 'inline-flex items-center justify-center align-top'
				)}
				style={{
					padding: '4px',
					margin: '-4px',
				}}
				aria-describedby={isVisible ? tooltipId : undefined}
			>
				{children}
			</div>

			{createPortal(
				<AnimatePresence>
					{isVisible && (
						<motion.div
							ref={tooltipRef}
							id={tooltipId}
							role="tooltip"
							className={cn(
								'fixed max-w-xs px-3 py-2 rounded-lg',
								'bg-slate-900/95 backdrop-blur-xl',
								'border border-white/20',
								'text-white text-sm wrap-break-word',
								'shadow-2xl',
								'pointer-events-none',
								className
							)}
							style={{
								top: `${tooltipPosition.top}px`,
								left: `${tooltipPosition.left}px`,
								zIndex: DESKTOP_Z_INDEX.TOAST,
							}}
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							transition={{ duration: 0.15 }}
						>
							{content}

							{showArrow && (
								<div
									className={cn(
										'absolute w-0 h-0',
										'border-[6px] border-slate-900/95',
										arrowStyles[placement]
									)}
								/>
							)}
						</motion.div>
					)}
				</AnimatePresence>,
				document.body
			)}
		</>
	);
};

TooltipV2.displayName = 'TooltipV2';

export { dismissAllCoordinatorTooltips as dismissAllTooltips };
