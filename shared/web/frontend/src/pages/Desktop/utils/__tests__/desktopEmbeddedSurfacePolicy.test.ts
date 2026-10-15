/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave E/F inventory: desktop `<video controls>` / `<audio controls>` use media
 * ПКМ policy props; SPA-wide `<iframe>` files mark `data-desktop-iframe-host`.
 *
 * Invariants:
 * - Host attribute does not claim to suppress ПКМ inside the iframe document.
 * - Media-controls scan stays scoped to Desktop/; iframe inventory walks src/.
 *
 * Related:
 * - desktopEmbeddedSurfacePolicy.ts
 * - documentation/product/desktop/DESKTOP-CONTEXT-MENU-ARCHITECTURE.md
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
	DESKTOP_IFRAME_HOST_ATTR,
	onDesktopMediaContextMenu,
} from '../desktopEmbeddedSurfacePolicy';

const DESKTOP_ROOT = join(__dirname, '../..');
/** SPA inventory root = `src/` (not only Desktop/). */
const SRC_ROOT = join(__dirname, '../../../../');

/** Hidden transport / custom UI without browser `controls` chrome. */
const MEDIA_WITHOUT_CONTROLS_ALLOWLIST = new Set([
	'NowPlayingProvider.tsx',
	'GafChatVoiceMessagePlayer.tsx',
]);

function walkTsx(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (
			name === '__tests__' ||
			name === 'node_modules' ||
			name === 'generated'
		) {
			continue;
		}
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

describe('onDesktopMediaContextMenu', () => {
	it('suppresses native menu on a video element', () => {
		const video = document.createElement('video');
		document.body.appendChild(video);
		const event = {
			target: video,
			preventDefault: vi.fn(),
			stopPropagation: vi.fn(),
		} as unknown as Event;
		onDesktopMediaContextMenu(event);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(event.stopPropagation).not.toHaveBeenCalled();
		video.remove();
	});
});

describe('desktop embedded surface inventory', () => {
	it('exports stable iframe host attribute name', () => {
		expect(DESKTOP_IFRAME_HOST_ATTR).toBe('data-desktop-iframe-host');
	});

	it('files with media controls import desktopMediaContextMenuProps', () => {
		const offenders: string[] = [];
		for (const path of walkTsx(DESKTOP_ROOT)) {
			const base = path.split(/[/\\]/).pop() ?? path;
			if (MEDIA_WITHOUT_CONTROLS_ALLOWLIST.has(base)) continue;
			const src = readFileSync(path, 'utf8');
			if (!/\bcontrols\b/.test(src)) continue;
			if (!/<(video|audio)\b/.test(src)) continue;
			if (!src.includes('desktopMediaContextMenuProps')) {
				offenders.push(base);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('files with iframe mark data-desktop-iframe-host (SPA-wide)', () => {
		const offenders: string[] = [];
		for (const path of walkTsx(SRC_ROOT)) {
			const src = readFileSync(path, 'utf8');
			if (!src.includes('<iframe')) continue;
			const hasHostAttr =
				src.includes('data-desktop-iframe-host') ||
				src.includes('DESKTOP_IFRAME_HOST_ATTR');
			if (!hasHostAttr) {
				offenders.push(path.split(/[/\\]/).pop() ?? path);
			}
		}
		expect(offenders).toEqual([]);
	});
});
