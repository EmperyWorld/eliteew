import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { cva, type VariantProps } from '@/utils/cva';
import {
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
} from '../../pages/Desktop/constants';
import { useTranslation } from 'react-i18next';
import { useDesktopShellFrame } from '../../pages/Desktop/context/DesktopShellFrameContext';
import {
	DESKTOP_WINDOW_FRAME_STYLES,
	getDesktopShellFooterStripClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellPanelClassName,
} from '../../pages/Desktop/utils/desktopVisualSystem';
import { cn } from '../../utils/cn';
import { zIndex } from '../../styles/tokens';
import {
	useShellCaptureEscape,
	consumeEscapeForSearchClear,
} from '../../pages/Desktop/hooks/useShellCaptureKeyboard';

/* ============================================================================
	 MODAL VARIANTS - Design System
	 ============================================================================ */

const modalVariants = cva(
	'relative w-full max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl backdrop-blur-xl',
	{
		variants: {
			variant: {
				default: 'bg-black/80 border border-white/20',
				/**
				 * Readable glass — not `bg-white/5` (dialog body becomes invisible over desktop).
				 * Prefer `desktop` on `#desktop-main` for shell-panel chrome.
				 */
				glass:
					'bg-[color-mix(in_srgb,var(--glass-bg-strong,rgba(15,23,42,0.92))_94%,rgb(15_23_42)_6%)] backdrop-blur-2xl border border-white/15 text-white shadow-2xl',
				gradient:
					'bg-linear-to-br from-purple-500/10 via-pink-500/10 to-rose-500/10 backdrop-blur-xl border border-purple-500/20',
				solid: 'bg-slate-900 border border-white/10',
				/** Рабочий стол: токены `--desktop-*` с `#desktop-main` (светлая/тёмная тема) */
				desktop:
					'bg-[color-mix(in_srgb,var(--glass-bg-strong)_92%,var(--desktop-menu-tint)_8%)] border border-(--desktop-border-strong) text-(--desktop-text-primary) shadow-(--desktop-shadow-panel)',
			},
			size: {
				sm: 'max-w-md',
				md: 'max-w-lg',
				lg: 'max-w-2xl',
				xl: 'max-w-4xl',
				full: 'max-w-7xl mx-4',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'md',
		},
	}
);

/* ============================================================================
	 ANIMATION VARIANTS
	 ============================================================================ */

const animationVariants = {
	/** Только opacity — дешевле для GPU (desktop shell). */
	fade: {
		initial: { opacity: 0 },
		animate: { opacity: 1 },
		exit: { opacity: 0 },
	},
	fadeScale: {
		initial: { opacity: 0, scale: 0.9 },
		animate: { opacity: 1, scale: 1 },
		exit: { opacity: 0, scale: 0.9 },
	},
	slideUp: {
		initial: { opacity: 0, y: 100 },
		animate: { opacity: 1, y: 0 },
		exit: { opacity: 0, y: 100 },
	},
	slideDown: {
		initial: { opacity: 0, y: -100 },
		animate: { opacity: 1, y: 0 },
		exit: { opacity: 0, y: -100 },
	},
	slideLeft: {
		initial: { opacity: 0, x: 100 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: 100 },
	},
	slideRight: {
		initial: { opacity: 0, x: -100 },
		animate: { opacity: 1, x: 0 },
		exit: { opacity: 0, x: -100 },
	},
	flip: {
		initial: { opacity: 0, rotateX: -90 },
		animate: { opacity: 1, rotateX: 0 },
		exit: { opacity: 0, rotateX: 90 },
	},
	zoom: {
		initial: { opacity: 0, scale: 0 },
		animate: { opacity: 1, scale: 1 },
		exit: { opacity: 0, scale: 0 },
	},
};

/* ============================================================================
	 TYPES
	 ============================================================================ */

export type AnimationType = keyof typeof animationVariants;

export interface ModalAdvancedProps extends VariantProps<typeof modalVariants> {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	closeOnOverlay?: boolean;
	closeOnEscape?: boolean;
	/** Window capture Escape + stopPropagation (default true for `variant="desktop"`). */
	escapeCapture?: boolean;
	/** Marks dialog root as shell keyboard surface (default true for desktop variant). */
	shellKeyboardSurface?: boolean;
	/** Return true to consume Escape without calling `onClose` (layered dismiss). */
	onEscapeLayer?: () => boolean;
	/** When set with `onSearchEscapeClear`, Escape clears search before `onClose`. */
	searchEscapeValue?: string;
	onSearchEscapeClear?: () => void;
	showCloseButton?: boolean;
	/** When false, Tab/arrows are not trapped; use for CommandPalette, TaskSwitcher, etc. */
	trapFocus?: boolean;
	animation?: AnimationType;
	className?: string;
	/** Optional id of element(s) describing the dialog (e.g. long legal/destructive copy). */
	ariaDescribedBy?: string;
	/** Extra classes on the scrollable body wrapper around `{children}`. */
	contentClassName?: string;
}

/* ============================================================================
	 MODAL COMPONENT
	 ============================================================================ */

export const ModalAdvanced: React.FC<ModalAdvancedProps> = ({
	isOpen,
	onClose,
	title,
	children,
	footer,
	closeOnOverlay = true,
	closeOnEscape = true,
	escapeCapture,
	shellKeyboardSurface,
	onEscapeLayer,
	searchEscapeValue,
	onSearchEscapeClear,
	showCloseButton = true,
	trapFocus = true,
	animation = 'fadeScale',
	variant,
	size,
	className,
	ariaDescribedBy,
	contentClassName,
}) => {
	const reduceMotion = useReducedMotion();
	const { t } = useTranslation('desktopUi');
	const modalRef = useRef<HTMLDivElement>(null);
	const previouslyFocusedElement = useRef<HTMLElement | null>(null);
	const useDesktopChrome = variant === 'desktop';
	const resolvedEscapeCapture = escapeCapture ?? useDesktopChrome;
	const resolvedShellKeyboardSurface = shellKeyboardSurface ?? useDesktopChrome;
	/** Desktop: без scale/spring на диалоге (см. DESKTOP-WINDOW-RUNTIME-PERFORMANCE, волна 18). */
	const resolvedAnimation: AnimationType =
		useDesktopChrome && animation === 'fadeScale' ? 'fade' : animation;
	const shellFrame = useDesktopShellFrame();
	const shellPreset = useMemo(
		() =>
			DESKTOP_WINDOW_FRAME_STYLES[shellFrame] ??
			DESKTOP_WINDOW_FRAME_STYLES.glass,
		[shellFrame]
	);

	const desktopModalSizeClass =
		size === 'sm'
			? 'max-w-md'
			: size === 'md'
				? 'max-w-lg'
				: size === 'lg'
					? 'max-w-2xl'
					: size === 'xl'
						? 'max-w-4xl'
						: size === 'full'
							? 'max-w-7xl mx-4'
							: 'max-w-lg';

	/* ========================================================================
		 FOCUS TRAP & KEYBOARD HANDLING
		 ======================================================================== */

	const hasEscapeLayer = onEscapeLayer != null || onSearchEscapeClear != null;

	const handleEscapeLayer = useCallback((): boolean => {
		if (onEscapeLayer?.()) return true;
		if (onSearchEscapeClear != null) {
			return consumeEscapeForSearchClear(
				searchEscapeValue ?? '',
				onSearchEscapeClear
			);
		}
		return false;
	}, [onEscapeLayer, searchEscapeValue, onSearchEscapeClear]);

	useShellCaptureEscape(
		isOpen && closeOnEscape && resolvedEscapeCapture,
		onClose,
		hasEscapeLayer ? { onLayer: handleEscapeLayer } : undefined
	);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		// Save currently focused element
		previouslyFocusedElement.current = document.activeElement as HTMLElement;

		if (trapFocus) {
			requestAnimationFrame(() => {
				const modal = modalRef.current;
				if (!modal) return;
				const focusable = modal.querySelectorAll<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
				);
				const first = focusable[0];
				if (first) first.focus();
				else modal.focus();
			});
		}

		document.body.style.overflow = 'hidden';

		const handleEscape = (e: KeyboardEvent): void => {
			if (e.key === 'Escape' && closeOnEscape && !resolvedEscapeCapture) {
				onClose();
			}
		};

		const handleTab = (e: KeyboardEvent): void => {
			if (e.key !== 'Tab' || !trapFocus) return;
			const modal = modalRef.current;
			if (!modal) return;
			const focusableElements = modal.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];
			if (e.shiftKey) {
				if (document.activeElement === firstElement) {
					e.preventDefault();
					lastElement?.focus();
				}
			} else {
				if (document.activeElement === lastElement) {
					e.preventDefault();
					firstElement?.focus();
				}
			}
		};

		document.addEventListener('keydown', handleEscape);
		document.addEventListener('keydown', handleTab);

		return (): void => {
			document.removeEventListener('keydown', handleEscape);
			document.removeEventListener('keydown', handleTab);
			document.body.style.overflow = 'unset';
			const toRestore = previouslyFocusedElement.current;
			previouslyFocusedElement.current = null;
			if (toRestore && document.contains(toRestore)) {
				requestAnimationFrame(() => {
					try {
						toRestore.focus({ preventScroll: true });
					} catch {
						/* ignore */
					}
				});
			}
		};
	}, [isOpen, closeOnEscape, onClose, trapFocus, resolvedEscapeCapture]);

	/* ========================================================================
		 RENDER
		 ======================================================================== */

	return (
		<AnimatePresence mode="wait">
			{isOpen && (
				<div
					className="fixed inset-0 flex items-center justify-center p-4"
					style={{ zIndex: zIndex.modal }}
				>
					{/* Backdrop */}
					<motion.div
						className={cn(
							'absolute inset-0',
							useDesktopChrome
								? DESKTOP_OVERLAY.backdrop
								: 'bg-black/70 backdrop-blur-xs'
						)}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onClick={closeOnOverlay ? onClose : undefined}
					/>

					{/* Modal */}
					<motion.div
						ref={modalRef}
						className={cn(
							useDesktopChrome
								? cn(
										'relative flex w-full max-h-[90vh] flex-col overflow-hidden text-(--desktop-text-primary)',
										getDesktopShellPanelClassName(shellFrame, 'strong'),
										desktopModalSizeClass
									)
								: modalVariants({ variant, size }),
							className
						)}
						role="dialog"
						aria-modal="true"
						aria-labelledby={title ? 'modal-title' : undefined}
						aria-describedby={ariaDescribedBy}
						tabIndex={-1}
						{...(resolvedShellKeyboardSurface
							? { 'data-desktop-shell-keyboard-surface': '' }
							: {})}
						{...animationVariants[resolvedAnimation]}
						transition={
							useDesktopChrome
								? { duration: 0.18, ease: [0.33, 1, 0.68, 1] }
								: {
										duration: 0.3,
										type: 'spring',
										damping: 25,
										stiffness: 300,
									}
						}
					>
						{/* Header */}
						{(title || showCloseButton) && (
							<div
								className={cn(
									'flex shrink-0 items-center justify-between gap-3',
									useDesktopChrome
										? cn(
												'px-4 py-3 sm:px-6 sm:py-4',
												getDesktopShellHeaderStripClassName(shellFrame)
											)
										: 'border-b border-white/10 p-6'
								)}
							>
								{title &&
									(useDesktopChrome ? (
										<h2
											id="modal-title"
											className={cn(DESKTOP_TYPOGRAPHY.subtitle)}
										>
											{title}
										</h2>
									) : (
										<motion.h2
											id="modal-title"
											className={cn('text-xl font-semibold text-white')}
											initial={{ opacity: 0, x: -20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ duration: 0.3, delay: 0.1 }}
										>
											{title}
										</motion.h2>
									))}

								{showCloseButton &&
									(useDesktopChrome ? (
										<button
											type="button"
											onClick={onClose}
											className={cn(
												'ml-auto rounded-lg p-2 transition-colors duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
												'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary) focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-(--desktop-surface-panel)'
											)}
											aria-label={t('modal.close')}
										>
											<XMarkIcon className="h-5 w-5" aria-hidden />
										</button>
									) : (
										<motion.button
											type="button"
											onClick={onClose}
											className={cn(
												'ml-auto rounded-lg p-2 transition-colors duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
												'text-white/60 hover:bg-white/10 hover:text-white focus-visible:ring-white/40 focus-visible:ring-offset-slate-900'
											)}
											whileHover={
												reduceMotion ? undefined : { scale: 1.1, rotate: 90 }
											}
											whileTap={reduceMotion ? undefined : { scale: 0.9 }}
											aria-label={t('modal.close')}
										>
											<XMarkIcon className="h-5 w-5" aria-hidden />
										</motion.button>
									))}
							</div>
						)}

						{/* Content */}
						{useDesktopChrome ? (
							<div
								className={cn(
									'custom-scrollbar min-h-0 max-h-[60vh] flex-1 overflow-y-auto p-4 sm:p-6',
									'text-(--desktop-text-primary)',
									shellPreset.content,
									contentClassName
								)}
							>
								{children}
							</div>
						) : (
							<motion.div
								className={cn(
									'custom-scrollbar min-h-0 max-h-[60vh] flex-1 overflow-y-auto p-4 sm:p-6',
									contentClassName
								)}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.3, delay: 0.2 }}
							>
								{children}
							</motion.div>
						)}

						{/* Footer */}
						{footer &&
							(useDesktopChrome ? (
								<div
									className={cn(
										'flex shrink-0 items-center justify-end gap-3 px-4 py-3 sm:px-6 sm:py-4',
										getDesktopShellFooterStripClassName(shellFrame)
									)}
								>
									{footer}
								</div>
							) : (
								<motion.div
									className={cn(
										'flex items-center justify-end gap-3 border-t border-white/10 p-6'
									)}
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.3, delay: 0.3 }}
								>
									{footer}
								</motion.div>
							))}

						{/* Glow effect */}
						{!useDesktopChrome ? (
							<motion.div
								className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0"
								style={{
									boxShadow:
										variant === 'gradient'
											? '0 0 60px rgba(168, 85, 247, 0.3)'
											: '0 0 60px rgba(255, 255, 255, 0.1)',
								}}
								animate={{ opacity: [0, 1, 0] }}
								transition={{ duration: 2, repeat: Infinity }}
							/>
						) : null}
					</motion.div>
				</div>
			)}
		</AnimatePresence>
	);
};

export default ModalAdvanced;
