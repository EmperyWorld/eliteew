/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Atomization contract for AIAssistantPanel: facade keeps named export while
 * mappers, hooks, UI subpanels, and compose hook live under aiAssistant/.
 *
 * Invariants:
 * - Parent Panels/AIAssistantPanel.tsx re-exports AIAssistantPanel and is ≤50 LOC.
 * - All child atomization modules are ≤800 LOC.
 * - useAIAssistantCompose wires chat, voice, insert policy, and suggestions.
 *
 * Related:
 * - Panels/AIAssistantPanel.tsx, useAIAssistantCompose.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const aiAssistantDir = join(dir, '..');
const panelsDir = join(aiAssistantDir, '..');

function lineCount(absPath: string): number {
	return readFileSync(absPath, 'utf8').split('\n').length;
}

function read(absPath: string): string {
	return readFileSync(absPath, 'utf8');
}

describe('AIAssistantPanel atomization contract', () => {
	const facadePath = join(panelsDir, 'AIAssistantPanel.tsx');
	const innerPath = join(aiAssistantDir, 'AIAssistantPanel.tsx');

	const mapperModules = [
		'aiAssistantErrorMappers.ts',
		'aiAssistantTypes.ts',
	] as const;

	const hookModules = [
		'useAIAssistantVoice.ts',
		'useAIAssistantInsertPolicy.ts',
		'useAIAssistantChat.ts',
		'useAIAssistantSuggestions.ts',
		'useAIAssistantCompose.ts',
	] as const;

	const uiModules = [
		'AIAssistantHeader.tsx',
		'AIAssistantContextBanners.tsx',
		'AIAssistantToolbar.tsx',
		'AIAssistantChatRegion.tsx',
		'AIAssistantSuggestionsList.tsx',
		'AIAssistantSavedPrompts.tsx',
		'AIAssistantComposer.tsx',
		'AIAssistantSavePromptModal.tsx',
	] as const;

	const allChildModules = [
		...mapperModules,
		...hookModules,
		...uiModules,
	] as const;

	it('facade re-exports AIAssistantPanel from aiAssistant/', () => {
		const src = read(facadePath);
		expect(src).toMatch(
			/export\s+\{\s*AIAssistantPanel\s*\}\s+from\s+['"]@\/components\/UltimateDocEditor\/Panels\/aiAssistant\/AIAssistantPanel['"]/
		);
		expect(src).toMatch(/export\s+type\s+\{\s*AIAssistantPanelProps\s*\}/);
	});

	it('inner panel delegates to useAIAssistantCompose and subpanels', () => {
		const src = read(innerPath);
		expect(src).toContain(
			"from '@/components/UltimateDocEditor/Panels/aiAssistant/useAIAssistantCompose'"
		);
		expect(src).toContain('useAIAssistantCompose(');
		expect(src).toContain('<AIAssistantHeader');
		expect(src).toContain('<AIAssistantContextBanners');
		expect(src).toContain('<AIAssistantToolbar');
		expect(src).toContain('<AIAssistantChatRegion');
		expect(src).toContain('<AIAssistantComposer');
		expect(src).toContain('<AIAssistantSavePromptModal');
		expect(src).not.toMatch(/\bfunction\s+mapAiErrorForUser\b/);
		expect(src).not.toMatch(/\bfunction\s+mapMicAccessError\b/);
	});

	it('useAIAssistantCompose wires chat, voice, insert policy, suggestions', () => {
		const src = read(join(aiAssistantDir, 'useAIAssistantCompose.ts'));
		expect(src).toContain('useAIAssistantChat(');
		expect(src).toContain('useAIAssistantVoice(');
		expect(src).toContain('useAIAssistantInsertPolicy(');
		expect(src).toContain('useAIAssistantSuggestions(');
		expect(src).toContain('completeTextStreaming');
		expect(src).toContain('showSavePromptModal');
	});

	it('key symbols exist in extracted modules', () => {
		expect(read(join(aiAssistantDir, 'aiAssistantErrorMappers.ts'))).toContain(
			'export function mapAiErrorForUser'
		);
		expect(read(join(aiAssistantDir, 'aiAssistantErrorMappers.ts'))).toContain(
			'export function mapMicAccessError'
		);
		expect(read(join(aiAssistantDir, 'useAIAssistantChat.ts'))).toContain(
			'handleSubmit'
		);
		expect(
			read(join(aiAssistantDir, 'useAIAssistantInsertPolicy.ts'))
		).toContain('pre-insert-check');
		expect(read(join(aiAssistantDir, 'useAIAssistantVoice.ts'))).toContain(
			'handleVoiceToggle'
		);
	});

	it('all child modules exist', () => {
		for (const name of allChildModules) {
			expect(existsSync(join(aiAssistantDir, name))).toBe(true);
		}
	});

	it('facade stays thin and all children stay within LOC gate', () => {
		const facadeLoc = lineCount(facadePath);
		const innerLoc = lineCount(innerPath);
		expect(facadeLoc).toBeLessThanOrEqual(50);
		expect(innerLoc).toBeLessThanOrEqual(800);

		for (const name of allChildModules) {
			const childLoc = lineCount(join(aiAssistantDir, name));
			expect(childLoc).toBeLessThanOrEqual(800);
		}
	});
});
