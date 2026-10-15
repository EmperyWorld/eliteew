/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Inventory lock: every `data-taskbar-interactive="true"` host in Desktop must
 * either own an onContextMenu handler or be an allowlisted exception.
 *
 * Invariants:
 * - New interactive taskbar controls without ПКМ handler fail this contract.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DESKTOP_ROOT = join(__dirname, '../..');

/** Files that intentionally mark interactive without React onContextMenu in the same file
 * (handler is inlined via prop from parent, or non-button surface). Keep tiny. */
const ALLOWLIST_BASENAMES = new Set<string>([
	// Presentational tile — onContextMenu passed as prop from TaskbarPinnedMenuIsland.
	'TaskbarPinnedAppTile.tsx',
]);

function walkTsx(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === '__tests__' || name === 'node_modules') continue;
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			walkTsx(full, out);
			continue;
		}
		if (name.endsWith('.tsx')) out.push(full);
	}
	return out;
}

describe('taskbar-interactive ПКМ inventory', () => {
	it('each data-taskbar-interactive host file defines onContextMenu or is allowlisted', () => {
		const files = walkTsx(DESKTOP_ROOT).filter((path) => {
			const src = readFileSync(path, 'utf8');
			return src.includes('data-taskbar-interactive');
		});
		expect(files.length).toBeGreaterThan(0);

		const offenders: string[] = [];
		for (const path of files) {
			const base = path.split(/[/\\]/).pop() ?? path;
			if (ALLOWLIST_BASENAMES.has(base)) continue;
			const src = readFileSync(path, 'utf8');
			if (!src.includes('onContextMenu')) {
				offenders.push(base);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('each data-taskbar-interactive site has onContextMenu in the following lines', () => {
		const files = walkTsx(DESKTOP_ROOT).filter((path) => {
			const src = readFileSync(path, 'utf8');
			return src.includes('data-taskbar-interactive');
		});
		const offenders: string[] = [];
		for (const path of files) {
			const base = path.split(/[/\\]/).pop() ?? path;
			if (ALLOWLIST_BASENAMES.has(base)) continue;
			const lines = readFileSync(path, 'utf8').split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i] ?? '';
				// JSX attribute only — skip selector strings like closest('[data-taskbar-interactive=…]').
				if (!/^\s*data-taskbar-interactive="true"/.test(line)) continue;
				const window = lines.slice(i, i + 28).join('\n');
				if (!window.includes('onContextMenu')) {
					offenders.push(`${base}:${i + 1}`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});
