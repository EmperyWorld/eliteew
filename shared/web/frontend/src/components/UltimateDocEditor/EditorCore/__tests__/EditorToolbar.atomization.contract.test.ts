/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract Waves 1–4: EditorToolbar parent keeps named export while
 * tool groups, popover modules, overflow layout, and compose hook live in EditorCore.
 *
 * Invariants:
 * - Parent EditorToolbar.tsx still exports EditorToolbar and is ≤800 LOC.
 * - All child atomization modules are ≤800 LOC.
 * - useEditorToolbarCompose runs before isUsableTiptapEditor guard.
 *
 * Related:
 * - EditorToolbar.tsx, useEditorToolbarCompose.ts, EditorToolbarOverflowLayout.tsx
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const editorCoreDir = join(dir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('EditorToolbar atomization contract (waves 1–4)', () => {
	const parentPath = join(editorCoreDir, 'EditorToolbar.tsx');

	const wave1Modules = [
		'EditorToolbarToolGroup.tsx',
		'EditorToolbarIconButton.tsx',
		'editorToolbarUrlSanitize.ts',
	] as const;

	const wave2Modules = [
		'EditorToolbarPopoverFrame.tsx',
		'useEditorToolbarPopovers.ts',
		'EditorToolbarLinkPopoverBody.tsx',
		'EditorToolbarImagePopoverBody.tsx',
		'EditorToolbarTablePopoverBody.tsx',
		'EditorToolbarFontFamilyPopoverBody.tsx',
	] as const;

	const wave3Modules = [
		'EditorToolbarHistoryGroup.tsx',
		'EditorToolbarInlineGroup.tsx',
		'EditorToolbarStructureGroup.tsx',
		'EditorToolbarListsGroup.tsx',
		'EditorToolbarAlignGroup.tsx',
		'EditorToolbarInsertGroup.tsx',
		'EditorToolbarAccentGroup.tsx',
		'EditorToolbarOverflowLayout.tsx',
	] as const;

	const wave4Modules = ['useEditorToolbarCompose.ts'] as const;

	const allWaveModules = [
		...wave1Modules,
		...wave2Modules,
		...wave3Modules,
		...wave4Modules,
	] as const;

	it('parent exports EditorToolbar', () => {
		const src = read(parentPath);
		expect(src).toMatch(/export\s+const\s+EditorToolbar\b/);
	});

	it('parent wires wave 1 extracted modules', () => {
		const src = read(parentPath);
		expect(src).not.toMatch(/\bfunction\s+ToolbarToolGroup\b/);
		expect(src).not.toMatch(/\bToolbarIconButton\s*=\s*forwardRef/);
		expect(src).not.toMatch(/\bfunction\s+sanitizeUrl\b/);
		expect(src).not.toMatch(/\bfunction\s+sanitizeImageSrc\b/);
		expect(src).not.toMatch(/\bfunction\s+clampSize\b/);
	});

	it('parent wires wave 2 via compose hook and group modules', () => {
		const src = read(parentPath);
		expect(src).toContain("from './useEditorToolbarCompose'");
		expect(src).toContain('useEditorToolbarCompose(');
		expect(src).not.toContain("from './useEditorToolbarPopovers'");
		expect(src).not.toMatch(/\brenderPopoverFrame\b/);
		expect(src).not.toContain('<EditorToolbarPopoverFrame');
	});

	it('parent wires wave 3 group modules and overflow layout', () => {
		const src = read(parentPath);
		expect(src).toContain("from './EditorToolbarHistoryGroup'");
		expect(src).toContain("from './EditorToolbarInlineGroup'");
		expect(src).toContain("from './EditorToolbarStructureGroup'");
		expect(src).toContain("from './EditorToolbarListsGroup'");
		expect(src).toContain("from './EditorToolbarAlignGroup'");
		expect(src).toContain("from './EditorToolbarInsertGroup'");
		expect(src).toContain("from './EditorToolbarAccentGroup'");
		expect(src).toContain("from './EditorToolbarOverflowLayout'");
		expect(src).toContain('<EditorToolbarHistoryGroup');
		expect(src).toContain('<EditorToolbarOverflowLayout');
	});

	it('hooks run before isUsableTiptapEditor guard in parent', () => {
		const src = read(parentPath);
		const hookIdx = src.indexOf('useEditorToolbarCompose(');
		const guardIdx = src.indexOf('if (!isUsableTiptapEditor(editor))');
		expect(hookIdx).toBeGreaterThan(-1);
		expect(guardIdx).toBeGreaterThan(-1);
		expect(hookIdx).toBeLessThan(guardIdx);
	});

	it('useEditorToolbarCompose delegates to useEditorToolbarPopovers', () => {
		const src = read(join(editorCoreDir, 'useEditorToolbarCompose.ts'));
		expect(src).toContain('useEditorToolbarPopovers(');
		expect(src).toContain('useReducedMotion');
		expect(src).toContain('useTranslation');
	});

	it('useEditorToolbarPopovers owns popover state and handlers', () => {
		const src = read(join(editorCoreDir, 'useEditorToolbarPopovers.ts'));
		expect(src).toContain('activePopover');
		expect(src).toContain('togglePopover');
		expect(src).toContain('handleInsertLink');
		expect(src).toContain('overflowMenuOpen');
		expect(src).toContain('sanitizeUrl');
		expect(src).toContain('sanitizeImageSrc');
		expect(src).toContain('clampSize');
	});

	it('EditorToolbarOverflowLayout owns narrow strip and overflow panel id', () => {
		const src = read(join(editorCoreDir, 'EditorToolbarOverflowLayout.tsx'));
		expect(src).toContain('id="editor-toolbar-overflow-panel"');
		expect(src).toContain('toolbarNarrow');
		expect(src).toContain('historyGroup');
		expect(src).toContain('ShellPortalMount');
	});

	it('EditorToolbarPopoverFrame owns ShellPortalMount popover shell', () => {
		const src = read(join(editorCoreDir, 'EditorToolbarPopoverFrame.tsx'));
		expect(src).toContain('ShellPortalMount');
		expect(src).not.toMatch(/createPortal\s*\(/);
	});

	it('editorToolbarUrlSanitize exports sanitize helpers', () => {
		const src = read(join(editorCoreDir, 'editorToolbarUrlSanitize.ts'));
		expect(src).toContain('export function sanitizeUrl');
		expect(src).toContain('export function sanitizeImageSrc');
		expect(src).toContain('export function clampSize');
	});

	it('all wave child modules exist', () => {
		for (const name of allWaveModules) {
			expect(existsSync(join(editorCoreDir, name))).toBe(true);
		}
	});

	it('parent and all child modules stay within LOC gate', () => {
		const parentLoc = lineCount(parentPath);
		expect(parentLoc).toBeLessThan(1468);
		expect(parentLoc).toBeLessThanOrEqual(800);

		for (const name of allWaveModules) {
			const childLoc = lineCount(join(editorCoreDir, name));
			expect(childLoc).toBeLessThanOrEqual(800);
		}
	});
});
