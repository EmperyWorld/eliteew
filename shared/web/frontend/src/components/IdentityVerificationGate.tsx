/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compatibility passthrough. Visible boot surfaces are owned by the static
 * preloader, AppRouter, and Desktop recovery — not a second fullscreen gate.
 *
 * Invariants:
 * - Never blocks children; AppRouter owns login vs desktop loaders.
 *
 * Related:
 * - `documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md`
 */

import type { ReactElement, ReactNode } from 'react';

type IdentityVerificationGateProps = {
	isAuthenticated: boolean;
	isAuthLoading: boolean;
	children: ReactNode;
};

export function IdentityVerificationGate({
	isAuthenticated: _isAuthenticated,
	isAuthLoading: _isAuthLoading,
	children,
}: IdentityVerificationGateProps): ReactElement {
	return <>{children}</>;
}
