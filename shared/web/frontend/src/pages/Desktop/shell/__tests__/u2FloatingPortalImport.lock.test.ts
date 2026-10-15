/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * U2.1 lock: prod Desktop/components apps must not import DesktopShellFloatingPortal;
 * overlays use ShellPortalMount / useShellPortal from shell/.
 *
 * Related:
 * - ../shellPortal.tsx
 * - documentation/product/desktop/DESKTOP-SHELL-U1-APP-REGISTRY-DESIGN.md
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SHELL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP_ROOT = join(SHELL_DIR, '..');
const COMPONENTS = join(DESKTOP_ROOT, 'components');

const ALLOWED_REL = new Set(['components/DesktopShellFloatingPortal.tsx']);

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

function stripComments(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('U2.1 FloatingPortal import ban', () => {
	it('components do not import DesktopShellFloatingPortal path', () => {
		const files: string[] = [];
		walkTsFiles(COMPONENTS, files);
		const offenders: string[] = [];
		for (const file of files) {
			const rel = relative(DESKTOP_ROOT, file).replaceAll('\\', '/');
			if (ALLOWED_REL.has(rel)) continue;
			const code = stripComments(readFileSync(file, 'utf8'));
			if (/from\s+['"][^'"]*DesktopShellFloatingPortal['"]/.test(code)) {
				offenders.push(rel);
			}
		}
		expect(
			offenders,
			`legacy FloatingPortal imports:\n${offenders.join('\n')}`
		).toEqual([]);
	});

	it('apps do not call createPortal (sole owner shellBodyPortal)', () => {
		const files: string[] = [];
		walkTsFiles(DESKTOP_ROOT, files);
		const offenders: string[] = [];
		for (const file of files) {
			const rel = relative(DESKTOP_ROOT, file).replaceAll('\\', '/');
			if (rel === 'shell/shellBodyPortal.tsx') continue;
			const code = stripComments(readFileSync(file, 'utf8'));
			if (!/\bcreatePortal\b/.test(code)) continue;
			if (
				/from\s+['"]react-dom['"]/.test(code) ||
				/from\s+['"]react-dom\//.test(code)
			) {
				offenders.push(rel);
			}
		}
		expect(offenders, `app createPortal:\n${offenders.join('\n')}`).toEqual([]);
	});
});
