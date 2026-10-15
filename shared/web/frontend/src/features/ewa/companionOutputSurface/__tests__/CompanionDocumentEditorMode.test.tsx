/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component-level regression coverage for companion embedded document editor mode.
 *
 * Invariants:
 * - Save hotkey triggers the same persistence path as Save button.
 * - Version conflict exposes explicit force-save path.
 * - Server-side draft snapshot can be restored after surface load.
 * - Footer exposes server-draft sync states for queued/retry telemetry.
 * - Footer sync action can force immediate draft flush and expose synced age.
 * - Structure action jumps by backend offsets rather than browser-side parsing.
 *
 * Related:
 * - ../CompanionDocumentEditorMode
 * - src/services/ewa/ewaCompanionDocumentSurfaceApi.ts
 */

import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanionDocumentEditorMode } from '../CompanionDocumentEditorMode';
import {
	deleteEwaCompanionDocumentServerDraft,
	EwaCompanionDocumentSaveConflictError,
	fetchEwaCompanionDocumentStructure,
	fetchEwaCompanionDocumentServerDraft,
	fetchEwaCompanionSurfaceDocument,
	saveEwaCompanionDocumentServerDraft,
	saveEwaCompanionSurfaceDocument,
} from '@/services/ewa/ewaCompanionDocumentSurfaceApi';

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
			i18n: {
				language: 'en',
			},
		}),
	};
});

vi.mock('@/hooks/useMediaQuery', () => ({
	useMediaQuery: (query: string) => /min-width:\s*1024px/.test(query),
}));

vi.mock('@/pages/Desktop/utils/desktopDeepLink', () => ({
	requestOpenDocEditorV2WithUnifiedContent: vi.fn(),
}));

const localStorageMock = vi.hoisted(() => {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
	};
});

vi.stubGlobal('localStorage', localStorageMock);

vi.mock('@/services/ewa/ewaCompanionDocumentSurfaceApi', async () => {
	const actual = await vi.importActual<
		typeof import('@/services/ewa/ewaCompanionDocumentSurfaceApi')
	>('@/services/ewa/ewaCompanionDocumentSurfaceApi');
	return {
		...actual,
		deleteEwaCompanionDocumentServerDraft: vi.fn(),
		fetchEwaCompanionSurfaceDocument: vi.fn(),
		fetchEwaCompanionDocumentServerDraft: vi.fn(),
		saveEwaCompanionDocumentServerDraft: vi.fn(),
		saveEwaCompanionSurfaceDocument: vi.fn(),
		checkEwaCompanionDocumentPreInsert: vi.fn().mockResolvedValue({
			allowed: true,
			warnings: [],
			textHash: null,
			checkedAt: null,
		}),
		fetchEwaCompanionDocumentStructure: vi.fn(),
		streamEwaCompanionDocumentAiTransform: vi.fn().mockResolvedValue(''),
	};
});

const mockedFetch = vi.mocked(fetchEwaCompanionSurfaceDocument);
const mockedFetchStructure = vi.mocked(fetchEwaCompanionDocumentStructure);
const mockedSave = vi.mocked(saveEwaCompanionSurfaceDocument);
const mockedFetchServerDraft = vi.mocked(fetchEwaCompanionDocumentServerDraft);
const mockedSaveServerDraft = vi.mocked(saveEwaCompanionDocumentServerDraft);
const mockedDeleteServerDraft = vi.mocked(
	deleteEwaCompanionDocumentServerDraft
);

function renderMode() {
	return render(
		<CompanionDocumentEditorMode
			payload={{
				documentId: 'doc-1',
				title: 'Doc',
				content_markdown: '# Seed',
				source_format: 'markdown',
			}}
			onBackToChat={() => undefined}
			onDraftPrompt={() => undefined}
		/>
	);
}

