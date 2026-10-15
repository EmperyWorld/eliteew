/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * W1 source locks — Identifying gate until full boot; no HomeScreen flash.
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §3 / wave W1
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const app = join(root, 'App.tsx');
const boot = join(root, 'hooks/useNativeBoot.ts');
const identifying = join(root, 'features/boot/IdentifyingScreen.tsx');

describe('Journey W1 Identifying (source)', () => {
	it('App gates HomeScreen behind Identifying / journeyPhase', () => {
		const src = readFileSync(app, 'utf8');
		expect(src).toContain('phaseAfterIdentifying');
		expect(src).toContain('IdentifyingScreen');
		expect(src).toContain('showIdentifying');
		expect(src).toContain('showActivation');
		expect(src).toContain('channelRestoreDone');
		expect(src).toContain('entitlementStatusDone');
		expect(src).toContain('bootFailed');
		expect(src).toMatch(
			/showActivation\s*\?\s*(?:\([\s\S]*?)?<ActivationScreen/
		);
		expect(src).toMatch(
			/showIdentifying\s*\?\s*(?:\([\s\S]*?)?<IdentifyingScreen/
		);
	});

	it('useNativeBoot exposes full resolve flags + retry', () => {
		const src = readFileSync(boot, 'utf8');
		expect(src).toContain('setChannelRestoreDone(true)');
		expect(src).toContain('setEntitlementStatusDone(true)');
		expect(src).toContain('setBootFailed(true)');
		expect(src).toContain('retryBoot');
		expect(src).toContain('[bootAttempt]');
		expect(src).toContain('desktop_client_boot_fail');
	});

	it('IdentifyingScreen is calm brand preloader with a11y', () => {
		const src = readFileSync(identifying, 'utf8');
		expect(src).toContain('aria-busy');
		expect(src).toContain('Подготавливаем EliteEW');
		expect(src).toContain('Повторить');
		expect(src).not.toContain('HomeScreen');
		expect(src).not.toContain('onImportSeatJsonText');
		expect(src).toMatch(/export function IdentifyingScreen/);
	});

	it('defers updater auto-apply until entitlementStatusDone', () => {
		const src = readFileSync(app, 'utf8');
		expect(src).toContain('handleUpdateCheckAndAutoApply');
		expect(src).toMatch(
			/entitlementStatusDone[\s\S]*?handleUpdateCheckAndAutoApply/
		);
		expect(src).not.toMatch(
			/useEffect\(\(\) => \{\s*if \(!nativeReady\) return;\s*\/\/ Retail Linux/
		);
	});
});
