/**
 * ============================================
 * FILE: ViewerToolbar.tsx
 * ============================================
 *
 * Common toolbar for document/media viewers
 * Provides zoom, download, share, print, and navigation controls
 *
 * Features:
 * - Zoom controls (in/out, fit to width/height/page, percentage selector)
 * - ArrowDownTrayIcon button with format options
 * - Share button with link generation
 * - Print button
 * - Rotate controls (for images/PDFs)
 * - Navigation (page up/down for multi-page documents)
 * - Responsive layout (collapse to dropdown on mobile)
 * - Accessibility (ARIA labels, keyboard shortcuts)
 *
 * @version 1.0.0
 * @date 2025-10-24
 * @author UI Designer Agent
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	ArrowUturnLeftIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	MagnifyingGlassMinusIcon,
	MagnifyingGlassPlusIcon,
	PrinterIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
// ============================================================================
// TYPES
// ============================================================================

export type ZoomLevel = number | 'fit-width' | 'fit-height' | 'fit-page';

export interface ViewerToolbarProps {
	/** Current zoom level (percentage or fit mode) */
	zoom?: ZoomLevel;

	/** Zoom change handler */
	onZoomChange?: (zoom: ZoomLevel) => void;

	/** Enable zoom controls */
	showZoomControls?: boolean;

	/** ArrowDownTrayIcon handler */
	onDownload?: (format?: string) => void;

	/** ArrowDownTrayIcon formats available */
	downloadFormats?: { value: string; label: string }[];

	/** Share handler */
	onShare?: () => void;

	/** Print handler */
	onPrint?: () => void;

	/** Rotate clockwise handler */
	onRotateRight?: () => void;

	/** Rotate counter-clockwise handler */
	onRotateLeft?: () => void;

	/** Enable rotation controls */
	showRotation?: boolean;

	/** Current page (for multi-page documents) */
	currentPage?: number;

	/** Total pages */
	totalPages?: number;

	/** Page change handler */
	onPageChange?: (page: number) => void;

	/** Additional custom actions */
	customActions?: React.ReactNode;

	/** Compact mode (for small screens) */
	compact?: boolean;

	/** Additional CSS classes */
	className?: string;
}

// ============================================================================
// ZOOM PRESETS
// ============================================================================

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 300, 400];

// ============================================================================
// COMPONENT
// ============================================================================

