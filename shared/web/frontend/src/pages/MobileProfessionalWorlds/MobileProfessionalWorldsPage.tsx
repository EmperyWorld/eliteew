/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fullscreen mobile shell for desktop Professional Worlds (`ProfessionalWorldsApp`).
 *
 * Invariants:
 * - Loaded only on `#/mobile-professional-worlds` (MobileAndroid in-app WebView or trusted embedded client).
 * - Does not mount desktop workspace chrome or window manager.
 *
 * Related:
 * - features/professional-worlds/desktop/ProfessionalWorldsApp.tsx
 * - components/mobileEmbedded/MobileEmbeddedShell.tsx
 */

import ProfessionalWorldsApp from '@/features/professional-worlds/desktop/ProfessionalWorldsApp';
import {
	MobileEmbeddedShell,
	MobileEmbeddedShellBody,
} from '@/components/mobileEmbedded/MobileEmbeddedShell';
import { MobileEmbeddedRouteLoading } from '@/components/mobileEmbedded/MobileEmbeddedRouteLoading';
import {
	DesktopAppButton,
	DesktopProductStatePanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { useAuth } from '@/hooks';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { isEmbeddedEliteEWClient } from '@/utils/eliteewEmbeddedClient';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	recoverMobileEmbeddedSession,
	initKeycloak,
} from '@/services/keycloak';

const SESSION_ERROR_GRACE_MS = 2800;

export default function MobileProfessionalWorldsPage(): React.JSX.Element {
	const auth = useAuth();
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [reconnecting, setReconnecting] = useState(false);
	const [sessionErrorGrace, setSessionErrorGrace] = useState(
		isEmbeddedEliteEWClient()
	);

	useEffect(() => {
		if (auth.isAuthenticated) {
			setSessionErrorGrace(false);
			return;
		}
		if (auth.loading) {
			return;
		}
		if (!isEmbeddedEliteEWClient()) {
			setSessionErrorGrace(false);
			return;
		}
		const timer = window.setTimeout(
			() => setSessionErrorGrace(false),
			SESSION_ERROR_GRACE_MS
		);
		return () => window.clearTimeout(timer);
	}, [auth.isAuthenticated, auth.loading]);

	const handleRetry = useCallback(async () => {
		setReconnecting(true);
		setSessionErrorGrace(true);
		try {
			await recoverMobileEmbeddedSession();
			await initKeycloak();
			await auth.checkAuthentication();
		} finally {
			setReconnecting(false);
		}
	}, [auth]);

	const showBootLoading =
		auth.loading ||
		reconnecting ||
		(sessionErrorGrace && !auth.isAuthenticated && isEmbeddedEliteEWClient());

	if (showBootLoading) {
		return (
			<MobileEmbeddedRouteLoading
				message={
					reconnecting
						? t('mobileEmbedded.reconnecting')
						: t('mobileEmbedded.opening')
				}
			/>
		);
	}

	if (!auth.isAuthenticated) {
		return (
			<MobileEmbeddedShell>
				<DesktopProductStatePanel
					state="permissionDenied"
					title={t('mobileEmbedded.sessionTitle')}
					description={t('mobileEmbedded.sessionDescription')}
					className="flex-1"
					actions={
						<DesktopAppButton
							type="button"
							variant="accent"
							disabled={reconnecting}
							onClick={() => void handleRetry()}
						>
							{reconnecting
								? t('mobileEmbedded.retrying')
								: t('mobileEmbedded.retry')}
						</DesktopAppButton>
					}
				/>
			</MobileEmbeddedShell>
		);
	}

	return (
		<MobileEmbeddedShell>
			<MobileEmbeddedShellBody>
				<ProfessionalWorldsApp embeddedMobile />
			</MobileEmbeddedShellBody>
		</MobileEmbeddedShell>
	);
}
