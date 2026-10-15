/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Component tests for DesktopFolderEmptyStatePanel CTA visibility.
 *
 * Invariants:
 * - Create actions render only when parent enables them.
 *
 * Related:
 * - DesktopFolderEmptyStatePanel.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopFolderEmptyStatePanel } from '../DesktopFolderEmptyStatePanel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, string>) => {
			if (key === 'folderWindow.emptyHint' && params?.name) {
				return `Empty hint for ${params.name}`;
			}
			return key;
		},
	}),
}));

describe('DesktopFolderEmptyStatePanel', () => {
	const baseProps = {
		folderTitle: 'Projects',
		folderUploadBusy: false,
		effectiveFolderId: 'folder-1',
		onOpenNewFolderDialog: vi.fn(),
		onCreateMarkdownHere: vi.fn(),
		onUploadClick: vi.fn(),
		onOpenContentManager: vi.fn(),
	};

	it('renders upload and content manager CTAs always', () => {
		render(
			<DesktopFolderEmptyStatePanel
				{...baseProps}
				canOpenNewFolderDialog={false}
				canCreateMarkdownInFolder={false}
			/>
		);

		expect(screen.getByText('folderWindow.upload')).toBeTruthy();
		expect(screen.getByText('folderWindow.emptyCta')).toBeTruthy();
		expect(screen.getByText('folderWindow.pasteHint')).toBeTruthy();
	});

	it('renders create actions when enabled', () => {
		render(
			<DesktopFolderEmptyStatePanel
				{...baseProps}
				canOpenNewFolderDialog
				canCreateMarkdownInFolder
			/>
		);

		expect(
			screen.getByText('enhancedContextMenu.desktop.newFolder')
		).toBeTruthy();
		expect(
			screen.getByText('enhancedContextMenu.desktop.newMarkdownFile')
		).toBeTruthy();
	});
});
