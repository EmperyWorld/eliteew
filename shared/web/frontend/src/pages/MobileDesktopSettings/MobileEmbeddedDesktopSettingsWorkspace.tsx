/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop workspace provider stack for mobile embedded Settings Center only
 * (reuses `DesktopWorkspaceContent` bridge assembly without shell chrome).
 *
 * Invariants:
 * - Loaded only from `#/mobile-desktop-settings` via `MobileDesktopSettingsPage`.
 * - Does not mount taskbar, icons, or window manager.
 *
 * Related:
 * - DesktopWorkspaceContent.tsx, MobileDesktopSettingsPage.tsx
 */

import * as React from 'react';
import { Suspense, lazy, useLayoutEffect } from 'react';
import { LazyMotion, domMax } from 'framer-motion';
import { ErrorBoundary } from '@/components/ui/primitives/ErrorBoundary';
import { MobileEmbeddedRouteLoading } from '@/components/mobileEmbedded/MobileEmbeddedRouteLoading';
import { DESKTOP_DESIGN_TOKENS } from '@/pages/Desktop/constants';
import { DesktopStateProvider } from '@/pages/Desktop/context/DesktopStateContext';
import { GAFChatProvider } from '@/pages/Desktop/context/GAFChatProvider';
import { MusicLibraryProvider } from '@/pages/Desktop/context/MusicLibraryContext';
import { MusicPlaybackDomainProvider } from '@/pages/Desktop/context/MusicPlaybackDomainContext';
import { NowPlayingProvider } from '@/pages/Desktop/context/NowPlayingContext';
import { useDesktopStorage } from '@/pages/Desktop/hooks/useDesktopStorage';
import { DesktopBackgroundRuntimeProvider } from '@/pages/Desktop/runtime/DesktopBackgroundRuntimeContext';
import { DesktopSocketNotificationsBridge } from '@/pages/Desktop/DesktopSocketNotificationsBridge';

const DesktopWorkspaceContent = lazy(
	() => import('@/pages/Desktop/DesktopWorkspaceContent')
);

function MobileEmbeddedDesktopSettingsFallback(): React.JSX.Element {
	return (
		<div
			className="relative flex min-h-0 h-full w-full flex-col overflow-hidden dark"
			style={DESKTOP_DESIGN_TOKENS}
			role="status"
			aria-busy="true"
		>
			<MobileEmbeddedRouteLoading message="Открываем настройки рабочего стола…" />
		</div>
	);
}

export function MobileEmbeddedDesktopSettingsWorkspace(): React.JSX.Element {
	const storage = useDesktopStorage();
	useLayoutEffect(() => {
		document.documentElement.classList.add('dark');
	}, []);

	return (
		<ErrorBoundary>
			<DesktopStateProvider>
				<NowPlayingProvider>
					<MusicPlaybackDomainProvider>
						<MusicLibraryProvider>
							<DesktopBackgroundRuntimeProvider>
								<GAFChatProvider>
									<DesktopSocketNotificationsBridge />
									<Suspense
										fallback={<MobileEmbeddedDesktopSettingsFallback />}
									>
										<LazyMotion features={domMax}>
											<DesktopWorkspaceContent
												storage={storage}
												embeddedMobileSettingsOnly
											/>
										</LazyMotion>
									</Suspense>
								</GAFChatProvider>
							</DesktopBackgroundRuntimeProvider>
						</MusicLibraryProvider>
					</MusicPlaybackDomainProvider>
				</NowPlayingProvider>
			</DesktopStateProvider>
		</ErrorBoundary>
	);
}
