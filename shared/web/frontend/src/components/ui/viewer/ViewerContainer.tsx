/**
 * ============================================
 * FILE: ViewerContainer.tsx
 * ============================================
 *
 * Standard wrapper component for all document/media viewers
 * Provides consistent layout, glassmorphism styling, and responsive behavior
 *
 * Features:
 * - Glassmorphism design with backdrop blur
 * - Flexible layout (toolbar, content, sidebar, statusbar)
 * - Fullscreen mode support
 * - Responsive grid system
 * - Accessibility (ARIA labels, keyboard nav)
 * - Dark mode optimized
 *
 * @version 1.0.0
 * @date 2025-10-24
 * @author UI Designer Agent
 */

import * as React from 'react';
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
	ArrowsPointingInIcon,
	ArrowsPointingOutIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { motion, AnimatePresence } from 'framer-motion';
// ============================================================================
// TYPES
// ============================================================================

export interface ViewerContainerProps {
	/** Main viewer content */
	children: ReactNode;

	/** Toolbar component (top) */
	toolbar?: ReactNode;

	/** Sidebar component (right) */
	sidebar?: ReactNode;

	/** Status bar component (bottom) */
	statusBar?: ReactNode;

	/** Show/hide sidebar */
	showSidebar?: boolean;

	/** Sidebar width in pixels */
	sidebarWidth?: number;

	/** Enable fullscreen mode */
	enableFullscreen?: boolean;

	/** Fullscreen state (controlled) */
	isFullscreen?: boolean;

	/** Fullscreen state change handler */
	onFullscreenChange?: (isFullscreen: boolean) => void;

	/** Show close button */
	showCloseButton?: boolean;

	/** Close handler */
	onClose?: () => void;

	/** Container background style */
	background?: 'glass' | 'solid' | 'transparent';

	/** Additional CSS classes */
	className?: string;

	/** ARIA label */
	ariaLabel?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ViewerContainer: React.FC<ViewerContainerProps> = ({
	children,
	toolbar,
	sidebar,
	statusBar,
	showSidebar = false,
	sidebarWidth = 320,
	enableFullscreen = true,
	isFullscreen: controlledFullscreen,
	onFullscreenChange,
	showCloseButton = false,
	onClose,
	background = 'glass',
	className = '',
	ariaLabel = 'Document viewer',
}) => {
	// Internal fullscreen state (if not controlled)
	const [internalFullscreen, setInternalFullscreen] = useState(false);
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	// Use controlled or internal state
	const isFullscreen =
		controlledFullscreen !== undefined
			? controlledFullscreen
			: internalFullscreen;

	// Toggle fullscreen
	const toggleFullscreen = useCallback(() => {
		const newState = !isFullscreen;

		if (controlledFullscreen === undefined) {
			setInternalFullscreen(newState);
		}

		onFullscreenChange?.(newState);
	}, [isFullscreen, controlledFullscreen, onFullscreenChange]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent): void => {
			// F11 or Ctrl+F: Toggle fullscreen
			if (e.key === 'F11' || (e.ctrlKey && e.key === 'f')) {
				e.preventDefault();
				if (enableFullscreen) {
					toggleFullscreen();
				}
			}

			// Escape: Exit fullscreen
			if (e.key === 'Escape' && isFullscreen) {
				toggleFullscreen();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [enableFullscreen, isFullscreen, toggleFullscreen]);

	// Background styles
	const backgroundStyles = {
		glass: 'bg-slate-900/40 backdrop-blur-2xl border border-white/10',
		solid: 'bg-slate-900',
		transparent: 'bg-transparent',
	};

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.98 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.98 }}
			transition={{ duration: 0.2 }}
			className={`
        ${isFullscreen ? 'fixed inset-0' : 'relative w-full h-full'}
        ${backgroundStyles[background]}
        rounded-xl shadow-2xl
        flex flex-col
        overflow-hidden
        ${className}
      `}
			style={isFullscreen ? { zIndex: embeddedModalZ.content } : undefined}
			role="region"
			aria-label={ariaLabel}
		>
			{/* Toolbar */}
			{toolbar && (
				<div className="shrink-0 border-b border-white/10">
					<div className="flex items-center justify-between">
						<div className="flex-1">{toolbar}</div>

						{/* Fullscreen/Close buttons */}
						<div className="flex items-center gap-2 px-4">
							{enableFullscreen && (
								<button
									type="button"
									onClick={toggleFullscreen}
									className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
									title={
										isFullscreen
											? 'Exit fullscreen (F11)'
											: 'Enter fullscreen (F11)'
									}
									aria-label={
										isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
									}
								>
									{isFullscreen ? (
										<ArrowsPointingInIcon className="w-5 h-5 text-white/80" />
									) : (
										<ArrowsPointingOutIcon className="w-5 h-5 text-white/80" />
									)}
								</button>
							)}

							{showCloseButton && onClose && (
								<button
									type="button"
									onClick={onClose}
									className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg transition-colors"
									title="Close viewer"
									aria-label="Close viewer"
								>
									<XMarkIcon className="w-5 h-5 text-white/80 hover:text-red-400" />
								</button>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Main content area + sidebar */}
			<div className="flex-1 flex overflow-hidden">
				{/* Content */}
				<div
					className="flex-1 overflow-auto"
					style={{
						width: showSidebar ? `calc(100% - ${sidebarWidth}px)` : '100%',
					}}
				>
					{children}
				</div>

				{/* Sidebar */}
				<AnimatePresence>
					{showSidebar && sidebar && (
						<motion.aside
							initial={{ x: sidebarWidth }}
							animate={{ x: 0 }}
							exit={{ x: sidebarWidth }}
							transition={{ type: 'spring', stiffness: 300, damping: 30 }}
							className="shrink-0 border-l border-white/10 overflow-y-auto"
							style={{ width: sidebarWidth }}
							role="complementary"
							aria-label="Viewer sidebar"
						>
							{sidebar}
						</motion.aside>
					)}
				</AnimatePresence>
			</div>

			{/* Status bar */}
			{statusBar && (
				<div className="shrink-0 border-t border-white/10">{statusBar}</div>
			)}
		</motion.div>
	);
};

export default ViewerContainer;
