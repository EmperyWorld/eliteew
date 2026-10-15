/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop app modal frame and portaled confirm shell for embedded apps.
 *
 * Invariants:
 * - Portaled confirms mount through useShellPortal for theme tokens.
 *
 * Related:
 * - desktopAppChrome/controls.tsx
 * - pages/Desktop/shell/shellPortal.tsx
 */

import { cn } from '@/utils/cn';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { HTMLAttributes, ReactNode } from 'react';
import * as React from 'react';
import { DESKTOP_LUCIDE, DESKTOP_OVERLAY } from '@/pages/Desktop/constants';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { useShellPortal } from '@/pages/Desktop/shell/shellPortal';
import { useDesktopShellFrame } from '../../context/DesktopShellFrameContext';
import {
	DESKTOP_WINDOW_FRAME_STYLES,
	getDesktopShellHeaderStripClassName,
	getDesktopShellPanelClassName,
} from '../../utils/desktopVisualSystem';
import { DesktopAppButton } from './controls';

interface DesktopAppModalFrameProps
	extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
	title?: ReactNode;
	onClose?: () => void;
	closeLabel?: string;
}

export const DesktopAppModalFrame: React.FC<DesktopAppModalFrameProps> = ({
	className,
	title,
	onClose,
	closeLabel,
	children,
	...props
}) => {
	const { t } = useTranslation('desktopUi');
	const resolvedCloseLabel = closeLabel ?? t('modal.close');
	const shellFrame = useDesktopShellFrame();
	const preset =
		DESKTOP_WINDOW_FRAME_STYLES[shellFrame] ??
		DESKTOP_WINDOW_FRAME_STYLES.glass;

	return (
		<div
			className={cn(
				getDesktopShellPanelClassName(shellFrame, 'strong'),
				'flex w-full max-w-md max-h-[80vh] flex-col text-(--desktop-text-primary)',
				className
			)}
			{...props}
		>
			{title || onClose ? (
				<div
					className={cn(
						'flex min-h-[52px] shrink-0 items-center justify-between gap-3 px-4 py-3',
						getDesktopShellHeaderStripClassName(shellFrame)
					)}
				>
					{/* Compact embedded modal title — smaller than centered ModalAdvanced desktop (DESKTOP_TYPOGRAPHY.subtitle). */}
					{title ? (
						<DesktopChromeTooltip
							content={title}
							placement="top"
							offsetExtra={4}
						>
							<div className="min-w-0 flex-1 truncate text-sm font-semibold text-(--desktop-text-primary) tracking-tight antialiased">
								{title}
							</div>
						</DesktopChromeTooltip>
					) : (
						<div className="min-w-0 flex-1" aria-hidden />
					)}
					{onClose ? (
						<DesktopChromeTooltip
							content={resolvedCloseLabel}
							placement="top"
							offsetExtra={4}
						>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								onClick={onClose}
								aria-label={resolvedCloseLabel}
							>
								<XMarkIcon
									className={DESKTOP_LUCIDE.lg}
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							</DesktopAppButton>
						</DesktopChromeTooltip>
					) : null}
				</div>
			) : null}
			<div className={cn('min-h-0 flex-1 overflow-y-auto', preset.content)}>
				{children}
			</div>
		</div>
	);
};

/**
 * Portal confirm from embedded apps: fixed shell, clickable scrim
 * ({@link DESKTOP_OVERLAY.backdrop}), stacked z-index via useShellPortal.
 * Always mounts through Shell body portal so `#desktop-main` theme tokens apply.
 */
export interface DesktopPortaledConfirmShellProps {
	onDismiss: () => void;
	/** Layer pair, or a single base z-index (content = base + 10). */
	zIndex: number | { backdrop: number; content: number };
	dismissAriaLabel: string;
	children: React.ReactNode;
	className?: string;
	contentClassName?: string;
}

function resolvePortaledConfirmZIndex(
	zIndex: DesktopPortaledConfirmShellProps['zIndex']
): { backdrop: number; content: number } {
	if (typeof zIndex === 'number') {
		return { backdrop: zIndex, content: zIndex + 10 };
	}
	return zIndex;
}

export const DesktopPortaledConfirmShell: React.FC<
	DesktopPortaledConfirmShellProps
> = ({
	onDismiss,
	zIndex,
	dismissAriaLabel,
	children,
	className,
	contentClassName,
}) => {
	const zIndexLayers = resolvePortaledConfirmZIndex(zIndex);
	const { Portal, portalProps } = useShellPortal({
		layer: 'embedded_modal',
		dismissOnEscape: true,
		trapFocus: true,
		onDismiss,
	});
	const backdropZ = portalProps?.zIndex ?? zIndexLayers.backdrop;
	const contentZ = backdropZ + 10;
	return (
		<Portal>
			<div
				className={cn(
					'fixed inset-0 flex items-center justify-center p-4',
					className
				)}
				style={{ zIndex: backdropZ }}
			>
				<button
					type="button"
					className={cn('absolute inset-0', DESKTOP_OVERLAY.backdrop)}
					aria-label={dismissAriaLabel}
					onClick={onDismiss}
				/>
				<div
					className={cn('relative w-full max-w-md', contentClassName)}
					style={{ zIndex: contentZ }}
				>
					{children}
				</div>
			</div>
		</Portal>
	);
};
