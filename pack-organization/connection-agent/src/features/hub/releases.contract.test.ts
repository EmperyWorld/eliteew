/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * W4 source locks — bundled notes, auto-apply suppress, notes-shown persistence.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.2 / wave W4
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BUNDLED_USER_RELEASE_NOTES,
	assertUserNotesSafe,
	releaseNotesPathsMatchCanon,
} from '../../lib/launcher/journey/releaseNotesContent';
import {
	UPDATE_NOTES_SHOWN_KEY,
	markUpdateNotesShownForVersion,
	readUpdateNotesShownForVersion,
} from '../../lib/launcher/journey/updateNotesShown';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const clientRoot = join(root, '..');
const app = join(root, 'App.tsx');
const releases = join(root, 'features/hub/tabs/ReleasesTab.tsx');
const updater = join(root, 'hooks/useUpdater.ts');
const userNotesPath = join(
	clientRoot,
	'docs/RELEASE-NOTES-user.ru.txt'
);

describe('Journey W4 Релизы (source)', () => {
	it('App gates silent auto-apply with maySilentAutoApplyUpdate + notes shown', () => {
		const src = readFileSync(app, 'utf8');
		expect(src).toContain('maySilentAutoApplyUpdate');
		expect(src).toContain('DEFAULT_AUTO_APPLY_POLICY');
		expect(src).toContain('markUpdateNotesShownForVersion');
		expect(src).toContain('readUpdateNotesShownForVersion');
		expect(src).toContain('updateNotesShownForVersion');
		expect(src).toContain('maySilentAutoApply');
	});

	it('useUpdater suppresses install when maySilentAutoApply returns false', () => {
		const src = readFileSync(updater, 'utf8');
		expect(src).toContain('maySilentAutoApply');
		expect(src).toContain('Откройте раздел «Релизы»');
		expect(src).toContain('handleUpdateCheckAndAutoApply');
	});

	it('ReleasesTab shows bundled Что нового notes', () => {
		const src = readFileSync(releases, 'utf8');
		expect(src).toContain('BUNDLED_USER_RELEASE_NOTES');
		expect(src).toContain('Что нового');
		expect(src).not.toContain('появятся в следующем этапе');
	});

	it('docs RELEASE-NOTES-user.ru.txt exists and is user-safe', () => {
		const disk = readFileSync(userNotesPath, 'utf8');
		expect(disk.trim().length).toBeGreaterThan(40);
		expect(assertUserNotesSafe(disk)).toBe(true);
		expect(assertUserNotesSafe(BUNDLED_USER_RELEASE_NOTES)).toBe(true);
		expect(releaseNotesPathsMatchCanon()).toBe(true);
		expect(BUNDLED_USER_RELEASE_NOTES).toContain('license@eliteew.ru');
	});
});

describe('updateNotesShown persistence', () => {
	const store = new Map<string, string>();

	beforeEach(() => {
		store.clear();
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, String(v));
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
			clear: () => store.clear(),
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('round-trips version string', () => {
		expect(readUpdateNotesShownForVersion()).toBeNull();
		markUpdateNotesShownForVersion('0.4.42');
		expect(store.get(UPDATE_NOTES_SHOWN_KEY)).toBe('0.4.42');
		expect(readUpdateNotesShownForVersion()).toBe('0.4.42');
	});
});
