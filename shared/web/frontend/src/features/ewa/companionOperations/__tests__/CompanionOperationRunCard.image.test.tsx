/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for image operation CTAs in CompanionOperationRunCard.
 *
 * Invariants:
 * - Image buttons only draft/send actions; backend remains responsible for mode routing.
 *
 * Related:
 * - src/features/ewa/companionOperations/CompanionOperationRunCard.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionOperationRunCard } from '@/features/ewa/companionOperations/CompanionOperationRunCard';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

vi.mock('@/services/ewrpApi', () => ({
	ewrpApi: {
		downloadPdf: vi.fn(
			async () => new Blob(['pdf'], { type: 'application/pdf' })
		),
	},
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string>) => {
			if (key === 'ewaCompanion.operationIntentImageGeneration') return 'Image';
			if (key === 'ewaCompanion.operationIntentPresentationGeneration')
				return 'Presentation';
			if (key === 'ewaCompanion.operationStatusCompleted') return 'Done';
			if (key === 'ewaCompanion.operationStatusFailed') return 'Failed';
			if (key === 'ewaCompanion.operationErrorDetail')
				return `Could not finish: ${params?.message ?? ''}`;
			if (key === 'ewaCompanion.operationsImageEnlarge') return 'Enlarge';
			if (key === 'ewaCompanion.operationsImageDownload') return 'Download';
			if (key === 'ewaCompanion.operationsImageShareGaf') return 'Share';
			if (key === 'ewaCompanion.operationsImageAnalyze') return 'Analyze';
			if (key === 'ewaCompanion.operationsImageEdit') return 'Edit';
			if (key === 'ewaCompanion.operationsImageVariant') return 'Variant';
			if (key === 'ewaCompanion.operationsPlayReadyTrackNow') return 'Play now';
			if (key === 'ewaCompanion.operationsImageEditDraft')
				return `edit image uc=${params?.id ?? ''}: `;
			if (key === 'ewaCompanion.operationsImageVariantDraft')
				return `generate an image variant: ${params?.prompt ?? ''}`;
			if (key === 'ewaCompanion.operationImageReadyHint') return 'Ready';
			if (key === 'ewaCompanion.operationDetailImagePrompt')
				return `Brief: ${params?.prompt ?? ''}`;
			if (key === 'ewaCompanion.operationsPresentationOpenPdf')
				return 'Open PDF';
			if (key === 'ewaCompanion.operationsPresentationDownloadPdf')
				return 'Download PDF';
			if (key === 'ewaCompanion.operationsPresentationOpenEditor')
				return 'Edit in EWRP';
			if (key === 'ewaCompanion.operationsPresentationOpenEditorDraft')
				return `open EWRP ${params?.id ?? ''}`;
			if (key === 'ewaCompanion.operationPresentationReadyHint')
				return 'PDF ready';
			if (key === 'ewaCompanion.operationPresentationDeckBadge')
				return 'EWRP Deck';
			if (key === 'ewaCompanion.operationPresentationPdfReady')
				return 'PDF ready';
			if (key === 'ewaCompanion.operationPresentationRendering')
				return 'Rendering';
			if (key === 'ewaCompanion.operationPresentationReadyShort')
				return 'Presentation ready';
			if (key === 'ewaCompanion.operationPresentationProgress')
				return `Building ${params?.progress ?? ''}%`;
			if (key === 'ewaCompanion.operationPresentationPreparingHint')
				return 'Preparing PDF';
			if (key === 'ewaCompanion.operationPresentationJobId')
				return `job ${params?.id ?? ''}`;
			if (key === 'ewaCompanion.operationPresentationSlidesShort')
				return 'slides';
			if (key === 'ewaCompanion.operationPresentationTheme')
				return `Theme: ${params?.theme ?? ''}`;
			return key;
		},
	}),
}));

vi.mock(
	'@/features/ewa/companionOperations/CompanionOperationImagePreview',
	() => ({
		CompanionOperationImagePreview: ({ contentId }: { contentId: string }) => (
			<img alt="" data-testid="image-preview" data-content-id={contentId} />
		),
	})
);

