/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared bottom sheet / drawer shell with focus trap for companion mobile UX (U5, U7.1).
 *
 * Invariants:
 * - Escape closes; Tab trap + focus restore via `useEwaDialogFocusTrap`.
 * - Swipe down on header/drag handle dismisses (U5.7).
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionMobileOperationsSheet.tsx
 */

import { type ReactNode, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { CompanionGlassCard } from '@/features/ewa/companionPremiumPrimitives';
import { useCompanionMobileSheetSwipeDismiss } from '@/features/ewa/companionUx/useCompanionMobileSheetSwipeDismiss';
import { useEwaDialogFocusTrap } from '@/features/ewa/companionUx/useEwaDialogFocusTrap';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

export type CompanionMobileBottomSheetProps = {
	open: boolean;
	title: string;
	onClose: () => void;
	children: ReactNode;
	testId?: string;
	/** Enable swipe-down dismiss on touch devices (default true). */
	swipeToDismiss?: boolean;
};

export function CompanionMobileBottomSheet({
	open,
	title,
	onClose,
	children,
	testId,
	swipeToDismiss = true,
}: CompanionMobileBottomSheetProps) {
	const { t } = useTranslation('marketing');
	const titleId = useId();
	const focusPanelRef = useRef<HTMLDivElement | null>(null);
	const { panelRef, dragPx, dragging, headerProps } =
		useCompanionMobileSheetSwipeDismiss({
			enabled: swipeToDismiss,
			open,
			onDismiss: onClose,
		});

	const setPanelRef = (node: HTMLDivElement | null) => {
		panelRef.current = node;
		focusPanelRef.current = node;
	};

	useEwaDialogFocusTrap(open, focusPanelRef);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-120 flex flex-col justify-end"
			data-testid={testId}
			role="presentation"
		>
			<button
				type="button"
				className="absolute inset-0 bg-black/50"
				aria-label={t('ewaCompanion.sheetBackdropClose')}
				onClick={onClose}
			/>
			<div
				ref={setPanelRef}
				style={{
					transform: dragPx > 0 ? `translateY(${dragPx}px)` : undefined,
					transition: dragging ? 'none' : 'transform 180ms ease-out',
				}}
			>
				<CompanionGlassCard
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					className={cn(
						'relative z-1 flex min-h-0 max-h-[min(78vh,32rem)] flex-col overflow-hidden',
						'rounded-t-2xl border-b-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2'
					)}
				>
					<div
						className="flex shrink-0 touch-none flex-col"
						{...headerProps}
						data-testid="ewa-companion-mobile-sheet-drag-handle"
					>
						<div className="mb-2 flex justify-center pt-1" aria-hidden>
							<div className="h-1 w-10 rounded-full bg-white/25" />
						</div>
						<div className="mb-2 flex items-center justify-between gap-2">
							<h2
								id={titleId}
								className="text-[13px] font-semibold text-(--desktop-text-primary)"
							>
								{title}
							</h2>
							<button
								type="button"
								className={cn(
									'rounded-full px-2 py-1 text-[12px] text-(--companion-text-soft)',
									'hover:bg-white/8 hover:text-(--desktop-text-primary)',
									DESKTOP_CHROME_FOCUS_VISIBLE
								)}
								onClick={onClose}
							>
								{t('ewaCompanion.sheetClose')}
							</button>
						</div>
					</div>
					<div
						className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y"
						onWheel={(event) => event.stopPropagation()}
					>
						{children}
					</div>
				</CompanionGlassCard>
			</div>
		</div>
	);
}
