/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Standard content panel chrome for Professional Worlds workspaces.
 *
 * Invariants:
 * - Wraps `DesktopAppPanel` with consistent padding and optional title row.
 * - `embedded` skips outer chrome when nested inside another panel (see `PW_PANEL_EMBEDDED_CLASS`).
 *
 * Related:
 * - ProfessionalWorldsWorkspaceSection.tsx
 */

import type { ReactNode } from 'react';

import {
	DesktopAppPanel,
	DesktopAppSectionLabel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';

import {
	PW_PANEL_EMBEDDED_CLASS,
	PW_WORKSPACE_PANEL_CLASS,
} from './professionalWorldsLayoutTokens';

export function ProfessionalWorldsWorkspacePanel({
	title,
	actions,
	children,
	className,
	dense,
	embedded,
}: {
	title?: ReactNode;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	/** Tighter vertical gap for simple copy blocks. */
	dense?: boolean;
	/** Body only — no `DesktopAppPanel` wrapper (nested inside another panel). */
	embedded?: boolean;
}) {
	if (embedded) {
		return (
			<div className={cn(PW_PANEL_EMBEDDED_CLASS, dense && 'gap-2', className)}>
				{children}
			</div>
		);
	}

	return (
		<DesktopAppPanel
			className={cn(PW_WORKSPACE_PANEL_CLASS, dense && 'gap-2', className)}
		>
			{title || actions ? (
				<div className="flex flex-wrap items-center justify-between gap-2">
					{title ? (
						<DesktopAppSectionLabel>{title}</DesktopAppSectionLabel>
					) : null}
					{actions ? (
						<div className="flex flex-wrap items-center gap-2">{actions}</div>
					) : null}
				</div>
			) : null}
			{children}
		</DesktopAppPanel>
	);
}
