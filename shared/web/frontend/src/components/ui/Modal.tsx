import * as React from 'react';
import {
	forwardRef,
	useEffect,
	useRef,
	type ReactNode,
	type HTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cva, type VariantProps } from '@/utils/cva';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEmbeddedPortaledModalZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { cn } from '../../utils/cn';
import { getFocusableElements, trapFocus } from '../../utils/accessibility';

// ============================================================================
// VARIANTS DEFINITION (CVA)
// ============================================================================

const modalVariants = cva(
	// Base styles
	`
    relative w-full max-h-[90vh] overflow-hidden
    bg-linear-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95
    backdrop-blur-2xl
    border-2 border-white/10
    rounded-2xl shadow-2xl
    flex flex-col
  `,
	{
		variants: {
			// ========================================
			// SIZE
			// ========================================
			size: {
				sm: 'max-w-md',
				md: 'max-w-2xl',
				lg: 'max-w-4xl',
				xl: 'max-w-6xl',
				full: 'max-w-[95vw]',
			},
		},
		defaultVariants: {
			size: 'md',
		},
	}
);

// ============================================================================
// TYPES
// ============================================================================

type ModalVariantsType = VariantProps<typeof modalVariants>;

export interface ModalProps extends ModalVariantsType {
	/** Открыт ли модал */
	isOpen: boolean;
	/** Callback при закрытии */
	onClose: () => void;
	/** Дети (используй Modal.Header, Modal.Body, Modal.Footer) */
	children: ReactNode;
	/** Показывать кнопку закрытия */
	showCloseButton?: boolean;
	/** Закрывать по клику вне модала */
	closeOnClickOutside?: boolean;
	/** Закрывать по Escape */
	closeOnEscape?: boolean;
	/** Кастомный className */
	className?: string;
}

interface ModalSubComponentProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ModalV2Root = forwardRef<HTMLDivElement, ModalProps>(
	(
		{
			isOpen,
			onClose,
			children,
			showCloseButton = true,
			closeOnClickOutside = true,
			closeOnEscape = true,
			size,
			className,
			...props
		},
		ref
	) => {
		const modalRef = useRef<HTMLDivElement>(null);
		const previousFocusRef = useRef<HTMLElement | null>(null);
		const embeddedModalZ = useEmbeddedPortaledModalZIndex();

		// ========================================
		// FOCUS TRAP
		// ========================================

		useEffect(() => {
			if (!isOpen) {
				return;
			}

			previousFocusRef.current = document.activeElement as HTMLElement;
			const el =
				modalRef.current ?? (ref as React.RefObject<HTMLDivElement>)?.current;
			if (!el) {
				return;
			}

			const focusables = getFocusableElements(el);
			const first = focusables[0];
			if (first) {
				requestAnimationFrame(() => {
					first.focus();
				});
			} else {
				el.focus();
			}

			const cleanup = trapFocus(el);

			return (): void => {
				cleanup();
				const toRestore = previousFocusRef.current;
				previousFocusRef.current = null;
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
		}, [isOpen, (ref as React.RefObject<HTMLDivElement>)?.current]);

		// ========================================
		// ESCAPE KEY HANDLER
		// ========================================

		useEffect(() => {
			if (!isOpen || !closeOnEscape) {
				return;
			}

			const handleEscape = (e: KeyboardEvent): void => {
				if (e.key === 'Escape') {
					onClose();
				}
			};

			document.addEventListener('keydown', handleEscape);
			return (): void => {
				document.removeEventListener('keydown', handleEscape);
			};
		}, [isOpen, closeOnEscape, onClose]);

		// ========================================
		// BODY SCROLL LOCK
		// ========================================

		useEffect(() => {
			if (isOpen) {
				// Блокируем скролл body
				const originalOverflow = document.body.style.overflow;
				document.body.style.overflow = 'hidden';

				return (): void => {
					document.body.style.overflow = originalOverflow;
				};
			}
		}, [isOpen]);

		// ========================================
		// HANDLERS
		// ========================================

		const handleBackdropClick = (e: React.MouseEvent): void => {
			if (closeOnClickOutside && e.target === e.currentTarget) {
				onClose();
			}
		};

		// ========================================
		// RENDER
		// ========================================

		return createPortal(
			<AnimatePresence mode="wait">
				{isOpen && (
					<div
						className="fixed inset-0 flex items-center justify-center p-4"
						style={{ zIndex: embeddedModalZ.backdrop }}
					>
						{/* Backdrop */}
						<motion.div
							className="absolute inset-0 bg-black/60 backdrop-blur-xs"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							onClick={handleBackdropClick}
						/>

						{/* Modal */}
						<motion.div
							ref={(node) => {
								(
									modalRef as React.MutableRefObject<HTMLDivElement | null>
								).current = node;
								if (typeof ref === 'function') ref(node);
								else if (ref)
									(
										ref as React.MutableRefObject<HTMLDivElement | null>
									).current = node;
							}}
							className={cn(modalVariants({ size }), className)}
							style={{ zIndex: embeddedModalZ.content }}
							role="dialog"
							aria-modal="true"
							tabIndex={-1}
							initial={{ opacity: 0, scale: 0.95, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 20 }}
							transition={{
								type: 'spring',
								stiffness: 300,
								damping: 24,
							}}
							{...props}
						>
							{/* Close Button */}
							{showCloseButton && (
								<button
									type="button"
									onClick={onClose}
									className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-white/50"
									aria-label="Закрыть модал"
								>
									<XMarkIcon className="h-5 w-5" aria-hidden />
								</button>
							)}

							{/* Content */}
							{children}
						</motion.div>
					</div>
				)}
			</AnimatePresence>,
			document.body
		);
	}
);

ModalV2Root.displayName = 'ModalV2';

// ============================================================================
// SUB-COMPONENTS (Compound Component Pattern)
// ============================================================================

export const ModalHeader = forwardRef<HTMLDivElement, ModalSubComponentProps>(
	({ children, className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				'px-6 py-4 border-b border-white/10',
				'flex items-center justify-between gap-4',
				className
			)}
			{...props}
		>
			<div className="flex-1 text-xl font-bold text-white">{children}</div>
		</div>
	)
);

ModalHeader.displayName = 'ModalHeader';

export const ModalBody = forwardRef<HTMLDivElement, ModalSubComponentProps>(
	({ children, className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				'flex-1 overflow-y-auto px-6 py-4 text-white/90',
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
);

ModalBody.displayName = 'ModalBody';

export const ModalFooter = forwardRef<HTMLDivElement, ModalSubComponentProps>(
	({ children, className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				'px-6 py-4 border-t border-white/10',
				'flex items-center justify-end gap-3',
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
);

ModalFooter.displayName = 'ModalFooter';

// ============================================================================
// COMPOSE COMPOUND COMPONENT
// ============================================================================

// Define the compound component type with subcomponents
interface ModalV2Component
	extends React.ForwardRefExoticComponent<
		ModalProps & React.RefAttributes<HTMLDivElement>
	> {
	Header: typeof ModalHeader;
	Body: typeof ModalBody;
	Footer: typeof ModalFooter;
}

// Cast and attach subcomponents
export const ModalV2 = ModalV2Root as ModalV2Component;
ModalV2.Header = ModalHeader;
ModalV2.Body = ModalBody;
ModalV2.Footer = ModalFooter;

// ============================================================================
// EXPORTS
// ============================================================================

export { modalVariants };
export type { ModalVariantsType, ModalSubComponentProps };

// Backward compatibility aliases
export const Modal = ModalV2;
export default ModalV2;
