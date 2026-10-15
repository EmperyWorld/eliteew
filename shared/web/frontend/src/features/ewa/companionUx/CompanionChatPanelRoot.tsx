/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Root shell for companion chat panel: guide root id, presence palette, embedded-mobile attrs (U8.3 slice 25).
 *
 * Invariants:
 * - ``id`` stays ``EWA_DESKTOP_GUIDE_ROOT_ID`` for guided tour spotlight resolution.
 * - ``companion-presence-at-rest`` pauses ambient sigil CSS when foreground idle.
 *
 * Related:
 * - src/features/ewa/ewaDesktopGuideConstants.ts
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

import type { CSSProperties, ReactNode } from 'react';

import { MOBILE_EMBEDDED_EWA_PRESENCE_ROOT_CLASS } from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { CompanionPanelBackgroundHint } from '@/features/ewa/companionUx/CompanionPanelBackgroundHint';
import { EWA_DESKTOP_GUIDE_ROOT_ID } from '@/features/ewa/ewaDesktopGuideConstants';
import { cn } from '@/utils/cn';

export type CompanionChatPanelRootProps = {
	mobileEmbeddedLayout: boolean;
	mobileEmbeddedLandscape: boolean;
	arlikaPresence: boolean;
	isDesktopWindowActive: boolean;
	paletteStyle: CSSProperties | undefined;
	workChromeActive?: boolean;
	presenceAtRest?: boolean;
	children: ReactNode;
};

export function CompanionChatPanelRoot({
	mobileEmbeddedLayout,
	mobileEmbeddedLandscape,
	arlikaPresence,
	isDesktopWindowActive,
	paletteStyle,
	workChromeActive = false,
	presenceAtRest = false,
	children,
}: CompanionChatPanelRootProps) {
	return (
		<div
			id={EWA_DESKTOP_GUIDE_ROOT_ID}
			data-testid="ewa-companion-chat-root"
			data-embedded-mobile={mobileEmbeddedLayout ? '1' : undefined}
			data-mobile-landscape={mobileEmbeddedLandscape ? '1' : undefined}
			data-work-chrome={workChromeActive ? '1' : undefined}
			data-presence-at-rest={presenceAtRest ? '1' : undefined}
			className={cn(
				'companion-presence-root relative',
				mobileEmbeddedLayout
					? MOBILE_EMBEDDED_EWA_PRESENCE_ROOT_CLASS
					: 'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3',
				arlikaPresence && 'companion-presence-arlika',
				workChromeActive && 'companion-presence-work-active',
				presenceAtRest && 'companion-presence-at-rest',
				!isDesktopWindowActive && 'companion-presence-background'
			)}
			style={paletteStyle}
		>
			<CompanionPanelBackgroundHint
				visible={!isDesktopWindowActive}
				mobileEmbeddedLayout={mobileEmbeddedLayout}
			/>
			{children}
		</div>
	);
}
