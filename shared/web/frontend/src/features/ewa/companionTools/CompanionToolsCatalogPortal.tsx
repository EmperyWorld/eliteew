/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell portal host for companion tools catalog (theme tokens via ShellBodyPortal).
 *
 * Invariants:
 * - Mount via ShellPortalMount only — no createPortal(document.body).
 *
 * Related:
 * - src/pages/Desktop/shell/shellPortal.tsx
 * - src/pages/Desktop/shell (getDesktopPortalShellProps)
 * - src/features/ewa/companionUx/CompanionToolsInstrumentsOverlay.tsx
 */

import type { ReactNode } from 'react';

import { ShellPortalMount } from '@/pages/Desktop/shell/shellPortal';
import { getDesktopPortalShellProps } from '@/pages/Desktop/shell';

export function CompanionToolsCatalogPortal({
	open,
	children,
}: {
	open: boolean;
	children: ReactNode;
}) {
	if (!open || typeof document === 'undefined') return null;
	const { style, theme } = getDesktopPortalShellProps();
	return (
		<ShellPortalMount>
			<div
				style={style}
				className={theme === 'dark' ? 'dark' : undefined}
				data-testid="ewa-companion-tools-portal-root"
			>
				{children}
			</div>
		</ShellPortalMount>
	);
}
