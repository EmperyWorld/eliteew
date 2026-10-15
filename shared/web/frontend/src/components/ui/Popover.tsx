/**
 * Popover Component
 * Dropdown popover for displaying content overlays
 *
 * @version 1.0.0
 * @date 2025-10-16
 */

import * as React from 'react';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================================
// TYPES
// ============================================================================

interface PopoverProps {
	children: [React.ReactElement, React.ReactElement]; // [Trigger, Content]
}

interface PopoverTriggerProps {
	children: React.ReactElement;
	asChild?: boolean;
}

interface PopoverContentProps {
	children: ReactNode;
	className?: string;
	align?: 'start' | 'center' | 'end';
	side?: 'top' | 'bottom' | 'left' | 'right';
}

// ============================================================================
// CONTEXT
// ============================================================================

interface PopoverContextType {
	isOpen: boolean;
	setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
	triggerRef: React.RefObject<HTMLElement | null>;
}

const PopoverContext = React.createContext<PopoverContextType | null>(null);

const usePopoverContext = (): PopoverContextType => {
	const context = React.useContext(PopoverContext);
	if (!context) {
		throw new Error('Popover components must be used within a Popover');
	}
	return context;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const Popover: React.FC<PopoverProps> = ({ children }) => {
	const [isOpen, setIsOpen] = useState(false);
	const triggerRef = useRef<HTMLElement>(null);

	// Close on escape key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('keydown', handleEscape);
			return (): void => {
				document.removeEventListener('keydown', handleEscape);
			};
		}
	}, [isOpen]);

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent): void => {
			if (
				triggerRef.current &&
				!triggerRef.current.contains(e.target as Node)
			) {
				const popoverContent = document.querySelector('[data-popover-content]');
				if (popoverContent && !popoverContent.contains(e.target as Node)) {
					setIsOpen(false);
				}
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return (): void => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
	}, [isOpen]);

	return (
		<PopoverContext.Provider value={{ isOpen, setIsOpen, triggerRef }}>
			{children}
		</PopoverContext.Provider>
	);
};

// ============================================================================
// TRIGGER COMPONENT
// ============================================================================

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({
	children,
	asChild = false,
}) => {
	const { setIsOpen, triggerRef } = usePopoverContext();

	const handleClick = (): void => {
		setIsOpen((prev: boolean) => !prev);
	};

	if (asChild) {
		return React.cloneElement(children, {
			ref: triggerRef,
			onClick: handleClick,
		} as React.HTMLAttributes<HTMLElement>);
	}

	return (
		<button
			type="button"
			ref={triggerRef as React.RefObject<HTMLButtonElement>}
			onClick={handleClick}
		>
			{children}
		</button>
	);
};

// ============================================================================
// CONTENT COMPONENT
// ============================================================================

export const PopoverContent: React.FC<PopoverContentProps> = ({
	children,
	className = '',
	align = 'center',
	side = 'bottom',
}) => {
	const { isOpen, triggerRef } = usePopoverContext();
	const contentRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ top: 0, left: 0 });

	useEffect(() => {
		if (isOpen && triggerRef.current && contentRef.current) {
			const triggerRect = triggerRef.current.getBoundingClientRect();
			const contentRect = contentRef.current.getBoundingClientRect();

			let top = 0;
			let left = 0;

			// Calculate position based on side
			switch (side) {
				case 'bottom':
					top = triggerRect.bottom + 8;
					break;
				case 'top':
					top = triggerRect.top - contentRect.height - 8;
					break;
				case 'left':
					left = triggerRect.left - contentRect.width - 8;
					top = triggerRect.top;
					break;
				case 'right':
					left = triggerRect.right + 8;
					top = triggerRect.top;
					break;
			}

			// Calculate horizontal alignment
			if (side === 'top' || side === 'bottom') {
				switch (align) {
					case 'start':
						left = triggerRect.left;
						break;
					case 'center':
						left =
							triggerRect.left + triggerRect.width / 2 - contentRect.width / 2;
						break;
					case 'end':
						left = triggerRect.right - contentRect.width;
						break;
				}
			}

			// Ensure content stays within viewport
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			if (left + contentRect.width > viewportWidth) {
				left = viewportWidth - contentRect.width - 8;
			}
			if (left < 8) {
				left = 8;
			}
			if (top + contentRect.height > viewportHeight) {
				top = viewportHeight - contentRect.height - 8;
			}
			if (top < 8) {
				top = 8;
			}

			setPosition({ top, left });
		}
	}, [isOpen, align, side, triggerRef]);

	if (!isOpen) {
		return null;
	}

	return createPortal(
		<AnimatePresence>
			<motion.div
				ref={contentRef}
				data-popover-content
				initial={{ opacity: 0, scale: 0.95, y: -10 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={{ opacity: 0, scale: 0.95, y: -10 }}
				transition={{ duration: 0.15 }}
				className={`fixed z-50 rounded-lg bg-slate-800/95 backdrop-blur-md border border-white/10 shadow-2xl ${className}`}
				style={{
					top: `${position.top}px`,
					left: `${position.left}px`,
				}}
			>
				{children}
			</motion.div>
		</AnimatePresence>,
		document.body
	);
};
