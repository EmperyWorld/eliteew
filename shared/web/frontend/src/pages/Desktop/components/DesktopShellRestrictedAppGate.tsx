/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell-owned permission gate for restricted desktop window apps — requirement
 * message + close-window return path via DesktopProductStatePanel (not app-local chrome).
 *
 * Invariants:
 * - Denied / loading panels use DesktopAppChrome product state grammar.
 * - Children mount only when access status is `allowed`.
 * - Unrestricted appComponents pass through unchanged.
 *
 * Related:
 * - `utils/desktopRestrictedAppAccess.ts`
 * - `desktopWindowAppContent.tsx`
 * - documentation/product/desktop/ELITEEW-UX-PRIMITIVES-CONTRACT.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks';
import { resolveDesktopRestrictedAppAccess } from '../utils/desktopRestrictedAppAccess';
import { DesktopAppButton, DesktopProductStatePanel } from './DesktopAppChrome';

export type DesktopShellRestrictedAppGateProps = {
	appComponent: string;
	onRequestClose?: () => void;
	children: React.ReactNode;
};

export function DesktopShellRestrictedAppGate({
	appComponent,
	onRequestClose,
	children,
}: DesktopShellRestrictedAppGateProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const { user, isAuthenticated, loading } = useAuth();
	const status = resolveDesktopRestrictedAppAccess({
		appComponent,
		user,
		isAuthenticated,
		loading,
	});

	if (status === 'allowed') {
		return <>{children}</>;
	}

	if (status === 'loading') {
		return (
			<DesktopProductStatePanel
				state="loading"
				title={t('shellRestrictedApp.loadingTitle')}
				description={t('shellRestrictedApp.loadingBody')}
				className="h-full min-h-0"
			/>
		);
	}

	return (
		<DesktopProductStatePanel
			state="permissionDenied"
			title={t('shellRestrictedApp.deniedTitle')}
			description={t('shellRestrictedApp.deniedBody')}
			className="h-full min-h-0"
			actions={
				onRequestClose ? (
					<DesktopAppButton
						type="button"
						variant="accent"
						onClick={onRequestClose}
					>
						{t('shellRestrictedApp.closeWindow')}
					</DesktopAppButton>
				) : null
			}
		/>
	);
}