const ViewerToolbar: React.FC<ViewerToolbarProps> = ({
	zoom = 100,
	onZoomChange,
	showZoomControls = true,
	onDownload,
	downloadFormats = [
		{ value: 'original', label: 'Original' },
		{ value: 'pdf', label: 'PDF' },
		{ value: 'png', label: 'PNG' },
	],
	onShare,
	onPrint,
	onRotateRight,
	onRotateLeft,
	showRotation = false,
	currentPage,
	totalPages,
	onPageChange,
	customActions,
	compact: _compact = false,
	className = '',
}) => {
	const [showZoomDropdown, setShowZoomDropdown] = useState(false);
	const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
	const [_showMobileMenu, _setShowMobileMenu] = useState(false);

	const zoomDropdownRef = useRef<HTMLDivElement>(null);
	const downloadDropdownRef = useRef<HTMLDivElement>(null);

	// Get zoom display value
	const getZoomDisplay = useCallback(() => {
		if (zoom === 'fit-width') {
			return 'Fit Width';
		}
		if (zoom === 'fit-height') {
			return 'Fit Height';
		}
		if (zoom === 'fit-page') {
			return 'Fit Page';
		}
		return `${zoom}%`;
	}, [zoom]);

	// Zoom in
	const handleZoomIn = useCallback(() => {
		if (typeof zoom === 'number') {
			const currentIndex = ZOOM_PRESETS.indexOf(zoom);
			const nextZoom =
				currentIndex < ZOOM_PRESETS.length - 1
					? ZOOM_PRESETS[currentIndex + 1]
					: Math.min(zoom + 25, 400);
			onZoomChange?.(nextZoom);
		} else {
			onZoomChange?.(100);
		}
	}, [zoom, onZoomChange]);

	// Zoom out
	const handleZoomOut = useCallback(() => {
		if (typeof zoom === 'number') {
			const currentIndex = ZOOM_PRESETS.indexOf(zoom);
			const prevZoom =
				currentIndex > 0
					? ZOOM_PRESETS[currentIndex - 1]
					: Math.max(zoom - 25, 25);
			onZoomChange?.(prevZoom);
		} else {
			onZoomChange?.(100);
		}
	}, [zoom, onZoomChange]);

	// Close dropdowns on outside click
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				zoomDropdownRef.current &&
				!zoomDropdownRef.current.contains(event.target as Node)
			) {
				setShowZoomDropdown(false);
			}
			if (
				downloadDropdownRef.current &&
				!downloadDropdownRef.current.contains(event.target as Node)
			) {
				setShowDownloadDropdown(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl/Cmd + Plus: Zoom in
			if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
				e.preventDefault();
				handleZoomIn();
			}

			// Ctrl/Cmd + Minus: Zoom out
			if ((e.ctrlKey || e.metaKey) && e.key === '-') {
				e.preventDefault();
				handleZoomOut();
			}

			// Ctrl/Cmd + 0: Reset to 100%
			if ((e.ctrlKey || e.metaKey) && e.key === '0') {
				e.preventDefault();
				onZoomChange?.(100);
			}

			// Ctrl/Cmd + P: Print
			if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
				e.preventDefault();
				onPrint?.();
			}

			// PageUp/PageDown: Navigate pages
			if (currentPage !== undefined && totalPages !== undefined) {
				if (e.key === 'PageUp' && currentPage > 1) {
					e.preventDefault();
					onPageChange?.(currentPage - 1);
				}
				if (e.key === 'PageDown' && currentPage < totalPages) {
					e.preventDefault();
					onPageChange?.(currentPage + 1);
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		handleZoomIn,
		handleZoomOut,
		onZoomChange,
		onPrint,
		currentPage,
		totalPages,
		onPageChange,
	]);

	return (
		<div
			className={`
        flex items-center justify-between gap-2 px-4 py-3
        bg-white/5
        ${className}
      `}
			role="toolbar"
			aria-label="Viewer controls"
		>
			{/* Left section - Zoom controls */}
			{showZoomControls && (
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleZoomOut}
						disabled={typeof zoom === 'number' && zoom <= 25}
						className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						title="Zoom out (Ctrl + -)"
						aria-label="Zoom out"
					>
						<MagnifyingGlassMinusIcon className="w-4 h-4 text-white/80" />
					</button>

					{/* Zoom level dropdown */}
					<div className="relative" ref={zoomDropdownRef}>
						<button
							type="button"
							onClick={() => setShowZoomDropdown(!showZoomDropdown)}
							className="min-w-[100px] px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg transition-colors text-sm text-white/90"
						>
							{getZoomDisplay()}
						</button>

						<AnimatePresence>
							{showZoomDropdown && (
								<motion.div
									initial={{ opacity: 0, y: -10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -10 }}
									transition={{ duration: 0.15 }}
									className="absolute top-full left-0 mt-2 w-40 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl overflow-hidden z-50"
								>
									{/* Fit modes */}
									<div className="border-b border-white/10">
										{[
											{ value: 'fit-page' as const, label: 'Fit Page' },
											{ value: 'fit-width' as const, label: 'Fit Width' },
											{ value: 'fit-height' as const, label: 'Fit Height' },
										].map(({ value, label }) => (
											<button
												type="button"
												key={value}
												onClick={() => {
													onZoomChange?.(value);
													setShowZoomDropdown(false);
												}}
												className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 transition-colors flex items-center justify-between"
											>
												<span>{label}</span>
												{zoom === value && (
													<CheckIcon className="w-4 h-4 text-purple-400" />
												)}
											</button>
										))}
									</div>

									{/* Zoom presets */}
									<div className="max-h-48 overflow-y-auto">
										{ZOOM_PRESETS.map((preset) => (
											<button
												type="button"
												key={preset}
												onClick={() => {
													onZoomChange?.(preset);
													setShowZoomDropdown(false);
												}}
												className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 transition-colors flex items-center justify-between"
											>
												<span>{preset}%</span>
												{zoom === preset && (
													<CheckIcon className="w-4 h-4 text-purple-400" />
												)}
											</button>
										))}
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					<button
						type="button"
						onClick={handleZoomIn}
						disabled={typeof zoom === 'number' && zoom >= 400}
						className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						title="Zoom in (Ctrl + +)"
						aria-label="Zoom in"
					>
						<MagnifyingGlassPlusIcon className="w-4 h-4 text-white/80" />
					</button>
				</div>
			)}

			{/* Center section - Page navigation */}
			{currentPage !== undefined &&
				totalPages !== undefined &&
				totalPages > 1 && (
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => onPageChange?.(currentPage - 1)}
							disabled={currentPage <= 1}
							className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							title="Previous page (PageUp)"
							aria-label="Previous page"
						>
							<ChevronLeftIcon className="w-4 h-4 text-white/80" />
						</button>

						<div className="text-sm text-white/80">
							<span className="font-medium text-white">{currentPage}</span>
							<span className="mx-1">/</span>
							<span>{totalPages}</span>
						</div>

						<button
							type="button"
							onClick={() => onPageChange?.(currentPage + 1)}
							disabled={currentPage >= totalPages}
							className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							title="Next page (PageDown)"
							aria-label="Next page"
						>
							<ChevronRightIcon className="w-4 h-4 text-white/80" />
						</button>
					</div>
				)}

			{/* Right section - Actions */}
			<div className="flex items-center gap-2">
				{/* Rotation controls */}
				{showRotation && (
					<>
						<button
							type="button"
							onClick={onRotateLeft}
							className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
							title="Rotate counter-clockwise"
							aria-label="Rotate counter-clockwise"
						>
							<ArrowUturnLeftIcon className="w-4 h-4 text-white/80" />
						</button>

						<button
							type="button"
							onClick={onRotateRight}
							className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
							title="Rotate clockwise"
							aria-label="Rotate clockwise"
						>
							<ArrowPathIcon className="w-4 h-4 text-white/80" />
						</button>

						<div className="w-px h-6 bg-white/10" />
					</>
				)}

				{/* Print */}
				{onPrint && (
					<button
						type="button"
						onClick={onPrint}
						className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
						title="Print (Ctrl + P)"
						aria-label="Print"
					>
						<PrinterIcon className="w-4 h-4 text-white/80" />
					</button>
				)}

				{/* Share */}
				{onShare && (
					<button
						type="button"
						onClick={onShare}
						className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
						title="Share"
						aria-label="Share"
					>
						<ArrowTopRightOnSquareIcon className="w-4 h-4 text-white/80" />
					</button>
				)}

				{/* ArrowDownTrayIcon */}
				{onDownload && (
					<div className="relative" ref={downloadDropdownRef}>
						<button
							type="button"
							onClick={() =>
								downloadFormats.length > 1
									? setShowDownloadDropdown(!showDownloadDropdown)
									: onDownload()
							}
							className="p-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg transition-colors"
							title="ArrowDownTrayIcon"
							aria-label="ArrowDownTrayIcon"
						>
							<ArrowDownTrayIcon className="w-4 h-4 text-purple-400" />
						</button>

						{downloadFormats.length > 1 && (
							<AnimatePresence>
								{showDownloadDropdown && (
									<motion.div
										initial={{ opacity: 0, y: -10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -10 }}
										transition={{ duration: 0.15 }}
										className="absolute top-full right-0 mt-2 w-40 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-xl overflow-hidden z-50"
									>
										{downloadFormats.map(({ value, label }) => (
											<button
												type="button"
												key={value}
												onClick={() => {
													onDownload(value);
													setShowDownloadDropdown(false);
												}}
												className="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 transition-colors"
											>
												{label}
											</button>
										))}
									</motion.div>
								)}
							</AnimatePresence>
						)}
					</div>
				)}

				{/* Custom actions */}
				{customActions}
			</div>
		</div>
	);
};

export default ViewerToolbar;
