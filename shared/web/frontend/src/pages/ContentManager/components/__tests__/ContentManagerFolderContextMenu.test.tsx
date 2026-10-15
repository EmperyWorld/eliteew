/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest lock for Content Manager folder context menu (system vs user folders).
 *
 * Invariants:
 * - System folders hide rename/delete; user folders expose them.
 *
 * Related:
 * - ContentManagerFolderContextMenu.tsx
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContentManagerFolderContextMenu } from '../ContentManagerFolderContextMenu';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('../../../Desktop/context/DesktopWindowPortalStackContext', () => ({
	useDesktopWindowPortalStackBase: () => 12000,
}));

vi.mock('../../../Desktop/utils/desktopUi', () => ({
	getDesktopPortalShellProps: () => ({
		style: {},
		theme: 'dark' as const,
	}),
}));

describe('ContentManagerFolderContextMenu', () => {
	it('hides rename/delete for system folders', () => {
		render(
			<ContentManagerFolderContextMenu
				target={{ item_id: 'ewa_file', name: 'EwaFile', is_system: true }}
				openPosition={{ x: 40, y: 40 }}
				onClose={vi.fn()}
				onOpen={vi.fn()}
				onNewFolder={vi.fn()}
				onRename={vi.fn()}
				onDelete={vi.fn()}
				onRefresh={vi.fn()}
			/>
		);
		expect(screen.getByText('explorer.folderMenu.open')).toBeTruthy();
		expect(screen.getByText('explorer.folderMenu.newFolder')).toBeTruthy();
		expect(screen.queryByText('explorer.folderMenu.rename')).toBeNull();
		expect(screen.queryByText('explorer.folderMenu.delete')).toBeNull();
	});

	it('exposes rename/delete for user folders', async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(
			<ContentManagerFolderContextMenu
				target={{ item_id: 'folder-1', name: 'My folder', is_system: false }}
				openPosition={{ x: 40, y: 40 }}
				onClose={vi.fn()}
				onOpen={vi.fn()}
				onNewFolder={vi.fn()}
				onRename={vi.fn()}
				onDelete={onDelete}
				onRefresh={vi.fn()}
			/>
		);
		expect(screen.getByText('explorer.folderMenu.rename')).toBeTruthy();
		await user.click(screen.getByText('explorer.folderMenu.delete'));
		expect(onDelete).toHaveBeenCalledWith('folder-1', 'My folder');
	});
});