describe('CompanionDocumentEditorMode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.localStorage.clear();
		mockedFetch.mockResolvedValue({
			id: 'doc-1',
			title: 'Doc',
			content: '<p>Seed</p>',
			contentMarkdown: '# Seed',
			contentHtml: '<h1>Seed</h1>',
			plainText: 'Seed',
			mimeType: 'text/markdown',
			originalFilename: 'doc.md',
			sourceFormat: 'markdown',
			parseWarnings: [],
			version: 2,
			canSave: true,
		});
		mockedSave.mockResolvedValue({
			id: 'doc-1',
			title: 'Doc',
			content: '<p>Edited</p>',
			contentMarkdown: '# Edited',
			contentHtml: '<h1>Edited</h1>',
			plainText: 'Edited',
			mimeType: 'text/markdown',
			originalFilename: 'doc.md',
			sourceFormat: 'markdown',
			parseWarnings: [],
			version: 3,
			canSave: true,
		});
		mockedFetchServerDraft.mockResolvedValue(null);
		mockedFetchStructure.mockResolvedValue({
			id: 'doc-1',
			title: 'Doc',
			sourceFormat: 'markdown',
			version: 2,
			totalLines: 1,
			totalChars: 6,
			truncated: false,
			maxSections: 80,
			sections: [],
		});
		mockedSaveServerDraft.mockResolvedValue({
			documentId: 'doc-1',
			draftVersion: 1,
			baseDocumentVersion: 2,
			content: '# Edited',
			sourceSessionId: 'sess-a',
			updatedBy: 'user',
			createdAt: null,
			updatedAt: new Date().toISOString(),
		});
		mockedDeleteServerDraft.mockResolvedValue(true);
	});

	it('uses compact chrome and persona-aware action labels', async () => {
		render(
			<CompanionDocumentEditorMode
				payload={{
					documentId: 'doc-1',
					title: 'Doc',
					content_markdown: '# Seed',
					source_format: 'markdown',
				}}
				companionProfile={{
					seed_persona_id: 'mela',
					baseline: {},
					style_parameters: {},
					character_state: {
						seed_persona_id: 'mela',
						mood: { valence: 0, energy: 0, tension: 0, confidence: 0 },
						bond: { trust: 0, familiarity: 0, repair_need: 0 },
						interaction_style: {
							answer_length: 0,
							initiative: 0,
							reassurance: 0,
						},
					},
				}}
				onBackToChat={() => undefined}
				onDraftPrompt={() => undefined}
			/>
		);

		await screen.findByRole('button', {
			name: 'ewaCompanion.documentSurfaceDiscussWithName',
		});
		expect(
			screen.queryByText('ewaCompanion.documentSurfaceTitle')
		).not.toBeInTheDocument();
		expect(
			screen.getByText('ewaCompanion.documentSurfaceAiTitleWithName')
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: 'ewaCompanion.documentSurfaceRunCustomWithName',
			})
		).toBeInTheDocument();
	});

	it('mounts action controls into external rail host when provided', async () => {
		const externalHost = document.createElement('div');
		document.body.appendChild(externalHost);
		try {
			render(
				<CompanionDocumentEditorMode
					payload={{
						documentId: 'doc-1',
						title: 'Doc',
						content_markdown: '# Seed',
						source_format: 'markdown',
					}}
					companionProfile={{
						seed_persona_id: 'kora',
						baseline: {},
						style_parameters: {},
						character_state: {
							seed_persona_id: 'kora',
							mood: { valence: 0, energy: 0, tension: 0, confidence: 0 },
							bond: { trust: 0, familiarity: 0, repair_need: 0 },
							interaction_style: {
								answer_length: 0,
								initiative: 0,
								reassurance: 0,
							},
						},
					}}
					externalActionsHost={externalHost}
					onBackToChat={() => undefined}
					onDraftPrompt={() => undefined}
				/>
			);

			await screen.findByText('ewaCompanion.documentSurfaceAiResultWithName');
			expect(
				within(externalHost).getByRole('button', {
					name: 'ewaCompanion.documentSurfaceDiscussWithName',
				})
			).toBeInTheDocument();
			expect(
				within(externalHost).getByRole('button', {
					name: 'ewaCompanion.documentSurfaceRunCustomWithName',
				})
			).toBeInTheDocument();
		} finally {
			externalHost.remove();
		}
	});

	it('announces document load failures as an assertive alert', async () => {
		mockedFetch.mockRejectedValueOnce(new Error('document offline'));

		renderMode();

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent('document offline');
	});

	it('loads backend structure and exposes section navigation', async () => {
		mockedFetchStructure.mockResolvedValue({
			id: 'doc-1',
			title: 'Doc',
			sourceFormat: 'markdown',
			version: 2,
			totalLines: 1,
			totalChars: 6,
			truncated: false,
			maxSections: 80,
			sections: [
				{
					id: 'sec-1-seed',
					level: 1,
					title: 'Seed heading',
					slug: 'seed-heading',
					lineStart: 1,
					lineEnd: 1,
					charStart: 2,
					charEnd: 6,
					preview: 'server preview',
					wordCount: 1,
					childrenCount: 0,
				},
			],
		});
		renderMode();
		await screen.findByLabelText('ewaCompanion.documentSurfaceMarkdownLabel');

		await waitFor(() => {
			expect(mockedFetchStructure).toHaveBeenCalled();
		});
		const structureButton = screen.getByRole('button', {
			name: 'ewaCompanion.documentStructureButton',
		});
		await waitFor(() => {
			expect(structureButton).not.toBeDisabled();
		});
		fireEvent.click(structureButton);
		fireEvent.click(
			await screen.findByRole('button', { name: /Seed heading/i })
		);
		expect(mockedFetchStructure).toHaveBeenCalledWith('doc-1');
	});

	it('announces document structure load failures as an assertive alert', async () => {
		mockedFetchStructure.mockRejectedValueOnce(new Error('structure offline'));
		renderMode();

		await screen.findByLabelText('ewaCompanion.documentSurfaceMarkdownLabel');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.documentStructureButton',
			})
		);

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveAttribute('aria-live', 'assertive');
		expect(alert).toHaveTextContent('structure offline');
	});

	it('saves current markdown on Ctrl+S hotkey', async () => {
		renderMode();
		const textarea = (await screen.findByLabelText(
			'ewaCompanion.documentSurfaceMarkdownLabel'
		)) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: '# Edited' } });
		fireEvent.keyDown(textarea, {
			key: 's',
			ctrlKey: true,
		});

		await waitFor(() => {
			expect(mockedSave).toHaveBeenCalledWith(
				'doc-1',
				expect.objectContaining({
					content: '# Edited',
					expectedVersion: 2,
					forceSave: false,
				})
			);
		});
	});

	it('offers force-save retry after version conflict', async () => {
		mockedSave
			.mockRejectedValueOnce(
				new EwaCompanionDocumentSaveConflictError({
					expectedVersion: 2,
					currentVersion: 5,
					serverDocument: null,
				})
			)
			.mockResolvedValueOnce({
				id: 'doc-1',
				title: 'Doc',
				content: '<p>Forced</p>',
				contentMarkdown: '# Forced',
				contentHtml: '<h1>Forced</h1>',
				plainText: 'Forced',
				mimeType: 'text/markdown',
				originalFilename: 'doc.md',
				sourceFormat: 'markdown',
				parseWarnings: [],
				version: 6,
				canSave: true,
			});

		renderMode();

		fireEvent.click(
			await screen.findByRole('button', {
				name: 'ewaCompanion.documentSurfaceSave',
			})
		);
		await screen.findByText('ewaCompanion.documentSurfaceVersionConflictHint');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.documentSurfaceVersionConflictForceSave',
			})
		);

		await waitFor(() => {
			expect(mockedSave).toHaveBeenNthCalledWith(
				2,
				'doc-1',
				expect.objectContaining({
					forceSave: true,
				})
			);
		});
	});

	it('offers recovery from server-side draft snapshot on load', async () => {
		mockedFetchServerDraft.mockResolvedValueOnce({
			documentId: 'doc-1',
			draftVersion: 8,
			baseDocumentVersion: 2,
			content: '# Server Draft',
			sourceSessionId: 'sess-z',
			updatedBy: 'user',
			createdAt: null,
			updatedAt: '2026-05-28T00:04:00Z',
		});
		renderMode();

		await screen.findByText('ewaCompanion.documentSurfaceRecoverUnified');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.documentSurfaceRecoverDraftRestore',
			})
		);

		const textarea = (await screen.findByLabelText(
			'ewaCompanion.documentSurfaceMarkdownLabel'
		)) as HTMLTextAreaElement;
		expect(textarea.value).toBe('# Server Draft');
	});

	it('shows queued draft-sync indicator after local markdown edit', async () => {
		renderMode();
		await waitFor(() => {
			expect(mockedFetchServerDraft).toHaveBeenCalled();
		});
		const textarea = (await screen.findByLabelText(
			'ewaCompanion.documentSurfaceMarkdownLabel'
		)) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: '# Edited queued' } });

		await screen.findByText((content) =>
			content.includes('ewaCompanion.documentSurfaceServerDraftSyncQueued')
		);
	});

	it('switches draft-sync indicator to retrying on transient autosave failure', async () => {
		mockedSaveServerDraft.mockRejectedValueOnce(new Error('network down'));
		renderMode();
		await waitFor(() => {
			expect(mockedFetchServerDraft).toHaveBeenCalled();
		});
		const textarea = (await screen.findByLabelText(
			'ewaCompanion.documentSurfaceMarkdownLabel'
		)) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: '# Edited retrying' } });

		await waitFor(
			() => {
				expect(
					screen.getByText((content) =>
						content.includes(
							'ewaCompanion.documentSurfaceServerDraftSyncRetrying'
						)
					)
				).toBeInTheDocument();
			},
			{ timeout: 4000 }
		);
	});

	it('runs immediate draft sync on explicit sync-now action', async () => {
		renderMode();
		await waitFor(() => {
			expect(mockedFetchServerDraft).toHaveBeenCalled();
		});
		const textarea = (await screen.findByLabelText(
			'ewaCompanion.documentSurfaceMarkdownLabel'
		)) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: '# Edited sync now' } });

		fireEvent.click(
			await screen.findByRole('button', {
				name: 'ewaCompanion.documentSurfaceServerDraftSyncNow',
			})
		);

		await waitFor(() => {
			expect(mockedSaveServerDraft).toHaveBeenCalled();
		});
	});

	it('shows synced-age hint after successful draft sync', async () => {
		renderMode();
		await waitFor(() => {
			expect(mockedFetchServerDraft).toHaveBeenCalled();
		});
		const textarea = (await screen.findByLabelText(
			'ewaCompanion.documentSurfaceMarkdownLabel'
		)) as HTMLTextAreaElement;
		fireEvent.change(textarea, { target: { value: '# Edited synced age' } });
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'ewaCompanion.documentSurfaceServerDraftSyncNow',
			})
		);

		await waitFor(() => {
			expect(
				screen.getByText((content) =>
					content.includes('ewaCompanion.documentSurfaceServerDraftSynced')
				)
			).toBeInTheDocument();
		});
	});
});
