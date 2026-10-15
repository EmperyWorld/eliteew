/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sole `createPortal(document.body)` owner for Desktop Shell overlays (U2).
 * Theme + reduce-blur compositor prefs; no stack registration here.
 *
 * Invariants:
 * - Apps must not call createPortal(document.body); use useShellPortal or
 *   ShellPortalMount from shell/shellPortal.tsx.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 * - shell/shellPortal.tsx
 */

import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { isDesktopLowGpuModeEnabled } from '../runtime/desktopLowGpuMode';
import { getDesktopPortalShellProps } from './shellPortalTheme';

export type ShellBodyPortalProps = {
	children: ReactNode;
	/** Extra class on the body portal root (default includes desktop-shell-floating-portal). */
	className?: string;
	style?: CSSProperties;
	'data-testid'?: string;
};

/**
 * Renders children into document.body with desktop theme / transform compensation.
 */
export function ShellBodyPortal({
	children,
	className,
	style: styleOverride,
	'data-testid': dataTestId = 'desktop-shell-floating-portal',
}: ShellBodyPortalProps) {
	if (typeof document === 'undefined') {
		return children;
	}
	const { style, theme } = getDesktopPortalShellProps();
	const reduceBackdropBlur =
		isDesktopLowGpuModeEnabled() ||
		document
			.getElementById('desktop-main')
			?.getAttribute('data-desktop-reduce-backdrop-blur') === 'true';
	const themeClass =
		theme === 'dark'
			? 'dark desktop-shell-floating-portal'
			: 'desktop-shell-floating-portal';
	return createPortal(
		<div
			style={{ ...style, ...styleOverride }}
			className={className ? `${themeClass} ${className}` : themeClass}
			data-desktop-reduce-backdrop-blur={
				reduceBackdropBlur ? 'true' : undefined
			}
			data-testid={dataTestId}
		>
			{children}
		</div>,
		document.body
	);
}
