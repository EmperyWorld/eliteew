/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * U3.1 lock: `src/features/**` must not import DesktopShellFloatingPortal,
 * must not call createPortal(..., document.body), and must not import
 * getDesktopPortalShellProps from utils/desktopUi (shell path only).
 * Rail-host portals (non-body) remain allowed.
 *
 * Related:
 * - documentation/product/desktop/SHELL-LIFECYCLE-AND-CHROME-SSOT.md
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 * - u2PortalBodyCreatePortal.lock.test.ts (heuristic)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FRONTEND_SRC = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../..'
);
const FEATURES_ROOT = join(FRONTEND_SRC, 'features');

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

function importsFloatingPortal(code: string): boolean {
	return /from\s+['"][^'"]*DesktopShellFloatingPortal['"]/.test(code);
}

function importsPortalThemeFromDesktopUi(code: string): boolean {
	return (
		/\bgetDesktopPortalShellProps\b/.test(code) &&
		/from\s+['"][^'"]*\/utils\/desktopUi['"]/.test(code)
	);
}

describe('U3.1 features FloatingPortal / body portal / desktopUi theme path', () => {
	it('features have zero DesktopShellFloatingPortal imports', () => {
		const files: string[] = [];
		walkTsFiles(FEATURES_ROOT, files);
		const offenders: string[] = [];
		for (const file of files) {
			const rel = relative(FRONTEND_SRC, file).replaceAll('\\', '/');
			const code = stripComments(readFileSync(file, 'utf8'));
			if (importsFloatingPortal(code)) offenders.push(rel);
		}
		expect(
			offenders,
			`FloatingPortal imports:\n${offenders.join('\n')}`
		).toEqual([]);
	});

	it('features have zero createPortal(..., document.body)', () => {
		const files: string[] = [];
		walkTsFiles(FEATURES_ROOT, files);
		const offenders: string[] = [];
		for (const file of files) {
			const rel = relative(FRONTEND_SRC, file).replaceAll('\\', '/');
			const src = readFileSync(file, 'utf8');
			if (hasCreatePortalToDocumentBody(src)) offenders.push(rel);
		}
		expect(offenders, `body createPortal:\n${offenders.join('\n')}`).toEqual(
			[]
		);
	});

	it('features do not import getDesktopPortalShellProps from utils/desktopUi', () => {
		const files: string[] = [];
		walkTsFiles(FEATURES_ROOT, files);
		const offenders: string[] = [];
		for (const file of files) {
			const rel = relative(FRONTEND_SRC, file).replaceAll('\\', '/');
			const code = stripComments(readFileSync(file, 'utf8'));
			if (importsPortalThemeFromDesktopUi(code)) offenders.push(rel);
		}
		expect(
			offenders,
			`desktopUi theme imports:\n${offenders.join('\n')}`
		).toEqual([]);
	});
});
