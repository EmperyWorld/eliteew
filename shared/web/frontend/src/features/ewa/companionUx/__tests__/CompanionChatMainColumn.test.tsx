/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionChatMainColumn and CompanionTranscriptColumn (U8.3 slice 24).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionChatMainColumn } from '@/features/ewa/companionUx/CompanionChatMainColumn';
import { CompanionTranscriptColumn } from '@/features/ewa/companionUx/CompanionTranscriptColumn';

vi.mock('@/features/ewa/companionUx/CompanionComposerSection', () => ({
	CompanionComposerSection: () => <div data-testid="composer-section" />,
}));

describe('CompanionTranscriptColumn', () => {
	it('renders transcript test id and children', () => {
		render(
			<CompanionTranscriptColumn
				mobileEmbeddedLayout={false}
				mobileEmbeddedLandscape={false}
				surfacePanelActive={false}
				reducedMotion={false}
				composerVisible={false}
				pending={false}
				streamingText=""
				mobilePullIndicator={null}
			>
				<div data-testid="transcript-child" />
			</CompanionTranscriptColumn>
		);
		expect(screen.getByTestId('ewa-companion-transcript')).toBeInTheDocument();
		expect(screen.getByTestId('transcript-child')).toBeInTheDocument();
	});
});

describe('CompanionChatMainColumn', () => {
	it('renders meta rail, transcript, and composer slots', () => {
		render(
			<CompanionChatMainColumn
				mobileEmbeddedLandscape={false}
				mobileMetaRail={<div data-testid="meta-rail" />}
				transcriptColumnProps={{
					mobileEmbeddedLayout: false,
					mobileEmbeddedLandscape: false,
					surfacePanelActive: false,
					reducedMotion: false,
					composerVisible: false,
					pending: false,
					streamingText: '',
					mobilePullIndicator: null,
				}}
				transcriptContent={<div data-testid="transcript-content" />}
				composerSectionProps={{
					composerVisible: true,
					mobileEmbeddedLandscape: false,
					mobileEmbeddedComposerLayout: false,
					actionsTrayProps: {} as never,
					shellProps: {} as never,
					mobileBodyProps: {} as never,
					desktopBodyProps: {} as never,
				}}
			/>
		);
		expect(screen.getByTestId('meta-rail')).toBeInTheDocument();
		expect(screen.getByTestId('transcript-content')).toBeInTheDocument();
		expect(screen.getByTestId('composer-section')).toBeInTheDocument();
	});
});
