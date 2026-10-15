/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component-level regression coverage for the EWA embedded file-list output surface.
 *
 * Invariants:
 * - Empty file-list results announce politely.
 * - File rows switch to embedded document mode and never open Content Manager directly.
 *
 * Related:
 * - ../CompanionFileListMode
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionFileListMode } from '../CompanionFileListMode';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string | number>) => {
			if (key === 'ewaCompanion.fileListSurfaceTitle') return 'EwaFile files';
			if (key === 'ewaCompanion.fileListSurfaceSubtitleBrowse')
				return `Found: ${params?.count ?? ''}`;
			if (key === 'ewaCompanion.fileListSurfaceClickHint')
				return 'Click a file to open it here in the editor.';
			if (key === 'ewaCompanion.fileListSurfaceEmpty')
				return 'No matching files found.';
			if (key === 'ewaCompanion.fileListSurfaceListAria')
				return 'Files that can be opened in this window';
			if (key === 'ewaCompanion.fileListSurfaceOpenFileAria')
				return `Open "${params?.title ?? ''}" here in the editor`;
			if (key === 'ewaCompanion.fileListSurfaceDone') return 'Done';
			if (key === 'ewaCompanion.outputSurfaceBackToChat') return 'Back';
			return key;
		},
	}),
}));

describe('CompanionFileListMode', () => {
	it('announces empty results as a polite status', () => {
		render(
			<CompanionFileListMode
				payload={{ items: [], row_count: 0 }}
				onBackToChat={vi.fn()}
				onOpenFile={vi.fn()}
			/>
		);

		const status = screen.getByRole('status');
		expect(status).toHaveAttribute('aria-live', 'polite');
		expect(status).toHaveTextContent('No matching files found.');
	});

	it('labels file rows by their open-in-editor action', () => {
		const onOpenFile = vi.fn();
		render(
			<CompanionFileListMode
				payload={{
					items: [
						{
							unified_content_id: 'uc-1',
							title: 'Launch Notes',
							content_type: 'document',
							mime_type: 'text/markdown',
						},
					],
				}}
				onBackToChat={vi.fn()}
				onOpenFile={onOpenFile}
			/>
		);

		expect(
			screen.getByRole('list', {
				name: 'Files that can be opened in this window',
			})
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Open "Launch Notes" here in the editor',
			})
		);

		expect(onOpenFile).toHaveBeenCalledWith({
			mode: 'document_editor',
			payload: {
				source: 'file_list',
				unifiedContentId: 'uc-1',
				title: 'Launch Notes',
			},
		});
	});
});