describe('CompanionOperationRunCard image CTAs', () => {
	it('drafts backend-readable edit and variant prompts for a ready image', () => {
		const onDraftPlayPrompt = vi.fn();
		const onSendImageToCompanion = vi.fn();
		const run: EwaCompanionTaskRun = {
			id: 'run-img',
			principal_id: 'p1',
			status: 'completed',
			intent_kind: 'image_generation_background',
			user_message: 'нарисуй море',
			plan_payload: {},
			confirmation_state: {},
			result_payload: {
				content_id: '04881699-0d6b-421f-a68d-ed1ad9a7930b',
				prompt_preview: 'blue ocean',
			},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: '2026-05-28T00:00:00Z',
		};

		const { container } = render(
			<CompanionOperationRunCard
				run={run}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={onDraftPlayPrompt}
				onOpenPresentationInEwrp={vi.fn()}
				onSendImageToCompanion={onSendImageToCompanion}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
		expect(onSendImageToCompanion).toHaveBeenCalledWith(
			expect.objectContaining({
				unifiedContentId: '04881699-0d6b-421f-a68d-ed1ad9a7930b',
			})
		);

		fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		expect(onDraftPlayPrompt).toHaveBeenCalledWith(
			'edit image uc=04881699-0d6b-421f-a68d-ed1ad9a7930b: '
		);

		fireEvent.click(screen.getByRole('button', { name: 'Variant' }));
		expect(onDraftPlayPrompt).toHaveBeenCalledWith(
			'generate an image variant: blue ocean'
		);
		expect(container.innerHTML).not.toContain('violet');
		expect(container.innerHTML).toContain('--companion-aura');
	});

	it('promotes failed operation details into an assertive alert', () => {
		const run: EwaCompanionTaskRun = {
			id: 'run-img-failed',
			principal_id: 'p1',
			status: 'failed',
			intent_kind: 'image_generation_background',
			user_message: 'нарисуй море',
			plan_payload: {},
			confirmation_state: {},
			result_payload: {},
			error_payload: {
				message: 'image worker unavailable',
			},
			execution_mode: 'async',
			run_revision: 1,
			created_at: '2026-05-28T00:00:00Z',
			updated_at: '2026-05-28T00:01:00Z',
			completed_at: '2026-05-28T00:02:00Z',
		};

		render(
			<CompanionOperationRunCard
				run={run}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
			/>
		);

		const alert = screen.getByRole('alert');
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent(
			'Could not finish: image worker unavailable'
		);
		expect(screen.getByText('Failed')).toBeInTheDocument();
	});

	it('dispatches music_play_track action from ready track CTA', () => {
		const onPlayTrack = vi.fn();
		const run: EwaCompanionTaskRun = {
			id: 'run-music',
			principal_id: 'p1',
			status: 'completed',
			intent_kind: 'music_generation_xl_base_background',
			user_message: 'сделай песню',
			plan_payload: {},
			confirmation_state: {},
			result_payload: {
				content_id: 'af89cd61-9f15-49ca-a4b5-4efba9d796c7',
				track_name: 'Про нас с тобой',
				thumbnail_url: 'https://example.com/cover.png',
			},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: '2026-05-28T00:00:00Z',
		};

		render(
			<CompanionOperationRunCard
				run={run}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={onPlayTrack}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Play now' }));
		expect(onPlayTrack).toHaveBeenCalledWith({
			type: 'music_play_track',
			unified_content_id: 'af89cd61-9f15-49ca-a4b5-4efba9d796c7',
			track_name: 'Про нас с тобой',
			thumbnail_url: 'https://example.com/cover.png',
		});
	});

	it('renders EWRP presentation actions for a ready presentation run', () => {
		const onOpenPresentationInEwrp = vi.fn();
		const run: EwaCompanionTaskRun = {
			id: 'run-prs',
			principal_id: 'p1',
			status: 'completed',
			intent_kind: 'presentation_generation_background',
			user_message: 'создай презентацию',
			plan_payload: {},
			confirmation_state: {},
			result_payload: {
				ewrp_job_id: '34881699-0d6b-421f-a68d-ed1ad9a7930b',
				title: 'AI strategy',
				topic: 'AI strategy for sales',
				slides_count: 8,
				presentation_theme: 'aurora',
				pdf_download_token: 'token-1',
			},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: null,
			updated_at: null,
			completed_at: '2026-05-28T00:00:00Z',
		};

		const { container } = render(
			<CompanionOperationRunCard
				run={run}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={onOpenPresentationInEwrp}
			/>
		);

		expect(screen.getByText('AI strategy')).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Open PDF/i })
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Download PDF/i })
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Edit in EWRP' }));
		expect(onOpenPresentationInEwrp).toHaveBeenCalledWith(
			'34881699-0d6b-421f-a68d-ed1ad9a7930b'
		);
		expect(container.innerHTML).not.toContain('violet');
		expect(container.innerHTML).toContain('--companion-aura');
	});

	it('renders EWRP presentation progress before PDF actions are ready', () => {
		const run: EwaCompanionTaskRun = {
			id: 'run-prs-active',
			principal_id: 'p1',
			status: 'running',
			intent_kind: 'presentation_generation_background',
			user_message: 'создай презентацию',
			plan_payload: {
				title: 'Sales deck',
				topic_preview: 'Sales deck for Q3',
				num_slides: 6,
				presentation_theme: 'neon',
			},
			confirmation_state: {},
			result_payload: {
				progress: 42,
			},
			error_payload: {},
			execution_mode: 'async',
			run_revision: 1,
			created_at: '2026-05-28T00:00:00Z',
			updated_at: '2026-05-28T00:01:00Z',
			completed_at: null,
		};

		const { container } = render(
			<CompanionOperationRunCard
				run={run}
				ru={false}
				confirmBusyRunId={null}
				onConfirmRun={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
			/>
		);

		expect(
			screen.getByTestId('presentation-operation-card')
		).toBeInTheDocument();
		expect(screen.getByText('Sales deck')).toBeInTheDocument();
		expect(screen.getByText('Building 42%')).toBeInTheDocument();
		expect(screen.getByText('Preparing PDF')).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: /Open PDF/i })
		).not.toBeInTheDocument();
		expect(screen.getByRole('progressbar')).toHaveAttribute(
			'aria-valuenow',
			'42'
		);
		expect(container.innerHTML).not.toContain('violet');
		expect(container.innerHTML).toContain('--companion-aura');
	});
});
