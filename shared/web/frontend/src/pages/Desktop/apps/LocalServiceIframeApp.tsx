/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Embedded desktop app for the host-local service UI exposed through the EliteEW same-origin proxy,
 * with a short shell guided tour over chrome and the iframe viewport (GT-12).
 *
 * Invariants:
 * - The browser never loads `127.0.0.1:8080` directly; the API proxy resolves it on the server side.
 * - The proxied UI is sandboxed without `allow-same-origin`, so it cannot read app-origin storage or parent DOM.
 * - Shell chrome owns window sizing and tour launch; iframe content is not individually spotlit.
 *
 * Related:
 * - src/pages/Desktop/components/desktopWindowAppContent.tsx
 * - public/audio/local-service-guide/
 */

import authSession from '@/services/authSession';
import { ensureAccessTokenMinValidity } from '@/services/keycloak';
import { cn } from '@/utils/cn';
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LOCAL_SERVICE_GUIDE_AUDIO_LS_KEY,
	LOCAL_SERVICE_GUIDE_ROOT_ID,
	LOCAL_SERVICE_GUIDE_STEP_DEFS,
	LOCAL_SERVICE_GUIDE_TOUR_FOLDER,
} from './localServiceGuideConstants';

const LOCAL_SERVICE_PROXY_PATH = '/api/v1/desktop/local-service-proxy/';
const LOCAL_SERVICE_PROXY_SESSION_PATH =
	'/api/v1/desktop/local-service-proxy-session';

async function openLocalServiceProxySession(): Promise<void> {
	await ensureAccessTokenMinValidity(30);
	if (!authSession.token) {
		throw new Error('Auth session is not ready');
	}
	const response = await fetch(LOCAL_SERVICE_PROXY_SESSION_PATH, {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			Authorization: `Bearer ${authSession.token}`,
		},
	});
	if (!response.ok) {
		throw new Error(`Local Service proxy session failed: ${response.status}`);
	}
}

export function LocalServiceIframeApp() {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'localService' });
	const guideLabels = useMemo(() => guideTourLabelsFromI18n(t, 'guide'), [t]);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		LOCAL_SERVICE_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);

	const [iframeSrc, setIframeSrc] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		openLocalServiceProxySession()
			.then(() => {
				if (cancelled) return;
				setIframeSrc(`${LOCAL_SERVICE_PROXY_PATH}?_=${Date.now().toString()}`);
			})
			.catch(() => {
				if (cancelled) return;
				setError(t('proxySessionFailed'));
			});
		return () => {
			cancelled = true;
		};
	}, [t]);

	const connectLabel = error ?? t('connecting');
	const spotlightLayoutKey = `${guideOpen}-${iframeSrc ? 'ready' : 'pending'}-${error ? 'error' : 'ok'}`;

	return (
		<div
			id={LOCAL_SERVICE_GUIDE_ROOT_ID}
			className="flex h-full min-h-0 flex-col overflow-hidden bg-(--desktop-surface-panel)"
		>
			<div
				data-local-service-guide="shell-header"
				className="relative shrink-0 border-b border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_95%,transparent)] px-4 py-2.5"
			>
				<div className="flex min-w-0 flex-col gap-0.5">
					<h1
						className={cn(
							DESKTOP_TYPOGRAPHY.subtitle,
							'text-(--desktop-text-primary)'
						)}
					>
						{t('title')}
					</h1>
					<p
						data-local-service-guide="security"
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'max-w-3xl text-(--desktop-text-secondary)'
						)}
					>
						{t('securityHint')}
					</p>
				</div>
			</div>

			<div
				data-local-service-guide="viewport"
				data-desktop-iframe-host=""
				className="relative min-h-0 flex-1 overflow-hidden bg-(--desktop-surface-panel-strong)"
			>
				{error ? (
					<div
						data-local-service-guide="connect"
						className="flex h-full min-h-0 w-full items-center justify-center p-6 text-sm text-red-200/90"
					>
						{error}
					</div>
				) : !iframeSrc ? (
					<div
						data-local-service-guide="connect"
						className="flex h-full min-h-0 w-full items-center justify-center p-6 text-sm text-(--desktop-text-secondary)"
					>
						{connectLabel}
					</div>
				) : (
					<>
						<div
							data-local-service-guide="connect"
							className={cn(
								DESKTOP_TYPOGRAPHY.captionInherit,
								'pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-panel-strong)_88%,transparent)] px-2 py-1 text-(--desktop-text-secondary)'
							)}
							aria-hidden
						>
							{t('connectedBadge')}
						</div>
						<iframe
							allow="autoplay; camera; clipboard-read; clipboard-write; fullscreen; microphone"
							className="h-full w-full border-0 bg-white"
							referrerPolicy="no-referrer"
							sandbox="allow-downloads allow-forms allow-modals allow-popups allow-scripts"
							src={iframeSrc}
							title={t('iframeTitle')}
						/>
					</>
				)}
			</div>

			<SpotlightGuideModal
				open={guideOpen}
				onClose={() => setGuideOpen(false)}
				rootId={LOCAL_SERVICE_GUIDE_ROOT_ID}
				steps={guideSteps}
				audioLocalStorageKey={LOCAL_SERVICE_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={LOCAL_SERVICE_GUIDE_TOUR_FOLDER}
				labels={guideLabels}
				spotlightLayoutKey={spotlightLayoutKey}
				dialogTitleId="local-service-guide-title"
			/>
		</div>
	);
}

export default LocalServiceIframeApp;
