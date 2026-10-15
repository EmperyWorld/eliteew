/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fullscreen mobile shell for the user's original EWA companion (same `EwaDesktopApp` as desktop window).
 *
 * Invariants:
 * - Loaded only on `#/mobile-ewa-companion` (MobileAndroid in-app WebView or trusted embedded client).
 * - Does not mount desktop workspace chrome or window manager.
 *
 * Related:
 * - features/ewa/EwaDesktopApp.tsx, components/mobileEmbedded/MobileEmbeddedShell.tsx
 */

import { EwaDesktopApp } from '@/features/ewa/EwaDesktopApp';
import {
	MobileEmbeddedShell,
	MobileEmbeddedShellBody,
} from '@/components/mobileEmbedded/MobileEmbeddedShell';
import { MobileEmbeddedRouteLoading } from '@/components/mobileEmbedded/MobileEmbeddedRouteLoading';
import {
	DesktopAppButton,
	DesktopProductStatePanel,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { EwaCompanionShellBridgeProvider } from '@/pages/Desktop/context/EwaCompanionShellBridgeContext';
import { buildMobileEwaCompanionShellContext } from '@/pages/Desktop/utils/buildEwaCompanionShellContext';
import { useAuth } from '@/hooks';
import {
	recoverMobileEmbeddedSession,
	initKeycloak,
} from '@/services/keycloak';
import { isEmbeddedEliteEWClient } from '@/utils/eliteewEmbeddedClient';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SESSION_ERROR_GRACE_MS = 2800;

export default function MobileEwaCompanionPage(): React.JSX.Element {
	const auth = useAuth();
	const [reconnecting, setReconnecting] = useState(false);
	const [sessionErrorGrace, setSessionErrorGrace] = useState(
		isEmbeddedEliteEWClient()
	);
	const mobileShellBridge = useMemo(
		() => ({
			getSnapshot: () => buildMobileEwaCompanionShellContext(),
		}),
		[]
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
				message={reconnecting ? 'Переподключаем EWA…' : 'Подключаем EWA…'}
			/>
		);
	}

	if (!auth.isAuthenticated) {
		return (
			<MobileEmbeddedShell>
				<DesktopProductStatePanel
					state="permissionDenied"
					title="Сессия не подключилась"
					description="Спутник открывается из приложения EliteEW с вашим входом. Нажмите «Повторить» или закройте экран и снова откройте EW → EWA · спутник."
					className="flex-1"
					actions={
						<DesktopAppButton
							type="button"
							variant="accent"
							disabled={reconnecting}
							onClick={() => void handleRetry()}
						>
							{reconnecting ? 'Подключаем…' : 'Повторить'}
						</DesktopAppButton>
					}
				/>
			</MobileEmbeddedShell>
		);
	}

	return (
		<MobileEmbeddedShell>
			<MobileEmbeddedShellBody>
				<EwaCompanionShellBridgeProvider value={mobileShellBridge}>
					<EwaDesktopApp embeddedMobile openedFromSessionRestore />
				</EwaCompanionShellBridgeProvider>
			</MobileEmbeddedShellBody>
		</MobileEmbeddedShell>
	);
}
