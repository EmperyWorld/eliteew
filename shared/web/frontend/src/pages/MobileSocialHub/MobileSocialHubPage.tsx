/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fullscreen mobile shell for desktop Social Hub (`SocialHubApp`).
 *
 * Invariants:
 * - Loaded only on `#/mobile-social-hub` (MobileAndroid in-app WebView or trusted embedded client).
 * - Does not mount desktop workspace chrome or window manager.
 *
 * Related:
 * - features/friends/components/SocialHubApp.tsx, components/mobileEmbedded/MobileEmbeddedShell.tsx
 */

import SocialHubApp from '@/features/friends/components/SocialHubApp';
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
import { isEmbeddedEliteEWClient } from '@/utils/eliteewEmbeddedClient';
import { useCallback, useEffect, useState } from 'react';
import {
	recoverMobileEmbeddedSession,
	initKeycloak,
} from '@/services/keycloak';

const SESSION_ERROR_GRACE_MS = 2800;

export default function MobileSocialHubPage(): React.JSX.Element {
	const auth = useAuth();
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
					reconnecting ? 'Переподключаем Social Hub…' : 'Открываем Social Hub…'
				}
			/>
		);
	}

	if (!auth.isAuthenticated) {
		return (
			<MobileEmbeddedShell>
				<DesktopProductStatePanel
					state="permissionDenied"
					title="Сессия не подключилась"
					description="Social Hub открывается из приложения EliteEW с вашим входом. Нажмите «Повторить» или закройте экран и снова откройте Друзья → Social Hub."
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
				<SocialHubApp embeddedMobile />
			</MobileEmbeddedShellBody>
		</MobileEmbeddedShell>
	);
}
