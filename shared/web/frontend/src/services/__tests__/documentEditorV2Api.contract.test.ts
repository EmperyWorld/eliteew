/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock: Document Editor V2 client paths and generated pilot schema names stay aligned.
 *
 * Invariants:
 * - Pilot JSON under openapi/pilot/doc-editor-v2.openapi.json must list the HTTP paths the client calls.
 * - Generated schemas used by documentEditorV2Api must exist in the pilot.
 *
 * Related:
 * - src/services/documentEditorV2Api.ts
 * - documentation/product/DOCUMENT-EDITOR-V2.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { components } from '@/generated/doc-editor-v2-openapi';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PILOT_PATH = join(
	__dirname,
	'../../../openapi/pilot/doc-editor-v2.openapi.json'
);

describe('documentEditorV2Api OpenAPI contract', () => {
	it('pilot covers client HTTP paths', () => {
		const pilot = JSON.parse(readFileSync(PILOT_PATH, 'utf8')) as {
			paths: Record<string, unknown>;
		};
		const required = [
			'/api/v1/doc-editor-v2/documents',
			'/api/v1/doc-editor-v2/documents/{document_id}',
			'/api/v1/doc-editor-v2/documents/{document_id}/draft',
			'/api/v1/doc-editor-v2/documents/{document_id}/structure',
			'/api/v1/doc-editor-v2/documents/{document_id}/collaboration',
			'/api/v1/doc-editor-v2/documents/{document_id}/collaboration/snapshot',
			'/api/v1/doc-editor-v2/documents/{document_id}/ewa/suggest',
			'/api/v1/doc-editor-v2/documents/{document_id}/suggestions/{suggestion_id}/apply',
			'/api/v1/doc-editor-v2/import',
			'/api/v1/doc-editor-v2/documents/{document_id}/export',
		];
		for (const path of required) {
			expect(pilot.paths[path], path).toBeTruthy();
		}
	});

	it('exposes document response schema for client aliases', () => {
		type Doc = components['schemas']['DocEditorV2DocumentResponse'];
		const probe: Doc = {
			document_id: 'd1',
			owner_user_id: 'u1',
			title: 't',
			editor_format: 'html',
			editor_json: null,
			content_html: '',
			content_markdown: '',
			plain_text: '',
			source_format: 'html',
			parse_warnings: [],
			version: 1,
			capabilities: {
				can_read: true,
				can_edit: true,
				can_comment: false,
				can_collaborate: false,
				can_apply_ewa: false,
				can_export: true,
			},
			tags: [],
			created_at: '2026-07-14T00:00:00Z',
			updated_at: '2026-07-14T00:00:00Z',
		};
		expect(probe.document_id).toBe('d1');
	});
});
