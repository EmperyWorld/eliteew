/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Transcript scroll shell with streaming/active chrome classes (U8.3 slice 24).
 *
 * Invariants:
 * - Parent owns ``CompanionOutputSurface`` / chat content passed as ``children``.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionOutputSurface.tsx
 */

import type { ReactNode, Ref } from 'react';

import {
	MOBILE_EMBEDDED_EWA_LANDSCAPE_TRANSCRIPT_CLASS,
	MOBILE_EMBEDDED_EWA_TRANSCRIPT_CLASS,
} from '@/components/mobileEmbedded/mobileEmbeddedLayoutTokens';
import { COMPANION_CHROME_TRANSITION_CLASS } from '@/features/ewa/companionOutputSurface/companionSurfaceUi';
import { cn } from '@/utils/cn';

export type CompanionTranscriptColumnProps = {
	mobileEmbeddedLayout: boolean;
	mobileEmbeddedLandscape: boolean;
	surfacePanelActive: boolean;
	reducedMotion: boolean;
	composerVisible: boolean;
	pending: boolean;
	streamingText: string;
	scrollRef?: Ref<HTMLDivElement | null>;
	mobilePullIndicator: ReactNode;
	children: ReactNode;
};

export function CompanionTranscriptColumn({
	mobileEmbeddedLayout,
	mobileEmbeddedLandscape,
	surfacePanelActive,
	reducedMotion,
	composerVisible,
	pending,
	streamingText,
	scrollRef,
	mobilePullIndicator,
	children,
}: CompanionTranscriptColumnProps) {
	return (
		<div
			ref={scrollRef}
			data-testid="ewa-companion-transcript"
			data-ewa-guide="transcript"
			className={cn(
				mobileEmbeddedLayout
					? MOBILE_EMBEDDED_EWA_TRANSCRIPT_CLASS
					: 'min-h-0 flex-1',
				mobileEmbeddedLandscape &&
					MOBILE_EMBEDDED_EWA_LANDSCAPE_TRANSCRIPT_CLASS,
				'overflow-auto rounded-2xl',
				COMPANION_CHROME_TRANSITION_CLASS,
				surfacePanelActive
					? 'flex flex-col overflow-hidden px-0 py-0'
					: 'px-3 py-3',
				'border border-(--companion-divider)',
				'bg-[radial-gradient(circle_at_8%_0%,var(--companion-bg),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.40),rgba(15,23,42,0.16))]',
				'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
				!reducedMotion && !surfacePanelActive && 'backdrop-blur-sm',
				composerVisible &&
					pending &&
					!streamingText.trim() &&
					'companion-transcript-active',
				composerVisible &&
					pending &&
					Boolean(streamingText.trim()) &&
					'companion-transcript-streaming companion-transcript-streaming-lowgpu'
			)}
			aria-live="polite"
		>
			{mobilePullIndicator}
			{surfacePanelActive ? (
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
			) : (
				children
			)}
		</div>
	);
}
