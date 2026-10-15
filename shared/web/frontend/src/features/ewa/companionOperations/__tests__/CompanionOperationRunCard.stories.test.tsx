/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest render stories for CompanionOperationRunCard UI states (U8.2).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionOperationRunCard } from '@/features/ewa/companionOperations/CompanionOperationRunCard';
import {
	COMPANION_OPERATION_RUN_CARD_STORIES,
	listCompanionOperationRunCardStories,
} from '@/features/ewa/companionOperations/companionOperationRunCardStories';

vi.mock('@/services/ewrpApi', () => ({
	ewrpApi: {
		downloadPdf: vi.fn(
			async () => new Blob(['pdf'], { type: 'application/pdf' })
		),
	},
}));

vi.mock(
	'@/features/ewa/companionOperations/CompanionOperationImagePreview',
	() => ({
		CompanionOperationImagePreview: () => null,
	})
);

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string | number>) => {
			const map: Record<string, string> = {
				'ewaCompanion.operationIntentMusicGeneration': 'Music generation',
				'ewaCompanion.operationIntentImageGeneration': 'Image generation',
				'ewaCompanion.operationIntentAppOpen': 'Open app',
				'ewaCompanion.operationIntentGeneric': 'Operation',
				'ewaCompanion.operationStatusPending': 'Pending',
				'ewaCompanion.operationStatusRunning': 'Running',
				'ewaCompanion.operationStatusAwaitingConfirmation': 'Needs confirm',
				'ewaCompanion.operationStatusCompleted': 'Done',
				'ewaCompanion.operationStatusFailed': 'Failed',
				'ewaCompanion.operationStatusCancelled': 'Cancelled',
				'ewaCompanion.operationConfirm': 'Confirm',
				'ewaCompanion.operationCancel': 'Cancel',
				'ewaCompanion.operationRetry': 'Retry',
				'ewaCompanion.operationErrorDetail': `Could not finish: ${params?.message ?? ''}`,
				'ewaCompanion.musicProgressStep': `Step ${params?.current ?? 0}/${params?.total ?? 0}: ${params?.title ?? ''}`,
				'ewaCompanion.musicProgressPending': 'Preparing music…',
				'ewaCompanion.operationsCancelRun': 'Cancel run',
				'ewaCompanion.operationsPlayReadyTrackNow': 'Play now',
				'ewaCompanion.operationsMusicCardAria': `Track ${params?.name ?? ''}`,
				'ewaCompanion.operationsMusicCoverAlt': `Cover ${params?.name ?? ''}`,
				'ewaCompanion.operationTrackUntitled': 'Untitled',
				'ewaCompanion.centerMissionShowProgress': 'Show progress',
				'ewaCompanion.centerMissionAnswerInCenter': 'Answer in center',
			};
			return map[key] ?? key;
		},
	}),
}));

function renderStory(
	storyId: keyof typeof COMPANION_OPERATION_RUN_CARD_STORIES,
	extra?: Partial<Parameters<typeof CompanionOperationRunCard>[0]>
) {
	const story = COMPANION_OPERATION_RUN_CARD_STORIES[storyId];
	return render(
		<ul>
			<CompanionOperationRunCard
				run={story.run}
				ru
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onCancelRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
				onRetryPrompt={vi.fn()}
				{...extra}
			/>
		</ul>
	);
}

describe('CompanionOperationRunCard stories (U8.2)', () => {
	it('exports a stable story catalog', () => {
		expect(listCompanionOperationRunCardStories()).toHaveLength(6);
	});

	it('pending_music shows pending status', () => {
		renderStory('pending_music');
		expect(screen.getByText('Pending')).toBeTruthy();
	});

	it('in_progress_music shows progress and step timeline', () => {
		const { container } = renderStory('in_progress_music');
		expect(screen.getByText('Running')).toBeTruthy();
		expect(screen.getByText('Step 2/4: Стиль')).toBeTruthy();
		expect(container.querySelector('[role="progressbar"]')).toBeTruthy();
	});

	it('awaiting_confirmation renders confirm bar actions', () => {
		const onConfirmRun = vi.fn();
		renderStory('awaiting_confirmation', { onConfirmRun });
		fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
		expect(onConfirmRun).toHaveBeenCalledWith(
			'story-awaiting-confirmation',
			'confirm'
		);
	});

	it('completed_music renders music play card', () => {
		renderStory('completed_music');
		expect(screen.getByText('Done')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Play now' })).toBeTruthy();
	});

	it('failed_music shows assertive error and retry', () => {
		const onRetryPrompt = vi.fn();
		renderStory('failed_music', { onRetryPrompt });
		expect(screen.getByRole('alert')).toBeTruthy();
		expect(
			screen.getByText('Could not finish: GPU queue timeout')
		).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		expect(onRetryPrompt).toHaveBeenCalled();
	});

	it('cancelled_generic shows muted cancelled status', () => {
		renderStory('cancelled_generic');
		expect(screen.getByText('Cancelled')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
	});

	it('secondary rail mode keeps only center focus for rich active details', () => {
		const onFocusRun = vi.fn();
		const { container } = renderStory('in_progress_music', {
			onFocusRun,
			secondaryRailMode: true,
		});

		expect(screen.getByText('Running')).toBeTruthy();
		expect(screen.queryByText('Step 2/4: Стиль')).toBeNull();
		expect(container.querySelector('[role="progressbar"]')).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Show progress' }));
		expect(onFocusRun).toHaveBeenCalledWith('story-in-progress-music');
	});

	it('secondary rail mode routes confirmation to center instead of full confirm bar', () => {
		const onFocusRun = vi.fn();
		renderStory('awaiting_confirmation', {
			onFocusRun,
			secondaryRailMode: true,
		});

		expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Answer in center' }));
		expect(onFocusRun).toHaveBeenCalledWith('story-awaiting-confirmation');
	});

	it('rerenders when secondary rail mode changes for the same run', () => {
		const story = COMPANION_OPERATION_RUN_CARD_STORIES.in_progress_music;
		const onFocusRun = vi.fn();
		const { container, rerender } = render(
			<ul>
				<CompanionOperationRunCard
					run={story.run}
					ru
					confirmBusyRunId={null}
					onConfirmRun={vi.fn()}
					onCancelRun={vi.fn()}
					onPlayTrack={vi.fn()}
					onDraftPlayPrompt={vi.fn()}
					onOpenPresentationInEwrp={vi.fn()}
					onRetryPrompt={vi.fn()}
					onFocusRun={onFocusRun}
					secondaryRailMode={false}
				/>
			</ul>
		);
		expect(container.querySelector('[role="progressbar"]')).toBeTruthy();

		rerender(
			<ul>
				<CompanionOperationRunCard
					run={story.run}
					ru
					confirmBusyRunId={null}
					onConfirmRun={vi.fn()}
					onCancelRun={vi.fn()}
					onPlayTrack={vi.fn()}
					onDraftPlayPrompt={vi.fn()}
					onOpenPresentationInEwrp={vi.fn()}
					onRetryPrompt={vi.fn()}
					onFocusRun={onFocusRun}
					secondaryRailMode
				/>
			</ul>
		);

		expect(container.querySelector('[role="progressbar"]')).toBeNull();
		expect(screen.getByRole('button', { name: 'Show progress' })).toBeTruthy();
	});
});
