/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified inline status banner for Professional Worlds workspaces.
 *
 * Invariants:
 * - Presentation only; message text comes from parent handlers.
 * - Uses Desktop shared status banner so live-region behavior stays consistent.
 *
 * Related:
 * - ProfileWorkspacePanel.tsx, ClientsWorkspacePanel.tsx
 */

import type { ReactNode } from 'react';

import {
	DesktopProductStatusBanner,
	type DesktopProductStatusTone,
} from '@/pages/Desktop/components/DesktopAppChrome';

export type ProfessionalWorldsStatusKind =
	| 'success'
	| 'error'
	| 'info'
	| 'warning';

export function ProfessionalWorldsStatusBanner({
	kind,
	children,
	className,
	role = 'status',
}: {
	kind: ProfessionalWorldsStatusKind;
	children: ReactNode;
	className?: string;
	role?: 'status' | 'alert';
}) {
	const toneByKind: Record<
		ProfessionalWorldsStatusKind,
		DesktopProductStatusTone
	> = {
		error: 'danger',
		success: 'success',
		info: 'info',
		warning: 'warning',
	};
	return (
		<DesktopProductStatusBanner
			tone={toneByKind[kind]}
			role={role}
			aria-live={role === 'alert' ? 'assertive' : 'polite'}
			className={className}
		>
			{children}
		</DesktopProductStatusBanner>
	);
}
