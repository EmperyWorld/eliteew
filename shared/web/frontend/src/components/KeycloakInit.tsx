/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compatibility passthrough. OIDC now starts in `mainFullApp.ts` before React mounts.
 *
 * Invariants:
 * - Does not delay AuthProvider; children render immediately.
 *
 * Related:
 * - `services/boot/authBootstrap.ts`
 * - `documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md`
 */
import type { ReactElement, ReactNode } from 'react';

type Props = { children?: ReactNode };

export function KeycloakInit({ children }: Props): ReactElement {
	return <>{children}</>;
}

export default KeycloakInit;
