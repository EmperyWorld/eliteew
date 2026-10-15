/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Modal shell for desktop App Store vitrine — backdrop, dialog panel, toolbar header.
 *
 * Invariants:
 * - Backdrop click respects install busy guard; Escape handled by parent useShellCaptureEscape.
 *
 * Related:
 * - AppStore.tsx, hooks/useDesktopModalFocusTrap.ts
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { m } from 'framer-motion';
import type { TFunction } from 'i18next';
import type { MouseEvent, ReactElement, ReactNode, RefObject } from 'react';
import type { DesktopIconStyle } from '@/types/profile';
import { DESKTOP_LUCIDE, DESKTOP_OVERLAY } from '../../constants';
import { DesktopAppBadge } from '../../utils/desktopVisualSystem';
import { appStoreModalTitleClass } from '../../utils/appStoreCompactCardUi';
import {
	ArrowTopRightOnSquareIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { DesktopAppButton, DesktopAppToolbar } from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';

export type AppStoreModalShellProps = {
	isBusy: boolean;
	isLoading: boolean;
	onClose?: () => void;
	onOpenInFullWindow?: () => void;
	onOpenFullWindow: () => void;
	onBackdropClick: () => void;
	onPanelClick: (e: MouseEvent) => void;
	modalPanelRef: RefObject<HTMLDivElement | null>;
	panelClassName: string;
	headerStripClassName: string;
	iconStyle: DesktopIconStyle;
	embeddedModalZ: { backdrop: number; content: number };
	children: ReactNode;
	t: TFunction<'appStore'>;
};

export function AppStoreModalShell({
	isBusy,
	isLoading,
	onClose,
	onOpenInFullWindow,
	onOpenFullWindow,
	onBackdropClick,
	onPanelClick,
	modalPanelRef,
	panelClassName,
	headerStripClassName,
	iconStyle,
	embeddedModalZ,
	children,
	t,
}: AppStoreModalShellProps): ReactElement {
	return (
		<m.div
			data-app-store-shell
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className={cn(
				'fixed inset-0 flex items-center justify-center',
				DESKTOP_OVERLAY.backdrop
			)}
			style={{ zIndex: embeddedModalZ.backdrop }}
			onClick={onBackdropClick}
		>
			<m.div
				ref={modalPanelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="desktop-app-store-dialog-title"
				aria-describedby="desktop-app-store-dialog-hint"
				data-desktop-shell-keyboard-surface=""
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				exit={{ scale: 0.9, opacity: 0 }}
				className={panelClassName}
				style={{ zIndex: embeddedModalZ.content }}
				onClick={onPanelClick}
			>
				<DesktopAppToolbar
					className={cn(
						'relative shrink-0 border-b border-(--desktop-border-subtle)/55',
						headerStripClassName
					)}
				>
					<div className="flex items-center justify-between gap-4 px-5 py-4 md:px-6 md:py-5">
						<div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
							<DesktopAppBadge
								appComponent="AppStore"
								variant="start"
								className="h-12 w-12 shrink-0 sm:h-14 sm:w-14"
								iconStyle={iconStyle}
							/>
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<span
										className="h-px w-5 shrink-0 rounded-full bg-[linear-gradient(90deg,var(--mc-accent),transparent)] opacity-80"
										aria-hidden
									/>
									<h2
										id="desktop-app-store-dialog-title"
										className={appStoreModalTitleClass}
									>
										{t('dialog.title')}
									</h2>
								</div>
								<p className={cn(DESKTOP_TYPOGRAPHY.body, 'mt-1 leading-6')}>
									{isLoading
										? t('dialog.loadingSubtitle')
										: t('dialog.subtitle')}
								</p>
								<p id="desktop-app-store-dialog-hint" className="sr-only">
									{t('dialog.hint')}
								</p>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							{onOpenInFullWindow ? (
								<DesktopChromeTooltip
									content={t('fullScreen')}
									placement="bottom"
									offsetExtra={4}
								>
									<DesktopAppButton
										type="button"
										onClick={onOpenFullWindow}
										variant="ghost"
										size="sm"
										className="gap-1.5 rounded-(--desktop-radius-lg) border border-transparent text-(--desktop-text-muted) antialiased hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft) hover:text-(--desktop-text-primary)"
									>
										<ArrowTopRightOnSquareIcon
											className={DESKTOP_LUCIDE.md}
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										{t('fullScreen')}
									</DesktopAppButton>
								</DesktopChromeTooltip>
							) : null}
							{onClose ? (
								<DesktopChromeTooltip
									content={t('close')}
									placement="bottom"
									offsetExtra={4}
								>
									<DesktopAppButton
										type="button"
										onClick={onClose}
										variant="ghost"
										size="icon"
										disabled={isBusy}
										aria-label={t('close')}
									>
										<XMarkIcon
											width={20}
											height={20}
											className="text-(--desktop-text-muted)"
										/>
									</DesktopAppButton>
								</DesktopChromeTooltip>
							) : null}
						</div>
					</div>
				</DesktopAppToolbar>
				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{children}
				</div>
			</m.div>
		</m.div>
	);
}
