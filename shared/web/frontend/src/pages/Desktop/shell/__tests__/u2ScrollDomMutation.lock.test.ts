/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * U2 scroll lock: apps/features must not write data-desktop-scroll /
 * data-shell-scroll-* or mutate shell window-section overflow — only
 * EnhancedWindow + shell own DomFlags.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CHROME-DECLUTTER-AND-SCROLL.md
 * - ../shellScroll.ts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SHELL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESKTOP_ROOT = join(SHELL_DIR, '..');
const FRONTEND_SRC = join(DESKTOP_ROOT, '../../..');

const ALLOWED_REL_PREFIXES = [
	'pages/Desktop/components/EnhancedWindow.tsx',
	'pages/Desktop/shell/',
	'pages/Desktop/utils/desktopWindowBodyScrollRegistry.ts',
	'pages/Desktop/utils/__tests__/',
	'pages/Desktop/components/__tests__/EnhancedWindow',
	'pages/Desktop/shell/__tests__/',
];

const SKIP_DIR_NAMES = new Set([
	'__tests__',
	'node_modules',
	'dist',
	'dist-build',
]);

const MUTATION_PATTERNS: RegExp[] = [
	/setAttribute\s*\(\s*['"]data-desktop-scroll['"]/,
	/setAttribute\s*\(\s*['"]data-shell-scroll-/,
	/\[['"]data-desktop-scroll['"]\]\s*=/,
	/\[['"]data-shell-scroll-[^'"]+['"]\]\s*=/,
	/\.dataset\.desktopScroll\s*=/,
];

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

function isAllowed(relFromSrc: string): boolean {
	return ALLOWED_REL_PREFIXES.some(
		(p) => relFromSrc === p || relFromSrc.startsWith(p)
	);
}

describe('U2 scroll DomFlags mutation lock', () => {
	it('apps under Desktop + features do not write shell scroll attrs', () => {
		const roots = [join(DESKTOP_ROOT), join(FRONTEND_SRC, 'features')];
		const offenders: string[] = [];
		for (const root of roots) {
			const files: string[] = [];
			try {
				walkTsFiles(root, files);
			} catch {
				continue;
			}
			for (const file of files) {
				const rel = relative(FRONTEND_SRC, file).replaceAll('\\', '/');
				if (isAllowed(rel)) continue;
				const src = readFileSync(file, 'utf8');
				for (const re of MUTATION_PATTERNS) {
					if (re.test(src)) {
						offenders.push(`${rel} (${re.source})`);
						break;
					}
				}
			}
		}
		expect(offenders, `scroll DOM mutations:\n${offenders.join('\n')}`).toEqual(
			[]
		);
	});
});
