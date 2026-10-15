/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * U2 inventory lock: only shellBodyPortal.tsx may call createPortal(..., document.body)
 * under pages/Desktop prod sources (tests excluded).
 *
 * Related:
 * - ../shellBodyPortal.tsx
 * - scripts/eliteew/desktop-u2-portal-inventory.sh
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SHELL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP_ROOT = join(SHELL_DIR, '..');
const ALLOWED_REL = 'shell/shellBodyPortal.tsx';

const SKIP_DIR_NAMES = new Set([
	'__tests__',
	'node_modules',
	'dist',
	'dist-build',
]);

function walkTsFiles(dir: string, out: string[]): void {
	for (const name of readdirSync(dir)) {
		if (SKIP_DIR_NAMES.has(name)) continue;
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			walkTsFiles(full, out);
			continue;
		}
		if (!/\.(ts|tsx)$/.test(name)) continue;
		if (/\.(test|spec)\.(ts|tsx)$/.test(name)) continue;
		out.push(full);
	}
}

/** Strip line + block comments so docstrings do not trip inventory. */
function stripComments(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Heuristic: createPortal(… document.body) spanning a short window. */
function hasCreatePortalToDocumentBody(src: string): boolean {
	const code = stripComments(src);
	if (!/\bcreatePortal\b/.test(code)) return false;
	const re = /createPortal\s*\(\s*[\s\S]{0,400}?,\s*document\.body\s*\)/g;
	return re.test(code);
}

describe('U2 portal body createPortal inventory', () => {
	it('allows createPortal(document.body) only in shell/shellBodyPortal.tsx', () => {
		const files: string[] = [];
		walkTsFiles(DESKTOP_ROOT, files);
		const offenders: string[] = [];
		for (const file of files) {
			const rel = relative(DESKTOP_ROOT, file).replaceAll('\\', '/');
			if (rel === ALLOWED_REL) continue;
			const src = readFileSync(file, 'utf8');
			if (hasCreatePortalToDocumentBody(src)) {
				offenders.push(rel);
			}
		}
		expect(offenders, `raw body portals:\n${offenders.join('\n')}`).toEqual([]);
	});

	it('shellBodyPortal owns the sole document.body createPortal', () => {
		const src = readFileSync(join(SHELL_DIR, 'shellBodyPortal.tsx'), 'utf8');
		expect(hasCreatePortalToDocumentBody(src)).toBe(true);
	});
});
