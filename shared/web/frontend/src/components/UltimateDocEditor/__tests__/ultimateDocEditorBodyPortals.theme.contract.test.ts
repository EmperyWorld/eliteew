/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Doc Editor body portals to ShellPortalMount / shell theme props.
 *
 * Related:
 * - documentation/product/ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

describe('Ultimate Doc Editor body portal theme contract', () => {
	it('export menu uses ShellPortalMount', () => {
		const src = readSrc('../chrome/UltimateDocEditorDocumentHeader.tsx');
		expect(src).toContain('ShellPortalMount');
		expect(src).not.toContain('DesktopShellFloatingPortal');
		expect(src).not.toMatch(/createPortal\s*\(/);
	});

	it('toolbar popovers and overflow use ShellPortalMount', () => {
		const toolbarSrc = readSrc('../EditorCore/EditorToolbar.tsx');
		const overflowLayoutSrc = readSrc(
			'../EditorCore/EditorToolbarOverflowLayout.tsx'
		);
		const popoverFrameSrc = readSrc(
			'../EditorCore/EditorToolbarPopoverFrame.tsx'
		);
		expect(overflowLayoutSrc).toContain('ShellPortalMount');
		expect(popoverFrameSrc).toContain('ShellPortalMount');
		expect(toolbarSrc).not.toContain('DesktopShellFloatingPortal');
		expect(overflowLayoutSrc).not.toContain('DesktopShellFloatingPortal');
		expect(popoverFrameSrc).not.toContain('DesktopShellFloatingPortal');
		expect(toolbarSrc).not.toMatch(/createPortal\s*\(/);
		expect(overflowLayoutSrc).not.toMatch(/createPortal\s*\(/);
		expect(popoverFrameSrc).not.toMatch(/createPortal\s*\(/);
	});

	it('color picker uses ShellPortalMount', () => {
		const src = readSrc('../components/ColorPicker.tsx');
		expect(src).toContain('ShellPortalMount');
		expect(src).not.toContain('DesktopShellFloatingPortal');
		expect(src).not.toMatch(/createPortal\s*\(/);
	});

	it('context menus use ShellPortalMount (no createPortal body)', () => {
		const editorCtx = readSrc('../components/EditorContextMenu.tsx');
		const fileCtx = readSrc('../Panels/FileManagerDocContextMenu.tsx');
		expect(editorCtx).toContain('ShellPortalMount');
		expect(editorCtx).toContain('getDesktopPortalShellProps');
		expect(editorCtx).not.toMatch(/createPortal\s*\(/);
		expect(fileCtx).toContain('ShellPortalMount');
		expect(fileCtx).not.toMatch(/createPortal\s*\(/);
	});
});
