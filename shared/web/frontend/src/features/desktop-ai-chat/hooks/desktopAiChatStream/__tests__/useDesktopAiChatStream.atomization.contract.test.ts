/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for useDesktopAiChatStream: facade keeps stable import path
 * while helpers, types, event handlers, run, actions, and orchestrator live under
 * hooks/desktopAiChatStream/.
 *
 * Invariants:
 * - Parent hooks/useDesktopAiChatStream.ts re-exports hook + types and is ≤50 LOC.
 * - All child atomization modules are ≤800 LOC.
 *
 * Related:
 * - hooks/useDesktopAiChatStream.ts
 * - hooks/desktopAiChatStream/useDesktopAiChatStream.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const streamDir = join(dir, '..');
const hooksDir = join(streamDir, '..');
const featureDir = join(hooksDir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('useDesktopAiChatStream atomization contract', () => {
	const facadePath = join(hooksDir, 'useDesktopAiChatStream.ts');

	const helperModules = [
		'helpers.ts',
		'types.ts',
		'streamEventHandlers.ts',
	] as const;

	const hookModules = [
		'useDesktopAiChatStreamRun.ts',
		'useDesktopAiChatStreamActions.ts',
		'useDesktopAiChatStream.ts',
	] as const;

	const allChildModules = [...helperModules, ...hookModules] as const;

	it('facade re-exports hook and types from desktopAiChatStream/', () => {
		const src = read(facadePath);
		expect(src).toMatch(
			/export\s+\{\s*useDesktopAiChatStream\s*\}\s+from\s+['"]\.\/desktopAiChatStream\/useDesktopAiChatStream['"]/
		);
		expect(src).toMatch(/export\s+type\s+\{\s*LastFailedSendState/);
		expect(src).toMatch(/UseDesktopAiChatStreamParams/);
	});

	it('app compose still imports from hooks/useDesktopAiChatStream', () => {
		const composeSrc = read(
			join(featureDir, 'app/useDesktopAiChatAppCompose.ts')
		);
		expect(composeSrc).toMatch(
			/from\s+['"]\.\.\/hooks\/useDesktopAiChatStream['"]/
		);
	});

	it('orchestrator composes run and action sub-hooks', () => {
		const src = read(join(streamDir, 'useDesktopAiChatStream.ts'));
		expect(src).toContain("from './useDesktopAiChatStreamRun'");
		expect(src).toContain("from './useDesktopAiChatStreamActions'");
		expect(src).toContain('useDesktopAiChatStreamRun(');
		expect(src).toContain('useDesktopAiChatStreamActions(');
		expect(src).not.toMatch(/\bfunction\s+formatToolsTraceSummary\b/);
		expect(src).not.toMatch(/\bfunction\s+runStream\b/);
	});

	it('key symbols exist in extracted modules', () => {
		expect(read(join(streamDir, 'helpers.ts'))).toContain(
			'export function isAbortError'
		);
		expect(read(join(streamDir, 'helpers.ts'))).toContain(
			'export function resolveUseWebSearchFlag'
		);
		expect(read(join(streamDir, 'helpers.ts'))).toContain(
			'export function formatToolsTraceSummary'
		);
		expect(read(join(streamDir, 'types.ts'))).toContain(
			'export type LastFailedSendState'
		);
		expect(read(join(streamDir, 'types.ts'))).toContain(
			'export type UseDesktopAiChatStreamParams'
		);
		expect(read(join(streamDir, 'streamEventHandlers.ts'))).toContain(
			'export function createDesktopAiChatStreamEventHandler'
		);
		expect(read(join(streamDir, 'useDesktopAiChatStreamRun.ts'))).toContain(
			'export function useDesktopAiChatStreamRun'
		);
		expect(read(join(streamDir, 'useDesktopAiChatStreamActions.ts'))).toContain(
			'export function useDesktopAiChatStreamActions'
		);
	});

	it('named export is a function', async () => {
		const mod = await import('../../useDesktopAiChatStream');
		expect(typeof mod.useDesktopAiChatStream).toBe('function');
	});

	it('all child modules exist', () => {
		for (const name of allChildModules) {
			expect(existsSync(join(streamDir, name))).toBe(true);
		}
	});

	it('facade stays thin and all children stay within LOC gate', () => {
		const facadeLoc = lineCount(facadePath);
		expect(facadeLoc).toBeLessThanOrEqual(50);

		for (const name of allChildModules) {
			const childLoc = lineCount(join(streamDir, name));
			expect(childLoc, name).toBeLessThanOrEqual(800);
		}
	});
});
