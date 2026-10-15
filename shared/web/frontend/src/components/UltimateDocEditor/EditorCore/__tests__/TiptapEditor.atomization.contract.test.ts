/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract Waves 1–7: TiptapEditor parent keeps named exports while
 * gutter, menus, hooks, extensions factory, and inner shell live in EditorCore modules.
 *
 * Invariants:
 * - Parent TiptapEditor.tsx still exports TiptapEditor and TiptapEditorCore.
 * - Parent LOC ≤800; each wave child module ≤800.
 *
 * Related:
 * - TiptapEditor.tsx, TiptapEditorInner.tsx
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const editorCoreDir = join(dir, '..');
const MAX_PARENT_LOC = 800;
const MAX_CHILD_LOC = 800;

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('TiptapEditor atomization contract (waves 1–7)', () => {
	const parentPath = join(editorCoreDir, 'TiptapEditor.tsx');
	const innerPath = join(editorCoreDir, 'TiptapEditorInner.tsx');
	const wave1Modules = [
		'tiptapGutterMeasure.ts',
		'commentAnchorExtension.ts',
		'tiptapEditorProseStyles.ts',
	] as const;
	const wave2Modules = [
		'TiptapBubbleMenu.tsx',
		'TiptapFloatingMenu.tsx',
		'tiptapFloatingUiOptions.ts',
	] as const;
	const wave3Modules = [
		'TiptapLineGutter.tsx',
		'TiptapAnchorQuickMenu.tsx',
	] as const;
	const wave4Modules = ['useTiptapGutterLayout.ts'] as const;
	const wave5Modules = [
		'useTiptapRuntimeDialogs.ts',
		'useTiptapCommentAnchors.ts',
	] as const;
	const wave6Modules = ['createCoreTiptapExtensions.ts'] as const;
	const wave7Modules = ['TiptapEditorInner.tsx'] as const;

	const allWaveModules = [
		...wave1Modules,
		...wave2Modules,
		...wave3Modules,
		...wave4Modules,
		...wave5Modules,
		...wave6Modules,
		...wave7Modules,
	] as const;

	it('parent exports TiptapEditor and TiptapEditorCore', () => {
		const src = read(parentPath);
		expect(src).toMatch(/export\s+const\s+TiptapEditorCore\b/);
		expect(src).toMatch(/export\s+const\s+TiptapEditor\b/);
	});

	it('parent is thin shell (imports TiptapEditorInner, no useEditor body)', () => {
		const src = read(parentPath);
		expect(src).toContain("from './TiptapEditorInner'");
		expect(src).toContain('<TiptapEditorInner');
		expect(src).not.toMatch(/\buseEditor\s*\(/);
		expect(src).not.toMatch(/from '\.\/createCoreTiptapExtensions'/);
	});

	it('inner wires wave 1–4 extracted modules', () => {
		const src = read(innerPath);
		expect(src).toContain("from './tiptapEditorProseStyles'");
		expect(src).toContain('<TiptapEditorProseStyles');
		expect(src).toContain("from './TiptapBubbleMenu'");
		expect(src).toContain("from './TiptapFloatingMenu'");
		expect(src).toContain("from './tiptapFloatingUiOptions'");
		expect(src).toContain('<TiptapBubbleMenu');
		expect(src).toContain('<TiptapFloatingMenu');
		expect(src).not.toMatch(/from '@tiptap\/react\/menus'/);
		expect(src).toContain("from './TiptapLineGutter'");
		expect(src).toContain("from './TiptapAnchorQuickMenu'");
		expect(src).toContain('<TiptapLineGutter');
		expect(src).toContain('<TiptapAnchorQuickMenu');
		expect(src).toContain("from './useTiptapGutterLayout'");
		expect(src).toContain('useTiptapGutterLayout(');
		expect(src).not.toContain('measureVisualRowsInBlock');
	});

	it('inner wires wave 5–6 extracted modules', () => {
		const src = read(innerPath);
		expect(src).toContain("from './useTiptapRuntimeDialogs'");
		expect(src).toContain('useTiptapRuntimeDialogs(');
		expect(src).toContain("from './useTiptapCommentAnchors'");
		expect(src).toContain('useTiptapCommentAnchors(');
		expect(src).toContain("from './createCoreTiptapExtensions'");
		expect(src).toContain('createCoreTiptapExtensions(');
		expect(src).not.toContain('DOC_EDITOR_RUNTIME_DIALOG_EVENT');
		expect(src).not.toContain('COMMENT_ANCHOR_PLUGIN_KEY');
	});

	it('wave 5 runtime dialogs hook owns dialog event wiring', () => {
		const src = read(join(editorCoreDir, 'useTiptapRuntimeDialogs.ts'));
		expect(src).toContain('DOC_EDITOR_RUNTIME_DIALOG_EVENT');
		expect(src).toContain('handleRuntimeLinkSubmit');
		expect(src).toContain('applyPendingTextColor');
	});

	it('wave 5 comment anchors hook owns decoration and quick menu state', () => {
		const src = read(join(editorCoreDir, 'useTiptapCommentAnchors.ts'));
		expect(src).toContain('COMMENT_ANCHOR_PLUGIN_KEY');
		expect(src).toContain('comment-anchor-flash');
		expect(src).toContain('handleEditorClickCapture');
	});

	it('wave 6 extensions factory aligns with collab seed', () => {
		const extSrc = read(join(editorCoreDir, 'createCoreTiptapExtensions.ts'));
		const seedSrc = read(join(editorCoreDir, 'collabSeedYDoc.ts'));
		expect(extSrc).toContain('CommentAnchorExtension');
		expect(extSrc).toContain('CollaborationLocalTypingHighlight');
		expect(seedSrc).toContain("from './createCoreTiptapExtensions'");
		expect(seedSrc).toContain('includeCommentAnchors: false');
	});

	it('all wave child modules exist', () => {
		for (const name of allWaveModules) {
			expect(existsSync(join(editorCoreDir, name))).toBe(true);
		}
	});

	it('parent LOC ≤800 and each child module ≤800', () => {
		const parentLoc = lineCount(parentPath);
		expect(parentLoc).toBeLessThanOrEqual(MAX_PARENT_LOC);
		expect(parentLoc).toBeLessThan(2600);

		for (const name of allWaveModules) {
			const childLoc = lineCount(join(editorCoreDir, name));
			expect(childLoc).toBeLessThanOrEqual(MAX_CHILD_LOC);
		}
	});

	it('TiptapLineGutter owns gutter track markup', () => {
		const src = read(join(editorCoreDir, 'TiptapLineGutter.tsx'));
		expect(src).toContain('data-gutter-track');
		expect(src).not.toContain('measureVisualRowsInBlock');
	});

	it('useTiptapGutterLayout owns gutter layout logic', () => {
		const src = read(join(editorCoreDir, 'useTiptapGutterLayout.ts'));
		expect(src).toContain('measureVisualRowsInBlock');
		expect(src).toContain('GUTTER_LAYOUT_DEBOUNCE_MS');
		expect(src).toContain('ResizeObserver');
		expect(src).toContain('bootstrapGutterLayout');
		expect(src).toContain("updateVisualLines('full')");
	});
});
