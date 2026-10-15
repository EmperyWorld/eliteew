/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * DOM contract fragility scan — abstract modules + alternative editor wrappers.
 *
 * Related:
 * - tiptapGutterDomContract.ts
 * - tiptapGutterStableEstimate.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	assertGutterModuleUsesAbstractDomContract,
	GUTTER_CONTENT_ROOT_SELECTOR,
	GUTTER_DOM_ABSTRACT_MODULES,
	resolveGutterContentRoot,
	resolveGutterContentRootDetailed,
	resolveGutterScrollContainer,
} from './tiptapGutterDomContract';

const moduleDir = dirname(fileURLToPath(import.meta.url));

describe('tiptapGutterDomContract', () => {
	it('resolveGutterContentRoot prefers contenteditable ProseMirror surface', () => {
		const host = document.createElement('div');
		const root = document.createElement('div');
		root.className = 'ProseMirror';
		root.setAttribute('contenteditable', 'true');
		host.appendChild(root);

		expect(resolveGutterContentRoot(host)).toBe(root);
	});

	it('Selector Robustness — alternative wrapper without ProseMirror class resolves via role=textbox', () => {
		const host = document.createElement('div');
		const root = document.createElement('div');
		root.setAttribute('role', 'textbox');
		root.setAttribute('contenteditable', 'true');
		root.className = 'doc-editor-custom-surface';
		host.appendChild(root);

		const resolved = resolveGutterContentRootDetailed(host);
		expect(resolved.root).toBe(root);
		expect(['selector-primary', 'selector-fallback']).toContain(
			resolved.resolution
		);
	});

	it('Selector Robustness — nested contenteditable resolves without ProseMirror class', () => {
		const host = document.createElement('div');
		const shell = document.createElement('div');
		shell.className = 'editor-shell-v2';
		const root = document.createElement('div');
		root.setAttribute('contenteditable', 'true');
		root.textContent = 'nested';
		shell.appendChild(root);
		host.appendChild(shell);

		const resolved = resolveGutterContentRootDetailed(host);
		expect(resolved.root).toBe(root);
		expect(resolved.resolution).not.toBe('missing');
	});

	it('Selector Robustness — explicit data-gutter-content-root override wins', () => {
		const host = document.createElement('div');
		const decoy = document.createElement('div');
		decoy.className = 'ProseMirror';
		decoy.setAttribute('contenteditable', 'true');
		const root = document.createElement('div');
		root.setAttribute('data-gutter-content-root', '');
		host.append(decoy, root);

		const resolved = resolveGutterContentRootDetailed(host);
		expect(resolved.root).toBe(root);
		expect(resolved.resolution).toBe('operator-override');
	});

	it('Selector Robustness — broken host returns null without throwing', () => {
		const host = document.createElement('div');
		host.innerHTML = '<div class="not-an-editor"></div>';
		expect(resolveGutterContentRoot(host)).toBeNull();
		expect(resolveGutterContentRootDetailed(host).resolution).toBe('missing');
	});

	it('resolveGutterScrollContainer uses product scroll marker before parent fallback', () => {
		const scroll = document.createElement('div');
		scroll.setAttribute('data-doc-editor-scroll', '');
		const root = document.createElement('div');
		root.className = 'ProseMirror';
		scroll.appendChild(root);
		document.body.appendChild(scroll);

		expect(resolveGutterScrollContainer(root)).toBe(scroll);
		document.body.innerHTML = '';
	});

	it('Selector Fragility — abstract gutter modules avoid .tiptap-specific selectors', () => {
		for (const moduleName of GUTTER_DOM_ABSTRACT_MODULES) {
			const src = readFileSync(join(moduleDir, moduleName), 'utf8');
			expect(() =>
				assertGutterModuleUsesAbstractDomContract(src, moduleName)
			).not.toThrow();
		}
	});

	it('tiptapGutterStableEstimate uses direct block children only (no querySelector)', () => {
		const src = readFileSync(
			join(moduleDir, 'tiptapGutterStableEstimate.ts'),
			'utf8'
		);
		expect(src).toContain('proseMirrorRoot.children');
		expect(src).not.toMatch(/querySelector/);
	});

	it('content root selector documents ProseMirror/contenteditable contract without .tiptap', () => {
		expect(GUTTER_CONTENT_ROOT_SELECTOR).toContain('contenteditable');
		expect(GUTTER_CONTENT_ROOT_SELECTOR).toContain('ProseMirror');
		expect(GUTTER_CONTENT_ROOT_SELECTOR).not.toContain('.tiptap');
	});
});
