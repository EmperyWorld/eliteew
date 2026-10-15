/**
 * Tests Content Manager folder move scope patches (project bind + scope clear).
 */
import { describe, expect, it } from 'vitest';
import { buildContentMoveScopePatch } from './contentManagerFolderScopePatch';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';
const COMPANY_ID = '660e8400-e29b-41d4-a716-446655440001';
const PROJECT_FOLDER = `eliteew-proj-${PROJECT_ID}`;

describe('buildContentMoveScopePatch', () => {
	it('binds project folder to company and project', () => {
		expect(
			buildContentMoveScopePatch(PROJECT_FOLDER, [
				{
					id: PROJECT_ID,
					name: 'Plasma diagnostics',
					company_id: COMPANY_ID,
				},
			])
		).toEqual({
			folder_item_id: PROJECT_FOLDER,
			project_id: PROJECT_ID,
			company_id: COMPANY_ID,
		});
	});

	it('clears company and project for regular folders', () => {
		expect(buildContentMoveScopePatch('documents', [])).toEqual({
			folder_item_id: 'documents',
			project_id: null,
			company_id: null,
		});
	});

	it('clears scope for unfiled target', () => {
		expect(buildContentMoveScopePatch(null, [])).toEqual({
			folder_item_id: null,
			project_id: null,
			company_id: null,
		});
	});
});
