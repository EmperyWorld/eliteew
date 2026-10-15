/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fullscreen mobile shell for desktop «Справочник» (`AssistantApp`).
 *
 * Invariants:
 * - Loaded only on `#/mobile-handbook` (MobileAndroid in-app WebView or trusted embedded client).
 * - Does not mount desktop workspace chrome or window manager.
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx, components/mobileEmbedded/MobileEmbeddedShell.tsx
 */

import AssistantApp from '@/pages/Desktop/components/AssistantApp';
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
import {
	recoverMobileEmbeddedSession,
	initKeycloak,
} from '@/services/keycloak';
import { isEmbeddedEliteEWClient } from '@/utils/eliteewEmbeddedClient';
import { useCallback, useEffect, useState } from 'react';

const SESSION_ERROR_GRACE_MS = 2800;

export default function MobileHandbookPage(): React.JSX.Element {
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
					reconnecting ? 'Переподключаем Ассистента…' : 'Открываем Ассистента…'
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
					description="Ассистент открывается из приложения EliteEW с вашим входом. Нажмите «Повторить» или закройте экран и снова откройте EW → Ассистент."
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
			<MobileEmbeddedShellBody className="flex min-h-0 flex-1 flex-col">
				<AssistantApp embeddedMobile />
			</MobileEmbeddedShellBody>
		</MobileEmbeddedShell>
	);
}
