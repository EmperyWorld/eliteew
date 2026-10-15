/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for Document Editor V2 projection and save/draft payload helpers.
 *
 * Invariants:
 * - Save and draft payloads keep HTML, Markdown-ish and plain-text projections together.
 * - Shell state must surface version/conflict-ready status without mutating documents.
 *
 * Related:
 * - src/features/documentEditorV2/docEditorV2State.ts
 */

import { describe, expect, it } from 'vitest';

import type { DocEditorV2DocumentResponse } from '@/services/documentEditorV2Api';

import {
	buildCreateRequest,
	buildDraftRequest,
	buildShellStateFromViewModel,
	buildUpdateRequest,
	documentToDraft,
	htmlToPlainText,
	participantsToCollaborators,
	plainTextToHtml,
	suggestionsToRailItems,
} from '../docEditorV2State';

function documentFixture(): DocEditorV2DocumentResponse {
	return {
		document_id: 'doc-1',
		owner_user_id: 'user-1',
		title: 'Plan',
		editor_format: 'html',
		editor_json: null,
		content_html: '<h1>Plan</h1><p>Hello<br />World</p>',
		content_markdown: '# Plan\n\nHello\nWorld\n',
		plain_text: 'Plan\n\nHello\nWorld',
		source_format: 'html',
		parse_warnings: ['docx_stack4_fidelity_adapter_pending'],
		version: 3,
		capabilities: {
			can_read: true,
			can_edit: true,
			can_comment: true,
			can_collaborate: true,
			can_apply_ewa: true,
			can_export: true,
		},
		tags: [],
		created_at: '2026-06-05T00:00:00Z',
		updated_at: '2026-06-05T00:00:00Z',
	};
}

describe('docEditorV2State', () => {
	it('keeps text projections stable for create/update/draft payloads', () => {
		const draft = {
			title: 'Plan',
			contentHtml: plainTextToHtml('Hello\n\nWorld'),
			plainText: 'Hello\n\nWorld',
		};

		expect(htmlToPlainText(draft.contentHtml)).toBe('Hello\n\nWorld');
		expect(buildCreateRequest(draft)).toMatchObject({
			title: 'Plan',
			editor_format: 'html',
			source_format: 'html',
			plain_text: 'Hello\n\nWorld',
		});
		expect(buildUpdateRequest(documentFixture(), draft)).toMatchObject({
			expected_version: 3,
			content_html: draft.contentHtml,
		});
		expect(buildDraftRequest(documentFixture(), draft)).toMatchObject({
			base_document_version: 3,
			content_markdown: 'Hello\n\nWorld\n',
		});
	});

	it('builds shell state from persisted document, warnings and structure', () => {
		const document = documentFixture();
		const state = buildShellStateFromViewModel({
			document,
			draft: documentToDraft(document, 'Fallback'),
			saveStatus: 'synced',
			conflictDocument: null,
			structureItems: [
				{ id: 'h-1', title: 'Plan', level: 1, start_offset: 0, end_offset: 4 },
			],
			participants: [
				{
					user_id: 'user-1',
					role: 'owner',
					can_save: true,
					is_active: true,
				},
			],
			suggestions: [],
			errorMessage: null,
		});

		expect(state.documentId).toBe('doc-1');
		expect(state.versionLabel).toBe('v3');
		expect(state.outlineItems?.[0]?.title).toBe('Plan');
		expect(state.collaborators?.[0]?.role).toBe('owner');
		expect(state.importWarnings?.[0]?.tone).toBe('warning');
	});

	it('deduplicates collaboration participants for shell display', () => {
		const collaborators = participantsToCollaborators([
			{ user_id: 'u1', role: 'owner', can_save: true, is_active: true },
			{ user_id: 'u1', role: 'owner', can_save: true, is_active: true },
			{ user_id: 'u2', role: 'viewer', can_save: false, is_active: false },
		]);

		expect(collaborators).toHaveLength(2);
		expect(collaborators[1]).toMatchObject({
			name: 'Наблюдатель',
			role: 'viewer',
		});
	});

	it('maps EWA suggestions to guarded rail items', () => {
		const document = documentFixture();
		const railItems = suggestionsToRailItems([
			{
				id: 'sug-1',
				document_id: document.document_id,
				action: 'rewrite_selection',
				status: 'needs_approval',
				title: 'Rewrite',
				explanation: 'Improve',
				replacement_text: 'Better',
				base_document_version: document.version,
				context_packet: {
					document_id: document.document_id,
					title: document.title,
					version: document.version,
					capabilities: document.capabilities,
					selected_text: '',
					nearby_excerpt: '',
					source_format: document.source_format,
				},
				created_at: '2026-06-05T00:00:00Z',
				created_by: 'user-1',
			},
		]);

		expect(railItems[0]).toMatchObject({
			id: 'sug-1',
			status: 'needs-approval',
			source: 'ewa',
		});
	});
});
